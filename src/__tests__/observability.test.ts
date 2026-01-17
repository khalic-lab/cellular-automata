import { describe, expect, it, vi } from 'vitest';
import { runExperiment, runExperimentEnhanced } from '../experiment.js';
import { createGrid, initializeRandom } from '../grid.js';
import { generateNeighborhood, getMaxNeighbors } from '../neighborhood.js';
import {
  type InstrumentedEnhancedResult,
  // Analyzer
  analyzeExperiment,
  buildMetricsTimeline,
  compressSnapshot,
  // Snapshot functions
  createSnapshot,
  decompressSnapshot,
  deserializeSnapshot,
  evolveWithSnapshots,
  // Console formatter
  formatReportOneLine,
  // JSON formatters
  formatReportToJson,
  formatReportToJsonLines,
  // OTel formatters
  formatReportToOTel,
  formatSpansToOtlpJson,
  formatSummaryToJson,
  generateEventsFromMetrics,
  generateExperimentId,
  parseReportFromJson,
  restoreGridFromSnapshot,
  resumeFromSnapshot,
  runExperimentDeepInstrumented,
  runExperimentEnhancedInstrumented,
  // Instrumented runners
  runExperimentInstrumented,
  serializeSnapshot,
  snapshotSize,
  validateSnapshot,
} from '../observability/index.js';
import { createRandom } from '../random.js';
import { ruleFromThresholds } from '../rule.js';
import type { EnhancedMetrics, ExperimentConfig, Metrics } from '../types.js';

