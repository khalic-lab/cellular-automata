/**
 * Tests for terminal visualization module.
 */

import { describe, it, expect } from 'vitest';
import {
  render2DArray,
  renderGrid2D,
  renderGridSlice,
  formatMetrics,
  renderFrame,
  renderFramesSideBySide,
  renderFramesStacked,
  runWithSnapshots,
  CHARSETS,
  BORDERS,
} from '../visualization/index.js';
import { createGrid } from '../grid.js';
import type { EnhancedMetrics } from '../types.js';
import type { VisualizationFrame } from '../visualization/types.js';

describe('render2DArray', () => {
  it('renders empty grid message', () => {
    const result = render2DArray([]);
    expect(result).toBe('(empty grid)');
  });

  it('renders simple 2D array with default charset', () => {
    const data = [
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ];
    const result = render2DArray(data);

    // Should have border characters and content
    expect(result).toContain(CHARSETS.blocks.alive);
    expect(result).toContain(CHARSETS.blocks.dead);
    expect(result).toContain(BORDERS.single.topLeft);
    expect(result).toContain(BORDERS.single.bottomRight);
  });

  it('renders with ASCII charset', () => {
    const data = [
      [1, 1],
      [0, 0],
    ];
    const result = render2DArray(data, { charset: CHARSETS.ascii });

    expect(result).toContain('#');
    expect(result).toContain('.');
  });

  it('renders without border', () => {
    const data = [
      [1, 0],
      [0, 1],
    ];
    const result = render2DArray(data, { showBorder: false });

    // Should not contain border characters
    expect(result).not.toContain(BORDERS.single.topLeft);
    expect(result).not.toContain(BORDERS.single.vertical);
  });

  it('renders with cell spacing', () => {
    const data = [
      [1, 0, 1],
    ];
    const result = render2DArray(data, {
      charset: CHARSETS.ascii,
      cellSpacing: true,
      showBorder: false,
    });

    expect(result).toBe('# . #');
  });

  it('truncates to maxWidth', () => {
    const data = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];
    const result = render2DArray(data, {
      charset: CHARSETS.ascii,
      showBorder: false,
      maxWidth: 3,
    });

    expect(result).toBe('###');
  });

  it('truncates to maxHeight', () => {
    const data = [
      [1],
      [1],
      [1],
      [1],
      [1],
    ];
    const result = render2DArray(data, {
      charset: CHARSETS.ascii,
      showBorder: false,
      maxHeight: 2,
    });

    expect(result).toBe('#\n#');
  });

  it('renders with double border', () => {
    const data = [[1]];
    const result = render2DArray(data, { border: BORDERS.double });

    expect(result).toContain(BORDERS.double.topLeft);
    expect(result).toContain(BORDERS.double.horizontal);
  });
});

describe('renderGrid2D', () => {
  it('renders 2D grid correctly', () => {
    const grid = createGrid([3, 3]);
    grid.set([0, 0], 1);
    grid.set([1, 1], 1);
    grid.set([2, 2], 1);

    const result = renderGrid2D(grid, { charset: CHARSETS.ascii, showBorder: false });
    const lines = result.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('#..');
    expect(lines[1]).toBe('.#.');
    expect(lines[2]).toBe('..#');
  });

  it('throws for non-2D grid', () => {
    const grid = createGrid([3, 3, 3]);
    expect(() => renderGrid2D(grid)).toThrow('requires 2D grid');
  });
});

describe('renderGridSlice', () => {
  it('renders 2D grid directly', () => {
    const grid = createGrid([2, 2]);
    grid.set([0, 0], 1);
    grid.set([1, 1], 1);

    const result = renderGridSlice(grid, { charset: CHARSETS.ascii, showBorder: false });
    const lines = result.split('\n');

    expect(lines[0]).toBe('#.');
    expect(lines[1]).toBe('.#');
  });

  it('renders 3D grid slice', () => {
    const grid = createGrid([3, 3, 3]);
    // Set cells at z=1
    grid.set([0, 0, 1], 1);
    grid.set([1, 1, 1], 1);
    grid.set([2, 2, 1], 1);

    // Extract XY slice at z=1
    const result = renderGridSlice(grid, {
      axis1: 0,
      axis2: 1,
      fixedCoords: new Map([[2, 1]]),
      charset: CHARSETS.ascii,
      showBorder: false,
    });

    const lines = result.split('\n');
    expect(lines[0]).toBe('#..');
    expect(lines[1]).toBe('.#.');
    expect(lines[2]).toBe('..#');
  });
});

