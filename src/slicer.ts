/**
 * 2D plane extraction from N-dimensional grids.
 *
 * Enables visualization of high-dimensional cellular automata by
 * extracting 2D cross-sections while fixing other dimensions.
 */

import { Grid } from './grid.js';

/**
 * Extracts a 2D slice from an N-dimensional grid.
 *
 * Selects two axes for the 2D plane and fixes all other dimensions
 * at specified coordinates.
 *
 * @param grid - N-dimensional source grid
 * @param config - Slice configuration
 * @returns 2D array representing the slice
 *
 * @example
 * ```typescript
 * // Extract XY plane at z=5 from 3D grid
 * const slice = extractSlice(grid, {
 *   axis1: 0,  // X
 *   axis2: 1,  // Y
 *   fixedCoords: new Map([[2, 5]])  // Z=5
 * });
 *
 * // Extract plane from 4D grid
 * const slice4d = extractSlice(grid4d, {
 *   axis1: 0,
 *   axis2: 2,
 *   fixedCoords: new Map([[1, 3], [3, 7]])  // Fix dims 1 and 3
 * });
 * ```
 */
export function extractSlice(
  grid: Grid,
  { axis1, axis2, fixedCoords }: {
    axis1: number;
    axis2: number;
    fixedCoords: Map<number, number>;
  }
): number[][] {
  const { dimensions } = grid;
  const size1 = dimensions[axis1]!;
  const size2 = dimensions[axis2]!;

  // Initialize 2D result array
  const slice: number[][] = Array.from(
    { length: size1 },
    () => new Array(size2).fill(0)
  );

  // Build coordinate template with fixed dimensions
  const coord = new Array(dimensions.length).fill(0);
  for (const [dim, value] of fixedCoords.entries()) {
    coord[dim] = value;
  }

  // Iterate over the 2D plane
  for (let i = 0; i < size1; i++) {
    coord[axis1] = i;
    for (let j = 0; j < size2; j++) {
      coord[axis2] = j;
      slice[i]![j] = grid.get(coord);
    }
  }

  return slice;
}

/**
 * Extracts multiple 2D slices along a dimension.
 *
 * Convenience function for getting all cross-sections along one axis.
 *
 * @param grid - N-dimensional source grid
 * @param axis1 - First display axis
 * @param axis2 - Second display axis
 * @param sliceAxis - Axis to slice along
 * @param fixedCoords - Fixed coordinates for other dimensions
 * @returns Array of 2D slices
 *
 * @example
 * ```typescript
 * // Get all XY slices from 3D grid (varying Z)
 * const slices = extractSlices(grid, 0, 1, 2, new Map());
 * // Returns [slice at z=0, slice at z=1, ..., slice at z=max]
 * ```
 */
export function extractSlices(
  grid: Grid,
  axis1: number,
  axis2: number,
  sliceAxis: number,
  fixedCoords: Map<number, number>
): number[][][] {
  const slices: number[][][] = [];
  const sliceCount = grid.dimensions[sliceAxis]!;

  for (let i = 0; i < sliceCount; i++) {
    const coords = new Map(fixedCoords);
    coords.set(sliceAxis, i);

    const slice = extractSlice(grid, { axis1, axis2, fixedCoords: coords });
    slices.push(slice);
  }

  return slices;
}
