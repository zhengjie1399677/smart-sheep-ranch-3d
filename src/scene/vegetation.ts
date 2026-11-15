import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const sharedWindTime = { value: 0 };

/** Advance GPU wind animation phase for all instanced farmland grass meshes. */
export function updateVegetationWind(elapsed: number): void {
  sharedWindTime.value = elapsed;
}

export type BlenderTreeSpecies = 'poplar' | 'broadleaf' | 'saxaul' | 'shelter';

export interface BlenderTreeAsset {
  woodGeometry: THREE.BufferGeometry;
  woodMaterial: THREE.MeshStandardMaterial;
  foliageGeometry: THREE.BufferGeometry;
  foliageMaterial: THREE.MeshStandardMaterial;
  foliageDepthMaterial: THREE.MeshDepthMaterial;
}

function applyTreeWindSway(
  mat: THREE.MeshStandardMaterial | THREE.MeshDepthMaterial,
  cacheKey: string,
): void {
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = sharedWindTime;
    shader.vertexShader = `uniform float uGrassTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 treeWorldBase = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #else
        vec4 treeWorldBase = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #endif
      float swayH = max(0.0, transformed.y - 1.15);
      float swayPhase = uGrassTime * 1.45 + treeWorldBase.x * 0.14 + treeWorldBase.z * 0.11;
      float swayAmp = swayH * swayH * 0.011;
      transformed.x += sin(swayPhase) * swayAmp;
      transformed.z += cos(swayPhase * 0.82) * swayAmp * 0.72;`,
    );
  };
}

let cachedTreeAssetsPromise: Promise<Record<BlenderTreeSpecies, BlenderTreeAsset>> | null = null;

/**
 * Load the Blender-authored 4-species botanical tree library (public/models/trees_library.glb)
 * once and share geometries/alpha-tested leaf materials across all instanced forest belts.
 */
export function loadBlenderTreeAssets(): Promise<Record<BlenderTreeSpecies, BlenderTreeAsset>> {
  if (cachedTreeAssetsPromise) return cachedTreeAssetsPromise;

  cachedTreeAssetsPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      './models/trees_library.glb',
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const namePrefix: Record<BlenderTreeSpecies, string> = {
          poplar: 'Tree_Poplar',
          broadleaf: 'Tree_Broadleaf',
          saxaul: 'Tree_Saxaul',
          shelter: 'Tree_Shelter',
        };

        const result = {} as Record<BlenderTreeSpecies, BlenderTreeAsset>;
        const speciesList: BlenderTreeSpecies[] = ['poplar', 'broadleaf', 'saxaul', 'shelter'];

        for (const sp of speciesList) {
          const prefix = namePrefix[sp];
          const woodMesh = gltf.scene.getObjectByName(`${prefix}_Wood`) as THREE.Mesh | undefined;
          const foliageMesh = gltf.scene.getObjectByName(`${prefix}_Foliage`) as THREE.Mesh | undefined;
          if (!woodMesh || !foliageMesh) {
            reject(new Error(`Missing Blender tree mesh pair for ${prefix}`));
            return;
          }

          const woodGeo = woodMesh.geometry.clone();
          const foliageGeo = foliageMesh.geometry.clone();
          woodGeo.applyMatrix4(woodMesh.matrix);
          foliageGeo.applyMatrix4(foliageMesh.matrix);

          const srcWoodMat = woodMesh.material as THREE.MeshStandardMaterial;
          const woodMaterial = srcWoodMat.clone();
          woodMaterial.color.setHex(0xffffff);
          woodMaterial.vertexColors = Boolean(woodGeo.getAttribute('color'));
          woodMaterial.roughness = 0.9;
          applyTreeWindSway(woodMaterial, `tree-wood-sway-${sp}`);

          const srcFolMat = foliageMesh.material as THREE.MeshStandardMaterial;
          const foliageMaterial = srcFolMat.clone();
          foliageMaterial.color.setHex(0xffffff);
          foliageMaterial.transparent = false;
          foliageMaterial.alphaTest = 0.45;
          foliageMaterial.side = THREE.DoubleSide;
          foliageMaterial.vertexColors = Boolean(foliageGeo.getAttribute('color'));
          foliageMaterial.roughness = 0.78;
          foliageMaterial.metalness = 0.02;
          foliageMaterial.needsUpdate = true;
          applyTreeWindSway(foliageMaterial, `tree-foliage-sway-${sp}`);

          const foliageDepthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            map: foliageMaterial.map,
            alphaTest: 0.45,
            side: THREE.DoubleSide,
          });
          applyTreeWindSway(foliageDepthMaterial, `tree-foliage-depth-${sp}`);

          result[sp] = {
            woodGeometry: woodGeo,
            woodMaterial,
            foliageGeometry: foliageGeo,
            foliageMaterial,
            foliageDepthMaterial,
          };
        }

        resolve(result);
      },
      undefined,
      (err) => reject(err),
    );
  });

  return cachedTreeAssetsPromise;
}

