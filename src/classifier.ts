/**
 * Multi-metric classifier for cellular automata outcomes.
 *
 * Implements classification based on multiple signals:
 * 1. Population dynamics (growth, decay, stability)
 * 2. Spatial entropy (order vs chaos)
 * 3. State hash cycle detection (true periodicity)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CLASSIFICATION METHODS SUMMARY (see docs/CLASSIFICATION_METHODS.md for full details)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────┬────────────────────────────────────────────────────────────┐
 * │ Method      │ Description                                                │
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ Wolfram     │ Four classes: Class 1 (homogeneous), Class 2 (periodic),   │
 * │ Classes     │ Class 3 (chaotic), Class 4 (complex/edge of chaos)         │
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ Shannon     │ H = -p·log₂(p) - (1-p)·log₂(1-p)                           │
 * │ Entropy     │ H≈0: uniform (Class 1), H≈1: max disorder (Class 3)        │
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ State Hash  │ FNV-1a hash of grid state; detect cycles via collision     │
 * │ Cycles      │ Period 1 = stable, Period > 1 = oscillating                │
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ Population  │ Analyze final 30%: growing/shrinking/stable/oscillating    │
 * │ Trend       │ CoV > 0.3 = oscillating, trend_strength > 0.6 = directional│
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ Entropy     │ stdDev > 0.1 = fluctuating (chaotic)                       │
 * │ Trend       │ Track increasing/decreasing/stable over time               │
 * ├─────────────┼────────────────────────────────────────────────────────────┤
 * │ Edge of     │ Class 4 at λ transition: stable entropy, 0.3 < H < 0.8,    │
 * │ Chaos       │ no cycle, long simulation (≥50 steps)                      │
 * └─────────────┴────────────────────────────────────────────────────────────┘
 *
 * Decision Flow: extinct? → Class 1? → cycle? → chaotic? → explosive? → Class 4? → default
 *
 * Confidence: extinct=1.0, Class1=0.95, stable=0.95, periodic=0.9,
 *             explosive=0.8, chaotic=0.75, Class4=0.5, default=0.7
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ACADEMIC REFERENCES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wolfram's Four-Class Classification:
 * [1] Wolfram, S. (1984). "Universality and Complexity in Cellular Automata"
 *     Physica D: Nonlinear Phenomena, 10(1-2), 1-35.
 *     DOI: 10.1016/0167-2789(84)90245-8
 *
 * [2] Wolfram, S. (2002). "A New Kind of Science"
 *     Wolfram Media, Inc. ISBN: 1-57955-008-8
 *     Chapter 6: "Starting from Randomness", pp. 231-249
 *     https://www.wolframscience.com/nks/p231--four-classes-of-behavior/
 *
 * Edge of Chaos and Phase Transitions:
 * [3] Langton, C.G. (1990). "Computation at the Edge of Chaos:
 *     Phase Transitions and Emergent Computation"
 *     Physica D: Nonlinear Phenomena, 42(1-3), 12-37.
 *     DOI: 10.1016/0167-2789(90)90064-V
 *
 * [4] Li, W. & Packard, N. (1990). "The Structure of the Elementary
 *     Cellular Automata Rule Space"
 *     Complex Systems, 4(3), 281-297.
 *     URL: https://www.complex-systems.com/abstracts/v04_i03_a03/
 *
 * Entropy-Based Classification:
 * [5] Baetens, J.M. & De Baets, B. (2021). "Entropy-Based Classification of
 *     Elementary Cellular Automata under Asynchronous Updating"
 *     Entropy, 23(2), 209. MDPI.
 *     DOI: 10.3390/e23020209
 *
 * [6] Shannon, C.E. (1948). "A Mathematical Theory of Communication"
 *     Bell System Technical Journal, 27(3), 379-423.
 *     DOI: 10.1002/j.1538-7305.1948.tb01338.x
 *
 * Hamming Distance and Automatic Classification:
 * [7] Ruivo, E.L.P., Balbi, P.P., & Monetti, R. (2024). "Classification of
 *     Cellular Automata based on the Hamming distance"
 *     arXiv preprint arXiv:2407.06175.
 *     DOI: 10.48550/arXiv.2407.06175
 *
 * [8] Wuensche, A. (1999). "Classifying Cellular Automata Automatically"
 *     Complexity, 4(3), 47-66.
 *     DOI: 10.1002/(SICI)1099-0526(199901/02)4:3<47::AID-CPLX9>3.0.CO;2-V
 *
 * Cycle Detection:
 * [9] Knuth, D.E. (1997). "The Art of Computer Programming, Vol. 2"
 *     Addison-Wesley. ISBN: 978-0-201-89684-8
 *     Section 3.1: Floyd's cycle detection algorithm
 */

import type {
  EnhancedMetrics,
  Outcome,
  WolframClass,
  EnhancedOutcomeClassifier,
} from './types.js';

/**
 * Result of multi-metric classification.
 */
export interface ClassificationResult {
  outcome: Outcome;
  wolframClass: WolframClass;
  confidence: number;
  details: {
    cycleDetected: boolean;
    cyclePeriod: number | null;
    entropyTrend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating';
    populationTrend: 'growing' | 'shrinking' | 'stable' | 'oscillating';
  };
}

