import { describe, it, expect } from 'vitest';
import { runExperiment, hashBasedClassifier } from '../experiment.js';
import type { Metrics, OutcomeClassifier } from '../types.js';

describe('experiment', () => {
  describe('hashBasedClassifier', () => {
    it('should classify extinct when final population is 0', () => {
      const metrics: Metrics[] = [
        { population: 10, density: 0.1, births: 0, deaths: 0, delta: 0, step: 1 },
        { population: 5, density: 0.05, births: 0, deaths: 5, delta: -5, step: 2 },
        { population: 0, density: 0, births: 0, deaths: 5, delta: -5, step: 3 },
      ];

      expect(hashBasedClassifier(metrics)).toBe('extinct');
    });

    it('should classify extinct for empty metrics', () => {
      expect(hashBasedClassifier([])).toBe('extinct');
    });

    it('should classify oscillating when pattern repeats', () => {
      const metrics: Metrics[] = [];

      // Create oscillating pattern: 10, 20, 10, 20, 10, 20...
      for (let i = 0; i < 20; i++) {
        metrics.push({
          population: i % 2 === 0 ? 10 : 20,
          density: 0.1,
          births: 0,
          deaths: 0,
          delta: 0,
          step: i + 1,
        });
      }

      expect(hashBasedClassifier(metrics)).toBe('oscillating');
    });

    it('should classify explosive when growth occurs', () => {
      const metrics: Metrics[] = [];

      // Create growing pattern with each value unique
      for (let i = 0; i < 100; i++) {
        const pop = i < 50 ? 10 + i : 60 + i; // Clear growth, all unique
        metrics.push({
          population: pop,
          density: pop / 10000,
          births: 0,
          deaths: 0,
          delta: 0,
          step: i + 1,
        });
      }

      expect(hashBasedClassifier(metrics)).toBe('explosive');
    });

    it('should classify stable when no oscillation or growth', () => {
      const metrics: Metrics[] = [];

      // Create stable pattern with strictly monotonic values (no repeats)
      for (let i = 0; i < 100; i++) {
        metrics.push({
          population: 1000 + i, // Strictly increasing but small changes
          density: 0.5,
          births: 0,
          deaths: 0,
          delta: 0,
          step: i + 1,
        });
      }

      // Note: This is technically not "stable" in the strict sense,
      // but the growth is so small it won't trigger "explosive"
      // The hashBasedClassifier will return 'stable' as fallback
      expect(hashBasedClassifier(metrics)).toBe('stable');
    });

    it('should handle edge case of constant population', () => {
      const metrics: Metrics[] = [];

      for (let i = 0; i < 100; i++) {
        metrics.push({
          population: 50,
          density: 0.5,
          births: 0,
          deaths: 0,
          delta: 0,
          step: i + 1,
        });
      }

      const outcome = hashBasedClassifier(metrics);
      // Could be stable or oscillating (period 1)
      expect(['stable', 'oscillating']).toContain(outcome);
    });

    it('should detect oscillation in final 30% only', () => {
      const metrics: Metrics[] = [];

      // First 70%: random values
      for (let i = 0; i < 70; i++) {
        metrics.push({
          population: 10 + i,
          density: 0.1,
          births: 0,
          deaths: 0,
          delta: 0,
          step: i + 1,
        });
      }

      // Last 30%: oscillating
      for (let i = 70; i < 100; i++) {
        metrics.push({
          population: i % 2 === 0 ? 100 : 110,
          density: 0.1,
          births: 0,
          deaths: 0,
          delta: 0,
          step: i + 1,
        });
      }

      expect(hashBasedClassifier(metrics)).toBe('oscillating');
    });
  });

  describe('runExperiment', () => {
    it('should run experiment and return result', () => {
      const result = runExperiment({
        dimensions: [10, 10],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 10,
        initialDensity: 0.3,
        seed: 42,
      });

      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('finalPopulation');
      expect(result).toHaveProperty('metricsHistory');
      expect(result).toHaveProperty('config');
    });

    it('should produce deterministic results with same seed', () => {
      const config = {
        dimensions: [10, 10],
        neighborhood: { type: 'moore' as const, range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 20,
        initialDensity: 0.3,
        seed: 123,
      };

      const result1 = runExperiment(config);
      const result2 = runExperiment(config);

      expect(result1.outcome).toBe(result2.outcome);
      expect(result1.finalPopulation).toBe(result2.finalPopulation);
      expect(result1.metricsHistory).toEqual(result2.metricsHistory);
    });

    it('should use default seed when not provided', () => {
      const result = runExperiment({
        dimensions: [5, 5],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 5,
        initialDensity: 0.5,
      });

      expect(result).toBeDefined();
      // Config preserves what was passed, default is used internally
      expect(result.config.seed).toBeUndefined();
    });

    it('should use default metricsInterval when not provided', () => {
      const result = runExperiment({
        dimensions: [5, 5],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 10,
        initialDensity: 0.3,
        seed: 42,
      });

      expect(result.metricsHistory).toHaveLength(10);
    });

    it('should respect custom metricsInterval', () => {
      const result = runExperiment({
        dimensions: [5, 5],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 20,
        initialDensity: 0.3,
        seed: 42,
        metricsInterval: 5,
      });

      expect(result.metricsHistory).toHaveLength(4);
    });

    it('should handle 2D Conway\'s Game of Life', () => {
      const result = runExperiment({
        dimensions: [20, 20],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 50,
        initialDensity: 0.3,
        seed: 999,
      });

      expect(result.outcome).toBeDefined();
      expect(['extinct', 'explosive', 'stable', 'oscillating']).toContain(result.outcome);
    });

    it('should handle 3D cellular automata', () => {
      const result = runExperiment({
        dimensions: [10, 10, 10],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [4], survival: [4, 5] },
        steps: 20,
        initialDensity: 0.15,
        seed: 777,
      });

      expect(result.outcome).toBeDefined();
      expect(result.metricsHistory).toHaveLength(20);
    });

    it('should handle 4D cellular automata', () => {
      const result = runExperiment({
        dimensions: [5, 5, 5, 5],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [4], survival: [4, 5] },
        steps: 10,
        initialDensity: 0.1,
        seed: 555,
      });

      expect(result.outcome).toBeDefined();
      expect(result.finalPopulation).toBeGreaterThanOrEqual(0);
    });

    it('should handle von Neumann neighborhood', () => {
      const result = runExperiment({
        dimensions: [15, 15],
        neighborhood: { type: 'von-neumann', range: 1 },
        rule: { birth: [2], survival: [1, 2] },
        steps: 30,
        initialDensity: 0.25,
        seed: 333,
      });

      expect(result.outcome).toBeDefined();
      expect(result.metricsHistory).toHaveLength(30);
    });

    it('should handle relative thresholds', () => {
      const result = runExperiment({
        dimensions: [10, 10, 10],
        neighborhood: { type: 'moore', range: 1 },
        rule: {
          birth: [{ relative: 0.15 }],
          survival: [{ relative: 0.15 }, { relative: 0.19 }],
        },
        steps: 20,
        initialDensity: 0.2,
        seed: 222,
      });

      expect(result.outcome).toBeDefined();
      expect(result.metricsHistory).toHaveLength(20);
    });

    it('should handle empty initial grid (density 0)', () => {
      const result = runExperiment({
        dimensions: [10, 10],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 10,
        initialDensity: 0,
        seed: 42,
      });

      expect(result.outcome).toBe('extinct');
      expect(result.finalPopulation).toBe(0);
    });

    it('should handle full initial grid (density 1)', () => {
      const result = runExperiment({
        dimensions: [5, 5],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 5,
        initialDensity: 1,
        seed: 42,
      });

      expect(result.outcome).toBeDefined();
      expect(result.metricsHistory).toHaveLength(5);
    });

    it('should use custom classifier when provided', () => {
      const customClassifier: OutcomeClassifier = () => 'stable';

      const result = runExperiment(
        {
          dimensions: [10, 10],
          neighborhood: { type: 'moore', range: 1 },
          rule: { birth: [3], survival: [2, 3] },
          steps: 10,
          initialDensity: 0.3,
          seed: 42,
        },
        customClassifier
      );

      expect(result.outcome).toBe('stable');
    });

    it('should preserve config in result', () => {
      const config = {
        dimensions: [10, 10],
        neighborhood: { type: 'moore' as const, range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 10,
        initialDensity: 0.3,
        seed: 42,
        metricsInterval: 2,
      };

      const result = runExperiment(config);

      expect(result.config).toEqual(config);
    });

    it('should calculate correct final population', () => {
      const result = runExperiment({
        dimensions: [10, 10],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 20,
        initialDensity: 0.5,
        seed: 111,
      });

      const finalMetrics = result.metricsHistory[result.metricsHistory.length - 1];
      expect(result.finalPopulation).toBe(finalMetrics?.population);
    });

    it('should handle neighborhood range parameter', () => {
      const result = runExperiment({
        dimensions: [10, 10],
        neighborhood: { type: 'moore', range: 2 },
        rule: { birth: [5], survival: [5, 6] },
        steps: 10,
        initialDensity: 0.2,
        seed: 42,
      });

      expect(result.outcome).toBeDefined();
      expect(result.metricsHistory).toHaveLength(10);
    });

    it('should handle small grid', () => {
      const result = runExperiment({
        dimensions: [3, 3],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [3], survival: [2, 3] },
        steps: 10,
        initialDensity: 0.5,
        seed: 42,
      });

      expect(result.outcome).toBeDefined();
      expect(result.finalPopulation).toBeLessThanOrEqual(9);
    });
  });

  describe('integration', () => {
    it('should complete full workflow end-to-end', () => {
      const result = runExperiment({
        dimensions: [15, 15, 15],
        neighborhood: { type: 'moore', range: 1 },
        rule: { birth: [4], survival: [4, 5] },
        steps: 30,
        initialDensity: 0.15,
        seed: 12345,
        metricsInterval: 3,
      });

      // Verify structure
      expect(result.outcome).toBeDefined();
      expect(result.finalPopulation).toBeGreaterThanOrEqual(0);
      expect(result.metricsHistory).toHaveLength(10); // 30 steps / 3 interval

      // Verify metrics consistency
      for (const metrics of result.metricsHistory) {
        expect(metrics.population).toBeGreaterThanOrEqual(0);
        expect(metrics.density).toBeGreaterThanOrEqual(0);
        expect(metrics.density).toBeLessThanOrEqual(1);
        expect(metrics.delta).toBe(metrics.births - metrics.deaths);
      }

      // Verify config preservation
      expect(result.config.dimensions).toEqual([15, 15, 15]);
      expect(result.config.seed).toBe(12345);
    });
  });
});
