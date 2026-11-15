import { CycleId, TOUR_STEPS, TourStep } from '../data/tourSteps';
import { LightingMode } from '../scene/environment';

export interface HudCallbacks {
  onSelectStep: (stepIndex: number, stopAutoTour?: boolean) => void;
  onToggleAutoTour: () => void;
  onToggleFlows: (visible: boolean) => void;
  onChangeCycles: (activeCycles: Set<CycleId>) => void;
  onToggleLabels: (visible: boolean) => void;
  onChangeLighting: (mode: LightingMode) => void;
  onRemediationChange: (progress: number) => void;
  onResetView: () => void;
}

export interface HudController {
  setActiveStep: (stepIndex: number) => void;
  setAutoTourState: (playing: boolean) => void;
}

export function initHud(callbacks: HudCallbacks): HudController {
  const timelineContainer = document.getElementById('timeline-steps')!;
  const stepBadgeEl = document.getElementById('story-step-badge')!;
  const storyTitleEl = document.getElementById('story-title')!;
  const storyDescEl = document.getElementById('story-desc')!;
  const storyChainEl = document.getElementById('story-chain')!;
  const storyTagsEl = document.getElementById('story-tags')!;
  const storySpecsEl = document.getElementById('story-specs')!;
  const storyPanelEl = document.getElementById('story-panel')!;
  const leftWidgetsEl = document.getElementById('left-widgets');

  const btnCollapse = document.getElementById('btn-collapse-story')!;
  const btnCollapseLeft = document.getElementById('btn-collapse-left');
  const btnPrev = document.getElementById('btn-prev-step')!;
  const btnNext = document.getElementById('btn-next-step')!;
  const btnAutoTour = document.getElementById('btn-auto-tour')!;
  const autoIcon = document.getElementById('auto-tour-icon')!;
  const autoText = document.getElementById('auto-tour-text')!;

  const btnFlows = document.getElementById('btn-toggle-flows')!;
  const btnLabels = document.getElementById('btn-toggle-labels')!;
  const btnReset = document.getElementById('btn-reset-view')!;
  const cycleFiltersEl = document.getElementById('cycle-filters');
  const flowLegend = document.getElementById('flow-legend') ?? cycleFiltersEl?.closest<HTMLElement>('.hud-card') ?? null;
  const btnCycleAll = document.getElementById('btn-cycle-all');
  const cycleChips = Array.from(document.querySelectorAll<HTMLButtonElement>('#cycle-filters .cycle-chip'));

  const slider = document.getElementById('remediation-slider') as HTMLInputElement;
  const yearLabel = document.getElementById('remediation-year-label')!;
  const statSalinity = document.getElementById('stat-salinity')!;
  const statCoverage = document.getElementById('stat-coverage')!;
  const statOrganic = document.getElementById('stat-organic')!;

  let currentIndex = 0;
  let flowsVisible = true;
  let labelsVisible = true;

  // Build bottom timeline pills
  const stepButtons: HTMLButtonElement[] = [];
  TOUR_STEPS.forEach((step, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `step-btn${idx === 0 ? ' active' : ''}`;
    btn.innerHTML = `<span class="step-num">${idx}</span><span>${step.shortTitle}</span>`;
    btn.addEventListener('click', () => callbacks.onSelectStep(idx, true));
    timelineContainer.appendChild(btn);
    stepButtons.push(btn);
  });

  const renderStory = (step: TourStep) => {
    stepBadgeEl.textContent = step.indexLabel;
    storyTitleEl.textContent = step.title;
    storyDescEl.textContent = step.description;
    storyChainEl.textContent = step.loopChain;

    storyTagsEl.innerHTML = '';
    for (const eq of step.equipment) {
      const span = document.createElement('span');
      span.className = 'tag-chip';
      span.textContent = eq;
      storyTagsEl.appendChild(span);
    }

    storySpecsEl.innerHTML = '';
    for (const sp of step.specs) {
      const box = document.createElement('div');
      box.className = 'spec-box';
      box.innerHTML = `<small>${sp.label}</small><strong>${sp.value}</strong>`;
      storySpecsEl.appendChild(box);
    }
  };

  btnCollapse.addEventListener('click', () => {
    const collapsed = storyPanelEl.classList.toggle('collapsed');
    btnCollapse.textContent = collapsed ? '展开' : '收起';
  });

  btnCollapseLeft?.addEventListener('click', () => {
    if (!leftWidgetsEl) return;
    const collapsed = leftWidgetsEl.classList.toggle('collapsed');
    btnCollapseLeft.textContent = collapsed ? '展开' : '收起';
  });

  btnPrev.addEventListener('click', () => {
    const prev = (currentIndex - 1 + TOUR_STEPS.length) % TOUR_STEPS.length;
    callbacks.onSelectStep(prev, true);
  });

  btnNext.addEventListener('click', () => {
    const next = (currentIndex + 1) % TOUR_STEPS.length;
    callbacks.onSelectStep(next, true);
  });

  btnAutoTour.addEventListener('click', () => {
    callbacks.onToggleAutoTour();
  });

  btnFlows.addEventListener('click', () => {
    flowsVisible = !flowsVisible;
    btnFlows.classList.toggle('active', flowsVisible);
    if (flowLegend) {
      flowLegend.style.display = flowsVisible ? 'block' : 'none';
    }
    callbacks.onToggleFlows(flowsVisible);
  });

  // 6-Cycle Loop Filtering
  const activeCycles = new Set<CycleId>(['grass', 'feed', 'water', 'manure', 'energy', 'digital']);
  const syncCycleChips = () => {
    cycleChips.forEach((chip) => {
      const cid = chip.dataset.cycle as CycleId | undefined;
      if (cid) {
        chip.classList.toggle('active', activeCycles.has(cid));
      }
    });
    btnCycleAll?.classList.toggle('active', activeCycles.size === cycleChips.length && cycleChips.length > 0);
    callbacks.onChangeCycles(new Set(activeCycles));
  };

  cycleChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const cid = chip.dataset.cycle as CycleId | undefined;
      if (!cid) return;
      if (activeCycles.has(cid)) {
        if (activeCycles.size > 1) {
          activeCycles.delete(cid);
        }
      } else {
        activeCycles.add(cid);
      }
      syncCycleChips();
    });
  });

  btnCycleAll?.addEventListener('click', () => {
    cycleChips.forEach((chip) => {
      const cid = chip.dataset.cycle as CycleId | undefined;
      if (cid) activeCycles.add(cid);
    });
    syncCycleChips();
  });

  btnLabels.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    btnLabels.classList.toggle('active', labelsVisible);
    callbacks.onToggleLabels(labelsVisible);
  });

  btnReset.addEventListener('click', () => {
    callbacks.onResetView();
  });

  // Lighting segmented control
  const lightBtns = document.querySelectorAll<HTMLButtonElement>('.seg-btn');
  lightBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      lightBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = (btn.dataset.light as LightingMode) || 'daylight';
      callbacks.onChangeLighting(mode);
    });
  });

  // Saline remediation slider
  const updateSliderUi = (val: number) => {
    const t = val / 100;
    if (t < 0.33) {
      yearLabel.textContent = '第 1 年 · 排盐洗盐期';
      statOrganic.textContent = '启动改良';
    } else if (t < 0.72) {
      yearLabel.textContent = '第 2 年 · 肥田过渡期';
      statOrganic.textContent = '稳步积累';
    } else {
      yearLabel.textContent = '第 3 年 · 生态良田';
      statOrganic.textContent = '显著提升';
    }
    const salinity = (8.8 - t * 6.9).toFixed(1);
    const coverage = Math.round(24 + t * 70);
    statSalinity.textContent = `${salinity}‰`;
    statCoverage.textContent = `${coverage}%`;
    callbacks.onRemediationChange(t);
  };

  slider.addEventListener('input', () => {
    updateSliderUi(Number(slider.value));
  });
  updateSliderUi(Number(slider.value));

  renderStory(TOUR_STEPS[0]);

  return {
    setActiveStep(stepIndex: number) {
      currentIndex = stepIndex;
      stepButtons.forEach((b, i) => b.classList.toggle('active', i === stepIndex));
      renderStory(TOUR_STEPS[stepIndex]);
      stepButtons[stepIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    },
    setAutoTourState(playing: boolean) {
      btnAutoTour.classList.toggle('playing', playing);
      autoIcon.textContent = playing ? '⏸' : '▶';
      autoText.textContent = playing ? '暂停自动漫游' : '自动演示漫游';
    },
  };
}

