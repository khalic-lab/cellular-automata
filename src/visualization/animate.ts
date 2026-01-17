/**
 * Animated terminal visualization for cellular automata.
 *
 * Renders evolving grids in real-time with configurable frame rate.
 * Uses ANSI escape codes for terminal control.
 */

import type { Grid } from '../grid.js';
import type { ExperimentConfig, EnhancedMetrics, Rule } from '../types.js';
import { createGrid, initializeRandom } from '../grid.js';
import { generateNeighborhood, getMaxNeighbors } from '../neighborhood.js';
import { ruleFromThresholds, shouldCellBeAlive } from '../rule.js';
import { createRandom } from '../random.js';
import { renderGridSlice, formatMetrics } from './terminal.js';
import type {
  AnimationOptions,
  AnimationResult,
  AnimationController,
  VisualizationFrame,
} from './types.js';
import { CHARSETS } from './types.js';

// Timer functions
declare function setTimeout(callback: () => void, ms: number): number;

// ANSI escape codes for terminal control
const ANSI = {
  clearScreen: '\x1B[2J',
  moveCursor: (row: number, col: number) => `\x1B[${row};${col}H`,
  hideCursor: '\x1B[?25l',
  showCursor: '\x1B[?25h',
  clearLine: '\x1B[2K',
} as const;

// Console access
declare const globalThis: {
  console?: {
    log: (...args: unknown[]) => void;
  };
  process?: {
    stdout?: {
      write: (s: string) => void;
    };
  };
};

const write = (s: string) => {
  if (globalThis.process?.stdout?.write) {
    globalThis.process.stdout.write(s);
  } else if (globalThis.console?.log) {
    globalThis.console.log(s);
  }
};

const log = globalThis.console?.log ?? (() => {});

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Stepper state for evolution.
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
function countNeighbors(
  grid: Grid,
  coord: number[],
  neighborhood: number[][]
): number {
  let count = 0;
  for (const offset of neighborhood) {
    const neighborCoord = coord.map((c, i) => c + offset[i]!);
    const wrapped = grid.wrap(neighborCoord);
    count += grid.get(wrapped);
  }
  return count;
}

/**
 * Advances grid by one generation.
 */
function stepGrid(
  state: StepperState,
  rule: Rule,
  neighborhood: number[][]
): StepperState {
  const { currentGrid, nextGrid } = state;
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

  return {
    currentGrid: nextGrid,
    nextGrid: currentGrid,
    stepCount: state.stepCount + 1,
  };
}

/**
 * Computes metrics for a grid.
 */
function computeMetrics(
  grid: Grid,
  previousPopulation: number,
  step: number
): EnhancedMetrics {
  const population = grid.countPopulation();
  const delta = population - previousPopulation;

  return {
    population,
    density: population / grid.size,
    births: Math.max(0, delta),
    deaths: Math.max(0, -delta),
    delta,
    step,
    entropy: 0,
    stateHash: 0,
  };
}

/**
 * Renders a single animation frame to terminal.
 */
function renderAnimationFrame(
  frame: VisualizationFrame,
  totalSteps: number,
  options: AnimationOptions
): string {
  const {
    showMetrics = true,
    showProgress = true,
    ...sliceOptions
  } = options;

  const lines: string[] = [];

  // Progress header
  if (showProgress) {
    const progress = Math.round((frame.step / totalSteps) * 100);
    const progressBar = createProgressBar(progress, 30);
    lines.push(`Step ${frame.step}/${totalSteps} ${progressBar} ${progress}%`);
    lines.push('');
  }

  // Grid
  lines.push(renderGridSlice(frame.grid, sliceOptions));

  // Metrics
  if (showMetrics && frame.metrics) {
    lines.push('');
    lines.push(formatMetrics(frame.metrics));
  }

  return lines.join('\n');
}

/**
 * Creates a simple ASCII progress bar.
 */
function createProgressBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
}

/**
 * Runs animated visualization of cellular automata evolution.
 *
 * Displays each generation in the terminal with configurable delay.
 * Default frame delay is 1500ms (1.5 seconds).
 *
 * @param config - Experiment configuration
 * @param options - Animation options
 * @returns Controller to stop/pause animation and promise for completion
 *
 * @example
 * ```typescript
 * // Basic animation with default 1.5s frame delay
 * const controller = animate({
 *   dimensions: [20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 100,
 *   initialDensity: 0.3,
 *   seed: 42,
 * });
 *
 * // Wait for completion
 * const result = await controller.done;
 * console.log(`Final: ${result.outcome}`);
 *
 * // Or stop early
 * setTimeout(() => controller.stop(), 5000);
 * ```
 */
