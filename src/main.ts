import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TOUR_STEPS } from './data/tourSteps';
import { createSharedMaterials } from './scene/materials';
import { createEnvironment } from './scene/environment';
import { createSalineAndForageZone } from './scene/zones/salineAndForage';
import { createFeedProcessingZone } from './scene/zones/feedProcessing';
import { createSheepShedsAndInbound } from './scene/zones/sheepSheds';
import { createManureAndCompostZone } from './scene/zones/manureAndCompost';
import { createOutboundAndHubZone } from './scene/zones/outboundAndHub';
import { createLogisticsAndFlows } from './scene/logisticsAndFlows';
import { createSceneLabels } from './scene/labels';
import { updateVegetationWind } from './scene/vegetation';
import { createExplorationController, ExplorationMode } from './scene/exploration';
import { initHud } from './ui/hud';

const appRoot = document.getElementById('app');
appRoot?.classList.add('styles-loaded');

// Track global GLTF/Texture asset loading so FOUC & graybox pop-in stay covered behind the loading splash
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar') as HTMLElement | null;
const loadingPercent = document.getElementById('loading-percent');
const loadingStatus = document.getElementById('loading-status');
const loadingDetail = document.getElementById('loading-detail');

let loadingTarget = 0.08;
let loadingDisplay = 0.04;
let loadingFinished = false;
let loadingDismissed = false;
let itemsLoadedCount = 0;
let itemsTotalCount = 0;

function hideLoadingScreen(): void {
  if (loadingDismissed) return;
  loadingDismissed = true;
  if (loadingBar) loadingBar.style.width = '100%';
  if (loadingPercent) loadingPercent.textContent = '100%';
  if (loadingStatus) loadingStatus.textContent = '三维园区加载就绪';
  if (!loadingScreen) return;
  window.setTimeout(() => {
    loadingScreen.classList.add('is-hidden');
    window.setTimeout(() => {
      loadingScreen.remove();
    }, 620);
  }, 160);
}

THREE.DefaultLoadingManager.onStart = (_url, loaded, total) => {
  itemsLoadedCount = loaded;
  itemsTotalCount = Math.max(itemsTotalCount, total);
  loadingTarget = Math.max(loadingTarget, 0.14);
};

THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  itemsLoadedCount = loaded;
  itemsTotalCount = Math.max(itemsTotalCount, total);
  const ratio = loaded / Math.max(total, 1);
  // Keep progress monotonic even as nested blob textures are discovered
  loadingTarget = Math.max(loadingTarget, Math.min(0.94, 0.14 + ratio * 0.8));
};

THREE.DefaultLoadingManager.onLoad = () => {
  loadingTarget = 1.0;
  loadingFinished = true;
  if (loadingDetail && itemsTotalCount > 0) {
    loadingDetail.textContent = `已完成 ${itemsTotalCount} 项场景资产与贴图加载`;
  }
  // Allow two rendered frames under the splash to warm up shaders before fading out
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hideLoadingScreen();
    });
  });
};

THREE.DefaultLoadingManager.onError = (url) => {
  console.warn('[AssetLoader] 资源加载异常:', url);
};

// Failsafe timeout so a transient blocked asset never keeps the splash screen stuck
window.setTimeout(() => {
  if (!loadingDismissed) {
    loadingTarget = 1.0;
    loadingFinished = true;
    hideLoadingScreen();
  }
}, 8000);

function updateLoadingOverlay(dt: number): void {
  if (loadingDismissed) return;
  if (!loadingFinished && loadingTarget < 0.88) {
    loadingTarget = Math.max(loadingTarget, Math.min(0.88, loadingDisplay + dt * 0.06));
  }
  loadingDisplay += (loadingTarget - loadingDisplay) * Math.min(1, dt * 10 + 0.08);
  const pct = Math.min(100, Math.max(1, Math.round(loadingDisplay * 100)));
  if (loadingBar) loadingBar.style.width = `${pct}%`;
  if (loadingPercent) loadingPercent.textContent = `${pct}%`;
  if (loadingStatus) {
    if (pct < 35) loadingStatus.textContent = '正在加载三维地形与低碳基础设施…';
    else if (pct < 75) loadingStatus.textContent = '正在装配羊舍牧群、湿地湖景与装备精模…';
    else if (pct < 96) loadingStatus.textContent = '正在同步六大循环流线与 PBR 贴图…';
    else loadingStatus.textContent = '正在预编译光影着色器，即将进入园区…';
  }
  if (loadingDetail && itemsTotalCount > 0 && !loadingFinished) {
    loadingDetail.textContent = `已装载 ${Math.min(itemsLoadedCount, itemsTotalCount)} / ${itemsTotalCount} 项 3D 模型与贴图`;
  }
}

