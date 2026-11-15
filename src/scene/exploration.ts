import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ExplorationMode = 'orbit' | 'walk' | 'drive';
export type DriveCameraStyle = 'cockpit' | 'chase';

export interface ExplorationHudState {
  mode: ExplorationMode;
  driveCameraStyle: DriveCameraStyle;
  speedKmh: number;
  gear: 'P' | 'D' | 'R';
  zoneName: string;
  nearCar: boolean;
  isPointerLocked: boolean;
}

export interface ExplorationController {
  getMode: () => ExplorationMode;
  setMode: (mode: ExplorationMode) => void;
  toggleDriveCameraStyle: () => void;
  resetVehicle: () => void;
  isPointerLocked: () => boolean;
  update: (dt: number, elapsed: number) => ExplorationHudState | null;
}

interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  carOnly?: boolean;
}

interface CircleCollider {
  x: number;
  z: number;
  r: number;
  carOnly?: boolean;
}

const WORLD_BOUNDS = { minX: -275, maxX: 405, minZ: -195, maxZ: 205 };

// Canal Y-Z centerline samples used to block driving/walking into water while leaving bridges open
const CANAL_WAYPOINTS: Array<[number, number]> = [
  [-262, 38],
  [-220, 42],
  [-188, 43],
  [-148, 38],
  [-105, 32],
  [-25, 36],
  [34, 42],
  [106, 48],
  [180, 56],
  [228, 58],
];

const CANAL_BRIDGES: Array<{ x: number; halfWidth: number }> = [
  { x: -244, halfWidth: 3.4 },
  { x: 147, halfWidth: 3.4 },
  { x: 232, halfWidth: 3.4 },
];

// Solid building & basin colliders (open interior hubs N/G/B-F keep outer perimeter passable for roof-cutaway tour)
const BOX_COLLIDERS: BoxCollider[] = [
  // West Eco-Lake water basin (block cars & deep water wading)
  { minX: -229, maxX: -159, minZ: -38, maxZ: 29, carOnly: true },
  { minX: -224, maxX: -164, minZ: -32, maxZ: 24 },
  // Central wetland pond at (30, 42)
  { minX: 10, maxX: 50, minZ: 31, maxZ: 53 },
  // A区 Civic & Command main building core
  { minX: -226, maxX: -194, minZ: -124, maxZ: -96 },
  // N区 Science Hub, G区 TMR Kitchen & B-F Sheep Sheds (cars blocked from driving through buildings; pedestrians may walk in to view cutaways)
  { minX: -175, maxX: -133, minZ: -118, maxZ: -78, carOnly: true },
  { minX: -81, maxX: 13, minZ: -39, maxZ: -5, carOnly: true },
  { minX: -104, maxX: -68, minZ: -132, maxZ: -86, carOnly: true },
  { minX: -44, maxX: -8, minZ: -134, maxZ: -94, carOnly: true },
  { minX: 12, maxX: 56, minZ: -126, maxZ: -86, carOnly: true },
  { minX: 72, maxX: 116, minZ: -115, maxZ: -77, carOnly: true },
  { minX: 43, maxX: 93, minZ: -39, maxZ: -5, carOnly: true },
  // H区 Quarantine building block
  { minX: -138, maxX: -106, minZ: -36, maxZ: -8, carOnly: true },
  // M区 Machinery warehouse
  { minX: -234, maxX: -210, minZ: 88, maxZ: 128 },
  // J区 Manure towers & compost bays
  { minX: 156, maxX: 210, minZ: -34, maxZ: 0 },
  // K区 Water treatment clarifier & MBR building
  { minX: 155, maxX: 212, minZ: 16, maxZ: 48 },
  // L区 Energy substation & battery containers
  { minX: 155, maxX: 201, minZ: -110, maxZ: -66 },
  // Q区 Germplasm greenhouse
  { minX: 160, maxX: 186, minZ: 90, maxZ: 138, carOnly: true },
  // I区 Slaughter & cold-chain main plant buildings (leave internal avenues & roundabout driveable)
  { minX: 282, maxX: 304, minZ: 80, maxZ: 124 },
  { minX: 314, maxX: 344, minZ: 80, maxZ: 124 },
];

const CIRCLE_COLLIDERS: CircleCollider[] = [
  // O区 Pivot center towers
  { x: -154, z: 112, r: 3.2 },
  { x: -72, z: 112, r: 3.2 },
  // North ridge wind turbines
  { x: -200, z: -182, r: 2.6 },
  { x: -105, z: -190, r: 2.6 },
  { x: -5, z: -188, r: 2.6 },
  { x: 95, z: -185, r: 2.6 },
  { x: 190, z: -180, r: 2.6 },
];

