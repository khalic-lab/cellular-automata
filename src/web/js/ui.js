/**
 * ui.js - UI State Management and Event Handlers
 *
 * Contains:
 * - UIManager class for binding events and updating UI
 * - Rule editor functionality
 * - Slice view management
 * - Population graph
 * - State distribution bar
 */

const STORAGE_KEY = 'ca3d_custom_rules';
const MAX_NEIGHBORS = 26;

export class UIManager {
  constructor(callbacks) {
    this.callbacks = callbacks;

    // State
    this.birthSet = new Set();
    this.survivalSet = new Set();
    this.currentCustomRuleName = null;
    this.sliceAxis = 'off';
    this.slicePosition = 10;
    this.displayMode = 'all';
    this.popHistory = [];
    this.MAX_POP_HISTORY = 200;

    // DOM elements (will be populated in init)
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.initRuleEditor();
    this.updateCustomRulesDropdown();
    this.updateSavedRulesList();
  }

  cacheElements() {
    this.elements = {
      // Controls
      playPauseBtn: document.getElementById('playPause'),
      stopBtn: document.getElementById('stop'),
      stepBtn: document.getElementById('step'),
      resetBtn: document.getElementById('reset'),

      // Timeline
      timelineSlider: document.getElementById('timeline'),
      timelineValue: document.getElementById('timelineValue'),

      // World center
      centerXSlider: document.getElementById('centerX'),
      centerYSlider: document.getElementById('centerY'),
      centerZSlider: document.getElementById('centerZ'),
      centerXValue: document.getElementById('centerXValue'),
      centerYValue: document.getElementById('centerYValue'),
      centerZValue: document.getElementById('centerZValue'),

      // Settings
      presetSelect: document.getElementById('preset'),
      gridSizeSelect: document.getElementById('gridSize'),
      speedSlider: document.getElementById('speed'),
      speedValue: document.getElementById('speedValue'),
      densitySlider: document.getElementById('density'),
      densityValue: document.getElementById('densityValue'),
      startShapeSelect: document.getElementById('startShape'),

      // Statistics
      generationEl: document.getElementById('generation'),
      populationEl: document.getElementById('population'),
      densityStatEl: document.getElementById('densityStat'),
      stepTimeEl: document.getElementById('stepTime'),
      computeModeEl: document.getElementById('computeMode'),
      maxGenEl: document.getElementById('maxGen'),

      // Display
      displayModeSelect: document.getElementById('displayMode'),
      renderModeSelect: document.getElementById('renderMode'),

      // Slice view
      sliceAxisSelect: document.getElementById('sliceAxis'),
      slicePosRow: document.getElementById('slicePosRow'),
      slicePosSlider: document.getElementById('slicePos'),
      slicePosValue: document.getElementById('slicePosValue'),
      sliceCanvas: document.getElementById('sliceCanvas'),

      // Population graph
      popGraphCanvas: document.getElementById('popGraph'),
      stateBar: document.getElementById('stateBar'),
      stateLegend: document.getElementById('stateLegend'),

      // Rule editor
      ruleEditor: document.getElementById('ruleEditor'),
      ruleNameInput: document.getElementById('ruleName'),
      birthGrid: document.getElementById('birthGrid'),
      survivalGrid: document.getElementById('survivalGrid'),
      birthSummary: document.getElementById('birthSummary'),
      survivalSummary: document.getElementById('survivalSummary'),
      ruleStatesInput: document.getElementById('ruleStates'),
      ruleInitDensityInput: document.getElementById('ruleInitDensity'),
      ruleInitRadiusInput: document.getElementById('ruleInitRadius'),
      ruleApplyBtn: document.getElementById('ruleApply'),
      ruleSaveBtn: document.getElementById('ruleSave'),
      ruleDeleteBtn: document.getElementById('ruleDelete'),
      ruleExportBtn: document.getElementById('ruleExport'),
      ruleImportBtn: document.getElementById('ruleImport'),
      ruleImportFile: document.getElementById('ruleImportFile'),
      savedRulesList: document.getElementById('savedRulesList'),
      customRulesGroup: document.getElementById('customRulesGroup'),

      // New controls
      cellScaleSlider: document.getElementById('cellScale'),
      cellScaleValue: document.getElementById('cellScaleValue'),
      wireframeCheckbox: document.getElementById('wireframe'),
      outlinesCheckbox: document.getElementById('outlines'),
      postEffectSelect: document.getElementById('postEffect'),
      bloomControls: document.getElementById('bloomControls'),
      bloomStrengthSlider: document.getElementById('bloomStrength'),
      bloomStrengthValue: document.getElementById('bloomStrengthValue'),
      ssaoControls: document.getElementById('ssaoControls'),
      ssaoRadiusSlider: document.getElementById('ssaoRadius'),
      ssaoRadiusValue: document.getElementById('ssaoRadiusValue'),

      // Camera
      camFrontBtn: document.getElementById('camFront'),
      camTopBtn: document.getElementById('camTop'),
      camCornerBtn: document.getElementById('camCorner'),

      // Speed presets
      speedFastBtn: document.getElementById('speedFast'),
      speedNormalBtn: document.getElementById('speedNormal'),
      speedSlowBtn: document.getElementById('speedSlow')
    };
  }

