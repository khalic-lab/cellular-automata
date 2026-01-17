/**
 * Terminal-based visualization for cellular automata.
 *
 * Renders grids as text using Unicode/ASCII characters.
 * Supports 2D grids directly and ND grids via 2D slices.
 */

import type { Grid } from '../grid.js';
import { createGrid, initializeRandom } from '../grid.js';
import { generateNeighborhood, getMaxNeighbors } from '../neighborhood.js';
import { createRandom } from '../random.js';
import { ruleFromThresholds, shouldCellBeAlive } from '../rule.js';
import { extractSlice } from '../slicer.js';
import type { EnhancedMetrics, ExperimentConfig, Metrics, Rule } from '../types.js';
import type {
  RenderOptions,
  SliceRenderOptions,
  SnapshotVisualizationOptions,
  VisualizationFrame,
  VisualizationResult,
} from './types.js';
import { BORDERS, CHARSETS } from './types.js';

/**
 * Renders a 2D array to terminal string.
 *
 * @param data - 2D array of cell states (0 or 1)
 * @param options - Rendering options
 * @returns Multi-line string representation
 */
export function render2DArray(data: number[][], options: RenderOptions = {}): string {
  const {
    charset = CHARSETS.blocks,
    border = BORDERS.single,
    showBorder = true,
    cellSpacing = false,
    maxWidth,
    maxHeight,
  } = options;

  // Handle empty grid
  if (data.length === 0 || data[0]!.length === 0) {
    return '(empty grid)';
  }

  let rows = data;
  let cols = data[0]!.length;

  // Apply truncation if needed
  if (maxHeight && rows.length > maxHeight) {
    rows = rows.slice(0, maxHeight);
  }
  if (maxWidth && cols > maxWidth) {
    rows = rows.map((row) => row.slice(0, maxWidth));
    cols = maxWidth;
  }

  const separator = cellSpacing ? ' ' : '';
  const lines: string[] = [];

  // Render each row
  const renderedRows = rows.map((row) =>
    row.map((cell) => (cell === 1 ? charset.alive : charset.dead)).join(separator)
  );

  // Calculate content width
  const contentWidth = renderedRows[0]?.length ?? 0;

  if (showBorder && border !== BORDERS.none) {
    // Top border
    lines.push(border.topLeft + border.horizontal.repeat(contentWidth) + border.topRight);

    // Content rows with side borders
    for (const row of renderedRows) {
      lines.push(border.vertical + row + border.vertical);
    }

    // Bottom border
    lines.push(border.bottomLeft + border.horizontal.repeat(contentWidth) + border.bottomRight);
  } else {
    // No border, just content
    lines.push(...renderedRows);
  }

  return lines.join('\n');
}

/**
 * Renders a 2D grid to terminal string.
 *
 * @param grid - 2D Grid instance
 * @param options - Rendering options
 * @returns Multi-line string representation
 */
export function renderGrid2D(grid: Grid, options: RenderOptions = {}): string {
  if (grid.dimensions.length !== 2) {
    throw new Error(`renderGrid2D requires 2D grid, got ${grid.dimensions.length}D`);
  }

  // Convert grid to 2D array
  const [rows, cols] = grid.dimensions;
  const data: number[][] = [];

  for (let y = 0; y < rows!; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols!; x++) {
      row.push(grid.get([y, x]));
    }
    data.push(row);
  }

  return render2DArray(data, options);
}

/**
 * Renders a 2D slice from an ND grid.
 *
 * @param grid - N-dimensional Grid instance
 * @param options - Slice and rendering options
 * @returns Multi-line string representation
 */
export function renderGridSlice(grid: Grid, options: SliceRenderOptions = {}): string {
  const { axis1 = 0, axis2 = 1, fixedCoords = new Map(), ...renderOptions } = options;

  // For 2D grids, use direct rendering
  if (grid.dimensions.length === 2) {
    return renderGrid2D(grid, renderOptions);
  }

  // Extract 2D slice
  const slice = extractSlice(grid, { axis1, axis2, fixedCoords });

  return render2DArray(slice, renderOptions);
}

/**
 * Formats metrics for display.
 *
 * @param metrics - Metrics to format
 * @returns Formatted string
 */
