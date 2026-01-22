/**
 * main.js - Application Entry Point
 *
 * Integrates:
 * - CA Engine (grid, rules, stepping)
 * - Renderers (cubes, particles, marching cubes)
 * - Post-processing (bloom, SSAO)
 * - UI management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
  Grid,
  createRandom,
  initializeBlob,
  generateNeighborhood,
  getMaxNeighbors,
  createRule,
  computeNeighborIndexDeltas,
  createNeighborOffsets,
  createRuleLookups,
  stepGridOptimized,
  createCAWorker,
  WebGLCACompute,
  RULE_PRESETS
} from './ca-engine.js';

import { RenderMode, RenderManager, ParticleStyle } from './renderers.js';
import { PostEffect, PostProcessingManager } from './postprocessing.js';
import { UIManager } from './ui.js';

// ============================================================
// APPLICATION STATE
// ============================================================

const state = {
  // Grid
  gridSize: 50,
  currentGrid: null,
  nextGrid: null,
  maxState: 16,

  // Simulation
  generation: 0,
  maxGeneration: 0,
  isPlaying: false,
  frameInterval: 50,
  lastFrameTime: 0,
  lastStepTime: 0,
  initialDensity: 0.5,

  // Rule
  rule: null,
  neighborhood: null,
  neighborDeltas: null,
  neighborOffsets: null,
  ruleLookups: null,

  // Compute backends
  caWorker: null,
  workerReady: false,
  pendingStep: false,
  webglCompute: null,
  computeMode: 'cpu',
  workerStepStart: 0,

  // History
  history: [],
  historyIndex: -1,
  MAX_HISTORY: 1000,

  // World
  worldCenter: { x: 0, y: 0, z: 0 },
  displayMode: 'all',
  renderMode: RenderMode.CUBES,
  cellScale: 1.0,
  postEffect: PostEffect.NONE
};

// ============================================================
// THREE.JS SETUP
// ============================================================

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a15);
scene.fog = new THREE.Fog(0x0a0a15, 20, 120);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.01,  // Lower near plane to prevent clipping when close
  2000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 200;

// Lighting
const ambientLight = new THREE.AmbientLight(0x202020, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0x00aa66, 0.4);
directionalLight2.position.set(-30, -30, 30);
scene.add(directionalLight2);

// ============================================================
// MANAGERS
// ============================================================

const MAX_RENDER_INSTANCES = 1000000;
const renderManager = new RenderManager(scene, MAX_RENDER_INSTANCES);
renderManager.setCamera(camera);
const postProcessing = new PostProcessingManager(renderer, scene, camera);

// ============================================================
// UI CALLBACKS
// ============================================================

const uiCallbacks = {
  onPlayPause: () => {
    state.isPlaying = !state.isPlaying;
    ui.setPlaying(state.isPlaying);
  },

  onStop: () => {
    state.isPlaying = false;
    ui.setPlaying(false);
  },

  onStep: () => {
    if (!state.isPlaying) {
      stepSimulation();
    }
  },

  onReset: () => {
    state.isPlaying = false;
    ui.setPlaying(false);
    initSimulation(false);
  },

  onTimelineChange: (index) => {
    if (state.isPlaying) {
      state.isPlaying = false;
      ui.setPlaying(false);
    }
    restoreFromHistory(index);
  },

  onWorldCenterChange: (center) => {
    state.worldCenter = center;
    updateVisualization();
  },

  onPresetChange: (presetName) => {
    const preset = RULE_PRESETS[presetName];
    if (!preset) return;

    // Set particle style for clouds preset (if user manually switches to particles)
    if (presetName === 'clouds') {
      renderManager.setParticleStyle(ParticleStyle.CLOUDS);
    } else {
      renderManager.setParticleStyle(ParticleStyle.DEFAULT);
    }

    applyPreset(preset, presetName);
  },

  onCustomRuleApply: (customPreset) => {
    applyCustomPreset(customPreset);
  },

  onGridSizeChange: (size) => {
    state.gridSize = size;
    state.isPlaying = false;
    ui.setPlaying(false);
    initSimulation(true);
  },

  onSpeedChange: (speed) => {
    state.frameInterval = speed;
  },

  onDensityChange: (density) => {
    state.initialDensity = density;
    state.isPlaying = false;
    ui.setPlaying(false);
    initSimulation(true);
  },

  onStartShapeChange: () => {
    state.isPlaying = false;
    ui.setPlaying(false);
    initSimulation(true);
  },

  onDisplayModeChange: (mode) => {
    state.displayMode = mode;
    updateVisualization();
  },

  onRenderModeChange: (mode) => {
    state.renderMode = mode;
    renderManager.setRenderMode(mode);
    updateVisualization();
  },

  onCellScaleChange: (scale) => {
    state.cellScale = scale;
    renderManager.setCellScale(scale);
    updateVisualization();
  },

  onPostEffectChange: (effect) => {
    state.postEffect = effect;
    postProcessing.setEffect(effect);
  },

  onBloomStrengthChange: (strength) => {
    postProcessing.setBloomStrength(strength);
  },

  onSSAORadiusChange: (radius) => {
    postProcessing.setSSAORadius(radius);
  },

  onSliceAxisChange: (axis) => {
    if (axis !== 'off') {
      ui.updateSliceTexture(state.currentGrid?.data, state.gridSize, state.maxState);
    }
  },

  onSlicePositionChange: () => {
    ui.updateSliceTexture(state.currentGrid?.data, state.gridSize, state.maxState);
  },

  onCameraPreset: (preset) => {
    const offset = state.gridSize * 1.5;
    const wc = state.worldCenter;

    switch (preset) {
      case 'front':
        camera.position.set(0, 0, offset);
        break;
      case 'top':
        camera.position.set(0, offset, 0);
        break;
      case 'corner':
        camera.position.set(offset * 0.8, offset * 0.6, offset * 0.8);
        break;
    }

    camera.lookAt(wc.x, wc.y, wc.z);
    controls.target.set(wc.x, wc.y, wc.z);
    controls.update();
  }
};

const ui = new UIManager(uiCallbacks);

// ============================================================
// SIMULATION FUNCTIONS
// ============================================================

function initSimulation(useSliderValues = false, customPreset = null) {
  const dims = [state.gridSize, state.gridSize, state.gridSize];
  state.currentGrid = new Grid(dims);
  state.nextGrid = new Grid(dims);

  const presetName = document.getElementById('preset')?.value || 'spiky';
  const preset = customPreset || RULE_PRESETS[presetName] || RULE_PRESETS['spiky'];
  const initParams = preset.init;

  state.maxState = preset.states - 1;

  const radiusCells = initParams.radiusCells;
  let density, shape;

  if (useSliderValues) {
    density = state.initialDensity;
    shape = document.getElementById('startShape')?.value || 'sphere';
  } else {
    density = initParams.density;
    shape = initParams.shape || 'sphere';
    state.initialDensity = density;
    ui.updateDensityDisplay(density);
    ui.updateStartShapeDisplay(shape);
  }

  const rng = createRandom(Date.now());
  const effectiveRadius = shape === 'noise' ? 0 : radiusCells;
  initializeBlob(state.currentGrid, density, effectiveRadius, state.maxState, rng, shape);

  const neighborhoodType = preset.neighborhood || 'moore';
  state.neighborhood = generateNeighborhood(dims, { type: neighborhoodType, range: 1 });
  const maxNeighbors = getMaxNeighbors(dims, neighborhoodType, 1);

  state.rule = createRule(preset.birth, preset.survival, maxNeighbors);
  state.neighborDeltas = computeNeighborIndexDeltas(state.neighborhood, state.currentGrid.strides);
  state.neighborOffsets = createNeighborOffsets(state.neighborhood);
  state.ruleLookups = createRuleLookups(state.rule.birth, state.rule.survival, maxNeighbors);

  initComputeBackends(preset);

  state.generation = 0;
  state.maxGeneration = 0;

  // Setup renderer
  renderManager.resize(state.gridSize);
  renderManager.setRenderMode(state.renderMode);
  renderManager.setCellScale(state.cellScale);

  // Setup camera
  const offset = state.gridSize * 1.2;
  camera.position.set(offset, offset * 0.8, offset);
  camera.lookAt(0, 0, 0);
  controls.update();

  // Update fog
  scene.fog.near = state.gridSize;
  scene.fog.far = state.gridSize * 3;

  updateVisualization();
  updateStats();
  clearHistory();

  ui.clearPopHistory();
  ui.setupSliceView(state.gridSize);
}

function initComputeBackends(preset) {
  // Dispose previous
  if (state.caWorker) {
    state.caWorker.terminate();
    state.caWorker = null;
    state.workerReady = false;
  }
  if (state.webglCompute) {
    state.webglCompute.dispose();
    state.webglCompute = null;
  }

  state.pendingStep = false;

  // Try WebGL compute for grids >= 30
  if (state.gridSize >= 30) {
    try {
      state.webglCompute = new WebGLCACompute();
      if (state.webglCompute.init(state.gridSize, preset.birth, preset.survival, state.maxState)) {
        state.webglCompute.uploadGrid(state.currentGrid.data);
        state.computeMode = 'webgl';
        return;
      }
    } catch (e) {
      console.warn('WebGL compute not available:', e);
    }
    state.webglCompute = null;
  }

  // Try Web Worker
  if (state.gridSize >= 30 && typeof Worker !== 'undefined') {
    try {
      state.caWorker = createCAWorker();
      state.caWorker.onmessage = handleWorkerMessage;
      state.caWorker.onerror = (e) => {
        console.warn('Worker error:', e);
        state.caWorker.terminate();
        state.caWorker = null;
        state.workerReady = false;
        state.computeMode = 'cpu';
      };

      state.caWorker.postMessage({
        type: 'init',
        payload: {
          gridSize: state.gridSize,
          gridData: Array.from(state.currentGrid.data),
          deltas: Array.from(state.neighborDeltas),
          offsets: Array.from(state.neighborOffsets),
          birth: Array.from(state.ruleLookups.birth),
          survival: Array.from(state.ruleLookups.survival),
          maxState: state.maxState
        }
      });

      state.computeMode = 'worker';
      return;
    } catch (e) {
      console.warn('Web Worker not available:', e);
      state.caWorker = null;
    }
  }

  state.computeMode = 'cpu';
}

function handleWorkerMessage(e) {
  const { type, data } = e.data;
  switch (type) {
    case 'ready':
      state.workerReady = true;
      break;
    case 'stepComplete':
      state.currentGrid.data.set(data);
      state.pendingStep = false;
      state.generation++;
      if (state.generation > state.maxGeneration) state.maxGeneration = state.generation;
      saveToHistory();
      updateVisualization();
      state.lastStepTime = performance.now() - state.workerStepStart;
      updateStats();
      break;
    case 'resetComplete':
    case 'ruleUpdated':
      state.pendingStep = false;
      break;
  }
}

function stepSimulation() {
  const t0 = performance.now();

  if (state.computeMode === 'webgl' && state.webglCompute?.initialized) {
    state.webglCompute.step();
    state.webglCompute.readGrid(state.currentGrid.data);
    state.generation++;
    if (state.generation > state.maxGeneration) state.maxGeneration = state.generation;
    saveToHistory();
    updateVisualization();
  } else if (state.computeMode === 'worker' && state.caWorker && state.workerReady) {
    if (state.pendingStep) return;
    state.pendingStep = true;
    state.workerStepStart = performance.now();
    state.caWorker.postMessage({ type: 'step' });
    return;
  } else {
    stepGridOptimized(
      state.currentGrid.data,
      state.nextGrid.data,
      state.gridSize,
      state.neighborDeltas,
      state.neighborOffsets,
      state.ruleLookups.birth,
      state.ruleLookups.survival,
      state.maxState
    );
    [state.currentGrid, state.nextGrid] = [state.nextGrid, state.currentGrid];
    state.generation++;
    if (state.generation > state.maxGeneration) state.maxGeneration = state.generation;
    saveToHistory();
    updateVisualization();
  }

  state.lastStepTime = performance.now() - t0;
  updateStats();
}

function updateVisualization() {
  renderManager.update(
    state.currentGrid.data,
    state.gridSize,
    state.maxState,
    state.displayMode,
    state.worldCenter
  );

  ui.updateSliceTexture(state.currentGrid.data, state.gridSize, state.maxState);
}

function updateStats() {
  const pop = state.currentGrid.countPopulation();
  const density = (pop / state.currentGrid.size) * 100;

  ui.updateStats(
    state.generation,
    pop,
    density,
    state.lastStepTime,
    state.computeMode,
    state.maxGeneration
  );

  ui.recordPopulation(pop);
  updateStateBar();
}

function updateStateBar() {
  const data = state.currentGrid.data;
  const counts = new Array(state.maxState + 1).fill(0);
  for (let i = 0; i < data.length; i++) {
    counts[data[i]]++;
  }
  ui.updateStateBar(counts, state.maxState);
}

// ============================================================
// HISTORY MANAGEMENT
// ============================================================

function saveToHistory() {
  const maxHistory = state.gridSize >= 300 ? 5 :
                     state.gridSize >= 200 ? 10 :
                     state.gridSize >= 100 ? 50 :
                     state.gridSize >= 50 ? 200 : state.MAX_HISTORY;

  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  state.history.push({
    data: new Uint8Array(state.currentGrid.data),
    generation: state.generation
  });

  if (state.history.length > maxHistory) {
    state.history.shift();
  } else {
    state.historyIndex++;
  }

  ui.updateTimeline(state.historyIndex, state.history.length);
}

function restoreFromHistory(index) {
  if (index < 0 || index >= state.history.length) return;

  state.historyIndex = index;
  const histState = state.history[state.historyIndex];

  state.currentGrid.data.set(histState.data);
  state.generation = histState.generation;

  if (state.computeMode === 'webgl' && state.webglCompute?.initialized) {
    state.webglCompute.uploadGrid(state.currentGrid.data);
  } else if (state.computeMode === 'worker' && state.caWorker && state.workerReady) {
    state.caWorker.postMessage({
      type: 'reset',
      payload: { gridData: Array.from(state.currentGrid.data), maxState: state.maxState }
    });
  }

  updateVisualization();
  updateStats();
  ui.updateTimeline(state.historyIndex, state.history.length);
}

function clearHistory() {
  state.history = [];
  state.historyIndex = -1;
  saveToHistory();
}

// ============================================================
// PRESET HANDLING
// ============================================================

function applyPreset(preset, presetName) {
  const initParams = preset.init;
  const newMaxState = preset.states - 1;

  if ((initParams.recommendedGridSize && state.gridSize < initParams.recommendedGridSize) ||
      newMaxState !== state.maxState) {
    if (initParams.recommendedGridSize && state.gridSize < initParams.recommendedGridSize) {
      state.gridSize = initParams.recommendedGridSize;
      document.getElementById('gridSize').value = state.gridSize.toString();
    }
    state.isPlaying = false;
    ui.setPlaying(false);
    initSimulation(false);
    return;
  }

  const maxNeighbors = getMaxNeighbors([state.gridSize, state.gridSize, state.gridSize], 'moore', 1);
  state.rule = createRule(preset.birth, preset.survival, maxNeighbors);
  state.maxState = newMaxState;
  state.ruleLookups = createRuleLookups(state.rule.birth, state.rule.survival, maxNeighbors);

  if (state.computeMode === 'webgl' && state.webglCompute) {
    state.webglCompute.setRule(preset.birth, preset.survival);
  } else if (state.computeMode === 'worker' && state.caWorker && state.workerReady) {
    state.caWorker.postMessage({
      type: 'setRule',
      payload: {
        birth: Array.from(state.ruleLookups.birth),
        survival: Array.from(state.ruleLookups.survival),
        maxState: state.maxState
      }
    });
  }

  state.initialDensity = initParams.density;
  ui.updateDensityDisplay(initParams.density);
}

function applyCustomPreset(customPreset) {
  const fullPreset = {
    birth: customPreset.birth,
    survival: customPreset.survival,
    states: customPreset.states,
    init: {
      radiusCells: customPreset.radius || 7,
      density: customPreset.density
    }
  };

  const newMaxState = fullPreset.states - 1;
  if (newMaxState !== state.maxState) {
    state.maxState = newMaxState;
    state.isPlaying = false;
    ui.setPlaying(false);
    initSimulation(false, fullPreset);
  } else {
    const maxNeighbors = getMaxNeighbors([state.gridSize, state.gridSize, state.gridSize], 'moore', 1);
    state.rule = createRule(fullPreset.birth, fullPreset.survival, maxNeighbors);
    state.ruleLookups = createRuleLookups(state.rule.birth, state.rule.survival, maxNeighbors);

    if (state.computeMode === 'webgl' && state.webglCompute) {
      state.webglCompute.setRule(fullPreset.birth, fullPreset.survival);
    } else if (state.computeMode === 'worker' && state.caWorker && state.workerReady) {
      state.caWorker.postMessage({
        type: 'setRule',
        payload: {
          birth: Array.from(state.ruleLookups.birth),
          survival: Array.from(state.ruleLookups.survival),
          maxState: state.maxState
        }
      });
    }

    initSimulation(false, fullPreset);
  }
}

// ============================================================
// ANIMATION LOOP
// ============================================================

function animate(currentTime) {
  requestAnimationFrame(animate);

  if (state.isPlaying && currentTime - state.lastFrameTime >= state.frameInterval) {
    stepSimulation();
    state.lastFrameTime = currentTime;
  }

  controls.update();
  postProcessing.render();
}

// ============================================================
// WINDOW RESIZE
// ============================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postProcessing.resize(window.innerWidth, window.innerHeight);
});

// ============================================================
// TEST INTERFACE
// ============================================================

window.__CA_TEST__ = {
  getState: () => ({
    gridSize: state.gridSize,
    generation: state.generation,
    isPlaying: state.isPlaying,
    frameInterval: state.frameInterval,
    initialDensity: state.initialDensity,
    population: state.currentGrid?.countPopulation() ?? 0,
    computeMode: state.computeMode,
    workerReady: state.workerReady,
    webglInitialized: state.webglCompute?.initialized ?? false,
    renderMode: state.renderMode,
    postEffect: state.postEffect
  }),

  getRendererInfo: () => ({
    meshCount: renderManager.getMeshCount(),
    isContextLost: renderer?.getContext()?.isContextLost() ?? true
  }),

  actions: {
    step: () => uiCallbacks.onStep(),
    reset: () => uiCallbacks.onReset(),
    play: () => { if (!state.isPlaying) uiCallbacks.onPlayPause(); },
    pause: () => { if (state.isPlaying) uiCallbacks.onPlayPause(); }
  }
};

// ============================================================
// INITIALIZATION
// ============================================================

ui.init();
initSimulation();
animate(0);
