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

import { CHARSETS, animate } from '../visualization/index.js';

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
  up: (n: number) => `\x1B[${n}A`,
  clearLine: '\x1B[2K',
};

interface MenuOption<T> {
  label: string;
  value: T;
}

interface Config {
  size: number;
  speed: number;
  density: number;
  rule: { birth: number[]; survival: number[] };
  ruleName: string;
  seed: number;
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
  { label: 'Normal (800ms)', value: 800 },
  { label: 'Fast (400ms)', value: 400 },
  { label: 'Turbo (150ms)', value: 150 },
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
    label: 'HighLife (B36/S23) - More chaos',
    value: { birth: [3, 6], survival: [2, 3], name: 'HighLife' },
  },
  {
    label: 'Day & Night (B3678/S34678)',
    value: { birth: [3, 6, 7, 8], survival: [3, 4, 6, 7, 8], name: 'Day & Night' },
  },
  { label: 'Seeds (B2/S) - Explosive', value: { birth: [2], survival: [], name: 'Seeds' } },
  {
    label: 'Life without Death (B3/S012345678)',
    value: { birth: [3], survival: [0, 1, 2, 3, 4, 5, 6, 7, 8], name: 'Life without Death' },
  },
  {
    label: 'Diamoeba (B35678/S5678)',
    value: { birth: [3, 5, 6, 7, 8], survival: [5, 6, 7, 8], name: 'Diamoeba' },
  },
  {
    label: 'Replicator (B1357/S1357)',
    value: { birth: [1, 3, 5, 7], survival: [1, 3, 5, 7], name: 'Replicator' },
  },
];

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
    writeln(`${ANSI.bold}${ANSI.cyan}╔════════════════════════════════════════╗${ANSI.reset}`);
    writeln(
      `${ANSI.bold}${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}${title.padEnd(36)}${ANSI.reset}  ${ANSI.cyan}║${ANSI.reset}`
    );
    writeln(`${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════╣${ANSI.reset}`);

    for (let i = 0; i < options.length; i++) {
      const prefix = i === selected ? `${ANSI.green}▸ ` : '  ';
      const style = i === selected ? ANSI.bold : ANSI.dim;
      writeln(
        `${ANSI.cyan}║${ANSI.reset} ${prefix}${style}${options[i]!.label.padEnd(35)}${ANSI.reset} ${ANSI.cyan}║${ANSI.reset}`
      );
    }

    writeln(`${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════╣${ANSI.reset}`);
    writeln(
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.dim}↑/↓ navigate  •  Enter select  •  q quit${ANSI.reset} ${ANSI.cyan}║${ANSI.reset}`
    );
    writeln(`${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════╝${ANSI.reset}`);
  };

  render();

  while (true) {
    const key = await readKey();

    if (key === '\x1B[A' || key === 'k') {
      // Up arrow or k
      selected = (selected - 1 + options.length) % options.length;
      render();
    } else if (key === '\x1B[B' || key === 'j') {
      // Down arrow or j
      selected = (selected + 1) % options.length;
      render();
    } else if (key === '\r' || key === '\n' || key === ' ') {
      // Enter or space
      return options[selected]!.value;
    } else if (key === 'q' || key === '\x03') {
      // q or Ctrl+C
      write(ANSI.clear);
      writeln('Bye! 👋');
      process.exit(0);
    }
  }
}

/**
 * Show summary and confirm.
 */
async function confirmStart(config: Config): Promise<boolean> {
  write(ANSI.clear);
  writeln(`${ANSI.bold}${ANSI.cyan}╔════════════════════════════════════════╗${ANSI.reset}`);
  writeln(
    `${ANSI.bold}${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Ready to Launch!                    ${ANSI.reset}  ${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(`${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════╣${ANSI.reset}`);
  writeln(
    `${`${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Grid:${ANSI.reset}     ${config.size}x${config.size}`.padEnd(
      49
    )}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${`${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Speed:${ANSI.reset}    ${config.speed}ms/frame`.padEnd(
      49
    )}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${`${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Density:${ANSI.reset}  ${(config.density * 100).toFixed(0)}%`.padEnd(
      49
    )}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${`${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Rule:${ANSI.reset}     ${config.ruleName}`.padEnd(
      49
    )}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(
    `${`${ANSI.cyan}║${ANSI.reset}  ${ANSI.yellow}Seed:${ANSI.reset}     ${config.seed}`.padEnd(49)}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(`${ANSI.bold}${ANSI.cyan}╠════════════════════════════════════════╣${ANSI.reset}`);
  writeln(
    `${ANSI.cyan}║${ANSI.reset}  ${ANSI.dim}Enter to start  •  r to reconfigure  •  q quit${ANSI.reset}${ANSI.cyan}║${ANSI.reset}`
  );
  writeln(`${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════╝${ANSI.reset}`);

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
      writeln('Bye! 👋');
      process.exit(0);
    }
  }
}

/**
 * Run the animation.
 */
async function runAnimation(config: Config): Promise<void> {
  write(ANSI.clear);

  const controller = animate(
    {
      dimensions: [config.size, config.size],
      neighborhood: { type: 'moore', range: 1 },
      rule: config.rule,
      steps: 1000, // Long run
      initialDensity: config.density,
      seed: config.seed,
    },
    {
      frameDelayMs: config.speed,
      charset: CHARSETS.blocks,
      showMetrics: true,
      showProgress: true,
    }
  );

  // Allow stopping with any key
  writeln(`${ANSI.dim}Press any key to stop...${ANSI.reset}\n`);

  const stopPromise = readKey().then(() => {
    controller.stop();
  });

  await Promise.race([controller.done, stopPromise]);
}

/**
 * Main menu loop.
 */
async function main(): Promise<void> {
  while (true) {
    const size = await selectMenu('Select Grid Size', SIZES, 2);
    const speed = await selectMenu('Select Speed', SPEEDS, 1);
    const density = await selectMenu('Select Initial Density', DENSITIES, 2);
    const ruleOption = await selectMenu('Select Rule', RULES, 0);

    const config: Config = {
      size,
      speed,
      density,
      rule: { birth: ruleOption.birth, survival: ruleOption.survival },
      ruleName: ruleOption.name,
      seed: Math.floor(Math.random() * 1000000),
    };

    const confirmed = await confirmStart(config);

    if (confirmed) {
      await runAnimation(config);

      // After animation, ask what to do
      write(ANSI.clear);
      const action = await selectMenu('What next?', [
        { label: 'Run again (same settings)', value: 'again' },
        { label: 'New configuration', value: 'new' },
        { label: 'Quit', value: 'quit' },
      ]);

      if (action === 'again') {
        config.seed = Math.floor(Math.random() * 1000000);
        await runAnimation(config);
      } else if (action === 'quit') {
        write(ANSI.clear);
        writeln('Thanks for playing! 🎮');
        process.exit(0);
      }
      // 'new' continues the loop
    }
    // If not confirmed, loop back to start
  }
}

// Run
main().catch(console.error);