export function formatMetrics(metrics: Metrics | EnhancedMetrics): string {
  const parts: string[] = [`Pop: ${metrics.population}`, `Density: ${metrics.density.toFixed(3)}`];

  if (metrics.delta !== undefined) {
    const sign = metrics.delta >= 0 ? '+' : '';
    parts.push(`Delta: ${sign}${metrics.delta}`);
  }

  if ('entropy' in metrics && metrics.entropy !== undefined) {
    parts.push(`Entropy: ${metrics.entropy.toFixed(3)}`);
  }

  return parts.join(' | ');
}

/**
 * Renders a single visualization frame.
 *
 * @param frame - Frame to render
 * @param options - Rendering options
 * @returns Multi-line string representation
 */
export function renderFrame(
  frame: VisualizationFrame,
  options: SnapshotVisualizationOptions = {}
): string {
  const { showMetrics = true, showStepHeader = true, ...sliceOptions } = options;
  const lines: string[] = [];

  // Step header
  if (showStepHeader) {
    lines.push(`Step ${frame.step}`);
  }

  // Grid
  lines.push(renderGridSlice(frame.grid, sliceOptions));

  // Metrics
  if (showMetrics && frame.metrics) {
    lines.push(formatMetrics(frame.metrics));
  }

  return lines.join('\n');
}

/**
 * Renders multiple frames side-by-side.
 *
 * @param frames - Frames to render
 * @param options - Rendering options
 * @returns Multi-line string representation
 */
export function renderFramesSideBySide(
  frames: VisualizationFrame[],
  options: SnapshotVisualizationOptions = {}
): string {
  const { framesPerRow = frames.length, frameGap = 4, ...frameOptions } = options;

  if (frames.length === 0) {
    return '(no frames)';
  }

  // Render each frame individually
  const renderedFrames = frames.map((frame) =>
    renderFrame(frame, { ...frameOptions, showBorder: true }).split('\n')
  );

  // Pad all frames to same height
  const maxHeight = Math.max(...renderedFrames.map((f) => f.length));
  const paddedFrames = renderedFrames.map((lines) => {
    const maxWidth = Math.max(...lines.map((l) => l.length));
    while (lines.length < maxHeight) {
      lines.push(' '.repeat(maxWidth));
    }
    return lines.map((l) => l.padEnd(maxWidth));
  });

  // Combine frames horizontally
  const gap = ' '.repeat(frameGap);
  const result: string[] = [];

  for (let row = 0; row < Math.ceil(frames.length / framesPerRow); row++) {
    const startIdx = row * framesPerRow;
    const endIdx = Math.min(startIdx + framesPerRow, frames.length);
    const rowFrames = paddedFrames.slice(startIdx, endIdx);

    for (let lineIdx = 0; lineIdx < maxHeight; lineIdx++) {
      const line = rowFrames.map((f) => f[lineIdx] ?? '').join(gap);
      result.push(line);
    }

    // Add spacing between rows
    if (row < Math.ceil(frames.length / framesPerRow) - 1) {
      result.push('');
    }
  }

  return result.join('\n');
}

/**
 * Renders multiple frames stacked vertically.
 *
 * @param frames - Frames to render
 * @param options - Rendering options
 * @returns Multi-line string representation
 */
export function renderFramesStacked(
  frames: VisualizationFrame[],
  options: SnapshotVisualizationOptions = {}
): string {
  if (frames.length === 0) {
    return '(no frames)';
  }

  const rendered = frames.map((frame) => renderFrame(frame, options));
  return rendered.join('\n\n');
}

/**
 * Stepper state for internal evolution.
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
 * Advances grid by one generation.
 */
