import { describe, expect, it } from 'vitest';
import { createGrid } from '../grid.js';
import { generateNeighborhood } from '../neighborhood.js';
import { createRule } from '../rule.js';
import { evolve } from '../stepper.js';

describe('stepper', () => {
  describe('evolve', () => {
    it('should evolve grid for specified number of steps', () => {
      const grid = createGrid([10, 10]);
      grid.set([5, 5], 1);
      grid.set([5, 6], 1);
      grid.set([6, 5], 1);

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { finalGrid, metricsHistory } = evolve(grid, rule, neighborhood, 10);

      expect(metricsHistory).toHaveLength(10);
      expect(finalGrid).toBeDefined();
    });

    it('should preserve grid independence', () => {
      const grid = createGrid([10, 10]);
      grid.set([5, 5], 1);

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const initialPopulation = grid.countPopulation();
      evolve(grid, rule, neighborhood, 10);

      // Original grid should be unchanged
      expect(grid.countPopulation()).toBe(initialPopulation);
    });

    it('should collect metrics at each step', () => {
      const grid = createGrid([5, 5]);
      grid.set([2, 2], 1);
      grid.set([2, 3], 1);
      grid.set([3, 2], 1);

      const neighborhood = generateNeighborhood([5, 5], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { metricsHistory } = evolve(grid, rule, neighborhood, 5);

      expect(metricsHistory).toHaveLength(5);

      for (const metrics of metricsHistory) {
        expect(metrics).toHaveProperty('population');
        expect(metrics).toHaveProperty('density');
        expect(metrics).toHaveProperty('births');
        expect(metrics).toHaveProperty('deaths');
        expect(metrics).toHaveProperty('delta');
        expect(metrics).toHaveProperty('step');
      }
    });

    it('should track population changes in metrics', () => {
      const grid = createGrid([5, 5]);
      grid.set([2, 2], 1);
      grid.set([2, 3], 1);
      grid.set([3, 2], 1);
      grid.set([3, 3], 1);

      const neighborhood = generateNeighborhood([5, 5], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { metricsHistory } = evolve(grid, rule, neighborhood, 3);

      for (let i = 0; i < metricsHistory.length; i++) {
        const metrics = metricsHistory[i]!;
        expect(metrics.step).toBe(i + 1);
        expect(metrics.delta).toBe(metrics.births - metrics.deaths);
      }
    });

    it('should handle metricsInterval parameter', () => {
      const grid = createGrid([10, 10]);
      grid.set([5, 5], 1);

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { metricsHistory } = evolve(grid, rule, neighborhood, 20, 5);

      // Should collect metrics every 5 steps: steps 5, 10, 15, 20
      expect(metricsHistory).toHaveLength(4);
    });

    it("should correctly simulate Conway's blinker pattern", () => {
      const grid = createGrid([5, 5]);
      // Horizontal blinker
      grid.set([2, 1], 1);
      grid.set([2, 2], 1);
      grid.set([2, 3], 1);

      const neighborhood = generateNeighborhood([5, 5], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      // After 1 step, should be vertical
      const { finalGrid: grid1 } = evolve(grid, rule, neighborhood, 1);
      expect(grid1.get([2, 2])).toBe(1);
      expect(grid1.get([1, 2])).toBe(1);
      expect(grid1.get([3, 2])).toBe(1);
      expect(grid1.get([2, 1])).toBe(0);
      expect(grid1.get([2, 3])).toBe(0);

      // After 2 steps, should be horizontal again
      const { finalGrid: grid2 } = evolve(grid, rule, neighborhood, 2);
      expect(grid2.get([2, 1])).toBe(1);
      expect(grid2.get([2, 2])).toBe(1);
      expect(grid2.get([2, 3])).toBe(1);
    });

    it("should correctly simulate Conway's block pattern (still life)", () => {
      const grid = createGrid([5, 5]);
      // 2x2 block
      grid.set([2, 2], 1);
      grid.set([2, 3], 1);
      grid.set([3, 2], 1);
      grid.set([3, 3], 1);

      const neighborhood = generateNeighborhood([5, 5], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { finalGrid, metricsHistory } = evolve(grid, rule, neighborhood, 10);

      // Block should remain stable
      expect(finalGrid.get([2, 2])).toBe(1);
      expect(finalGrid.get([2, 3])).toBe(1);
      expect(finalGrid.get([3, 2])).toBe(1);
      expect(finalGrid.get([3, 3])).toBe(1);
      expect(finalGrid.countPopulation()).toBe(4);

      // Population should be constant
      for (const metrics of metricsHistory) {
        expect(metrics.population).toBe(4);
        expect(metrics.births).toBe(0);
        expect(metrics.deaths).toBe(0);
      }
    });

    it('should handle empty grid', () => {
      const grid = createGrid([10, 10]);

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { finalGrid, metricsHistory } = evolve(grid, rule, neighborhood, 5);

      expect(finalGrid.countPopulation()).toBe(0);

      for (const metrics of metricsHistory) {
        expect(metrics.population).toBe(0);
      }
    });

    it('should handle full grid with death rule', () => {
      const grid = createGrid([3, 3]);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          grid.set([i, j], 1);
        }
      }

      const neighborhood = generateNeighborhood([3, 3], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { finalGrid } = evolve(grid, rule, neighborhood, 1);

      // All cells have 8 neighbors, so all should die (not in survival set)
      expect(finalGrid.countPopulation()).toBe(0);
    });

    it('should work with 3D grids', () => {
      const grid = createGrid([5, 5, 5]);
      grid.set([2, 2, 2], 1);
      grid.set([2, 2, 3], 1);
      grid.set([2, 3, 2], 1);
      grid.set([3, 2, 2], 1);

      const neighborhood = generateNeighborhood([5, 5, 5], { type: 'moore', range: 1 });
      const rule = createRule([4], [4, 5], 26);

      const { finalGrid, metricsHistory } = evolve(grid, rule, neighborhood, 5);

      expect(finalGrid).toBeDefined();
      expect(metricsHistory).toHaveLength(5);

      for (const metrics of metricsHistory) {
        expect(metrics.population).toBeGreaterThanOrEqual(0);
        expect(metrics.density).toBeGreaterThanOrEqual(0);
        expect(metrics.density).toBeLessThanOrEqual(1);
      }
    });

    it('should handle von Neumann neighborhood', () => {
      const grid = createGrid([5, 5]);
      grid.set([2, 2], 1);
      grid.set([2, 3], 1);
      grid.set([3, 2], 1);

      const neighborhood = generateNeighborhood([5, 5], { type: 'von-neumann', range: 1 });
      const rule = createRule([2], [1, 2], 4);

      const { finalGrid, metricsHistory } = evolve(grid, rule, neighborhood, 5);

      expect(finalGrid).toBeDefined();
      expect(metricsHistory).toHaveLength(5);
    });

    it('should correctly calculate density', () => {
      const grid = createGrid([10, 10]);
      // Add 25 cells (25%)
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          grid.set([i, j], 1);
        }
      }

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const rule = createRule([], [], 8); // No births or survival (all die)

      const { metricsHistory } = evolve(grid, rule, neighborhood, 1);

      const firstMetrics = metricsHistory[0]!;
      expect(firstMetrics.population).toBe(0);
      expect(firstMetrics.density).toBe(0);
      expect(firstMetrics.deaths).toBe(25);
    });

    it('should handle zero steps', () => {
      const grid = createGrid([10, 10]);
      grid.set([5, 5], 1);

      const neighborhood = generateNeighborhood([10, 10], { type: 'moore', range: 1 });
      const rule = createRule([3], [2, 3], 8);

      const { finalGrid, metricsHistory } = evolve(grid, rule, neighborhood, 0);

      expect(metricsHistory).toHaveLength(0);
      expect(finalGrid.countPopulation()).toBe(1);
    });
  });
});
