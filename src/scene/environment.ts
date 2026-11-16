import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGrasslandTexture, SharedMaterials, tagStepInteractive } from './materials';
import {
  createBroadleafTreeGeometries,
  createPoplarTreeGeometries,
  createSaxaulTreeGeometries,
  loadBlenderTreeAssets,
  TreeGeometryPair,
} from './vegetation';

export type LightingMode = 'morning' | 'daylight' | 'golden';

export interface EnvironmentRig {
  setLighting: (mode: LightingMode) => void;
  update: (elapsed: number) => void;
}

const LIGHTING_PRESETS: Record<
  LightingMode,
  {
    skyTop: number;
    skyBottom: number;
    fogColor: number;
    sunColor: number;
    sunIntensity: number;
    sunPos: [number, number, number];
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
  }
> = {
  morning: {
    skyTop: 0x62a8e5,
    skyBottom: 0xffe4c4,
    fogColor: 0xefe6d8,
    sunColor: 0xffdfb0,
    sunIntensity: 2.25,
    sunPos: [180, 145, 130],
    hemiSky: 0xc2e2ff,
    hemiGround: 0xb8a382,
    hemiIntensity: 1.0,
  },
  daylight: {
    skyTop: 0x3b8ed6,
    skyBottom: 0xe5f0f2,
    fogColor: 0xe6ece8,
    sunColor: 0xfff8eb,
    sunIntensity: 2.55,
    sunPos: [170, 235, 160],
    hemiSky: 0xd6eeff,
    hemiGround: 0xb2a58b,
    hemiIntensity: 1.05,
  },
  golden: {
    skyTop: 0x455a94,
    skyBottom: 0xffb982,
    fogColor: 0xf4d4bd,
    sunColor: 0xffa966,
    sunIntensity: 2.4,
    sunPos: [-220, 82, 160],
    hemiSky: 0xffd5b8,
    hemiGround: 0x8c7660,
    hemiIntensity: 0.95,
  },
};

function createFlatRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number, segments = 120, uvRepeatU = 36): THREE.BufferGeometry {
  const pts = curve.getPoints(segments);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const t = i / segments;
    const tangent = curve.getTangentAt(t).normalize();
    const nx = -tangent.z;
    const nz = tangent.x;
    const hw = width * 0.5;

    positions.push(p.x - nx * hw, p.y, p.z - nz * hw);
    positions.push(p.x + nx * hw, p.y, p.z + nz * hw);
    uvs.push(t * uvRepeatU, 0, t * uvRepeatU, 1);

    if (i < pts.length - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createEnvironment(scene: THREE.Scene, mats: SharedMaterials): EnvironmentRig {
  const skyGeo = new THREE.SphereGeometry(1450, 32, 20);
  const skyUniforms = {
    topColor: { value: new THREE.Color(LIGHTING_PRESETS.daylight.skyTop) },
    bottomColor: { value: new THREE.Color(LIGHTING_PRESETS.daylight.skyBottom) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = pow(max(h, 0.0), 0.55);
        float horizonGlow = pow(1.0 - clamp(abs(h) * 4.2, 0.0, 1.0), 2.6);
        vec3 col = mix(bottomColor, topColor, t);
        col = mix(col, bottomColor * 1.05, horizonGlow * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const fog = new THREE.FogExp2(LIGHTING_PRESETS.daylight.fogColor, 0.00066);
  scene.fog = fog;

  const hemiLight = new THREE.HemisphereLight(0xd6eeff, 0xb2a58b, 1.05);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff8eb, 2.55);
  sunLight.position.set(170, 235, 160);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 25;
  sunLight.shadow.camera.far = 1020;
  sunLight.shadow.camera.left = -310;
  sunLight.shadow.camera.right = 435;
  sunLight.shadow.camera.top = 240;
  sunLight.shadow.camera.bottom = -240;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xbbe1ff, 0.45);
  fillLight.position.set(-200, 95, -160);
  scene.add(fillLight);

  // Outer Bukhara arid desert steppe surrounding the organic green oasis valley
  const outerDesert = new THREE.Mesh(new THREE.CircleGeometry(1300, 72), mats.sandDesert);
  outerDesert.rotation.x = -Math.PI / 2;
  outerDesert.position.y = -0.55;
  outerDesert.receiveShadow = true;
  scene.add(outerDesert);

  const hashR = (i: number, s: number) => {
    const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Sparse desert scrub & saxaul shrubs scattered across the outer steppe (1 instanced draw call)
  const scrubSpots: Array<[number, number, number]> = [];
  for (let i = 0; i < 1400 && scrubSpots.length < 420; i++) {
    const ang = hashR(i, 11) * Math.PI * 2;
    const r = 300 + Math.sqrt(hashR(i, 12)) * 720;
    const x = Math.cos(ang) * r + 64;
    const z = Math.sin(ang) * r + 8;
    if (x > -295 && x < 415 && z > -195 && z < 265) continue; // keep park & enclave clear
    if (x > 355 && x < 400) continue; // keep freight highway clear
    scrubSpots.push([x, z, 0.8 + hashR(i, 13) * 1.6]);
  }
  const scrubGeo = new THREE.IcosahedronGeometry(1, 0);
  const scrubMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const scrubInst = new THREE.InstancedMesh(scrubGeo, scrubMat, scrubSpots.length);
  const scrubTints = [new THREE.Color(0x8d9a5b), new THREE.Color(0xa59a62), new THREE.Color(0x7c8a52), new THREE.Color(0xb3a271)];
  const scrubDummy = new THREE.Object3D();
  scrubSpots.forEach(([x, z, s], i) => {
    scrubDummy.position.set(x, s * 0.25 - 0.4, z);
    scrubDummy.rotation.set(0, hashR(i, 14) * Math.PI, 0);
    scrubDummy.scale.set(s * 1.3, s * 0.6, s * 1.1);
    scrubDummy.updateMatrix();
    scrubInst.setMatrixAt(i, scrubDummy.matrix);
    scrubInst.setColorAt(i, scrubTints[i % scrubTints.length]);
  });
  scrubInst.instanceMatrix.needsUpdate = true;
  if (scrubInst.instanceColor) scrubInst.instanceColor.needsUpdate = true;
  scene.add(scrubInst);

  // Organic contoured green oasis base valley cleanly wrapping all Main Ring roads (X<=246, Z:-162..+174)
  // while leaving wide X:247..268 desert isolation barrier before I区 Enclave
  const valleyShape = new THREE.Shape();
  valleyShape.moveTo(-260, -154);
  valleyShape.bezierCurveTo(-180, -164, -60, -162, 45, -158);
  valleyShape.bezierCurveTo(145, -154, 224, -154, 244, -148);
  valleyShape.bezierCurveTo(250, -90, 250, -10, 246, 60);
  valleyShape.bezierCurveTo(245, 114, 248, 156, 244, 169);
  valleyShape.bezierCurveTo(212, 175, 148, 174, 85, 174);
  valleyShape.bezierCurveTo(-25, 173, -145, 174, -254, 169);
  valleyShape.bezierCurveTo(-268, 162, -270, 58, -264, -30);
  valleyShape.bezierCurveTo(-262, -92, -266, -138, -260, -154);

  const valleyGeo = new THREE.ExtrudeGeometry(valleyShape, { depth: 0.5, bevelEnabled: false, curveSegments: 32 });
  valleyGeo.rotateX(Math.PI / 2);
  const oasisGrassTex = createGrasslandTexture('#c4dab9', 'rgba(155, 194, 134, 0.28)', 'rgba(208, 218, 174, 0.24)', 0.055, 0.055);
  const oasisBaseMat = new THREE.MeshStandardMaterial({
    map: oasisGrassTex,
    roughness: 0.94,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const oasisValley = new THREE.Mesh(valleyGeo, oasisBaseMat);
  oasisValley.position.y = 0.0;
  oasisValley.receiveShadow = true;
  scene.add(oasisValley);

  // Separate Independent Organic Parkland Oasis for Slaughter & Cold-Chain Enclave (X: 270..374, Z: 58..162)
  const enclaveShape = new THREE.Shape();
  enclaveShape.moveTo(274, 74);
  enclaveShape.bezierCurveTo(286, 56, 356, 56, 369, 74);
  enclaveShape.bezierCurveTo(376, 94, 376, 126, 366, 146);
  enclaveShape.bezierCurveTo(352, 160, 286, 163, 276, 152);
  enclaveShape.bezierCurveTo(266, 132, 266, 92, 274, 74);
  const enclaveGeo = new THREE.ExtrudeGeometry(enclaveShape, { depth: 0.5, bevelEnabled: false, curveSegments: 28 });
  enclaveGeo.rotateX(Math.PI / 2);
  const enclaveParkBase = new THREE.Mesh(
    enclaveGeo,
    new THREE.MeshStandardMaterial({
      map: oasisGrassTex,
      color: 0xf4faef,
      roughness: 0.94,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  enclaveParkBase.position.y = 0.0;
  enclaveParkBase.receiveShadow = true;
  scene.add(enclaveParkBase);

  // Soft greener pasture meadows & landscaped parkland lawns inside both Main Oasis and I区 Enclave
  const meadowTex = createGrasslandTexture('#9bc487', 'rgba(126, 178, 108, 0.3)', 'rgba(176, 206, 142, 0.25)', 6, 6);
  const meadowMat = new THREE.MeshStandardMaterial({ map: meadowTex, roughness: 0.94 });
  const pasturePockets: Array<[number, number, number, number]> = [
    [-190, -90, 68, 56], // A/N civic parkland
    [-194, -8, 44, 34], // Restored A/N lakeside ecological greenbelt (north of Eco Canal)
    [-6, -108, 148, 44], // B-E breeding & grazing belt
    [66, -24, 56, 36], // F fattening pastures
    [188, 114, 39, 44], // SE Q区 germplasm & reserve landscaped lawn base
    [309, 102, 11, 24], // I区 central shade orchard lawn (between pens & plant)
    [325, 73, 24, 9], // I区 north ecological garden strip
    [354, 86, 12, 8], // I区 NE avenue lawn
    [354, 126, 12, 8], // I区 SE avenue lawn
  ];
  for (let idx = 0; idx < pasturePockets.length; idx++) {
    const [mx, mz, rx, rz] = pasturePockets[idx];
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rx, rx * 1.03, 0.08, 36), meadowMat);
    disc.scale.set(1, 1, rz / rx);
    disc.position.set(mx, 0.015 + idx * 0.002, mz);
    disc.receiveShadow = true;
    scene.add(disc);
  }

  // Meandering Ecological Irrigation Canal & Retention Wetlands (routes smoothly around West Lake south bay and terminates at East Oasis Rim X=228)
  const canalCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-262, 0.14, 38),
    new THREE.Vector3(-220, 0.14, 42),
    new THREE.Vector3(-188, 0.14, 43),
    new THREE.Vector3(-148, 0.14, 38),
    new THREE.Vector3(-105, 0.14, 32),
    new THREE.Vector3(-25, 0.14, 36),
    new THREE.Vector3(34, 0.14, 42),
    new THREE.Vector3(106, 0.14, 48),
    new THREE.Vector3(180, 0.14, 56),
    new THREE.Vector3(228, 0.14, 58),
  ]);
  const bankTex = createGrasslandTexture('#869c82', 'rgba(104, 128, 96, 0.3)', 'rgba(176, 178, 152, 0.26)', 1, 1);
  const bankMat = new THREE.MeshStandardMaterial({ map: bankTex, roughness: 0.92 });
  const bankMesh = new THREE.Mesh(createFlatRibbonGeometry(canalCurve, 10.5, 160, 40), bankMat);
  bankMesh.position.y = 0.0;
  bankMesh.receiveShadow = true;

  const canalWater = new THREE.Mesh(createFlatRibbonGeometry(canalCurve, 7.2, 160, 28), mats.waterPool);
  canalWater.position.y = 0.025;
  canalWater.receiveShadow = true;
  scene.add(bankMesh, canalWater);

  // Central Bio-Wetland Lake (30, 42) sits cleanly 3.5cm above canalWater so the canal ribbon never cuts/Z-fights inside it
  const lakeWaterMat = mats.waterPool.clone();
  lakeWaterMat.polygonOffset = true;
  lakeWaterMat.polygonOffsetFactor = -2;
  lakeWaterMat.polygonOffsetUnits = -2;

  for (const [lx, lz, r, sz] of [[30, 42, 22, 0.52]] as const) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.8, r + 2.2, 0.12, 32), bankMat);
    rim.scale.set(1, 1, sz);
    rim.position.set(lx, 0.09, lz);
    const lakeWaterGeo = new THREE.CylinderGeometry(r, r, 0.14, 36);
    const luv = lakeWaterGeo.attributes.uv;
    for (let i = 0; i < luv.count; i++) {
      luv.setXY(i, luv.getX(i) * 3.0, luv.getY(i) * 1.8);
    }
    luv.needsUpdate = true;
    const water = new THREE.Mesh(lakeWaterGeo, lakeWaterMat);
    water.scale.set(1, 1, sz);
    water.position.set(lx, 0.13, lz);
    water.receiveShadow = true;
    scene.add(rim, water);
  }

  // Sculpted West Eco-Lake & Wetlands Parkland (bounded cleanly by West Blvd X=-244, Clean Feed Road Z=-56, H Zone, and Eco Canal)
  const fountainSprays: THREE.Object3D[] = [];
  const lakeGroup = new THREE.Group();
  lakeGroup.position.set(-194, 0.04, -4);
  scene.add(lakeGroup);

  const lakeLoader = new GLTFLoader();
  lakeLoader.load(
    './models/west_lake_park.glb',
    (gltf) => {
      const lakeScene = gltf.scene;
      lakeScene.traverse((child) => {
        if (child.name === 'WL_FountainSpray_N' || child.name === 'WL_FountainSpray_S') {
          fountainSprays.push(child);
        }
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const matsList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        let isTranslucent = false;
        for (const m of matsList) {
          if (!m) continue;
          const matName = m.name || '';
          const stdMat = m as THREE.MeshStandardMaterial;
          if (matName.includes('WL_Water')) {
            stdMat.normalMap = mats.waterPool.normalMap;
            stdMat.normalScale = new THREE.Vector2(0.14, 0.14);
            stdMat.roughness = 0.22;
            stdMat.metalness = 0.12;
            stdMat.envMapIntensity = 1.1;
          }
          if (
            matName.includes('WL_Water') ||
            matName.includes('WL_Glass') ||
            matName.includes('WL_SprayMist') ||
            (typeof stdMat.opacity === 'number' && stdMat.opacity < 0.99)
          ) {
            stdMat.transparent = true;
            stdMat.depthWrite = false;
            isTranslucent = true;
          }
        }
        if (isTranslucent) {
          mesh.castShadow = false;
          mesh.receiveShadow = true;
        } else {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      lakeGroup.add(lakeScene);
      tagStepInteractive(lakeGroup, 'science');
    },
    undefined,
    (err) => console.warn('[WestLake] GLB load warning:', err),
  );

  // Floating clouds pushed softly outward & higher so top-down zoom never obscures zones
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    flatShading: false,
    depthWrite: false,
  });
  for (const [cx, cy, cz, sc] of [
    [-320, 158, -225, 2.2],
    [15, 168, -265, 2.4],
    [315, 156, -205, 2.0],
    [-325, 152, 205, 2.1],
    [305, 164, 240, 2.2],
    [-520, 175, -20, 2.6],
    [600, 170, 30, 2.5],
    [120, 185, -420, 2.8],
  ]) {
    const cg = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const r = 6.2 - Math.abs(k - 3) * 0.9;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), cloudMat);
      puff.position.set((k - 3) * 3.8, Math.max(0, 2.2 - Math.abs(k - 3) * 0.8), Math.sin(k * 1.7) * 2.4);
      puff.scale.set(1.4, 0.62, 1.05);
      cg.add(puff);
    }
    cg.position.set(cx, cy, cz);
    cg.scale.setScalar(sc);
    cloudGroup.add(cg);
  }
  scene.add(cloudGroup);

  // Windbreak Shelterbelts & Inter-Cluster Biosecurity Forest Barriers (Poplars, Shade Broadleaves & Desert Saxaul)
  type TreeSpecies = 'poplar' | 'broadleaf' | 'saxaul';
  interface TreePlacement {
    x: number;
    z: number;
    scale: number;
    species: TreeSpecies;
    seed: number;
    y?: number;
  }

  const treePlacements: TreePlacement[] = [];
  const addForestRow = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    step: number,
    jitter = 1.8,
    species: TreeSpecies | 'mixed' = 'poplar',
  ) => {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.floor(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = THREE.MathUtils.lerp(x0, x1, t) + Math.sin(i * 2.3) * jitter;
      const z = THREE.MathUtils.lerp(z0, z1, t) + Math.cos(i * 1.7) * jitter;
      const sc = 0.92 + ((i * 7) % 5) * 0.11;
      const chosen: TreeSpecies = species === 'mixed' ? (i % 3 === 0 ? 'broadleaf' : 'poplar') : species;
      treePlacements.push({ x, z, scale: sc, species: chosen, seed: i + Math.round(x * 3 + z * 5) });
    }
  };

  // Outer North & West shelterbelts
  addForestRow(-250, -148, 240, -140, 13, 2.0, 'poplar');
  addForestRow(-258, -140, -258, -116, 12, 1.4, 'poplar');
  addForestRow(-258, -92, -258, 152, 13, 1.8, 'poplar');

  // Biosecurity belt isolating H区 Quarantine (-122, -22) from Breeding B/C (-86..-26) and Civic A/N (-164)
  addForestRow(-124, -136, -124, -64, 11, 1.0, 'mixed');
  addForestRow(-97, -46, -94, -2, 9, 1.2, 'poplar');
  addForestRow(-148, -46, -146, -2, 10, 1.2, 'mixed');

  // Inter-cluster green corridors between B, C, D, E breeding sub-groups
  addForestRow(-56, -136, -56, -72, 10, 1.0, 'mixed');
  addForestRow(4, -136, 4, -72, 10, 1.0, 'mixed');
  addForestRow(66, -132, 66, -68, 10, 1.0, 'mixed');

  // MAJOR Multi-Row Biosecurity Forest Wall (X: 118..142) dividing Living Sheep from East Energy/Manure/Water/Slaughter!
  // Leaves clear crossing openings at Z = +6..+12 (Dirty Road) and stops north of Eco Blvd (Z<=44) clear of P区
  for (const fx of [120, 129, 138]) {
    const wallSpecies: TreeSpecies | 'mixed' = fx === 120 ? 'mixed' : 'poplar';
    addForestRow(fx, -138, fx, -48, 10, 1.6, wallSpecies);
    addForestRow(fx, -44, fx, 0, 9, 1.4, wallSpecies);
    addForestRow(fx, 18, fx, 44, 10, 1.4, wallSpecies);
  }

  // West Eco-Lake perimeter shoreline groves, north pavilion flank & Eco-Island broadleaf specimen trees
  addForestRow(-235, -34, -235, 28, 14, 1.2, 'mixed');
  addForestRow(-152, -32, -152, 22, 14, 1.0, 'broadleaf');
  addForestRow(-230, 52.5, -158, 52.5, 13, 1.1, 'broadleaf');
  const lakesideSpecimenTrees: Array<{ x: number; z: number; scale: number; species: TreeSpecies; y?: number }> = [
    { x: -226, z: -46, scale: 1.04, species: 'broadleaf' },
    { x: -214, z: -47, scale: 0.96, species: 'poplar' },
    { x: -174, z: -47, scale: 0.98, species: 'poplar' },
    { x: -162, z: -45, scale: 1.05, species: 'broadleaf' },
    { x: -191.5, z: -2.5, scale: 1.06, species: 'broadleaf', y: 0.62 },
    { x: -189.2, z: 0.2, scale: 0.88, species: 'broadleaf', y: 0.62 },
  ];
  lakesideSpecimenTrees.forEach((lt, idx) => {
    treePlacements.push({ ...lt, seed: 420 + idx });
  });

  // SE Oasis Boundary Windbreak framing Q区 outside perimeter (clear of Q区 pad X:156..220, Z:85..143)
  addForestRow(226, 74, 226, 152, 9.5, 1.2, 'mixed');
  addForestRow(238, -124, 238, 48, 11, 1.4, 'poplar');
  addForestRow(238, 66, 238, 152, 11, 1.4, 'poplar');
  addForestRow(158, 150, 220, 150, 11.5, 1.2, 'broadleaf');

  // Desert gnarled Saxaul/Haloxylon pockets across the ~90m isolation buffer (X: 247..264)
  addForestRow(250, -36, 258, 34, 15, 2.8, 'saxaul');
  addForestRow(248, 72, 260, 134, 15, 2.6, 'saxaul');

  // Natural curved shelterbelts wrapping NW / West / North / South rim of I区 Enclave (leaving South & East vehicle gates open)
  addForestRow(275, 76, 286, 66, 9.5, 1.3, 'mixed');
  addForestRow(275, 82, 275, 128, 10.5, 1.4, 'mixed');
  addForestRow(290, 65, 356, 65, 12, 1.5, 'broadleaf');
  addForestRow(316, 142, 358, 138, 11.5, 1.4, 'broadleaf');

  // Rich interior courtyard shade trees INSIDE I区 between pens, processing hall, cold store & roundabout
  const internalEnclaveTrees: Array<[number, number, number]> = [
    [308.5, 77, 1.05],
    [310.8, 84, 1.15],
    [308.8, 98, 1.1],
    [311.2, 104, 1.25],
    [308.5, 112, 1.05],
    [310.6, 119, 1.15],
    [306.5, 126, 0.95],
    [315.5, 104, 0.95],
    [336.5, 104, 0.92],
    [314, 72, 1.1],
    [325, 73, 1.18],
    [336, 72, 1.08],
    [346, 76, 1.12],
    [354, 104, 1.02],
    [355, 86, 1.12],
    [362, 89, 1.0],
    [355, 125, 1.08],
    [362, 122, 0.98],
  ];
  for (let idx = 0; idx < internalEnclaveTrees.length; idx++) {
    const [ix, iz, isc] = internalEnclaveTrees[idx];
    treePlacements.push({ x: ix, z: iz, scale: isc, species: 'broadleaf', seed: 500 + idx });
  }

  // Eastern Freight Highway Boulevard Roadside Windbreak Trees
  addForestRow(389, -180, 389, 200, 26, 1.2, 'poplar');

  // Canal-side willow/broadleaf trees in Central Buffer
  addForestRow(-130, 26, -30, 30, 14, 1.5, 'broadleaf');
  addForestRow(22, 26, 112, 34, 13, 1.5, 'broadleaf');

  const treeBarkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
    vertexColors: true,
  });
  const treeCanopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.02,
    vertexColors: true,
    flatShading: true,
  });

  const speciesGeos: Record<TreeSpecies, TreeGeometryPair> = {
    poplar: createPoplarTreeGeometries(),
    broadleaf: createBroadleafTreeGeometries(),
    saxaul: createSaxaulTreeGeometries(),
  };

  const tDummy = new THREE.Object3D();
  const tColor = new THREE.Color();

  const instancedSpeciesGroups: Array<{
    species: TreeSpecies;
    group: TreePlacement[];
    trunkInst: THREE.InstancedMesh;
    canopyInst: THREE.InstancedMesh;
  }> = [];

  for (const species of ['poplar', 'broadleaf', 'saxaul'] as TreeSpecies[]) {
    const group = treePlacements.filter((p) => p.species === species);
    if (group.length === 0) continue;
    const geos = speciesGeos[species];

    const trunkInst = new THREE.InstancedMesh(geos.trunk, treeBarkMat, group.length);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    const canopyInst = new THREE.InstancedMesh(geos.foliage, treeCanopyMat, group.length);
    canopyInst.castShadow = true;
    canopyInst.receiveShadow = true;

    for (let i = 0; i < group.length; i++) {
      const p = group[i];
      // Seat desert saxaul buffer, central Eco-Island mound & outer East highway trees cleanly
      let baseY = p.y ?? 0;
      if (species === 'saxaul' || p.x > 376) baseY = -0.55;
      else if (Math.hypot(p.x - 354, p.z - 104) < 2.2) baseY = 0.28; // Roundabout island curb

      tDummy.position.set(p.x, baseY, p.z);
      tDummy.rotation.set(0, ((p.seed * 1.93) % (Math.PI * 2)), 0);
      tDummy.scale.set(p.scale, p.scale * (0.94 + (i % 3) * 0.06), p.scale);
      tDummy.updateMatrix();

      trunkInst.setMatrixAt(i, tDummy.matrix);
      canopyInst.setMatrixAt(i, tDummy.matrix);

      tColor.setHex(species === 'saxaul' ? 0x8e7258 : i % 2 === 0 ? 0x815c42 : 0x714f38);
      trunkInst.setColorAt(i, tColor);

      if (species === 'saxaul') {
        tColor.setHex(i % 2 === 0 ? 0x5c915b : 0x6c9c5e);
      } else if (species === 'broadleaf') {
        tColor.setHex(i % 3 === 0 ? 0x4aa865 : i % 3 === 1 ? 0x3d9458 : 0x5db96c);
      } else {
        tColor.setHex(i % 2 === 0 ? 0x4ca66b : 0x3d8f59);
      }
      canopyInst.setColorAt(i, tColor);
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (trunkInst.instanceColor) trunkInst.instanceColor.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    scene.add(trunkInst, canopyInst);
    instancedSpeciesGroups.push({ species, group, trunkInst, canopyInst });
  }

  // Upgrade instanced campus forest belts to Blender textured botanical trees once loaded
  loadBlenderTreeAssets()
    .then((assets) => {
      for (const entry of instancedSpeciesGroups) {
        const asset = assets[entry.species];
        entry.trunkInst.geometry.dispose();
        entry.trunkInst.geometry = asset.woodGeometry;
        entry.trunkInst.material = asset.woodMaterial;

        entry.canopyInst.geometry.dispose();
        entry.canopyInst.geometry = asset.foliageGeometry;
        entry.canopyInst.material = asset.foliageMaterial;
        entry.canopyInst.customDepthMaterial = asset.foliageDepthMaterial;

        // Apply bright natural tonal variations preserving baked Blender leaf & bark textures
        for (let i = 0; i < entry.group.length; i++) {
          if (entry.species === 'saxaul') {
            tColor.setHex(i % 2 === 0 ? 0xf6eadc : 0xe4d5c3);
          } else {
            tColor.setHex(i % 2 === 0 ? 0xf2e4d5 : 0xe0cfbc);
          }
          entry.trunkInst.setColorAt(i, tColor);

          if (entry.species === 'saxaul') {
            tColor.setHex(i % 2 === 0 ? 0xf8f6dd : 0xe4efd2);
          } else if (entry.species === 'broadleaf') {
            tColor.setHex(i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xeafadc : 0xf4f7d4);
          } else {
            tColor.setHex(i % 2 === 0 ? 0xffffff : 0xedf9de);
          }
          entry.canopyInst.setColorAt(i, tColor);
        }
        if (entry.trunkInst.instanceColor) entry.trunkInst.instanceColor.needsUpdate = true;
        if (entry.canopyInst.instanceColor) entry.canopyInst.instanceColor.needsUpdate = true;
      }
    })
    .catch((err) => console.error('Failed to upgrade Blender forest trees:', err));

  // Far-North Ridge Wind Turbines (5 green-energy wind turbines)
  const turbineRotors: THREE.Group[] = [];
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.15 });
  for (const [wx, wz] of [
    [-200, -182],
    [-105, -190],
    [-5, -188],
    [95, -185],
    [190, -180],
  ]) {
    const turbine = new THREE.Group();
    turbine.position.set(wx, 0, wz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 30, 12), towerMat);
    pole.position.y = 15;
    pole.castShadow = true;
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 3.8), towerMat);
    nacelle.position.set(0, 30.2, 0.5);

    const rotor = new THREE.Group();
    rotor.position.set(0, 30.2, 2.5);
    for (let b = 0; b < 3; b++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (b * Math.PI * 2) / 3;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 12.5, 0.18), towerMat);
      blade.position.y = 6.2;
      bladePivot.add(blade);
      rotor.add(bladePivot);
    }
    turbine.add(pole, nacelle, rotor);
    turbineRotors.push(rotor);
    scene.add(turbine);
  }

  // Instanced Eco-Solar Streetlights & Roadside Shrubs along Main Boulevards (only 4 Draw Calls total)
  const lightPosts: Array<{ x: number; z: number; yaw: number }> = [];
  const shrubSpots: Array<{ x: number; z: number; scale: number; tint: number }> = [];

  const isNearJunctionOrBridge = (x: number, z: number): boolean => {
    if (z > 28 && z < 68 && (Math.abs(x + 244) < 12 || Math.abs(x - 147) < 12 || Math.abs(x - 232) < 12)) {
      return true;
    }
    if (Math.abs(z + 142) < 9 || Math.abs(z + 56) < 9 || Math.abs(z - 8) < 9 || Math.abs(z - 64) < 9 || Math.abs(z - 160) < 9) {
      return Math.abs(x + 244) < 9 || Math.abs(x + 182) < 9 || Math.abs(x - 147) < 9 || Math.abs(x - 232) < 9;
    }
    return false;
  };

  // N-S boulevards (offset ±3.8m outside road edge, lamp arm facing inward toward road)
  for (let z = -126; z <= 144; z += 34) {
    if (!isNearJunctionOrBridge(-244, z)) {
      lightPosts.push({ x: -247.9, z, yaw: Math.PI / 2 });
      shrubSpots.push({ x: -248.4, z: z + 7, scale: 0.85, tint: 0 }, { x: -248.2, z: z - 8, scale: 0.72, tint: 1 });
    }
    if (!isNearJunctionOrBridge(232, z)) {
      lightPosts.push({ x: 235.9, z, yaw: -Math.PI / 2 });
      shrubSpots.push({ x: 236.4, z: z + 8, scale: 0.8, tint: 2 });
    }
  }
  for (let z = -132; z <= -68; z += 30) {
    lightPosts.push({ x: -185.7, z, yaw: Math.PI / 2 });
    shrubSpots.push({ x: -186.1, z: z + 6, scale: 0.78, tint: 1 });
  }
  // E-W boulevards (North Link z=-142, South Eco Blvd z=64, South Link z=160)
  for (let x = -222; x <= 212; x += 38) {
    if (!isNearJunctionOrBridge(x, -142)) {
      lightPosts.push({ x, z: -145.9, yaw: 0 });
      shrubSpots.push({ x: x + 9, z: -146.3, scale: 0.82, tint: 0 });
    }
    if (!isNearJunctionOrBridge(x, 64)) {
      lightPosts.push({ x, z: 67.9, yaw: Math.PI });
      shrubSpots.push({ x: x - 8, z: 68.3, scale: 0.88, tint: 2 });
    }
    if (!isNearJunctionOrBridge(x, 160)) {
      lightPosts.push({ x, z: 163.9, yaw: Math.PI });
      shrubSpots.push({ x: x + 10, z: 164.4, scale: 0.75, tint: 1 });
    }
  }

  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.22,
    roughness: 0.35,
  });

  if (lightPosts.length > 0) {
    const basePost = new THREE.CylinderGeometry(0.08, 0.12, 4.8, 7);
    basePost.translate(0, 2.4, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.05);
    arm.translate(0, 4.72, 0.45);
    const poleGeo = mergeGeometries([basePost, arm]);

    const headGeo = new THREE.BoxGeometry(0.28, 0.09, 0.52);
    headGeo.translate(0, 4.66, 0.92);

    const solarGeo = new THREE.BoxGeometry(0.42, 0.04, 0.56);
    solarGeo.rotateX(0.25);
    solarGeo.translate(0, 4.92, 0.05);

    const poleInst = new THREE.InstancedMesh(poleGeo, mats.steelFrame, lightPosts.length);
    const headInst = new THREE.InstancedMesh(headGeo, lampHeadMat, lightPosts.length);
    const solarInst = new THREE.InstancedMesh(solarGeo, mats.solarPanel, lightPosts.length);
    poleInst.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < lightPosts.length; i++) {
      const lp = lightPosts[i];
      dummy.position.set(lp.x, 0, lp.z);
      dummy.rotation.set(0, lp.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(i, dummy.matrix);
      headInst.setMatrixAt(i, dummy.matrix);
      solarInst.setMatrixAt(i, dummy.matrix);
    }
    poleInst.instanceMatrix.needsUpdate = true;
    headInst.instanceMatrix.needsUpdate = true;
    solarInst.instanceMatrix.needsUpdate = true;
    scene.add(poleInst, headInst, solarInst);
  }

  if (shrubSpots.length > 0) {
    const shrubGeo = new THREE.IcosahedronGeometry(0.68, 1);
    const shrubMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 });
    const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubSpots.length);
    shrubInst.castShadow = true;
    shrubInst.receiveShadow = true;
    const shrubTints = [new THREE.Color(0x5d8f49), new THREE.Color(0x6da156), new THREE.Color(0x7ca663)];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < shrubSpots.length; i++) {
      const s = shrubSpots[i];
      dummy.position.set(s.x, 0.34 * s.scale, s.z);
      dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
      dummy.scale.set(s.scale * 1.25, s.scale * 0.72, s.scale * 1.15);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(i, dummy.matrix);
      shrubInst.setColorAt(i, shrubTints[s.tint % shrubTints.length]);
    }
    shrubInst.instanceMatrix.needsUpdate = true;
    if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
    scene.add(shrubInst);
  }

  return {
    setLighting(mode: LightingMode) {
      const p = LIGHTING_PRESETS[mode];
      skyUniforms.topColor.value.setHex(p.skyTop);
      skyUniforms.bottomColor.value.setHex(p.skyBottom);
      fog.color.setHex(p.fogColor);
      fog.density = mode === 'daylight' ? 0.00066 : 0.00084;
      lampHeadMat.emissiveIntensity = mode === 'daylight' ? 0.22 : 2.15;
      sunLight.color.setHex(p.sunColor);
      sunLight.intensity = p.sunIntensity;
      sunLight.position.set(...p.sunPos);
      hemiLight.color.setHex(p.hemiSky);
      hemiLight.groundColor.setHex(p.hemiGround);
      hemiLight.intensity = p.hemiIntensity;
    },
    update(elapsed: number) {
      cloudGroup.children.forEach((c, idx) => {
        c.position.x += Math.sin(elapsed * 0.04 + idx) * 0.012;
      });
      turbineRotors.forEach((r, idx) => {
        r.rotation.z = -elapsed * 0.85 - idx * 0.7;
      });
      fountainSprays.forEach((spray, idx) => {
        const pulse = 0.88 + Math.sin(elapsed * 4.5 + idx * 2.1) * 0.14;
        spray.scale.set(
          1 + Math.cos(elapsed * 3.8 + idx) * 0.05,
          pulse,
          1 + Math.sin(elapsed * 3.8 + idx) * 0.05,
        );
        spray.rotation.y = elapsed * (idx % 2 === 0 ? 0.85 : -0.85);
      });
      if (mats.waterPool.map) {
        mats.waterPool.map.offset.x = -(elapsed * 0.02) % 1;
      }
      if (mats.waterPool.normalMap) {
        mats.waterPool.normalMap.offset.set(-(elapsed * 0.025) % 1, Math.sin(elapsed * 0.25) * 0.008);
      }
    },
  };
}
