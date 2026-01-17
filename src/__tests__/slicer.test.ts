import { describe, expect, it } from 'vitest';
import { createGrid } from '../grid.js';
import { extractSlice, extractSlices } from '../slicer.js';

describe('slicer', () => {
  describe('extractSlice', () => {
    it('should extract 2D slice from 3D grid', () => {
      const grid = createGrid([3, 3, 3]);
      // Set some cells at z=1
      grid.set([0, 0, 1], 1);
      grid.set([1, 1, 1], 1);
      grid.set([2, 2, 1], 1);

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 1]]), // z=1
      });

      expect(slice).toHaveLength(3);
      expect(slice[0]).toHaveLength(3);
      expect(slice[0]![0]).toBe(1);
      expect(slice[1]![1]).toBe(1);
      expect(slice[2]![2]).toBe(1);
    });

    it('should extract different planes from 3D grid', () => {
      const grid = createGrid([4, 4, 4]);
      grid.set([1, 2, 3], 1);

      // XY plane at z=3
      const sliceXY = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 3]]),
      });
      expect(sliceXY[1]![2]).toBe(1);

      // XZ plane at y=2
      const sliceXZ = extractSlice(grid, {
        axis1: 0,
        axis2: 2,
        fixedCoords: new Map([[1, 2]]),
      });
      expect(sliceXZ[1]![3]).toBe(1);

      // YZ plane at x=1
      const sliceYZ = extractSlice(grid, {
        axis1: 1,
        axis2: 2,
        fixedCoords: new Map([[0, 1]]),
      });
      expect(sliceYZ[2]![3]).toBe(1);
    });

    it('should handle empty slice', () => {
      const grid = createGrid([5, 5, 5]);

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 2]]),
      });

      expect(slice).toHaveLength(5);
      expect(slice[0]).toHaveLength(5);

      for (const row of slice) {
        for (const cell of row) {
          expect(cell).toBe(0);
        }
      }
    });

    it('should extract from 4D grid', () => {
      const grid = createGrid([3, 3, 3, 3]);
      grid.set([1, 1, 2, 2], 1);
      grid.set([2, 0, 2, 2], 1);

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([
          [2, 2],
          [3, 2],
        ]), // w=2, z=2
      });

      expect(slice[1]![1]).toBe(1);
      expect(slice[2]![0]).toBe(1);
    });

    it('should handle different axis combinations', () => {
      const grid = createGrid([4, 5, 6]);
      grid.set([2, 3, 4], 1);

      // axis1=0, axis2=1
      const slice01 = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 4]]),
      });
      expect(slice01).toHaveLength(4);
      expect(slice01[0]).toHaveLength(5);
      expect(slice01[2]![3]).toBe(1);

      // axis1=1, axis2=2
      const slice12 = extractSlice(grid, {
        axis1: 1,
        axis2: 2,
        fixedCoords: new Map([[0, 2]]),
      });
      expect(slice12).toHaveLength(5);
      expect(slice12[0]).toHaveLength(6);
      expect(slice12[3]![4]).toBe(1);
    });

    it('should handle single cell grid', () => {
      const grid = createGrid([1, 1, 1]);
      grid.set([0, 0, 0], 1);

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 0]]),
      });

      expect(slice).toHaveLength(1);
      expect(slice[0]).toHaveLength(1);
      expect(slice[0]![0]).toBe(1);
    });

    it('should preserve exact values in slice', () => {
      const grid = createGrid([5, 5, 5]);

      // Create a diagonal pattern
      for (let i = 0; i < 5; i++) {
        grid.set([i, i, 2], 1);
      }

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 2]]),
      });

      for (let i = 0; i < 5; i++) {
        expect(slice[i]![i]).toBe(1);
      }

      // Non-diagonal cells should be 0
      expect(slice[0]![1]).toBe(0);
      expect(slice[1]![0]).toBe(0);
    });
  });

  describe('extractSlices', () => {
    it('should extract all slices along an axis', () => {
      const grid = createGrid([3, 3, 3]);
      // Set cells at different z levels
      grid.set([1, 1, 0], 1);
      grid.set([1, 1, 1], 1);
      grid.set([1, 1, 2], 1);

      const slices = extractSlices(grid, 0, 1, 2, new Map());

      expect(slices).toHaveLength(3);

      expect(slices[0]![1]![1]).toBe(1);
      expect(slices[1]![1]![1]).toBe(1);
      expect(slices[2]![1]![1]).toBe(1);
    });

    it('should extract all XY planes from 3D grid', () => {
      const grid = createGrid([4, 4, 5]);

      // Set one cell per z-level
      for (let z = 0; z < 5; z++) {
        grid.set([z % 4, z % 4, z], 1);
      }

      const slices = extractSlices(grid, 0, 1, 2, new Map());

      expect(slices).toHaveLength(5);

      for (let z = 0; z < 5; z++) {
        expect(slices[z]![z % 4]![z % 4]).toBe(1);
      }
    });

    it('should extract with fixed coordinates', () => {
      const grid = createGrid([3, 3, 3, 3]);
      grid.set([1, 1, 2, 2], 1);

      const slices = extractSlices(grid, 0, 1, 2, new Map([[3, 2]]));

      expect(slices).toHaveLength(3);
      expect(slices[2]![1]![1]).toBe(1);
    });

    it('should handle empty grid', () => {
      const grid = createGrid([3, 3, 3]);

      const slices = extractSlices(grid, 0, 1, 2, new Map());

      expect(slices).toHaveLength(3);

      for (const slice of slices) {
        for (const row of slice) {
          for (const cell of row) {
            expect(cell).toBe(0);
          }
        }
      }
    });

    it('should produce independent slices', () => {
      const grid = createGrid([3, 3, 3]);
      grid.set([1, 1, 0], 1);

      const slices = extractSlices(grid, 0, 1, 2, new Map());

      // Modify one slice
      slices[0]![1]![1] = 99;

      // Other slices should be unaffected
      expect(slices[1]![1]![1]).toBe(0);
      expect(slices[2]![1]![1]).toBe(0);

      // Original grid should be unaffected
      expect(grid.get([1, 1, 1])).toBe(0);
    });

    it('should handle single slice dimension', () => {
      const grid = createGrid([3, 3, 1]);
      grid.set([1, 1, 0], 1);

      const slices = extractSlices(grid, 0, 1, 2, new Map());

      expect(slices).toHaveLength(1);
      expect(slices[0]![1]![1]).toBe(1);
    });

    it('should extract from different axes', () => {
      const grid = createGrid([2, 3, 4]);
      grid.set([1, 2, 3], 1);

      // Slice along axis 0
      const slicesX = extractSlices(grid, 1, 2, 0, new Map());
      expect(slicesX).toHaveLength(2);
      expect(slicesX[1]![2]![3]).toBe(1);

      // Slice along axis 1
      const slicesY = extractSlices(grid, 0, 2, 1, new Map());
      expect(slicesY).toHaveLength(3);
      expect(slicesY[2]![1]![3]).toBe(1);

      // Slice along axis 2
      const slicesZ = extractSlices(grid, 0, 1, 2, new Map());
      expect(slicesZ).toHaveLength(4);
      expect(slicesZ[3]![1]![2]).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle 2D grid as 3D with depth 1', () => {
      const grid = createGrid([5, 5, 1]);
      grid.set([2, 3, 0], 1);

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 0]]),
      });

      expect(slice[2]![3]).toBe(1);
    });

    it('should handle large grid dimensions', () => {
      const grid = createGrid([10, 10, 10]);
      grid.set([9, 9, 9], 1);

      const slice = extractSlice(grid, {
        axis1: 0,
        axis2: 1,
        fixedCoords: new Map([[2, 9]]),
      });

      expect(slice).toHaveLength(10);
      expect(slice[0]).toHaveLength(10);
      expect(slice[9]![9]).toBe(1);
    });
  });
});
