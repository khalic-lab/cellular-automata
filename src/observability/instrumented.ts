/**
 * Instrumented experiment runners.
 *
 * Provides three levels of instrumentation:
 * 1. Wrapper (timing only) - minimal overhead
 * 2. Post-hoc analysis - pure, no timing
 * 3. Deep instrumented - per-step timing, separate implementation
 *
 * Also includes snapshot-based evolution and resume functionality.
 *
 * Design principle: Core functions remain unchanged. Instrumentation
 * wraps or reimplements to add timing without side effects in core.
 */

import { multiMetricClassifier } from '../classifier.js';
import { runExperiment, runExperimentEnhanced } from '../experiment.js';
import type { EnhancedExperimentResult } from '../experiment.js';
import {
  type Grid,
  computeSpatialEntropy,
  computeStateHash,
  createGrid,
  initializeRandom,
} from '../grid.js';
import { generateNeighborhood, getMaxNeighbors } from '../neighborhood.js';
import { createRandom } from '../random.js';
import { ruleFromThresholds, shouldCellBeAlive } from '../rule.js';
import { evolveEnhanced } from '../stepper.js';
import type { EnhancedMetrics, ExperimentConfig, OutcomeClassifier, Rule } from '../types.js';
import { analyzeExperiment } from './analyzer.js';
import { createSnapshot, restoreGridFromSnapshot } from './snapshot.js';
import type {
  ExperimentSnapshot,
  ExperimentTiming,
  InstrumentedEnhancedResult,
  InstrumentedExperimentResult,
  ResumeOptions,
  SnapshotEvolutionOptions,
  SnapshotEvolutionResult,
  StepTiming,
} from './types.js';

// Use globalThis for cross-platform performance timing
declare const globalThis: {
  performance?: { now: () => number };
};
const perf = globalThis.performance ?? { now: () => Date.now() };

/**
 * Stepper state for manual evolution.
 * Mirrors internal stepper but accessible for instrumentation.
 */
interface StepperState {
  currentGrid: Grid;
  nextGrid: Grid;
  stepCount: number;
}

/**
 * Creates initial stepper state.
 */
function createStepper(initialGrid: Grid): StepperState {
  return {
    currentGrid: initialGrid.clone(),
    nextGrid: initialGrid.clone(),
    stepCount: 0,
  };
}

/**
 * Counts alive neighbors for a cell.
 */
function countNeighbors(grid: Grid, coord: number[], neighborhood: number[][]): number {
  let count = 0;
  for (const offset of neighborhood) {
    const neighborCoord = coord.map((c, i) => c + offset[i]!);
    const wrapped = grid.wrap(neighborCoord);
    count += grid.get(wrapped);
  }
  return count;
}

/**
 * Computes enhanced metrics for a grid.
 */
function computeEnhancedMetricsLocal(
  grid: Grid,
  previousPopulation: number,
  stepNumber: number
): EnhancedMetrics {
  const population = grid.countPopulation();
  const delta = population - previousPopulation;

  return {
    population,
    density: population / grid.size,
    births: Math.max(0, delta),
    deaths: Math.max(0, -delta),
    delta,
    step: stepNumber,
    entropy: computeSpatialEntropy(grid),
    stateHash: computeStateHash(grid),
  };
}

/**
 * Advances grid by one generation with enhanced metrics.
 */
function stepEnhanced(
  state: StepperState,
  rule: Rule,
  neighborhood: number[][]
): { state: StepperState; metrics: EnhancedMetrics } {
  const { currentGrid, nextGrid, stepCount } = state;
  const previousPopulation = currentGrid.countPopulation();
  const coord = new Array(currentGrid.dimensions.length).fill(0);

  function iterateGrid(dim: number): void {
    if (dim === coord.length) {
      const currentState = currentGrid.get(coord);
      const neighborCount = countNeighbors(currentGrid, coord, neighborhood);
      const nextState = shouldCellBeAlive(rule, currentState, neighborCount);
      nextGrid.set(coord, nextState ? 1 : 0);
      return;
    }
    for (let i = 0; i < currentGrid.dimensions[dim]!; i++) {
      coord[dim] = i;
      iterateGrid(dim + 1);
    }
  }

  iterateGrid(0);

  const metrics = computeEnhancedMetricsLocal(nextGrid, previousPopulation, stepCount + 1);

  return {
    state: {
      currentGrid: nextGrid,
      nextGrid: currentGrid,
      stepCount: stepCount + 1,
    },
    metrics,
  };
}