/**
 * Create a MeshStandardMaterial wired with zero-cost vertex-shader wind sway.
 * Base vertices at y=0 stay firmly anchored while upper blades flex in the wind.
 */
export function createAnimatedGrassMaterial(roughness = 0.8): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness: 0.02,
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  mat.customProgramCacheKey = () => 'smart-ranch-grass-wind-v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = sharedWindTime;
    shader.vertexShader = `uniform float uGrassTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 grassWorldBase = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float swayH = clamp(transformed.y, 0.0, 2.4);
        float gustPhase = uGrassTime * 2.0 + grassWorldBase.x * 0.21 + grassWorldBase.z * 0.16;
        transformed.x += sin(gustPhase) * swayH * swayH * 0.068;
        transformed.z += cos(gustPhase * 0.84) * swayH * swayH * 0.048;
      #endif`,
    );
  };

  return mat;
}

interface BladeParams {
  height: number;
  width: number;
  bend: number;
  tiltAngle: number;
  yawAngle: number;
  offsetX: number;
  offsetZ: number;
  segments?: number;
  keelDepth?: number;
  rootShade?: [number, number, number];
  tipShade?: [number, number, number];
}

/**
 * Build a single tapered, V-creased curved grass blade anchored at local origin.
 * Shading gradients live in vertex colors and multiply cleanly with instanceColor.
 */
