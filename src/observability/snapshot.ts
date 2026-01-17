/**
 * Snapshot functions for capturing and restoring experiment state.
 *
 * Snapshots enable:
 * - Capturing grid state at any point during evolution
 * - Serializing state to JSON for persistence
 * - Resuming experiments with different options (e.g., enabling instrumentation)
 *
 * Design: All functions are pure where possible, with minimal side effects.
 */

import type { ExperimentConfig, Metrics, EnhancedMetrics } from '../types.js';
import { Grid, createGrid } from '../grid.js';
import type { ExperimentSnapshot } from './types.js';

/**
 * Generates a unique snapshot ID.
 *
 * Format: snap_{timestamp_base36}_{random_base36}
 */
function generateSnapshotId(): string {
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Creates a snapshot from current experiment state.
 *
 * Pure function that captures grid state and metrics history
 * into a serializable format.
 *
 * @param grid - Current grid state
 * @param stepsTaken - Number of evolution steps completed
 * @param metricsHistory - Accumulated metrics so far
 * @param config - Original experiment configuration
 * @returns Serializable snapshot
 *
 * @example
 * ```typescript
 * const snapshot = createSnapshot(grid, 500, metricsHistory, config);
 * fs.writeFileSync('checkpoint.json', serializeSnapshot(snapshot));
 * ```
 */
export function createSnapshot(
  grid: Grid,
  stepsTaken: number,
  metricsHistory: Metrics[] | EnhancedMetrics[],
  config: ExperimentConfig
): ExperimentSnapshot {
  return {
    id: generateSnapshotId(),
    timestamp: new Date().toISOString(),
    stepsTaken,
    gridData: Array.from(grid.data),
    dimensions: [...grid.dimensions],
    metricsHistory: [...metricsHistory],
    config,
  };
}

/**
 * Restores a Grid from a snapshot.
 *
 * Creates a new Grid instance with the same dimensions and state
 * as captured in the snapshot.
 *
 * @param snapshot - Previously captured snapshot
 * @returns Restored Grid instance
 *
 * @example
 * ```typescript
 * const snapshot = deserializeSnapshot(jsonString);
 * const grid = restoreGridFromSnapshot(snapshot);
 * // Continue evolution from this point
 * ```
 */
export function restoreGridFromSnapshot(snapshot: ExperimentSnapshot): Grid {
  const grid = createGrid(snapshot.dimensions);
  grid.data.set(snapshot.gridData);
  return grid;
}

/**
 * Serializes a snapshot to JSON string.
 *
 * The resulting JSON is suitable for file storage or transmission.
 *
 * @param snapshot - Snapshot to serialize
 * @returns JSON string representation
 *
 * @example
 * ```typescript
 * const json = serializeSnapshot(snapshot);
 * fs.writeFileSync('snapshot.json', json);
 * ```
 */
export function serializeSnapshot(snapshot: ExperimentSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Deserializes a snapshot from JSON string.
 *
 * @param json - JSON string from serializeSnapshot
 * @returns Restored snapshot object
 *
 * @example
 * ```typescript
 * const json = fs.readFileSync('snapshot.json', 'utf8');
 * const snapshot = deserializeSnapshot(json);
 * const grid = restoreGridFromSnapshot(snapshot);
 * ```
 */
export function deserializeSnapshot(json: string): ExperimentSnapshot {
  return JSON.parse(json) as ExperimentSnapshot;
}

/**
 * Validates a snapshot structure.
 *
 * Checks that all required fields are present and have valid values.
 * Useful when loading snapshots from external sources.
 *
 * @param snapshot - Object to validate
 * @returns True if valid, false otherwise
 */
export function validateSnapshot(snapshot: unknown): snapshot is ExperimentSnapshot {
  if (typeof snapshot !== 'object' || snapshot === null) {
    return false;
  }

  const s = snapshot as Record<string, unknown>;

  // Check required fields
  if (typeof s.id !== 'string') return false;
  if (typeof s.timestamp !== 'string') return false;
  if (typeof s.stepsTaken !== 'number' || s.stepsTaken < 0) return false;

  // Check gridData is array of numbers
  if (!Array.isArray(s.gridData)) return false;
  if (!s.gridData.every((v: unknown) => typeof v === 'number' && (v === 0 || v === 1))) {
    return false;
  }

  // Check dimensions is array of positive numbers
  if (!Array.isArray(s.dimensions)) return false;
  if (!s.dimensions.every((v: unknown) => typeof v === 'number' && v > 0)) {
    return false;
  }

  // Check gridData size matches dimensions
  const expectedSize = (s.dimensions as number[]).reduce((a, b) => a * b, 1);
  if (s.gridData.length !== expectedSize) return false;

  // Check metricsHistory is array
  if (!Array.isArray(s.metricsHistory)) return false;

  // Check config has required fields
  if (typeof s.config !== 'object' || s.config === null) return false;
  const config = s.config as Record<string, unknown>;
  if (!Array.isArray(config.dimensions)) return false;
  if (typeof config.steps !== 'number') return false;
  if (typeof config.initialDensity !== 'number') return false;

  return true;
}

/**
 * Computes the size of a snapshot in bytes (approximate).
 *
 * Useful for estimating storage requirements.
 *
 * @param snapshot - Snapshot to measure
 * @returns Approximate size in bytes
 */
export function snapshotSize(snapshot: ExperimentSnapshot): number {
  // Approximate: gridData is the main contributor
  // Each cell is ~1 byte in JSON (0 or 1)
  // Plus overhead for structure, metrics, etc.
  const gridBytes = snapshot.gridData.length * 2; // Including commas
  const metricsBytes = snapshot.metricsHistory.length * 100; // ~100 bytes per metrics entry
  const overhead = 500; // Config, metadata, formatting

  return gridBytes + metricsBytes + overhead;
}

/**
 * Compresses snapshot by run-length encoding the grid data.
 *
 * For grids with large contiguous regions of same state,
 * this can significantly reduce size.
 *
 * @param snapshot - Snapshot with regular grid data
 * @returns New snapshot with compressed grid data
 */
export function compressSnapshot(snapshot: ExperimentSnapshot): ExperimentSnapshot & { compressed: true; rleData: number[] } {
  const rleData: number[] = [];
  let currentValue = snapshot.gridData[0]!;
  let runLength = 1;

  for (let i = 1; i < snapshot.gridData.length; i++) {
    if (snapshot.gridData[i] === currentValue && runLength < 255) {
      runLength++;
    } else {
      rleData.push(currentValue, runLength);
      currentValue = snapshot.gridData[i]!;
      runLength = 1;
    }
  }
  // Push final run
  rleData.push(currentValue, runLength);

  return {
    ...snapshot,
    gridData: [], // Clear original data
    compressed: true,
    rleData,
  };
}

/**
 * Decompresses a compressed snapshot back to regular format.
 *
 * @param compressed - Snapshot with compressed grid data
 * @returns Snapshot with regular grid data
 */
export function decompressSnapshot(
  compressed: ExperimentSnapshot & { compressed: true; rleData: number[] }
): ExperimentSnapshot {
  const gridData: number[] = [];

  for (let i = 0; i < compressed.rleData.length; i += 2) {
    const value = compressed.rleData[i]!;
    const count = compressed.rleData[i + 1]!;
    for (let j = 0; j < count; j++) {
      gridData.push(value);
    }
  }

  // Create new snapshot without compression fields
  const { compressed: _, rleData: __, ...rest } = compressed;
  return {
    ...rest,
    gridData,
  };
}
