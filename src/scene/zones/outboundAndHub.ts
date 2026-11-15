import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SharedMaterials, tagStepInteractive } from '../materials';
import { AnimatedZone } from './feedProcessing';
import {
  applySheepWalkGait,
  createSheepMesh,
  SheepInstanceRig,
} from './sheepSheds';

interface CutawaySlot {
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  origTransparent: boolean;
  origOpacity: number;
  origDepthWrite: boolean;
  meshes: THREE.Mesh[];
}

function createCutawayController() {
  const slots: CutawaySlot[] = [];
  const clonedMats = new Map<THREE.Material, CutawaySlot>();
  let isCutaway = false;

  const apply = (cutaway: boolean) => {
    for (const slot of slots) {
      slot.mat.transparent = cutaway ? true : slot.origTransparent;
      slot.mat.opacity = cutaway ? 0.06 : slot.origOpacity;
      slot.mat.depthWrite = cutaway ? false : slot.origDepthWrite;
      slot.mat.needsUpdate = true;
      for (const m of slot.meshes) {
        m.castShadow = !cutaway && slot.origOpacity >= 0.99;
      }
    }
  };

  return {
    registerMesh(node: THREE.Mesh, origMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) {
      let slot = clonedMats.get(origMat);
      if (!slot) {
        const cloned = origMat.clone();
        slot = {
          mat: cloned,
          origTransparent: cloned.transparent,
          origOpacity: cloned.opacity,
          origDepthWrite: cloned.depthWrite,
          meshes: [],
        };
        clonedMats.set(origMat, slot);
        slots.push(slot);
      }
      node.material = slot.mat;
      slot.meshes.push(node);
      node.castShadow = slot.origOpacity >= 0.99;
      node.receiveShadow = true;
    },
    setCutaway(cutaway: boolean) {
      if (isCutaway === cutaway) return;
      isCutaway = cutaway;
      apply(cutaway);
    },
    sync() {
      apply(isCutaway);
    },
  };
}

export interface OutboundHubController extends AnimatedZone {
  setScienceCutaway: (cutaway: boolean) => void;
  setCommandCutaway: (cutaway: boolean) => void;
}

