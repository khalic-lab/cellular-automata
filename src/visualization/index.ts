/**
 * Terminal visualization module for N-dimensional cellular automata.
 *
 * Provides text-based visualization using Unicode/ASCII characters.
 * Supports snapshot mode showing start, end, and configurable intervals.
 *
 * @example
 * ```typescript
 * import { visualize, CHARSETS, BORDERS } from 'nd-cellular-automata/visualization';
 *
 * // Quick visualization with snapshots every 25 steps
 * visualize({
 *   dimensions: [20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 100,
 *   initialDensity: 0.3,
 *   seed: 42,
 * }, 25);
 *
 * // Custom rendering options
 * visualize(config, 50, {
 *   charset: CHARSETS.ascii,
 *   border: BORDERS.double,
 *   layout: 'stacked',
 * });
 * ```
 */

// Types
export type {
  CellCharset,
  BorderStyle,
  RenderOptions,
  SliceRenderOptions,
  VisualizationFrame,
  SnapshotVisualizationOptions,
  VisualizationResult,
} from './types.js';

// Constants
export { CHARSETS, BORDERS } from './types.js';

// Rendering functions
export {
  render2DArray,
  renderGrid2D,
  renderGridSlice,
  formatMetrics,
  renderFrame,
  renderFramesSideBySide,
  renderFramesStacked,
} from './terminal.js';

// High-level functions
export {
  runWithSnapshots,
  printSnapshots,
  visualize,
} from './terminal.js';