describe('observability', () => {
  const baseConfig: ExperimentConfig = {
    dimensions: [10, 10],
    neighborhood: { type: 'moore', range: 1 },
    rule: { birth: [3], survival: [2, 3] },
    steps: 20,
    initialDensity: 0.3,
    seed: 42,
  };

  describe('generateExperimentId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateExperimentId();
      const id2 = generateExperimentId();
      expect(id1).not.toBe(id2);
    });

    it('should follow expected format', () => {
      const id = generateExperimentId();
      expect(id).toMatch(/^exp_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('generateEventsFromMetrics', () => {
    it('should return empty array for empty metrics', () => {
      const events = generateEventsFromMetrics([]);
      expect(events).toEqual([]);
    });

    it('should generate lifecycle events', () => {
      const metrics: Metrics[] = [
        { population: 30, density: 0.3, births: 0, deaths: 0, delta: 0, step: 1 },
        { population: 35, density: 0.35, births: 5, deaths: 0, delta: 5, step: 2 },
      ];

      const events = generateEventsFromMetrics(metrics);

      const lifecycleEvents = events.filter((e) => e.category === 'lifecycle');
      expect(lifecycleEvents.length).toBe(2); // start and end
      expect(lifecycleEvents.map((e) => e.type)).toContain('experiment_started');
      expect(lifecycleEvents.map((e) => e.type)).toContain('experiment_completed');
    });

    it('should detect extinction event', () => {
      const metrics: Metrics[] = [
        { population: 10, density: 0.1, births: 0, deaths: 0, delta: 0, step: 1 },
        { population: 5, density: 0.05, births: 0, deaths: 5, delta: -5, step: 2 },
        { population: 0, density: 0, births: 0, deaths: 5, delta: -5, step: 3 },
      ];

      const events = generateEventsFromMetrics(metrics);

      const extinctionEvent = events.find((e) => e.type === 'extinction');
      expect(extinctionEvent).toBeDefined();
      expect(extinctionEvent?.step).toBe(3);
    });

    it('should detect population spikes', () => {
      const metrics: Metrics[] = [
        { population: 100, density: 0.1, births: 0, deaths: 0, delta: 0, step: 1 },
        { population: 150, density: 0.15, births: 50, deaths: 0, delta: 50, step: 2 }, // 50% increase
      ];

      const events = generateEventsFromMetrics(metrics);

      const spikeEvent = events.find((e) => e.type === 'population_spike_up');
      expect(spikeEvent).toBeDefined();
      expect(spikeEvent?.step).toBe(2);
    });
  });

  describe('buildMetricsTimeline', () => {
    it('should build timeline from metrics', () => {
      const metrics: Metrics[] = [
        { population: 30, density: 0.3, births: 0, deaths: 0, delta: 0, step: 1 },
        { population: 35, density: 0.35, births: 5, deaths: 0, delta: 5, step: 2 },
      ];

      const timeline = buildMetricsTimeline(metrics);

      expect(timeline).toHaveLength(2);
      expect(timeline[0]!.step).toBe(1);
      expect(timeline[0]!.population).toBe(30);
      expect(timeline[1]!.delta).toBe(5);
    });

    it('should include entropy for enhanced metrics', () => {
      const metrics: EnhancedMetrics[] = [
        {
          population: 30,
          density: 0.3,
          births: 0,
          deaths: 0,
          delta: 0,
          step: 1,
          entropy: 0.8,
          stateHash: 123,
        },
      ];

      const timeline = buildMetricsTimeline(metrics);

      expect(timeline[0]!.entropy).toBe(0.8);
    });
  });

  describe('analyzeExperiment', () => {
    it('should generate complete report', () => {
      const result = runExperiment(baseConfig);
      const timing = {
        totalMs: 100,
        initializationMs: 0,
        evolutionMs: 0,
        classificationMs: 0,
        averageStepMs: 5,
      };

      const report = analyzeExperiment(result, timing);

      expect(report.experimentId).toBeDefined();
      expect(report.config).toEqual(result.config);
      expect(report.timing).toEqual(timing);
      expect(report.classification.outcome).toBe(result.outcome);
      expect(report.events).toBeInstanceOf(Array);
      expect(report.metricsTimeline).toBeInstanceOf(Array);
      expect(report.summary.stepsExecuted).toBe(baseConfig.steps);
    });

    it('should work with enhanced results', () => {
      const result = runExperimentEnhanced(baseConfig);
      const timing = {
        totalMs: 100,
        initializationMs: 0,
        evolutionMs: 0,
        classificationMs: 0,
        averageStepMs: 5,
      };

      const report = analyzeExperiment(result, timing);

      expect(report.classification.wolframClass).toBe(result.wolframClass);
      expect(report.classification.confidence).toBe(result.confidence);
    });
  });

  describe('runExperimentInstrumented', () => {
    it('should return result with report', () => {
      const result = runExperimentInstrumented(baseConfig);

      expect(result.outcome).toBeDefined();
      expect(result.report).toBeDefined();
      expect(result.report.timing.totalMs).toBeGreaterThan(0);
    });

    it('should preserve experiment result properties', () => {
      const result = runExperimentInstrumented(baseConfig);
      const plainResult = runExperiment(baseConfig);

      expect(result.outcome).toBe(plainResult.outcome);
      expect(result.finalPopulation).toBe(plainResult.finalPopulation);
      expect(result.metricsHistory).toEqual(plainResult.metricsHistory);
    });
  });

  describe('runExperimentEnhancedInstrumented', () => {
    it('should return enhanced result with report', () => {
      const result = runExperimentEnhancedInstrumented(baseConfig);

      expect(result.wolframClass).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.report).toBeDefined();
    });
  });

  describe('runExperimentDeepInstrumented', () => {
    it('should provide per-step timing', () => {
      const result = runExperimentDeepInstrumented(baseConfig);

      expect(result.report.timing.stepTimings).toBeDefined();
      expect(result.report.timing.stepTimings).toHaveLength(baseConfig.steps);
    });

    it('should provide phase timing', () => {
      const result = runExperimentDeepInstrumented(baseConfig);

      expect(result.report.timing.initializationMs).toBeGreaterThan(0);
      expect(result.report.timing.evolutionMs).toBeGreaterThan(0);
      expect(result.report.timing.classificationMs).toBeGreaterThanOrEqual(0);
    });

    it('should match outcome of regular enhanced run', () => {
      const regularResult = runExperimentEnhanced(baseConfig);
      const deepResult = runExperimentDeepInstrumented(baseConfig);

      expect(deepResult.outcome).toBe(regularResult.outcome);
      expect(deepResult.wolframClass).toBe(regularResult.wolframClass);
      expect(deepResult.finalPopulation).toBe(regularResult.finalPopulation);
    });
  });

  describe('snapshot', () => {
    describe('createSnapshot', () => {
      it('should capture grid state', () => {
        const grid = createGrid([5, 5]);
        const rng = createRandom(42);
        initializeRandom(grid, 0.5, rng);

        const snapshot = createSnapshot(grid, 10, [], baseConfig);

        expect(snapshot.id).toMatch(/^snap_/);
        expect(snapshot.stepsTaken).toBe(10);
        expect(snapshot.gridData).toHaveLength(25);
        expect(snapshot.dimensions).toEqual([5, 5]);
      });
    });

    describe('restoreGridFromSnapshot', () => {
      it('should restore grid state', () => {
        const grid = createGrid([5, 5]);
        const rng = createRandom(42);
        initializeRandom(grid, 0.5, rng);
        const originalPop = grid.countPopulation();

        const snapshot = createSnapshot(grid, 10, [], baseConfig);
        const restored = restoreGridFromSnapshot(snapshot);

        expect(restored.countPopulation()).toBe(originalPop);
        expect(Array.from(restored.data)).toEqual(Array.from(grid.data));
      });
    });

    describe('serializeSnapshot / deserializeSnapshot', () => {
      it('should roundtrip snapshot', () => {
        const grid = createGrid([5, 5]);
        const rng = createRandom(42);
        initializeRandom(grid, 0.5, rng);

        const snapshot = createSnapshot(grid, 10, [], baseConfig);
        const json = serializeSnapshot(snapshot);
        const restored = deserializeSnapshot(json);

        expect(restored.id).toBe(snapshot.id);
        expect(restored.stepsTaken).toBe(snapshot.stepsTaken);
        expect(restored.gridData).toEqual(snapshot.gridData);
      });
    });

    describe('validateSnapshot', () => {
      it('should validate correct snapshot', () => {
        const grid = createGrid([5, 5]);
        const snapshot = createSnapshot(grid, 10, [], baseConfig);

        expect(validateSnapshot(snapshot)).toBe(true);
      });

      it('should reject invalid snapshot', () => {
        expect(validateSnapshot(null)).toBe(false);
        expect(validateSnapshot({})).toBe(false);
        expect(validateSnapshot({ id: 123 })).toBe(false);
      });

      it('should reject snapshot with wrong grid size', () => {
        const snapshot = {
          id: 'snap_test',
          timestamp: new Date().toISOString(),
          stepsTaken: 10,
          gridData: [0, 1, 0], // Wrong size for [5,5]
          dimensions: [5, 5],
          metricsHistory: [],
          config: baseConfig,
        };

        expect(validateSnapshot(snapshot)).toBe(false);
      });
    });

    describe('snapshotSize', () => {
      it('should estimate size', () => {
        const grid = createGrid([10, 10]);
        const snapshot = createSnapshot(grid, 10, [], baseConfig);

        const size = snapshotSize(snapshot);

        expect(size).toBeGreaterThan(0);
      });
    });

    describe('compressSnapshot / decompressSnapshot', () => {
      it('should roundtrip with compression', () => {
        const grid = createGrid([10, 10]);
        const snapshot = createSnapshot(grid, 10, [], baseConfig);

        const compressed = compressSnapshot(snapshot);
        const decompressed = decompressSnapshot(compressed);

        expect(decompressed.gridData).toEqual(snapshot.gridData);
      });

      it('should reduce size for uniform grids', () => {
        const grid = createGrid([10, 10]); // All zeros
        const snapshot = createSnapshot(grid, 10, [], baseConfig);

        const compressed = compressSnapshot(snapshot);

        expect(compressed.rleData.length).toBeLessThan(snapshot.gridData.length);
      });
    });
  });

  describe('evolveWithSnapshots', () => {
    it('should create snapshots at intervals', () => {
      const grid = createGrid(baseConfig.dimensions);
      const rng = createRandom(baseConfig.seed ?? 42);
      initializeRandom(grid, baseConfig.initialDensity, rng);

      const { type, range = 1 } = baseConfig.neighborhood;
      const neighborhood = generateNeighborhood(baseConfig.dimensions, { type, range });
      const maxNeighbors = getMaxNeighbors(baseConfig.dimensions, type, range);
      const rule = ruleFromThresholds(
        baseConfig.rule.birth,
        baseConfig.rule.survival,
        maxNeighbors
      );

      const result = evolveWithSnapshots(grid, rule, neighborhood, 20, baseConfig, {
        metricsInterval: 1,
        snapshotInterval: 10,
      });

      expect(result.snapshots).toHaveLength(2); // At steps 10 and 20
      expect(result.snapshots[0]!.stepsTaken).toBe(10);
      expect(result.snapshots[1]!.stepsTaken).toBe(20);
    });

    it('should call onSnapshot callback', () => {
      const grid = createGrid(baseConfig.dimensions);
      const rng = createRandom(baseConfig.seed ?? 42);
      initializeRandom(grid, baseConfig.initialDensity, rng);

      const { type, range = 1 } = baseConfig.neighborhood;
      const neighborhood = generateNeighborhood(baseConfig.dimensions, { type, range });
      const maxNeighbors = getMaxNeighbors(baseConfig.dimensions, type, range);
      const rule = ruleFromThresholds(
        baseConfig.rule.birth,
        baseConfig.rule.survival,
        maxNeighbors
      );

      const callback = vi.fn();

      evolveWithSnapshots(grid, rule, neighborhood, 20, baseConfig, {
        snapshotInterval: 10,
        onSnapshot: callback,
      });

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('resumeFromSnapshot', () => {
    it('should resume without instrumentation', () => {
      const grid = createGrid(baseConfig.dimensions);
      const rng = createRandom(baseConfig.seed ?? 42);
      initializeRandom(grid, baseConfig.initialDensity, rng);

      const snapshot = createSnapshot(grid, 10, [], baseConfig);

      const result = resumeFromSnapshot(snapshot, {
        additionalSteps: 10,
        instrumented: false,
      });

      expect(result.config.steps).toBe(20); // 10 + 10
      expect(result.outcome).toBeDefined();
    });

    it('should resume with instrumentation', () => {
      const grid = createGrid(baseConfig.dimensions);
      const rng = createRandom(baseConfig.seed ?? 42);
      initializeRandom(grid, baseConfig.initialDensity, rng);

      const snapshot = createSnapshot(grid, 10, [], baseConfig);

      const result = resumeFromSnapshot(snapshot, {
        additionalSteps: 10,
        instrumented: true,
      }) as InstrumentedEnhancedResult;

      expect(result.report).toBeDefined();
      expect(result.report.timing.stepTimings).toBeDefined();
      expect(result.report.timing.stepTimings).toHaveLength(10);
    });
  });

  describe('formatters', () => {
    describe('console', () => {
      it('should format one-line summary', () => {
        const result = runExperimentInstrumented(baseConfig);
        const oneLine = formatReportOneLine(result.report);

        expect(oneLine).toContain(result.report.experimentId);
        expect(oneLine).toContain(result.outcome);
      });
    });

    describe('json', () => {
      it('should roundtrip through JSON', () => {
        const result = runExperimentInstrumented(baseConfig);
        const json = formatReportToJson(result.report);
        const parsed = parseReportFromJson(json);

        expect(parsed.experimentId).toBe(result.report.experimentId);
        expect(parsed.summary.outcome).toBe(result.outcome);
      });

      it('should format as JSON lines', () => {
        const result = runExperimentInstrumented(baseConfig);
        const jsonl = formatReportToJsonLines(result.report);

        const lines = jsonl.split('\n');
        expect(lines.length).toBeGreaterThan(1);

        // Each line should be valid JSON
        for (const line of lines) {
          expect(() => JSON.parse(line)).not.toThrow();
        }
      });

      it('should format summary', () => {
        const result = runExperimentInstrumented(baseConfig);
        const summary = formatSummaryToJson(result.report);
        const parsed = JSON.parse(summary);

        expect(parsed.experimentId).toBe(result.report.experimentId);
        expect(parsed.summary).toBeDefined();
      });
    });

    describe('otel', () => {
      it('should generate spans', () => {
        const result = runExperimentDeepInstrumented(baseConfig);
        const spans = formatReportToOTel(result.report);

        expect(spans.length).toBeGreaterThan(0);

        // Root span
        const rootSpan = spans.find((s) => s.name === 'experiment');
        expect(rootSpan).toBeDefined();
        expect(rootSpan?.attributes['experiment.outcome']).toBe(result.outcome);
      });

      it('should generate child spans for phases', () => {
        const result = runExperimentDeepInstrumented(baseConfig);
        const spans = formatReportToOTel(result.report);

        const initSpan = spans.find((s) => s.name === 'initialization');
        const evolutionSpan = spans.find((s) => s.name === 'evolution');
        const classificationSpan = spans.find((s) => s.name === 'classification');

        expect(initSpan).toBeDefined();
        expect(evolutionSpan).toBeDefined();
        expect(classificationSpan).toBeDefined();
      });

      it('should format as OTLP JSON', () => {
        const result = runExperimentDeepInstrumented(baseConfig);
        const spans = formatReportToOTel(result.report);
        const otlp = formatSpansToOtlpJson(spans);

        const parsed = JSON.parse(otlp);
        expect(parsed.resourceSpans).toBeDefined();
        expect(parsed.resourceSpans[0].scopeSpans[0].spans.length).toBeGreaterThan(0);
      });
    });
  });

  describe('integration', () => {
    it('should complete full observability workflow', () => {
      // Run instrumented experiment
      const result = runExperimentDeepInstrumented({
        dimensions: [15, 15],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 50,
        initialDensity: 0.3,
        seed: 12345,
        metricsInterval: 5,
      });

      // Verify instrumented result
      expect(result.outcome).toBeDefined();
      expect(result.wolframClass).toBeDefined();
      expect(result.report).toBeDefined();

      // Verify timing breakdown
      expect(result.report.timing.totalMs).toBeGreaterThan(0);
      expect(result.report.timing.initializationMs).toBeGreaterThan(0);
      expect(result.report.timing.evolutionMs).toBeGreaterThan(0);
      expect(result.report.timing.stepTimings).toHaveLength(50);

      // Verify events
      expect(result.report.events.length).toBeGreaterThan(0);
      expect(result.report.events.some((e) => e.type === 'experiment_started')).toBe(true);
      expect(result.report.events.some((e) => e.type === 'experiment_completed')).toBe(true);

      // Verify timeline
      expect(result.report.metricsTimeline.length).toBe(10); // 50 steps / 5 interval

      // Verify summary
      expect(result.report.summary.dimensions).toBe('15x15');
      expect(result.report.summary.totalCells).toBe(225);
      expect(result.report.summary.stepsExecuted).toBe(50);

      // Verify classification trace
      expect(result.report.classification.reasoningPath.length).toBeGreaterThan(0);
    });

    it('should support snapshot-based mid-experiment instrumentation', () => {
      // Phase 1: Fast run to find interesting point
      const grid = createGrid([10, 10]);
      const rng = createRandom(42);
      initializeRandom(grid, 0.3, rng);

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const maxNeighbors = getMaxNeighbors([10, 10], 'moore', 1);
      const rule = ruleFromThresholds([3], [2, 3], maxNeighbors);

      const { snapshots } = evolveWithSnapshots(grid, rule, neighborhood, 50, baseConfig, {
        snapshotInterval: 25,
      });

      expect(snapshots).toHaveLength(2);

      // Phase 2: Resume from snapshot with instrumentation
      const detailedResult = resumeFromSnapshot(snapshots[0]!, {
        additionalSteps: 25,
        instrumented: true,
      }) as InstrumentedEnhancedResult;

      // Verify instrumentation was applied
      expect(detailedResult.report).toBeDefined();
      expect(detailedResult.report.timing.stepTimings).toBeDefined();
      expect(detailedResult.report.timing.stepTimings).toHaveLength(25);
    });
  });
});
