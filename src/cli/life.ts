#!/usr/bin/env bun
/**
 * Interactive CLI for cellular automata visualization.
 */

// Node.js globals for CLI
interface Buffer {
  toString: () => string;
}
declare const process: {
  stdout: { write: (s: string) => void };
  stdin: {
    setRawMode: (mode: boolean) => void;
    resume: () => void;
    pause: () => void;
    once: (event: string, cb: (data: Buffer) => void) => void;
  };
  exit: (code: number) => void;
};
declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

import { type Grid, createGrid } from '../grid.js';
import { generateNeighborhood, getMaxNeighbors } from '../neighborhood.js';
import { ruleFromThresholds, shouldCellBeAlive } from '../rule.js';
import type { Rule } from '../types.js';
import { CHARSETS, formatMetrics, renderGridSlice } from '../visualization/index.js';
import patternsData from './patterns.json';

// Timer
declare function setTimeout(callback: () => void, ms: number): number;

// Terminal helpers
const write = (s: string) => process.stdout.write(s);
const writeln = (s: string) => console.log(s);

const ANSI = {
  clear: '\x1B[2J\x1B[H',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  reset: '\x1B[0m',
  green: '\x1B[32m',
  cyan: '\x1B[36m',
  yellow: '\x1B[33m',
  magenta: '\x1B[35m',
  hideCursor: '\x1B[?25l',
  showCursor: '\x1B[?25h',
};

interface MenuOption<T> {
  label: string;
  value: T;
}

interface PatternDef {
  name: string;
  description: string;
  author?: string;
  period?: number;
  minGrid: number;
  cells: number[][];
}

interface Config {
  size: number;
  speed: number;
  density: number;
  rule: { birth: number[]; survival: number[] };
  ruleName: string;
  seed: number;
  pattern?: PatternDef;
}

// Predefined options
const SIZES: MenuOption<number>[] = [
  { label: '30x30 (small)', value: 30 },
  { label: '50x50 (medium)', value: 50 },
  { label: '80x80 (large)', value: 80 },
  { label: '100x100 (huge)', value: 100 },
  { label: '150x150 (massive)', value: 150 },
];

const SPEEDS: MenuOption<number>[] = [
  { label: 'Slow (1.5s)', value: 1500 },
  { label: 'Normal (500ms)', value: 500 },
  { label: 'Fast (200ms)', value: 200 },
  { label: 'Turbo (100ms)', value: 100 },
  { label: 'Ludicrous (50ms)', value: 50 },
];

const DENSITIES: MenuOption<number>[] = [
  { label: 'Sparse (10%)', value: 0.1 },
  { label: 'Light (20%)', value: 0.2 },
  { label: 'Medium (30%)', value: 0.3 },
  { label: 'Dense (40%)', value: 0.4 },
  { label: 'Packed (50%)', value: 0.5 },
];

const RULES: MenuOption<{ birth: number[]; survival: number[]; name: string }>[] = [
  { label: 'Conway (B3/S23) - Classic', value: { birth: [3], survival: [2, 3], name: 'Conway' } },
  {
    label: 'HighLife (B36/S23) - More action',
    value: { birth: [3, 6], survival: [2, 3], name: 'HighLife' },
  },
  {
    label: 'Day & Night (B3678/S34678)',
    value: { birth: [3, 6, 7, 8], survival: [3, 4, 6, 7, 8], name: 'Day & Night' },
  },
  { label: 'Seeds (B2/S) - Explosive', value: { birth: [2], survival: [], name: 'Seeds' } },
  {
    label: 'Diamoeba (B35678/S5678)',
    value: { birth: [3, 5, 6, 7, 8], survival: [5, 6, 7, 8], name: 'Diamoeba' },
  },
];

// Load patterns from JSON
function getPatternCategories(): MenuOption<string>[] {
  return [
    { label: 'Still Lifes - Stable patterns', value: 'still-lifes' },
    { label: 'Oscillators - Repeating patterns', value: 'oscillators' },
    { label: 'Spaceships - Moving patterns', value: 'spaceships' },
    { label: 'Methuselahs - Long-lived chaos', value: 'methuselahs' },
    { label: 'Guns - Pattern emitters', value: 'guns' },
    { label: 'Other - Special patterns', value: 'other' },
  ];
}

function getPatternsInCategory(category: string): MenuOption<PatternDef>[] {
  const patterns = (patternsData.patterns as Record<string, PatternDef[]>)[category] ?? [];
  return patterns.map((p) => ({
    label: `${p.name} - ${p.description}`,
    value: p,
  }));
}

/**
 * Read a single keypress.
 */
async function readKey(): Promise<string> {
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(data.toString());
    });
  });
}

/**
 * Display a menu and get selection.
 */
