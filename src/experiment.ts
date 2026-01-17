/**
 * Experiment runner with outcome classification.
 *
 * Orchestrates complete cellular automata experiments:
 * 1. Initialize grid with random density
 * 2. Evolve for specified steps
 * 3. Collect metrics
 * 4. Classify outcome
 */

import type {
  ExperimentConfig,
  ExperimentResult,
  OutcomeClassifier,
  Outcome,
  Metrics
} from './types.js';
import { createGrid, initializeRandom } from './grid.js';
import { generateNeighborhood, getMaxNeighbors } from './neighborhood.js';
import { ruleFromThresholds } from './rule.js';
import { evolve } from './stepper.js';
import { createRandom } from './random.js';

/**
 * Default outcome classifier using hash-based cycle detection.
 *
 * Classification logic:
 * 1. Extinct: Population reaches zero
 * 2. Oscillating: Repeated population pattern in final 30%
 * 3. Explosive: Final 20% population > 1.2× first 50% average
 * 4. Stable: Default fallback
 *
 * @param metricsHistory - Full metrics timeline
 * @returns Classified outcome
 *
 * @example
 * ```typescript
 * const outcome = hashBasedClassifier(metricsHistory);
 * console.log(outcome);  // 'oscillating'
 * ```
 */
export function hashBasedClassifier(metricsHistory: Metrics[]): Outcome {
  if (metricsHistory.length === 0) {
    return 'extinct';
  }

  const finalPopulation = metricsHistory[metricsHistory.length - 1]!.population;

  // Check for extinction
  if (finalPopulation === 0) {
    return 'extinct';
  }

  // Check for oscillation in final 30%
  const analysisStart = Math.floor(metricsHistory.length * 0.7);
  const analysisWindow = metricsHistory.slice(analysisStart);

  if (analysisWindow.length >= 3) {
    const seen = new Map<number, number>();

    for (let i = 0; i < analysisWindow.length; i++) {
      const pop = analysisWindow[i]!.population;

      if (seen.has(pop)) {
        const firstOccurrence = seen.get(pop)!;
        const period = i - firstOccurrence;

        // Verify it's a real cycle (period > 0 and reasonable)
        if (period > 0 && period < analysisWindow.length / 2) {
          return 'oscillating';
        }
      }

      seen.set(pop, i);
    }
  }

  // Check for explosive growth
  if (metricsHistory.length >= 10) {
    const earlyEnd = Math.floor(metricsHistory.length * 0.5);
    const lateStart = Math.floor(metricsHistory.length * 0.8);

    const earlyMetrics = metricsHistory.slice(0, earlyEnd);
    const lateMetrics = metricsHistory.slice(lateStart);

    const earlyAvg = earlyMetrics.reduce((sum, m) => sum + m.population, 0) / earlyMetrics.length;
    const lateAvg = lateMetrics.reduce((sum, m) => sum + m.population, 0) / lateMetrics.length;

    if (lateAvg > earlyAvg * 1.2) {
      return 'explosive';
    }
  }

  // Default: stable
  return 'stable';
}

/**
 * Runs a complete cellular automata experiment.
 *
 * Functional pipeline:
 * 1. Create and initialize grid
 * 2. Generate neighborhood
 * 3. Create rule from thresholds
 * 4. Evolve for specified steps
 * 5. Classify outcome
 *
 * @param config - Experiment configuration
 * @param classifier - Outcome classification function (default: hashBasedClassifier)
 * @returns Complete experiment results
 *
 * @example
 * ```typescript
 * const result = runExperiment({
 *   dimensions: [20, 20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [4], survival: [4, 5] },
 *   steps: 100,
 *   initialDensity: 0.15,
 *   seed: 42
 * });
 *
 * console.log(result.outcome);  // 'stable'
 * console.log(result.finalPopulation);  // 342
 * ```
 */
export function runExperiment(
  config: ExperimentConfig,
  classifier: OutcomeClassifier = hashBasedClassifier
): ExperimentResult {
  // Destructure config for cleaner code
  const {
    dimensions,
    neighborhood: neighborhoodConfig,
    rule: ruleConfig,
    steps,
    initialDensity,
    seed = 42,
    metricsInterval = 1
  } = config;

  // Functional pipeline execution

  // 1. Create grid
  const grid = createGrid(dimensions);

  // 2. Initialize with random density
  const rng = createRandom(seed);
  initializeRandom(grid, initialDensity, rng);

  // 3. Generate neighborhood
  const { type, range = 1 } = neighborhoodConfig;
  const neighborhood = generateNeighborhood(dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(dimensions, type, range);

  // 4. Create rule from thresholds
  const rule = ruleFromThresholds(
    ruleConfig.birth,
    ruleConfig.survival,
    maxNeighbors
  );

  // 5. Evolve for N steps
  const { finalGrid, metricsHistory } = evolve(
    grid,
    rule,
    neighborhood,
    steps,
    metricsInterval
  );

  // 6. Classify outcome
  const outcome = classifier(metricsHistory);

  // 7. Return complete results
  return {
    outcome,
    finalPopulation: finalGrid.countPopulation(),
    metricsHistory,
    config
  };
}
