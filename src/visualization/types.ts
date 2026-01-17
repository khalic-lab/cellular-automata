/**
 * Type definitions for terminal visualization.
 */

import type { Grid } from '../grid.js';
import type { EnhancedMetrics, Metrics } from '../types.js';

/**
 * Character set for rendering cells.
 */
export interface CellCharset {
  /** Character for alive cells */
  readonly alive: string;
  /** Character for dead cells */
  readonly dead: string;
}

/**
 * Predefined character sets.
 */
export const CHARSETS = {
  /** Unicode block characters */
  blocks: { alive: '\u2588', dead: '\u00B7' } as CellCharset,
  /** ASCII characters */
  ascii: { alive: '#', dead: '.' } as CellCharset,
  /** Minimal dots */
  dots: { alive: '\u2022', dead: ' ' } as CellCharset,
  /** Box drawing */
  box: { alive: '\u25A0', dead: '\u25A1' } as CellCharset,
} as const;

/**
 * Border style for grid rendering.
 */
export interface BorderStyle {
  readonly topLeft: string;
  readonly topRight: string;
  readonly bottomLeft: string;
  readonly bottomRight: string;
  readonly horizontal: string;
  readonly vertical: string;
}

/**
 * Predefined border styles.
 */
export const BORDERS = {
  /** Single line box drawing */
  single: {
    topLeft: '\u250C',
    topRight: '\u2510',
    bottomLeft: '\u2514',
    bottomRight: '\u2518',
    horizontal: '\u2500',
    vertical: '\u2502',
  } as BorderStyle,
  /** Double line box drawing */
  double: {
    topLeft: '\u2554',
    topRight: '\u2557',
    bottomLeft: '\u255A',
    bottomRight: '\u255D',
    horizontal: '\u2550',
    vertical: '\u2551',
  } as BorderStyle,
  /** ASCII border */
  ascii: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
  } as BorderStyle,
  /** No border */
  none: {
    topLeft: '',
    topRight: '',
    bottomLeft: '',
    bottomRight: '',
    horizontal: '',
    vertical: '',
  } as BorderStyle,
} as const;

/**
 * Options for rendering a single grid.
 */
export interface RenderOptions {
  /** Character set for cells */
  readonly charset?: CellCharset;
  /** Border style */
  readonly border?: BorderStyle;
  /** Show border around grid */
  readonly showBorder?: boolean;
  /** Add spacing between cells */
  readonly cellSpacing?: boolean;
  /** Maximum width in characters (truncates if exceeded) */
  readonly maxWidth?: number;
  /** Maximum height in rows (truncates if exceeded) */
  readonly maxHeight?: number;
}

/**
 * Options for rendering ND grids.
 */
export interface SliceRenderOptions extends RenderOptions {
  /** First axis to display (default: 0) */
  readonly axis1?: number;
  /** Second axis to display (default: 1) */
  readonly axis2?: number;
  /** Fixed coordinates for other dimensions */
  readonly fixedCoords?: Map<number, number>;
}

/**
 * A captured frame for visualization.
 */
export interface VisualizationFrame {
  /** Step number (0 for initial state) */
  readonly step: number;
  /** Grid state at this step */
  readonly grid: Grid;
  /** Metrics at this step (if available) */
  readonly metrics?: Metrics | EnhancedMetrics;
}

/**
 * Options for snapshot visualization.
 */
export interface SnapshotVisualizationOptions extends SliceRenderOptions {
  /** Show metrics below each frame */
  readonly showMetrics?: boolean;
  /** Show step number header */
  readonly showStepHeader?: boolean;
  /** Number of frames per row (for side-by-side display) */
  readonly framesPerRow?: number;
  /** Gap between frames when showing side-by-side */
  readonly frameGap?: number;
}

/**
 * Result from running experiment with visualization frames.
 */
export interface VisualizationResult {
  /** Captured frames at specified intervals */
  readonly frames: VisualizationFrame[];
  /** Final outcome */
  readonly outcome: string;
  /** Final population */
  readonly finalPopulation: number;
}

/**
 * Options for animated visualization.
 */
export interface AnimationOptions extends SliceRenderOptions {
  /** Milliseconds between frames (default: 1500) */
  readonly frameDelayMs?: number;
  /** Show metrics below the grid */
  readonly showMetrics?: boolean;
  /** Show step counter and progress */
  readonly showProgress?: boolean;
  /** Clear screen between frames (default: true) */
  readonly clearScreen?: boolean;
  /** Callback when animation completes */
  readonly onComplete?: (result: AnimationResult) => void;
  /** Callback for each frame */
  readonly onFrame?: (frame: VisualizationFrame, frameIndex: number) => void;
}

/**
 * Result from animated visualization.
 */
export interface AnimationResult {
  /** Total steps executed */
  readonly totalSteps: number;
  /** Final outcome classification */
  readonly outcome: string;
  /** Final population count */
  readonly finalPopulation: number;
  /** Total animation duration in ms */
  readonly durationMs: number;
}

/**
 * Control handle for running animation.
 */
export interface AnimationController {
  /** Stop the animation early */
  stop: () => void;
  /** Pause the animation */
  pause: () => void;
  /** Resume paused animation */
  resume: () => void;
  /** Promise that resolves when animation completes */
  readonly done: Promise<AnimationResult>;
}