const container = document.getElementById('canvas-container')!;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 3.0, 2800);
camera.position.set(...TOUR_STEPS[0].cameraPos);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.62;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 6;
controls.maxDistance = 1150;
controls.target.set(...TOUR_STEPS[0].target);
controls.update();

// Build all 3D scene zones
const mats = createSharedMaterials();
const env = createEnvironment(scene, mats);
const salineForage = createSalineAndForageZone(scene, mats);
const feedProcessing = createFeedProcessingZone(scene, mats);
const sheepSheds = createSheepShedsAndInbound(scene, mats);
const manureCompost = createManureAndCompostZone(scene, mats);
const outboundHub = createOutboundAndHubZone(scene, mats);
const logistics = createLogisticsAndFlows(scene, mats);

// Camera fly-to state
let flyActive = false;
const desiredCamPos = new THREE.Vector3(...TOUR_STEPS[0].cameraPos);
const desiredTarget = new THREE.Vector3(...TOUR_STEPS[0].target);

// Auto-tour state (wall-clock timer so tab throttling doesn't stall step pacing)
let autoTour = false;
let currentStepIndex = 0;
let manualCameraMoved = false;
let lastAutoStepTime = performance.now();
const AUTO_STEP_DURATION_MS = 6500;

const scienceHubCenter = new THREE.Vector3(-154, 2.2, -98);
const commandCenterPos = new THREE.Vector3(-198, 4.0, -110);
const tmrKitchenCenter = new THREE.Vector3(-8, 4.0, -22);

function goToStepIndex(index: number, stopAutoTour = true) {
  currentStepIndex = index;
  manualCameraMoved = false;
  const step = TOUR_STEPS[index];
  desiredCamPos.set(...step.cameraPos);
  desiredTarget.set(...step.target);
  flyActive = true;
  sheepSheds.setRoofCutaway(step.id === 'breeding' || step.id === 'sheep_interior');
  outboundHub.setScienceCutaway(step.id === 'science_interior');
  feedProcessing.setTmrCutaway(step.id === 'tmr_interior');
  hud.setActiveStep(index);
  if (stopAutoTour && autoTour) {
    autoTour = false;
    hud.setAutoTourState(false);
  }
}

function goToStepById(stepId: string, stopAutoTour = true) {
  const idx = TOUR_STEPS.findIndex((s) => s.id === stepId);
  if (idx !== -1) {
    goToStepIndex(idx, stopAutoTour);
  }
}

const exploration = createExplorationController(scene, camera, renderer.domElement, {
  onModeChanged: (nextMode: ExplorationMode) => {
    hud.setExplorationMode(nextMode);
    boostHighFps(1500);
    if (nextMode === 'orbit') {
      controls.enabled = true;
      camera.getWorldDirection(navForward);
      controls.target.copy(camera.position).addScaledVector(navForward, 8);
      goToStepIndex(currentStepIndex, true);
    } else {
      flyActive = false;
      manualCameraMoved = true;
      controls.enabled = false;
      if (autoTour) {
        autoTour = false;
        hud.setAutoTourState(false);
      }
    }
  },
  onRequestOrbitMode: () => {
    exploration.setMode('orbit');
  },
});

const labels = createSceneLabels(container, scene, (stepId) => {
  if (exploration.getMode() !== 'orbit') {
    exploration.setMode('orbit');
  }
  goToStepById(stepId, true);
});

