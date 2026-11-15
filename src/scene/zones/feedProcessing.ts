import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SharedMaterials, tagStepInteractive } from '../materials';

export interface AnimatedZone {
  update: (elapsed: number) => void;
}

export interface FeedProcessingController extends AnimatedZone {
  setTmrCutaway: (cutaway: boolean) => void;
}

interface CutawaySlot {
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  origTransparent: boolean;
  origOpacity: number;
  origDepthWrite: boolean;
  meshes: THREE.Mesh[];
}

/**
 * Builds Part A (G区 植物工厂 · 青贮干草区 · 双线 TMR 中央厨房 loaded from Blender PBR GLB)
 * and Part B (M区 农机设备维护与供应保障区).
 */
export function createFeedProcessingZone(scene: THREE.Scene, mats: SharedMaterials): FeedProcessingController {
  // ==============================
  // PART A: G区 · 植物工厂、青贮干草区与双线 TMR 中央厨房 (Blender PBR GLB + 动态剖切与动画)
  // Center (-34, 0, -22), spanning X: -83..+15, Z: -41..-3
  // ==============================
  const group = new THREE.Group();
  group.position.set(-34, 0, -22);

  // Temporary plinth placeholders while g_tmr_kitchen.glb streams in
  const placeholders = new THREE.Group();
  const padSpecs: Array<[number, number, number]> = [
    [-40, 18, 36],
    [-14, 32, 34],
    [26, 46, 38],
  ];
  for (const [lx, w, d] of padSpecs) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), mats.concreteLight);
    pad.position.set(lx, 0.08, 0);
    pad.receiveShadow = true;
    placeholders.add(pad);
  }
  group.add(placeholders);

  // Live animated forage bales riding up both West inclined intake belts into the shredders
  const forageChunks: Array<{ mesh: THREE.Mesh; offset: number; z: number }> = [];
  const beltTilt = 0.2;
  const beltSlope = Math.tan(beltTilt);
  for (const cz of [-5.2, 2.2]) {
    for (let i = 0; i < 6; i++) {
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.52, 0.96),
        i % 2 === 0 ? mats.hayGold : mats.silageGreen,
      );
      chunk.castShadow = true;
      group.add(chunk);
      forageChunks.push({ mesh: chunk, offset: i / 6, z: cz });
    }
  }

  // Pulsing cyan AGV docking beacons under the dual North automated dispatch spouts
  const glowRings: THREE.Mesh[] = [];
  for (const ox of [20, 32]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.08, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(ox, 0.2, -17.6);
    glowRings.push(ring);
    group.add(ring);
  }

  const cutawaySlots: CutawaySlot[] = [];
  const augers: Array<{ obj: THREE.Object3D; dir: number }> = [];
  let isTmrCutaway = false;

  function applyCutawayState(cutaway: boolean) {
    for (const slot of cutawaySlots) {
      slot.mat.transparent = cutaway ? true : slot.origTransparent;
      slot.mat.opacity = cutaway ? 0.07 : slot.origOpacity;
      slot.mat.depthWrite = cutaway ? false : slot.origDepthWrite;
      slot.mat.needsUpdate = true;
      for (const m of slot.meshes) {
        m.castShadow = !cutaway && slot.origOpacity >= 0.99;
      }
    }
  }

  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    './models/g_tmr_kitchen.glb',
    (gltf) => {
      group.remove(placeholders);
      placeholders.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });

      const root = gltf.scene;
      const clonedCutawayMats = new Map<THREE.Material, CutawaySlot>();

      root.traverse((node) => {
        if (node.name.startsWith('TMR_Auger_')) {
          const dir = node.name.endsWith('_L') ? 1 : -1;
          augers.push({ obj: node, dir });
        }

        if (!(node instanceof THREE.Mesh)) return;
        const isCutawayMesh = node.name.startsWith('G_Cutaway_');
        const origMat = node.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
        if (!origMat) return;

        if (isCutawayMesh) {
          let slot = clonedCutawayMats.get(origMat);
          if (!slot) {
            const cloned = origMat.clone();
            slot = {
              mat: cloned,
              origTransparent: cloned.transparent,
              origOpacity: cloned.opacity,
              origDepthWrite: cloned.depthWrite,
              meshes: [],
            };
            clonedCutawayMats.set(origMat, slot);
            cutawaySlots.push(slot);
          }
          node.material = slot.mat;
          slot.meshes.push(node);
          node.castShadow = slot.origOpacity >= 0.99;
          node.receiveShadow = true;
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

      group.add(root);
      tagStepInteractive(group, 'processing');
      applyCutawayState(isTmrCutaway);
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender G区 TMR GLB:', err);
    },
  );

  function setTmrCutaway(cutaway: boolean) {
    if (isTmrCutaway === cutaway) return;
    isTmrCutaway = cutaway;
    applyCutawayState(cutaway);
  }

  tagStepInteractive(group, 'processing');
  scene.add(group);

  // ==============================
  // PART B: M区 · 农机设备维护与供应保障区 (South-West Eco-Forage Gateway beside O区: center X=-220, Z=108 — Blender PBR GLB)
  // ==============================
  const machGroup = new THREE.Group();
  machGroup.position.set(-220, 0, 108);
  machGroup.rotation.y = Math.PI / 2; // Doors & wash apron open East (+X) onto M-O Service Ave (X=-196)

  const mPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(46, 0.16, 32), mats.concreteLight);
  mPlaceholder.position.y = 0.08;
  mPlaceholder.receiveShadow = true;
  machGroup.add(mPlaceholder);

  gltfLoader.load(
    './models/m_machinery_zone.glb',
    (gltf) => {
      machGroup.remove(mPlaceholder);
      mPlaceholder.geometry.dispose();

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

      machGroup.add(root);
      tagStepInteractive(machGroup, 'forage');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender M区 GLB:', err);
    },
  );

  tagStepInteractive(machGroup, 'forage');
  scene.add(machGroup);

  return {
    setTmrCutaway,
    update(elapsed: number) {
      for (const a of augers) {
        a.obj.rotation.x = elapsed * 2.1 * a.dir;
      }
      for (const fc of forageChunks) {
        const t = (elapsed * 0.24 + fc.offset) % 1;
        const lx = 1.6 + t * 14.0;
        const ly = 2.76 + (lx - 8.65) * beltSlope + 0.28;
        fc.mesh.position.set(lx, ly, fc.z);
        fc.mesh.rotation.z = beltTilt;
      }
      const pulse = 0.85 + Math.sin(elapsed * 3.5) * 0.15;
      glowRings.forEach((r) => r.scale.setScalar(pulse));
    },
  };
}
