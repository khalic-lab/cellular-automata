/**
 * Console formatter for observability reports.
 *
 * Provides human-readable console output for experiment reports.
 * Designed for terminal display with clear sections and formatting.
 */

/* eslint-disable no-console */
declare const console: {
  log: (...args: unknown[]) => void;
};

import type { ObservabilityReport, VerbosityLevel } from '../types.js';

/**
 * Formats a report to human-readable console output.
 *
 * @param report - Observability report to format
 * @param verbosity - Level of detail to include (default: 'info')
 *
 * @example
 * ```typescript
 * const result = runExperimentInstrumented(config);
 * formatReportToConsole(result.report);
 * ```
 */
export function formatReportToConsole(
  report: ObservabilityReport,
  verbosity: VerbosityLevel = 'info'
): void {
  const line = '='.repeat(60);

  console.log(`\n${line}`);
  console.log(`  EXPERIMENT REPORT: ${report.experimentId}`);
  console.log(line);

  // Summary section
  console.log('\n[SUMMARY]');
  console.log(`   Dimensions: ${report.summary.dimensions}`);
  console.log(`   Total cells: ${report.summary.totalCells.toLocaleString()}`);
  console.log(`   Steps: ${report.summary.stepsExecuted}`);
  console.log(`   Outcome: ${report.summary.outcome} (${report.summary.wolframClass})`);
  console.log(`   Initial population: ${report.summary.initialPopulation.toLocaleString()}`);
  console.log(`   Final population: ${report.summary.finalPopulation.toLocaleString()}`);
  const changeSign = report.summary.populationChange >= 0 ? '+' : '';
  console.log(
    `   Population change: ${changeSign}${report.summary.populationChange.toLocaleString()} (${changeSign}${report.summary.populationChangePercent.toFixed(1)}%)`
  );

  // Timing section
  console.log('\n[TIMING]');
  console.log(`   Total: ${report.timing.totalMs.toFixed(2)}ms`);
  if (report.timing.initializationMs > 0) {
    console.log(`   Initialization: ${report.timing.initializationMs.toFixed(2)}ms`);
    console.log(`   Evolution: ${report.timing.evolutionMs.toFixed(2)}ms`);
    console.log(`   Classification: ${report.timing.classificationMs.toFixed(2)}ms`);
  }
  console.log(`   Avg step: ${report.timing.averageStepMs.toFixed(3)}ms`);

  // Step timing statistics (if available)
  if (report.timing.stepTimings && report.timing.stepTimings.length > 0) {
    const stepMs = report.timing.stepTimings.map((s) => s.durationMs);
    const minStep = Math.min(...stepMs);
    const maxStep = Math.max(...stepMs);
    const medianStep = stepMs.sort((a, b) => a - b)[Math.floor(stepMs.length / 2)]!;

    if (verbosity === 'debug' || verbosity === 'trace') {
      console.log(`   Step timing range: ${minStep.toFixed(3)}ms - ${maxStep.toFixed(3)}ms`);
      console.log(`   Median step: ${medianStep.toFixed(3)}ms`);
    }
  }

  // Classification reasoning section
  console.log('\n[CLASSIFICATION]');
  console.log(`   Confidence: ${(report.classification.confidence * 100).toFixed(0)}%`);
  console.log('   Reasoning:');
  for (const step of report.classification.reasoningPath) {
    console.log(`     > ${step}`);
  }

  if (verbosity === 'debug' || verbosity === 'trace') {
    console.log('   Metrics:');
    console.log(`     Population trend: ${report.classification.metrics.populationTrend}`);
    console.log(`     Entropy trend: ${report.classification.metrics.entropyTrend}`);
    console.log(`     Cycle detected: ${report.classification.metrics.cycleDetected}`);
    if (report.classification.metrics.cyclePeriod !== null) {
      console.log(`     Cycle period: ${report.classification.metrics.cyclePeriod}`);
    }
  }

  // Events section
  if (report.events.length > 0 && verbosity !== 'silent' && verbosity !== 'error') {
    console.log('\n[NOTABLE EVENTS]');
    const eventsToShow = verbosity === 'trace' ? report.events : report.events.slice(0, 10);
    for (const event of eventsToShow) {
      const stepStr = event.step !== null ? `[step ${event.step}]` : '[--]';
      console.log(`   ${stepStr} ${event.type}`);

      if (verbosity === 'trace') {
        for (const [key, value] of Object.entries(event.data)) {
          console.log(`       ${key}: ${value}`);
        }
      }
    }
    if (report.events.length > eventsToShow.length) {
      console.log(`   ... and ${report.events.length - eventsToShow.length} more events`);
    }
  }

  // Metrics timeline (trace only)
  if (verbosity === 'trace' && report.metricsTimeline.length > 0) {
    console.log('\n[METRICS TIMELINE]');
    console.log('   Step   | Population | Density | Delta | Entropy');
    console.log(`   ${'-'.repeat(52)}`);

    // Show first 5, last 5, and some in between
    const timeline = report.metricsTimeline;
    const showAll = timeline.length <= 15;
    const indices = showAll
      ? timeline.map((_, i) => i)
      : [
          ...timeline.slice(0, 5).map((_, i) => i),
          Math.floor(timeline.length / 2),
          ...timeline.slice(-5).map((_, i) => timeline.length - 5 + i),
        ];

    let lastIndex = -1;
    for (const i of indices) {
      if (!showAll && lastIndex !== -1 && i - lastIndex > 1) {
        console.log('   ...    | ...        | ...     | ...   | ...');
      }
      const m = timeline[i]!;
      const entropy = m.entropy !== undefined ? m.entropy.toFixed(3) : 'N/A';
      const deltaStr = m.delta >= 0 ? `+${m.delta}` : `${m.delta}`;
      console.log(
        `   ${String(m.step).padStart(6)} | ${String(m.population).padStart(10)} | ${m.density.toFixed(3).padStart(7)} | ${deltaStr.padStart(5)} | ${entropy}`
      );
      lastIndex = i;
    }
  }

  console.log(`\n${line}\n`);
}