function getCanalZAtX(x: number): number | null {
  if (x < -262 || x > 228) return null;
  for (let i = 0; i < CANAL_WAYPOINTS.length - 1; i++) {
    const [x0, z0] = CANAL_WAYPOINTS[i];
    const [x1, z1] = CANAL_WAYPOINTS[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / Math.max(0.001, x1 - x0);
      return THREE.MathUtils.lerp(z0, z1, t);
    }
  }
  return null;
}

function resolveMotionCollision(
  pos: THREE.Vector3,
  radius: number,
  isCar: boolean,
  carPos?: THREE.Vector3,
): void {
  pos.x = THREE.MathUtils.clamp(pos.x, WORLD_BOUNDS.minX + radius, WORLD_BOUNDS.maxX - radius);
  pos.z = THREE.MathUtils.clamp(pos.z, WORLD_BOUNDS.minZ + radius, WORLD_BOUNDS.maxZ - radius);

  // Ecological canal guard (open on canal bridges)
  const onBridge = CANAL_BRIDGES.some((b) => Math.abs(pos.x - b.x) <= b.halfWidth - radius * 0.35);
  if (!onBridge) {
    const canalZ = getCanalZAtX(pos.x);
    if (canalZ !== null) {
      const canalHalfWidth = 4.4 + radius;
      const dz = pos.z - canalZ;
      if (Math.abs(dz) < canalHalfWidth) {
        pos.z = canalZ + (dz >= 0 ? canalHalfWidth : -canalHalfWidth);
      }
    }
  }

  for (const box of BOX_COLLIDERS) {
    if (box.carOnly && !isCar) continue;
    const minX = box.minX - radius;
    const maxX = box.maxX + radius;
    const minZ = box.minZ - radius;
    const maxZ = box.maxZ + radius;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const dl = pos.x - minX;
      const dr = maxX - pos.x;
      const dt = pos.z - minZ;
      const db = maxZ - pos.z;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) pos.x = minX;
      else if (m === dr) pos.x = maxX;
      else if (m === dt) pos.z = minZ;
      else pos.z = maxZ;
    }
  }

  for (const c of CIRCLE_COLLIDERS) {
    if (c.carOnly && !isCar) continue;
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minDist = c.r + radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }

  // Keep walking player outside parked car body
  if (!isCar && carPos) {
    const dx = pos.x - carPos.x;
    const dz = pos.z - carPos.z;
    const minDist = 2.0 + radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
}

export function getZoneNameAt(x: number, z: number): string {
  if (x > 268 && z > 52 && z < 166) return 'I区 · 独立屠宰冷链副园';
  if (x > 244 && x <= 268) return '百米荒漠生态隔离带';
  if (x > 366) return '东翼货运高速干道';
  if (x < -176 && z < -62) return 'A区 · 数字指挥与主入口';
  if (x >= -176 && x < -130 && z < -62) return 'N区 · 中乌科创中心与4实验室';
  if (x < -150 && z >= -52 && z < 36) return '滨湖生态湿地公园';
  if (x < -194 && z > 76) return 'M区 · 农机具维保调度库';
  if (x >= -194 && x < -14 && z > 66) return 'O区 · 双圆指针牧草基地';
  if (x >= -14 && x < 142 && z > 66) return 'P区 · 盐碱地三段治理区';
  if (x >= 142 && z > 66) return 'Q区 · 耐盐碱种质圃与预留区';
  if (x >= -144 && x < -98 && z >= -50 && z <= 6) return 'H区 · 远端检疫隔离前哨';
  if (x >= -86 && x < 18 && z >= -50 && z <= 4) return 'G区 · 植物工厂与TMR中央厨房';
  if (x >= -108 && x < -60 && z < -70) return 'B区 · 育种核心展示舍';
  if (x >= -60 && x < 2 && z < -70) return 'C区 · 繁殖母羊核心舍';
  if (x >= 2 && x < 64 && z < -70) return 'D区 · 羔羊保育精细舍';
  if (x >= 64 && x < 122 && z < -66) return 'E区 · 标准育肥羊舍区';
  if (x >= 24 && x < 118 && z >= -50 && z <= 4) return 'F区 · 智能生产与轮牧区';
  if (x >= 146 && z < -54) return 'L区 · 综合能源光储微网区';
  if (x >= 146 && z >= -54 && z <= 10) return 'J区 · 下风向粪污堆肥沼气区';
  if (x >= 146 && z > 10 && z <= 56) return 'K区 · 沉淀池与再生水回用区';
  if (Math.abs(z + 56) < 6) return '净道 · 洁净饲料动脉';
  if (Math.abs(z - 8) < 6) return '污道 · 封闭清粪走廊';
  if (Math.abs(z - 64) < 6) return '南侧生态景观大道';
  return '绿洲生态牧场道路网';
}

