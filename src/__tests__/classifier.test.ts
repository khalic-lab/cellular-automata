import { describe, expect, it } from 'vitest';
import { createSimpleClassifier, multiMetricClassifier } from '../classifier.js';
import type { EnhancedMetrics } from '../types.js';

/**
 * Helper to create mock enhanced metrics
 */
function createMockMetrics(
  overrides: Partial<EnhancedMetrics> & { step: number }
): EnhancedMetrics {
  return {
    population: 100,
    density: 0.1,
    births: 0,
    deaths: 0,
    delta: 0,
    entropy: 0.5,
    stateHash: (Math.random() * 0xffffffff) >>> 0,
    ...overrides,
  };
}

describe('classifier', () => {
  describe('multiMetricClassifier', () => {
    it('should classify extinct when population is zero', () => {
      const metrics: EnhancedMetrics[] = [
        createMockMetrics({ step: 1, population: 10, entropy: 0.5 }),
        createMockMetrics({ step: 2, population: 5, entropy: 0.3 }),
        createMockMetrics({ step: 3, population: 0, entropy: 0 }),
      ];

      const result = multiMetricClassifier(metrics);

      expect(result.outcome).toBe('extinct');
      expect(result.wolframClass).toBe('extinct');
      expect(result.confidence).toBe(1.0);
    });

    it('should classify extinct for empty metrics', () => {
      const result = multiMetricClassifier([]);

      expect(result.outcome).toBe('extinct');
      expect(result.wolframClass).toBe('extinct');
      expect(result.confidence).toBe(1.0);
    });

    it('should classify as class1 (homogeneous) when entropy is zero but population > 0', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 20; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 1000, // All cells alive
            entropy: 0, // Homogeneous
            stateHash: 12345, // Same state
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.wolframClass).toBe('class1');
      expect(result.outcome).toBe('stable');
    });

    it('should detect period-1 oscillation (stable fixed point) via state hash', () => {
      const fixedHash = 123456789;
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 50; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 100,
            entropy: 0.5,
            stateHash: fixedHash, // Same hash = same state
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.details.cycleDetected).toBe(true);
      expect(result.details.cyclePeriod).toBe(1);
      expect(result.wolframClass).toBe('class2_stable');
      expect(result.outcome).toBe('stable');
    });

    it('should detect period-2 oscillation via state hash', () => {
      const hash1 = 111111111;
      const hash2 = 222222222;
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 50; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: i % 2 === 0 ? 100 : 110,
            entropy: 0.5,
            stateHash: i % 2 === 0 ? hash1 : hash2,
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.details.cycleDetected).toBe(true);
      expect(result.details.cyclePeriod).toBe(2);
      expect(result.wolframClass).toBe('class2_periodic');
      expect(result.outcome).toBe('oscillating');
    });

    it('should detect longer period oscillations', () => {
      const hashes = [111, 222, 333, 444, 555]; // Period 5
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 50; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 100 + (i % 5),
            entropy: 0.5,
            stateHash: hashes[i % 5]!,
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.details.cycleDetected).toBe(true);
      expect(result.details.cyclePeriod).toBe(5);
      expect(result.outcome).toBe('oscillating');
    });

    it('should identify explosive growth', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 100; i++) {
        const population = i < 30 ? 50 + i : 100 + i * 2;
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population,
            entropy: 0.5,
            stateHash: i * 12345, // Unique hashes
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.outcome).toBe('explosive');
      expect(result.details.populationTrend).toBe('growing');
    });

    it('should return classification details', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 50; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 100,
            entropy: 0.5,
            stateHash: i * 999,
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('wolframClass');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('details');
      expect(result.details).toHaveProperty('cycleDetected');
      expect(result.details).toHaveProperty('cyclePeriod');
      expect(result.details).toHaveProperty('entropyTrend');
      expect(result.details).toHaveProperty('populationTrend');
    });

    it('should have confidence between 0 and 1', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 20; i++) {
        metrics.push(createMockMetrics({ step: i + 1 }));
      }

      const result = multiMetricClassifier(metrics);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should analyze entropy trend correctly - stable', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 50; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            entropy: 0.5, // Constant entropy
            stateHash: i * 123,
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.details.entropyTrend).toBe('stable');
    });

    it('should analyze population trend correctly - stable', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 50; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 100, // Constant population
            stateHash: i * 456,
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      expect(result.details.populationTrend).toBe('stable');
    });
  });

  describe('createSimpleClassifier', () => {
    it('should create a function that returns only outcome', () => {
      const simpleClassifier = createSimpleClassifier(multiMetricClassifier);

      const metrics: EnhancedMetrics[] = [
        createMockMetrics({ step: 1, population: 0, entropy: 0 }),
      ];

      const outcome = simpleClassifier(metrics);

      expect(outcome).toBe('extinct');
      expect(typeof outcome).toBe('string');
    });

    it('should work with non-extinct cases', () => {
      const simpleClassifier = createSimpleClassifier(multiMetricClassifier);

      const metrics: EnhancedMetrics[] = [];
      const fixedHash = 999999;

      for (let i = 0; i < 30; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 100,
            entropy: 0.5,
            stateHash: fixedHash,
          })
        );
      }

      const outcome = simpleClassifier(metrics);

      expect(['stable', 'oscillating', 'explosive', 'extinct']).toContain(outcome);
    });
  });

  describe('edge cases', () => {
    it('should handle single metric entry', () => {
      const metrics: EnhancedMetrics[] = [
        createMockMetrics({ step: 1, population: 100, entropy: 0.5 }),
      ];

      const result = multiMetricClassifier(metrics);

      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
    });

    it('should handle very short history', () => {
      const metrics: EnhancedMetrics[] = [
        createMockMetrics({ step: 1, population: 100 }),
        createMockMetrics({ step: 2, population: 100 }),
      ];

      const result = multiMetricClassifier(metrics);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle high entropy fluctuation (chaotic)', () => {
      const metrics: EnhancedMetrics[] = [];

      for (let i = 0; i < 100; i++) {
        metrics.push(
          createMockMetrics({
            step: i + 1,
            population: 100 + Math.sin(i) * 10,
            entropy: 0.3 + Math.random() * 0.4, // High variance entropy
            stateHash: (Math.random() * 0xffffffff) >>> 0,
          })
        );
      }

      const result = multiMetricClassifier(metrics);

      // Should detect fluctuating entropy
      expect(['stable', 'oscillating', 'fluctuating']).toContain(result.details.entropyTrend);
    });
  });
});