describe('formatMetrics', () => {
  it('formats basic metrics', () => {
    const metrics: EnhancedMetrics = {
      population: 100,
      density: 0.25,
      births: 10,
      deaths: 5,
      delta: 5,
      step: 10,
      entropy: 0.8,
      stateHash: 123456,
    };

    const result = formatMetrics(metrics);

    expect(result).toContain('Pop: 100');
    expect(result).toContain('Density: 0.250');
    expect(result).toContain('Delta: +5');
    expect(result).toContain('Entropy: 0.800');
  });

  it('formats negative delta', () => {
    const metrics: EnhancedMetrics = {
      population: 50,
      density: 0.125,
      births: 2,
      deaths: 10,
      delta: -8,
      step: 5,
      entropy: 0.5,
      stateHash: 0,
    };

    const result = formatMetrics(metrics);
    expect(result).toContain('Delta: -8');
  });
});

describe('renderFrame', () => {
  it('renders frame with header and metrics', () => {
    const grid = createGrid([2, 2]);
    grid.set([0, 0], 1);

    const frame: VisualizationFrame = {
      step: 10,
      grid,
      metrics: {
        population: 1,
        density: 0.25,
        births: 0,
        deaths: 0,
        delta: 0,
        step: 10,
        entropy: 0,
        stateHash: 0,
      },
    };

    const result = renderFrame(frame, {
      charset: CHARSETS.ascii,
      showBorder: false,
    });

    expect(result).toContain('Step 10');
    expect(result).toContain('Pop: 1');
  });

  it('renders frame without header', () => {
    const grid = createGrid([2, 2]);
    const frame: VisualizationFrame = { step: 5, grid };

    const result = renderFrame(frame, {
      showStepHeader: false,
      showMetrics: false,
      charset: CHARSETS.ascii,
      showBorder: false,
    });

    expect(result).not.toContain('Step');
  });
});

describe('renderFramesSideBySide', () => {
  it('renders multiple frames horizontally', () => {
    const grid1 = createGrid([2, 2]);
    grid1.set([0, 0], 1);

    const grid2 = createGrid([2, 2]);
    grid2.set([1, 1], 1);

    const frames: VisualizationFrame[] = [
      { step: 0, grid: grid1 },
      { step: 10, grid: grid2 },
    ];

    const result = renderFramesSideBySide(frames, {
      charset: CHARSETS.ascii,
      showMetrics: false,
      frameGap: 2,
    });

    // Both frames should be on same lines
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(0);

    // Should contain both step headers
    expect(result).toContain('Step 0');
    expect(result).toContain('Step 10');
  });

  it('handles empty frames array', () => {
    const result = renderFramesSideBySide([]);
    expect(result).toBe('(no frames)');
  });
});

describe('renderFramesStacked', () => {
  it('renders multiple frames vertically', () => {
    const grid1 = createGrid([2, 2]);
    const grid2 = createGrid([2, 2]);

    const frames: VisualizationFrame[] = [
      { step: 0, grid: grid1 },
      { step: 5, grid: grid2 },
    ];

    const result = renderFramesStacked(frames, {
      charset: CHARSETS.ascii,
      showMetrics: false,
    });

    expect(result).toContain('Step 0');
    expect(result).toContain('Step 5');
    // Stacked means separated by double newline
    expect(result).toContain('\n\n');
  });

  it('handles empty frames array', () => {
    const result = renderFramesStacked([]);
    expect(result).toBe('(no frames)');
  });
});

