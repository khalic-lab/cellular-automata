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
 *
 * Academic References:
 *
 * Entropy Calculations:
 * [1] Shannon, C.E. (1948). "A Mathematical Theory of Communication"
 *     Bell System Technical Journal, 27(3), 379-423.
 *     DOI: 10.1002/j.1538-7305.1948.tb01338.x
 *
 * [2] Baetens, J.M. & De Baets, B. (2021). "Entropy-Based Classification of
 *     Elementary Cellular Automata under Asynchronous Updating"
 *     Entropy, 23(2), 209. MDPI. DOI: 10.3390/e23020209
 *
 * State Hashing (FNV-1a):
 * [3] Fowler, G., Noll, L.C., Vo, K.-P., & Eastlake, D. (2019).
 *     "The FNV Non-Cryptographic Hash Algorithm"
 *     IETF Internet-Draft draft-eastlake-fnv-17.
 *     URL: https://datatracker.ietf.org/doc/html/draft-eastlake-fnv-17
 *
 * Hamming Distance Classification:
 * [4] Ruivo, E.L.P., Balbi, P.P., & Monetti, R. (2024).
 *     "Classification of Cellular Automata based on the Hamming distance"
 *     arXiv:2407.06175. DOI: 10.48550/arXiv.2407.06175
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
    this.dimensions = [...dimensions]; // Defensive copy
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
export function initializeRandom(grid: Grid, density: number, { next }: SeededRandom): void {
  for (let i = 0; i < grid.size; i++) {
    grid.data[i] = next() < density ? 1 : 0;
  }
}

/**
 * Computes spatial entropy of the grid.
 *
 * Uses Shannon entropy formula: H = -Σ p(x) * log2(p(x))
 * where p(x) is the probability of each state.
 *
 * Higher entropy indicates more disorder/randomness (chaotic behavior).
 * Lower entropy indicates more order (stable/periodic behavior).
 *
 * References:
 * - Shannon, C.E. (1948). DOI: 10.1002/j.1538-7305.1948.tb01338.x
 * - Baetens & De Baets (2021). DOI: 10.3390/e23020209
 *
 * @param grid - Grid to analyze
 * @returns Normalized entropy in range [0, 1]
 *
 * @example
 * ```typescript
 * const entropy = computeSpatialEntropy(grid);
 * // entropy ≈ 0 for uniform grid (all 0s or all 1s)
 * // entropy ≈ 1 for maximum disorder (50% alive)
 * ```
 */
export function computeSpatialEntropy(grid: Grid): number {
  const population = grid.countPopulation();

  // Edge case: empty or full grid has zero entropy
  if (population === 0 || population === grid.size) {
    return 0;
  }

  // Compute entropy using proportion of alive cells
  // H = -p*log2(p) - (1-p)*log2(1-p)
  const p = population / grid.size;
  const q = 1 - p;

  // Avoid log(0)
  const pTerm = p > 0 ? -p * Math.log2(p) : 0;
  const qTerm = q > 0 ? -q * Math.log2(q) : 0;

  return pTerm + qTerm;
}

/**
 * Computes a hash of the grid state for cycle detection.
 *
 * Uses FNV-1a (Fowler-Noll-Vo) hash algorithm for good distribution and speed.
 * Same grid state always produces same hash (deterministic).
 *
 * FNV-1a parameters:
 * - Offset basis: 2166136261 (32-bit)
 * - Prime: 16777619
 *
 * Reference: Fowler, Noll, Vo & Eastlake (2019). IETF draft-eastlake-fnv-17
 * URL: https://datatracker.ietf.org/doc/html/draft-eastlake-fnv-17
 *
 * @param grid - Grid to hash
 * @returns 32-bit unsigned hash value
 *
 * @example
 * ```typescript
 * const hash1 = computeStateHash(grid);
 * evolve(grid, rule, neighborhood, 1);
 * const hash2 = computeStateHash(grid);
 * if (hash1 === hash2) {
 *   // Grid returned to same state (period-1 oscillator or stable)
 * }
 * ```
 */
export function computeStateHash(grid: Grid): number {
  // FNV-1a hash parameters
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < grid.size; i++) {
    hash ^= grid.data[i]!;
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to unsigned 32-bit integer
  return hash >>> 0;
}

/**
 * Computes Hamming distance between two grids.
 *
 * Measures the number of cells that differ between grids.
 * Used for sensitivity analysis and Wolfram class detection.
 *
 * Reference: Classification of Cellular Automata based on Hamming distance
 * (arXiv 2407.06175)
 *
 * @param grid1 - First grid
 * @param grid2 - Second grid (must have same dimensions)
 * @returns Number of differing cells
 *
 * @example
 * ```typescript
 * const distance = computeHammingDistance(grid1, grid2);
 * // distance = 0 means identical states
 * // distance growing over time indicates chaotic behavior
 * ```
 */
export function computeHammingDistance(grid1: Grid, grid2: Grid): number {
  let distance = 0;
  for (let i = 0; i < grid1.size; i++) {
    if (grid1.data[i] !== grid2.data[i]) {
      distance++;
    }
  }
  return distance;
}
