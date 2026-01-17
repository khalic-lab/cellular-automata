/**
 * Terminal visualization module for N-dimensional cellular automata.
 *
 * Provides text-based visualization using Unicode/ASCII characters.
 * Supports both snapshot mode and real-time animation.
 *
 * @example
 * ```typescript
 * import { visualize, animate, CHARSETS } from 'nd-cellular-automata/visualization';
 *
 * // Snapshot visualization
 * visualize({
 *   dimensions: [20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 100,
 *   initialDensity: 0.3,
 *   seed: 42,
 * }, 25);
 *
 * // Real-time animation (1.5s per frame by default)
 * const controller = animate({
 *   dimensions: [20, 20],
 *   neighborhood: { type: 'moore', range: 1 },
 *   rule: { birth: [3], survival: [2, 3] },
 *   steps: 50,
 *   initialDensity: 0.3,
 *   seed: 42,
 * });
 *
 * // Wait for completion
 * const result = await controller.done;
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
  AnimationOptions,
  AnimationResult,
  AnimationController,
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

// High-level snapshot functions
export {
  runWithSnapshots,
  printSnapshots,
  visualize,
} from './terminal.js';

// Animation functions
export {
  animate,
  animateAsync,
  collectFrames,
  playFrames,
} from './animate.js';