async function selectMenu<T>(
  title: string,
  options: MenuOption<T>[],
  defaultIndex = 0
): Promise<T> {
  let selected = defaultIndex;

  const render = () => {
    write(ANSI.clear);
    writeln(
      `${ANSI.bold}${ANSI.cyan}╔════════════════════════════════════════════════════╗${ANSI.reset}`
    );
    writeln(
      `${ANSI.bold}${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}${title.padEnd(48)}${ANSI.reset}  ${ANSI.cyan}║${ANSI.reset}`
    );
    writeln(
      `${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════════════════╣${ANSI.reset}`
    );

    for (let i = 0; i < options.length; i++) {
      const prefix = i === selected ? `${ANSI.green}▸ ` : '  ';
      const style = i === selected ? ANSI.bold : ANSI.dim;
      const label =
        options[i]!.label.length > 47 ? `${options[i]!.label.slice(0, 44)}...` : options[i]!.label;
      writeln(
        `${ANSI.cyan}║${ANSI.reset} ${prefix}${style}${label.padEnd(47)}${ANSI.reset} ${ANSI.cyan}║${ANSI.reset}`
      );
    }

    writeln(
      `${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════════════════╣${ANSI.reset}`
    );
    writeln(
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.dim}↑/↓ navigate  •  Enter select  •  q quit${ANSI.reset}         ${ANSI.cyan}║${ANSI.reset}`
    );
    writeln(
      `${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════════════════╝${ANSI.reset}`
    );
  };

  render();

  while (true) {
    const key = await readKey();

    if (key === '\x1B[A' || key === 'k') {
      selected = (selected - 1 + options.length) % options.length;
      render();
    } else if (key === '\x1B[B' || key === 'j') {
      selected = (selected + 1) % options.length;
      render();
    } else if (key === '\r' || key === '\n' || key === ' ') {
      return options[selected]!.value;
    } else if (key === 'q' || key === '\x03') {
      write(ANSI.clear);
      writeln('Bye!');
      process.exit(0);
    }
  }
}

/**
 * Show summary and confirm.
 */
async function confirmStart(config: Config): Promise<boolean> {
  write(ANSI.clear);
  writeln(
    `${ANSI.bold}${ANSI.cyan}╔════════════════════════════════════════════════════╗${ANSI.reset}`
  );
  writeln(
    `${ANSI.bold}${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Ready to Launch!                                  ${ANSI.reset}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════════════════╣${ANSI.reset}`
  );
  writeln(
    `${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Grid:${ANSI.reset}     ${`${config.size}x${config.size}`.padEnd(40)}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Speed:${ANSI.reset}    ${`${config.speed}ms/frame`.padEnd(40)}${ANSI.cyan}║${ANSI.reset}`
  );
  if (config.pattern) {
    writeln(
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Pattern:${ANSI.reset}  ${config.pattern.name.padEnd(40)}${ANSI.cyan}║${ANSI.reset}`
    );
  } else {
    writeln(
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Density:${ANSI.reset}  ${`${(config.density * 100).toFixed(0)}%`.padEnd(40)}${ANSI.cyan}║${ANSI.reset}`
    );
  }
  writeln(
    `${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Rule:${ANSI.reset}     ${config.ruleName.padEnd(40)}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════════════════╣${ANSI.reset}`
  );
  writeln(
    `${ANSI.cyan}║${ANSI.reset}  ${ANSI.dim}Enter to start  •  r reconfigure  •  q quit${ANSI.reset}       ${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════════════════╝${ANSI.reset}`
  );

  while (true) {
    const key = await readKey();
    if (key === '\r' || key === '\n' || key === ' ') {
      return true;
    }
    if (key === 'r') {
      return false;
    }
    if (key === 'q' || key === '\x03') {
      write(ANSI.clear);
      writeln('Bye!');
      process.exit(0);
    }
  }
}

// ============================================================================
// Grid Evolution (inline for demo mode)
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface StepperState {
  currentGrid: Grid;
  nextGrid: Grid;
  stepCount: number;
}

function createStepper(initialGrid: Grid): StepperState {
  return {
    currentGrid: initialGrid.clone(),
    nextGrid: initialGrid.clone(),
    stepCount: 0,
  };
}

function countNeighbors(grid: Grid, coord: number[], neighborhood: number[][]): number {
  let count = 0;
  for (const offset of neighborhood) {
    const neighborCoord = coord.map((c, i) => c + offset[i]!);
    const wrapped = grid.wrap(neighborCoord);
    count += grid.get(wrapped);
  }
  return count;
}

function stepGrid(state: StepperState, rule: Rule, neighborhood: number[][]): StepperState {
  const { currentGrid, nextGrid } = state;

  for (let y = 0; y < currentGrid.dimensions[0]!; y++) {
    for (let x = 0; x < currentGrid.dimensions[1]!; x++) {
      const coord = [y, x];
      const currentState = currentGrid.get(coord);
      const neighborCount = countNeighbors(currentGrid, coord, neighborhood);
      const nextState = shouldCellBeAlive(rule, currentState, neighborCount);
      nextGrid.set(coord, nextState ? 1 : 0);
    }
  }

  return {
    currentGrid: nextGrid,
    nextGrid: currentGrid,
    stepCount: state.stepCount + 1,
  };
}

// ============================================================================
// Animation
// ============================================================================

async function runAnimation(config: Config): Promise<void> {
  write(ANSI.clear);
  write(ANSI.hideCursor);

  // Setup grid
  const grid = createGrid([config.size, config.size]);

  if (config.pattern) {
    // Place pattern in center
    const offsetY = Math.floor(config.size / 2) - 5;
    const offsetX = Math.floor(config.size / 2) - 5;
    for (const cell of config.pattern.cells) {
      const y = cell[0]!;
      const x = cell[1]!;
      const ny = (offsetY + y + config.size) % config.size;
      const nx = (offsetX + x + config.size) % config.size;
      grid.set([ny, nx], 1);
    }
  } else {
    // Random initialization
    const rng = () => Math.random();
    for (let y = 0; y < config.size; y++) {
      for (let x = 0; x < config.size; x++) {
        if (rng() < config.density) {
          grid.set([y, x], 1);
        }
      }
    }
  }

  const neighborhood = generateNeighborhood([config.size, config.size], {
    type: 'moore',
    range: 1,
  });
  const maxNeighbors = getMaxNeighbors([config.size, config.size], 'moore', 1);
  const rule = ruleFromThresholds(config.rule.birth, config.rule.survival, maxNeighbors);

  let state = createStepper(grid);
  let stopped = false;
  let previousPop = state.currentGrid.countPopulation();

  // Setup key listener for stopping
  const stopPromise = readKey().then(() => {
    stopped = true;
  });

  const startTime = Date.now();

  // Animation loop
  for (let step = 0; step < 10000 && !stopped; step++) {
    const population = state.currentGrid.countPopulation();
    const delta = population - previousPop;
    previousPop = population;

    // Render
    write(ANSI.clear);
    const patternInfo = config.pattern ? ` | Pattern: ${config.pattern.name}` : '';
    writeln(`${ANSI.bold}Step ${step}${ANSI.reset} | ${config.ruleName}${patternInfo}`);
    writeln('');
    writeln(renderGridSlice(state.currentGrid, { charset: CHARSETS.blocks, showBorder: true }));
    writeln('');
    writeln(
      formatMetrics({
        population,
        density: population / (config.size * config.size),
        delta,
        births: Math.max(0, delta),
        deaths: Math.max(0, -delta),
        step,
      })
    );
    writeln('');
    writeln(`${ANSI.dim}Press any key to stop...${ANSI.reset}`);

    // Check for extinction
    if (population === 0) {
      writeln(`${ANSI.yellow}Extinction at step ${step}!${ANSI.reset}`);
      break;
    }

    // Evolve
    state = stepGrid(state, rule, neighborhood);

    // Wait or check for stop
    await Promise.race([sleep(config.speed), stopPromise]);
  }

  write(ANSI.showCursor);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  writeln('');
  writeln(`${ANSI.bold}${ANSI.cyan}────────────────────────────────────────${ANSI.reset}`);
  writeln(`Animation ended after ${state.stepCount} steps (${elapsed}s)`);
  writeln(`Final population: ${state.currentGrid.countPopulation()}`);
  writeln(`${ANSI.bold}${ANSI.cyan}────────────────────────────────────────${ANSI.reset}`);
  writeln('');
  writeln(`${ANSI.dim}Press any key to continue...${ANSI.reset}`);

  await readKey();
}

// ============================================================================
// Main Menu
// ============================================================================

async function main(): Promise<void> {
  while (true) {
    // Main mode selection
    const mode = await selectMenu('Game of Life', [
      { label: 'Random Soup - Random initial cells', value: 'random' },
      { label: 'Pattern Demo - Classic patterns', value: 'demo' },
    ]);

    let config: Config;

    if (mode === 'demo') {
      // Pattern demo mode
      const category = await selectMenu('Select Pattern Category', getPatternCategories());
      const patterns = getPatternsInCategory(category);

      if (patterns.length === 0) {
        writeln('No patterns in this category!');
        continue;
      }

      const pattern = await selectMenu('Select Pattern', patterns);
      const minSize = Math.max(pattern.minGrid, 30);
      const sizeOptions = SIZES.filter((s) => s.value >= minSize);

      const size = await selectMenu('Select Grid Size', sizeOptions);
      const speed = await selectMenu('Select Speed', SPEEDS, 1);

      config = {
        size,
        speed,
        density: 0,
        rule: { birth: [3], survival: [2, 3] },
        ruleName: 'Conway (B3/S23)',
        seed: 0,
        pattern,
      };
    } else {
      // Random soup mode
      const size = await selectMenu('Select Grid Size', SIZES, 2);
      const speed = await selectMenu('Select Speed', SPEEDS, 1);
      const density = await selectMenu('Select Initial Density', DENSITIES, 2);
      const ruleOption = await selectMenu('Select Rule', RULES, 0);

      config = {
        size,
        speed,
        density,
        rule: { birth: ruleOption.birth, survival: ruleOption.survival },
        ruleName: ruleOption.name,
        seed: Math.floor(Math.random() * 1000000),
      };
    }

    const confirmed = await confirmStart(config);

    if (confirmed) {
      await runAnimation(config);
    }
  }
}

// Run
main().catch(console.error);
