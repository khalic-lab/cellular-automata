# N-Dimensional Cellular Automata Engine

A zero-dependency TypeScript library for running cellular automata in arbitrary dimensions with an LLM-friendly JSON interface.

## Features

- **N-Dimensional**: Works in any number of dimensions (2D, 3D, 4D, ...)
- **Zero Dependencies**: Pure TypeScript with no external runtime dependencies
- **Deterministic**: Seeded random initialization for reproducible experiments
- **Efficient**: Flat array storage with stride-based indexing and double buffering
- **Type-Safe**: Strict TypeScript with comprehensive type definitions
- **Extensible**: Pluggable outcome classifiers and configurable metrics
- **LLM-Friendly**: JSON-serializable configuration and results

## Installation

```bash
bun install
bun run build
```

## Quick Start

```typescript
import { runExperiment } from './src/index.js';

const result = runExperiment({
  dimensions: [20, 20, 20, 20],
  neighborhood: { type: 'moore', range: 1 },
  rule: { birth: [4], survival: [4, 5] },
  steps: 100,
  initialDensity: 0.15,
  seed: 42
});

console.log(result.outcome);         // 'stable' | 'oscillating' | 'explosive' | 'extinct'
console.log(result.finalPopulation); // Final count of alive cells
console.log(result.metricsHistory);  // Evolution timeline
```

## Architecture

### Layered Design

The engine follows a **layered architecture** for computational libraries:

```
┌─────────────────────────────────────────┐
│   Application Layer                     │
│   - experiment.ts (orchestration)       │
│   - index.ts (public API)               │
└─────────────────────────────────────────┘
              ↓ uses
┌─────────────────────────────────────────┐
│   Analysis Layer                        │
│   - OutcomeClassifier (pluggable)       │
│   - slicer.ts (visualization support)   │
└─────────────────────────────────────────┘
              ↓ observes
┌─────────────────────────────────────────┐
│   Evolution Layer                       │
│   - stepper.ts (evolution engine)       │
│   - Metrics collection                  │
└─────────────────────────────────────────┘
              ↓ uses
┌─────────────────────────────────────────┐
│   Domain Layer                          │
│   - rule.ts (cellular automata logic)   │
│   - neighborhood.ts (topology)          │
└─────────────────────────────────────────┘
              ↓ operates on
┌─────────────────────────────────────────┐
│   Foundation Layer                      │
│   - grid.ts (state container)           │
│   - random.ts (deterministic init)      │
│   - types.ts (core definitions)         │
└─────────────────────────────────────────┘
```

**Key Principles:**
- **Separation of concerns**: Each layer has a distinct responsibility
- **Dependency flow**: Top-down only (no circular dependencies)
- **Foundation layer**: Pure data structures, no business logic
- **Domain layer**: CA-specific logic (rules, neighborhoods)
- **Evolution layer**: Time-stepping and observation
- **Analysis layer**: Post-processing and derived views
- **Application layer**: High-level workflows and public API

### Core Components

#### Grid (`grid.ts`)
N-dimensional state container with toroidal boundaries:
- Flat `Uint8Array` storage for efficiency
- Stride-based O(1) coordinate→index conversion
- Wrap-around boundaries eliminate edge cases

```typescript
const grid = createGrid([10, 10, 10]);  // 3D 10×10×10 grid
grid.set([5, 3, 7], 1);                 // Set cell alive
const state = grid.get([5, 3, 7]);      // Read cell state
```

#### Neighborhood (`neighborhood.ts`)
Topology generators for neighbor relationships:
- **Moore**: All cells within Chebyshev distance (includes diagonals)
- **von Neumann**: Cells within Manhattan distance (excludes diagonals)

```typescript
// 2D Moore (8 neighbors)
const moore2d = generateNeighborhood([10, 10], { type: 'moore', range: 1 });

// 3D von Neumann (6 neighbors)
const vonNeumann3d = generateNeighborhood([5, 5, 5], { type: 'von-neumann', range: 1 });
```

#### Rule (`rule.ts`)
Birth/survival rule evaluation:
- **Birth**: Neighbor counts causing dead→alive transitions
- **Survival**: Neighbor counts keeping alive cells alive
- Supports absolute and relative thresholds

```typescript
// Conway's Game of Life (B3/S23)
const rule = createRule([3], [2, 3], 8);

// Relative thresholds (30% and 40% of max neighbors)
const relativeRule = ruleFromThresholds(
  [{ relative: 0.3 }],
  [{ relative: 0.4 }],
  26
);
```

#### Stepper (`stepper.ts`)
Evolution engine with double buffering:
- Read from current grid, write to next grid
- Swap references (no copying)
- Configurable metrics collection interval