/**
 * Runs experiment with basic instrumentation (timing wrapper).
 *
 * Wraps the pure runExperiment function to add timing.
 * Minimal overhead - only measures total time.
 *
 * @param config - Experiment configuration
 * @param classifier - Optional outcome classifier
 * @returns Experiment result with observability report
 *
 * @example
 * ```typescript
 * const result = runExperimentInstrumented({
 *   dimensions: [20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 100,
 *   initialDensity: 0.3,
 *   seed: 42,
 * });
 *
 * console.log(result.outcome);
 * formatReportToConsole(result.report);
 * ```
 */
export function runExperimentInstrumented(
  config: ExperimentConfig,
  classifier?: OutcomeClassifier
): InstrumentedExperimentResult {
  const totalStart = perf.now();

  // Run the pure function
  const result = runExperiment(config, classifier);

  const totalEnd = perf.now();

  // Build timing (internal phases not measurable without core changes)
  const timing: ExperimentTiming = {
    totalMs: totalEnd - totalStart,
    initializationMs: 0,
    evolutionMs: 0,
    classificationMs: 0,
    averageStepMs: (totalEnd - totalStart) / config.steps,
  };

  // Generate report post-hoc
  const report = analyzeExperiment(result, timing);

  return { ...result, report };
}

/**
 * Runs enhanced experiment with instrumentation.
 *
 * Wraps runExperimentEnhanced to add timing.
 *
 * @param config - Experiment configuration
 * @returns Enhanced result with observability report
 */
export function runExperimentEnhancedInstrumented(
  config: ExperimentConfig
): InstrumentedEnhancedResult {
  const totalStart = perf.now();

  const result = runExperimentEnhanced(config);

  const totalEnd = perf.now();

  const timing: ExperimentTiming = {
    totalMs: totalEnd - totalStart,
    initializationMs: 0,
    evolutionMs: 0,
    classificationMs: 0,
    averageStepMs: (totalEnd - totalStart) / config.steps,
  };

  const report = analyzeExperiment(result, timing);

  return { ...result, report };
}

/**
 * Runs experiment with deep instrumentation (per-step timing).
 *
 * This is a separate implementation that manually orchestrates evolution
 * to capture detailed timing without modifying the core functions.
 *
 * Higher overhead than wrapper mode, but provides:
 * - Per-step timing
 * - Phase timing (init, evolution, classification)
 *
 * @param config - Experiment configuration
 * @returns Enhanced result with detailed timing in report
 *
 * @example
 * ```typescript
 * const result = runExperimentDeepInstrumented({
 *   dimensions: [50, 50],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 500,
 *   initialDensity: 0.3,
 *   seed: 42,
 * });
 *
 * // Access per-step timing
 * console.log('Step timings:', result.report.timing.stepTimings);
 * console.log('Slowest step:', Math.max(...result.report.timing.stepTimings!.map(s => s.durationMs)));
 * ```
 */