  bindEvents() {
    const e = this.elements;
    const cb = this.callbacks;

    // Play/Pause/Stop/Step/Reset
    e.playPauseBtn?.addEventListener('click', () => cb.onPlayPause?.());
    e.stopBtn?.addEventListener('click', () => cb.onStop?.());
    e.stepBtn?.addEventListener('click', () => cb.onStep?.());
    e.resetBtn?.addEventListener('click', () => cb.onReset?.());

    // Timeline
    e.timelineSlider?.addEventListener('input', () => {
      cb.onTimelineChange?.(parseInt(e.timelineSlider.value));
    });

    // World center
    const updateWorldCenter = () => {
      const x = parseInt(e.centerXSlider?.value || 0);
      const y = parseInt(e.centerYSlider?.value || 0);
      const z = parseInt(e.centerZSlider?.value || 0);
      if (e.centerXValue) e.centerXValue.textContent = x;
      if (e.centerYValue) e.centerYValue.textContent = y;
      if (e.centerZValue) e.centerZValue.textContent = z;
      cb.onWorldCenterChange?.({ x, y, z });
    };
    e.centerXSlider?.addEventListener('input', updateWorldCenter);
    e.centerYSlider?.addEventListener('input', updateWorldCenter);
    e.centerZSlider?.addEventListener('input', updateWorldCenter);

    // Preset
    e.presetSelect?.addEventListener('change', () => {
      this.handlePresetChange(e.presetSelect.value);
    });

    // Grid size
    e.gridSizeSelect?.addEventListener('change', () => {
      cb.onGridSizeChange?.(parseInt(e.gridSizeSelect.value));
    });

    // Speed
    e.speedSlider?.addEventListener('input', () => {
      const value = parseInt(e.speedSlider.value);
      if (e.speedValue) e.speedValue.textContent = value + 'ms';
      cb.onSpeedChange?.(value);
    });

    // Density
    e.densitySlider?.addEventListener('change', () => {
      const value = parseFloat(e.densitySlider.value);
      if (e.densityValue) e.densityValue.textContent = this.formatDensity(value);
      cb.onDensityChange?.(value);
    });
    e.densitySlider?.addEventListener('input', () => {
      if (e.densityValue) e.densityValue.textContent = this.formatDensity(parseFloat(e.densitySlider.value));
    });

    // Start shape
    e.startShapeSelect?.addEventListener('change', () => {
      cb.onStartShapeChange?.(e.startShapeSelect.value);
    });

    // Display mode
    e.displayModeSelect?.addEventListener('change', () => {
      this.displayMode = e.displayModeSelect.value;
      cb.onDisplayModeChange?.(this.displayMode);
    });

    // Render mode
    e.renderModeSelect?.addEventListener('change', () => {
      cb.onRenderModeChange?.(e.renderModeSelect.value);
    });

    // Slice view
    e.sliceAxisSelect?.addEventListener('change', () => {
      this.sliceAxis = e.sliceAxisSelect.value;
      if (e.slicePosRow) {
        e.slicePosRow.style.display = this.sliceAxis === 'off' ? 'none' : 'flex';
      }
      if (e.sliceCanvas) {
        e.sliceCanvas.style.display = this.sliceAxis === 'off' ? 'none' : 'block';
      }
      cb.onSliceAxisChange?.(this.sliceAxis);
    });
    e.slicePosSlider?.addEventListener('input', () => {
      this.slicePosition = parseInt(e.slicePosSlider.value);
      if (e.slicePosValue) e.slicePosValue.textContent = this.slicePosition;
      cb.onSlicePositionChange?.(this.slicePosition);
    });

    // Cell scale
    e.cellScaleSlider?.addEventListener('input', () => {
      const value = parseFloat(e.cellScaleSlider.value);
      if (e.cellScaleValue) e.cellScaleValue.textContent = value.toFixed(2);
      cb.onCellScaleChange?.(value);
    });

    // Wireframe
    e.wireframeCheckbox?.addEventListener('change', () => {
      cb.onWireframeChange?.(e.wireframeCheckbox.checked);
    });

    // Outlines
    e.outlinesCheckbox?.addEventListener('change', () => {
      cb.onOutlinesChange?.(e.outlinesCheckbox.checked);
    });

    // Post-processing
    e.postEffectSelect?.addEventListener('change', () => {
      const effect = e.postEffectSelect.value;
      this.updatePostEffectControls(effect);
      cb.onPostEffectChange?.(effect);
    });
    e.bloomStrengthSlider?.addEventListener('input', () => {
      const value = parseFloat(e.bloomStrengthSlider.value);
      if (e.bloomStrengthValue) e.bloomStrengthValue.textContent = value.toFixed(1);
      cb.onBloomStrengthChange?.(value);
    });
    e.ssaoRadiusSlider?.addEventListener('input', () => {
      const value = parseInt(e.ssaoRadiusSlider.value);
      if (e.ssaoRadiusValue) e.ssaoRadiusValue.textContent = value;
      cb.onSSAORadiusChange?.(value);
    });

    // Camera presets
    e.camFrontBtn?.addEventListener('click', () => cb.onCameraPreset?.('front'));
    e.camTopBtn?.addEventListener('click', () => cb.onCameraPreset?.('top'));
    e.camCornerBtn?.addEventListener('click', () => cb.onCameraPreset?.('corner'));

    // Speed presets
    e.speedFastBtn?.addEventListener('click', () => this.setSpeed(50));
    e.speedNormalBtn?.addEventListener('click', () => this.setSpeed(200));
    e.speedSlowBtn?.addEventListener('click', () => this.setSpeed(500));

    // Rule editor buttons
    e.ruleApplyBtn?.addEventListener('click', () => this.applyCustomRule());
    e.ruleSaveBtn?.addEventListener('click', () => this.saveCustomRule());
    e.ruleDeleteBtn?.addEventListener('click', () => this.deleteCustomRule());
    e.ruleExportBtn?.addEventListener('click', () => this.exportAllRules());
    e.ruleImportBtn?.addEventListener('click', () => e.ruleImportFile?.click());
    e.ruleImportFile?.addEventListener('change', (ev) => {
      if (ev.target.files.length > 0) {
        this.importRules(ev.target.files[0]);
        ev.target.value = '';
      }
    });
  }

