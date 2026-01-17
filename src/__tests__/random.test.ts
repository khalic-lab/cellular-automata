import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';

describe('random', () => {
  describe('createRandom', () => {
    it('should return a SeededRandom object with next function', () => {
      const rng = createRandom(42);
      expect(rng).toHaveProperty('next');
      expect(typeof rng.next).toBe('function');
    });

    it('should generate deterministic sequences', () => {
      const rng1 = createRandom(42);
      const rng2 = createRandom(42);

      const sequence1 = [rng1.next(), rng1.next(), rng1.next()];
      const sequence2 = [rng2.next(), rng2.next(), rng2.next()];

      expect(sequence1).toEqual(sequence2);
    });

    it('should generate different sequences for different seeds', () => {
      const rng1 = createRandom(42);
      const rng2 = createRandom(123);

      const value1 = rng1.next();
      const value2 = rng2.next();

      expect(value1).not.toBe(value2);
    });

    it('should generate values in range [0, 1)', () => {
      const rng = createRandom(42);

      for (let i = 0; i < 1000; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should maintain state across calls', () => {
      const rng = createRandom(42);

      const first = rng.next();
      const second = rng.next();
      const third = rng.next();

      expect(first).not.toBe(second);
      expect(second).not.toBe(third);
      expect(first).not.toBe(third);
    });

    it('should generate uniform distribution (statistical test)', () => {
      const rng = createRandom(12345);
      const buckets = new Array(10).fill(0);
      const samples = 10000;

      for (let i = 0; i < samples; i++) {
        const value = rng.next();
        const bucket = Math.floor(value * 10);
        buckets[bucket]!++;
      }

      // Each bucket should have roughly 1000 samples (±20%)
      const expected = samples / 10;
      const tolerance = expected * 0.2;

      for (const count of buckets) {
        expect(count).toBeGreaterThan(expected - tolerance);
        expect(count).toBeLessThan(expected + tolerance);
      }
    });

    it('should handle edge case seed of 0', () => {
      const rng = createRandom(0);
      const value = rng.next();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it('should handle large seed values', () => {
      const rng = createRandom(999999999);
      const value = rng.next();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it('should produce different values for negative seeds', () => {
      const rng1 = createRandom(42);
      const rng2 = createRandom(-42);

      const value1 = rng1.next();
      const value2 = rng2.next();

      expect(value1).not.toBe(value2);
    });
  });
});