interface PatrolCarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  frontSteerPivots: THREE.Group[];
  wheels: THREE.Object3D[];
  steeringWheel: THREE.Object3D;
  brakeLightMats: THREE.MeshStandardMaterial[];
  lidarDome: THREE.Object3D;
  cockpitHideables: THREE.Object3D[];
}

function attachBlenderPatrolSuv(carRig: PatrolCarRig, onLoaded: () => void): void {
  const loader = new GLTFLoader();
  loader.load(
    './models/patrol_suv.glb',
    (gltf) => {
      const glbRoot = gltf.scene;
      const bodyNode = glbRoot.getObjectByName('Patrol_Body');
      if (!bodyNode) return;

      const brakeMats: THREE.MeshStandardMaterial[] = [];
      glbRoot.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        let isGlass = false;
        for (const m of mats) {
          if (!m) continue;
          const std = m as THREE.MeshStandardMaterial;
          if (std.name.includes('TintedGlass') || std.transparent || std.opacity < 0.99) {
            isGlass = true;
            std.transparent = true;
            std.depthWrite = false;
          }
          if (std.name.includes('BrakeLight') && !brakeMats.includes(std)) {
            brakeMats.push(std);
          }
        }
        node.castShadow = !isGlass;
        node.receiveShadow = true;
      });

      // Replace placeholder body meshes
      while (carRig.bodyPivot.children.length > 0) {
        carRig.bodyPivot.remove(carRig.bodyPivot.children[0]);
      }
      carRig.bodyPivot.add(bodyNode);

      // Replace placeholder wheels while keeping steering pivots intact
      const wheelMappings: Array<{ name: string; pivot: THREE.Group | null }> = [
        { name: 'Patrol_Wheel_FL', pivot: carRig.frontSteerPivots[0] ?? null },
        { name: 'Patrol_Wheel_FR', pivot: carRig.frontSteerPivots[1] ?? null },
        { name: 'Patrol_Wheel_RL', pivot: null },
        { name: 'Patrol_Wheel_RR', pivot: null },
      ];

      // Remove old placeholder wheels from root & front pivots
      for (const piv of carRig.frontSteerPivots) {
        while (piv.children.length > 0) piv.remove(piv.children[0]);
      }
      for (const oldWheel of carRig.wheels) {
        if (oldWheel.parent === carRig.root) {
          carRig.root.remove(oldWheel);
        }
      }

      const nextWheels: THREE.Object3D[] = [];
      for (const { name, pivot } of wheelMappings) {
        const wNode = glbRoot.getObjectByName(name);
        if (!wNode) continue;
        if (pivot) {
          pivot.position.copy(wNode.position);
          wNode.position.set(0, 0, 0);
          pivot.add(wNode);
        } else {
          carRig.root.add(wNode);
        }
        nextWheels.push(wNode);
      }
      if (nextWheels.length > 0) {
        carRig.wheels = nextWheels;
      }

      const cockpitHideNode = bodyNode.getObjectByName('Patrol_CockpitHide');
      carRig.cockpitHideables = cockpitHideNode ? [cockpitHideNode] : [];

      const swSpinNode = bodyNode.getObjectByName('Patrol_SteeringWheelSpin');
      if (swSpinNode) carRig.steeringWheel = swSpinNode;

      const lidarNode = bodyNode.getObjectByName('Patrol_LidarDome');
      if (lidarNode) carRig.lidarDome = lidarNode;

      if (brakeMats.length > 0) {
        carRig.brakeLightMats = brakeMats;
      }

      onLoaded();
    },
    undefined,
    (err) => console.warn('[PatrolSUV] failed to load ./models/patrol_suv.glb:', err),
  );
}