/**
 * Formats a compact single-line summary.
 *
 * @param report - Observability report
 * @returns Single-line summary string
 */
export function formatReportOneLine(report: ObservabilityReport): string {
  return `[${report.experimentId}] ${report.summary.dimensions} @ ${report.summary.stepsExecuted} steps -> ${report.summary.outcome} (${report.summary.wolframClass}) in ${report.timing.totalMs.toFixed(1)}ms`;
}

/**
 * Formats step timing histogram for deep instrumented runs.
 *
 * @param report - Report with step timings
 * @param buckets - Number of histogram buckets (default: 10)
 */
export function formatStepTimingHistogram(report: ObservabilityReport, buckets = 10): void {
  if (!report.timing.stepTimings || report.timing.stepTimings.length === 0) {
    console.log(
      'No step timing data available. Use runExperimentDeepInstrumented for per-step timing.'
    );
    return;
  }

  const timings = report.timing.stepTimings.map((s) => s.durationMs);
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const bucketSize = (max - min) / buckets || 1;

  const histogram = new Array(buckets).fill(0);
  for (const t of timings) {
    const bucket = Math.min(Math.floor((t - min) / bucketSize), buckets - 1);
    histogram[bucket]++;
  }

  const maxCount = Math.max(...histogram);
  const barWidth = 40;

  console.log('\n[STEP TIMING HISTOGRAM]');
  console.log(`Range: ${min.toFixed(3)}ms - ${max.toFixed(3)}ms\n`);

  for (let i = 0; i < buckets; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = min + (i + 1) * bucketSize;
    const count = histogram[i]!;
    const barLength = Math.round((count / maxCount) * barWidth);
    const bar = '#'.repeat(barLength).padEnd(barWidth);

    console.log(
      `${bucketMin.toFixed(3).padStart(8)}ms - ${bucketMax.toFixed(3).padStart(8)}ms | ${bar} ${count}`
    );
  }
  console.log('');
}