const hud = initHud({
  onSelectStep: (idx, stopAuto) => goToStepIndex(idx, stopAuto),
  onToggleAutoTour: () => {
    if (exploration.getMode() !== 'orbit') {
      exploration.setMode('orbit');
    }
    autoTour = !autoTour;
    hud.setAutoTourState(autoTour);
    if (autoTour) {
      lastAutoStepTime = performance.now();
      const nextIdx = currentStepIndex === 0 ? 1 : currentStepIndex;
      goToStepIndex(nextIdx, false);
    }
  },
  onToggleFlows: (visible) => logistics.setFlowsVisible(visible),
  onChangeCycles: (activeCycles) => logistics.setCycleFilter(activeCycles),
  onToggleLabels: (visible) => labels.setVisible(visible),
  onChangeLighting: (mode) => env.setLighting(mode),
  onRemediationChange: (progress) => salineForage.setRemediationProgress(progress),
  onResetView: () => {
    if (exploration.getMode() !== 'orbit') {
      exploration.setMode('orbit');
    }
    goToStepIndex(0, true);
  },
  onChangeMode: (nextMode) => exploration.setMode(nextMode),
  onToggleDriveCam: () => exploration.toggleDriveCameraStyle(),
  onResetVehicle: () => exploration.resetVehicle(),
});

// User manual camera interaction cancels active fly-to & auto-tour
function cancelCameraAutomation() {
  flyActive = false;
  manualCameraMoved = true;
  if (autoTour) {
    autoTour = false;
    hud.setAutoTourState(false);
  }
}

controls.addEventListener('start', cancelCameraAutomation);

// Keyboard WASD / Arrow navigation (uses e.code so CapsLock & Chinese IME stay responsive)
const pressedKeyCodes = new Set<string>();
let shiftHeld = false;
const NAV_KEY_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

function isTextEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'button' && target.type !== 'checkbox') {
    return true;
  }
  return false;
}

window.addEventListener('keydown', (e) => {
  shiftHeld = e.shiftKey;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isTextEditableTarget(e.target)) return;
  if (e.target instanceof HTMLInputElement && e.target.type === 'range' && e.code.startsWith('Arrow')) return;
  if (exploration.getMode() !== 'orbit') {
    boostHighFps(1200);
    return;
  }

  if (NAV_KEY_CODES.has(e.code)) {
    e.preventDefault();
    pressedKeyCodes.add(e.code);
    cancelCameraAutomation();
  }
});

window.addEventListener('keyup', (e) => {
  shiftHeld = e.shiftKey;
  pressedKeyCodes.delete(e.code);
});

const clearNavKeys = () => {
  pressedKeyCodes.clear();
  shiftHeld = false;
};
window.addEventListener('blur', clearNavKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearNavKeys();
});

const navForward = new THREE.Vector3();
const navRight = new THREE.Vector3();
const navMove = new THREE.Vector3();
const navClampedTarget = new THREE.Vector3();

function applyKeyboardPan(dt: number) {
  let forwardInput = 0;
  let rightInput = 0;
  if (pressedKeyCodes.has('KeyW') || pressedKeyCodes.has('ArrowUp')) forwardInput += 1;
  if (pressedKeyCodes.has('KeyS') || pressedKeyCodes.has('ArrowDown')) forwardInput -= 1;
  if (pressedKeyCodes.has('KeyD') || pressedKeyCodes.has('ArrowRight')) rightInput += 1;
  if (pressedKeyCodes.has('KeyA') || pressedKeyCodes.has('ArrowLeft')) rightInput -= 1;

  if (forwardInput === 0 && rightInput === 0) return;

  camera.getWorldDirection(navForward);
  navForward.y = 0;
  if (navForward.lengthSq() < 1e-6) {
    navForward.set(0, 0, -1);
  } else {
    navForward.normalize();
  }
  navRight.crossVectors(navForward, THREE.Object3D.DEFAULT_UP).normalize();

  navMove.set(0, 0, 0).addScaledVector(navForward, forwardInput).addScaledVector(navRight, rightInput);
  if (navMove.lengthSq() > 1e-6) {
    navMove.normalize();
  }

  const dist = camera.position.distanceTo(controls.target);
  const speed = Math.max(32, dist * 0.58) * (shiftHeld ? 2.0 : 1.0);

  navMove.multiplyScalar(speed * dt);
  navClampedTarget.copy(controls.target).add(navMove);
  navClampedTarget.x = THREE.MathUtils.clamp(navClampedTarget.x, -420, 520);
  navClampedTarget.z = THREE.MathUtils.clamp(navClampedTarget.z, -320, 320);

  navMove.copy(navClampedTarget).sub(controls.target);
  controls.target.copy(navClampedTarget);
  camera.position.add(navMove);
}