/**
 * Detects cycles using state hash history.
 *
 * Uses Floyd's cycle detection adapted for hash sequences.
 * Returns the period if a cycle is found, null otherwise.
 *
 * @param stateHashes - Array of state hashes from metrics history
 * @param windowSize - How far back to look for cycles (default: full history)
 * @returns Cycle period or null
 */
function detectCycle(
  stateHashes: number[],
  windowSize?: number
): { detected: boolean; period: number | null; firstOccurrence: number | null } {
  const searchWindow = windowSize ?? stateHashes.length;
  const startIdx = Math.max(0, stateHashes.length - searchWindow);

  // Build a map of hash -> first occurrence index
  const hashToIndex = new Map<number, number>();

  for (let i = startIdx; i < stateHashes.length; i++) {
    const hash = stateHashes[i]!;

    if (hashToIndex.has(hash)) {
      const firstIdx = hashToIndex.get(hash)!;
      const period = i - firstIdx;

      // Verify it's a real cycle by checking if the pattern repeats
      if (period > 0 && verifyCycle(stateHashes, firstIdx, period)) {
        return { detected: true, period, firstOccurrence: firstIdx };
      }
    }

    hashToIndex.set(hash, i);
  }

  return { detected: false, period: null, firstOccurrence: null };
}

/**
 * Verifies that a detected cycle is genuine by checking pattern repetition.
 */
function verifyCycle(hashes: number[], startIdx: number, period: number): boolean {
  // Need at least 2 full periods to verify
  if (startIdx + 2 * period > hashes.length) {
    return true; // Can't fully verify, assume it's valid
  }

  for (let i = 0; i < period; i++) {
    if (hashes[startIdx + i] !== hashes[startIdx + period + i]) {
      return false;
    }
  }

  return true;
}

/**
 * Analyzes population trend from metrics history.
 */
function analyzePopulationTrend(
  metrics: EnhancedMetrics[]
): 'growing' | 'shrinking' | 'stable' | 'oscillating' {
  if (metrics.length < 2) return 'stable';

  const populations = metrics.map((m) => m.population);

  // Look at the final 30% of the simulation
  const analysisStart = Math.floor(populations.length * 0.7);
  const finalPopulations = populations.slice(analysisStart);

  if (finalPopulations.length < 2) return 'stable';

  // Calculate basic statistics
  const mean = finalPopulations.reduce((a, b) => a + b, 0) / finalPopulations.length;
  const variance =
    finalPopulations.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
    finalPopulations.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  // Check for monotonic trend
  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < finalPopulations.length; i++) {
    if (finalPopulations[i]! > finalPopulations[i - 1]!) increasing++;
    else if (finalPopulations[i]! < finalPopulations[i - 1]!) decreasing++;
  }

  const totalChanges = increasing + decreasing;
  const trendStrength = totalChanges > 0 ? Math.abs(increasing - decreasing) / totalChanges : 0;

  // Classification logic
  if (coefficientOfVariation > 0.3) {
    return 'oscillating';
  }

  if (trendStrength > 0.6) {
    if (increasing > decreasing) return 'growing';
    else return 'shrinking';
  }

  return 'stable';
}

/**
 * Analyzes entropy trend from metrics history.
 */
function analyzeEntropyTrend(
  metrics: EnhancedMetrics[]
): 'increasing' | 'decreasing' | 'stable' | 'fluctuating' {
  if (metrics.length < 2) return 'stable';

  const entropies = metrics.map((m) => m.entropy);

  // Look at the final 30% of the simulation
  const analysisStart = Math.floor(entropies.length * 0.7);
  const finalEntropies = entropies.slice(analysisStart);

  if (finalEntropies.length < 2) return 'stable';

  // Calculate statistics
  const mean = finalEntropies.reduce((a, b) => a + b, 0) / finalEntropies.length;
  const variance =
    finalEntropies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / finalEntropies.length;
  const stdDev = Math.sqrt(variance);

  // Check for trend
  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < finalEntropies.length; i++) {
    if (finalEntropies[i]! > finalEntropies[i - 1]! + 0.001) increasing++;
    else if (finalEntropies[i]! < finalEntropies[i - 1]! - 0.001) decreasing++;
  }

  // High variance indicates fluctuation
  if (stdDev > 0.1) return 'fluctuating';

  const totalChanges = increasing + decreasing;
  if (totalChanges === 0) return 'stable';

  const ratio = increasing / totalChanges;
  if (ratio > 0.7) return 'increasing';
  if (ratio < 0.3) return 'decreasing';

  return 'stable';
}

/**
 * Multi-metric classifier using population, entropy, and state hash analysis.
 *
 * Classification strategy:
 * 1. Check for extinction (population = 0)
 * 2. Check for homogeneous state (entropy = 0, Class 1)
 * 3. Check for exact cycle via state hash (Class 2 periodic)
 * 4. Check for stable fixed point (Class 2 stable)
 * 5. Check for chaotic behavior (high entropy variance, Class 3)
 * 6. Check for explosive growth
 * 7. Detect complex behavior (Class 4) via edge-of-chaos indicators
 *
 * @param metricsHistory - Full enhanced metrics history
 * @returns Classification result with confidence score
 */