describe('runWithSnapshots', () => {
  it('captures initial and final frames when interval is 0', () => {
    const result = runWithSnapshots({
      dimensions: [5, 5],
      neighborhood: { type: 'moore', range: 1 },
      rule: { birth: [3], survival: [2, 3] },
      steps: 10,
      initialDensity: 0.3,
      seed: 42,
    }, 0);

    // Should have exactly 2 frames: initial and final
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0]!.step).toBe(0);
    expect(result.frames[1]!.step).toBe(10);
  });

  it('captures frames at specified intervals', () => {
    const result = runWithSnapshots({
      dimensions: [5, 5],
      neighborhood: { type: 'moore', range: 1 },
      rule: { birth: [3], survival: [2, 3] },
      steps: 20,
      initialDensity: 0.3,
      seed: 42,
    }, 5);

    // Should have: step 0, 5, 10, 15, 20
    expect(result.frames).toHaveLength(5);
    expect(result.frames.map(f => f.step)).toEqual([0, 5, 10, 15, 20]);
  });

  it('includes metrics in frames', () => {
    const result = runWithSnapshots({
      dimensions: [5, 5],
      neighborhood: { type: 'moore', range: 1 },
      rule: { birth: [3], survival: [2, 3] },
      steps: 5,
      initialDensity: 0.3,
      seed: 42,
    }, 0);

    for (const frame of result.frames) {
      expect(frame.metrics).toBeDefined();
      expect(frame.metrics!.population).toBeGreaterThanOrEqual(0);
      expect(frame.metrics!.density).toBeGreaterThanOrEqual(0);
    }
  });

  it('detects extinction', () => {
    // Very low density with survival-heavy rule tends to extinction
    const result = runWithSnapshots({
      dimensions: [5, 5],
      neighborhood: { type: 'moore', range: 1 },
      rule: { birth: [5, 6, 7, 8], survival: [] }, // Impossible to survive
      steps: 10,
      initialDensity: 0.1,
      seed: 42,
    }, 0);

    expect(result.finalPopulation).toBe(0);
    expect(result.outcome).toBe('extinct');
  });

  it('is deterministic with same seed', () => {
    const config = {
      dimensions: [10, 10],
      neighborhood: { type: 'moore' as const, range: 1 },
      rule: { birth: [3], survival: [2, 3] },
      steps: 20,
      initialDensity: 0.3,
      seed: 12345,
    };

    const result1 = runWithSnapshots(config, 5);
    const result2 = runWithSnapshots(config, 5);

    expect(result1.finalPopulation).toBe(result2.finalPopulation);
    expect(result1.frames.length).toBe(result2.frames.length);

    for (let i = 0; i < result1.frames.length; i++) {
      expect(result1.frames[i]!.metrics!.population).toBe(
        result2.frames[i]!.metrics!.population
      );
    }
  });
});

describe('CHARSETS', () => {
  it('has expected character sets', () => {
    expect(CHARSETS.blocks.alive).toBeDefined();
    expect(CHARSETS.blocks.dead).toBeDefined();
    expect(CHARSETS.ascii.alive).toBe('#');
    expect(CHARSETS.ascii.dead).toBe('.');
    expect(CHARSETS.dots).toBeDefined();
    expect(CHARSETS.box).toBeDefined();
  });
});

describe('BORDERS', () => {
  it('has expected border styles', () => {
    expect(BORDERS.single.topLeft).toBeDefined();
    expect(BORDERS.double.topLeft).toBeDefined();
    expect(BORDERS.ascii.topLeft).toBe('+');
    expect(BORDERS.none.topLeft).toBe('');
  });
});

describe('3D visualization', () => {
  it('renders 3D grid slice correctly', () => {
    const grid = createGrid([4, 4, 4]);

    // Create a "cross" pattern at z=2
    grid.set([1, 2, 2], 1);
    grid.set([2, 1, 2], 1);
    grid.set([2, 2, 2], 1);
    grid.set([2, 3, 2], 1);
    grid.set([3, 2, 2], 1);

    const result = renderGridSlice(grid, {
      axis1: 0,
      axis2: 1,
      fixedCoords: new Map([[2, 2]]),
      charset: CHARSETS.ascii,
      showBorder: false,
    });

    const lines = result.split('\n');
    expect(lines).toHaveLength(4);

    // Check the cross pattern: cells at [1,2], [2,1], [2,2], [2,3], [3,2]
    expect(lines[1]).toBe('..#.'); // Row 1: cell at col 2
    expect(lines[2]).toBe('.###'); // Row 2: cells at cols 1,2,3
  });

  it('runs 3D experiment with snapshots', () => {
    const result = runWithSnapshots({
      dimensions: [5, 5, 5],
      neighborhood: { type: 'moore', range: 1 },
      rule: { birth: [5, 6], survival: [4, 5, 6] },
      steps: 10,
      initialDensity: 0.15,
      seed: 42,
    }, 5);

    expect(result.frames.length).toBeGreaterThanOrEqual(2);
    expect(result.frames[0]!.grid.dimensions).toEqual([5, 5, 5]);
  });
});