function buildPatrolCar(): PatrolCarRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const paintMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.12 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.2 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.24,
    roughness: 0.08,
    metalness: 0.05,
    depthWrite: false,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef3c7,
    emissiveIntensity: 1.4,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.5,
  });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.75 });

  // Lower chassis & bumpers (forward = +Z)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.42, 4.3), trimMat);
  chassis.position.set(0, 0.48, 0);
  chassis.castShadow = true;
  bodyPivot.add(chassis);

  // Lower body shell + hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.48, 1.48), paintMat);
  hood.position.set(0, 0.88, 1.32);
  hood.castShadow = true;
  bodyPivot.add(hood);

  // Emerald eco-stripe along hood & sides
  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 1.36), accentMat);
  hoodStripe.position.set(0, 1.13, 1.32);
  bodyPivot.add(hoodStripe);

  for (const sx of [-0.95, 0.95]) {
    const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 2.75), paintMat);
    sideSkirt.position.set(sx, 0.88, -0.45);
    sideSkirt.castShadow = true;
    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 2.6), accentMat);
    sideStripe.position.set(sx, 0.92, -0.45);
    bodyPivot.add(sideSkirt, sideStripe);
  }

  // Rear cargo & tail
  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.56, 0.95), paintMat);
  rearDeck.position.set(0, 0.92, -1.62);
  rearDeck.castShadow = true;
  bodyPivot.add(rearDeck);

  // Interior floor, seats, dashboard & steering wheel (driver on left: +X in +Z forward space!)
  const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 1.9), dashMat);
  cabinFloor.position.set(0, 0.66, -0.2);
  bodyPivot.add(cabinFloor);

  const dashboard = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.34, 0.52), dashMat);
  dashboard.position.set(0, 1.02, 0.58);
  bodyPivot.add(dashboard);

  const centerDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.04), screenMat);
  centerDisplay.position.set(0, 1.2, 0.36);
  centerDisplay.rotation.x = -0.22;
  bodyPivot.add(centerDisplay);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0.42, 1.13, 0.29);
  steeringWheel.rotation.x = -0.42;
  const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20), trimMat);
  const swSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.028, 0.02), accentMat);
  const swHub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), trimMat);
  swHub.rotation.x = Math.PI / 2;
  steeringWheel.add(swRing, swSpoke, swHub);
  bodyPivot.add(steeringWheel);

  // Seats & Roof structure (hidden in cockpit mode so forward/side view is crystal clear)
  const cockpitHideables: THREE.Object3D[] = [];

  for (const sx of [-0.42, 0.42]) {
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.52), trimMat);
    seatBase.position.set(sx, 0.78, -0.22);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.14), trimMat);
    seatBack.position.set(sx, 1.14, -0.46);
    seatBack.rotation.x = -0.14;
    bodyPivot.add(seatBase, seatBack);
    cockpitHideables.push(seatBase, seatBack);
  }

  // Pillars & roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 2.05), paintMat);
  roof.position.set(0, 1.78, -0.35);
  roof.castShadow = true;
  bodyPivot.add(roof);
  cockpitHideables.push(roof);

  // Roof LiDAR / smart ranch beacon
  const lidarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 14), trimMat);
  lidarBase.position.set(0, 1.88, 0.05);
  const lidarDome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.14, 14),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x10b981,
      emissiveIntensity: 1.1,
    }),
  );
  lidarDome.position.set(0, 1.98, 0.05);
  bodyPivot.add(lidarBase, lidarDome);
  cockpitHideables.push(lidarBase, lidarDome);

  // Windshield A-pillars & glass (pillars stay visible in cockpit for realistic frame!)
  for (const sx of [-0.84, 0.84]) {
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.08), trimMat);
    aPillar.position.set(sx, 1.44, 0.56);
    aPillar.rotation.x = -0.45;
    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.1), trimMat);
    bPillar.position.set(sx, 1.44, -0.45);
    const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.12), trimMat);
    cPillar.position.set(sx, 1.44, -1.32);
    cPillar.rotation.x = 0.25;
    bodyPivot.add(aPillar, bPillar, cPillar);
    cockpitHideables.push(bPillar, cPillar);
  }

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.68, 0.03), glassMat);
  windshield.position.set(0, 1.44, 0.56);
  windshield.rotation.x = -0.45;
  bodyPivot.add(windshield);
  cockpitHideables.push(windshield);

  // Headlights & Taillights
  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), headLightMat);
    hl.position.set(sx, 0.88, 2.08);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), brakeLightMat);
    bl.position.set(sx, 0.94, -2.11);
    bodyPivot.add(hl, bl);
  }

  // Side mirrors
  for (const sx of [-1.02, 1.02]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), trimMat);
    mirror.position.set(sx, 1.18, 0.42);
    bodyPivot.add(mirror);
  }

  // 4 Wheels with steering pivots on front axle
  const frontSteerPivots: THREE.Group[] = [];
  const wheels: THREE.Object3D[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 18);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.3, 12);
  const spokeGeo = new THREE.BoxGeometry(0.31, 0.42, 0.06);

  for (const [wx, wz, isFront] of [
    [0.95, 1.38, true],
    [-0.95, 1.38, true],
    [0.95, -1.35, false],
    [-0.95, -1.35, false],
  ] as Array<[number, number, boolean]>) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, 0.4, wz);
    root.add(steerPivot);
    if (isFront) frontSteerPivots.push(steerPivot);

    const wheelSpin = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    const spoke = new THREE.Mesh(spokeGeo, trimMat);
    wheelSpin.add(tire, rim, spoke);
    steerPivot.add(wheelSpin);
    wheels.push(wheelSpin);
  }

  return {
    root,
    bodyPivot,
    frontSteerPivots,
    wheels,
    steeringWheel,
    brakeLightMats: [brakeLightMat],
    lidarDome,
    cockpitHideables,
  };
}

