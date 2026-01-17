/**
 * Cellular automata evolution engine with double buffering.
 *
 * Efficiently steps grid states forward using:
 * - Double buffering (swap references, not copies)
 * - Precomputed neighborhoods
 * - Configurable metrics collection
 */

import type { Rule, Metrics, EnhancedMetrics } from './types.js';
import { Grid, computeSpatialEntropy, computeStateHash } from './grid.js';
import { shouldCellBeAlive } from './rule.js';

/**
 * Internal stepper state (not exported).
 * Maintains current/next grids and step counter.
 */
type StepperState = {
  currentGrid: Grid;
  nextGrid: Grid;
  stepCount: number;
};

/**
 * Creates initial stepper state.
 *
 * @param initialGrid - Starting grid configuration
 * @returns Fresh stepper state
 */
function createStepper(initialGrid: Grid): StepperState {
  return {
    currentGrid: initialGrid.clone(),
    nextGrid: initialGrid.clone(),
    stepCount: 0
  };
}

/**
 * Counts alive neighbors for a cell.
 *
 * Pure function: reads grid without modification.
 *
 * @param grid - Current grid state
 * @param coord - Cell coordinate
 * @param neighborhood - Precomputed offset vectors
 * @returns Count of alive neighbors
 */
function countNeighbors(
  grid: Grid,
  coord: number[],
  neighborhood: number[][]
): number {
  let count = 0;

  for (const offset of neighborhood) {
    // Compute neighbor coordinate
    const neighborCoord = coord.map((c, i) => c + offset[i]!);
    // Apply toroidal wrapping
    const wrapped = grid.wrap(neighborCoord);
    // Accumulate alive neighbors
    count += grid.get(wrapped);
  }

  return count;
}

/**
 * Computes metrics for current grid state.
 *
 * @param grid - Current grid
 * @param previousPopulation - Population from previous step
 * @param stepNumber - Current step number
 * @returns Metrics object
 */
function computeMetrics(
  grid: Grid,
  previousPopulation: number,
  stepNumber: number
): Metrics {
  const population = grid.countPopulation();
  const delta = population - previousPopulation;
  const births = Math.max(0, delta);
  const deaths = Math.max(0, -delta);

  return {
    population,
    density: population / grid.size,
    births,
    deaths,
    delta,
    step: stepNumber
  };
}

/**
 * Advances grid by one generation.
 *
 * Uses double buffering for efficiency:
 * 1. Read from currentGrid
 * 2. Write to nextGrid
 * 3. Swap references (no copy)
 *
 * @param state - Current stepper state
 * @param rule - Rule to apply
 * @param neighborhood - Precomputed neighborhood offsets
 * @returns Updated state and metrics
 */
function step(
  { currentGrid, nextGrid, stepCount }: StepperState,
  rule: Rule,
  neighborhood: number[][]
): { state: StepperState; metrics: Metrics } {
  const previousPopulation = currentGrid.countPopulation();
  const coord = new Array(currentGrid.dimensions.length).fill(0);

  /**
   * Recursively iterates over all grid coordinates.
   * Builds coordinate dimension by dimension.
   */
  function iterateGrid(dim: number): void {
    if (dim === coord.length) {
      // Base case: process cell at current coordinate
      const currentState = currentGrid.get(coord);
      const neighborCount = countNeighbors(currentGrid, coord, neighborhood);
      const nextState = shouldCellBeAlive(rule, currentState, neighborCount);
      nextGrid.set(coord, nextState ? 1 : 0);
      return;
    }

    // Recursive case: iterate over current dimension
    for (let i = 0; i < currentGrid.dimensions[dim]!; i++) {
      coord[dim] = i;
      iterateGrid(dim + 1);
    }
  }

  // Process all cells
  iterateGrid(0);

  // Compute metrics before swapping
  const metrics = computeMetrics(nextGrid, previousPopulation, stepCount + 1);

  // Swap grids (reference swap, not copy)
  const newState: StepperState = {
    currentGrid: nextGrid,
    nextGrid: currentGrid,
    stepCount: stepCount + 1
  };

  return { state: newState, metrics };
}

