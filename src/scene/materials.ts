import * as THREE from 'three';

export interface SharedMaterials {
  concreteLight: THREE.MeshStandardMaterial;
  concreteDark: THREE.MeshStandardMaterial;
  steelFrame: THREE.MeshStandardMaterial;
  wallWhite: THREE.MeshStandardMaterial;
  wallSlate: THREE.MeshStandardMaterial;
  glassPanel: THREE.MeshPhysicalMaterial;
  solarPanel: THREE.MeshStandardMaterial;
  roadAsphalt: THREE.MeshStandardMaterial;
  woodFence: THREE.MeshStandardMaterial;
  hayGold: THREE.MeshStandardMaterial;
  silageGreen: THREE.MeshStandardMaterial;
  compostDark: THREE.MeshStandardMaterial;
  pipeTeal: THREE.MeshStandardMaterial;
  pipeOrange: THREE.MeshStandardMaterial;
  waterPool: THREE.MeshPhysicalMaterial;
  sandDesert: THREE.MeshStandardMaterial;
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
  srgb = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

function hash01(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createGrasslandTexture(
  baseColor: string,
  patchA: string,
  patchB: string,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 65; i++) {
        const cx = hash01(i, 1) * w;
        const cy = hash01(i, 2) * h;
        const r = 14 + hash01(i, 3) * 34;
        ctx.fillStyle = i % 2 === 0 ? patchA : patchB;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 900; i++) {
        const x = hash01(i, 5) * w;
        const y = hash01(i, 6) * h;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(22,55,28,0.06)';
        ctx.fillRect(x, y, 2, 2);
      }
    },
    repeatX,
    repeatY,
  );
}

export function createAsphaltTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const map = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#47525c';
      ctx.fillRect(0, 0, w, h);
      // Subtle wheel-track wear bands along road direction
      ctx.fillStyle = 'rgba(30, 38, 46, 0.14)';
      ctx.fillRect(w * 0.18, 0, w * 0.22, h);
      ctx.fillRect(w * 0.6, 0, w * 0.22, h);
      for (let i = 0; i < 2400; i++) {
        const x = hash01(i, 11) * w;
        const y = hash01(i, 12) * h;
        const sz = hash01(i, 13) > 0.85 ? 2 : 1.3;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(225,232,240,0.08)' : 'rgba(18,24,30,0.13)';
        ctx.fillRect(x, y, sz, sz);
      }
    },
    1,
    1,
  );
  const bumpMap = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2200; i++) {
        const x = hash01(i, 21) * w;
        const y = hash01(i, 22) * h;
        ctx.fillStyle = i % 2 === 0 ? '#9c9c9c' : '#646464';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    },
    1,
    1,
    false,
  );
  return { map, bumpMap };
}

export function createConcreteTexture(baseColor: string): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.055)';
      ctx.lineWidth = 2;
      for (let p = 0; p < w; p += 64) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
      for (let i = 0; i < 950; i++) {
        const x = hash01(i, 31) * w;
        const y = hash01(i, 32) * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(x, y, 2, 2);
      }
    },
    3,
    3,
  );
}

export function createCorrugatedBumpTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#707070';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#a8a8a8';
      for (let x = 0; x < w; x += 8) {
        ctx.fillRect(x, 0, 3, h);
      }
    },
    6,
    1,
    false,
  );
}

export function createWaterTextures(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  // Seamless soft ecological teal-turquoise surface without directional stripes so canals & circular lakes blend smoothly
  const map = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#188ba1';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 36; i++) {
        const cx = hash01(i, 41) * w;
        const cy = hash01(i, 42) * h;
        const r = 18 + hash01(i, 43) * 34;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(42, 168, 190, 0.12)' : 'rgba(12, 102, 124, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    1,
    1,
  );

  // Broad, smooth low-frequency wave normals to avoid sub-pixel specular shimmering when zoomed out
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const heightAt = (u: number, v: number): number => {
      const a = u * Math.PI * 2;
      const b = v * Math.PI * 2;
      return (
        Math.sin(a * 2 + b) * 0.45 +
        Math.cos(a - b * 2) * 0.35 +
        Math.sin(a * 3 - b * 2) * 0.2
      );
    };
    const eps = 1 / size;
    const strength = 0.75;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const dx = (heightAt(u + eps, v) - heightAt(u - eps, v)) * strength;
        const dy = (heightAt(u, v + eps) - heightAt(u, v - eps)) * strength;
        const len = Math.hypot(-dx, -dy, 1);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const nz = (1 / len) * 0.5 + 0.5;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = Math.round(nz * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const normalMap = new THREE.CanvasTexture(canvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.anisotropy = 4;
  normalMap.colorSpace = THREE.NoColorSpace;

  return { map, normalMap };
}

export function createSolarTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#0f2747';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(125, 195, 255, 0.36)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 6; i++) {
        const x = (i / 6) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let j = 0; j <= 8; j++) {
        const y = (j / 8) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, w, h);
    },
    1,
    1,
  );
}