// Click raycast onto 3D buildings/zones to focus
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (exploration.getMode() !== 'orbit') return;
  const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (dist > 5) return; // Was a drag, not a click

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    const stepId = hit.object.userData?.stepId as string | undefined;
    if (stepId) {
      goToStepById(stepId, true);
      break;
    }
  }
});

// Resize listener
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labels.resize(w, h);
});

// Animation Loop (adaptive 60 FPS during interaction/fly-to, 30 FPS when idle)
const clock = new THREE.Clock();
let lastRenderTime = 0;
let highFpsUntil = performance.now() + 2000;

function boostHighFps(durationMs = 1200): void {
  const until = performance.now() + durationMs;
  if (until > highFpsUntil) highFpsUntil = until;
}

controls.addEventListener('start', () => boostHighFps(1500));
controls.addEventListener('end', () => boostHighFps(1200));
renderer.domElement.addEventListener('wheel', () => boostHighFps(1200), { passive: true });
window.addEventListener('pointermove', (e) => {
  if (e.buttons > 0 || exploration.isPointerLocked()) boostHighFps(1000);
});

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const activeHighFps = !loadingDismissed || flyActive || pressedKeyCodes.size > 0 || now < highFpsUntil;
  const targetIntervalMs = activeHighFps ? 1000 / 60 : 1000 / 30;
  if (lastRenderTime > 0 && now - lastRenderTime < targetIntervalMs - 1.5) {
    return;
  }
  lastRenderTime = now;

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateLoadingOverlay(dt);

  // Update all animated zones
  updateVegetationWind(elapsed);
  env.update(elapsed);
  salineForage.update(elapsed);
  feedProcessing.update(elapsed);
  sheepSheds.update(elapsed);
  manureCompost.update(elapsed);
  outboundHub.update(elapsed);
  logistics.update(elapsed);
  const expState = exploration.update(dt, elapsed);

  const expMode = exploration.getMode();
  if (expMode === 'orbit') {
    // Auto-tour progression (wall-clock elapsed)
    if (autoTour) {
      const nowMs = performance.now();
      if (nowMs - lastAutoStepTime >= AUTO_STEP_DURATION_MS) {
        lastAutoStepTime = nowMs;
        const next = currentStepIndex + 1 >= TOUR_STEPS.length ? 0 : currentStepIndex + 1;
        goToStepIndex(next, false);
      }
    }

    // Smooth camera interpolation or WASD/Arrow roaming
    if (flyActive) {
      const alpha = 1 - Math.exp(-3.4 * dt);
      camera.position.lerp(desiredCamPos, alpha);
      controls.target.lerp(desiredTarget, alpha);
      if (
        camera.position.distanceTo(desiredCamPos) < 0.15 &&
        controls.target.distanceTo(desiredTarget) < 0.15
      ) {
        flyActive = false;
      }
    } else {
      applyKeyboardPan(dt);
    }

    controls.update();
  } else {
    hud.updateExplorationHud(expState);
    if (expState && expState.speedKmh > 0) {
      boostHighFps(900);
    }
  }
  const activeStepId = !manualCameraMoved ? TOUR_STEPS[currentStepIndex]?.id : undefined;
  const nearScienceInterior =
    activeStepId === 'science_interior' ||
    camera.position.distanceToSquared(scienceHubCenter) < 54 * 54;
  outboundHub.setScienceCutaway(nearScienceInterior);
  const nearCommandInterior = camera.position.distanceToSquared(commandCenterPos) < 42 * 42;
  outboundHub.setCommandCutaway(nearCommandInterior);
  const nearTmrInterior =
    activeStepId === 'tmr_interior' ||
    camera.position.distanceToSquared(tmrKitchenCenter) < 56 * 56;
  feedProcessing.setTmrCutaway(nearTmrInterior);
  const cp = camera.position;
  const nearShedInterior =
    activeStepId === 'breeding' ||
    activeStepId === 'sheep_interior' ||
    (cp.y < 36 && cp.x > -108 && cp.x < 118 && cp.z > -136 && cp.z < -2);
  sheepSheds.setRoofCutaway(nearShedInterior);
  renderer.render(scene, camera);
  labels.render(scene, camera);
}

animate();

