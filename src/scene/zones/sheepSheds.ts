import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SharedMaterials, tagStepInteractive } from '../materials';
import { AnimatedZone } from './feedProcessing';

export interface SheepShedController extends AnimatedZone {
  setRoofCutaway: (cutaway: boolean) => void;
}

export type SheepBreed = 'dorper' | 'suffolk' | 'karakul';

export interface SheepLegs {
  fl: THREE.Object3D | null;
  fr: THREE.Object3D | null;
  bl: THREE.Object3D | null;
  br: THREE.Object3D | null;
}

export interface SheepInstanceRig {
  group: THREE.Group;
  head: THREE.Group;
  legs: SheepLegs;
  bodyParts: THREE.Object3D[];
}

interface SheepObstacle {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

interface AnimatedSheep {
  rig: SheepInstanceRig;
  groupId: number;
  baseY: number;
  x: number;
  z: number;
  yaw: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  obstacles: SheepObstacle[];
  targetX: number;
  targetZ: number;
  state: 'walk' | 'graze' | 'look';
  stateTimer: number;
  walkSpeed: number;
  stridePhase: number;
  strideAmount: number;
  headPitch: number;
  headYaw: number;
  phase: number;
  rngState: number;
}

interface ShedTemplateKit {
  breedCenter: THREE.Object3D | null;
  shedBay: THREE.Object3D | null;
  shedEndClean: THREE.Object3D | null;
  shedEndDirty: THREE.Object3D | null;
  hvlsFan: THREE.Object3D | null;
  railBot: THREE.Object3D | null;
  yardWaterer: THREE.Object3D | null;
  yardFeeder: THREE.Object3D | null;
  sheepTemplates: Partial<Record<SheepBreed, THREE.Object3D>>;
}

const sheepShared = {
  woolWhite: new THREE.MeshStandardMaterial({ color: 0xf7f4eb, roughness: 0.92 }),
  woolKarakul: new THREE.MeshStandardMaterial({ color: 0x362d28, roughness: 0.94 }),
  faceBlack: new THREE.MeshStandardMaterial({ color: 0x24201e, roughness: 0.85 }),
  legCream: new THREE.MeshStandardMaterial({ color: 0xe6decb, roughness: 0.88 }),
  torsoGeo: new THREE.SphereGeometry(0.42, 8, 7),
  rumpGeo: new THREE.SphereGeometry(0.35, 7, 6),
  chestGeo: new THREE.SphereGeometry(0.34, 7, 6),
  legGeo: new THREE.CylinderGeometry(0.05, 0.04, 0.36, 5),
  skullGeo: new THREE.SphereGeometry(0.2, 7, 6),
  capGeo: new THREE.SphereGeometry(0.16, 6, 5),
  earGeo: new THREE.BoxGeometry(0.16, 0.06, 0.08),
};

const pendingSheepUpgrade: Array<{ rig: SheepInstanceRig; breed: SheepBreed }> = [];
let loadedKit: ShedTemplateKit | null = null;
const kitWaiters: Array<(kit: ShedTemplateKit) => void> = [];
let kitRequested = false;

function prepareGlbMaterials(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
    if (!mat) return;
    const isGlass = mat.transparent || mat.opacity < 0.99;
    if (isGlass) {
      mat.depthWrite = false;
      node.castShadow = false;
    } else {
      node.castShadow = true;
    }
    node.receiveShadow = true;
  });
}

function requestSheepShedKit(callback: (kit: ShedTemplateKit) => void): void {
  if (loadedKit) {
    callback(loadedKit);
    return;
  }
  kitWaiters.push(callback);
  if (kitRequested) return;
  kitRequested = true;

  const loader = new GLTFLoader();
  loader.load(
    './models/sheep_sheds.glb',
    (gltf) => {
      const root = gltf.scene;
      prepareGlbMaterials(root);

      const kit: ShedTemplateKit = {
        breedCenter: root.getObjectByName('B_BreedCenter') ?? null,
        shedBay: root.getObjectByName('Shed_Bay') ?? null,
        shedEndClean: root.getObjectByName('Shed_End_Clean') ?? null,
        shedEndDirty: root.getObjectByName('Shed_End_Dirty') ?? null,
        hvlsFan: root.getObjectByName('Shed_HVLS_Fan') ?? null,
        railBot: root.getObjectByName('Shed_Rail_Bot') ?? null,
        yardWaterer: root.getObjectByName('Yard_Waterer') ?? null,
        yardFeeder: root.getObjectByName('Yard_Feeder') ?? null,
        sheepTemplates: {
          dorper: root.getObjectByName('Template_Sheep_Dorper') ?? undefined,
          suffolk: root.getObjectByName('Template_Sheep_Suffolk') ?? undefined,
          karakul: root.getObjectByName('Template_Sheep_Karakul') ?? undefined,
        },
      };
      loadedKit = kit;

      for (const entry of pendingSheepUpgrade.splice(0, pendingSheepUpgrade.length)) {
        applyBlenderSheepToInstance(entry.rig, entry.breed, kit);
      }
      for (const cb of kitWaiters.splice(0, kitWaiters.length)) {
        cb(kit);
      }
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender sheep_sheds.glb:', err);
    },
  );
}