export const multiMetricClassifier: EnhancedOutcomeClassifier = (
  metricsHistory: EnhancedMetrics[]
): ClassificationResult => {
  // Handle empty input
  if (metricsHistory.length === 0) {
    return {
      outcome: 'extinct',
      wolframClass: 'extinct',
      confidence: 1.0,
      details: {
        cycleDetected: false,
        cyclePeriod: null,
        entropyTrend: 'stable',
        populationTrend: 'stable',
      },
    };
  }

  const finalMetrics = metricsHistory[metricsHistory.length - 1]!;
  const stateHashes = metricsHistory.map((m) => m.stateHash);

  // Analyze trends
  const populationTrend = analyzePopulationTrend(metricsHistory);
  const entropyTrend = analyzeEntropyTrend(metricsHistory);

  // Detect cycles in the final 50% of the simulation
  const cycleWindow = Math.max(10, Math.floor(metricsHistory.length * 0.5));
  const cycleResult = detectCycle(stateHashes, cycleWindow);

  // Build details object
  const details: ClassificationResult['details'] = {
    cycleDetected: cycleResult.detected,
    cyclePeriod: cycleResult.period,
    entropyTrend,
    populationTrend,
  };

  // 1. Check for extinction
  if (finalMetrics.population === 0) {
    return {
      outcome: 'extinct',
      wolframClass: 'extinct',
      confidence: 1.0,
      details,
    };
  }

  // 2. Check for homogeneous state (Class 1)
  // Entropy = 0 means all cells are in the same state
  if (finalMetrics.entropy === 0 && finalMetrics.population > 0) {
    return {
      outcome: 'stable',
      wolframClass: 'class1',
      confidence: 0.95,
      details,
    };
  }

  // 3. Check for exact cycle (Class 2 periodic)
  if (cycleResult.detected && cycleResult.period !== null) {
    if (cycleResult.period === 1) {
      // Period 1 = stable fixed point
      return {
        outcome: 'stable',
        wolframClass: 'class2_stable',
        confidence: 0.95,
        details,
      };
    }

    return {
      outcome: 'oscillating',
      wolframClass: 'class2_periodic',
      confidence: 0.9,
      details,
    };
  }

  // 4. Check for chaotic behavior (Class 3)
  // High entropy variance and no detected cycle
  const entropies = metricsHistory.map((m) => m.entropy);
  const entropyMean = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  const entropyVariance =
    entropies.reduce((sum, e) => sum + Math.pow(e - entropyMean, 2), 0) / entropies.length;

  if (entropyVariance > 0.02 && entropyTrend === 'fluctuating') {
    return {
      outcome: 'oscillating', // Chaotic looks like oscillating at population level
      wolframClass: 'class3',
      confidence: 0.75,
      details,
    };
  }

  // 5. Check for explosive growth
  if (populationTrend === 'growing') {
    // Calculate growth rate
    const earlyEnd = Math.floor(metricsHistory.length * 0.3);
    const lateStart = Math.floor(metricsHistory.length * 0.7);

    const earlyMetrics = metricsHistory.slice(0, Math.max(1, earlyEnd));
    const lateMetrics = metricsHistory.slice(lateStart);

    const earlyAvg =
      earlyMetrics.reduce((sum, m) => sum + m.population, 0) / earlyMetrics.length;
    const lateAvg =
      lateMetrics.reduce((sum, m) => sum + m.population, 0) / lateMetrics.length;

    if (earlyAvg > 0 && lateAvg / earlyAvg > 1.5) {
      return {
        outcome: 'explosive',
        wolframClass: 'class3', // Often explosive = chaotic expansion
        confidence: 0.8,
        details,
      };
    }
  }

  // 6. Check for complex behavior (Class 4)
  // Edge of chaos: moderate entropy, long transients, no simple cycle
  // This is the hardest class to detect automatically
  if (
    entropyTrend === 'stable' &&
    entropyMean > 0.3 &&
    entropyMean < 0.8 &&
    !cycleResult.detected &&
    metricsHistory.length >= 50
  ) {
    // Might be Class 4, but confidence is lower
    return {
      outcome: 'stable',
      wolframClass: 'class4',
      confidence: 0.5, // Low confidence - Class 4 is hard to detect
      details,
    };
  }

  // 7. Default to stable (Class 2)
  return {
    outcome: 'stable',
    wolframClass: 'class2_stable',
    confidence: 0.7,
    details,
  };
};

/**
 * Simple adapter to convert multiMetricClassifier to basic OutcomeClassifier.
 *
 * This allows using the multi-metric classifier where only simple Outcome is needed.
 */
export function createSimpleClassifier(
  enhancedClassifier: EnhancedOutcomeClassifier
): (metricsHistory: EnhancedMetrics[]) => Outcome {
  return (metricsHistory: EnhancedMetrics[]) => {
    return enhancedClassifier(metricsHistory).outcome;
  };
}