```typescript
const { finalGrid, metricsHistory } = evolve(
  grid,
  rule,
  neighborhood,
  100,    // steps
  10      // collect metrics every 10 steps
);
```

#### Experiment (`experiment.ts`)
High-level orchestration with outcome classification:
- Initializes grid with random density
- Runs evolution
- Classifies outcome (extinct/explosive/stable/oscillating)

```typescript
const result = runExperiment(config);
console.log(result.outcome);  // Classified result
```

## Configuration Format

### ExperimentConfig

```typescript
{
  dimensions: number[];              // e.g., [20, 20] for 2D, [10, 10, 10, 10] for 4D
  neighborhood: {
    type: 'moore' | 'von-neumann';
    range?: number;                  // Default: 1
  };
  rule: {
    birth: number[] | { relative: number }[];      // Uniform only
    survival: number[] | { relative: number }[];   // Uniform only
  };
  steps: number;                     // Evolution generations
  initialDensity: number;            // [0, 1] fraction of alive cells
  seed?: number;                     // Default: 42
  metricsInterval?: number;          // Default: 1 (every step)
}
```

### ExperimentResult

```typescript
{
  outcome: 'extinct' | 'explosive' | 'stable' | 'oscillating';
  finalPopulation: number;
  metricsHistory: Metrics[];
  config: ExperimentConfig;
}
```

## Examples

### 2D Conway's Game of Life

```typescript
const result = runExperiment({
  dimensions: [50, 50],
  neighborhood: { type: 'moore', range: 1 },
  rule: { birth: [3], survival: [2, 3] },
  steps: 200,
  initialDensity: 0.3,
  seed: 12345
});
```

### 3D Cellular Automata

```typescript
const result = runExperiment({
  dimensions: [20, 20, 20],
  neighborhood: { type: 'moore', range: 1 },
  rule: { birth: [4], survival: [4, 5] },
  steps: 100,
  initialDensity: 0.15
});
```

### 4D with Relative Thresholds

```typescript
const result = runExperiment({
  dimensions: [10, 10, 10, 10],
  neighborhood: { type: 'von-neumann', range: 1 },
  rule: {
    birth: [{ relative: 0.3 }],      // 30% of max neighbors
    survival: [{ relative: 0.4 }]    // 40% of max neighbors
  },
  steps: 50,
  initialDensity: 0.2
});
```

### Custom Outcome Classifier

```typescript
import { runExperiment, type OutcomeClassifier } from './src/index.js';

const myClassifier: OutcomeClassifier = (metrics) => {
  const final = metrics[metrics.length - 1];
  if (final.population === 0) return 'extinct';
  if (final.density > 0.9) return 'explosive';
  return 'stable';
};

const result = runExperiment(config, myClassifier);
```

### Visualization with Slicer

```typescript
import { extractSlice } from './src/index.js';

// Extract XY plane at z=5 from 3D grid
const slice = extractSlice(grid, {
  axis1: 0,  // X axis
  axis2: 1,  // Y axis
  fixedCoords: new Map([[2, 5]])  // Fix Z=5
});

// Now slice is a 2D array for visualization
for (const row of slice) {
  console.log(row.map(cell => cell ? '█' : '·').join(''));
}
```

## Performance Characteristics

- **Memory**: O(product of dimensions) for state storage
- **Initialization**: O(total cells) for random seeding
- **Evolution step**: O(total cells × neighbors) per generation
- **Metrics**: O(1) per collection (configurable interval)

### Benchmarks (Bun runtime)

| Dimensions | Total Cells | Steps | Time |
|------------|-------------|-------|------|
| [100, 100] | 10,000 | 100 | ~0.3s |
| [50, 50, 50] | 125,000 | 100 | ~4.5s |
| [20, 20, 20, 20] | 160,000 | 100 | ~5.8s |

## Technical Decisions

1. **Functional-first design**: Pure functions where possible, pragmatic mutations for performance
2. **Flat Uint8Array with strides**: Efficient memory, cache-friendly access
3. **Precomputed neighborhoods**: O(1) neighbor lookup per cell
4. **Double buffering**: Clean separation of read/write phases (swap references)
5. **Uniform thresholds**: Either all absolute OR all relative (not mixed)
6. **Totalistic rules**: Count-based (not positional) for simplicity
7. **Hash-based oscillation detection**: Default classifier, pluggable via function interface
8. **Configurable metrics sampling**: Balance between detail and performance
9. **Minimal classes**: Only Grid (encapsulates ND indexing), rest are functions
10. **No rendering**: Engine only, consumers handle visualization

## Development

```bash
# Install dependencies
bun install

# Build TypeScript
bun run build

# Run test example
bun test-example.ts
```

## License

MIT