export function createExplorationController(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  callbacks: {
    onModeChanged: (mode: ExplorationMode) => void;
    onRequestOrbitMode: () => void;
  },
): ExplorationController {
  const carRig = buildPatrolCar();
  const initialCarPos = new THREE.Vector3(-182, 0.08, -78);
  carRig.root.position.copy(initialCarPos);
  carRig.root.rotation.y = 0; // Facing South (+Z) towards Eco-Lake & Clean Road
  scene.add(carRig.root);

  let mode: ExplorationMode = 'orbit';
  let driveCameraStyle: DriveCameraStyle = 'cockpit';

  attachBlenderPatrolSuv(carRig, () => {
    setCockpitVisibility(mode === 'drive' && driveCameraStyle === 'cockpit');
  });

  // Walk state
  const walkPos = new THREE.Vector3(-186, 0.1, -78);
  let walkYaw = Math.PI * 0.65;
  let walkPitch = -0.04;
  let walkVelY = 0;
  let onGround = true;
  let walkBobPhase = 0;

  // Drive state
  const carPos = initialCarPos.clone();
  let carYaw = 0;
  let carSpeed = 0; // m/s (+ = forward)
  let carSteerAngle = 0;
  let wheelRollAngle = 0;
  let chaseYawOffset = 0;
  let chasePitch = 0.24;
  const chaseCameraPos = new THREE.Vector3();
  const chaseLookTarget = new THREE.Vector3();
  let chaseCamInitialized = false;

  // Input state
  const keys = new Set<string>();
  let isDraggingLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const isEditable = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);

  function setCockpitVisibility(hideRoofAndPillars: boolean): void {
    for (const obj of carRig.cockpitHideables) {
      obj.visible = !hideRoofAndPillars;
    }
  }

  function applyCameraLensForMode(nextMode: ExplorationMode): void {
    if (nextMode === 'orbit') {
      camera.fov = 44;
      camera.near = 3.0;
    } else {
      camera.fov = nextMode === 'drive' && driveCameraStyle === 'cockpit' ? 76 : 60;
      camera.near = 0.16;
    }
    camera.updateProjectionMatrix();
  }

  function resetVehicle(): void {
    carPos.copy(initialCarPos);
    carYaw = 0;
    carSpeed = 0;
    carSteerAngle = 0;
    chaseYawOffset = 0;
    chaseCamInitialized = false;
    carRig.root.position.copy(carPos);
    carRig.root.rotation.y = carYaw;
  }

  function setMode(nextMode: ExplorationMode): void {
    if (mode === nextMode) return;
    const prevMode = mode;
    mode = nextMode;
    keys.clear();

    if (nextMode === 'orbit') {
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
      setCockpitVisibility(false);
      applyCameraLensForMode('orbit');
      callbacks.onModeChanged('orbit');
      return;
    }

    if (nextMode === 'walk') {
      if (prevMode === 'drive') {
        // Exit beside driver's left door
        const leftX = Math.cos(carYaw);
        const leftZ = -Math.sin(carYaw);
        walkPos.set(carPos.x + leftX * 2.2, 0.1, carPos.z + leftZ * 2.2);
        resolveMotionCollision(walkPos, 0.55, false, carPos);
        walkYaw = carYaw;
        walkPitch = -0.02;
      } else {
        // Spawn beside the parked patrol car facing the science hub & lake
        walkPos.set(carPos.x - 2.6, 0.1, carPos.z + 0.8);
        resolveMotionCollision(walkPos, 0.55, false, carPos);
        walkYaw = Math.atan2(carPos.x - walkPos.x, carPos.z - walkPos.z);
        walkPitch = -0.03;
      }
      walkVelY = 0;
      onGround = true;
      setCockpitVisibility(false);
      applyCameraLensForMode('walk');
    } else if (nextMode === 'drive') {
      chaseYawOffset = 0;
      chasePitch = driveCameraStyle === 'cockpit' ? 0.08 : 0.24;
      chaseCamInitialized = false;
      setCockpitVisibility(driveCameraStyle === 'cockpit');
      applyCameraLensForMode('drive');
    }

    callbacks.onModeChanged(nextMode);
  }

  function toggleDriveCameraStyle(): void {
    driveCameraStyle = driveCameraStyle === 'cockpit' ? 'chase' : 'cockpit';
    if (mode === 'drive') {
      chaseYawOffset = 0;
      chasePitch = driveCameraStyle === 'cockpit' ? 0.08 : 0.24;
      chaseCamInitialized = false;
      setCockpitVisibility(driveCameraStyle === 'cockpit');
      applyCameraLensForMode('drive');
    }
  }

  // PointerLock + Drag-look listeners
  domElement.addEventListener('click', () => {
    if (mode === 'orbit') return;
    if (document.pointerLockElement !== domElement && domElement.requestPointerLock) {
      try {
        domElement.requestPointerLock();
      } catch {
        // Fallback drag-look continues working cleanly
      }
    }
  });

  domElement.addEventListener('pointerdown', (e) => {
    if (mode === 'orbit') return;
    if (e.button === 0) {
      isDraggingLook = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
  });

  window.addEventListener('pointerup', () => {
    isDraggingLook = false;
  });

  window.addEventListener('pointermove', (e) => {
    if (mode === 'orbit') return;
    let dx = 0;
    let dy = 0;
    if (document.pointerLockElement === domElement) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (isDraggingLook) {
      dx = e.clientX - lastPointerX;
      dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    } else {
      return;
    }

    const sensitivity = 0.0024;
    if (mode === 'walk') {
      walkYaw -= dx * sensitivity;
      walkPitch = THREE.MathUtils.clamp(walkPitch - dy * sensitivity, -1.15, 1.15);
    } else if (mode === 'drive') {
      if (driveCameraStyle === 'cockpit') {
        chaseYawOffset = THREE.MathUtils.clamp(chaseYawOffset - dx * sensitivity, -1.35, 1.35);
        chasePitch = THREE.MathUtils.clamp(chasePitch - dy * sensitivity, -0.35, 0.45);
      } else {
        chaseYawOffset -= dx * sensitivity;
        chasePitch = THREE.MathUtils.clamp(chasePitch + dy * sensitivity * 0.85, 0.06, 0.82);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (mode === 'orbit' || isEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'KeyF' && !e.repeat) {
      e.preventDefault();
      if (mode === 'drive') {
        setMode('walk');
      } else if (mode === 'walk') {
        if (walkPos.distanceTo(carPos) < 7.5) {
          setMode('drive');
        }
      }
      return;
    }

    if (e.code === 'KeyV' && !e.repeat && mode === 'drive') {
      e.preventDefault();
      toggleDriveCameraStyle();
      return;
    }

    if (e.code === 'KeyR' && !e.repeat && mode === 'drive') {
      e.preventDefault();
      resetVehicle();
      return;
    }

    if (e.code === 'Escape' && document.pointerLockElement !== domElement) {
      callbacks.onRequestOrbitMode();
      return;
    }

    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
      keys.add(e.code);
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    isDraggingLook = false;
  });

  const forwardVec = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const moveVec = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const chaseDesiredPos = new THREE.Vector3();
  const chaseDesiredLook = new THREE.Vector3();

  return {
    getMode: () => mode,
    setMode,
    toggleDriveCameraStyle,
    resetVehicle,
    isPointerLocked: () => document.pointerLockElement === domElement,

    update(dt: number, elapsed: number): ExplorationHudState | null {
      // Gently pulse the patrol car's smart LiDAR beacon even when parked
      carRig.lidarDome.rotation.y = elapsed * 2.2;

      if (mode === 'orbit') return null;

      if (mode === 'walk') {
        const forwardIn = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
        const strafeIn = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
        const isSprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');

        forwardVec.set(Math.sin(walkYaw), 0, Math.cos(walkYaw));
        rightVec.set(-Math.cos(walkYaw), 0, Math.sin(walkYaw));

        moveVec.set(0, 0, 0).addScaledVector(forwardVec, forwardIn).addScaledVector(rightVec, strafeIn);
        const moving = moveVec.lengthSq() > 1e-4;
        if (moving) {
          moveVec.normalize();
          const walkSpeed = isSprinting ? 14.5 : 7.2;
          walkPos.addScaledVector(moveVec, walkSpeed * dt);
          walkBobPhase += dt * (isSprinting ? 13.5 : 9.2);
        }

        if (keys.has('Space') && onGround) {
          walkVelY = 6.2;
          onGround = false;
        }
        walkVelY -= 18.5 * dt;
        walkPos.y += walkVelY * dt;
        if (walkPos.y <= 0.1) {
          walkPos.y = 0.1;
          walkVelY = 0;
          onGround = true;
        }

        resolveMotionCollision(walkPos, 0.55, false, carPos);

        const bobOffset = moving && onGround ? Math.sin(walkBobPhase) * 0.045 : 0;
        const eyeY = walkPos.y + 1.68 + bobOffset;
        camera.position.set(walkPos.x, eyeY, walkPos.z);

        const cosPitch = Math.cos(walkPitch);
        lookTarget.set(
          walkPos.x + Math.sin(walkYaw) * cosPitch * 12,
          eyeY + Math.sin(walkPitch) * 12,
          walkPos.z + Math.cos(walkYaw) * cosPitch * 12,
        );
        camera.lookAt(lookTarget);

        const nearCar = walkPos.distanceTo(carPos) < 7.5;
        return {
          mode: 'walk',
          driveCameraStyle,
          speedKmh: moving ? Math.round((isSprinting ? 14.5 : 7.2) * 3.6) : 0,
          gear: 'P',
          zoneName: getZoneNameAt(walkPos.x, walkPos.z),
          nearCar,
          isPointerLocked: document.pointerLockElement === domElement,
        };
      }

      // DRIVE MODE (nimble arcade handling tuned for 5m ranch roads)
      const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const steerInput = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      const handbrake = keys.has('Space');
      const sport = keys.has('ShiftLeft') || keys.has('ShiftRight');

      const maxForward = sport ? 25 : 17.5; // ~63 km/h cruise, 90 km/h sport
      const maxReverse = -9;

      if (handbrake) {
        const brakeDecel = 36 * dt;
        if (Math.abs(carSpeed) <= brakeDecel) carSpeed = 0;
        else carSpeed -= Math.sign(carSpeed) * brakeDecel;
      } else if (throttle > 0) {
        const accel = carSpeed < 0 ? 32 : sport ? 15.5 : 11.5;
        carSpeed = Math.min(maxForward, carSpeed + accel * dt);
      } else if (throttle < 0) {
        const decel = carSpeed > 0 ? 32 : 10.5;
        carSpeed = Math.max(maxReverse, carSpeed - decel * dt);
      } else {
        // Smooth rolling drag
        const drag = Math.exp(-1.75 * dt);
        carSpeed *= drag;
        if (Math.abs(carSpeed) < 0.08) carSpeed = 0;
      }

      // Gentle speed-assist cornering scrub so 90-degree ranch turns feel effortless
      if (Math.abs(steerInput) > 0 && carSpeed > 11.5) {
        carSpeed -= (carSpeed - 11.5) * 1.15 * dt;
      }

      // Responsive steering wheel & tight-radius bicycle-model yaw update
      const targetSteer = steerInput * 0.74;
      carSteerAngle = THREE.MathUtils.lerp(carSteerAngle, targetSteer, 1 - Math.exp(-13.5 * dt));

      const absSpeed = Math.abs(carSpeed);
      const speedFactor = absSpeed > 0.18 ? Math.max(0.45, Math.min(1.0, absSpeed / 2.2)) : 0;
      const highSpeedDamp = 1 / (1 + absSpeed * 0.015);
      const turnDir = carSpeed >= -0.05 ? 1 : -1;
      carYaw += carSteerAngle * speedFactor * highSpeedDamp * 3.15 * turnDir * dt;

      const prevX = carPos.x;
      const prevZ = carPos.z;
      carPos.x += Math.sin(carYaw) * carSpeed * dt;
      carPos.z += Math.cos(carYaw) * carSpeed * dt;

      const preClampX = carPos.x;
      const preClampZ = carPos.z;
      resolveMotionCollision(carPos, 1.45, true);
      if (Math.hypot(carPos.x - preClampX, carPos.z - preClampZ) > 0.05) {
        carSpeed *= 0.55; // Gentle wall scrape slowdown
      }
      const actualMoved = Math.hypot(carPos.x - prevX, carPos.z - prevZ);

      // Update vehicle mesh transforms & suspension feedback
      carRig.root.position.copy(carPos);
      carRig.root.rotation.y = carYaw;

      const targetPitch = (handbrake && Math.abs(carSpeed) > 1 ? 0.025 : -throttle * 0.015);
      const targetRoll = -carSteerAngle * Math.min(1, Math.abs(carSpeed) / 12) * 0.045;
      carRig.bodyPivot.rotation.x = THREE.MathUtils.lerp(carRig.bodyPivot.rotation.x, targetPitch, 1 - Math.exp(-8 * dt));
      carRig.bodyPivot.rotation.z = THREE.MathUtils.lerp(carRig.bodyPivot.rotation.z, targetRoll, 1 - Math.exp(-8 * dt));

      for (const piv of carRig.frontSteerPivots) {
        piv.rotation.y = carSteerAngle * 0.68;
      }
      carRig.steeringWheel.rotation.z = -carSteerAngle * 2.4;

      wheelRollAngle += (actualMoved / 0.4) * (carSpeed >= 0 ? 1 : -1);
      for (const w of carRig.wheels) {
        w.rotation.x = wheelRollAngle;
      }

      const isBraking = handbrake || (throttle < 0 && carSpeed > 0.5);
      for (const bMat of carRig.brakeLightMats) {
        bMat.emissiveIntensity = isBraking ? 2.8 : 0.65;
      }

      // Gradually re-center cockpit look when user drives without moving mouse
      if (driveCameraStyle === 'cockpit') {
        if (!isDraggingLook && document.pointerLockElement !== domElement) {
          chaseYawOffset = THREE.MathUtils.lerp(chaseYawOffset, 0, 1 - Math.exp(-2.8 * dt));
        }
        // Driver eye inside left cabin seat (+0.42 X, 1.38 Y, -0.24 Z)
        const sinY = Math.sin(carYaw);
        const cosY = Math.cos(carYaw);
        const seatLocalX = 0.42;
        const seatLocalZ = -0.24;
        const camX = carPos.x + cosY * seatLocalX + sinY * seatLocalZ;
        const camZ = carPos.z - sinY * seatLocalX + cosY * seatLocalZ;
        const camY = carPos.y + 1.38;
        camera.position.set(camX, camY, camZ);

        // Subtle turn-in look-ahead so corners feel natural from the driver seat
        const viewYaw = carYaw + chaseYawOffset + carSteerAngle * 0.16;
        const cosP = Math.cos(chasePitch - 0.18);
        lookTarget.set(
          camX + Math.sin(viewYaw) * cosP * 18,
          camY + Math.sin(chasePitch - 0.18) * 18,
          camZ + Math.cos(viewYaw) * cosP * 18,
        );
        camera.lookAt(lookTarget);
      } else {
        // GTA-style 3rd-person chase cam
        const viewYaw = carYaw + chaseYawOffset;
        const dist = 8.0 + Math.min(2.0, Math.abs(carSpeed) * 0.08);
        const height = 2.6 + Math.sin(chasePitch) * 4.4;
        chaseDesiredPos.set(
          carPos.x - Math.sin(viewYaw) * dist,
          carPos.y + height,
          carPos.z - Math.cos(viewYaw) * dist,
        );
        chaseDesiredLook.set(
          carPos.x + Math.sin(carYaw) * 3.4,
          carPos.y + 1.4,
          carPos.z + Math.cos(carYaw) * 3.4,
        );
        if (!chaseCamInitialized) {
          chaseCameraPos.copy(chaseDesiredPos);
          chaseLookTarget.copy(chaseDesiredLook);
          chaseCamInitialized = true;
        } else {
          const camLerp = 1 - Math.exp(-12.5 * dt);
          chaseCameraPos.lerp(chaseDesiredPos, camLerp);
          chaseLookTarget.lerp(chaseDesiredLook, camLerp);
        }
        camera.position.copy(chaseCameraPos);
        camera.lookAt(chaseLookTarget);
      }

      const gear: 'P' | 'D' | 'R' = Math.abs(carSpeed) < 0.35 ? 'P' : carSpeed >= 0 ? 'D' : 'R';
      return {
        mode: 'drive',
        driveCameraStyle,
        speedKmh: Math.round(Math.abs(carSpeed) * 3.6),
        gear,
        zoneName: getZoneNameAt(carPos.x, carPos.z),
        nearCar: true,
        isPointerLocked: document.pointerLockElement === domElement,
      };
    },
  };
}
