import { describe, expect, it } from 'vitest';
import { createRule, ruleFromThresholds, shouldCellBeAlive } from '../rule.js';

describe('rule', () => {
  describe('createRule', () => {
    it('should create rule with birth and survival sets', () => {
      const rule = createRule([3], [2, 3], 8);

      expect(rule.birth.has(3)).toBe(true);
      expect(rule.survival.has(2)).toBe(true);
      expect(rule.survival.has(3)).toBe(true);
      expect(rule.maxNeighbors).toBe(8);
    });

    it('should create rule with multiple birth values', () => {
      const rule = createRule([2, 3, 4], [3, 4, 5], 26);

      expect(rule.birth.has(2)).toBe(true);
      expect(rule.birth.has(3)).toBe(true);
      expect(rule.birth.has(4)).toBe(true);
      expect(rule.birth.has(5)).toBe(false);
    });

    it('should create rule with empty birth set', () => {
      const rule = createRule([], [2, 3], 8);

      expect(rule.birth.size).toBe(0);
      expect(rule.survival.size).toBe(2);
    });

    it('should create rule with empty survival set', () => {
      const rule = createRule([3], [], 8);

      expect(rule.birth.size).toBe(1);
      expect(rule.survival.size).toBe(0);
    });

    it('should create immutable sets', () => {
      const rule = createRule([3], [2, 3], 8);

      expect(Object.isFrozen(rule.birth)).toBe(false); // Sets aren't frozen, but readonly
      expect(rule.birth).toBeInstanceOf(Set);
      expect(rule.survival).toBeInstanceOf(Set);
    });
  });

  describe('ruleFromThresholds - absolute', () => {
    it('should handle absolute thresholds', () => {
      const rule = ruleFromThresholds([3], [2, 3], 8);

      expect(rule.birth.has(3)).toBe(true);
      expect(rule.survival.has(2)).toBe(true);
      expect(rule.survival.has(3)).toBe(true);
    });

    it('should pass through absolute values unchanged', () => {
      const rule = ruleFromThresholds([1, 2, 3], [4, 5], 10);

      expect([...rule.birth]).toEqual(expect.arrayContaining([1, 2, 3]));
      expect([...rule.survival]).toEqual(expect.arrayContaining([4, 5]));
    });
  });

  describe('ruleFromThresholds - relative', () => {
    it('should convert relative thresholds to absolute', () => {
      const rule = ruleFromThresholds([{ relative: 0.5 }], [{ relative: 0.25 }], 8);

      // 0.5 * 8 = 4, 0.25 * 8 = 2
      expect(rule.birth.has(4)).toBe(true);
      expect(rule.survival.has(2)).toBe(true);
    });

    it('should round relative values correctly', () => {
      const rule = ruleFromThresholds(
        [{ relative: 0.3 }], // 0.3 * 26 = 7.8 → rounds to 8
        [{ relative: 0.15 }], // 0.15 * 26 = 3.9 → rounds to 4
        26
      );

      expect(rule.birth.has(8)).toBe(true);
      expect(rule.survival.has(4)).toBe(true);
    });

    it('should handle multiple relative thresholds', () => {
      const rule = ruleFromThresholds(
        [{ relative: 0.1 }, { relative: 0.2 }],
        [{ relative: 0.3 }, { relative: 0.4 }],
        10
      );

      expect(rule.birth.has(1)).toBe(true);
      expect(rule.birth.has(2)).toBe(true);
      expect(rule.survival.has(3)).toBe(true);
      expect(rule.survival.has(4)).toBe(true);
    });

    it('should handle edge cases for relative values', () => {
      const rule = ruleFromThresholds([{ relative: 0 }], [{ relative: 1 }], 8);

      expect(rule.birth.has(0)).toBe(true);
      expect(rule.survival.has(8)).toBe(true);
    });
  });

  describe('ruleFromThresholds - empty', () => {
    it('should handle empty threshold arrays', () => {
      const rule = ruleFromThresholds([], [], 8);

      expect(rule.birth.size).toBe(0);
      expect(rule.survival.size).toBe(0);
    });
  });

  describe('shouldCellBeAlive', () => {
    const conwayRule = createRule([3], [2, 3], 8);

    it('should handle birth (dead cell becoming alive)', () => {
      expect(shouldCellBeAlive(conwayRule, 0, 3)).toBe(true);
      expect(shouldCellBeAlive(conwayRule, 0, 2)).toBe(false);
      expect(shouldCellBeAlive(conwayRule, 0, 4)).toBe(false);
    });

    it('should handle survival (alive cell staying alive)', () => {
      expect(shouldCellBeAlive(conwayRule, 1, 2)).toBe(true);
      expect(shouldCellBeAlive(conwayRule, 1, 3)).toBe(true);
      expect(shouldCellBeAlive(conwayRule, 1, 1)).toBe(false);
      expect(shouldCellBeAlive(conwayRule, 1, 4)).toBe(false);
    });

    it('should handle death (alive cell dying)', () => {
      expect(shouldCellBeAlive(conwayRule, 1, 0)).toBe(false);
      expect(shouldCellBeAlive(conwayRule, 1, 1)).toBe(false);
      expect(shouldCellBeAlive(conwayRule, 1, 4)).toBe(false);
      expect(shouldCellBeAlive(conwayRule, 1, 8)).toBe(false);
    });

    it('should handle rule with no births', () => {
      const noBirthRule = createRule([], [2, 3], 8);

      expect(shouldCellBeAlive(noBirthRule, 0, 3)).toBe(false);
      expect(shouldCellBeAlive(noBirthRule, 0, 5)).toBe(false);
    });

    it('should handle rule with no survival', () => {
      const noSurvivalRule = createRule([3], [], 8);

      expect(shouldCellBeAlive(noSurvivalRule, 1, 2)).toBe(false);
      expect(shouldCellBeAlive(noSurvivalRule, 1, 3)).toBe(false);
    });

    it('should handle 3D rule (B4/S4,5)', () => {
      const rule3d = createRule([4], [4, 5], 26);

      // Birth
      expect(shouldCellBeAlive(rule3d, 0, 4)).toBe(true);
      expect(shouldCellBeAlive(rule3d, 0, 3)).toBe(false);
      expect(shouldCellBeAlive(rule3d, 0, 5)).toBe(false);

      // Survival
      expect(shouldCellBeAlive(rule3d, 1, 4)).toBe(true);
      expect(shouldCellBeAlive(rule3d, 1, 5)).toBe(true);
      expect(shouldCellBeAlive(rule3d, 1, 3)).toBe(false);
    });

    it('should handle edge cases', () => {
      const rule = createRule([0, 8], [0, 8], 8);

      expect(shouldCellBeAlive(rule, 0, 0)).toBe(true);
      expect(shouldCellBeAlive(rule, 0, 8)).toBe(true);
      expect(shouldCellBeAlive(rule, 1, 0)).toBe(true);
      expect(shouldCellBeAlive(rule, 1, 8)).toBe(true);
      expect(shouldCellBeAlive(rule, 0, 4)).toBe(false);
      expect(shouldCellBeAlive(rule, 1, 4)).toBe(false);
    });

    it('should be deterministic', () => {
      const rule = createRule([3, 4], [2, 3, 4], 8);

      // Same inputs should always give same outputs
      for (let i = 0; i < 10; i++) {
        expect(shouldCellBeAlive(rule, 0, 3)).toBe(true);
        expect(shouldCellBeAlive(rule, 1, 2)).toBe(true);
        expect(shouldCellBeAlive(rule, 0, 5)).toBe(false);
        expect(shouldCellBeAlive(rule, 1, 5)).toBe(false);
      }
    });
  });

  describe("Conway's Game of Life", () => {
    it('should correctly implement B3/S23', () => {
      const rule = createRule([3], [2, 3], 8);

      // Birth with 3 neighbors
      expect(shouldCellBeAlive(rule, 0, 3)).toBe(true);

      // Survival with 2 neighbors
      expect(shouldCellBeAlive(rule, 1, 2)).toBe(true);

      // Survival with 3 neighbors
      expect(shouldCellBeAlive(rule, 1, 3)).toBe(true);

      // Death from underpopulation
      expect(shouldCellBeAlive(rule, 1, 0)).toBe(false);
      expect(shouldCellBeAlive(rule, 1, 1)).toBe(false);

      // Death from overpopulation
      expect(shouldCellBeAlive(rule, 1, 4)).toBe(false);
      expect(shouldCellBeAlive(rule, 1, 8)).toBe(false);

      // No birth without 3 neighbors
      expect(shouldCellBeAlive(rule, 0, 2)).toBe(false);
      expect(shouldCellBeAlive(rule, 0, 4)).toBe(false);
    });
  });
});
