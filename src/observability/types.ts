/**
 * Type definitions for the observability system.
 *
 * The observability layer wraps experiment execution to provide:
 * - Timing information
 * - Event generation from metrics analysis
 * - Classification tracing
 * - Snapshotting for mid-experiment instrumentation
 *
 * Design principle: Keep the functional core pure. Observability runs as
 * a separate layer that wraps or analyzes results post-hoc.
 */

import type {
  ExperimentConfig,
  Metrics,
  EnhancedMetrics,
  Outcome,
  WolframClass,
  ExperimentResult,
} from '../types.js';
import type { EnhancedExperimentResult } from '../experiment.js';
import type { Grid } from '../grid.js';

/**
 * Verbosity levels for observability output.
 */
export type VerbosityLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Event categories for classification.
 */
export type EventCategory = 'lifecycle' | 'evolution' | 'classification' | 'performance';

/**
 * A single observability event generated from metrics analysis.
 *
 * Events are generated post-hoc by analyzing the metrics history,
 * not injected during evolution.
 */
export interface ObservabilityEvent {
  readonly type: string;
  readonly category: EventCategory;
  readonly timestamp: number;
  readonly step: number | null;
  readonly data: Record<string, unknown>;
}

/**
 * Timing information for a single evolution step.
 * Only available when using deep instrumentation.
 */
export interface StepTiming {
  readonly step: number;
  readonly durationMs: number;
  readonly population: number;
  readonly delta: number;
}

/**
 * Complete timing breakdown for an experiment.
 */
export interface ExperimentTiming {
  readonly totalMs: number;
  readonly initializationMs: number;
  readonly evolutionMs: number;
  readonly classificationMs: number;
  readonly averageStepMs: number;
  readonly stepTimings?: StepTiming[];
}

/**
 * Classification trace showing the decision path.
 * Reconstructed from metrics to explain classification reasoning.
 */
export interface ClassificationTrace {
  readonly outcome: Outcome;
  readonly wolframClass: WolframClass;
  readonly confidence: number;
  readonly reasoningPath: string[];
  readonly metrics: {
    readonly populationTrend: string;
    readonly entropyTrend: string;
    readonly cycleDetected: boolean;
    readonly cyclePeriod: number | null;
  };
}

/**
 * Timeline entry for metrics visualization.
 */
export interface MetricsTimelineEntry {
  readonly step: number;
  readonly timestamp: number;
  readonly population: number;
  readonly density: number;
  readonly entropy?: number;
  readonly delta: number;
}

/**
 * High-level experiment summary.
 */
export interface ExperimentSummary {
  readonly dimensions: string;
  readonly totalCells: number;
  readonly stepsExecuted: number;
  readonly initialPopulation: number;
  readonly finalPopulation: number;
  readonly populationChange: number;
  readonly populationChangePercent: number;
  readonly outcome: Outcome;
  readonly wolframClass: WolframClass;
}

/**
 * Complete observability report generated post-hoc.
 */
export interface ObservabilityReport {
  readonly experimentId: string;
  readonly config: ExperimentConfig;
  readonly timing: ExperimentTiming;
  readonly classification: ClassificationTrace;
  readonly events: ObservabilityEvent[];
  readonly metricsTimeline: MetricsTimelineEntry[];
  readonly summary: ExperimentSummary;
}

/**
 * Result from instrumented experiment run.
 * Extends ExperimentResult with observability report.
 */
export interface InstrumentedExperimentResult extends ExperimentResult {
  readonly report: ObservabilityReport;
}

/**
 * Result from instrumented enhanced experiment run.
 * Extends EnhancedExperimentResult with observability report.
 */
export interface InstrumentedEnhancedResult extends EnhancedExperimentResult {
  readonly report: ObservabilityReport;
}

/**
 * Serializable snapshot of experiment state.
 * Enables capturing grid state mid-experiment and resuming later
 * with different options (like enabling instrumentation).
 */
export interface ExperimentSnapshot {
  readonly id: string;
  readonly timestamp: string;
  readonly stepsTaken: number;
  readonly gridData: number[];
  readonly dimensions: number[];
  readonly metricsHistory: Metrics[] | EnhancedMetrics[];
  readonly config: ExperimentConfig;
}

/**
 * Options for resuming from a snapshot.
 */
export interface ResumeOptions {
  readonly additionalSteps: number;
  readonly instrumented?: boolean;
  readonly metricsInterval?: number;
}

/**
 * Options for evolution with snapshots.
 */
export interface SnapshotEvolutionOptions {
  readonly metricsInterval?: number;
  readonly snapshotInterval?: number;
  readonly onSnapshot?: (snapshot: ExperimentSnapshot, step: number) => void;
}

/**
 * Result from evolution with snapshots.
 */
export interface SnapshotEvolutionResult {
  readonly finalGrid: Grid;
  readonly metricsHistory: EnhancedMetrics[];
  readonly snapshots: ExperimentSnapshot[];
}

/**
 * OpenTelemetry-compatible span representation.
 */
export interface OTelSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startTimeUnixNano: bigint;
  readonly endTimeUnixNano: bigint;
  readonly attributes: Record<string, string | number | boolean>;
}
