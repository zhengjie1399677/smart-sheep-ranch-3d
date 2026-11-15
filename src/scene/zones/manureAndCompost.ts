import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SharedMaterials, tagStepInteractive } from '../materials';
import { AnimatedZone } from './feedProcessing';

export function createManureAndCompostZone(scene: THREE.Scene, mats: SharedMaterials): AnimatedZone {
  // ==============================
  // PART A: F区 Rear Automatic Manure Scrapers (X = 50, 68, 86; Z = -5..-0.5 facing Dirty Corridor Z=+8)
  // ==============================
  const fScraperGroup = new THREE.Group();
  const scrapers: THREE.Mesh[] = [];

  for (const sx of [50, 68, 86]) {
    const channel = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.28, 3.2), mats.concreteDark);
    channel.position.set(sx, 0.14, -2.8);
    channel.receiveShadow = true;

    const pit = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.18, 1.9), mats.compostDark);
    pit.position.set(sx, 0.24, -2.8);

    const scraperBar = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.36, 0.45), mats.pipeOrange);
    scraperBar.position.set(sx, 0.38, -2.8);
    scraperBar.castShadow = true;
    scrapers.push(scraperBar);

    const outletBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 1.6), mats.wallSlate);
    outletBox.position.set(sx, 1.1, -1.2);
    outletBox.castShadow = true;

    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.5, 10), mats.pipeOrange);
    spout.rotation.x = Math.PI / 3;
    spout.position.set(sx, 1.85, -0.35);

    fScraperGroup.add(channel, pit, scraperBar, outletBox, spout);
  }

  tagStepInteractive(fScraperGroup, 'manure');
  scene.add(fScraperGroup);

  // ==============================
  // PART B: J区 粪污资源化区 — East Downwind Cluster behind Biosecurity Forest Belt
  // Center (184, -17), Pad (X: 152..216, Z: -38..+4, 64 x 42m) — loaded from Blender PBR GLB
  // ==============================
  const jGroup = new THREE.Group();
  jGroup.position.set(184, 0, -17);

  const jPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(64, 0.2, 42), mats.concreteLight);
  jPlaceholder.position.set(0, 0.06, 0);
  jPlaceholder.receiveShadow = true;
  jGroup.add(jPlaceholder);

  const turners: Array<{ group: THREE.Object3D; drum: THREE.Object3D | null; baseX: number; phase: number }> = [];
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const steamPuffs: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; offset: number }> = [];

  for (const [bayIdx, bayLz] of [-8.5, 6.5].entries()) {
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55, 7, 6), steamMat);
      const bx = 13.0 - 10.5 + i * 5.2;
      const bz = bayLz + ((i % 3) - 1) * 3.3;
      jGroup.add(puff);
      steamPuffs.push({ mesh: puff, baseX: bx, baseZ: bz, offset: i * 0.75 + bayIdx * 0.4 });
    }
  }

  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    './models/j_manure_resource.glb',
    (gltf) => {
      jGroup.remove(jPlaceholder);
      jPlaceholder.geometry.dispose();

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

      for (const bayIdx of [0, 1]) {
        const turnerObj = root.getObjectByName(`J_Compost_Turner_${bayIdx}`);
        if (turnerObj) {
          const drumObj = root.getObjectByName(`J_Turner_Drum_${bayIdx}`) ?? null;
          turners.push({
            group: turnerObj,
            drum: drumObj,
            baseX: turnerObj.position.x,
            phase: bayIdx * 1.9,
          });
        }
      }

      jGroup.add(root);
      tagStepInteractive(jGroup, 'manure');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender J区 GLB:', err);
    },
  );

  tagStepInteractive(jGroup, 'manure');
  scene.add(jGroup);

  // ==============================
  // PART C: K区 污水处理与中水回用区 — South of J区 across Z=+8 Dirty Lane, North of Eco Canal (Z=56)
  // Center (184, +32), Pad (X: 152..216, Z: +14..+50, 64 x 36m) — loaded from Blender PBR GLB
  // ==============================
  const kGroup = new THREE.Group();
  kGroup.position.set(184, 0, 32);

  const kPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(64, 0.2, 36), mats.concreteLight);
  kPlaceholder.position.set(0, 0.06, 0);
  kPlaceholder.receiveShadow = true;
  kGroup.add(kPlaceholder);

  const clarifierBridges: THREE.Object3D[] = [];

  gltfLoader.load(
    './models/k_water_treatment.glb',
    (gltf) => {
      kGroup.remove(kPlaceholder);
      kPlaceholder.geometry.dispose();

      const root = gltf.scene;
      root.traverse((node) => {
        if (node.name.startsWith('K_Clarifier_Bridge_')) {
          clarifierBridges.push(node);
        }
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

      kGroup.add(root);
      tagStepInteractive(kGroup, 'water');
    },
    undefined,
    (err) => {
      console.error('Failed to load Blender K区 GLB:', err);
    },
  );

  tagStepInteractive(kGroup, 'water');
  scene.add(kGroup);

  return {
    update(elapsed: number) {
      scrapers.forEach((sc, idx) => {
        sc.position.z = -2.8 + Math.sin(elapsed * 1.1 + idx * 0.7) * 0.55;
      });
      turners.forEach((t) => {
        t.group.position.x = t.baseX + Math.sin(elapsed * 0.3 + t.phase) * 11.2;
        if (t.drum) {
          t.drum.rotation.z = elapsed * 4.5;
        }
      });
      for (const sp of steamPuffs) {
        const life = (elapsed * 0.36 + sp.offset) % 1;
        sp.mesh.position.set(sp.baseX, 1.2 + life * 3.1, sp.baseZ);
        sp.mesh.scale.setScalar(0.6 + life * 1.15);
      }
      clarifierBridges.forEach((bridge, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        bridge.rotation.y += dir * 0.004;
      });
    },
  };
}
