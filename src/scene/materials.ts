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
  waterPool: THREE.MeshStandardMaterial;
  sandDesert: THREE.MeshStandardMaterial;
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
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
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
  const desertTex = createDesertTexture();

  return {
    concreteLight: new THREE.MeshStandardMaterial({
      color: 0xd9e0e3,
      roughness: 0.88,
      metalness: 0.04,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      color: 0x9aa6ad,
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
      roughness: 0.65,
      metalness: 0.08,
    }),
    wallSlate: new THREE.MeshStandardMaterial({
      map: slateWallTex,
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
      color: 0x4b5660,
      roughness: 0.9,
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
    waterPool: new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.18,
      metalness: 0.22,
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
