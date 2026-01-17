/**
 * Neighborhood topology generators for cellular automata.
 *
 * Generates offset vectors defining which cells are neighbors.
 * Computed once at initialization and reused for all cells.
 *
 * Supports:
 * - Moore: All cells within Chebyshev distance (includes diagonals)
 * - von Neumann: Cells within Manhattan distance (excludes diagonals)
 */

import type { NeighborhoodType } from './types.js';

/**
 * Generates neighborhood offset vectors.
 *
 * Pure function: same inputs always produce same outputs.
 * Excludes origin (0, 0, ..., 0) from results.
 *
 * @param dimensions - Grid dimensions
 * @param config - Neighborhood configuration
 * @returns Array of offset vectors relative to origin
 *
 * @example
 * ```typescript
 * // 2D Moore neighborhood (range 1):
 * // Returns 8 offsets: [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]
 * generateNeighborhood([10, 10], { type: 'moore', range: 1 });
 *
 * // 2D von Neumann (range 1):
 * // Returns 4 offsets: [[-1,0], [0,-1], [0,1], [1,0]]
 * generateNeighborhood([10, 10], { type: 'von-neumann', range: 1 });
 * ```
 */
export function generateNeighborhood(
  dimensions: number[],
  { type, range = 1 }: { type: NeighborhoodType; range?: number }
): number[][] {
  const ndim = dimensions.length;
  const offsets: number[][] = [];

  /**
   * Recursively generates all offset combinations.
   * Builds coordinates dimension by dimension.
   */
  function generate(current: number[], dim: number): void {
    if (dim === ndim) {
      // Base case: complete coordinate generated
      const isOrigin = current.every(v => v === 0);
      if (!isOrigin && isValidNeighbor(current, type, range)) {
        offsets.push([...current]);
      }
      return;
    }

    // Recursive case: try all values for current dimension
    for (let offset = -range; offset <= range; offset++) {
      current[dim] = offset;
      generate(current, dim + 1);
    }
  }

  // Start recursive generation
  generate(new Array(ndim).fill(0), 0);
  return offsets;
}

/**
 * Checks if an offset vector is valid for the given neighborhood type.
 *
 * @param offset - Offset vector to validate
 * @param type - Neighborhood type
 * @param range - Maximum distance
 * @returns Whether offset is within valid neighborhood
 */
function isValidNeighbor(
  offset: number[],
  type: NeighborhoodType,
  range: number
): boolean {
  if (type === 'moore') {
    // Moore: Chebyshev distance (max absolute value)
    const chebyshev = Math.max(...offset.map(Math.abs));
    return chebyshev <= range;
  } else {
    // von Neumann: Manhattan distance (sum of absolute values)
    const manhattan = offset.reduce((sum, v) => sum + Math.abs(v), 0);
    return manhattan <= range;
  }
}

/**
 * Computes maximum possible neighbor count for a neighborhood.
 *
 * Used to validate rules and convert relative thresholds.
 *
 * @param dimensions - Grid dimensions
 * @param type - Neighborhood type
 * @param range - Neighborhood range
 * @returns Maximum number of neighbors any cell can have
 *
 * @example
 * ```typescript
 * // 2D Moore (range 1): 8 neighbors
 * getMaxNeighbors([10, 10], 'moore', 1);  // → 8
 *
 * // 3D von Neumann (range 1): 6 neighbors
 * getMaxNeighbors([5, 5, 5], 'von-neumann', 1);  // → 6
 * ```
 */
export function getMaxNeighbors(
  dimensions: number[],
  type: NeighborhoodType,
  range: number
): number {
  const ndim = dimensions.length;

  if (type === 'moore') {
    // Moore: (2*range + 1)^ndim - 1 (exclude origin)
    return Math.pow(2 * range + 1, ndim) - 1;
  } else {
    // von Neumann: 2 * sum(C(ndim, k) * range^k) for k=1 to min(range, ndim)
    // Simplified for common case range=1: 2 * ndim
    if (range === 1) {
      return 2 * ndim;
    }

    // General case: count valid offsets
    let count = 0;
    const temp = new Array(ndim).fill(0);

    function countOffsets(dim: number): void {
      if (dim === ndim) {
        const manhattan = temp.reduce((sum, v) => sum + Math.abs(v), 0);
        const isOrigin = temp.every(v => v === 0);
        if (!isOrigin && manhattan <= range) {
          count++;
        }
        return;
      }

      for (let offset = -range; offset <= range; offset++) {
        temp[dim] = offset;
        countOffsets(dim + 1);
      }
    }

    countOffsets(0);
    return count;
  }
}
