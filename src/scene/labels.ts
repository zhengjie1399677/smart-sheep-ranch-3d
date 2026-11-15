import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface LabelsController {
  renderer: CSS2DRenderer;
  setVisible: (visible: boolean) => void;
  resize: (width: number, height: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
}

interface LabelDef {
  text: string;
  pos: [number, number, number];
  stepId: string;
  variant?: 'zone' | 'gate' | 'clean' | 'dirty' | 'energy';
  priority?: 1 | 2;
}

const LABELS: LabelDef[] = [
  { text: '主入口 · 智慧检疫门', pos: [-236, 8.2, -110], stepId: 'science', variant: 'gate', priority: 2 },
  { text: 'A区 数字指挥与公服中心', pos: [-194, 21.0, -114], stepId: 'science', priority: 1 },
  { text: 'N区 科创培训与4实验室', pos: [-154, 14.2, -98], stepId: 'science_interior', priority: 1 },
  { text: '滨湖湿地公园', pos: [-194, 6.2, -16], stepId: 'science', variant: 'clean', priority: 2 },
  { text: 'M区 农机具调度库', pos: [-220, 9.5, 108], stepId: 'forage', priority: 1 },
  { text: 'O区 双圆指针牧草基地', pos: [-114, 9.8, 112], stepId: 'forage', priority: 1 },
  { text: 'P区 盐碱地治理林草区', pos: [70, 9.2, 114], stepId: 'ecology', priority: 1 },
  { text: 'Q区 种质圃与生态预留区', pos: [188, 9.2, 114], stepId: 'ecology', priority: 1 },
  { text: 'G区 植物工厂 · TMR厨房', pos: [-34, 14.0, -22], stepId: 'processing', priority: 1 },
  { text: '净道 · 洁净饲料动脉', pos: [6, 3.2, -56], stepId: 'processing', variant: 'clean', priority: 2 },
  { text: 'B区 育种核心展示舍', pos: [-86, 18.2, -124], stepId: 'breeding', priority: 1 },
  { text: 'C区 繁殖母羊核心舍', pos: [-26, 10.2, -104], stepId: 'breeding', priority: 1 },
  { text: 'D区 羔羊保育精细舍', pos: [34, 18.2, -120], stepId: 'breeding', priority: 1 },
  { text: 'E区 标准育肥羊舍区', pos: [94, 10.2, -92], stepId: 'breeding', priority: 1 },
  { text: 'F区 智能生产与轮牧区', pos: [68, 11.4, -22], stepId: 'breeding', priority: 1 },
  { text: 'H区 远端隔离检疫区', pos: [-122, 9.8, -22], stepId: 'quarantine', priority: 2 },
  { text: '污道 · 封闭清粪走廊', pos: [88, 3.2, 8], stepId: 'manure', variant: 'dirty', priority: 2 },
  { text: 'J区 下风向堆肥沼气区', pos: [184, 12.2, -17], stepId: 'manure', variant: 'dirty', priority: 1 },
  { text: 'K区 沉淀池与再生水区', pos: [184, 9.8, 32], stepId: 'water', variant: 'clean', priority: 1 },
  { text: 'I区 独立外设屠宰冷链园区', pos: [320, 12.0, 92], stepId: 'slaughter', priority: 1 },
  { text: 'L区 综合能源光储微网区', pos: [178, 9.2, -88], stepId: 'energy', variant: 'energy', priority: 1 },
  { text: '次入口 · 独立冷链外运口', pos: [368, 9.8, 116], stepId: 'slaughter', variant: 'gate', priority: 2 },
];

export function createSceneLabels(
  container: HTMLElement,
  scene: THREE.Scene,
  onSelectStep: (stepId: string) => void,
): LabelsController {
  const renderer = new CSS2DRenderer();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0px';
  renderer.domElement.style.left = '0px';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.style.zIndex = '5';
  container.appendChild(renderer.domElement);

  const labelGroup = new THREE.Group();
  interface LabelEntry {
    el: HTMLButtonElement;
    worldPos: THREE.Vector3;
    priority: number;
    width: number;
    height: number;
  }
  const entries: LabelEntry[] = [];

  for (const item of LABELS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `zone-label${item.variant && item.variant !== 'zone' ? ` ${item.variant}` : ''}`;
    el.textContent = item.text;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelectStep(item.stepId);
    });

    const obj = new CSS2DObject(el);
    obj.position.set(...item.pos);
    labelGroup.add(obj);
    entries.push({
      el,
      worldPos: new THREE.Vector3(...item.pos),
      priority: item.priority ?? 1,
      width: 0,
      height: 0,
    });
  }
  scene.add(labelGroup);

  const projVec = new THREE.Vector3();
  const placedBoxes: Array<[number, number, number, number]> = [];
  let viewportW = container.clientWidth;
  let viewportH = container.clientHeight;

  function updateLabelOcclusion(camera: THREE.Camera) {
    if (!labelGroup.visible) return;
    const camPos = camera.position;
    const candidates: Array<{ entry: LabelEntry; sx: number; sy: number; distSq: number }> = [];

    for (const entry of entries) {
      projVec.copy(entry.worldPos).project(camera);
      if (projVec.z < -1 || projVec.z > 1 || Math.abs(projVec.x) > 1.08 || Math.abs(projVec.y) > 1.08) {
        entry.el.classList.add('is-occluded');
        continue;
      }
      if (entry.width === 0) {
        entry.width = entry.el.offsetWidth || 120;
        entry.height = entry.el.offsetHeight || 22;
      }
      const sx = (projVec.x * 0.5 + 0.5) * viewportW;
      const sy = (-projVec.y * 0.5 + 0.5) * viewportH;
      candidates.push({
        entry,
        sx,
        sy,
        distSq: camPos.distanceToSquared(entry.worldPos),
      });
    }

    candidates.sort((a, b) => {
      if (a.entry.priority !== b.entry.priority) return a.entry.priority - b.entry.priority;
      return a.distSq - b.distSq;
    });

    placedBoxes.length = 0;
    const padX = 6;
    const padY = 4;

    for (const { entry, sx, sy } of candidates) {
      const hw = entry.width * 0.5 + padX;
      const hh = entry.height * 0.5 + padY;
      const left = sx - hw;
      const right = sx + hw;
      const top = sy - hh;
      const bottom = sy + hh;

      let overlaps = false;
      for (const [pl, pt, pr, pb] of placedBoxes) {
        if (left < pr && right > pl && top < pb && bottom > pt) {
          overlaps = true;
          break;
        }
      }

      if (overlaps) {
        entry.el.classList.add('is-occluded');
      } else {
        entry.el.classList.remove('is-occluded');
        placedBoxes.push([left, top, right, bottom]);
      }
    }
  }

  return {
    renderer,
    setVisible(visible: boolean) {
      labelGroup.visible = visible;
      renderer.domElement.style.display = visible ? 'block' : 'none';
    },
    resize(width: number, height: number) {
      viewportW = width;
      viewportH = height;
      renderer.setSize(width, height);
    },
    render(sc: THREE.Scene, camera: THREE.Camera) {
      renderer.render(sc, camera);
      updateLabelOcclusion(camera);
    },
  };
}