export function createOutboundAndHubZone(scene: THREE.Scene, mats: SharedMaterials): OutboundHubController {
  // ==============================
  // PART A: I区 Independent Landscaped Slaughter & Cold-Chain Park Enclave + 次入口 (Blender PBR GLB)
  // Center (324, 0, 104)
  // ==============================
  const slaughterGroup = new THREE.Group();
  slaughterGroup.position.set(324, 0, 104);

  const iPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(32, 0.2, 18), mats.concreteLight);
  iPlaceholder.position.set(5, 0.06, 13);
  iPlaceholder.receiveShadow = true;
  slaughterGroup.add(iPlaceholder);

  // Animated RFID verification beam, chute sheep, and disinfection exit mist (in slaughterGroup local coords)
  const scanBeams: THREE.Mesh[] = [];
  const chuteSheep: Array<{ rig: SheepInstanceRig; offset: number }> = [];
  const chuteZ = -12.5; // world Z=91.5 -> local -12.5

  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 2.8),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.rotation.y = Math.PI / 2;
  beam.position.set(-25.5, 1.56, chuteZ);
  scanBeams.push(beam);
  slaughterGroup.add(beam);

  for (let i = 0; i < 4; i++) {
    const rig = createSheepMesh();
    rig.group.rotation.y = Math.PI / 2;
    slaughterGroup.add(rig.group);
    chuteSheep.push({ rig, offset: i * 0.25 });
  }

  const exitMist = new THREE.Mesh(
    new THREE.PlaneGeometry(12.8, 5.0),
    new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  );
  exitMist.rotation.y = Math.PI / 2;
  exitMist.position.set(42, 2.92, 0);
  slaughterGroup.add(exitMist);

  const iLoader = new GLTFLoader();
  iLoader.load(
    './models/i_slaughter_coldchain.glb',
    (gltf) => {
      slaughterGroup.remove(iPlaceholder);
      iPlaceholder.geometry.dispose();

      const root = gltf.scene;
      root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          const mat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
          const isGlass = mat && (mat.transparent || mat.opacity < 0.99);
          if (isGlass) {
            mat.depthWrite = false;
            node.castShadow = false;
          } else {
            node.castShadow = true;
          }
          node.receiveShadow = true;
        }
      });

      slaughterGroup.add(root);
      tagStepInteractive(slaughterGroup, 'slaughter');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender I区 GLB:', err);
    },
  );

  tagStepInteractive(slaughterGroup, 'slaughter');
  scene.add(slaughterGroup);

  // ==============================
  // PART B: L区 综合能源微网区 — North-East Energy Microgrid near Wind Ridge (Blender PBR GLB)
  // Center (178, -88), Pad (X: 152..204, Z: -112..-64, 52 x 48m)
  // ==============================
  const energyGroup = new THREE.Group();
  energyGroup.position.set(178, 0, -88);

  const lPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(52, 0.2, 48), mats.concreteLight);
  lPlaceholder.position.set(0, 0.06, 0);
  lPlaceholder.receiveShadow = true;
  energyGroup.add(lPlaceholder);

  iLoader.load(
    './models/l_energy_microgrid.glb',
    (gltf) => {
      energyGroup.remove(lPlaceholder);
      lPlaceholder.geometry.dispose();

      const root = gltf.scene;
      root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          const mat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
          const isGlass = mat && (mat.transparent || mat.opacity < 0.99);
          if (isGlass) {
            mat.depthWrite = false;
            node.castShadow = false;
          } else {
            node.castShadow = true;
          }
          node.receiveShadow = true;
        }
      });

      energyGroup.add(root);
      tagStepInteractive(energyGroup, 'energy');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender L区 GLB:', err);
    },
  );

  tagStepInteractive(energyGroup, 'energy');
  scene.add(energyGroup);

  // ==============================
  // PART C: A区 行政办公生活与数字指挥中心 + 主入口 (Blender PBR GLB)
  // North-West Lakeside Parkland: Center (-210, -110), Pad (48 x 46m), 主入口 at (-246, -110)
  // ==============================
  const hubGroup = new THREE.Group();
  hubGroup.position.set(-210, 0, -110);

  const aPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(48, 0.2, 46), mats.concreteLight);
  aPlaceholder.position.set(0, 0.06, 0);
  aPlaceholder.receiveShadow = true;
  hubGroup.add(aPlaceholder);

  let radarSpinner: THREE.Object3D | null = null;
  const commandCutaway = createCutawayController();

  iLoader.load(
    './models/a_civic_command.glb',
    (gltf) => {
      hubGroup.remove(aPlaceholder);
      aPlaceholder.geometry.dispose();

      const root = gltf.scene;
      root.traverse((node) => {
        if (node.name === 'A_Radar_Spinner') {
          radarSpinner = node;
        }
        if (!(node instanceof THREE.Mesh)) return;
        const mat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
        if (!mat) return;

        if (node.name.startsWith('A_Cutaway_')) {
          commandCutaway.registerMesh(node, mat);
        } else {
          const isGlass = mat.transparent || mat.opacity < 0.99;
          if (isGlass) {
            mat.depthWrite = false;
            node.castShadow = false;
          } else {
            node.castShadow = true;
          }
          node.receiveShadow = true;
        }
      });

      hubGroup.add(root);
      tagStepInteractive(hubGroup, 'science');
      commandCutaway.sync();
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender A区 GLB:', err);
    },
  );

  tagStepInteractive(hubGroup, 'science');
  scene.add(hubGroup);

  // ==============================
  // PART D: N区 科创科研培训中心与中乌4联合实验室 (Blender 精细化 PBR GLB + 动态剖切与全息动画)
  // Built at 1:1 metric scale in Blender (blender_assets/N_ScienceHub.blend -> public/models/n_science_hub.glb)
  // Center (-154, 0.03, -98), Footprint 44 x 42m cleanly clear of Clean Feed Road & Lakeside Drive
  // ==============================
  const scienceGroup = new THREE.Group();
  const sciX = -154;
  const sciZ = -98;
  scienceGroup.position.set(sciX, 0.03, sciZ);

  // Brief plinth placeholder while n_science_hub.glb streams in
  const placeholderPad = new THREE.Mesh(new THREE.BoxGeometry(44, 0.18, 42), mats.concreteLight);
  placeholderPad.position.set(0, 0.09, 0);
  placeholderPad.receiveShadow = true;
  scienceGroup.add(placeholderPad);

  const scienceCutaway = createCutawayController();
  const holoSpinMeshes: THREE.Object3D[] = [];
  let holoFloatMesh: THREE.Object3D | null = null;
  let holoFloatBaseY = 0;

  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    './models/n_science_hub.glb',
    (gltf) => {
      scienceGroup.remove(placeholderPad);
      placeholderPad.geometry.dispose();

      const hubRoot = gltf.scene;

      hubRoot.traverse((node) => {
        if (node.name.startsWith('N_Holo_') && node.name !== 'N_Holo_BaseDisc') {
          holoSpinMeshes.push(node);
          if (node.name === 'N_Holo_ReticleInner') {
            holoFloatMesh = node;
            holoFloatBaseY = node.position.y;
          }
        }

        if (!(node instanceof THREE.Mesh)) return;
        const origMat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
        if (!origMat) return;

        if (node.name.startsWith('N_Cutaway_')) {
          scienceCutaway.registerMesh(node, origMat);
        } else {
          const isGlass = origMat.transparent || origMat.opacity < 0.99;
          if (isGlass) {
            origMat.depthWrite = false;
            node.castShadow = false;
          } else {
            node.castShadow = true;
          }
          node.receiveShadow = true;
        }
      });

      scienceGroup.add(hubRoot);
      tagStepInteractive(scienceGroup, 'science_interior');
      scienceCutaway.sync();
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender N区 GLB:', err);
    },
  );

  function setScienceCutaway(cutaway: boolean) {
    scienceCutaway.setCutaway(cutaway);
  }

  function setCommandCutaway(cutaway: boolean) {
    commandCutaway.setCutaway(cutaway);
  }

  tagStepInteractive(scienceGroup, 'science_interior');
  scene.add(scienceGroup);

  return {
    setScienceCutaway,
    setCommandCutaway,
    update(elapsed: number) {
      scanBeams.forEach((b, idx) => {
        b.position.y = 1.45 + Math.sin(elapsed * 3.4 + idx * 1.2) * 0.9;
      });
      exitMist.material.opacity = 0.16 + Math.sin(elapsed * 3.8) * 0.08;

      for (const s of chuteSheep) {
        const t = (elapsed * 0.065 + s.offset) % 1;
        const sx = -34 + t * 14.0;
        const sz = chuteZ + Math.sin(t * 14) * 0.25;
        const dzDt = Math.cos(t * 14) * 14 * 0.25 * 0.065;
        const dxDt = 14.0 * 0.065;
        s.rig.group.position.set(sx, 0.16, sz);
        s.rig.group.rotation.y = Math.atan2(dxDt, dzDt);
        applySheepWalkGait(
          s.rig,
          elapsed * 7.8 + s.offset * 12,
          0.92,
          -0.02 + Math.sin(elapsed * 4 + s.offset * 6) * 0.06,
          Math.sin(elapsed * 1.8 + s.offset * 5) * 0.08,
          0.16,
        );
      }

      if (radarSpinner) {
        radarSpinner.rotation.y = elapsed * 1.8;
      }
      for (const hm of holoSpinMeshes) {
        hm.rotation.y = elapsed * 0.45;
      }
      if (holoFloatMesh) {
        holoFloatMesh.position.y = holoFloatBaseY + Math.sin(elapsed * 2.4) * 0.12;
      }
    },
  };
}
