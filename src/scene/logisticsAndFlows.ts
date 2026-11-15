import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CycleId } from '../data/tourSteps';
import { SharedMaterials } from './materials';

type VehicleCargoType =
  | 'harvester'
  | 'bales'
  | 'agv'
  | 'tanker'
  | 'spreader'
  | 'reefer'
  | 'livestock';

const VEHICLE_TEMPLATE_MAP: Record<VehicleCargoType, string> = {
  harvester: 'Veh_Harvester',
  bales: 'Veh_Bales',
  agv: 'Veh_AGV',
  tanker: 'Veh_Tanker',
  spreader: 'Veh_Spreader',
  livestock: 'Veh_Livestock',
  reefer: 'Veh_Reefer',
};

function configureVehicleGlbMesh(node: THREE.Object3D): void {
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

function attachFleetLibraryModels(
  vehicles: Array<{ group: THREE.Group; cargoType: VehicleCargoType }>,
): void {
  const loader = new GLTFLoader();
  loader.load(
    './models/vehicles_library.glb',
    (gltf) => {
      gltf.scene.traverse(configureVehicleGlbMesh);
      gltf.scene.updateMatrixWorld(true);

      for (const { group, cargoType } of vehicles) {
        const template = gltf.scene.getObjectByName(VEHICLE_TEMPLATE_MAP[cargoType]);
        if (!template) continue;

        const placeholders = group.children.filter((c) => c.userData.__vehPlaceholder);
        for (const p of placeholders) {
          group.remove(p);
        }

        const model = template.clone();
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        group.add(model);
      }
    },
    undefined,
    (err) => {
      console.warn('[vehicles_library] failed to load ./models/vehicles_library.glb:', err);
    },
  );
}

export interface LogisticsController {
  setFlowsVisible: (visible: boolean) => void;
  setCycleFilter: (activeCycles: Set<CycleId>) => void;
  update: (elapsed: number) => void;
}

interface Segment {
  from: [number, number];
  to: [number, number];
  reverse?: boolean;
}

function createSegmentedTraveler(segments: Segment[], speed: number, timeOffset = 0) {
  const items = segments.map((s) => {
    const dx = s.to[0] - s.from[0];
    const dz = s.to[1] - s.from[1];
    const dist = Math.hypot(dx, dz);
    return { ...s, dist: Math.max(dist, 0.01) };
  });
  const totalDist = items.reduce((acc, it) => acc + it.dist, 0);

  return (elapsed: number, obj: THREE.Object3D) => {
    const cursor = ((elapsed + timeOffset) * speed) % totalDist;
    let acc = 0;
    for (const seg of items) {
      if (cursor <= acc + seg.dist) {
        const localT = (cursor - acc) / seg.dist;
        const x = THREE.MathUtils.lerp(seg.from[0], seg.to[0], localT);
        const z = THREE.MathUtils.lerp(seg.from[1], seg.to[1], localT);
        obj.position.set(x, 0.16, z);
        const dx = seg.to[0] - seg.from[0];
        const dz = seg.to[1] - seg.from[1];
        const yaw = Math.atan2(dx, dz);
        obj.rotation.y = seg.reverse ? yaw + Math.PI : yaw;
        return;
      }
      acc += seg.dist;
    }
  };
}

function buildAutonomousVehicle(
  bodyColor: number,
  accentColor: number,
  cargoType: VehicleCargoType,
  mats: SharedMaterials,
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.45 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

  const isLongTruck = cargoType === 'reefer' || cargoType === 'livestock';
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(isLongTruck ? 2.1 : 1.65, 0.5, isLongTruck ? 5.6 : 3.0),
    bodyMat,
  );
  chassis.position.y = 0.56;
  chassis.castShadow = true;
  g.add(chassis);

  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.26, 10), accentMat);
  sensor.position.set(0, 1.35, isLongTruck ? 2.1 : 1.05);
  g.add(sensor);

  const wheelZ = isLongTruck ? 1.85 : 0.95;
  const wheelX = isLongTruck ? 1.08 : 0.86;
  for (const [wx, wz] of [
    [-wheelX, wheelZ],
    [wheelX, wheelZ],
    [-wheelX, -wheelZ],
    [wheelX, -wheelZ],
  ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }

  if (cargoType === 'harvester') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 1.6), accentMat);
    cab.position.set(0, 1.2, -0.2);
    cab.castShadow = true;
    const header = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.95), mats.hayGold);
    header.position.set(0, 0.46, 1.85);
    g.add(cab, header);
  } else if (cargoType === 'bales') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 0.9), mats.wallWhite);
    cab.position.set(0, 1.15, 0.95);
    const bale1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10), mats.hayGold);
    bale1.rotation.z = Math.PI / 2;
    bale1.position.set(0, 1.2, -0.35);
    const bale2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10), mats.hayGold);
    bale2.rotation.z = Math.PI / 2;
    bale2.position.set(0, 1.2, -1.25);
    g.add(cab, bale1, bale2);
  } else if (cargoType === 'agv') {
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.05, 2.05), mats.wallWhite);
    hopper.position.set(0, 1.3, -0.15);
    hopper.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.24, 2.1), accentMat);
    stripe.position.set(0, 1.48, -0.15);
    g.add(hopper, stripe);
  } else if (cargoType === 'tanker') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.82, 0.85), mats.wallWhite);
    cab.position.set(0, 1.15, 1.0);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.1, 12), accentMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 1.3, -0.4);
    tank.castShadow = true;
    g.add(cab, tank);
  } else if (cargoType === 'reefer' || cargoType === 'livestock') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.85, 1.4), mats.wallWhite);
    cab.position.set(0, 1.65, 1.95);
    cab.castShadow = true;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.15, 3.85), mats.wallWhite);
    box.position.set(0, 1.82, -0.75);
    box.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 3.88), accentMat);
    stripe.position.set(0, 1.95, -0.75);
    g.add(cab, box, stripe);
  } else {
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.5, 1.0, 8), mats.compostDark);
    hopper.position.set(0, 1.25, -0.4);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.82, 0.9), accentMat);
    cab.position.set(0, 1.15, 0.95);
    g.add(hopper, cab);
  }

  return g;
}

