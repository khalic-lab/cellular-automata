/**
 * Post-hoc analysis functions for observability.
 *
 * Pure functions that analyze ExperimentResult and metricsHistory
 * to generate events, timelines, and classification traces.
 *
 * Design: All functions are pure - result in, events out.
 * No side effects, no modification of core functions.
 */

import type {
  Metrics,
  EnhancedMetrics,
  Outcome,
  WolframClass,
  ExperimentResult,
} from '../types.js';
import type { EnhancedExperimentResult } from '../experiment.js';
import type { ClassificationResult } from '../classifier.js';
import type {
  ObservabilityEvent,
  ClassificationTrace,
  MetricsTimelineEntry,
  ExperimentSummary,
  ExperimentTiming,
  ObservabilityReport,
} from './types.js';

/**
 * Generates a unique experiment ID.
 *
 * Format: exp_{timestamp_base36}_{random_base36}
 */
export function generateExperimentId(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Detects if metrics contain enhanced data (entropy, stateHash).
 */
function isEnhancedMetrics(m: Metrics | EnhancedMetrics): m is EnhancedMetrics {
  return 'entropy' in m && 'stateHash' in m;
}

/**
 * Generates observability events from metrics history.
 *
 * Analyzes the metrics post-hoc to detect significant events:
 * - Extinction: population reaches zero
 * - Population spikes: large sudden changes
 * - Entropy shifts: transitions between ordered and chaotic states
 * - Cycle detection: repeated population patterns
 *
 * @param metricsHistory - Full metrics history from experiment
 * @returns Array of detected events
 */
export function generateEventsFromMetrics(
  metricsHistory: Metrics[] | EnhancedMetrics[]
): ObservabilityEvent[] {
  const events: ObservabilityEvent[] = [];

  if (metricsHistory.length === 0) {
    return events;
  }

  // Add experiment start event
  const firstMetrics = metricsHistory[0]!;
  events.push({
    type: 'experiment_started',
    category: 'lifecycle',
    timestamp: 0,
    step: 0,
    data: {
      initialPopulation: firstMetrics.population,
      initialDensity: firstMetrics.density,
    },
  });

  // Track significant events during evolution
  let prevExtinctionWarned = false;
  let prevPopulation = firstMetrics.population;

  for (let i = 1; i < metricsHistory.length; i++) {
    const m = metricsHistory[i]!;
    const prev = metricsHistory[i - 1]!;

    // Extinction event
    if (m.population === 0 && prev.population !== 0) {
      events.push({
        type: 'extinction',
        category: 'evolution',
        timestamp: i,
        step: m.step,
        data: {
          previousPopulation: prev.population,
          stepsSinceStart: m.step,
        },
      });
    }

    // Near-extinction warning (< 5% of max population seen)
    const maxPopulation = Math.max(...metricsHistory.slice(0, i + 1).map(x => x.population));
    if (m.population > 0 && m.population < maxPopulation * 0.05 && !prevExtinctionWarned) {
      events.push({
        type: 'near_extinction',
        category: 'evolution',
        timestamp: i,
        step: m.step,
        data: {
          population: m.population,
          maxPopulation,
          percentOfMax: (m.population / maxPopulation * 100).toFixed(1),
        },
      });
      prevExtinctionWarned = true;
    } else if (m.population >= maxPopulation * 0.1) {
      prevExtinctionWarned = false;
    }

    // Population spike (> 20% change from previous)
    if (prevPopulation > 0) {
      const changePercent = Math.abs(m.delta) / prevPopulation;
      if (changePercent > 0.2) {
        events.push({
          type: m.delta > 0 ? 'population_spike_up' : 'population_spike_down',
          category: 'evolution',
          timestamp: i,
          step: m.step,
          data: {
            previousPopulation: prevPopulation,
            newPopulation: m.population,
            delta: m.delta,
            changePercent: (changePercent * 100).toFixed(1),
          },
        });
      }
    }

    // Entropy shift (for enhanced metrics)
    if (isEnhancedMetrics(m) && isEnhancedMetrics(prev)) {
      const entropyChange = Math.abs(m.entropy - prev.entropy);
      if (entropyChange > 0.1) {
        events.push({
          type: m.entropy > prev.entropy ? 'entropy_increase' : 'entropy_decrease',
          category: 'evolution',
          timestamp: i,
          step: m.step,
          data: {
            previousEntropy: prev.entropy.toFixed(3),
            newEntropy: m.entropy.toFixed(3),
            change: entropyChange.toFixed(3),
          },
        });
      }
    }

    prevPopulation = m.population;
  }

  // Add experiment end event
  const lastMetrics = metricsHistory[metricsHistory.length - 1]!;
  events.push({
    type: 'experiment_completed',
    category: 'lifecycle',
    timestamp: metricsHistory.length - 1,
    step: lastMetrics.step,
    data: {
      finalPopulation: lastMetrics.population,
      finalDensity: lastMetrics.density,
      totalSteps: lastMetrics.step,
    },
  });

  return events;
}

/**
 * Builds a timeline from metrics history.
 *
 * Creates a simplified view of metrics over time suitable for visualization.
 *
 * @param metricsHistory - Full metrics history
 * @returns Timeline entries for each metrics snapshot
 */
export function buildMetricsTimeline(
  metricsHistory: Metrics[] | EnhancedMetrics[]
): MetricsTimelineEntry[] {
  return metricsHistory.map((m, i) => ({
    step: m.step,
    timestamp: i,
    population: m.population,
    density: m.density,
    entropy: isEnhancedMetrics(m) ? m.entropy : undefined,
    delta: m.delta,
  }));
}

/**
 * Generates classification trace by reconstructing decision path.
 *
 * Analyzes metrics to explain why a particular classification was made.
 *
 * @param metricsHistory - Enhanced metrics history
 * @param result - Classification result from classifier
 * @returns Classification trace with reasoning path
 */
export function traceClassification(
  _metricsHistory: EnhancedMetrics[],
  result: ClassificationResult
): ClassificationTrace {
  const reasoningPath: string[] = [];

  // Build reasoning path based on classification
  if (result.outcome === 'extinct') {
    reasoningPath.push('Final population is 0');
    reasoningPath.push('Classification: extinct');
  } else if (result.details.cycleDetected) {
    reasoningPath.push(`Cycle detected with period ${result.details.cyclePeriod}`);
    if (result.details.cyclePeriod === 1) {
      reasoningPath.push('Period 1 indicates stable fixed point');
      reasoningPath.push('Classification: stable (class2_stable)');
    } else {
      reasoningPath.push('Period > 1 indicates oscillating behavior');
      reasoningPath.push('Classification: oscillating (class2_periodic)');
    }
  } else if (result.wolframClass === 'class3') {
    reasoningPath.push('High entropy variance detected');
    reasoningPath.push(`Entropy trend: ${result.details.entropyTrend}`);
    reasoningPath.push('Classification: chaotic (class3)');
  } else if (result.wolframClass === 'class4') {
    reasoningPath.push('Moderate stable entropy without cycles');
    reasoningPath.push('Long transient behavior observed');
    reasoningPath.push('Classification: complex (class4)');
  } else if (result.wolframClass === 'class1') {
    reasoningPath.push('Entropy is 0 (homogeneous state)');
    reasoningPath.push('Classification: homogeneous (class1)');
  } else {
    reasoningPath.push(`Population trend: ${result.details.populationTrend}`);
    reasoningPath.push(`Entropy trend: ${result.details.entropyTrend}`);
    reasoningPath.push(`Classification: ${result.outcome} (${result.wolframClass})`);
  }

  return {
    outcome: result.outcome,
    wolframClass: result.wolframClass,
    confidence: result.confidence,
    reasoningPath,
    metrics: {
      populationTrend: result.details.populationTrend,
      entropyTrend: result.details.entropyTrend,
      cycleDetected: result.details.cycleDetected,
      cyclePeriod: result.details.cyclePeriod,
    },
  };
}

/**
 * Builds a minimal classification trace from basic experiment result.
 * Used when enhanced classification data is not available.
 */
function traceClassificationBasic(
  metrics: Metrics[],
  outcome: Outcome
): ClassificationTrace {
  const reasoningPath: string[] = [];
  let wolframClass: WolframClass = 'class2_stable';

  if (outcome === 'extinct') {
    reasoningPath.push('Final population is 0');
    reasoningPath.push('Classification: extinct');
    wolframClass = 'extinct';
  } else if (outcome === 'oscillating') {
    reasoningPath.push('Repeated population pattern detected');
    reasoningPath.push('Classification: oscillating');
    wolframClass = 'class2_periodic';
  } else if (outcome === 'explosive') {
    reasoningPath.push('Population growth detected');
    reasoningPath.push('Classification: explosive');
    wolframClass = 'class3';
  } else {
    reasoningPath.push('No significant patterns detected');
    reasoningPath.push('Classification: stable');
    wolframClass = 'class2_stable';
  }

  // Analyze population trend
  let populationTrend: 'growing' | 'shrinking' | 'stable' | 'oscillating' = 'stable';
  if (metrics.length > 2) {
    const earlyAvg = metrics.slice(0, Math.floor(metrics.length / 2))
      .reduce((sum, m) => sum + m.population, 0) / Math.floor(metrics.length / 2);
    const lateAvg = metrics.slice(Math.floor(metrics.length / 2))
      .reduce((sum, m) => sum + m.population, 0) / Math.ceil(metrics.length / 2);

    if (lateAvg > earlyAvg * 1.2) populationTrend = 'growing';
    else if (lateAvg < earlyAvg * 0.8) populationTrend = 'shrinking';
  }

  return {
    outcome,
    wolframClass,
    confidence: 0.7, // Lower confidence without enhanced metrics
    reasoningPath,
    metrics: {
      populationTrend,
      entropyTrend: 'stable', // Unknown without enhanced metrics
      cycleDetected: outcome === 'oscillating',
      cyclePeriod: null,
    },
  };
}

/**
 * Builds high-level experiment summary.
 */
export function buildSummary(
  result: ExperimentResult | EnhancedExperimentResult
): ExperimentSummary {
  const { config, metricsHistory, finalPopulation, outcome } = result;
  const totalCells = config.dimensions.reduce((a: number, b: number) => a * b, 1);

  const initialPopulation = metricsHistory.length > 0 ? metricsHistory[0]!.population : 0;
  const populationChange = finalPopulation - initialPopulation;
  const populationChangePercent = initialPopulation > 0
    ? (populationChange / initialPopulation) * 100
    : 0;

  const wolframClass = 'wolframClass' in result
    ? result.wolframClass
    : (outcome === 'extinct' ? 'extinct' : 'class2_stable');

  return {
    dimensions: config.dimensions.join('x'),
    totalCells,
    stepsExecuted: config.steps,
    initialPopulation,
    finalPopulation,
    populationChange,
    populationChangePercent,
    outcome,
    wolframClass,
  };
}

/**
 * Creates complete observability report from experiment result.
 *
 * Main entry point for post-hoc analysis. Takes an experiment result
 * and timing data, returns a full observability report.
 *
 * @param result - Experiment result (basic or enhanced)
 * @param timing - Timing information (from wrapper or estimated)
 * @returns Complete observability report
 */
export function analyzeExperiment(
  result: ExperimentResult | EnhancedExperimentResult,
  timing: ExperimentTiming
): ObservabilityReport {
  const experimentId = generateExperimentId();

  // Determine if we have enhanced metrics
  const isEnhanced = 'wolframClass' in result &&
    result.metricsHistory.length > 0 &&
    isEnhancedMetrics(result.metricsHistory[0]!);

  // Build classification trace
  let classification: ClassificationTrace;
  if (isEnhanced) {
    const enhancedResult = result as EnhancedExperimentResult;
    classification = traceClassification(
      enhancedResult.metricsHistory,
      {
        outcome: enhancedResult.outcome,
        wolframClass: enhancedResult.wolframClass,
        confidence: enhancedResult.confidence,
        details: enhancedResult.details,
      }
    );
  } else {
    classification = traceClassificationBasic(result.metricsHistory, result.outcome);
  }

  return {
    experimentId,
    config: result.config,
    timing,
    classification,
    events: generateEventsFromMetrics(result.metricsHistory),
    metricsTimeline: buildMetricsTimeline(result.metricsHistory),
    summary: buildSummary(result),
  };
}
