/**
 * N-dimensional grid with toroidal (wrap-around) boundaries.
 *
 * Stores binary cellular automata state in a flat Uint8Array for efficiency.
 * Uses precomputed strides for O(1) coordinate-to-index conversion.
 *
 * Design rationale:
 * - Class encapsulates complex ND indexing logic
 * - Flat storage is cache-friendly and memory-efficient
 * - Toroidal topology simplifies edge handling (no special cases)
 */

import type { SeededRandom } from './types.js';

/**
 * Computes stride values for N-dimensional flat indexing.
 *
 * Stride[i] = product of all dimensions after i.
 * This enables O(1) coordinate→index conversion:
 * index = sum(coord[i] * stride[i])
 *
 * @param dimensions - Grid shape
 * @returns Stride array for each dimension
 *
 * @example
 * ```typescript
 * // For [3, 4, 5] grid:
 * // strides = [20, 5, 1]
 * // coord [1, 2, 3] → index = 1*20 + 2*5 + 3*1 = 33
 * ```
 */
function computeStrides(dimensions: number[]): number[] {
  const strides: number[] = new Array(dimensions.length);
  let stride = 1;

  // Build strides right-to-left
  for (let i = dimensions.length - 1; i >= 0; i--) {
    strides[i] = stride;
    stride *= dimensions[i]!;
  }

  return strides;
}

/**
 * N-dimensional grid for cellular automata state.
 *
 * Stores binary cell states (0 = dead, 1 = alive) with toroidal boundaries.
 * Uses flat Uint8Array with stride-based indexing for efficiency.
 */
export class Grid {
  readonly dimensions: number[];
  readonly strides: number[];
  readonly data: Uint8Array;
  readonly size: number;

  /**
   * Creates a new N-dimensional grid with all cells dead.
   *
   * @param dimensions - Shape of the grid (e.g., [10, 10] for 2D)
   */
  constructor(dimensions: number[]) {
    this.dimensions = [...dimensions];  // Defensive copy
    this.strides = computeStrides(dimensions);
    this.size = dimensions.reduce((prod, dim) => prod * dim, 1);
    this.data = new Uint8Array(this.size);
  }

  /**
   * Converts N-dimensional coordinate to flat array index.
   *
   * @param coord - N-dimensional position
   * @returns Flat index in data array
   */
  index(coord: number[]): number {
    let idx = 0;
    for (let i = 0; i < coord.length; i++) {
      idx += coord[i]! * this.strides[i]!;
    }
    return idx;
  }

  /**
   * Wraps coordinate to enforce toroidal boundaries.
   *
   * Pure function: returns new array, doesn't modify input.
   *
   * @param coord - Potentially out-of-bounds coordinate
   * @returns Wrapped coordinate within grid bounds
   *
   * @example
   * ```typescript
   * // For [10, 10] grid:
   * grid.wrap([-1, 5])   // → [9, 5]
   * grid.wrap([10, 12])  // → [0, 2]
   * ```
   */
  wrap(coord: number[]): number[] {
    const wrapped: number[] = new Array(coord.length);
    for (let i = 0; i < coord.length; i++) {
      // Modulo with correction for negative values
      wrapped[i] = ((coord[i]! % this.dimensions[i]!) + this.dimensions[i]!) % this.dimensions[i]!;
    }
    return wrapped;
  }

  /**
   * Gets cell state at coordinate.
   *
   * @param coord - Position to read
   * @returns 0 (dead) or 1 (alive)
   */
  get(coord: number[]): number {
    return this.data[this.index(coord)]!;
  }

  /**
   * Sets cell state at coordinate.
   *
   * @param coord - Position to write
   * @param value - New state (0 or 1)
   */
  set(coord: number[], value: number): void {
    this.data[this.index(coord)] = value;
  }

  /**
   * Creates a deep copy of the grid.
   *
   * @returns Independent grid with same dimensions and state
   */
  clone(): Grid {
    const copy = new Grid(this.dimensions);
    copy.data.set(this.data);
    return copy;
  }

  /**
   * Counts total number of alive cells.
   *
   * Pure aggregation: reads state without modification.
   *
   * @returns Population count
   */
  countPopulation(): number {
    let count = 0;
    for (let i = 0; i < this.size; i++) {
      count += this.data[i]!;
    }
    return count;
  }
}

/**
 * Creates a new N-dimensional grid.
 *
 * Convenience function for functional style.
 *
 * @param dimensions - Grid shape
 * @returns New grid with all cells dead
 */
export function createGrid(dimensions: number[]): Grid {
  return new Grid(dimensions);
}

/**
 * Initializes grid with random alive cells.
 *
 * Mutates grid in place for efficiency.
 *
 * @param grid - Grid to initialize
 * @param density - Fraction of cells to make alive [0, 1]
 * @param random - Seeded PRNG for determinism
 *
 * @example
 * ```typescript
 * const grid = createGrid([10, 10]);
 * const rng = createRandom(42);
 * initializeRandom(grid, 0.3, rng);  // 30% of cells alive
 * ```
 */
export function initializeRandom(
  grid: Grid,
  density: number,
  { next }: SeededRandom
): void {
  for (let i = 0; i < grid.size; i++) {
    grid.data[i] = next() < density ? 1 : 0;
  }
}