function buildCurvedBlade(p: BladeParams): THREE.BufferGeometry {
  const segs = p.segments ?? 3;
  const keel = p.keelDepth ?? p.width * 0.24;
  const rootC = p.rootShade ?? [0.46, 0.54, 0.42];
  const tipC = p.tipShade ?? [0.98, 1.0, 0.88];

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const qRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tiltAngle, p.yawAngle, 0, 'YXZ'));
  const v = new THREE.Vector3();

  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const w = p.width * Math.sin((1 - t * 0.88) * (Math.PI * 0.5));
    const y = p.height * (t - 0.08 * p.bend * t * t);
    const zCurve = p.bend * p.height * t * t * 0.42;

    const r = THREE.MathUtils.lerp(rootC[0], tipC[0], Math.pow(t, 0.72));
    const g = THREE.MathUtils.lerp(rootC[1], tipC[1], Math.pow(t, 0.72));
    const b = THREE.MathUtils.lerp(rootC[2], tipC[2], Math.pow(t, 0.72));

    const ridgePull = keel * (1 - t * 0.8);
    const slicePts: Array<[number, number, number]> = [
      [-w * 0.5, y, zCurve],
      [0, y, zCurve - ridgePull],
      [w * 0.5, y, zCurve],
    ];

    for (const [lx, ly, lz] of slicePts) {
      v.set(lx, ly, lz).applyQuaternion(qRot);
      positions.push(v.x + p.offsetX, Math.max(0, v.y), v.z + p.offsetZ);
      colors.push(r, g, b);
    }
  }

  const tipY = p.height * (1 - 0.08 * p.bend);
  const tipZ = p.bend * p.height * 0.42;
  v.set(0, tipY, tipZ).applyQuaternion(qRot);
  positions.push(v.x + p.offsetX, Math.max(0.02, v.y), v.z + p.offsetZ);
  colors.push(tipC[0], tipC[1], tipC[2]);
  const tipIndex = segs * 3;

  for (let i = 0; i < segs - 1; i++) {
    const row = i * 3;
    const next = (i + 1) * 3;
    indices.push(row, next, next + 1);
    indices.push(row, next + 1, row + 1);
    indices.push(row + 1, next + 1, next + 2);
    indices.push(row + 1, next + 2, row + 2);
  }

  const lastRow = (segs - 1) * 3;
  indices.push(lastRow, tipIndex, lastRow + 1);
  indices.push(lastRow + 1, tipIndex, lastRow + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Build tall multi-leaf forage clump geometry (silage maize / sudan grass) for West Center-Pivot. */
export function createSilageForageClumpGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  for (let i = 0; i < 4; i++) {
    const yaw = (i / 4) * Math.PI * 2 + 0.35;
    parts.push(
      buildCurvedBlade({
        height: 1.32 + (i % 2) * 0.16,
        width: 0.28,
        bend: 0.68,
        tiltAngle: 0.32 + (i % 2) * 0.08,
        yawAngle: yaw,
        offsetX: Math.sin(yaw) * 0.14,
        offsetZ: Math.cos(yaw) * 0.14,
        segments: 3,
        rootShade: [0.42, 0.52, 0.38],
        tipShade: [0.96, 1.0, 0.84],
      }),
    );
  }

  for (let i = 0; i < 4; i++) {
    const yaw = (i / 4) * Math.PI * 2 + 1.1;
    parts.push(
      buildCurvedBlade({
        height: 1.65 + (i % 2) * 0.18,
        width: 0.24,
        bend: 0.44,
        tiltAngle: 0.14 + (i % 2) * 0.06,
        yawAngle: yaw,
        offsetX: Math.sin(yaw) * 0.07,
        offsetZ: Math.cos(yaw) * 0.07,
        segments: 3,
        rootShade: [0.48, 0.58, 0.44],
        tipShade: [1.0, 1.0, 0.88],
      }),
    );
  }

  parts.push(
    buildCurvedBlade({
      height: 1.92,
      width: 0.16,
      bend: 0.18,
      tiltAngle: 0.05,
      yawAngle: 0.4,
      offsetX: 0,
      offsetZ: 0,
      segments: 3,
      rootShade: [0.54, 0.62, 0.48],
      tipShade: [1.0, 0.98, 0.82],
    }),
  );

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Build dense bushy alfalfa & legume clover mound geometry for East Pivot, Alfalfa Strip, and P区. */
export function createAlfalfaBushGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  for (let i = 0; i < 6; i++) {
    const yaw = (i / 6) * Math.PI * 2 + (i % 2) * 0.18;
    parts.push(
      buildCurvedBlade({
        height: 0.78 + (i % 2) * 0.12,
        width: 0.34,
        bend: 0.58,
        tiltAngle: 0.44 + (i % 3) * 0.08,
        yawAngle: yaw,
        offsetX: Math.sin(yaw) * 0.16,
        offsetZ: Math.cos(yaw) * 0.16,
        segments: 3,
        keelDepth: 0.08,
        rootShade: [0.44, 0.52, 0.4],
        tipShade: [0.94, 1.0, 0.9],
      }),
    );
  }

  for (let i = 0; i < 4; i++) {
    const yaw = (i / 4) * Math.PI * 2 + 0.62;
    parts.push(
      buildCurvedBlade({
        height: 0.94 + (i % 2) * 0.1,
        width: 0.3,
        bend: 0.34,
        tiltAngle: 0.18,
        yawAngle: yaw,
        offsetX: Math.sin(yaw) * 0.06,
        offsetZ: Math.cos(yaw) * 0.06,
        segments: 3,
        keelDepth: 0.07,
        rootShade: [0.52, 0.62, 0.48],
        tipShade: [1.0, 0.98, 0.95],
      }),
    );
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export interface TreeGeometryPair {
  trunk: THREE.BufferGeometry;
  foliage: THREE.BufferGeometry;
}

function finalizeNonIndexedWoodPart(
  geo: THREE.BufferGeometry,
  cBottom: [number, number, number],
  cTop: [number, number, number],
  minY: number,
  maxY: number,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const span = Math.max(0.01, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - minY) / span, 0, 1);
    colors[i * 3] = THREE.MathUtils.lerp(cBottom[0], cTop[0], t);
    colors[i * 3 + 1] = THREE.MathUtils.lerp(cBottom[1], cTop[1], t);
    colors[i * 3 + 2] = THREE.MathUtils.lerp(cBottom[2], cTop[2], t);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  geo.dispose();
  return g;
}

function makeBranchSegment(
  from: [number, number, number],
  to: [number, number, number],
  rBottom: number,
  rTop: number,
  radialSegs = 6,
): THREE.BufferGeometry {
  const p0 = new THREE.Vector3(...from);
  const p1 = new THREE.Vector3(...to);
  const dir = p1.clone().sub(p0);
  const len = Math.max(0.05, dir.length());
  const cyl = new THREE.CylinderGeometry(rTop, rBottom, len, radialSegs, 1);
  cyl.translate(0, len * 0.5, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  cyl.applyQuaternion(q);
  cyl.translate(p0.x, p0.y, p0.z);
  return cyl;
}

function makeSculptedFoliageLobe(
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  seed: number,
  detail = 1,
): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1, detail);
  base.deleteAttribute('uv');
  const pos = base.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    // Watertight deterministic spatial displacement so adjacent faces stay welded
    const n = 1 + 0.16 * Math.sin(vx * 3.4 + seed) * Math.cos(vy * 2.9 - vz * 3.1 + seed * 0.7);
    pos.setXYZ(i, cx + vx * rx * n, cy + vy * ry * n, cz + vz * rz * n);
  }
  base.computeVertexNormals();
  return base;
}

