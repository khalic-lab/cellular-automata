/**
 * Seeded pseudo-random number generator for deterministic initialization.
 *
 * Uses a Linear Congruential Generator (LCG) with constants from
 * Numerical Recipes. Provides deterministic sequences for reproducible
 * experiments.
 */

import type { SeededRandom } from './types.js';

/**
 * Creates a deterministic pseudo-random number generator.
 *
 * Uses LCG formula: state = (a * state + c) mod m
 * - a = 1664525 (multiplier)
 * - c = 1013904223 (increment)
 * - m = 2^32 (modulus)
 *
 * @param seed - Initial seed value (any integer)
 * @returns Functional PRNG returning values in [0, 1)
 *
 * @example
 * ```typescript
 * const rng = createRandom(42);
 * const value1 = rng.next();  // 0.5580...
 * const value2 = rng.next();  // 0.9103...
 * ```
 */
export function createRandom(seed: number): SeededRandom {
  // Internal state (mutated by next() calls)
  let state = seed >>> 0;  // Ensure unsigned 32-bit integer

  return {
    next: () => {
      // LCG iteration (mutates state but pure interface)
      state = (state * 1664525 + 1013904223) >>> 0;
      // Normalize to [0, 1)
      return state / 0x100000000;
    }
  };
}
