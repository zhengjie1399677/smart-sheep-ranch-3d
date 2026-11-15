import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSoilTexture, SharedMaterials, tagStepInteractive } from '../materials';
import {
  createAlfalfaBushGeometry,
  createAnimatedGrassMaterial,
  createShelterShrubTreeGeometries,
  createSilageForageClumpGeometry,
  loadBlenderTreeAssets,
} from '../vegetation';

export interface SalineForageController {
  setRemediationProgress: (t: number) => void;
  update: (elapsed: number) => void;
}

function configureOpqMesh(node: THREE.Object3D): void {
  if (!(node instanceof THREE.Mesh)) return;
  const rawMats = Array.isArray(node.material) ? node.material : [node.material];
  let hasGlass = false;

  for (const rawMat of rawMats) {
    if (!rawMat) continue;
    const mat = rawMat as THREE.MeshStandardMaterial;
    const isGlass =
      mat.transparent || mat.opacity < 0.99 || mat.name.toLowerCase().includes('glass');
    if (isGlass) {
      hasGlass = true;
      mat.transparent = true;
      mat.depthWrite = false;
    }
  }

  node.castShadow = !hasGlass;
  node.receiveShadow = true;
}

function mountOpqTemplate(
  parent: THREE.Group,
  sceneRoot: THREE.Object3D,
  templateName: string,
): THREE.Object3D | null {
  const tpl = sceneRoot.getObjectByName(templateName);
  if (!tpl) return null;

  const placeholders = parent.children.filter((c) => c.userData.__opqPlaceholder);
  for (const p of placeholders) {
    parent.remove(p);
  }

  const instance = tpl.clone();
  instance.position.set(0, 0, 0);
  instance.rotation.set(0, 0, 0);
  instance.scale.set(1, 1, 1);
  parent.add(instance);
  return instance;
}