function applyCrownAOShading(
  parts: THREE.BufferGeometry[],
  cInnerDark: [number, number, number],
  cUpperLit: [number, number, number],
): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());

  const pos = merged.getAttribute('position');
  let minY = Infinity;
  let maxY = -Infinity;
  let maxRad = 0.01;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const r = Math.hypot(x, z);
    if (r > maxRad) maxRad = r;
  }

  const spanY = Math.max(0.1, maxY - minY);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const hT = (y - minY) / spanY;
    const radT = Math.hypot(x, z) / maxRad;
    const sunT = THREE.MathUtils.clamp(hT * 0.68 + radT * 0.24 + (x + z) / (maxRad * 8.0), 0, 1);
    colors[i * 3] = THREE.MathUtils.lerp(cInnerDark[0], cUpperLit[0], sunT);
    colors[i * 3 + 1] = THREE.MathUtils.lerp(cInnerDark[1], cUpperLit[1], sunT);
    colors[i * 3 + 2] = THREE.MathUtils.lerp(cInnerDark[2], cUpperLit[2], sunT);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

/** Build tall desert-shelterbelt Poplar tree (flared trunk, 4 boughs, 9-lobe crown). */
export function createPoplarTreeGeometries(): TreeGeometryPair {
  const woodParts: THREE.BufferGeometry[] = [
    makeBranchSegment([0, -0.1, 0], [0.06, 2.2, 0.04], 0.48, 0.3, 7),
    makeBranchSegment([0.06, 2.1, 0.04], [-0.04, 4.9, -0.02], 0.3, 0.14, 6),
    makeBranchSegment([0.05, 2.3, 0.03], [0.82, 4.1, 0.48], 0.19, 0.08, 5),
    makeBranchSegment([0.04, 2.5, 0.02], [-0.76, 4.3, 0.56], 0.18, 0.08, 5),
    makeBranchSegment([0.02, 2.7, 0.01], [0.46, 4.6, -0.78], 0.16, 0.07, 5),
    makeBranchSegment([-0.02, 3.1, -0.01], [-0.55, 5.1, -0.58], 0.15, 0.06, 5),
  ];
  const mergedWood = mergeGeometries(
    woodParts.map((w) => finalizeNonIndexedWoodPart(w, [0.54, 0.45, 0.38], [0.88, 0.78, 0.7], -0.1, 5.1)),
    false,
  );

  const foliageParts: THREE.BufferGeometry[] = [
    makeSculptedFoliageLobe(0.0, 4.6, 0.0, 1.55, 1.8, 1.55, 1.1, 1),
    makeSculptedFoliageLobe(0.95, 4.0, 0.52, 1.18, 1.15, 1.12, 2.3, 1),
    makeSculptedFoliageLobe(-0.88, 4.15, 0.62, 1.14, 1.18, 1.15, 3.7, 1),
    makeSculptedFoliageLobe(0.54, 4.45, -0.88, 1.12, 1.25, 1.08, 4.9, 1),
    makeSculptedFoliageLobe(-0.62, 4.85, -0.68, 1.06, 1.22, 1.08, 5.5, 1),
    makeSculptedFoliageLobe(0.18, 5.95, 0.12, 1.22, 1.45, 1.18, 6.2, 1),
    makeSculptedFoliageLobe(-0.15, 6.85, -0.06, 0.88, 1.1, 0.88, 7.4, 1),
    makeSculptedFoliageLobe(0.52, 3.25, -0.24, 0.92, 0.85, 0.92, 8.1, 1),
    makeSculptedFoliageLobe(-0.56, 3.35, 0.18, 0.9, 0.82, 0.88, 9.3, 1),
  ];
  const mergedFoliage = applyCrownAOShading(foliageParts, [0.46, 0.56, 0.44], [1.0, 1.0, 0.88]);
  return { trunk: mergedWood, foliage: mergedFoliage };
}

