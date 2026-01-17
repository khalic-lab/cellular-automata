/**
 * Experiment runner with outcome classification.
 *
 * Orchestrates complete cellular automata experiments:
 * 1. Initialize grid with random density
 * 2. Evolve for specified steps
 * 3. Collect metrics
 * 4. Classify outcome
 *
 * Classification approaches are based on academic research:
 *
 * References:
 * - Wolfram, S. (1984). "Universality and Complexity in Cellular Automata"
 *   Physica D: Nonlinear Phenomena, 10(1-2), 1-35.
 *   DOI: 10.1016/0167-2789(84)90245-8
 *
 * - Wolfram, S. (2002). "A New Kind of Science"
 *   Wolfram Media, Inc. ISBN: 1-57955-008-8
 *   https://www.wolframscience.com/nks/
 *
 * - Baetens, J.M. & De Baets, B. (2021). "Entropy-Based Classification of
 *   Elementary Cellular Automata under Asynchronous Updating"
 *   Entropy, 23(2), 209. DOI: 10.3390/e23020209
 *
 * - Ruivo, E.L.P. et al. (2024). "Classification of Cellular Automata
 *   based on the Hamming distance"
 *   arXiv:2407.06175. DOI: 10.48550/arXiv.2407.06175
 */

import type {
  ExperimentConfig,
  ExperimentResult,
  OutcomeClassifier,
  Outcome,
  Metrics,
  EnhancedMetrics,
  WolframClass,
} from './types.js';
import { createGrid, initializeRandom } from './grid.js';
import { generateNeighborhood, getMaxNeighbors } from './neighborhood.js';
import { ruleFromThresholds } from './rule.js';
import { evolve, evolveEnhanced } from './stepper.js';
import { createRandom } from './random.js';
import { multiMetricClassifier, type ClassificationResult } from './classifier.js';

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

/**
 * Enhanced experiment result with multi-metric classification.
 *
 * Extends ExperimentResult with:
 * - Wolfram class (Class 1-4 alignment)
 * - Classification confidence score
 * - Detailed analysis (cycle detection, entropy/population trends)
 * - Enhanced metrics with entropy and state hash
 */
export interface EnhancedExperimentResult {
  /** Simple outcome classification */
  outcome: Outcome;

  /** Wolfram's four-class classification */
  wolframClass: WolframClass;

  /** Confidence in classification (0-1) */
  confidence: number;

  /** Final population count */
  finalPopulation: number;

  /** Enhanced metrics history including entropy and state hash */
  metricsHistory: EnhancedMetrics[];

  /** Configuration used for this experiment */
  config: ExperimentConfig;

  /** Detailed classification analysis */
  details: ClassificationResult['details'];
}

/**
 * Runs experiment with multi-metric classification.
 *
 * Uses enhanced metrics (entropy, state hash) for more accurate
 * classification aligned with Wolfram's four classes.
 *
 * Based on academic research:
 * - Entropy-based classification (Baetens & De Baets, 2021)
 *   DOI: 10.3390/e23020209
 * - Hamming distance classification (Ruivo et al., 2024)
 *   DOI: 10.48550/arXiv.2407.06175
 *
 * @param config - Experiment configuration
 * @returns Enhanced experiment results with Wolfram classification
 *
 * @example
 * ```typescript
 * const result = runExperimentEnhanced({
 *   dimensions: [20, 20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [4], survival: [4, 5] },
 *   steps: 100,
 *   initialDensity: 0.15,
 *   seed: 42
 * });
 *
 * console.log(result.outcome);       // 'stable'
 * console.log(result.wolframClass);  // 'class2_stable'
 * console.log(result.confidence);    // 0.95
 * console.log(result.details.cycleDetected);  // true
 * ```
 */
export function runExperimentEnhanced(
  config: ExperimentConfig
): EnhancedExperimentResult {
  const {
    dimensions,
    neighborhood: neighborhoodConfig,
    rule: ruleConfig,
    steps,
    initialDensity,
    seed = 42,
    metricsInterval = 1,
  } = config;

  // 1. Create and initialize grid
  const grid = createGrid(dimensions);
  const rng = createRandom(seed);
  initializeRandom(grid, initialDensity, rng);

  // 2. Generate neighborhood
  const { type, range = 1 } = neighborhoodConfig;
  const neighborhood = generateNeighborhood(dimensions, { type, range });
  const maxNeighbors = getMaxNeighbors(dimensions, type, range);

  // 3. Create rule from thresholds
  const rule = ruleFromThresholds(ruleConfig.birth, ruleConfig.survival, maxNeighbors);

  // 4. Evolve with enhanced metrics collection
  const { finalGrid, metricsHistory } = evolveEnhanced(
    grid,
    rule,
    neighborhood,
    steps,
    metricsInterval
  );

  // 5. Classify using multi-metric classifier
  const classification = multiMetricClassifier(metricsHistory);

  // 6. Return enhanced results
  return {
    outcome: classification.outcome,
    wolframClass: classification.wolframClass,
    confidence: classification.confidence,
    finalPopulation: finalGrid.countPopulation(),
    metricsHistory,
    config,
    details: classification.details,
  };
}