export function animate(
  config: ExperimentConfig,
  options: AnimationOptions = {}
): AnimationController {
  const {
    frameDelayMs = 1500,
    clearScreen = true,
    onComplete,
    onFrame,
    charset = CHARSETS.blocks,
    ...renderOptions
  } = options;

  let stopped = false;
  let paused = false;
  let pauseResolve: (() => void) | null = null;

  const startTime = Date.now();

  // Initialize
  const {
    dimensions,
    neighborhood: neighborhoodConfig,
    rule: ruleConfig,
    steps,
    initialDensity,
    seed = 42,
  } = config;

  const grid = createGrid(dimensions);
  const rng = createRandom(seed);
  initializeRandom(grid, initialDensity, rng);
  const { type, range = 1 } = neighborhoodConfig;
  const neighborhood = generateNeighborhood(dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(dimensions, type, range);
  const rule = ruleFromThresholds(ruleConfig.birth, ruleConfig.survival, maxNeighbors);

  let state = createStepper(grid);
  let previousPop = state.currentGrid.countPopulation();

  const runAnimation = async (): Promise<AnimationResult> => {
    // Hide cursor during animation
    if (clearScreen) {
      write(ANSI.hideCursor);
    }

    try {
      // Show initial state
      const initialMetrics = computeMetrics(state.currentGrid, 0, 0);
      const initialFrame: VisualizationFrame = {
        step: 0,
        grid: state.currentGrid.clone(),
        metrics: initialMetrics,
      };

      if (clearScreen) {
        write(ANSI.clearScreen + ANSI.moveCursor(1, 1));
      }
      log(renderAnimationFrame(initialFrame, steps, { charset, ...renderOptions }));
      onFrame?.(initialFrame, 0);

      await sleep(frameDelayMs);

      // Evolve and display each step
      for (let i = 0; i < steps && !stopped; i++) {
        // Handle pause
        while (paused && !stopped) {
          await new Promise<void>(resolve => {
            pauseResolve = resolve;
          });
        }

        if (stopped) break;

        state = stepGrid(state, rule, neighborhood);
        const metrics = computeMetrics(state.currentGrid, previousPop, i + 1);
        previousPop = metrics.population;

        const frame: VisualizationFrame = {
          step: i + 1,
          grid: state.currentGrid.clone(),
          metrics,
        };

        if (clearScreen) {
          write(ANSI.clearScreen + ANSI.moveCursor(1, 1));
        }
        log(renderAnimationFrame(frame, steps, { charset, ...renderOptions }));
        onFrame?.(frame, i + 1);

        // Check for early termination (extinction)
        if (metrics.population === 0) {
          break;
        }

        if (i < steps - 1) {
          await sleep(frameDelayMs);
        }
      }

      // Determine outcome
      const finalPop = state.currentGrid.countPopulation();
      let outcome: string;
      if (finalPop === 0) {
        outcome = 'extinct';
      } else if (finalPop === grid.size) {
        outcome = 'full';
      } else {
        outcome = stopped ? 'stopped' : 'active';
      }

      const result: AnimationResult = {
        totalSteps: state.stepCount,
        outcome,
        finalPopulation: finalPop,
        durationMs: Date.now() - startTime,
      };

      // Show final summary
      if (!stopped) {
        log('');
        log('─'.repeat(40));
        log(`Animation complete: ${result.outcome}`);
        log(`Steps: ${result.totalSteps}, Population: ${result.finalPopulation}`);
        log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
      }

      onComplete?.(result);
      return result;

    } finally {
      // Show cursor again
      if (clearScreen) {
        write(ANSI.showCursor);
      }
    }
  };

  const donePromise = runAnimation();

  return {
    stop: () => {
      stopped = true;
      if (pauseResolve) {
        pauseResolve();
        pauseResolve = null;
      }
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      if (pauseResolve) {
        pauseResolve();
        pauseResolve = null;
      }
    },
    done: donePromise,
  };
}

/**
 * Runs animation and waits for completion.
 *
 * Convenience wrapper around animate() for simple use cases.
 *
 * @param config - Experiment configuration
 * @param options - Animation options
 * @returns Promise resolving to animation result
 *
 * @example
 * ```typescript
 * const result = await animateAsync({
 *   dimensions: [15, 15],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 50,
 *   initialDensity: 0.3,
 *   seed: 42,
 * }, { frameDelayMs: 500 });
 *
 * console.log(result.outcome);
 * ```
 */
export async function animateAsync(
  config: ExperimentConfig,
  options: AnimationOptions = {}
): Promise<AnimationResult> {
  const controller = animate(config, options);
  return controller.done;
}

/**
 * Runs animation with frames collected for later playback.
 *
 * Does not display anything - just collects frames. Useful for
 * pre-computing an animation then playing it back multiple times.
 *
 * @param config - Experiment configuration
 * @param frameInterval - Capture every N steps (default: 1)
 * @returns Array of frames
 */
export function collectFrames(
  config: ExperimentConfig,
  frameInterval: number = 1
): VisualizationFrame[] {
  const {
    dimensions,
    neighborhood: neighborhoodConfig,
    rule: ruleConfig,
    steps,
    initialDensity,
    seed = 42,
  } = config;

  const grid = createGrid(dimensions);
  const rng = createRandom(seed);
  initializeRandom(grid, initialDensity, rng);
  const { type, range = 1 } = neighborhoodConfig;
  const neighborhood = generateNeighborhood(dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(dimensions, type, range);
  const rule = ruleFromThresholds(ruleConfig.birth, ruleConfig.survival, maxNeighbors);

  const frames: VisualizationFrame[] = [];
  let state = createStepper(grid);
  let previousPop = state.currentGrid.countPopulation();

  // Capture initial state
  frames.push({
    step: 0,
    grid: state.currentGrid.clone(),
    metrics: computeMetrics(state.currentGrid, 0, 0),
  });

  // Evolve and capture
  for (let i = 0; i < steps; i++) {
    state = stepGrid(state, rule, neighborhood);
    const metrics = computeMetrics(state.currentGrid, previousPop, i + 1);
    previousPop = metrics.population;

    if ((i + 1) % frameInterval === 0 || i === steps - 1) {
      frames.push({
        step: i + 1,
        grid: state.currentGrid.clone(),
        metrics,
      });
    }

    if (metrics.population === 0) break;
  }

  return frames;
}

/**
 * Plays back pre-collected frames with animation.
 *
 * @param frames - Frames to play back
 * @param options - Animation options
 * @returns Controller for the playback
 */
export function playFrames(
  frames: VisualizationFrame[],
  options: AnimationOptions = {}
): AnimationController {
  const {
    frameDelayMs = 1500,
    clearScreen = true,
    onComplete,
    onFrame,
    charset = CHARSETS.blocks,
    ...renderOptions
  } = options;

  let stopped = false;
  let paused = false;
  let pauseResolve: (() => void) | null = null;

  const startTime = Date.now();
  const totalSteps = frames.length > 0 ? frames[frames.length - 1]!.step : 0;

  const runPlayback = async (): Promise<AnimationResult> => {
    if (clearScreen) {
      write(ANSI.hideCursor);
    }

    try {
      for (let i = 0; i < frames.length && !stopped; i++) {
        while (paused && !stopped) {
          await new Promise<void>(resolve => {
            pauseResolve = resolve;
          });
        }

        if (stopped) break;

        const frame = frames[i]!;

        if (clearScreen) {
          write(ANSI.clearScreen + ANSI.moveCursor(1, 1));
        }
        log(renderAnimationFrame(frame, totalSteps, { charset, ...renderOptions }));
        onFrame?.(frame, i);

        if (i < frames.length - 1) {
          await sleep(frameDelayMs);
        }
      }

      const lastFrame = frames[frames.length - 1];
      const result: AnimationResult = {
        totalSteps,
        outcome: stopped ? 'stopped' : 'complete',
        finalPopulation: lastFrame?.metrics?.population ?? 0,
        durationMs: Date.now() - startTime,
      };

      if (!stopped) {
        log('');
        log('─'.repeat(40));
        log(`Playback complete`);
        log(`Frames: ${frames.length}, Final population: ${result.finalPopulation}`);
      }

      onComplete?.(result);
      return result;

    } finally {
      if (clearScreen) {
        write(ANSI.showCursor);
      }
    }
  };

  const donePromise = runPlayback();

  return {
    stop: () => {
      stopped = true;
      if (pauseResolve) {
        pauseResolve();
        pauseResolve = null;
      }
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      if (pauseResolve) {
        pauseResolve();
        pauseResolve = null;
      }
    },
    done: donePromise,
  };
}