function stepGrid(state: StepperState, rule: Rule, neighborhood: number[][]): StepperState {
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
function computeMetrics(grid: Grid, previousPopulation: number, step: number): EnhancedMetrics {
  const population = grid.countPopulation();
  const delta = population - previousPopulation;

  return {
    population,
    density: population / grid.size,
    births: Math.max(0, delta),
    deaths: Math.max(0, -delta),
    delta,
    step,
    entropy: 0, // Simplified - not computing entropy for viz
    stateHash: 0,
  };
}

/**
 * Runs experiment and captures frames at specified intervals.
 *
 * @param config - Experiment configuration
 * @param snapshotInterval - Steps between snapshots (0 = start and end only)
 * @returns Visualization result with captured frames
 *
 * @example
 * ```typescript
 * const result = runWithSnapshots({
 *   dimensions: [20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 100,
 *   initialDensity: 0.3,
 *   seed: 42,
 * }, 25); // Snapshot every 25 steps
 *
 * console.log(renderFramesSideBySide(result.frames));
 * ```
 */
export function runWithSnapshots(
  config: ExperimentConfig,
  snapshotInterval = 0
): VisualizationResult {
  const {
    dimensions,
    neighborhood: neighborhoodConfig,
    rule: ruleConfig,
    steps,
    initialDensity,
    seed = 42,
  } = config;

  // Initialize
  const grid = createGrid(dimensions);
  const rng = createRandom(seed);
  initializeRandom(grid, initialDensity, rng);
  const { type, range = 1 } = neighborhoodConfig;
  const neighborhood = generateNeighborhood(dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(dimensions, type, range);
  const rule = ruleFromThresholds(ruleConfig.birth, ruleConfig.survival, maxNeighbors);

  const frames: VisualizationFrame[] = [];
  let state = createStepper(grid);

  // Capture initial state
  const initialPop = state.currentGrid.countPopulation();
  frames.push({
    step: 0,
    grid: state.currentGrid.clone(),
    metrics: {
      population: initialPop,
      density: initialPop / grid.size,
      births: 0,
      deaths: 0,
      delta: 0,
      step: 0,
      entropy: 0,
      stateHash: 0,
    },
  });

  // Evolve and capture
  let previousPop = initialPop;
  for (let i = 0; i < steps; i++) {
    state = stepGrid(state, rule, neighborhood);
    const currentStep = i + 1;

    // Capture at intervals (or final step)
    const isInterval = snapshotInterval > 0 && currentStep % snapshotInterval === 0;
    const isFinal = currentStep === steps;

    if (isInterval || isFinal) {
      const metrics = computeMetrics(state.currentGrid, previousPop, currentStep);
      frames.push({
        step: currentStep,
        grid: state.currentGrid.clone(),
        metrics,
      });
    }

    previousPop = state.currentGrid.countPopulation();
  }

  const finalPop = state.currentGrid.countPopulation();

  // Determine outcome based on final population
  let outcome: string;
  if (finalPop === 0) {
    outcome = 'extinct';
  } else if (finalPop === grid.size) {
    outcome = 'full';
  } else {
    outcome = 'active';
  }

  return {
    frames,
    outcome,
    finalPopulation: finalPop,
  };
}

/**
 * Prints visualization frames to console.
 *
 * @param result - Visualization result from runWithSnapshots
 * @param options - Display options
 */
export function printSnapshots(
  result: VisualizationResult,
  options: SnapshotVisualizationOptions & { layout?: 'side-by-side' | 'stacked' } = {}
): void {
  const { layout = 'side-by-side', ...renderOptions } = options;

  // eslint-disable-next-line no-console
  const log =
    (globalThis as { console?: { log: (...args: unknown[]) => void } }).console?.log ?? (() => {});

  log(`\n${'='.repeat(60)}`);
  log('  CELLULAR AUTOMATA VISUALIZATION');
  log('='.repeat(60));

  if (layout === 'side-by-side') {
    log(`\n${renderFramesSideBySide(result.frames, renderOptions)}`);
  } else {
    log(`\n${renderFramesStacked(result.frames, renderOptions)}`);
  }

  log(`\n${'-'.repeat(40)}`);
  log(`Outcome: ${result.outcome}`);
  log(`Final population: ${result.finalPopulation}`);
  log(`${'='.repeat(60)}\n`);
}

/**
 * Quick visualization of a pattern.
 *
 * @param config - Experiment configuration
 * @param snapshotInterval - Steps between snapshots
 * @param options - Display options
 *
 * @example
 * ```typescript
 * visualize({
 *   dimensions: [15, 15],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 50,
 *   initialDensity: 0.3,
 *   seed: 42,
 * }, 10); // Show state every 10 steps
 * ```
 */
export function visualize(
  config: ExperimentConfig,
  snapshotInterval = 0,
  options: SnapshotVisualizationOptions & { layout?: 'side-by-side' | 'stacked' } = {}
): VisualizationResult {
  const result = runWithSnapshots(config, snapshotInterval);
  printSnapshots(result, options);
  return result;
}