/** Build broad spreading courtyard / canal-side Shade Tree (gnarled collar, 5 boughs, 10-lobe umbrella crown). */
export function createBroadleafTreeGeometries(): TreeGeometryPair {
  const woodParts: THREE.BufferGeometry[] = [
    makeBranchSegment([0, -0.1, 0], [0.08, 2.05, -0.04], 0.5, 0.31, 7),
    makeBranchSegment([0.08, 1.95, -0.04], [1.18, 3.55, 0.62], 0.21, 0.09, 5),
    makeBranchSegment([0.05, 1.98, -0.02], [-1.22, 3.48, 0.48], 0.21, 0.09, 5),
    makeBranchSegment([0.04, 2.02, -0.04], [0.42, 3.72, -1.18], 0.2, 0.08, 5),
    makeBranchSegment([0.02, 2.0, -0.03], [-0.88, 3.62, -0.96], 0.19, 0.08, 5),
    makeBranchSegment([0.06, 2.05, -0.02], [0.02, 4.15, 0.16], 0.2, 0.09, 5),
  ];
  const mergedWood = mergeGeometries(
    woodParts.map((w) => finalizeNonIndexedWoodPart(w, [0.5, 0.42, 0.36], [0.85, 0.75, 0.66], -0.1, 4.2)),
    false,
  );

  const foliageParts: THREE.BufferGeometry[] = [
    makeSculptedFoliageLobe(0.0, 4.35, 0.0, 1.75, 1.25, 1.7, 10.2, 1),
    makeSculptedFoliageLobe(1.42, 3.75, 0.68, 1.38, 1.02, 1.28, 11.4, 1),
    makeSculptedFoliageLobe(-1.45, 3.68, 0.56, 1.35, 1.0, 1.3, 12.6, 1),
    makeSculptedFoliageLobe(0.48, 3.85, -1.35, 1.32, 1.02, 1.28, 13.8, 1),
    makeSculptedFoliageLobe(-1.02, 3.78, -1.08, 1.28, 0.98, 1.25, 14.3, 1),
    makeSculptedFoliageLobe(0.05, 3.72, 1.38, 1.26, 0.96, 1.22, 15.1, 1),
    makeSculptedFoliageLobe(0.76, 4.88, 0.35, 1.22, 1.04, 1.18, 16.5, 1),
    makeSculptedFoliageLobe(-0.82, 4.82, -0.38, 1.18, 1.02, 1.16, 17.2, 1),
    makeSculptedFoliageLobe(-0.18, 5.25, 0.18, 1.12, 0.96, 1.1, 18.4, 1),
    makeSculptedFoliageLobe(1.05, 3.12, -0.62, 1.05, 0.82, 1.02, 19.7, 1),
  ];
  const mergedFoliage = applyCrownAOShading(foliageParts, [0.44, 0.55, 0.42], [1.0, 1.0, 0.9]);
  return { trunk: mergedWood, foliage: mergedFoliage };
}