  handlePresetChange(value) {
    const e = this.elements;

    if (value === '__custom__') {
      if (e.ruleEditor) e.ruleEditor.style.display = 'block';
      return;
    }

    if (e.ruleEditor) e.ruleEditor.style.display = 'none';

    if (value.startsWith('__saved__:')) {
      const ruleName = value.substring(10);
      const savedRules = this.loadSavedRules();
      const savedRule = savedRules[ruleName];
      if (savedRule) {
        this.callbacks.onCustomRuleApply?.(savedRule);
      }
      return;
    }

    this.callbacks.onPresetChange?.(value);
  }

  updatePostEffectControls(effect) {
    const e = this.elements;
    if (e.bloomControls) {
      e.bloomControls.style.display = (effect === 'bloom' || effect === 'bloom+ssao') ? 'block' : 'none';
    }
    if (e.ssaoControls) {
      e.ssaoControls.style.display = (effect === 'ssao' || effect === 'bloom+ssao') ? 'block' : 'none';
    }
  }

  setSpeed(ms) {
    const e = this.elements;
    if (e.speedSlider) e.speedSlider.value = ms;
    if (e.speedValue) e.speedValue.textContent = ms + 'ms';
    this.callbacks.onSpeedChange?.(ms);
  }

  formatDensity(value) {
    const pct = value * 100;
    return pct < 1 ? pct.toFixed(1) + '%' : Math.round(pct) + '%';
  }