function applyBlenderSheepToInstance(
  rig: SheepInstanceRig,
  breed: SheepBreed,
  kit: ShedTemplateKit,
): void {
  const tpl = kit.sheepTemplates[breed];
  if (!tpl) return;

  for (const ch of [...rig.group.children]) {
    if (ch.userData.__sheepPlaceholder) rig.group.remove(ch);
  }
  for (const ch of [...rig.head.children]) {
    if (ch.userData.__sheepPlaceholder) rig.head.remove(ch);
  }
  rig.bodyParts.length = 0;
  rig.legs.fl = null;
  rig.legs.fr = null;
  rig.legs.bl = null;
  rig.legs.br = null;

  for (const child of tpl.children) {
    if (child.name.startsWith('Head_')) {
      rig.head.position.copy(child.position);
      for (const hc of child.children) {
        const hcClone = hc.clone();
        hcClone.traverse((n) => {
          if (n instanceof THREE.Mesh) {
            n.castShadow = true;
            n.receiveShadow = true;
          }
        });
        rig.head.add(hcClone);
      }
    } else {
      const partClone = child.clone();
      partClone.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      rig.group.add(partClone);

      if (child.name.startsWith('Leg_FL')) rig.legs.fl = partClone;
      else if (child.name.startsWith('Leg_FR')) rig.legs.fr = partClone;
      else if (child.name.startsWith('Leg_BL')) rig.legs.bl = partClone;
      else if (child.name.startsWith('Leg_BR')) rig.legs.br = partClone;
      else rig.bodyParts.push(partClone);
    }
  }
}

export function applySheepWalkGait(
  rig: SheepInstanceRig,
  stridePhase: number,
  strideAmount: number,
  headPitch: number,
  headYaw: number,
  baseY: number,
): void {
  const amp = Math.max(0, Math.min(1, strideAmount));
  const swingMax = 0.42 * amp;

  // Natural quadruped diagonal gait with mild hind-leg phase lead
  const frontSwing = Math.sin(stridePhase) * swingMax;
  const hindSwing = Math.sin(stridePhase - 0.38) * swingMax;

  if (rig.legs.fl) rig.legs.fl.rotation.x = frontSwing;
  if (rig.legs.fr) rig.legs.fr.rotation.x = -frontSwing;
  if (rig.legs.br) rig.legs.br.rotation.x = hindSwing;
  if (rig.legs.bl) rig.legs.bl.rotation.x = -hindSwing;

  rig.group.position.y = baseY + Math.abs(Math.sin(stridePhase)) * 0.022 * amp;
  const roll = Math.sin(stridePhase) * 0.028 * amp;
  const pitch = Math.cos(stridePhase * 2) * 0.016 * amp;
  for (const bp of rig.bodyParts) {
    bp.rotation.z = roll;
    bp.rotation.x = pitch;
  }

  rig.head.rotation.x = headPitch;
  rig.head.rotation.y = headYaw;
}

export function createSheepMesh(
  breed: SheepBreed = 'dorper',
  isLamb = false,
): SheepInstanceRig {
  const group = new THREE.Group();
  const head = new THREE.Group();
  group.add(head);

  const rig: SheepInstanceRig = {
    group,
    head,
    legs: { fl: null, fr: null, bl: null, br: null },
    bodyParts: [],
  };

  if (loadedKit) {
    applyBlenderSheepToInstance(rig, breed, loadedKit);
  } else {
    const bodyMat = breed === 'karakul' ? sheepShared.woolKarakul : sheepShared.woolWhite;
    const legMat = breed === 'dorper' ? sheepShared.legCream : sheepShared.faceBlack;
    const headMat = sheepShared.faceBlack;

    const torso = new THREE.Mesh(sheepShared.torsoGeo, bodyMat);
    torso.scale.set(1.0, 0.9, 1.38);
    torso.position.set(0, 0.52, 0);
    torso.castShadow = true;
    torso.userData.__sheepPlaceholder = true;

    const rump = new THREE.Mesh(sheepShared.rumpGeo, bodyMat);
    rump.position.set(0, 0.54, -0.32);
    rump.userData.__sheepPlaceholder = true;

    const chest = new THREE.Mesh(sheepShared.chestGeo, bodyMat);
    chest.position.set(0, 0.54, 0.3);
    chest.userData.__sheepPlaceholder = true;

    rig.bodyParts.push(torso, rump, chest);

    const legSlots: Array<{ key: keyof SheepLegs; lx: number; lz: number }> = [
      { key: 'fl', lx: 0.17, lz: 0.28 },
      { key: 'fr', lx: -0.17, lz: 0.28 },
      { key: 'bl', lx: 0.17, lz: -0.28 },
      { key: 'br', lx: -0.17, lz: -0.28 },
    ];
    for (const slot of legSlots) {
      const legPivot = new THREE.Group();
      legPivot.position.set(slot.lx, 0.36, slot.lz);
      legPivot.userData.__sheepPlaceholder = true;
      const legMesh = new THREE.Mesh(sheepShared.legGeo, legMat);
      legMesh.position.set(0, -0.18, 0);
      legMesh.castShadow = true;
      legPivot.add(legMesh);
      group.add(legPivot);
      rig.legs[slot.key] = legPivot;
    }

    head.position.set(0, 0.68, 0.56);
    const skull = new THREE.Mesh(sheepShared.skullGeo, headMat);
    skull.scale.set(0.85, 0.9, 1.25);
    skull.userData.__sheepPlaceholder = true;
    const woolCap = new THREE.Mesh(sheepShared.capGeo, bodyMat);
    woolCap.position.set(0, 0.11, -0.04);
    woolCap.userData.__sheepPlaceholder = true;

    const earL = new THREE.Mesh(sheepShared.earGeo, headMat);
    earL.position.set(-0.18, 0.04, -0.02);
    earL.rotation.z = 0.4;
    earL.userData.__sheepPlaceholder = true;
    const earR = new THREE.Mesh(sheepShared.earGeo, headMat);
    earR.position.set(0.18, 0.04, -0.02);
    earR.rotation.z = -0.4;
    earR.userData.__sheepPlaceholder = true;

    head.add(skull, woolCap, earL, earR);
    group.add(torso, rump, chest);
    pendingSheepUpgrade.push({ rig, breed });
  }

  if (isLamb) {
    group.scale.setScalar(0.72);
  }
  return rig;
}

