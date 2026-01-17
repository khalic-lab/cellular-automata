/**
 * Observability module for N-dimensional cellular automata.
 *
 * Provides optional instrumentation, timing, and analysis without
 * modifying the pure functional core.
 *
 * Three levels of instrumentation:
 * 1. Wrapper mode - minimal overhead, total timing only
 * 2. Post-hoc analysis - pure analysis of results
 * 3. Deep instrumented - per-step timing, full tracing
 *
 * @example
 * ```typescript
 * import {
 *   runExperimentInstrumented,
 *   formatReportToConsole,
 * } from 'nd-cellular-automata/observability';
 *
 * const result = runExperimentInstrumented({
 *   dimensions: [20, 20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [4], survival: [4, 5] },
 *   steps: 100,
 *   initialDensity: 0.15,
 *   seed: 42,
 * });
 *
 * console.log(result.outcome);
 * formatReportToConsole(result.report);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  VerbosityLevel,
  EventCategory,
  ObservabilityEvent,
  StepTiming,
  ExperimentTiming,
  ClassificationTrace,
  MetricsTimelineEntry,
  ExperimentSummary,
  ObservabilityReport,
  InstrumentedExperimentResult,
  InstrumentedEnhancedResult,
  ExperimentSnapshot,
  ResumeOptions,
  SnapshotEvolutionOptions,
  SnapshotEvolutionResult,
  OTelSpan,
} from './types.js';

// ============================================================================
// Analyzer (Pure Functions)
// ============================================================================

export {
  analyzeExperiment,
  generateEventsFromMetrics,
  buildMetricsTimeline,
  traceClassification,
  buildSummary,
  generateExperimentId,
} from './analyzer.js';

// ============================================================================
// Instrumented Runners
// ============================================================================

export {
  runExperimentInstrumented,
  runExperimentEnhancedInstrumented,
  runExperimentDeepInstrumented,
  evolveWithSnapshots,
  resumeFromSnapshot,
} from './instrumented.js';

// ============================================================================
// Snapshot Functions
// ============================================================================

export {
  createSnapshot,
  restoreGridFromSnapshot,
  serializeSnapshot,
  deserializeSnapshot,
  validateSnapshot,
  snapshotSize,
  compressSnapshot,
  decompressSnapshot,
} from './snapshot.js';

// ============================================================================
// Formatters
// ============================================================================

// Console formatter
export {
  formatReportToConsole,
  formatReportOneLine,
  formatStepTimingHistogram,
} from './formatters/console.js';

// JSON formatter
export {
  formatReportToJson,
  formatReportToJsonLines,
  formatSummaryToJson,
  formatTimingToJson,
  formatEventsToJson,
  formatTimelineToJson,
  parseReportFromJson,
  formatReportComparison,
} from './formatters/json.js';

// OpenTelemetry formatter
export {
  formatReportToOTel,
  formatSpansToOtlpJson,
  formatEventsToOTelEvents,
  generateTraceParentHeader,
} from './formatters/otel.js';