/**
 * Evolves grid for multiple generations.
 *
 * Functional loop: accumulates state and metrics history.
 *
 * @param initialGrid - Starting configuration
 * @param rule - Evolution rule
 * @param neighborhood - Precomputed neighborhood offsets
 * @param steps - Number of generations to simulate
 * @param metricsInterval - Collect metrics every N steps (default: 1)
 * @returns Final grid and metrics history
 *
 * @example
 * ```typescript
 * const { finalGrid, metricsHistory } = evolve(
 *   grid,
 *   rule,
 *   neighborhood,
 *   100,
 *   10  // Collect metrics every 10 steps
 * );
 * ```
 */
export function evolve(
  initialGrid: Grid,
  rule: Rule,
  neighborhood: number[][],
  steps: number,
  metricsInterval = 1
): { finalGrid: Grid; metricsHistory: Metrics[] } {
  let state = createStepper(initialGrid);
  const metricsHistory: Metrics[] = [];

  for (let i = 0; i < steps; i++) {
    const result = step(state, rule, neighborhood);
    state = result.state;

    // Collect metrics at specified interval
    if ((i + 1) % metricsInterval === 0) {
      metricsHistory.push(result.metrics);
    }
  }

  return {
    finalGrid: state.currentGrid,
    metricsHistory
  };
}

/**
 * Computes enhanced metrics including entropy and state hash.
 *
 * @param grid - Current grid
 * @param previousPopulation - Population from previous step
 * @param stepNumber - Current step number
 * @returns EnhancedMetrics object
 */
function computeEnhancedMetrics(
  grid: Grid,
  previousPopulation: number,
  stepNumber: number
): EnhancedMetrics {
  const population = grid.countPopulation();
  const delta = population - previousPopulation;
  const births = Math.max(0, delta);
  const deaths = Math.max(0, -delta);

  return {
    population,
    density: population / grid.size,
    births,
    deaths,
    delta,
    step: stepNumber,
    entropy: computeSpatialEntropy(grid),
    stateHash: computeStateHash(grid),
  };
}

/**
 * Advances grid by one generation with enhanced metrics.
 *
 * @param state - Current stepper state
 * @param rule - Rule to apply
 * @param neighborhood - Precomputed neighborhood offsets
 * @returns Updated state and enhanced metrics
 */
function stepEnhanced(
  { currentGrid, nextGrid, stepCount }: StepperState,
  rule: Rule,
  neighborhood: number[][]
): { state: StepperState; metrics: EnhancedMetrics } {
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

  const metrics = computeEnhancedMetrics(nextGrid, previousPopulation, stepCount + 1);

  const newState: StepperState = {
    currentGrid: nextGrid,
    nextGrid: currentGrid,
    stepCount: stepCount + 1,
  };

  return { state: newState, metrics };
}

/**
 * Evolves grid with enhanced metrics collection.
 *
 * Collects additional metrics for multi-metric classification:
 * - Spatial entropy
 * - State hash for cycle detection
 *
 * Reference: Academic-based classification approach
 * (MDPI Entropy 2021, arXiv 2407.06175)
 *
 * @param initialGrid - Starting configuration
 * @param rule - Evolution rule
 * @param neighborhood - Precomputed neighborhood offsets
 * @param steps - Number of generations to simulate
 * @param metricsInterval - Collect metrics every N steps (default: 1)
 * @returns Final grid and enhanced metrics history
 *
 * @example
 * ```typescript
 * const { finalGrid, metricsHistory } = evolveEnhanced(
 *   grid,
 *   rule,
 *   neighborhood,
 *   100
 * );
 * // metricsHistory includes entropy and stateHash for each step
 * ```
 */
export function evolveEnhanced(
  initialGrid: Grid,
  rule: Rule,
  neighborhood: number[][],
  steps: number,
  metricsInterval = 1
): { finalGrid: Grid; metricsHistory: EnhancedMetrics[] } {
  let state = createStepper(initialGrid);
  const metricsHistory: EnhancedMetrics[] = [];

  for (let i = 0; i < steps; i++) {
    const result = stepEnhanced(state, rule, neighborhood);
    state = result.state;

    if ((i + 1) % metricsInterval === 0) {
      metricsHistory.push(result.metrics);
    }
  }

  return {
    finalGrid: state.currentGrid,
    metricsHistory,
  };
}
