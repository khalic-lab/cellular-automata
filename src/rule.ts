/**
 * Cellular automata rule evaluation.
 *
 * Implements totalistic birth/survival rules:
 * - Birth: neighbor counts that cause dead cells to become alive
 * - Survival: neighbor counts that keep alive cells alive
 *
 * Supports both absolute thresholds (integer counts) and relative
 * thresholds (fractions of maximum neighbors).
 */

import type { Rule, ThresholdSet } from './types.js';

/**
 * Creates a cellular automata rule.
 *
 * Pure data structure with readonly properties.
 *
 * @param birth - Neighbor counts causing birth
 * @param survival - Neighbor counts allowing survival
 * @param maxNeighbors - Maximum possible neighbor count
 * @returns Immutable rule object
 *
 * @example
 * ```typescript
 * // Conway's Game of Life (2D)
 * createRule([3], [2, 3], 8);
 * ```
 */
export function createRule(
  birth: number[],
  survival: number[],
  maxNeighbors: number
): Rule {
  return {
    birth: new Set(birth),
    survival: new Set(survival),
    maxNeighbors
  };
}

/**
 * Creates rule from threshold specifications.
 *
 * Handles both absolute and relative thresholds:
 * - Absolute: [3, 4] means exactly 3 or 4 neighbors
 * - Relative: [{relative: 0.3}, {relative: 0.4}] means 30% or 40% of max
 *
 * Note: All thresholds must be uniform (all absolute OR all relative).
 *
 * @param birthThresholds - Birth threshold specification
 * @param survivalThresholds - Survival threshold specification
 * @param maxNeighbors - Maximum possible neighbor count
 * @returns Rule with normalized thresholds
 *
 * @example
 * ```typescript
 * // Absolute thresholds
 * ruleFromThresholds([3], [2, 3], 8);
 *
 * // Relative thresholds (30% and 40% of max)
 * ruleFromThresholds(
 *   [{relative: 0.3}],
 *   [{relative: 0.4}, {relative: 0.5}],
 *   26
 * );
 * ```
 */
export function ruleFromThresholds(
  birthThresholds: ThresholdSet,
  survivalThresholds: ThresholdSet,
  maxNeighbors: number
): Rule {
  const birth = normalizeThresholds(birthThresholds, maxNeighbors);
  const survival = normalizeThresholds(survivalThresholds, maxNeighbors);
  return createRule(birth, survival, maxNeighbors);
}

/**
 * Normalizes threshold specification to absolute counts.
 *
 * Converts relative fractions to integer neighbor counts.
 *
 * @param thresholds - Threshold specification
 * @param maxNeighbors - Maximum possible neighbor count
 * @returns Array of absolute neighbor counts
 */
function normalizeThresholds(
  thresholds: ThresholdSet,
  maxNeighbors: number
): number[] {
  if (thresholds.length === 0) {
    return [];
  }

  // Check if relative thresholds
  if (typeof thresholds[0] === 'object' && 'relative' in thresholds[0]) {
    // Convert relative to absolute
    return (thresholds as { relative: number }[]).map(({ relative }) =>
      Math.round(relative * maxNeighbors)
    );
  }

  // Already absolute
  return thresholds as number[];
}

/**
 * Determines if a cell should be alive in the next generation.
 *
 * Pure function implementing totalistic rule logic.
 *
 * @param rule - Rule specification
 * @param currentState - Current cell state (0 or 1)
 * @param neighborCount - Count of alive neighbors
 * @returns Next state (0 or 1)
 *
 * @example
 * ```typescript
 * const rule = createRule([3], [2, 3], 8);
 *
 * // Dead cell with 3 neighbors → birth
 * shouldCellBeAlive(rule, 0, 3);  // → true
 *
 * // Alive cell with 1 neighbor → death
 * shouldCellBeAlive(rule, 1, 1);  // → false
 * ```
 */
export function shouldCellBeAlive(
  { birth, survival }: Rule,
  currentState: number,
  neighborCount: number
): boolean {
  if (currentState === 1) {
    // Alive cell: check survival set
    return survival.has(neighborCount);
  } else {
    // Dead cell: check birth set
    return birth.has(neighborCount);
  }
}