export function createSalineAndForageZone(
  scene: THREE.Scene,
  mats: SharedMaterials,
): SalineForageController {
  const soilTex = createSoilTexture();

  const salinePlotMat = new THREE.MeshStandardMaterial({
    map: soilTex,
    color: 0xd8d1bd,
    roughness: 0.96,
  });
  const salineRawMat = new THREE.MeshStandardMaterial({
    map: soilTex,
    color: 0xe3dcc8,
    roughness: 0.97,
  });
  const salineMidMat = new THREE.MeshStandardMaterial({
    map: soilTex,
    color: 0xafa98d,
    roughness: 0.95,
  });
  const forageSoilMat = new THREE.MeshStandardMaterial({
    map: soilTex,
    color: 0x6f7f56,
    roughness: 0.94,
  });
  const saltPatchMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1e6,
    roughness: 0.98,
    transparent: true,
    opacity: 0.85,
  });

  // ==============================
  // 1. P区 · 盐碱地三段梯度治理与林草复合生态屏障 (South Oasis Central: center X=70, Z=114)
  // ==============================
  const ecoGroup = new THREE.Group();
  const ecoPlot = new THREE.Group();
  ecoPlot.position.set(70, 0, 114);

  // Organic contoured remediation basin spanning X: 3..137, Z: 77..151 (clear of X=-4 & X=147 roads)
  const ecoShape = new THREE.Shape();
  ecoShape.moveTo(-64, -34);
  ecoShape.bezierCurveTo(-22, -39, 24, -38, 64, -32);
  ecoShape.bezierCurveTo(70, -10, 68, 18, 60, 35);
  ecoShape.bezierCurveTo(18, 39, -30, 38, -66, 31);
  ecoShape.bezierCurveTo(-70, 8, -68, -20, -64, -34);

  const pSoilGeo = new THREE.ExtrudeGeometry(ecoShape, { depth: 0.24, bevelEnabled: false, curveSegments: 24 });
  pSoilGeo.rotateX(Math.PI / 2);
  const pSoil = new THREE.Mesh(pSoilGeo, salinePlotMat);
  pSoil.position.y = 0.22;
  pSoil.receiveShadow = true;
  ecoPlot.add(pSoil);

  // Three gradient remediation zones: West Raw Control / Mid Leached & Organic Amendment / East Mature Halophyte Strip
  const rawZoneMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 0.06, 56), salineRawMat);
  rawZoneMesh.position.set(-43, 0.23, 2);
  rawZoneMesh.receiveShadow = true;

  const midZoneMesh = new THREE.Mesh(new THREE.BoxGeometry(38, 0.06, 54), salineMidMat);
  midZoneMesh.position.set(0, 0.232, 3);
  midZoneMesh.receiveShadow = true;

  const matureZoneMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 0.06, 56), forageSoilMat);
  matureZoneMesh.position.set(43, 0.235, 2);
  matureZoneMesh.receiveShadow = true;
  ecoPlot.add(rawZoneMesh, midZoneMesh, matureZoneMesh);

  // Tapered alkali salt-crust patches concentrated on West/Center zones
  const saltPatches: THREE.Mesh[] = [];
  const patchDefs: Array<[number, number, number, number]> = [
    [-50, -14, 17, 9],
    [-46, 12, 18, 9],
    [-36, -2, 15, 8],
    [-12, -16, 13, 7],
    [-10, 14, 12, 6],
    [12, 8, 10, 5],
  ];
  for (const [px, pz, sx, sz] of patchDefs) {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.5, sx * 0.56, 0.07, 12), saltPatchMat);
    patch.scale.set(1, 1, sz / sx);
    patch.position.set(px, 0.26, pz);
    ecoPlot.add(patch);
    saltPatches.push(patch);
  }

  // Neat low-profile collector sub-main piping tucked cleanly at z=+16 linking the 3 inspection manholes
  const drainSubPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 48, 8), mats.pipeTeal);
  drainSubPipe.rotation.z = Math.PI / 2;
  drainSubPipe.position.set(0, 0.34, 16);
  const feedHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 54, 8), mats.pipeTeal);
  feedHeader.rotation.x = Math.PI / 2;
  feedHeader.position.set(-22, 0.32, 0);
  ecoPlot.add(drainSubPipe, feedHeader);

  // Mount anchors for P区 Blender PBR engineering equipment
  const pHeadworksMount = new THREE.Group();
  pHeadworksMount.position.set(0, 0.22, -29);
  const pCutawayMount = new THREE.Group();
  pCutawayMount.position.set(0, 0.22, -2);
  const pManholeMounts: THREE.Group[] = [];
  for (const mx of [-21, 0, 21]) {
    const mm = new THREE.Group();
    mm.position.set(mx, 0.22, 16);
    ecoPlot.add(mm);
    pManholeMounts.push(mm);
  }
  const pTelemetryMounts: THREE.Group[] = [];
  for (const [tx, tz] of [
    [-44, -22],
    [16, -22],
    [46, 14],
  ]) {
    const tm = new THREE.Group();
    tm.position.set(tx, 0.22, tz);
    ecoPlot.add(tm);
    pTelemetryMounts.push(tm);
  }
  ecoPlot.add(pHeadworksMount, pCutawayMount);

  // Multi-row agroforestry windbreak shrub-tree grid (South rim + West barrier + Mid shelter row)
  const shelterTreeGeos = createShelterShrubTreeGeometries();
  const shelterTrunkMat = new THREE.MeshStandardMaterial({
    color: 0x846249,
    roughness: 0.91,
    vertexColors: true,
  });
  const shelterLeafMat = new THREE.MeshStandardMaterial({
    color: 0x4ca662,
    roughness: 0.84,
    vertexColors: true,
    flatShading: true,
  });
  const shelterTrees: THREE.Group[] = [];
  const addShelterTree = (wx: number, wz: number, seed: number) => {
    const tree = new THREE.Group();
    const tr = new THREE.Mesh(shelterTreeGeos.trunk, shelterTrunkMat);
    tr.castShadow = true;
    tr.receiveShadow = true;
    const cr = new THREE.Mesh(shelterTreeGeos.foliage, shelterLeafMat);
    cr.castShadow = true;
    cr.receiveShadow = true;
    tree.add(tr, cr);
    tree.position.set(wx, 0.22, wz);
    tree.rotation.y = seed % (Math.PI * 2);
    ecoPlot.add(tree);
    shelterTrees.push(tree);
  };

  for (const rowZ of [27, 34]) {
    for (let tx = -56; tx <= 56; tx += 8.5) {
      addShelterTree(tx + (rowZ > 30 ? 3.8 : 0), rowZ, Math.abs(tx * 1.37 + rowZ));
    }
  }
  for (let wz = -22; wz <= 20; wz += 10.5) {
    addShelterTree(-61, wz, wz * 2.1 + 7);
    if (Math.abs(wz) > 6) {
      addShelterTree(22, wz, wz * 1.7 + 13);
    }
  }

  loadBlenderTreeAssets()
    .then((assets) => {
      const sh = assets.shelter;
      sh.woodMaterial.color.setHex(0xeedcc8);
      for (const tree of shelterTrees) {
        const tr = tree.children[0] as THREE.Mesh | undefined;
        const cr = tree.children[1] as THREE.Mesh | undefined;
        if (tr) {
          tr.geometry = sh.woodGeometry;
          tr.material = sh.woodMaterial;
        }
        if (cr) {
          cr.geometry = sh.foliageGeometry;
          cr.material = sh.foliageMaterial;
          cr.customDepthMaterial = sh.foliageDepthMaterial;
        }
      }
    })
    .catch((err) => console.error('Failed to upgrade Blender P区 shelter trees:', err));

  ecoGroup.add(ecoPlot);
  tagStepInteractive(ecoGroup, 'ecology');
  scene.add(ecoGroup);

  // ==============================
  // 2. O区 · 双大型圆形中心支轴喷灌牧草基地 + 牧草打包调度站 (South-West: O1=-154, O2=-72, Station=-20.5)
  // ==============================
  const forageGroup = new THREE.Group();

  const pivotCenters: Array<{ x: number; z: number; r: number }> = [
    { x: -154, z: 112, r: 35 },
    { x: -72, z: 112, r: 35 },
  ];

  const pivotMounts: THREE.Group[] = [];
  const pivotArms: THREE.Group[] = [];
  for (const [idx, pc] of pivotCenters.entries()) {
    const soilCircle = new THREE.Mesh(
      new THREE.CylinderGeometry(pc.r, pc.r + 0.6, 0.24, 52),
      forageSoilMat,
    );
    soilCircle.position.set(pc.x, 0.14, pc.z);
    soilCircle.receiveShadow = true;
    forageGroup.add(soilCircle);

    // Subtle wheel track paths at r = 14.8m and r = 29.2m aligned with A-frame tower tires
    for (const trackR of [14.8, 29.2]) {
      const rut = new THREE.Mesh(
        new THREE.RingGeometry(trackR - 0.55, trackR + 0.55, 56),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      );
      rut.rotation.x = -Math.PI / 2;
      rut.position.set(pc.x, 0.27, pc.z);
      forageGroup.add(rut);
    }

    const pivot = new THREE.Group();
    pivot.position.set(pc.x, 0.26, pc.z);

    // Lightweight placeholder tower until GLB streams in
    const towerFallback = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 3.6, 10), mats.steelFrame);
    towerFallback.position.y = 1.8;
    towerFallback.castShadow = true;
    towerFallback.userData.__opqPlaceholder = true;
    pivot.add(towerFallback);

    const arm = new THREE.Group();
    const spanLen = pc.r - 1.8;
    const armFallback = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, spanLen, 8), mats.wallWhite);
    armFallback.rotation.z = Math.PI / 2;
    armFallback.position.set(spanLen * 0.5, 3.6, 0);
    armFallback.userData.__opqPlaceholder = true;
    arm.add(armFallback);

    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(spanLen - 3, 2.4),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    mist.position.set(spanLen * 0.5, 1.4, 0);
    arm.add(mist);

    pivot.add(arm);
    pivot.rotation.y = idx * 1.4;
    pivotMounts.push(pivot);
    pivotArms.push(arm);
    forageGroup.add(pivot);
  }

  // O区 Hay & Baling Dispatch Hub (-20.5, 79) + East Alfalfa/Oat Furrow Strip (-20.5, 122)
  const forageStationMount = new THREE.Group();
  forageStationMount.position.set(-20.5, 0, 79);
  const stationPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(22, 0.24, 18), mats.concreteLight);
  stationPlaceholder.position.y = 0.12;
  stationPlaceholder.userData.__opqPlaceholder = true;
  forageStationMount.add(stationPlaceholder);
  forageGroup.add(forageStationMount);

  const stripMesh = new THREE.Mesh(new THREE.BoxGeometry(22, 0.22, 52), forageSoilMat);
  stripMesh.position.set(-20.5, 0.13, 122);
  stripMesh.receiveShadow = true;
  forageGroup.add(stripMesh);

  // Botanical Forage Crops across O1, O2, O3, & P区
  interface CropMeta {
    x: number;
    y: number;
    z: number;
    plotType: 'eco' | 'forageW' | 'forageE' | 'strip';
    seed: number;
    sector?: number;
  }

  const tallCrops: CropMeta[] = [];
  const alfalfaCrops: CropMeta[] = [];

  // West Pivot O1 (-154, 112, r=35): Tall Silage Corn / Sudan Grass leaving tire tracks clear
  for (let r = 2.8; r <= 33.4; r += 1.8) {
    if ((r > 13.6 && r < 16.0) || (r > 28.0 && r < 30.4)) continue;
    const ringCount = Math.max(8, Math.round((2 * Math.PI * r) / 1.8));
    const phaseShift = (r * 0.73) % (Math.PI * 2);
    for (let k = 0; k < ringCount; k++) {
      const ang = (k / ringCount) * Math.PI * 2 + phaseShift;
      const rr = r + Math.sin(k * 2.3 + r) * 0.2;
      const x = -154 + Math.cos(ang) * rr;
      const z = 112 + Math.sin(ang) * rr;
      tallCrops.push({ x, y: 0.25, z, plotType: 'forageW', seed: Math.abs(x * 17 + z * 11) });
    }
  }

  // East Pivot O2 (-72, 112, r=35): Rotational Cutting Alfalfa Sectors (cut/lush contrast wedges)
  for (let r = 2.8; r <= 33.4; r += 1.75) {
    if ((r > 13.6 && r < 16.0) || (r > 28.0 && r < 30.4)) continue;
    const ringCount = Math.max(8, Math.round((2 * Math.PI * r) / 1.75));
    const phaseShift = (r * 0.61) % (Math.PI * 2);
    for (let k = 0; k < ringCount; k++) {
      const ang = (k / ringCount) * Math.PI * 2 + phaseShift;
      const rr = r + Math.cos(k * 1.9 + r) * 0.2;
      const x = -72 + Math.cos(ang) * rr;
      const z = 112 + Math.sin(ang) * rr;
      const sector = Math.floor((((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2));
      alfalfaCrops.push({ x, y: 0.25, z, plotType: 'forageE', seed: Math.abs(x * 19 + z * 5), sector });
    }
  }

  // East Organic Alfalfa/Oat Strip Parcel (-20.5, 122, 22x52m)
  for (let lx = -9.6; lx <= 9.6; lx += 1.75) {
    for (let lz = -24.2; lz <= 24.2; lz += 1.75) {
      const wx = -20.5 + lx + Math.sin(lz * 0.9) * 0.2;
      const wz = 122 + lz + Math.cos(lx * 0.9) * 0.2;
      alfalfaCrops.push({ x: wx, y: 0.23, z: wz, plotType: 'strip', seed: Math.abs(wx * 23 + wz * 13) });
    }
  }

  // Contoured P区 3-Stage Saline-Alkali Remediation Forage (centered 70, 114, keeping headworks & cutaway trench clear)
  for (let lx = -58; lx <= 58; lx += 2.65) {
    for (let lz = -31; lz <= 29; lz += 2.65) {
      if ((lx * lx) / (62 * 62) + (lz * lz) / (33 * 33) > 0.92) continue;
      if (Math.abs(lx) < 8 && lz < -22) continue; // Keep P_Headworks_Complex clear
      if (Math.abs(lx) < 10.5 && Math.abs(lz + 2) < 4.0) continue; // Keep P_Drainage_Cutaway clear
      if (Math.abs(lz - 16) < 2.2 && Math.abs(lx) < 25) continue; // Keep manhole line clear
      // Keep raw saline control west core slightly sparser to show transition contrast
      if (lx < -26 && Math.abs(Math.sin(lx * 0.7 + lz * 0.5)) < 0.32) continue;
      const jx = 70 + lx + Math.sin(lz * 0.8 + lx) * 0.45;
      const jz = 114 + lz + Math.cos(lx * 0.7 + lz) * 0.45;
      alfalfaCrops.push({ x: jx, y: 0.23, z: jz, plotType: 'eco', seed: Math.abs(jx * 13 + jz * 7) });
    }
  }

  const tallForageGeo = createSilageForageClumpGeometry();
  const tallForageMat = createAnimatedGrassMaterial(0.76);
  const tallForageInstanced = new THREE.InstancedMesh(tallForageGeo, tallForageMat, tallCrops.length);
  tallForageInstanced.receiveShadow = true;
  tallForageInstanced.castShadow = false;
  forageGroup.add(tallForageInstanced);

  const alfalfaGeo = createAlfalfaBushGeometry();
  const alfalfaMat = createAnimatedGrassMaterial(0.8);
  const alfalfaInstanced = new THREE.InstancedMesh(alfalfaGeo, alfalfaMat, alfalfaCrops.length);
  alfalfaInstanced.receiveShadow = true;
  alfalfaInstanced.castShadow = false;
  forageGroup.add(alfalfaInstanced);

  tagStepInteractive(forageGroup, 'forage');
  scene.add(forageGroup);

  // ==============================
  // 3. Q区 · 耐盐种质资源圃与三期预留发展区 (South-East of X=147 Spine: center X=188, Z=114)
  // ==============================
  const reserveGroup = new THREE.Group();
  reserveGroup.position.set(188, 0, 114);

  const qPlaceholder = new THREE.Mesh(
    new THREE.BoxGeometry(64, 0.16, 58),
    new THREE.MeshStandardMaterial({ color: 0xc8d4b8, roughness: 0.94 }),
  );
  qPlaceholder.position.y = 0.08;
  qPlaceholder.receiveShadow = true;
  qPlaceholder.userData.__opqPlaceholder = true;
  reserveGroup.add(qPlaceholder);

  tagStepInteractive(reserveGroup, 'ecology');
  scene.add(reserveGroup);

  // Stream & mount Blender PBR assets across O, P, Q
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    './models/o_p_q_ecoforage.glb',
    (gltf) => {
      gltf.scene.traverse(configureOpqMesh);
      gltf.scene.updateMatrixWorld(true);

      for (let i = 0; i < pivotMounts.length; i++) {
        mountOpqTemplate(pivotMounts[i], gltf.scene, 'O_Pivot_Base');
        mountOpqTemplate(pivotArms[i], gltf.scene, 'O_Pivot_TrussArm');
      }
      mountOpqTemplate(forageStationMount, gltf.scene, 'O_Forage_Station');
      mountOpqTemplate(pHeadworksMount, gltf.scene, 'P_Headworks_Complex');
      mountOpqTemplate(pCutawayMount, gltf.scene, 'P_Drainage_Cutaway');
      for (const mm of pManholeMounts) {
        mountOpqTemplate(mm, gltf.scene, 'P_Manhole_Well');
      }
      for (const tm of pTelemetryMounts) {
        mountOpqTemplate(tm, gltf.scene, 'P_Salinity_Station');
      }
      mountOpqTemplate(reserveGroup, gltf.scene, 'Q_Germplasm_Zone');

      tagStepInteractive(forageGroup, 'forage');
      tagStepInteractive(ecoGroup, 'ecology');
      tagStepInteractive(reserveGroup, 'ecology');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender O/P/Q GLB:', err);
    },
  );

  // Remediation morphing logic
  const dummy = new THREE.Object3D();
  const cSaline1 = new THREE.Color(0xdcd6c4);
  const cSaline3 = new THREE.Color(0x4b683c);
  const cRaw1 = new THREE.Color(0xe6decb);
  const cRaw3 = new THREE.Color(0x788e64);
  const cMid1 = new THREE.Color(0xc5bea5);
  const cMid3 = new THREE.Color(0x526e41);
  const cForage1 = new THREE.Color(0xa6a389);
  const cForage3 = new THREE.Color(0x425e30);
  const cDry = new THREE.Color(0xbdb478);
  const cAlfalfa = new THREE.Color(0x48b05e);
  const cAlfalfaBright = new THREE.Color(0x63c96e);
  const cAlfalfaFresh = new THREE.Color(0x77cf76);
  const cMaize = new THREE.Color(0x3a9456);
  const cMaizeBright = new THREE.Color(0x5ab562);
  const tempColor = new THREE.Color();

  let currentProgress = 0.85;

  const updateVegetation = (t: number) => {
    currentProgress = THREE.MathUtils.clamp(t, 0, 1);

    salinePlotMat.color.copy(cSaline1).lerp(cSaline3, currentProgress);
    salineRawMat.color.copy(cRaw1).lerp(cRaw3, currentProgress * 0.85);
    salineMidMat.color.copy(cMid1).lerp(cMid3, currentProgress);
    forageSoilMat.color.copy(cForage1).lerp(cForage3, currentProgress);
    saltPatchMat.opacity = Math.max(0.03, (1 - currentProgress) * 0.92);
    saltPatches.forEach((p) => {
      p.visible = saltPatchMat.opacity > 0.05;
      p.scale.y = Math.max(0.15, 1 - currentProgress * 0.85);
    });
    shelterTrees.forEach((tr) => {
      const sc = 0.55 + currentProgress * 0.55;
      tr.scale.setScalar(sc);
    });

    for (let i = 0; i < tallCrops.length; i++) {
      const item = tallCrops[i];
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, (item.seed % 628) / 100, 0);
      const vary = Math.sin(item.seed) * 0.14;
      const hScale = 0.72 + currentProgress * 0.92 + vary;
      const wScale = 1.05 + currentProgress * 0.35 + vary * 0.3;
      dummy.scale.set(wScale, hScale, wScale);
      dummy.updateMatrix();
      tallForageInstanced.setMatrixAt(i, dummy.matrix);

      const targetHue = (item.seed % 10) > 5 ? cMaizeBright : cMaize;
      tempColor.copy(cDry).lerp(targetHue, 0.42 + currentProgress * 0.58);
      tallForageInstanced.setColorAt(i, tempColor);
    }
    tallForageInstanced.instanceMatrix.needsUpdate = true;
    if (tallForageInstanced.instanceColor) {
      tallForageInstanced.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < alfalfaCrops.length; i++) {
      const item = alfalfaCrops[i];
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, (item.seed % 628) / 100, 0);
      const vary = Math.sin(item.seed) * 0.14;

      if (item.plotType === 'eco') {
        const localX = item.x - 70;
        // Stage progression factor: East mature stage thrives earlier than West raw stage
        const stageFactor = THREE.MathUtils.clamp((localX + 64) / 128, 0, 1);
        const hScale = 0.18 + currentProgress * (0.68 + stageFactor * 0.42) + vary * 0.3;
        const wScale = 0.58 + currentProgress * (0.55 + stageFactor * 0.3);
        dummy.scale.set(wScale, Math.max(0.18, hScale), wScale);
        const ecoHue = (item.seed % 9) > 4 ? cAlfalfaBright : cAlfalfa;
        tempColor.copy(cDry).lerp(ecoHue, THREE.MathUtils.clamp(currentProgress * (0.72 + stageFactor * 0.38), 0, 1));
      } else {
        // Rotational harvest wedge height & color variation in East Pivot (O2)
        const cutMult = item.plotType === 'forageE' && item.sector !== undefined && item.sector % 2 === 1 ? 0.68 : 1.0;
        const hScale = (0.62 + currentProgress * 0.88 + vary) * cutMult;
        const wScale = 1.05 + currentProgress * 0.48 + vary * 0.25;
        dummy.scale.set(wScale, hScale, wScale);
        const lushHue =
          cutMult < 1.0 ? cAlfalfaFresh : (item.seed % 11) > 5 ? cAlfalfaBright : cAlfalfa;
        tempColor.copy(cDry).lerp(lushHue, 0.38 + currentProgress * 0.62);
      }

      dummy.updateMatrix();
      alfalfaInstanced.setMatrixAt(i, dummy.matrix);
      alfalfaInstanced.setColorAt(i, tempColor);
    }
    alfalfaInstanced.instanceMatrix.needsUpdate = true;
    if (alfalfaInstanced.instanceColor) {
      alfalfaInstanced.instanceColor.needsUpdate = true;
    }
  };

  updateVegetation(currentProgress);

  return {
    setRemediationProgress(t: number) {
      updateVegetation(t);
    },
    update(elapsed: number) {
      pivotArms.forEach((arm, idx) => {
        arm.rotation.y = elapsed * 0.18 + idx * 2.1;
      });
    },
  };
}
