/**
 * OpenTelemetry-compatible export formatter.
 *
 * Generates spans in a format compatible with OpenTelemetry tracing.
 * Can be used to export experiment traces to observability platforms
 * like Jaeger, Zipkin, Honeycomb, etc.
 *
 * Note: This provides the data structures but does not include
 * actual OpenTelemetry SDK integration (zero-dependency design).
 */

import type { OTelSpan, ObservabilityReport } from '../types.js';

/**
 * Generates a random span ID (16 hex chars).
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts experiment ID to a valid trace ID (32 hex chars).
 */
function experimentIdToTraceId(experimentId: string): string {
  // Hash the experiment ID to get consistent trace ID
  let hash = 0;
  for (let i = 0; i < experimentId.length; i++) {
    const char = experimentId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Pad to 32 hex chars
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return (
    experimentId
      .replace(/[^a-f0-9]/gi, '')
      .padStart(24, '0')
      .slice(0, 24) + hashHex
  );
}

/**
 * Converts milliseconds to nanoseconds as bigint.
 */
function msToNano(ms: number): bigint {
  return BigInt(Math.floor(ms * 1_000_000));
}

/**
 * Formats an observability report as OpenTelemetry spans.
 *
 * Creates a span hierarchy:
 * - Root span: experiment
 *   - Child span: initialization (if timed)
 *   - Child span: evolution (if timed)
 *     - Child spans: individual steps (if deep instrumented)
 *   - Child span: classification (if timed)
 *
 * @param report - Observability report
 * @returns Array of OTel-compatible spans
 *
 * @example
 * ```typescript
 * const spans = formatReportToOTel(result.report);
 *
 * // Export to your tracing backend
 * for (const span of spans) {
 *   yourTracer.recordSpan(span);
 * }
 * ```
 */
export function formatReportToOTel(report: ObservabilityReport): OTelSpan[] {
  const traceId = experimentIdToTraceId(report.experimentId);
  const spans: OTelSpan[] = [];

  // Root span for entire experiment
  const rootSpanId = generateSpanId();
  const rootSpan: OTelSpan = {
    traceId,
    spanId: rootSpanId,
    name: 'experiment',
    startTimeUnixNano: BigInt(0),
    endTimeUnixNano: msToNano(report.timing.totalMs),
    attributes: {
      'experiment.id': report.experimentId,
      'experiment.dimensions': report.summary.dimensions,
      'experiment.total_cells': report.summary.totalCells,
      'experiment.steps': report.summary.stepsExecuted,
      'experiment.outcome': report.summary.outcome,
      'experiment.wolfram_class': report.summary.wolframClass,
      'experiment.confidence': report.classification.confidence,
      'experiment.initial_population': report.summary.initialPopulation,
      'experiment.final_population': report.summary.finalPopulation,
      'neighborhood.type': report.config.neighborhood.type,
      'neighborhood.range': report.config.neighborhood.range ?? 1,
      'rule.birth': report.config.rule.birth.toString(),
      'rule.survival': report.config.rule.survival.toString(),
      'config.initial_density': report.config.initialDensity,
      'config.seed': report.config.seed ?? 42,
    },
  };
  spans.push(rootSpan);

  // If we have phase timing, add child spans
  if (report.timing.initializationMs > 0) {
    let currentTime = BigInt(0);

    // Initialization span
    const initSpanId = generateSpanId();
    spans.push({
      traceId,
      spanId: initSpanId,
      parentSpanId: rootSpanId,
      name: 'initialization',
      startTimeUnixNano: currentTime,
      endTimeUnixNano: currentTime + msToNano(report.timing.initializationMs),
      attributes: {
        phase: 'initialization',
        duration_ms: report.timing.initializationMs,
      },
    });
    currentTime += msToNano(report.timing.initializationMs);

    // Evolution span
    const evolutionSpanId = generateSpanId();
    spans.push({
      traceId,
      spanId: evolutionSpanId,
      parentSpanId: rootSpanId,
      name: 'evolution',
      startTimeUnixNano: currentTime,
      endTimeUnixNano: currentTime + msToNano(report.timing.evolutionMs),
      attributes: {
        phase: 'evolution',
        duration_ms: report.timing.evolutionMs,
        steps: report.summary.stepsExecuted,
        avg_step_ms: report.timing.averageStepMs,
      },
    });

    // Add step spans if available (only first 100 to avoid overwhelming)
    if (report.timing.stepTimings && report.timing.stepTimings.length > 0) {
      let stepTime = currentTime;
      const maxSteps = Math.min(report.timing.stepTimings.length, 100);

      for (let i = 0; i < maxSteps; i++) {
        const stepTiming = report.timing.stepTimings[i]!;
        spans.push({
          traceId,
          spanId: generateSpanId(),
          parentSpanId: evolutionSpanId,
          name: `step_${stepTiming.step}`,
          startTimeUnixNano: stepTime,
          endTimeUnixNano: stepTime + msToNano(stepTiming.durationMs),
          attributes: {
            'step.number': stepTiming.step,
            'step.duration_ms': stepTiming.durationMs,
            'step.population': stepTiming.population,
            'step.delta': stepTiming.delta,
          },
        });
        stepTime += msToNano(stepTiming.durationMs);
      }
    }

    currentTime += msToNano(report.timing.evolutionMs);

    // Classification span
    spans.push({
      traceId,
      spanId: generateSpanId(),
      parentSpanId: rootSpanId,
      name: 'classification',
      startTimeUnixNano: currentTime,
      endTimeUnixNano: currentTime + msToNano(report.timing.classificationMs),
      attributes: {
        phase: 'classification',
        duration_ms: report.timing.classificationMs,
        outcome: report.summary.outcome,
        wolfram_class: report.summary.wolframClass,
        confidence: report.classification.confidence,
      },
    });
  }

  return spans;
}

/**
 * Formats spans to OTLP JSON format.
 *
 * This format can be sent directly to OTLP-compatible collectors.
 *
 * @param spans - Array of spans from formatReportToOTel
 * @returns JSON string in OTLP format
 */
export function formatSpansToOtlpJson(spans: OTelSpan[]): string {
  const resourceSpans = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: 'service.name',
              value: { stringValue: 'nd-cellular-automata' },
            },
            {
              key: 'service.version',
              value: { stringValue: '1.0.0' },
            },
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: 'observability',
              version: '1.0.0',
            },
            spans: spans.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId,
              name: span.name,
              kind: 1, // INTERNAL
              startTimeUnixNano: span.startTimeUnixNano.toString(),
              endTimeUnixNano: span.endTimeUnixNano.toString(),
              attributes: Object.entries(span.attributes).map(([key, value]) => ({
                key,
                value:
                  typeof value === 'string'
                    ? { stringValue: value }
                    : typeof value === 'boolean'
                      ? { boolValue: value }
                      : { intValue: value.toString() },
              })),
            })),
          },
        ],
      },
    ],
  };

  return JSON.stringify(resourceSpans, null, 2);
}

/**
 * Creates span events from observability events.
 *
 * Can be attached to spans as additional context.
 *
 * @param report - Observability report
 * @returns Array of span events
 */
export function formatEventsToOTelEvents(report: ObservabilityReport): Array<{
  name: string;
  timeUnixNano: bigint;
  attributes: Record<string, string | number | boolean>;
}> {
  return report.events.map((event) => ({
    name: event.type,
    timeUnixNano: BigInt(event.timestamp * 1_000_000), // Relative time as nano
    attributes: {
      category: event.category,
      step: event.step ?? 0,
      ...Object.fromEntries(Object.entries(event.data).map(([k, v]) => [k, String(v)])),
    },
  }));
}

/**
 * Generates a trace context header for distributed tracing.
 *
 * Format: 00-{trace-id}-{span-id}-01
 *
 * @param report - Observability report
 * @returns W3C trace context header value
 */
export function generateTraceParentHeader(report: ObservabilityReport): string {
  const traceId = experimentIdToTraceId(report.experimentId);
  const spanId = generateSpanId();
  return `00-${traceId}-${spanId}-01`;
}