export function createSheepShedsAndInbound(
  scene: THREE.Scene,
  mats: SharedMaterials,
): SheepShedController {
  const sheepList: AnimatedSheep[] = [];
  const railBots: Array<{ mesh: THREE.Object3D; spanZ: number; baseZ: number; phase: number }> = [];
  const hvlsFans: Array<{ obj: THREE.Object3D; phase: number }> = [];
  let prevElapsed = -1;
  let nextSheepGroupId = 1;
  const sheepByGroup = new Map<number, AnimatedSheep[]>();

  function nextSheepRand(s: AnimatedSheep): number {
    s.rngState = (s.rngState * 1664525 + 1013904223) >>> 0;
    return s.rngState / 4294967296;
  }

  function isBlockedByObstacles(x: number, z: number, obstacles: SheepObstacle[], pad = 0): boolean {
    for (const obs of obstacles) {
      if (Math.abs(x - obs.x) < obs.hx + pad && Math.abs(z - obs.z) < obs.hz + pad) return true;
    }
    return false;
  }

  function pickSheepTarget(s: AnimatedSheep): void {
    // Occasionally walk directly up beside a waterer or hay feeder rim
    if (s.obstacles.length > 0 && nextSheepRand(s) < 0.22) {
      const obs = s.obstacles[Math.floor(nextSheepRand(s) * s.obstacles.length)];
      const side = nextSheepRand(s) < 0.5 ? -1 : 1;
      const onX = nextSheepRand(s) < 0.65;
      const tx = onX
        ? THREE.MathUtils.clamp(obs.x + side * (obs.hx + 0.42), s.minX, s.maxX)
        : THREE.MathUtils.clamp(obs.x + (nextSheepRand(s) * 2 - 1) * obs.hx, s.minX, s.maxX);
      const tz = onX
        ? THREE.MathUtils.clamp(obs.z + (nextSheepRand(s) * 2 - 1) * obs.hz, s.minZ, s.maxZ)
        : THREE.MathUtils.clamp(obs.z + side * (obs.hz + 0.42), s.minZ, s.maxZ);
      if (!isBlockedByObstacles(tx, tz, s.obstacles, 0.08)) {
        s.targetX = tx;
        s.targetZ = tz;
        return;
      }
    }

    for (let tries = 0; tries < 12; tries++) {
      const tx = s.minX + nextSheepRand(s) * Math.max(0.2, s.maxX - s.minX);
      const tz = s.minZ + nextSheepRand(s) * Math.max(0.2, s.maxZ - s.minZ);
      if (isBlockedByObstacles(tx, tz, s.obstacles, 0.16)) continue;
      if (Math.hypot(tx - s.x, tz - s.z) >= 1.1 || tries === 11) {
        s.targetX = tx;
        s.targetZ = tz;
        return;
      }
    }
    s.targetX = s.x;
    s.targetZ = s.z;
  }

  function registerAnimatedSheep(
    parent: THREE.Group,
    breed: SheepBreed,
    isLamb: boolean,
    x: number,
    baseY: number,
    z: number,
    groupId: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    obstacles: SheepObstacle[],
    seed: number,
    maxSpeed = 0.92,
  ): void {
    const rig = createSheepMesh(breed, isLamb);
    let safeX = THREE.MathUtils.clamp(x, minX, maxX);
    let safeZ = THREE.MathUtils.clamp(z, minZ, maxZ);
    if (isBlockedByObstacles(safeX, safeZ, obstacles, 0.12)) {
      const obs = obstacles[0];
      safeX = safeX <= obs.x ? minX : maxX;
    }

    const rngInit = ((seed * 2654435761) >>> 0) || 1337;
    const yaw = (rngInit % 628) / 100;
    rig.group.position.set(safeX, baseY, safeZ);
    rig.group.rotation.y = yaw;
    parent.add(rig.group);

    const startMod = rngInit % 10;
    const startState: AnimatedSheep['state'] = startMod < 6 ? 'walk' : startMod < 9 ? 'graze' : 'look';
    const sheep: AnimatedSheep = {
      rig,
      groupId,
      baseY,
      x: safeX,
      z: safeZ,
      yaw,
      minX,
      maxX,
      minZ,
      maxZ,
      obstacles,
      targetX: safeX,
      targetZ: safeZ,
      state: startState,
      stateTimer: 1.5 + ((rngInit >>> 4) % 42) * 0.1,
      walkSpeed: (isLamb ? 0.8 : 1.0) * (maxSpeed * (0.78 + ((rngInit >>> 8) % 28) * 0.01)),
      stridePhase: (rngInit % 628) / 100,
      strideAmount: startState === 'walk' ? 0.85 : 0,
      headPitch: startState === 'graze' ? 0.44 : startState === 'look' ? -0.1 : 0.04,
      headYaw: 0,
      phase: (seed * 1.73) % (Math.PI * 2),
      rngState: rngInit,
    };
    pickSheepTarget(sheep);
    if (startState === 'walk') {
      const dx = sheep.targetX - sheep.x;
      const dz = sheep.targetZ - sheep.z;
      if (Math.hypot(dx, dz) > 0.05) {
        sheep.yaw = Math.atan2(dx, dz);
        rig.group.rotation.y = sheep.yaw;
      }
    }
    sheepList.push(sheep);
    let peers = sheepByGroup.get(groupId);
    if (!peers) {
      peers = [];
      sheepByGroup.set(groupId, peers);
    }
    peers.push(sheep);
  }

  interface ShedSpec {
    group: THREE.Group;
    placeholder: THREE.Group;
    lengthZ: number;
    rotateCleanToNorth: boolean;
    seedIdx: number;
  }
  const shedSpecs: ShedSpec[] = [];

  interface YardPropSlot {
    yard: THREE.Group;
    placeholderWater: THREE.Mesh;
    addFeeder: boolean;
  }
  const yardPropSlots: YardPropSlot[] = [];

  const yardPastureMat = new THREE.MeshStandardMaterial({ color: 0x7ea664, roughness: 0.94 });

  // Shared Cutaway tracking across all cloned roofs/solar/breed-center cap (only ~3 cloned materials total!)
  interface CutawaySlot {
    mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
    origTransparent: boolean;
    origOpacity: number;
    origDepthWrite: boolean;
    meshes: THREE.Mesh[];
  }
  const cutawaySlots: CutawaySlot[] = [];
  const clonedCutawayMap = new Map<THREE.Material, CutawaySlot>();

  function registerCutawayHierarchy(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.name.startsWith('Sheep_Cutaway_')) return;
      const origMat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      if (!origMat) return;
      let slot = clonedCutawayMap.get(origMat);
      if (!slot) {
        const cloned = origMat.clone();
        slot = {
          mat: cloned,
          origTransparent: cloned.transparent,
          origOpacity: cloned.opacity,
          origDepthWrite: cloned.depthWrite,
          meshes: [],
        };
        clonedCutawayMap.set(origMat, slot);
        cutawaySlots.push(slot);
      }
      node.material = slot.mat;
      slot.meshes.push(node);
    });
  }

  let currentCutawayOpacity = 1.0;
  let targetRoofOpacity = 1.0;

  function syncCutawayMaterials(): void {
    const isCut = currentCutawayOpacity < 0.985;
    for (const slot of cutawaySlots) {
      slot.mat.transparent = isCut ? true : slot.origTransparent;
      slot.mat.opacity = isCut ? currentCutawayOpacity * slot.origOpacity : slot.origOpacity;
      slot.mat.depthWrite = currentCutawayOpacity > 0.72 ? slot.origDepthWrite : false;
      for (const m of slot.meshes) {
        m.castShadow = !isCut && slot.origOpacity >= 0.99;
      }
    }
  }

  const buildShed = (
    parent: THREE.Group,
    cx: number,
    cz: number,
    lengthZ: number,
    breed: SheepBreed,
    isLambShed: boolean,
    sheepCount: number,
    seedIdx: number,
    rotateCleanToNorth = false,
  ) => {
    const shed = new THREE.Group();
    shed.position.set(cx, 0, cz);
    if (rotateCleanToNorth) {
      shed.rotation.y = Math.PI;
    }

    // Minimal plinth placeholder until sheep_sheds.glb resolves (~200ms)
    const placeholder = new THREE.Group();
    const basePad = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.14, lengthZ + 1.2), mats.concreteLight);
    basePad.position.y = 0.07;
    basePad.receiveShadow = true;
    const tempShell = new THREE.Mesh(new THREE.BoxGeometry(10.4, 4.4, lengthZ), mats.wallWhite);
    tempShell.position.y = 2.3;
    placeholder.add(basePad, tempShell);
    shed.add(placeholder);

    shedSpecs.push({
      group: shed,
      placeholder,
      lengthZ,
      rotateCleanToNorth,
      seedIdx,
    });

    // Populate walking/feeding sheep inside both elevated pen sides (floor surface Y=0.72m, clear of central troughs)
    const westPenId = nextSheepGroupId++;
    const eastPenId = nextSheepGroupId++;
    for (let s = 0; s < sheepCount; s++) {
      const isWest = s % 2 === 0;
      const penCenterX = cx + (isWest ? -3.7 : 3.7);
      const zOff = cz - lengthZ / 2 + 3.2 + (s / Math.max(1, sheepCount - 1)) * (lengthZ - 6.4);
      registerAnimatedSheep(
        parent,
        breed,
        isLambShed,
        penCenterX + ((s % 4) < 2 ? -0.32 : 0.32),
        0.72,
        zOff,
        isWest ? westPenId : eastPenId,
        penCenterX - 0.68,
        penCenterX + 0.68,
        cz - lengthZ / 2 + 2.2,
        cz + lengthZ / 2 - 2.2,
        [],
        seedIdx * 100 + s + 11,
        0.76,
      );
    }

    parent.add(shed);
  };

  const buildYard = (
    parent: THREE.Group,
    yx: number,
    yz: number,
    widthX: number,
    lengthZ: number,
    breed: SheepBreed,
    isLambYard: boolean,
    sheepCount: number,
    seedIdx: number,
  ) => {
    const yard = new THREE.Group();
    yard.position.set(yx, 0.08, yz);
    const turf = new THREE.Mesh(new THREE.BoxGeometry(widthX, 0.08, lengthZ), yardPastureMat);
    turf.receiveShadow = true;
    yard.add(turf);

    // Timber double-rail fences + chamfered fence posts along perimeter
    for (const fz of [-lengthZ / 2, lengthZ / 2]) {
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(widthX + 0.2, 0.12, 0.12), mats.woodFence);
      r1.position.set(0, 1.0, fz);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(widthX + 0.2, 0.1, 0.1), mats.woodFence);
      r2.position.set(0, 0.55, fz);
      yard.add(r1, r2);
    }
    for (const fx of [-widthX / 2, widthX / 2]) {
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, lengthZ), mats.woodFence);
      r1.position.set(fx, 1.0, 0);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, lengthZ), mats.woodFence);
      r2.position.set(fx, 0.55, 0);
      yard.add(r1, r2);

      const postCount = Math.max(3, Math.round(lengthZ / 5) + 1);
      for (let pi = 0; pi < postCount; pi++) {
        const pz = -lengthZ / 2 + (pi / (postCount - 1)) * lengthZ;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.18, 0.16), mats.woodFence);
        post.position.set(fx, 0.56, pz);
        post.castShadow = true;
        yard.add(post);
      }
    }

    const waterBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 3.2), mats.pipeTeal);
    waterBox.position.set(0, 0.28, 0);
    yard.add(waterBox);

    const addFeeder = widthX >= 9.5;
    yardPropSlots.push({
      yard,
      placeholderWater: waterBox,
      addFeeder,
    });

    const yardGroupId = nextSheepGroupId++;
    const yardObstacles: SheepObstacle[] = addFeeder
      ? [
          { x: yx, z: yz - 3.4, hx: 0.95, hz: 2.05 },
          { x: yx, z: yz + 3.6, hx: 1.4, hz: 1.4 },
        ]
      : [{ x: yx, z: yz, hx: 0.95, hz: 2.05 }];
    const marginX = widthX >= 9.5 ? 1.1 : 1.0;

    for (let s = 0; s < sheepCount; s++) {
      const sz = yz - lengthZ / 2 + 3.5 + (s / Math.max(1, sheepCount - 1)) * (lengthZ - 7);
      const sx = yx + (s % 2 === 0 ? -1.6 : 1.6);
      registerAnimatedSheep(
        parent,
        breed,
        isLambYard,
        sx,
        0.12,
        sz,
        yardGroupId,
        yx - widthX / 2 + marginX,
        yx + widthX / 2 - marginX,
        yz - lengthZ / 2 + 1.4,
        yz + lengthZ / 2 - 1.4,
        yardObstacles,
        seedIdx * 100 + s + 53,
        0.95,
      );
    }
    parent.add(yard);
  };

  // ==============================
  // PART A: B–F区 良种繁育与标准化羊舍生态组团 (Blender 模块化 PBR GLB + 屋面剖切 + 3品种精雕绵羊)
  // ==============================
  const farmingGroup = new THREE.Group();

  // --- B区: 核心育种与种公羊中心 (North-West Quiet Sanctuary: center -86, 0, -124) ---
  const breedCenterMount = new THREE.Group();
  breedCenterMount.position.set(-86, 0, -124);
  const breedLabPad = new THREE.Mesh(new THREE.BoxGeometry(36, 0.14, 15), mats.concreteLight);
  breedLabPad.position.set(0, 0.07, 0);
  breedLabPad.receiveShadow = true;
  const breedLabTemp = new THREE.Mesh(new THREE.BoxGeometry(32, 4.6, 11), mats.wallWhite);
  breedLabTemp.position.set(0, 2.4, 0);
  breedCenterMount.add(breedLabPad, breedLabTemp);
  farmingGroup.add(breedCenterMount);

  buildShed(farmingGroup, -98, -100, 24, 'dorper', false, 6, 1);
  buildShed(farmingGroup, -74, -100, 24, 'karakul', false, 6, 2);
  buildYard(farmingGroup, -86, -100, 10.0, 22, 'suffolk', false, 6, 3);

  // --- C区: 后备母羊与扩繁区 (center -26, -114) ---
  buildShed(farmingGroup, -38, -114, 38, 'dorper', false, 8, 4);
  buildShed(farmingGroup, -14, -114, 38, 'suffolk', false, 8, 5);
  buildYard(farmingGroup, -26, -114, 10.4, 34, 'dorper', false, 7, 6);

  // --- D区: 母羊妊娠与产羔区 (staggered South-Center: center 34, -106) ---
  buildShed(farmingGroup, 18, -106, 38, 'dorper', false, 8, 7);
  buildShed(farmingGroup, 34, -106, 38, 'karakul', false, 8, 8);
  buildShed(farmingGroup, 50, -106, 38, 'suffolk', false, 8, 9);
  buildYard(farmingGroup, 26, -106, 4.8, 32, 'dorper', false, 5, 10);
  buildYard(farmingGroup, 42, -106, 4.8, 32, 'karakul', false, 5, 11);

  // --- E区: 羔羊保育与育成区 (staggered East arc: center 94, -96) ---
  buildShed(farmingGroup, 78, -96, 36, 'dorper', true, 8, 12);
  buildShed(farmingGroup, 94, -96, 36, 'suffolk', true, 8, 13);
  buildShed(farmingGroup, 110, -96, 36, 'karakul', true, 8, 14);
  buildYard(farmingGroup, 86, -96, 4.8, 30, 'dorper', true, 5, 15);
  buildYard(farmingGroup, 102, -96, 4.8, 30, 'suffolk', true, 5, 16);

  // --- F区: 商品羊育肥生态园区 (Clean Feed North at Z=-38 -> rotateCleanToNorth=true, Dirty Scrapers South at Z=-6) ---
  buildShed(farmingGroup, 50, -22, 32, 'dorper', false, 8, 17, true);
  buildShed(farmingGroup, 68, -22, 32, 'suffolk', false, 8, 18, true);
  buildShed(farmingGroup, 86, -22, 32, 'karakul', false, 8, 19, true);
  buildYard(farmingGroup, 36, -22, 12.0, 30, 'dorper', false, 7, 20);
  buildYard(farmingGroup, 59, -22, 5.2, 28, 'suffolk', false, 5, 21);
  buildYard(farmingGroup, 77, -22, 5.2, 28, 'karakul', false, 5, 22);
  buildYard(farmingGroup, 100, -22, 12.0, 30, 'suffolk', false, 7, 23);

  // Populate Blender modular architectural kit when sheep_sheds.glb loads
  requestSheepShedKit((kit) => {
    // 1. Mount B_BreedCenter
    if (kit.breedCenter) {
      for (const ch of [...breedCenterMount.children]) {
        if (ch instanceof THREE.Mesh) ch.geometry.dispose();
        breedCenterMount.remove(ch);
      }
      const centerClone = kit.breedCenter.clone();
      centerClone.position.set(0, 0, 0);
      registerCutawayHierarchy(centerClone);
      breedCenterMount.add(centerClone);
    }

    // 2. Assemble all 13 modular Sheds (24/32/36/38m)
    for (const spec of shedSpecs) {
      spec.group.remove(spec.placeholder);
      spec.placeholder.traverse((n) => {
        if (n instanceof THREE.Mesh) n.geometry.dispose();
      });

      const bayCount = spec.lengthZ <= 25 ? 4 : spec.lengthZ <= 33 ? 5 : 6;
      const bayScaleZ = spec.lengthZ / (bayCount * 6.0);
      const bayLen = spec.lengthZ / bayCount;

      if (kit.shedBay) {
        for (let bi = 0; bi < bayCount; bi++) {
          const bayClone = kit.shedBay.clone();
          bayClone.position.set(0, 0, -spec.lengthZ * 0.5 + (bi + 0.5) * bayLen);
          bayClone.scale.set(1, 1, bayScaleZ);
          registerCutawayHierarchy(bayClone);
          spec.group.add(bayClone);
        }
      }
      if (kit.shedEndClean) {
        const endC = kit.shedEndClean.clone();
        endC.position.set(0, 0, spec.lengthZ * 0.5);
        spec.group.add(endC);
      }
      if (kit.shedEndDirty) {
        const endD = kit.shedEndDirty.clone();
        endD.position.set(0, 0, -spec.lengthZ * 0.5);
        spec.group.add(endD);
      }
      if (kit.hvlsFan) {
        const fanCount = spec.lengthZ <= 26 ? 2 : 3;
        for (let fi = 0; fi < fanCount; fi++) {
          const fz = -((fanCount - 1) * (spec.lengthZ * 0.34)) / 2 + fi * (spec.lengthZ * 0.34);
          const fan = kit.hvlsFan.clone();
          fan.position.set(0, 4.18, fz);
          spec.group.add(fan);
          hvlsFans.push({ obj: fan, phase: spec.seedIdx * 0.9 + fi * 1.4 });
        }
      }
      if (kit.railBot) {
        const bot = kit.railBot.clone();
        bot.position.set(0, 4.18, 0);
        spec.group.add(bot);
        railBots.push({
          mesh: bot,
          spanZ: spec.lengthZ * 0.5 - 2.6,
          baseZ: 0,
          phase: spec.seedIdx * 1.1,
        });
      }
    }

    // 3. Upgrade Yard Waterers & Hay Ring Feeders
    for (const yslot of yardPropSlots) {
      if (kit.yardWaterer) {
        yslot.yard.remove(yslot.placeholderWater);
        yslot.placeholderWater.geometry.dispose();
        const wClone = kit.yardWaterer.clone();
        wClone.position.set(0, 0.04, yslot.addFeeder ? -3.4 : 0);
        yslot.yard.add(wClone);
      }
      if (kit.yardFeeder && yslot.addFeeder) {
        const fClone = kit.yardFeeder.clone();
        fClone.position.set(0, 0.04, 3.6);
        yslot.yard.add(fClone);
      }
    }

    tagStepInteractive(farmingGroup, 'breeding');
    syncCutawayMaterials();
  });

  tagStepInteractive(farmingGroup, 'breeding');
  scene.add(farmingGroup);

  // ==============================
  // PART B: H区 · 兽医防疫、检疫与独立隔离缓冲区 (West Isolated Outpost: center -122, -22 — Blender PBR GLB)
  // ==============================
  const quarantineGroup = new THREE.Group();
  quarantineGroup.position.set(-122, 0, -22);

  const hPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(42, 0.14, 36), mats.concreteLight);
  hPlaceholder.position.set(0, 0.08, 0);
  hPlaceholder.receiveShadow = true;
  quarantineGroup.add(hPlaceholder);

  const mistCurtain = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 4.2),
    new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.24, side: THREE.DoubleSide }),
  );
  mistCurtain.rotation.y = Math.PI / 2;
  mistCurtain.position.set(17, 2.42, 0);
  quarantineGroup.add(mistCurtain);

  const hLoader = new GLTFLoader();
  hLoader.load(
    './models/h_quarantine_vet.glb',
    (gltf) => {
      quarantineGroup.remove(hPlaceholder);
      hPlaceholder.geometry.dispose();

      const root = gltf.scene;
      prepareGlbMaterials(root);
      quarantineGroup.add(root);
      tagStepInteractive(quarantineGroup, 'quarantine');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender H区 GLB:', err);
    },
  );

  const qWestId = nextSheepGroupId++;
  const qCenterId = nextSheepGroupId++;
  const qEastId = nextSheepGroupId++;
  for (let s = 0; s < 4; s++) {
    const sx = -8 + s * 4.0;
    const sz = 10 + (s % 2 === 0 ? 1.4 : -1.4);
    const stallBounds =
      s === 0
        ? { gid: qWestId, minX: -10.5, maxX: -7.5 }
        : s <= 2
          ? { gid: qCenterId, minX: -6.0, maxX: 2.0 }
          : { gid: qEastId, minX: 3.6, maxX: 6.6 };
    registerAnimatedSheep(
      quarantineGroup,
      s % 2 === 0 ? 'dorper' : 'suffolk',
      true,
      sx,
      0.52,
      sz,
      stallBounds.gid,
      stallBounds.minX,
      stallBounds.maxX,
      6.0,
      13.8,
      [],
      900 + s,
      0.72,
    );
  }

  tagStepInteractive(quarantineGroup, 'quarantine');
  scene.add(quarantineGroup);

  return {
    setRoofCutaway(cutaway: boolean) {
      targetRoofOpacity = cutaway ? 0.11 : 1.0;
    },
    update(elapsed: number) {
      if (Math.abs(targetRoofOpacity - currentCutawayOpacity) > 0.002) {
        currentCutawayOpacity += (targetRoofOpacity - currentCutawayOpacity) * 0.14;
        syncCutawayMaterials();
      }

      for (const f of hvlsFans) {
        f.obj.rotation.y = elapsed * 1.45 + f.phase;
      }

      for (const bot of railBots) {
        bot.mesh.position.z = bot.baseZ + Math.sin(elapsed * 0.45 + bot.phase) * bot.spanZ;
      }

      const dt = prevElapsed < 0 ? 0.016 : Math.min(0.05, Math.max(0.001, elapsed - prevElapsed));
      prevElapsed = elapsed;
      const yawAlpha = 1 - Math.exp(-7.0 * dt);
      const strideUpAlpha = 1 - Math.exp(-9.0 * dt);
      const strideDownAlpha = 1 - Math.exp(-12.0 * dt);
      const headAlpha = 1 - Math.exp(-6.5 * dt);

      for (const s of sheepList) {
        s.stateTimer -= dt;
        const peers = sheepByGroup.get(s.groupId) ?? [];

        if (s.state === 'walk') {
          const toX = s.targetX - s.x;
          const toZ = s.targetZ - s.z;
          const dist = Math.hypot(toX, toZ);

          if (dist < 0.25 || s.stateTimer <= 0) {
            const roll = nextSheepRand(s);
            s.state = roll < 0.72 ? 'graze' : 'look';
            s.stateTimer = (s.state === 'graze' ? 2.4 : 1.6) + nextSheepRand(s) * 3.4;
          } else {
            let vx = (toX / dist) * s.walkSpeed;
            let vz = (toZ / dist) * s.walkSpeed;

            // Smooth avoidance around waterers & hay feeders
            for (const obs of s.obstacles) {
              const padHx = obs.hx + 0.55;
              const padHz = obs.hz + 0.55;
              const dx = s.x - obs.x;
              const dz = s.z - obs.z;
              if (Math.abs(dx) < padHx && Math.abs(dz) < padHz) {
                const penX = padHx - Math.abs(dx);
                const penZ = padHz - Math.abs(dz);
                if (penX < penZ) vx += Math.sign(dx || 1) * 1.15;
                else vz += Math.sign(dz || 1) * 1.15;
              }
            }

            // Gentle separation from nearby flockmates in the same pen/yard
            for (const other of peers) {
              if (other === s) continue;
              const dx = s.x - other.x;
              const dz = s.z - other.z;
              const d = Math.hypot(dx, dz);
              if (d < 1.15 && d > 0.001) {
                const push = ((1.15 - d) / 1.15) * 1.05;
                vx += (dx / d) * push;
                vz += (dz / d) * push;
              }
            }

            const vMag = Math.hypot(vx, vz);
            if (vMag > s.walkSpeed * 1.15) {
              const scale = (s.walkSpeed * 1.15) / vMag;
              vx *= scale;
              vz *= scale;
            }

            const prevX = s.x;
            const prevZ = s.z;
            s.x = THREE.MathUtils.clamp(s.x + vx * dt, s.minX, s.maxX);
            s.z = THREE.MathUtils.clamp(s.z + vz * dt, s.minZ, s.maxZ);

            // Hard resolve against waterer/feeder interiors
            for (const obs of s.obstacles) {
              const dx = s.x - obs.x;
              const dz = s.z - obs.z;
              if (Math.abs(dx) < obs.hx && Math.abs(dz) < obs.hz) {
                if (obs.hx - Math.abs(dx) < obs.hz - Math.abs(dz)) {
                  s.x = THREE.MathUtils.clamp(obs.x + Math.sign(dx || 1) * obs.hx, s.minX, s.maxX);
                } else {
                  s.z = THREE.MathUtils.clamp(obs.z + Math.sign(dz || 1) * obs.hz, s.minZ, s.maxZ);
                }
              }
            }

            const moveDx = s.x - prevX;
            const moveDz = s.z - prevZ;
            const actualSpeed = Math.hypot(moveDx, moveDz) / Math.max(dt, 1e-4);

            if (actualSpeed < s.walkSpeed * 0.18) {
              // Steer around corner / stuck stall edge
              pickSheepTarget(s);
            } else {
              const desiredYaw = Math.atan2(moveDx, moveDz);
              const diff = Math.atan2(Math.sin(desiredYaw - s.yaw), Math.cos(desiredYaw - s.yaw));
              s.yaw += diff * yawAlpha;
            }

            const targetStride = Math.min(1, actualSpeed / Math.max(0.55, s.walkSpeed * 0.85));
            s.strideAmount += (targetStride - s.strideAmount) * strideUpAlpha;
            s.stridePhase += dt * (3.6 + actualSpeed * 6.4);

            const targetHeadPitch = 0.04 + Math.sin(s.stridePhase * 2) * 0.055;
            const targetHeadYaw = Math.sin(s.stridePhase * 0.5) * 0.05;
            s.headPitch += (targetHeadPitch - s.headPitch) * headAlpha;
            s.headYaw += (targetHeadYaw - s.headYaw) * headAlpha;
          }
        } else {
          s.strideAmount += (0 - s.strideAmount) * strideDownAlpha;
          if (s.strideAmount < 0.02) s.strideAmount = 0;
          else s.stridePhase += dt * 3.0 * s.strideAmount;

          const targetHeadPitch =
            s.state === 'graze'
              ? 0.48 + Math.sin(elapsed * 4.8 + s.phase) * 0.11
              : -0.14 + Math.sin(elapsed * 1.1 + s.phase) * 0.05;
          const targetHeadYaw =
            s.state === 'graze'
              ? Math.sin(elapsed * 1.3 + s.phase) * 0.14
              : Math.sin(elapsed * 0.95 + s.phase * 1.7) * 0.3;

          s.headPitch += (targetHeadPitch - s.headPitch) * headAlpha;
          s.headYaw += (targetHeadYaw - s.headYaw) * headAlpha;

          if (s.stateTimer <= 0) {
            pickSheepTarget(s);
            s.state = 'walk';
            s.stateTimer = 3.5 + nextSheepRand(s) * 5.0;
          }
        }

        s.rig.group.position.x = s.x;
        s.rig.group.position.z = s.z;
        s.rig.group.rotation.y = s.yaw;
        applySheepWalkGait(s.rig, s.stridePhase, s.strideAmount, s.headPitch, s.headYaw, s.baseY);
      }

      mistCurtain.material.opacity = 0.18 + Math.sin(elapsed * 4.0) * 0.08;
    },
  };
}