/** Build gnarled multi-stemmed desert Saxaul / Haloxylon scrub tree for the arid buffer. */
export function createSaxaulTreeGeometries(): TreeGeometryPair {
  const woodParts: THREE.BufferGeometry[] = [
    makeBranchSegment([0, -0.08, 0], [0.72, 1.45, 0.44], 0.28, 0.14, 5),
    makeBranchSegment([0.72, 1.4, 0.44], [1.35, 2.55, 0.72], 0.14, 0.06, 5),
    makeBranchSegment([0, -0.08, 0], [-0.68, 1.55, 0.35], 0.26, 0.13, 5),
    makeBranchSegment([-0.68, 1.5, 0.35], [-1.22, 2.75, -0.25], 0.13, 0.06, 5),
    makeBranchSegment([0, -0.08, 0], [0.12, 1.65, -0.78], 0.25, 0.12, 5),
    makeBranchSegment([0.12, 1.6, -0.78], [-0.28, 2.85, -1.25], 0.12, 0.05, 5),
  ];
  const mergedWood = mergeGeometries(
    woodParts.map((w) => finalizeNonIndexedWoodPart(w, [0.56, 0.48, 0.4], [0.88, 0.8, 0.7], -0.08, 2.85)),
    false,
  );

  const foliageParts: THREE.BufferGeometry[] = [
    makeSculptedFoliageLobe(1.32, 2.58, 0.74, 1.05, 0.78, 0.96, 21.1, 1),
    makeSculptedFoliageLobe(0.62, 1.95, 0.42, 0.88, 0.68, 0.84, 22.4, 1),
    makeSculptedFoliageLobe(-1.24, 2.78, -0.22, 1.02, 0.76, 0.98, 23.7, 1),
    makeSculptedFoliageLobe(-0.58, 2.1, 0.38, 0.85, 0.66, 0.82, 24.5, 1),
    makeSculptedFoliageLobe(-0.26, 2.92, -1.24, 0.98, 0.75, 0.94, 25.8, 1),
    makeSculptedFoliageLobe(0.18, 2.35, -0.68, 0.84, 0.64, 0.8, 26.2, 1),
    makeSculptedFoliageLobe(0.05, 3.05, -0.08, 0.92, 0.74, 0.88, 27.6, 1),
  ];
  const mergedFoliage = applyCrownAOShading(foliageParts, [0.5, 0.56, 0.42], [0.98, 1.0, 0.84]);
  return { trunk: mergedWood, foliage: mergedFoliage };
}

/** Build compact windbreak shrub-tree for P区 saline-alkali southern belt. */
export function createShelterShrubTreeGeometries(): TreeGeometryPair {
  const woodParts: THREE.BufferGeometry[] = [
    makeBranchSegment([0, -0.08, 0], [0.04, 1.55, 0.02], 0.34, 0.2, 6),
    makeBranchSegment([0.04, 1.48, 0.02], [0.68, 2.85, 0.42], 0.15, 0.07, 5),
    makeBranchSegment([0.03, 1.5, 0.01], [-0.72, 2.78, 0.28], 0.15, 0.07, 5),
    makeBranchSegment([0.02, 1.52, 0], [0.18, 2.95, -0.68], 0.14, 0.06, 5),
    makeBranchSegment([0.02, 1.55, 0], [-0.32, 3.2, -0.28], 0.14, 0.06, 5),
  ];
  const mergedWood = mergeGeometries(
    woodParts.map((w) => finalizeNonIndexedWoodPart(w, [0.54, 0.45, 0.38], [0.88, 0.78, 0.68], -0.08, 3.2)),
    false,
  );

  const foliageParts: THREE.BufferGeometry[] = [
    makeSculptedFoliageLobe(0.0, 3.15, 0.0, 1.32, 1.08, 1.28, 31.1, 1),
    makeSculptedFoliageLobe(0.78, 2.75, 0.48, 0.96, 0.82, 0.94, 32.3, 1),
    makeSculptedFoliageLobe(-0.82, 2.72, 0.32, 0.95, 0.8, 0.92, 33.7, 1),
    makeSculptedFoliageLobe(0.22, 2.88, -0.78, 0.94, 0.82, 0.92, 34.4, 1),
    makeSculptedFoliageLobe(-0.35, 3.55, -0.18, 0.92, 0.88, 0.9, 35.9, 1),
    makeSculptedFoliageLobe(0.18, 3.85, 0.22, 0.78, 0.78, 0.78, 36.6, 1),
  ];
  const mergedFoliage = applyCrownAOShading(foliageParts, [0.46, 0.56, 0.43], [0.98, 1.0, 0.88]);
  return { trunk: mergedWood, foliage: mergedFoliage };
}