  // ============================================================
  // STATS UPDATE
  // ============================================================

  updateStats(gen, pop, density, stepTime, computeMode, maxGen) {
    const e = this.elements;
    if (e.generationEl) e.generationEl.textContent = gen;
    if (e.populationEl) e.populationEl.textContent = pop;
    if (e.densityStatEl) e.densityStatEl.textContent = density.toFixed(1) + '%';
    if (e.stepTimeEl) e.stepTimeEl.textContent = stepTime.toFixed(0) + 'ms';
    if (e.computeModeEl) e.computeModeEl.textContent = computeMode;
    if (e.maxGenEl) e.maxGenEl.textContent = maxGen;
  }

  updateTimeline(index, total) {
    const e = this.elements;
    if (e.timelineSlider) {
      e.timelineSlider.max = Math.max(0, total - 1);
      e.timelineSlider.value = index;
    }
    if (e.timelineValue) {
      e.timelineValue.textContent = `${index + 1} / ${total}`;
    }
  }

  setPlaying(isPlaying) {
    const e = this.elements;
    if (e.playPauseBtn) {
      e.playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    }
  }

  // ============================================================
  // POPULATION GRAPH
  // ============================================================

  recordPopulation(pop) {
    this.popHistory.push(pop);
    if (this.popHistory.length > this.MAX_POP_HISTORY) {
      this.popHistory.shift();
    }
    this.updatePopGraph();
  }

  clearPopHistory() {
    this.popHistory.length = 0;
    this.updatePopGraph();
  }

