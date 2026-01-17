import { describe, it, expect } from 'vitest';
import { Grid, createGrid, initializeRandom } from '../grid.js';
import { createRandom } from '../random.js';

describe('grid', () => {
  describe('Grid constructor', () => {
    it('should create 2D grid with correct dimensions', () => {
      const grid = new Grid([10, 20]);
      expect(grid.dimensions).toEqual([10, 20]);
      expect(grid.size).toBe(200);
    });

    it('should create 3D grid with correct dimensions', () => {
      const grid = new Grid([5, 5, 5]);
      expect(grid.dimensions).toEqual([5, 5, 5]);
      expect(grid.size).toBe(125);
    });

    it('should create 4D grid with correct dimensions', () => {
      const grid = new Grid([3, 4, 5, 6]);
      expect(grid.dimensions).toEqual([3, 4, 5, 6]);
      expect(grid.size).toBe(360);
    });

    it('should initialize all cells to 0', () => {
      const grid = new Grid([10, 10]);
      expect(grid.countPopulation()).toBe(0);
    });

    it('should compute correct strides for 2D grid', () => {
      const grid = new Grid([3, 4]);
      expect(grid.strides).toEqual([4, 1]);
    });

    it('should compute correct strides for 3D grid', () => {
      const grid = new Grid([3, 4, 5]);
      expect(grid.strides).toEqual([20, 5, 1]);
    });
  });

  describe('index', () => {
    it('should compute correct flat index for 2D coordinates', () => {
      const grid = new Grid([10, 10]);
      expect(grid.index([0, 0])).toBe(0);
      expect(grid.index([0, 1])).toBe(1);
      expect(grid.index([1, 0])).toBe(10);
      expect(grid.index([1, 1])).toBe(11);
      expect(grid.index([9, 9])).toBe(99);
    });

    it('should compute correct flat index for 3D coordinates', () => {
      const grid = new Grid([3, 4, 5]);
      expect(grid.index([0, 0, 0])).toBe(0);
      expect(grid.index([0, 0, 1])).toBe(1);
      expect(grid.index([0, 1, 0])).toBe(5);
      expect(grid.index([1, 0, 0])).toBe(20);
      expect(grid.index([1, 2, 3])).toBe(33);
    });
  });

  describe('wrap', () => {
    it('should wrap negative coordinates in 2D', () => {
      const grid = new Grid([10, 10]);
      expect(grid.wrap([-1, 5])).toEqual([9, 5]);
      expect(grid.wrap([5, -1])).toEqual([5, 9]);
      expect(grid.wrap([-1, -1])).toEqual([9, 9]);
    });

    it('should wrap coordinates exceeding bounds in 2D', () => {
      const grid = new Grid([10, 10]);
      expect(grid.wrap([10, 5])).toEqual([0, 5]);
      expect(grid.wrap([5, 10])).toEqual([5, 0]);
      expect(grid.wrap([11, 12])).toEqual([1, 2]);
    });

    it('should wrap coordinates in 3D', () => {
      const grid = new Grid([5, 5, 5]);
      expect(grid.wrap([-1, 2, 3])).toEqual([4, 2, 3]);
      expect(grid.wrap([2, -1, 3])).toEqual([2, 4, 3]);
      expect(grid.wrap([2, 3, -1])).toEqual([2, 3, 4]);
      expect(grid.wrap([6, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should handle large offsets', () => {
      const grid = new Grid([10, 10]);
      expect(grid.wrap([25, 5])).toEqual([5, 5]);
      expect(grid.wrap([-15, 5])).toEqual([5, 5]);
    });

    it('should not modify in-bounds coordinates', () => {
      const grid = new Grid([10, 10]);
      expect(grid.wrap([5, 5])).toEqual([5, 5]);
      expect(grid.wrap([0, 0])).toEqual([0, 0]);
      expect(grid.wrap([9, 9])).toEqual([9, 9]);
    });
  });

  describe('get and set', () => {
    it('should set and get cell values in 2D', () => {
      const grid = new Grid([10, 10]);
      grid.set([5, 5], 1);
      expect(grid.get([5, 5])).toBe(1);
      expect(grid.get([5, 6])).toBe(0);
    });

    it('should set and get cell values in 3D', () => {
      const grid = new Grid([5, 5, 5]);
      grid.set([2, 3, 4], 1);
      expect(grid.get([2, 3, 4])).toBe(1);
      expect(grid.get([2, 3, 3])).toBe(0);
    });

    it('should handle multiple set operations', () => {
      const grid = new Grid([10, 10]);
      grid.set([0, 0], 1);
      grid.set([5, 5], 1);
      grid.set([9, 9], 1);

      expect(grid.get([0, 0])).toBe(1);
      expect(grid.get([5, 5])).toBe(1);
      expect(grid.get([9, 9])).toBe(1);
      expect(grid.countPopulation()).toBe(3);
    });

    it('should overwrite existing values', () => {
      const grid = new Grid([10, 10]);
      grid.set([5, 5], 1);
      expect(grid.get([5, 5])).toBe(1);

      grid.set([5, 5], 0);
      expect(grid.get([5, 5])).toBe(0);
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const original = new Grid([10, 10]);
      original.set([5, 5], 1);

      const copy = original.clone();
      expect(copy.get([5, 5])).toBe(1);

      copy.set([5, 5], 0);
      expect(original.get([5, 5])).toBe(1);
      expect(copy.get([5, 5])).toBe(0);
    });

    it('should preserve all data', () => {
      const original = new Grid([5, 5]);
      original.set([0, 0], 1);
      original.set([2, 3], 1);
      original.set([4, 4], 1);

      const copy = original.clone();
      expect(copy.get([0, 0])).toBe(1);
      expect(copy.get([2, 3])).toBe(1);
      expect(copy.get([4, 4])).toBe(1);
      expect(copy.countPopulation()).toBe(3);
    });
  });

  describe('countPopulation', () => {
    it('should count alive cells correctly', () => {
      const grid = new Grid([10, 10]);
      expect(grid.countPopulation()).toBe(0);

      grid.set([0, 0], 1);
      expect(grid.countPopulation()).toBe(1);

      grid.set([5, 5], 1);
      expect(grid.countPopulation()).toBe(2);

      grid.set([9, 9], 1);
      expect(grid.countPopulation()).toBe(3);
    });

    it('should handle full grid', () => {
      const grid = new Grid([3, 3]);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          grid.set([i, j], 1);
        }
      }
      expect(grid.countPopulation()).toBe(9);
    });
  });

  describe('createGrid', () => {
    it('should create grid using factory function', () => {
      const grid = createGrid([10, 10]);
      expect(grid).toBeInstanceOf(Grid);
      expect(grid.dimensions).toEqual([10, 10]);
    });
  });

  describe('initializeRandom', () => {
    it('should initialize grid with approximate density', () => {
      const grid = createGrid([100, 100]);
      const rng = createRandom(42);
      initializeRandom(grid, 0.3, rng);

      const population = grid.countPopulation();
      const density = population / grid.size;

      // Should be roughly 30% ± 5%
      expect(density).toBeGreaterThan(0.25);
      expect(density).toBeLessThan(0.35);
    });

    it('should produce deterministic results with same seed', () => {
      const grid1 = createGrid([50, 50]);
      const grid2 = createGrid([50, 50]);

      initializeRandom(grid1, 0.5, createRandom(123));
      initializeRandom(grid2, 0.5, createRandom(123));

      expect(grid1.countPopulation()).toBe(grid2.countPopulation());

      // Verify every cell matches
      for (let i = 0; i < 50; i++) {
        for (let j = 0; j < 50; j++) {
          expect(grid1.get([i, j])).toBe(grid2.get([i, j]));
        }
      }
    });

    it('should handle density of 0', () => {
      const grid = createGrid([10, 10]);
      const rng = createRandom(42);
      initializeRandom(grid, 0, rng);

      expect(grid.countPopulation()).toBe(0);
    });

    it('should handle density of 1', () => {
      const grid = createGrid([10, 10]);
      const rng = createRandom(42);
      initializeRandom(grid, 1, rng);

      expect(grid.countPopulation()).toBe(100);
    });

    it('should work in 3D', () => {
      const grid = createGrid([10, 10, 10]);
      const rng = createRandom(999);
      initializeRandom(grid, 0.2, rng);

      const population = grid.countPopulation();
      const density = population / grid.size;

      expect(density).toBeGreaterThan(0.15);
      expect(density).toBeLessThan(0.25);
    });
  });
});