export function createLogisticsAndFlows(scene: THREE.Scene, mats: SharedMaterials): LogisticsController {
  // ==============================
  // 1. Spacious Organic 4-Cluster Road Network & Canal Bridges
  // ==============================
  const roadGroup = new THREE.Group();
  let roadOrder = 0;

  const addRoadRect = (cx: number, cz: number, w: number, d: number, edgeColor?: number) => {
    const isEastWest = w >= d;
    const microOffset = (roadOrder++ % 6) * 0.0012;
    const roadCenterY = (isEastWest ? 0.084 : 0.062) + microOffset;
    const stripCenterY = (isEastWest ? 0.093 : 0.071) + microOffset;

    const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), mats.roadAsphalt);
    road.position.set(cx, roadCenterY, cz);
    road.receiveShadow = true;
    roadGroup.add(road);

    if (edgeColor !== undefined) {
      const stripMat = new THREE.MeshBasicMaterial({ color: edgeColor });
      if (isEastWest) {
        const s1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.086, 0.24), stripMat);
        s1.position.set(cx, stripCenterY, cz - d / 2 + 0.16);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.086, 0.24), stripMat);
        s2.position.set(cx, stripCenterY, cz + d / 2 - 0.16);
        roadGroup.add(s1, s2);
      } else {
        const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.086, d), stripMat);
        s1.position.set(cx - w / 2 + 0.16, stripCenterY, cz);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.086, d), stripMat);
        s2.position.set(cx + w / 2 - 0.16, stripCenterY, cz);
        roadGroup.add(s1, s2);
      }
    }
  };

  const addCanalBridge = (bx: number, bz: number) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.28, 16), mats.concreteLight);
    deck.position.set(bx, 0.22, bz);
    deck.receiveShadow = true;
    deck.castShadow = true;

    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 16), mats.wallWhite);
    railL.position.set(bx - 3.45, 0.58, bz);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 16), mats.wallWhite);
    railR.position.set(bx + 3.45, 0.58, bz);
    roadGroup.add(deck, railL, railR);
  };

  // Perimeter Ring Boulevards (Main Pastoral Oasis vs Detached External Slaughter Enclave)
  addRoadRect(-244, 9, 5.8, 308, 0x10b981); // West Park Blvd (主入口 -> M -> O)
  addRoadRect(232, 9, 5.8, 308, 0x38bdf8); // East Main Oasis Ring (L/J/K outer bypass)
  addRoadRect(-6, -142, 480, 5.2, 0x10b981); // North Perimeter Link (A <-> B..E <-> L <-> Wind Ridge)
  addRoadRect(-6, 160, 480, 5.0, 0x10b981); // South Forage & Perimeter Link

  // Canal Crossings
  addCanalBridge(-244, 38);
  addCanalBridge(147, 53);
  addCanalBridge(232, 58);

  // N-S Zone Connectors & Access Drives
  addRoadRect(-182, -99, 4.6, 86, 0x10b981); // Civic/Science Lakeside Drive (clean T-junction into Z=-56)
  addRoadRect(-108, -78, 4.6, 128, 0x0ea5e9); // West Breeding Avenue (B/H west flank)
  addRoadRect(-54, -99, 4.6, 86, 0x0ea5e9); // Between B & C
  addRoadRect(4, -99, 4.6, 86, 0x0ea5e9); // Between C & D
  addRoadRect(64, -99, 4.6, 86, 0x0ea5e9); // Between D & E
  addRoadRect(108, -99, 4.6, 86, 0x0ea5e9); // East Breeding Bypass (out to North Perimeter)
  addRoadRect(22, -39, 4.6, 36, 0x0ea5e9); // Clean corridor between G & F
  addRoadRect(-92, -24, 4.6, 64, 0x0ea5e9); // Corridor between H & G

  // East Downwind & South Forage Service Connectors
  addRoadRect(147, 34, 4.8, 252, 0x10b981); // East Service Spine (L/J/K -> Bridge -> Eco Blvd -> divides P & Q -> South Perimeter)
  addRoadRect(222, -16, 4.2, 56, 0xf59e0b); // J区 Clean Compost Dispatch Lane (East portal X=215 -> Z=-44 -> Spine X=147)
  addRoadRect(184.5, -44, 79, 4.2, 0xf59e0b); // North J区 Compost Link to Spine X=147
  addRoadRect(-196, 112, 4.6, 96, 0x10b981); // M-O Service Ave (separating South-West M区 & O1)
  addRoadRect(-114, 112, 4.4, 96, 0x10b981); // Between O Crop Circle 1 & 2
  addRoadRect(-4, 112, 4.4, 96, 0x10b981); // Between O3 Weighbridge/Strip & P区

  // E-W Functional Trunk Corridors (Strictly Biosecure)
  // Clean Feed Road (净道): terminates cleanly at X=110 BEFORE the X=118..142 Forest Belt
  addRoadRect(-67, -56, 354, 5.2, 0x0ea5e9);
  // Dirty Manure Corridor (污道): begins cleanly at H区 (-124) running East through Forest Belt into J/K
  addRoadRect(46, 8, 340, 5.2, 0xf59e0b);
  // South Eco Boulevard: full-width Eco Spine south of Canal bridging West Blvd (-244) to East Ring (+232)
  addRoadRect(-6, 64, 476, 5.2, 0x10b981);

  // Entry & Dispatch Spurs
  addRoadRect(-240, -110, 14, 7.6, 0x10b981); // 主入口 -> A区 Plaza
  addRoadRect(-179, -98, 6, 8.0, 0x10b981); // Lakeside Drive -> N区 科创中心入口广场
  addRoadRect(-201, 108, 12, 18, 0x10b981); // M-O Service Ave -> M区 East Courtyard Apron
  addRoadRect(-9, 79, 12, 10, 0x10b981); // O区 Weighbridge/Hay Hub -> O-P Service Road X=-4
  for (const gx of [-14, -2]) {
    addRoadRect(gx, -48, 3.8, 16, 0x0ea5e9); // G TMR Bays -> Clean Road Z=-56
  }
  for (const sx of [-98, -74, -38, -14, 18, 34, 50, 78, 94, 110]) {
    addRoadRect(sx, -66, 3.6, 20, 0x0ea5e9); // Clean Feed spurs North into B/C/D/E sheds
  }
  for (const fx of [50, 68, 86]) {
    addRoadRect(fx, -47, 3.6, 18, 0x0ea5e9); // Clean Feed spurs South into F sheds
    addRoadRect(fx, 3, 3.2, 10, 0xf59e0b); // Dirty Manure spurs from F rear scrapers -> Z=+8
  }
  addRoadRect(-122, 2, 4.2, 12, 0xf59e0b); // H区 Dirty Spur -> Z=+8
  addRoadRect(-48, 2, 4.2, 12, 0xf59e0b); // G区 Service Spur -> Z=+8
  addRoadRect(162, 5, 4.4, 6, 0xf59e0b); // J区 Intake Spur -> Z=+8
  addRoadRect(216, -17, 12, 18, 0xf59e0b); // J区 East Fertilizer Apron -> X=222
  // Independent External Slaughter & Cold-Chain Enclave Access Loops & Divided Freight Highway
  addRoadRect(266, 158, 72, 5.2, 0x0ea5e9); // Desert Transfer Corridor (Main Ring X=232 <-> Enclave Receiving Loop)
  addRoadRect(296, 144, 4.6, 30, 0x0ea5e9); // Arrival Inbound Lane -> South Receiving Plaza
  addRoadRect(284, 144, 4.6, 30, 0x10b981); // Cleaned Return Outbound Lane -> Back to Ranch
  addRoadRect(290, 131, 17, 6.2, 0x0ea5e9); // Calm Pen South Unloading Loop Turnaround

  // East Cold-Chain Dock Circulation Plaza & Dual-Lane Divided Gate Throat (次入口 X=366, Z=104)
  addRoadRect(349, 110.5, 30, 28, 0x38bdf8); // Cold-Chain Loading Apron & Roundabout Ring
  addRoadRect(366, 104, 16, 14.5, 0x38bdf8); // Dual-Lane Entrance/Exit Throat through 次入口

  // Divided 2-Lane Regional Freight Highway (X = 374 Northbound, X = 382 Southbound, extending Z: -230..+240)
  addRoadRect(374, 5, 5.2, 470, 0x38bdf8); // Northbound Freight Highway Lane
  addRoadRect(382, 5, 5.2, 470, 0x0ea5e9); // Southbound Freight Highway Lane
  const medianNorth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 210), mats.wallSlate);
  medianNorth.position.set(378, 0.08, -108);
  const medianSouth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 210), mats.wallSlate);
  medianSouth.position.set(378, 0.08, 122);
  roadGroup.add(medianNorth, medianSouth);

  scene.add(roadGroup);

  // ==============================
  // 2. 6-Cycle Filterable Eco-Loop Ribbons & Glowing Beads
  // ==============================
  const flowGroup = new THREE.Group();
  const cycleGroups: Record<CycleId, THREE.Group> = {
    grass: new THREE.Group(),
    feed: new THREE.Group(),
    water: new THREE.Group(),
    manure: new THREE.Group(),
    energy: new THREE.Group(),
    digital: new THREE.Group(),
  };

  (Object.keys(cycleGroups) as CycleId[]).forEach((cid) => flowGroup.add(cycleGroups[cid]));

  const flowBeads: Array<{
    cycleId: CycleId;
    curve: THREE.CatmullRomCurve3;
    mesh: THREE.Mesh;
    speed: number;
    offset: number;
  }> = [];

  const addFlowCurve = (
    cycleId: CycleId,
    pts: Array<[number, number, number]>,
    color: number,
    beadCount: number,
    speed: number,
  ) => {
    const vectors = pts.map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.25);

    const tubeGeo = new THREE.TubeGeometry(curve, 110, 0.26, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.44 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    cycleGroups[cycleId].add(tube);

    const beadMat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < beadCount; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.76, 10, 8), beadMat);
      cycleGroups[cycleId].add(bead);
      flowBeads.push({ cycleId, curve, mesh: bead, speed, offset: i / beadCount });
    }
  };

  // Cycle 1: grass 生态草牧循环 (Q区种质/P区耐盐/O区中心支轴牧草 -> M区调度 -> 西环路 -> G区青贮及植物工厂)
  addFlowCurve(
    'grass',
    [
      [188, 1.4, 114],
      [70, 1.4, 114],
      [-20.5, 1.6, 82],
      [-72, 1.4, 112],
      [-154, 1.4, 112],
      [-196, 1.4, 108],
      [-220, 2.0, 108],
      [-196, 1.4, 64],
      [-244, 1.4, 64],
      [-244, 1.4, -56],
      [-52, 2.6, -22],
    ],
    0x10b981,
    9,
    0.048,
  );

  // Cycle 2: feed 精准饲喂及人道隔断外运闭环
  addFlowCurve(
    'feed',
    [
      [-74, 2.4, -22],
      [-38, 2.4, -22],
      [-8, 3.0, -22],
      [-8, 1.5, -56],
      [-86, 1.5, -56],
      [-86, 1.8, -100],
      [-26, 1.8, -114],
      [34, 1.8, -106],
      [94, 1.8, -96],
      [68, 1.8, -22],
    ],
    0x0ea5e9,
    8,
    0.055,
  );
  // Biosecure Detached Livestock Transfer & Cold-Chain Outbound (F -> North Loop -> Oasis East Ring -> Desert Link -> I Enclave -> 次入口)
  addFlowCurve(
    'feed',
    [
      [108, 1.5, -96],
      [108, 1.5, -142],
      [232, 1.5, -142],
      [232, 1.5, 58],
      [232, 1.5, 158],
      [300, 1.5, 158],
      [297, 1.8, 112],
      [320, 2.2, 91],
      [320, 2.2, 117],
      [372, 1.8, 104],
    ],
    0x38bdf8,
    9,
    0.052,
  );

  // Cycle 3: water 污水处理与中水回用网 (各舍废水 -> 东段污廊 -> K区澄清池 -> 泵站跨河管桥 -> Q/P/O滴灌及G工厂)
  addFlowCurve(
    'water',
    [
      [68, 1.4, 8],
      [161, 2.4, 21.5],
      [180, 2.8, 23.5],
      [197, 2.8, 39.5],
      [210, 5.4, 50.5],
      [210, 5.4, 69.5],
      [188, 2.4, 96],
      [147, 2.4, 70],
      [70, 2.4, 96],
      [-72, 2.4, 102],
      [-154, 2.4, 102],
    ],
    0x06b6d4,
    9,
    0.052,
  );

  // Cycle 4: manure 粪污资源化及有机肥还田 (F/G/H清粪 -> 污道Z=+8穿林 -> J区发酵翻抛 -> 东外门转运还田P/O)
  addFlowCurve(
    'manure',
    [
      [-122, 1.4, 8],
      [68, 1.4, 8],
      [162, 2.0, 2],
      [162, 4.2, -20],
      [197, 2.6, -18],
      [222, 1.4, -18],
      [222, 1.4, -44],
      [147, 1.4, -44],
      [147, 1.4, 64],
      [70, 1.4, 64],
      [-114, 1.4, 64],
      [-114, 1.4, 108],
    ],
    0xf59e0b,
    10,
    0.048,
  );

  // Cycle 5: energy 北脊风电 + 屋顶光伏 + J区沼气 -> L区绿电微网 -> 供能I冷链与G中央厨房
  addFlowCurve(
    'energy',
    [
      [-160, 18.0, -184],
      [0, 18.0, -188],
      [160, 18.0, -182],
      [178, 5.0, -88],
      [173, 5.5, -4.5],
      [178, 5.0, -88],
      [320, 9.0, 116],
    ],
    0xfacc15,
    8,
    0.062,
  );
  addFlowCurve(
    'energy',
    [
      [178, 5.0, -88],
      [94, 10.5, -96],
      [34, 10.5, -106],
      [-8, 9.5, -22],
      [-74, 9.5, -22],
    ],
    0xfde047,
    6,
    0.058,
  );

  // Cycle 6: digital 数字孪生协同神经网 (A区指挥中心 <-> N区4联合实验室 <-> 各群落节点)
  addFlowCurve(
    'digital',
    [
      [-198, 15.0, -110],
      [-154, 12.0, -98],
      [-86, 10.5, -100],
      [34, 11.5, -106],
      [178, 10.0, -88],
      [184, 9.5, -16],
      [320, 10.0, 104],
      [188, 8.5, 114],
      [70, 8.5, 114],
      [-114, 8.5, 112],
      [-220, 9.0, 108],
      [-198, 15.0, -110],
    ],
    0xa855f7,
    10,
    0.05,
  );

  scene.add(flowGroup);

  let flowsVisible = true;
  let activeCycleSet = new Set<CycleId>(['grass', 'feed', 'water', 'manure', 'energy', 'digital']);

  const syncCycleVisibility = () => {
    flowGroup.visible = flowsVisible;
    (Object.keys(cycleGroups) as CycleId[]).forEach((cid) => {
      cycleGroups[cid].visible = flowsVisible && activeCycleSet.has(cid);
    });
  };

  // ==============================
  const fleetRegistry: Array<{ group: THREE.Group; cargoType: VehicleCargoType }> = [];
  const spawnVehicle = (
    bodyColor: number,
    accentColor: number,
    cargoType: VehicleCargoType,
  ): THREE.Group => {
    const vehicle = buildAutonomousVehicle(bodyColor, accentColor, cargoType, mats);
    for (const child of vehicle.children) {
      child.userData.__vehPlaceholder = true;
    }
    fleetRegistry.push({ group: vehicle, cargoType });
    return vehicle;
  };

  // 3. Autonomous Fleet & Detached Biosecure Transport
  // ==============================
  const harvester1 = spawnVehicle(0x10b981, 0xfbbf24, 'harvester');
  const harvester2 = spawnVehicle(0x10b981, 0xfbbf24, 'harvester');
  const forageHauler = spawnVehicle(0xf8fafc, 0x10b981, 'bales');
  const agv1 = spawnVehicle(0x0ea5e9, 0x38bdf8, 'agv');
  const agv2 = spawnVehicle(0x0ea5e9, 0x38bdf8, 'agv');
  const manureTruck1 = spawnVehicle(0x475569, 0xf59e0b, 'tanker');
  const manureTruck2 = spawnVehicle(0x475569, 0xf59e0b, 'tanker');
  const spreader1 = spawnVehicle(0x059669, 0xd97706, 'spreader');
  const spreader2 = spawnVehicle(0x059669, 0xd97706, 'spreader');
  const livestockShuttle1 = spawnVehicle(0xf8fafc, 0x10b981, 'livestock');
  const livestockShuttle2 = spawnVehicle(0xf8fafc, 0x10b981, 'livestock');
  const reeferOutNorth = spawnVehicle(0xf8fafc, 0x0284c7, 'reefer');
  const reeferOutSouth = spawnVehicle(0xf8fafc, 0x0ea5e9, 'reefer');
  const highwaySemi1 = spawnVehicle(0xe2e8f0, 0x0284c7, 'reefer');
  const highwaySemi2 = spawnVehicle(0xf8fafc, 0x38bdf8, 'reefer');
  attachFleetLibraryModels(fleetRegistry);

  scene.add(
    harvester1,
    harvester2,
    forageHauler,
    agv1,
    agv2,
    manureTruck1,
    manureTruck2,
    spreader1,
    spreader2,
    livestockShuttle1,
    livestockShuttle2,
    reeferOutNorth,
    reeferOutSouth,
    highwaySemi1,
    highwaySemi2,
  );

  // Two Harvesters inside O区 Circular Center-Pivot Fields (-154, 112) & (-72, 112)
  const moveHarvester1 = createSegmentedTraveler(
    [
      { from: [-174, 92], to: [-134, 92] },
      { from: [-134, 92], to: [-134, 132] },
      { from: [-134, 132], to: [-174, 132] },
      { from: [-174, 132], to: [-174, 92] },
    ],
    6.4,
  );

  const moveHarvester2 = createSegmentedTraveler(
    [
      { from: [-92, 92], to: [-52, 92] },
      { from: [-52, 92], to: [-52, 132] },
      { from: [-52, 132], to: [-92, 132] },
      { from: [-92, 132], to: [-92, 92] },
    ],
    6.2,
    11,
  );

  // Forage Bale Hauler: O区 Weighbridge Station (-4, 79) -> Eco Blvd (-244, 64) -> West Blvd (-244, -56) -> Clean Road -> G区 Silage (-52, -38)
  const moveHauler = createSegmentedTraveler(
    [
      { from: [-9, 79], to: [-4, 79] },
      { from: [-4, 79], to: [-4, 64] },
      { from: [-4, 64], to: [-244, 64] },
      { from: [-244, 64], to: [-244, -56] },
      { from: [-244, -56], to: [-52, -56] },
      { from: [-52, -56], to: [-52, -38] },
      { from: [-52, -38], to: [-52, -56], reverse: true },
      { from: [-52, -56], to: [-244, -56] },
      { from: [-244, -56], to: [-244, 64] },
      { from: [-244, 64], to: [-4, 64] },
      { from: [-4, 64], to: [-4, 79] },
      { from: [-4, 79], to: [-9, 79] },
    ],
    10.8,
  );

  // AGV-1: G区 Dispatch Bay 1 (-14, -40) -> Clean Road Z=-56 -> B (-98, -74) & C (-38, -14)
  const moveAgv1 = createSegmentedTraveler(
    [
      { from: [-14, -40], to: [-14, -56] },
      { from: [-14, -56], to: [-98, -56] },
      { from: [-98, -56], to: [-98, -76] },
      { from: [-98, -76], to: [-98, -56], reverse: true },
      { from: [-98, -56], to: [-38, -56] },
      { from: [-38, -56], to: [-38, -76] },
      { from: [-38, -76], to: [-38, -56], reverse: true },
      { from: [-38, -56], to: [-14, -56] },
      { from: [-14, -56], to: [-14, -76] },
      { from: [-14, -76], to: [-14, -56], reverse: true },
      { from: [-14, -56], to: [-14, -40] },
    ],
    10.2,
  );

  // AGV-2: G区 Dispatch Bay 2 (-2, -40) -> Clean Road Z=-56 -> D (34) & E (94) & F (68)
  const moveAgv2 = createSegmentedTraveler(
    [
      { from: [-2, -40], to: [-2, -56] },
      { from: [-2, -56], to: [34, -56] },
      { from: [34, -56], to: [34, -76] },
      { from: [34, -76], to: [34, -56], reverse: true },
      { from: [34, -56], to: [94, -56] },
      { from: [94, -56], to: [94, -74] },
      { from: [94, -74], to: [94, -56], reverse: true },
      { from: [94, -56], to: [68, -56] },
      { from: [68, -56], to: [68, -38] },
      { from: [68, -38], to: [68, -56], reverse: true },
      { from: [68, -56], to: [-2, -56] },
      { from: [-2, -56], to: [-2, -40] },
    ],
    10.4,
    7,
  );

  // Two Manure Tankers strictly along Dirty Road Z=+8 through Forest Gap -> East J区 Intake (162, +3)
  const moveManure1 = createSegmentedTraveler(
    [
      { from: [68, 8], to: [162, 8] },
      { from: [162, 8], to: [162, 3] },
      { from: [162, 3], to: [162, 8], reverse: true },
      { from: [162, 8], to: [68, 8] },
    ],
    8.8,
  );

  const moveManure2 = createSegmentedTraveler(
    [
      { from: [-122, 8], to: [50, 8] },
      { from: [50, 8], to: [162, 8] },
      { from: [162, 8], to: [162, 3] },
      { from: [162, 3], to: [162, 8], reverse: true },
      { from: [162, 8], to: [-122, 8] },
    ],
    9.4,
    12,
  );

  // Two Organic Fertilizer Spreaders: J区 East Dispatch (222, -18) -> North Link (-44) -> Bridge (147, 53) -> P/Q Spine (147, 118) & Eco Blvd (64) -> O
  const moveSpreader1 = createSegmentedTraveler(
    [
      { from: [222, -18], to: [222, -44] },
      { from: [222, -44], to: [147, -44] },
      { from: [147, -44], to: [147, 118] },
      { from: [147, 118], to: [147, -44], reverse: true },
      { from: [147, -44], to: [222, -44] },
      { from: [222, -44], to: [222, -18] },
    ],
    10.8,
  );

  const moveSpreader2 = createSegmentedTraveler(
    [
      { from: [222, -12], to: [222, -44] },
      { from: [222, -44], to: [147, -44] },
      { from: [147, -44], to: [147, 64] },
      { from: [147, 64], to: [-114, 64] },
      { from: [-114, 64], to: [-114, 130] },
      { from: [-114, 130], to: [-114, 64], reverse: true },
      { from: [-114, 64], to: [147, 64] },
      { from: [147, 64], to: [147, -44] },
      { from: [147, -44], to: [222, -44] },
      { from: [222, -44], to: [222, -12] },
    ],
    11.4,
    14,
  );

  // Two Continuous Forward Livestock Shuttles: Ranch E/F -> Oasis East Ring -> Desert Bridge -> I区 Calm South Unloading -> Washed Return
  const livestockRouteSegments: Segment[] = [
    { from: [108, -76], to: [108, -142] },
    { from: [108, -142], to: [233.5, -142] },
    { from: [233.5, -142], to: [233.5, 156] },
    { from: [233.5, 156], to: [296, 156] },
    { from: [296, 156], to: [296, 131] },
    { from: [296, 131], to: [284, 131] },
    { from: [284, 131], to: [284, 160] },
    { from: [284, 160], to: [230.5, 160] },
    { from: [230.5, 160], to: [230.5, -142] },
    { from: [230.5, -142], to: [108, -142] },
    { from: [108, -142], to: [108, -76] },
  ];
  const moveLivestock1 = createSegmentedTraveler(livestockRouteSegments, 15.0, 2);
  const moveLivestock2 = createSegmentedTraveler(livestockRouteSegments, 15.0, 36);

  // Cold-Chain Truck 1: Enters from South Highway (374, +225) -> Inbound Gate (99.2) -> Roundabout -> Dock 2 (344, 120.2) -> Exits Outbound Gate (108.8) -> Drives AWAY Northbound
  const moveReeferOutNorth = createSegmentedTraveler(
    [
      { from: [374, 225], to: [374, 99.2] },
      { from: [374, 99.2], to: [354, 99.2] },
      { from: [354, 99.2], to: [345, 104] },
      { from: [345, 104], to: [344, 120.2] },
      { from: [344, 120.2], to: [355, 120.2] },
      { from: [355, 120.2], to: [358, 108.8] },
      { from: [358, 108.8], to: [374, 108.8] },
      { from: [374, 108.8], to: [374, -220] },
      { from: [374, -220], to: [382, -220] },
      { from: [382, -220], to: [382, 225] },
      { from: [382, 225], to: [374, 225] },
    ],
    14.5,
    4,
  );

  // Cold-Chain Truck 2: Enters from North Highway (382, -220) -> Inbound Gate (99.2) -> Roundabout -> Dock 2 -> Exits Outbound Gate (108.8) -> Drives AWAY Southbound
  const moveReeferOutSouth = createSegmentedTraveler(
    [
      { from: [382, -220], to: [382, 99.2] },
      { from: [382, 99.2], to: [354, 99.2] },
      { from: [354, 99.2], to: [345, 104] },
      { from: [345, 104], to: [344, 120.2] },
      { from: [344, 120.2], to: [355, 120.2] },
      { from: [355, 120.2], to: [358, 108.8] },
      { from: [358, 108.8], to: [382, 108.8] },
      { from: [382, 108.8], to: [382, 225] },
      { from: [382, 225], to: [374, 225] },
      { from: [374, 225], to: [374, -220] },
      { from: [374, -220], to: [382, -220] },
    ],
    14.2,
    34,
  );

  // Continuous Regional Through-Traffic Semis glided along Divided Highway X=374 & X=382
  const highwayLoopSegments: Segment[] = [
    { from: [374, 225], to: [374, -220] },
    { from: [374, -220], to: [382, -220] },
    { from: [382, -220], to: [382, 225] },
    { from: [382, 225], to: [374, 225] },
  ];
  const moveHighwaySemi1 = createSegmentedTraveler(highwayLoopSegments, 21.0, 0);
  const moveHighwaySemi2 = createSegmentedTraveler(highwayLoopSegments, 19.5, 22);

  return {
    setFlowsVisible(visible: boolean) {
      flowsVisible = visible;
      syncCycleVisibility();
    },
    setCycleFilter(activeCycles: Set<CycleId>) {
      activeCycleSet = new Set(activeCycles);
      syncCycleVisibility();
    },
    update(elapsed: number) {
      moveHarvester1(elapsed, harvester1);
      moveHarvester2(elapsed, harvester2);
      moveHauler(elapsed, forageHauler);
      moveAgv1(elapsed, agv1);
      moveAgv2(elapsed, agv2);
      moveManure1(elapsed, manureTruck1);
      moveManure2(elapsed, manureTruck2);
      moveSpreader1(elapsed, spreader1);
      moveSpreader2(elapsed, spreader2);
      moveLivestock1(elapsed, livestockShuttle1);
      moveLivestock2(elapsed, livestockShuttle2);
      moveReeferOutNorth(elapsed, reeferOutNorth);
      moveReeferOutSouth(elapsed, reeferOutSouth);
      moveHighwaySemi1(elapsed, highwaySemi1);
      moveHighwaySemi2(elapsed, highwaySemi2);

      if (flowGroup.visible) {
        for (const b of flowBeads) {
          if (!activeCycleSet.has(b.cycleId)) continue;
          const t = (elapsed * b.speed + b.offset) % 1;
          b.curve.getPointAt(t, b.mesh.position);
        }
      }
    },
  };
}