export function createCorrugatedTexture(baseColor: string, stripeColor: string): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = stripeColor;
      for (let x = 0; x < w; x += 8) {
        ctx.fillRect(x, 0, 3, h);
      }
    },
    6,
    1,
  );
}

export function createSoilTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.fillRect(0, y, w, 5);
      }
      for (let i = 0; i < 450; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(Math.abs(x) * w, Math.abs(y) * h, 3, 3);
      }
    },
    4,
    3,
  );
}

export function createDesertTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#dec69b';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 20) {
        ctx.strokeStyle = 'rgba(185, 148, 92, 0.22)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin((x / w) * Math.PI * 2) * 4;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    },
    18,
    18,
  );
}

export function createSharedMaterials(): SharedMaterials {
  const solarTex = createSolarTexture();
  const wallTex = createCorrugatedTexture('#f4f7f8', '#e5ebee');
  const slateWallTex = createCorrugatedTexture('#3c5261', '#314452');
  const wallBump = createCorrugatedBumpTexture();
  const desertTex = createDesertTexture();
  const asphaltTex = createAsphaltTextures();
  const concreteLightTex = createConcreteTexture('#d9e0e3');
  const concreteDarkTex = createConcreteTexture('#9aa6ad');
  const waterTex = createWaterTextures();

  return {
    concreteLight: new THREE.MeshStandardMaterial({
      map: concreteLightTex,
      roughness: 0.88,
      metalness: 0.04,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      map: concreteDarkTex,
      roughness: 0.86,
      metalness: 0.06,
    }),
    steelFrame: new THREE.MeshStandardMaterial({
      color: 0x4b5c69,
      roughness: 0.42,
      metalness: 0.58,
    }),
    wallWhite: new THREE.MeshStandardMaterial({
      map: wallTex,
      bumpMap: wallBump,
      bumpScale: 0.025,
      roughness: 0.65,
      metalness: 0.08,
    }),
    wallSlate: new THREE.MeshStandardMaterial({
      map: slateWallTex,
      bumpMap: wallBump,
      bumpScale: 0.025,
      roughness: 0.55,
      metalness: 0.18,
    }),
    glassPanel: new THREE.MeshPhysicalMaterial({
      color: 0xb7e4f9,
      transparent: true,
      opacity: 0.36,
      roughness: 0.1,
      metalness: 0.08,
      reflectivity: 0.7,
    }),
    solarPanel: new THREE.MeshStandardMaterial({
      map: solarTex,
      roughness: 0.25,
      metalness: 0.45,
    }),
    roadAsphalt: new THREE.MeshStandardMaterial({
      map: asphaltTex.map,
      bumpMap: asphaltTex.bumpMap,
      bumpScale: 0.025,
      roughness: 0.88,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    woodFence: new THREE.MeshStandardMaterial({
      color: 0xc2935b,
      roughness: 0.82,
    }),
    hayGold: new THREE.MeshStandardMaterial({
      color: 0xd9ad53,
      roughness: 0.92,
    }),
    silageGreen: new THREE.MeshStandardMaterial({
      color: 0x5c7338,
      roughness: 0.9,
    }),
    compostDark: new THREE.MeshStandardMaterial({
      color: 0x4e3b2e,
      roughness: 0.95,
    }),
    pipeTeal: new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.35,
      metalness: 0.4,
    }),
    pipeOrange: new THREE.MeshStandardMaterial({
      color: 0xe67e22,
      roughness: 0.4,
      metalness: 0.35,
    }),
    waterPool: new THREE.MeshPhysicalMaterial({
      map: waterTex.map,
      normalMap: waterTex.normalMap,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.24,
      metalness: 0.12,
      clearcoat: 0.35,
      clearcoatRoughness: 0.26,
      envMapIntensity: 1.15,
    }),
    sandDesert: new THREE.MeshStandardMaterial({
      map: desertTex,
      roughness: 0.96,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    }),
  };
}

export function tagStepInteractive(obj: THREE.Object3D, stepId: string): void {
  obj.traverse((child) => {
    child.userData.stepId = stepId;
  });
}