export function runExperimentDeepInstrumented(
  config: ExperimentConfig
): InstrumentedEnhancedResult {
  const experimentStart = perf.now();
  const stepTimings: StepTiming[] = [];

  const {
    dimensions,
    neighborhood: neighborhoodConfig,
    rule: ruleConfig,
    steps,
    initialDensity,
    seed = 42,
    metricsInterval = 1,
  } = config;

  // Phase 1: Initialization (timed)
  const initStart = perf.now();
  const grid = createGrid(dimensions);
  const rng = createRandom(seed);
  initializeRandom(grid, initialDensity, rng);
  const { type, range = 1 } = neighborhoodConfig;
  const neighborhood = generateNeighborhood(dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(dimensions, type, range);
  const rule = ruleFromThresholds(ruleConfig.birth, ruleConfig.survival, maxNeighbors);
  const initEnd = perf.now();

  // Phase 2: Evolution (per-step timing)
  const evolutionStart = perf.now();
  let state = createStepper(grid);
  const metricsHistory: EnhancedMetrics[] = [];

  for (let i = 0; i < steps; i++) {
    const stepStart = perf.now();
    const result = stepEnhanced(state, rule, neighborhood);
    const stepEnd = perf.now();

    state = result.state;

    stepTimings.push({
      step: i + 1,
      durationMs: stepEnd - stepStart,
      population: result.metrics.population,
      delta: result.metrics.delta,
    });

    if ((i + 1) % metricsInterval === 0) {
      metricsHistory.push(result.metrics);
    }
  }
  const evolutionEnd = perf.now();

  // Phase 3: Classification (timed)
  const classificationStart = perf.now();
  const classification = multiMetricClassifier(metricsHistory);
  const classificationEnd = perf.now();

  const experimentEnd = perf.now();

  // Build timing breakdown
  const timing: ExperimentTiming = {
    totalMs: experimentEnd - experimentStart,
    initializationMs: initEnd - initStart,
    evolutionMs: evolutionEnd - evolutionStart,
    classificationMs: classificationEnd - classificationStart,
    averageStepMs: (evolutionEnd - evolutionStart) / steps,
    stepTimings,
  };

  // Build result
  const experimentResult: EnhancedExperimentResult = {
    outcome: classification.outcome,
    wolframClass: classification.wolframClass,
    confidence: classification.confidence,
    finalPopulation: state.currentGrid.countPopulation(),
    metricsHistory,
    config,
    details: classification.details,
  };

  const report = analyzeExperiment(experimentResult, timing);

  return { ...experimentResult, report };
}

/**
 * Evolves grid with periodic snapshot callbacks.
 *
 * Core evolution stays pure - callback is for side effects only.
 * Useful for long-running experiments where you want to save
 * checkpoints or enable mid-experiment analysis.
 *
 * @param initialGrid - Starting grid
 * @param rule - Evolution rule
 * @param neighborhood - Precomputed neighborhood offsets
 * @param steps - Number of steps to evolve
 * @param config - Original experiment config (for snapshot)
 * @param options - Snapshot options
 * @returns Final grid, metrics history, and collected snapshots
 *
 * @example
 * ```typescript
 * const result = evolveWithSnapshots(grid, rule, neighborhood, 10000, config, {
 *   metricsInterval: 10,
 *   snapshotInterval: 1000,
 *   onSnapshot: (snapshot, step) => {
 *     fs.writeFileSync(`snapshot_${step}.json`, serializeSnapshot(snapshot));
 *   },
 * });
 * ```
 */
export function evolveWithSnapshots(
  initialGrid: import('../grid.js').Grid,
  rule: Rule,
  neighborhood: number[][],
  steps: number,
  config: ExperimentConfig,
  options: SnapshotEvolutionOptions = {}
): SnapshotEvolutionResult {
  const { metricsInterval = 1, snapshotInterval = 0, onSnapshot } = options;
  const snapshots: ExperimentSnapshot[] = [];

  let state = createStepper(initialGrid);
  const metricsHistory: EnhancedMetrics[] = [];

  for (let i = 0; i < steps; i++) {
    const result = stepEnhanced(state, rule, neighborhood);
    state = result.state;

    if ((i + 1) % metricsInterval === 0) {
      metricsHistory.push(result.metrics);
    }

    // Create snapshot at intervals
    if (snapshotInterval > 0 && (i + 1) % snapshotInterval === 0) {
      const snapshot = createSnapshot(state.currentGrid, i + 1, metricsHistory, config);
      snapshots.push(snapshot);
      onSnapshot?.(snapshot, i + 1);
    }
  }

  return {
    finalGrid: state.currentGrid,
    metricsHistory,
    snapshots,
  };
}

/**
 * Resumes experiment from a snapshot.
 *
 * Can optionally enable instrumentation for the remaining steps,
 * allowing you to enable detailed tracing after discovering
 * something interesting in a fast initial run.
 *
 * @param snapshot - Previously captured snapshot
 * @param options - Resume options (additionalSteps, instrumented, etc.)
 * @returns Experiment result (instrumented if requested)
 *
 * @example
 * ```typescript
 * // Load a previously saved snapshot
 * const snapshot = deserializeSnapshot(fs.readFileSync('snapshot.json', 'utf8'));
 *
 * // Resume with instrumentation enabled
 * const result = resumeFromSnapshot(snapshot, {
 *   additionalSteps: 100,
 *   instrumented: true,
 *   metricsInterval: 1,
 * });
 *
 * // Now you have detailed timing for the interesting part
 * formatReportToConsole(result.report);
 * ```
 */
export function resumeFromSnapshot(
  snapshot: ExperimentSnapshot,
  options: ResumeOptions
): InstrumentedEnhancedResult | EnhancedExperimentResult {
  const grid = restoreGridFromSnapshot(snapshot);
  const config = snapshot.config;

  // Generate neighborhood and rule from config
  const { type, range = 1 } = config.neighborhood;
  const neighborhood = generateNeighborhood(config.dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(config.dimensions, type, range);
  const rule = ruleFromThresholds(config.rule.birth, config.rule.survival, maxNeighbors);

  if (options.instrumented) {
    // Run with deep instrumentation
    const experimentStart = perf.now();
    const stepTimings: StepTiming[] = [];

    let state = createStepper(grid);
    const metricsHistory: EnhancedMetrics[] = [...(snapshot.metricsHistory as EnhancedMetrics[])];

    for (let i = 0; i < options.additionalSteps; i++) {
      const stepStart = perf.now();
      const result = stepEnhanced(state, rule, neighborhood);
      const stepEnd = perf.now();

      state = result.state;

      stepTimings.push({
        step: snapshot.stepsTaken + i + 1,
        durationMs: stepEnd - stepStart,
        population: result.metrics.population,
        delta: result.metrics.delta,
      });

      if ((i + 1) % (options.metricsInterval ?? 1) === 0) {
        metricsHistory.push(result.metrics);
      }
    }

    const experimentEnd = perf.now();

    // Build result with timing
    const classification = multiMetricClassifier(metricsHistory);
    const timing: ExperimentTiming = {
      totalMs: experimentEnd - experimentStart,
      initializationMs: 0,
      evolutionMs: experimentEnd - experimentStart,
      classificationMs: 0,
      averageStepMs: (experimentEnd - experimentStart) / options.additionalSteps,
      stepTimings,
    };

    const updatedConfig: ExperimentConfig = {
      ...config,
      steps: snapshot.stepsTaken + options.additionalSteps,
    };

    const experimentResult: EnhancedExperimentResult = {
      outcome: classification.outcome,
      wolframClass: classification.wolframClass,
      confidence: classification.confidence,
      finalPopulation: state.currentGrid.countPopulation(),
      metricsHistory,
      config: updatedConfig,
      details: classification.details,
    };

    const report = analyzeExperiment(experimentResult, timing);
    return { ...experimentResult, report };
  }
  // Run without instrumentation (faster)
  const { finalGrid, metricsHistory: newMetrics } = evolveEnhanced(
    grid,
    rule,
    neighborhood,
    options.additionalSteps,
    options.metricsInterval ?? 1
  );

  const allMetrics = [...(snapshot.metricsHistory as EnhancedMetrics[]), ...newMetrics];
  const classification = multiMetricClassifier(allMetrics);

  return {
    outcome: classification.outcome,
    wolframClass: classification.wolframClass,
    confidence: classification.confidence,
    finalPopulation: finalGrid.countPopulation(),
    metricsHistory: allMetrics,
    config: {
      ...config,
      steps: snapshot.stepsTaken + options.additionalSteps,
    },
    details: classification.details,
  };
}
