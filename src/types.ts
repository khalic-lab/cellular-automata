/**
 * Core type definitions for N-dimensional cellular automata engine.
 *
 * This module defines all fundamental types used throughout the library.
 * Types follow a functional-first design with readonly properties where possible.
 */

/**
 * Represents the shape of an N-dimensional grid.
 * Each element specifies the size along one dimension.
 *
 * Example: [10, 10] for 2D 10×10 grid, [5, 5, 5] for 3D 5×5×5 grid
 */
export type Dimensions = number[];

/**
 * Represents a position in N-dimensional space.
 * Length must match the dimensionality of the grid.
 *
 * Example: [3, 7] for position in 2D grid, [2, 4, 1] for 3D grid
 */
export type Coordinate = number[];

/**
 * Type of neighborhood topology.
 * - moore: All cells within Chebyshev distance (includes diagonals)
 * - von-neumann: Cells within Manhattan distance (no diagonals)
 */
export type NeighborhoodType = 'moore' | 'von-neumann';

/**
 * Threshold specification for birth/survival rules.
 * Can be either absolute neighbor counts or relative fractions.
 *
 * Note: All values in an array must be uniform (all absolute OR all relative).
 * Mixed absolute/relative thresholds are not supported.
 */
export type ThresholdSet = number[] | { relative: number }[];

/**
 * Cellular automata rule definition.
 * Defines which neighbor counts cause birth or survival.
 *
 * Immutable structure using readonly properties.
 */
export type Rule = {
  readonly birth: ReadonlySet<number>;
  readonly survival: ReadonlySet<number>;
  readonly maxNeighbors: number;
};

/**
 * Seeded pseudo-random number generator.
 * Functional interface returning values in [0, 1).
 *
 * Deterministic: same seed produces same sequence.
 */
export type SeededRandom = {
  next: () => number;
};

/**
 * Metrics captured at a single evolution step.
 * All properties are readonly for immutability.
 */
export type Metrics = {
  readonly population: number;  // Count of alive cells
  readonly density: number;     // Fraction of alive cells [0, 1]
  readonly births: number;      // Cells that became alive this step
  readonly deaths: number;      // Cells that died this step
  readonly delta: number;       // Net change (births - deaths)
  readonly step: number;        // Step number (0-indexed)
};

/**
 * Classification of experiment outcome.
 * Determined by analyzing metrics history.
 */
export type Outcome = 'extinct' | 'explosive' | 'stable' | 'oscillating';

/**
 * Function that classifies experiment outcomes.
 * Takes full metrics history and returns outcome classification.
 *
 * Pure function: same input always produces same output.
 */
export type OutcomeClassifier = (metricsHistory: Metrics[]) => Outcome;

/**
 * Configuration for a cellular automata experiment.
 * Fully JSON-serializable for easy persistence and transmission.
 */
export interface ExperimentConfig {
  /** Grid dimensions (e.g., [20, 20] for 2D, [10, 10, 10, 10] for 4D) */
  dimensions: number[];

  /** Neighborhood configuration */
  neighborhood: {
    type: NeighborhoodType;
    range?: number;  // Default: 1
  };

  /** Rule configuration with birth/survival thresholds */
  rule: {
    birth: ThresholdSet;
    survival: ThresholdSet;
  };

  /** Number of evolution steps to run */
  steps: number;

  /** Initial density of alive cells [0, 1] */
  initialDensity: number;

  /** Random seed for deterministic initialization (default: 42) */
  seed?: number;

  /** Interval for metrics collection (default: 1 = every step) */
  metricsInterval?: number;
}

/**
 * Result of running a cellular automata experiment.
 * Fully JSON-serializable for easy storage and analysis.
 */
export interface ExperimentResult {
  /** Classified outcome of the experiment */
  outcome: Outcome;

  /** Final population count */
  finalPopulation: number;

  /** History of metrics collected during evolution */
  metricsHistory: Metrics[];

  /** Configuration used for this experiment */
  config: ExperimentConfig;
}
