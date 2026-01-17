/**
 * JSON formatters for observability reports.
 *
 * Provides structured JSON output for:
 * - Full report serialization
 * - JSON Lines format for log aggregation
 * - Filtered/subset exports
 */

import type { ObservabilityReport } from '../types.js';

/**
 * Formats a complete report to JSON string.
 *
 * @param report - Observability report
 * @param pretty - Whether to pretty-print (default: true)
 * @returns JSON string representation
 *
 * @example
 * ```typescript
 * const json = formatReportToJson(result.report);
 * fs.writeFileSync('report.json', json);
 * ```
 */
export function formatReportToJson(report: ObservabilityReport, pretty = true): string {
  return JSON.stringify(report, null, pretty ? 2 : undefined);
}

/**
 * Formats report as JSON Lines (one JSON object per line).
 *
 * Suitable for log aggregation systems like:
 * - Elasticsearch
 * - Splunk
 * - CloudWatch Logs
 * - Datadog
 *
 * @param report - Observability report
 * @returns Newline-separated JSON strings
 *
 * @example
 * ```typescript
 * const jsonl = formatReportToJsonLines(result.report);
 * fs.appendFileSync('experiments.jsonl', jsonl + '\n');
 * ```
 */
export function formatReportToJsonLines(report: ObservabilityReport): string {
  const lines: string[] = [];

  // Experiment start record
  lines.push(
    JSON.stringify({
      type: 'experiment_start',
      experimentId: report.experimentId,
      timestamp: new Date().toISOString(),
      dimensions: report.summary.dimensions,
      totalCells: report.summary.totalCells,
      steps: report.summary.stepsExecuted,
      config: {
        neighborhoodType: report.config.neighborhood.type,
        neighborhoodRange: report.config.neighborhood.range ?? 1,
        birthThresholds: report.config.rule.birth,
        survivalThresholds: report.config.rule.survival,
        initialDensity: report.config.initialDensity,
        seed: report.config.seed,
      },
    })
  );

  // Individual events
  for (const event of report.events) {
    lines.push(
      JSON.stringify({
        type: 'event',
        experimentId: report.experimentId,
        eventType: event.type,
        category: event.category,
        step: event.step,
        data: event.data,
      })
    );
  }

  // Experiment end record
  lines.push(
    JSON.stringify({
      type: 'experiment_end',
      experimentId: report.experimentId,
      timestamp: new Date().toISOString(),
      outcome: report.summary.outcome,
      wolframClass: report.summary.wolframClass,
      confidence: report.classification.confidence,
      finalPopulation: report.summary.finalPopulation,
      timing: report.timing,
    })
  );

  return lines.join('\n');
}

/**
 * Extracts only summary information as JSON.
 *
 * @param report - Observability report
 * @returns JSON string with summary only
 */
export function formatSummaryToJson(report: ObservabilityReport): string {
  return JSON.stringify(
    {
      experimentId: report.experimentId,
      summary: report.summary,
      classification: {
        outcome: report.classification.outcome,
        wolframClass: report.classification.wolframClass,
        confidence: report.classification.confidence,
      },
      timing: {
        totalMs: report.timing.totalMs,
        averageStepMs: report.timing.averageStepMs,
      },
    },
    null,
    2
  );
}

/**
 * Extracts only timing information as JSON.
 *
 * @param report - Observability report
 * @returns JSON string with timing only
 */
export function formatTimingToJson(report: ObservabilityReport): string {
  return JSON.stringify(
    {
      experimentId: report.experimentId,
      timing: report.timing,
    },
    null,
    2
  );
}

/**
 * Extracts only events as JSON array.
 *
 * @param report - Observability report
 * @param filter - Optional filter by category or type
 * @returns JSON string with events array
 */
export function formatEventsToJson(
  report: ObservabilityReport,
  filter?: { category?: string; type?: string }
): string {
  let events = report.events;

  if (filter?.category) {
    events = events.filter((e) => e.category === filter.category);
  }
  if (filter?.type) {
    events = events.filter((e) => e.type === filter.type);
  }

  return JSON.stringify(
    {
      experimentId: report.experimentId,
      eventCount: events.length,
      events,
    },
    null,
    2
  );
}

/**
 * Extracts metrics timeline as JSON.
 *
 * @param report - Observability report
 * @param interval - Only include every Nth entry (default: 1)
 * @returns JSON string with metrics timeline
 */
export function formatTimelineToJson(report: ObservabilityReport, interval = 1): string {
  const timeline =
    interval === 1
      ? report.metricsTimeline
      : report.metricsTimeline.filter((_, i) => i % interval === 0);

  return JSON.stringify(
    {
      experimentId: report.experimentId,
      entryCount: timeline.length,
      timeline,
    },
    null,
    2
  );
}

/**
 * Parses a JSON report back to ObservabilityReport type.
 *
 * @param json - JSON string from formatReportToJson
 * @returns Parsed ObservabilityReport
 */
export function parseReportFromJson(json: string): ObservabilityReport {
  return JSON.parse(json) as ObservabilityReport;
}

/**
 * Creates a comparison JSON of multiple reports.
 *
 * @param reports - Array of reports to compare
 * @returns JSON comparison object
 */
export function formatReportComparison(reports: ObservabilityReport[]): string {
  return JSON.stringify(
    {
      reportCount: reports.length,
      reports: reports.map((r) => ({
        experimentId: r.experimentId,
        dimensions: r.summary.dimensions,
        steps: r.summary.stepsExecuted,
        outcome: r.summary.outcome,
        wolframClass: r.summary.wolframClass,
        confidence: r.classification.confidence,
        totalMs: r.timing.totalMs,
        finalPopulation: r.summary.finalPopulation,
        populationChange: r.summary.populationChange,
      })),
      summary: {
        outcomes: countBy(reports, (r) => r.summary.outcome),
        wolframClasses: countBy(reports, (r) => r.summary.wolframClass),
        avgTotalMs: reports.reduce((sum, r) => sum + r.timing.totalMs, 0) / reports.length,
        avgConfidence:
          reports.reduce((sum, r) => sum + r.classification.confidence, 0) / reports.length,
      },
    },
    null,
    2
  );
}

/**
 * Helper to count occurrences by key.
 */
function countBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