  updatePopGraph() {
    const canvas = this.elements.popGraphCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (this.popHistory.length < 2) return;

    const maxPop = Math.max(...this.popHistory);
    const minPop = Math.min(...this.popHistory);
    const range = maxPop - minPop || 1;

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    this.popHistory.forEach((pop, i) => {
      const x = (i / (this.popHistory.length - 1)) * w;
      const y = h - ((pop - minPop) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ============================================================
  // STATE DISTRIBUTION BAR
  // ============================================================

  updateStateBar(counts, maxState) {
    const e = this.elements;
    if (!e.stateBar || !e.stateLegend) return;

    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return;

    // Generate colors
    const colors = ['#333']; // Dead = dark
    for (let i = 1; i < maxState; i++) {
      const t = i / maxState;
      const hue = 30 - t * 30;
      const l = 50 + t * 20;
      colors.push(`hsl(${hue}, 100%, ${l}%)`);
    }
    colors.push('#00ffdd'); // Alive = cyan

    e.stateBar.innerHTML = counts.map((c, i) =>
      c > 0 ? `<div style="flex:${c}; background:${colors[i]}" title="State ${i}: ${(c/total*100).toFixed(1)}%"></div>` : ''
    ).join('');

    const alive = counts[maxState] || 0;
    const decaying = counts.slice(1, maxState).reduce((a, b) => a + b, 0);
    const dead = counts[0] || 0;
    e.stateLegend.textContent = `Alive: ${(alive/total*100).toFixed(1)}% | Decay: ${(decaying/total*100).toFixed(1)}% | Dead: ${(dead/total*100).toFixed(1)}%`;
  }

  // ============================================================
  // SLICE VIEW
  // ============================================================

  setupSliceView(gridSize) {
    const e = this.elements;
    if (e.slicePosSlider) {
      e.slicePosSlider.max = gridSize - 1;
      this.slicePosition = Math.floor(gridSize / 2);
      e.slicePosSlider.value = this.slicePosition;
    }
    if (e.slicePosValue) {
      e.slicePosValue.textContent = this.slicePosition;
    }
    if (e.sliceCanvas) {
      e.sliceCanvas.style.display = this.sliceAxis === 'off' ? 'none' : 'block';
    }
  }

  updateSliceTexture(gridData, gridSize, maxState) {
    if (this.sliceAxis === 'off' || !gridData) return;

    const canvas = this.elements.sliceCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = gridSize;
    const size2 = size * size;
    const pos = this.slicePosition;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    const imageData = ctx.createImageData(size, size);
    const pixels = imageData.data;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let x, y, z;

        if (this.sliceAxis === 'x') {
          x = pos;
          y = size - 1 - row;
          z = col;
        } else if (this.sliceAxis === 'y') {
          x = size - 1 - row;
          y = pos;
          z = col;
        } else {
          x = col;
          y = size - 1 - row;
          z = pos;
        }

        const idx = x * size2 + y * size + z;
        const state = gridData[idx];
        const pxIdx = (row * size + col) * 4;

        if (state === maxState) {
          pixels[pxIdx] = 0;
          pixels[pxIdx + 1] = 255;
          pixels[pxIdx + 2] = 221;
          pixels[pxIdx + 3] = 255;
        } else if (state > 0) {
          const t = state / maxState;
          pixels[pxIdx] = 255;
          pixels[pxIdx + 1] = Math.floor(t * 200);
          pixels[pxIdx + 2] = 0;
          pixels[pxIdx + 3] = 255;
        } else {
          pixels[pxIdx] = 26;
          pixels[pxIdx + 1] = 26;
          pixels[pxIdx + 2] = 46;
          pixels[pxIdx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // ============================================================
  // RULE EDITOR
  // ============================================================

  initRuleEditor() {
    this.createToggleGrid(this.elements.birthGrid, this.birthSet, '#00ff88', this.elements.birthSummary);
    this.createToggleGrid(this.elements.survivalGrid, this.survivalSet, '#00aaff', this.elements.survivalSummary);
  }

  createToggleGrid(container, set, color, summaryEl) {
    if (!container) return;
    container.innerHTML = '';

    const groups = [
      { label: 'Sparse', range: [0, 8], desc: '0-8' },
      { label: 'Medium', range: [9, 17], desc: '9-17' },
      { label: 'Dense', range: [18, 26], desc: '18-26' }
    ];

    groups.forEach(group => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; margin-bottom:3px;';

      const label = document.createElement('span');
      label.textContent = group.label;
      label.title = `${group.desc} neighbors alive`;
      label.style.cssText = 'width:50px; font-size:9px; color:#555; flex-shrink:0;';
      row.appendChild(label);

      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex; gap:2px; flex-wrap:wrap;';

      for (let i = group.range[0]; i <= group.range[1]; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'toggle-btn';
        btn.dataset.value = i;
        const density = i / MAX_NEIGHBORS;
        const hintColor = `rgba(255,255,255,${0.02 + density * 0.05})`;
        btn.style.cssText = `
          width: 22px; height: 22px; padding: 0; margin: 0;
          font-size: 10px; font-weight: bold;
          border: 1px solid #3a3a5a; border-radius: 3px;
          cursor: pointer; transition: all 0.15s;
          background: ${set.has(i) ? color : hintColor};
          color: ${set.has(i) ? '#1a1a2e' : '#666'};
        `;
        btn.title = `${i} neighbors (${Math.round(i/26*100)}% surrounded)`;
        btn.addEventListener('click', () => {
          if (set.has(i)) {
            set.delete(i);
            btn.style.background = hintColor;
            btn.style.color = '#666';
          } else {
            set.add(i);
            btn.style.background = color;
            btn.style.color = '#1a1a2e';
          }
          this.updateRuleSummary(set, summaryEl);
        });
        btns.appendChild(btn);
      }

      row.appendChild(btns);
      container.appendChild(row);
    });

    this.updateRuleSummary(set, summaryEl);
  }

  updateRuleSummary(set, summaryEl) {
    if (!summaryEl) return;
    const arr = [...set].sort((a, b) => a - b);
    if (arr.length === 0) {
      summaryEl.textContent = 'none';
      return;
    }
    const ranges = [];
    let start = arr[0], end = arr[0];
    for (let i = 1; i <= arr.length; i++) {
      if (i < arr.length && arr[i] === end + 1) {
        end = arr[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        if (i < arr.length) {
          start = end = arr[i];
        }
      }
    }
    summaryEl.textContent = ranges.join(',');
  }

  setGridValues(container, set, values, color, summaryEl) {
    set.clear();
    values.forEach(v => set.add(v));
    const buttons = container?.querySelectorAll('button');
    buttons?.forEach(btn => {
      const v = parseInt(btn.dataset.value);
      const active = set.has(v);
      const density = v / MAX_NEIGHBORS;
      const hintColor = `rgba(255,255,255,${0.02 + density * 0.05})`;
      btn.style.background = active ? color : hintColor;
      btn.style.color = active ? '#1a1a2e' : '#666';
    });
    this.updateRuleSummary(set, summaryEl);
  }

  loadSavedRules() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  saveSavedRules(rules) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }

  updateCustomRulesDropdown() {
    const e = this.elements;
    if (!e.customRulesGroup) return;

    const rules = this.loadSavedRules();
    const options = e.customRulesGroup.querySelectorAll('option:not([value="__custom__"])');
    options.forEach(opt => opt.remove());

    const editOption = e.customRulesGroup.querySelector('option[value="__custom__"]');
    Object.keys(rules).sort().forEach(name => {
      const opt = document.createElement('option');
      opt.value = '__saved__:' + name;
      opt.textContent = name;
      e.customRulesGroup.insertBefore(opt, editOption);
    });
  }

  updateSavedRulesList() {
    const e = this.elements;
    if (!e.savedRulesList) return;

    const rules = this.loadSavedRules();
    const names = Object.keys(rules).sort();
    if (names.length === 0) {
      e.savedRulesList.innerHTML = '<div style="font-size:11px; color:#666;">No saved rules</div>';
      return;
    }
    e.savedRulesList.innerHTML = names.map(name =>
      `<div class="saved-rule-item" data-rule="${name}"
            style="font-size:11px; padding:4px; cursor:pointer; border-radius:4px; margin-bottom:2px; background:#1a1a2e;">${name}</div>`
    ).join('');

    // Add click handlers
    e.savedRulesList.querySelectorAll('.saved-rule-item').forEach(item => {
      item.addEventListener('click', () => this.loadCustomRule(item.dataset.rule));
      item.addEventListener('mouseover', () => item.style.background = '#3a3a5a');
      item.addEventListener('mouseout', () => item.style.background = '#1a1a2e');
    });
  }

  loadCustomRule(name) {
    const rules = this.loadSavedRules();
    const rule = rules[name];
    if (!rule) return;

    const e = this.elements;
    this.currentCustomRuleName = name;
    if (e.ruleNameInput) e.ruleNameInput.value = name;
    this.setGridValues(e.birthGrid, this.birthSet, rule.birth, '#00ff88', e.birthSummary);
    this.setGridValues(e.survivalGrid, this.survivalSet, rule.survival, '#00aaff', e.survivalSummary);
    if (e.ruleStatesInput) e.ruleStatesInput.value = rule.states;
    if (e.ruleInitDensityInput) e.ruleInitDensityInput.value = Math.round(rule.density * 100);
    if (e.ruleInitRadiusInput) e.ruleInitRadiusInput.value = rule.radius;
  }

  applyCustomRule() {
    const e = this.elements;
    const birth = [...this.birthSet].sort((a, b) => a - b);
    const survival = [...this.survivalSet].sort((a, b) => a - b);
    const states = parseInt(e.ruleStatesInput?.value) || 2;
    const density = (parseInt(e.ruleInitDensityInput?.value) || 40) / 100;
    const radius = parseInt(e.ruleInitRadiusInput?.value) || 7;

    if (birth.length === 0 && survival.length === 0) {
      alert('Please select at least one birth or survival neighbor count');
      return;
    }

    const customPreset = {
      birth,
      survival,
      states,
      density,
      radius,
      init: { radiusCells: radius, density }
    };

    this.callbacks.onCustomRuleApply?.(customPreset);
  }

  saveCustomRule() {
    const e = this.elements;
    const name = e.ruleNameInput?.value.trim();
    if (!name) {
      alert('Please enter a rule name');
      return;
    }

    const birth = [...this.birthSet].sort((a, b) => a - b);
    const survival = [...this.survivalSet].sort((a, b) => a - b);

    const rules = this.loadSavedRules();
    rules[name] = {
      birth,
      survival,
      states: parseInt(e.ruleStatesInput?.value) || 2,
      density: (parseInt(e.ruleInitDensityInput?.value) || 40) / 100,
      radius: parseInt(e.ruleInitRadiusInput?.value) || 7
    };
    this.saveSavedRules(rules);

    this.currentCustomRuleName = name;
    this.updateCustomRulesDropdown();
    this.updateSavedRulesList();
  }

  deleteCustomRule() {
    const e = this.elements;
    const name = e.ruleNameInput?.value.trim();
    if (!name) return;

    const rules = this.loadSavedRules();
    if (rules[name]) {
      delete rules[name];
      this.saveSavedRules(rules);
      if (e.ruleNameInput) e.ruleNameInput.value = '';
      this.currentCustomRuleName = null;
      this.updateCustomRulesDropdown();
      this.updateSavedRulesList();
    }
  }

  exportAllRules() {
    const rules = this.loadSavedRules();
    if (Object.keys(rules).length === 0) {
      alert('No saved rules to export');
      return;
    }
    const json = JSON.stringify(rules, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ca3d-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importRules(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (typeof imported !== 'object') throw new Error('Invalid format');

        const existing = this.loadSavedRules();
        let count = 0;
        for (const [name, rule] of Object.entries(imported)) {
          if (Array.isArray(rule.birth) && Array.isArray(rule.survival)) {
            existing[name] = {
              birth: rule.birth,
              survival: rule.survival,
              states: rule.states || 2,
              density: rule.density || 0.4,
              radius: rule.radius || 7
            };
            count++;
          }
        }
        this.saveSavedRules(existing);
        this.updateCustomRulesDropdown();
        this.updateSavedRulesList();
        alert(`Imported ${count} rule(s)`);
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Update density slider display
  updateDensityDisplay(density) {
    const e = this.elements;
    if (e.densitySlider) e.densitySlider.value = density;
    if (e.densityValue) e.densityValue.textContent = this.formatDensity(density);
  }

  // Update start shape display
  updateStartShapeDisplay(shape) {
    const e = this.elements;
    if (e.startShapeSelect) e.startShapeSelect.value = shape;
  }
}
