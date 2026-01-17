import { describe, it, expect } from 'vitest';
import { generateNeighborhood, getMaxNeighbors } from '../neighborhood.js';

describe('neighborhood', () => {
  describe('generateNeighborhood - Moore', () => {
    it('should generate 8 neighbors for 2D Moore (range 1)', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      expect(neighbors).toHaveLength(8);
    });

    it('should generate 26 neighbors for 3D Moore (range 1)', () => {
      const neighbors = generateNeighborhood([5, 5, 5], { type: 'moore', range: 1 });
      expect(neighbors).toHaveLength(26);
    });

    it('should generate 80 neighbors for 4D Moore (range 1)', () => {
      const neighbors = generateNeighborhood([3, 3, 3, 3], { type: 'moore', range: 1 });
      // 3^4 - 1 = 81 - 1 = 80
      expect(neighbors).toHaveLength(80);
    });

    it('should not include origin in 2D Moore', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const hasOrigin = neighbors.some(([x, y]) => x === 0 && y === 0);
      expect(hasOrigin).toBe(false);
    });

    it('should include all diagonal neighbors in 2D Moore', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'moore', range: 1 });

      const diagonals = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];

      for (const diagonal of diagonals) {
        const found = neighbors.some(
          ([x, y]) => x === diagonal[0] && y === diagonal[1]
        );
        expect(found).toBe(true);
      }
    });

    it('should include orthogonal neighbors in 2D Moore', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'moore', range: 1 });

      const orthogonal = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      for (const offset of orthogonal) {
        const found = neighbors.some(
          ([x, y]) => x === offset[0] && y === offset[1]
        );
        expect(found).toBe(true);
      }
    });

    it('should handle Moore range 2 in 2D', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'moore', range: 2 });
      // 5^2 - 1 = 24
      expect(neighbors).toHaveLength(24);

      // Should include [-2, 0] but not [-3, 0]
      const has2Away = neighbors.some(([x, y]) => x === -2 && y === 0);
      const has3Away = neighbors.some(([x, y]) => x === -3 && y === 0);
      expect(has2Away).toBe(true);
      expect(has3Away).toBe(false);
    });
  });

  describe('generateNeighborhood - von Neumann', () => {
    it('should generate 4 neighbors for 2D von Neumann (range 1)', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'von-neumann', range: 1 });
      expect(neighbors).toHaveLength(4);
    });

    it('should generate 6 neighbors for 3D von Neumann (range 1)', () => {
      const neighbors = generateNeighborhood([5, 5, 5], { type: 'von-neumann', range: 1 });
      expect(neighbors).toHaveLength(6);
    });

    it('should generate 8 neighbors for 4D von Neumann (range 1)', () => {
      const neighbors = generateNeighborhood([3, 3, 3, 3], { type: 'von-neumann', range: 1 });
      // 2 * ndim = 2 * 4 = 8
      expect(neighbors).toHaveLength(8);
    });

    it('should not include origin in 2D von Neumann', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'von-neumann', range: 1 });
      const hasOrigin = neighbors.some(([x, y]) => x === 0 && y === 0);
      expect(hasOrigin).toBe(false);
    });

    it('should not include diagonal neighbors in 2D von Neumann', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'von-neumann', range: 1 });

      const diagonals = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];

      for (const diagonal of diagonals) {
        const found = neighbors.some(
          ([x, y]) => x === diagonal[0] && y === diagonal[1]
        );
        expect(found).toBe(false);
      }
    });

    it('should include only orthogonal neighbors in 2D von Neumann', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'von-neumann', range: 1 });

      const orthogonal = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      expect(neighbors).toHaveLength(4);

      for (const offset of orthogonal) {
        const found = neighbors.some(
          ([x, y]) => x === offset[0] && y === offset[1]
        );
        expect(found).toBe(true);
      }
    });

    it('should handle von Neumann range 2 in 2D', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'von-neumann', range: 2 });
      // Manhattan distance <= 2: includes 12 cells
      expect(neighbors).toHaveLength(12);

      // Should include [-2, 0] and [-1, -1]
      const has2_0 = neighbors.some(([x, y]) => x === -2 && y === 0);
      const has1_1 = neighbors.some(([x, y]) => x === -1 && y === -1);
      expect(has2_0).toBe(true);
      expect(has1_1).toBe(true);

      // Should not include [-2, -1] (Manhattan distance 3)
      const has2_1 = neighbors.some(([x, y]) => x === -2 && y === -1);
      expect(has2_1).toBe(false);
    });
  });

  describe('generateNeighborhood - default range', () => {
    it('should default to range 1 for Moore', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'moore' });
      expect(neighbors).toHaveLength(8);
    });

    it('should default to range 1 for von Neumann', () => {
      const neighbors = generateNeighborhood([10, 10], { type: 'von-neumann' });
      expect(neighbors).toHaveLength(4);
    });
  });

  describe('getMaxNeighbors', () => {
    it('should calculate correct max for 2D Moore', () => {
      const max = getMaxNeighbors([10, 10], 'moore', 1);
      expect(max).toBe(8);
    });

    it('should calculate correct max for 3D Moore', () => {
      const max = getMaxNeighbors([5, 5, 5], 'moore', 1);
      expect(max).toBe(26);
    });

    it('should calculate correct max for 4D Moore', () => {
      const max = getMaxNeighbors([3, 3, 3, 3], 'moore', 1);
      expect(max).toBe(80);
    });

    it('should calculate correct max for 2D von Neumann', () => {
      const max = getMaxNeighbors([10, 10], 'von-neumann', 1);
      expect(max).toBe(4);
    });

    it('should calculate correct max for 3D von Neumann', () => {
      const max = getMaxNeighbors([5, 5, 5], 'von-neumann', 1);
      expect(max).toBe(6);
    });

    it('should calculate correct max for 4D von Neumann', () => {
      const max = getMaxNeighbors([3, 3, 3, 3], 'von-neumann', 1);
      expect(max).toBe(8);
    });

    it('should handle Moore range 2', () => {
      const max = getMaxNeighbors([10, 10], 'moore', 2);
      expect(max).toBe(24);
    });

    it('should handle von Neumann range 2', () => {
      const max = getMaxNeighbors([10, 10], 'von-neumann', 2);
      expect(max).toBe(12);
    });

    it('should match actual neighborhood size', () => {
      const dims = [7, 7, 7];

      // Moore
      const mooreNeighbors = generateNeighborhood(dims, { type: 'moore', range: 1 });
      const mooreMax = getMaxNeighbors(dims, 'moore', 1);
      expect(mooreNeighbors).toHaveLength(mooreMax);

      // von Neumann
      const vnNeighbors = generateNeighborhood(dims, { type: 'von-neumann', range: 1 });
      const vnMax = getMaxNeighbors(dims, 'von-neumann', 1);
      expect(vnNeighbors).toHaveLength(vnMax);
    });
  });
});
