/**
 * N-Dimensional Cellular Automata Engine
 *
 * A zero-dependency TypeScript library for running cellular automata
 * in arbitrary dimensions with LLM-friendly JSON interface.
 *
 * @example
 * ```typescript
 * import { runExperiment } from 'nd-cellular-automata';
 *
 * const result = runExperiment({
 *   dimensions: [20, 20, 20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [4], survival: [4, 5] },
 *   steps: 100,
 *   initialDensity: 0.15,
 *   seed: 42
 * });
 *
 * console.log(result.outcome);  // 'stable' | 'oscillating' | 'explosive' | 'extinct'
 * ```
 */

// Core types
export type {
  Dimensions,
  Coordinate,
  NeighborhoodType,
  ThresholdSet,
  Rule,
  SeededRandom,
  Metrics,
  EnhancedMetrics,
  Outcome,
  WolframClass,
  OutcomeClassifier,
  EnhancedOutcomeClassifier,
  ExperimentConfig,
  ExperimentResult,
} from './types.js';

// Grid operations
export {
  Grid,
  createGrid,
  initializeRandom,
  computeSpatialEntropy,
  computeStateHash,
  computeHammingDistance,
} from './grid.js';

// Neighborhood generation
export { generateNeighborhood, getMaxNeighbors } from './neighborhood.js';

// Rule creation and evaluation
export { createRule, ruleFromThresholds, shouldCellBeAlive } from './rule.js';

// Evolution engine
export { evolve, evolveEnhanced } from './stepper.js';

// Visualization support
export { extractSlice, extractSlices } from './slicer.js';

// Experiment orchestration
export {
  runExperiment,
  runExperimentEnhanced,
  hashBasedClassifier,
  type EnhancedExperimentResult,
} from './experiment.js';

// Multi-metric classifier
export {
  multiMetricClassifier,
  createSimpleClassifier,
  type ClassificationResult,
} from './classifier.js';

// Random number generation
export { createRandom } from './random.js';

// Observability (re-export as namespace for optional import)
export * as observability from './observability/index.js';
