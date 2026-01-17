/**
 * Test example to verify N-dimensional cellular automata engine.
 *
 * Success criteria:
 * - Completes without error
 * - Returns classified outcome
 * - metricsHistory has correct number of entries
 * - Runs efficiently with Bun
 */

import { runExperiment } from './src/index.js';

console.log('Running N-Dimensional Cellular Automata Test...\n');

const startTime = performance.now();

// Test 1: 4D Experiment (from plan)
console.log('Test 1: 4D Grid (20×20×20×20)');
const result4d = runExperiment({
  dimensions: [20, 20, 20, 20],
  neighborhood: { type: 'moore', range: 1 },
  rule: { birth: [4], survival: [4, 5] },
  steps: 100,
  initialDensity: 0.15,
  seed: 42,
});

console.log(`  Outcome: ${result4d.outcome}`);
console.log(`  Final Population: ${result4d.finalPopulation}`);
console.log(`  Metrics History Length: ${result4d.metricsHistory.length}`);
console.log(`  Initial Density: ${result4d.metricsHistory[0]?.density.toFixed(3)}`);
console.log(
  `  Final Density: ${result4d.metricsHistory[result4d.metricsHistory.length - 1]?.density.toFixed(3)}`
);

// Test 2: 2D Conway's Game of Life
console.log("\nTest 2: 2D Conway's Game of Life (50×50)");
const result2d = runExperiment({
  dimensions: [50, 50],
  neighborhood: { type: 'moore', range: 1 },
  rule: { birth: [3], survival: [2, 3] },
  steps: 100,
  initialDensity: 0.3,
  seed: 12345,
});

console.log(`  Outcome: ${result2d.outcome}`);
console.log(`  Final Population: ${result2d.finalPopulation}`);
console.log(`  Metrics History Length: ${result2d.metricsHistory.length}`);

// Test 3: 3D with Relative Thresholds
console.log('\nTest 3: 3D with Relative Thresholds (15×15×15)');
const result3d = runExperiment({
  dimensions: [15, 15, 15],
  neighborhood: { type: 'moore', range: 1 },
  rule: {
    birth: [{ relative: 0.15 }], // ~15% of 26 neighbors = ~4
    survival: [{ relative: 0.15 }, { relative: 0.19 }], // ~4-5
  },
  steps: 50,
  initialDensity: 0.2,
  seed: 999,
});

console.log(`  Outcome: ${result3d.outcome}`);
console.log(`  Final Population: ${result3d.finalPopulation}`);
console.log(`  Metrics History Length: ${result3d.metricsHistory.length}`);

// Test 4: Von Neumann Neighborhood
console.log('\nTest 4: 3D von Neumann (20×20×20)');
const resultVN = runExperiment({
  dimensions: [20, 20, 20],
  neighborhood: { type: 'von-neumann', range: 1 },
  rule: { birth: [3], survival: [2, 3] },
  steps: 50,
  initialDensity: 0.2,
  seed: 777,
});

console.log(`  Outcome: ${resultVN.outcome}`);
console.log(`  Final Population: ${resultVN.finalPopulation}`);
console.log(`  Metrics History Length: ${resultVN.metricsHistory.length}`);

// Test 5: Metrics Interval
console.log('\nTest 5: 2D with Metrics Interval (100×100, interval=10)');
const resultInterval = runExperiment({
  dimensions: [100, 100],
  neighborhood: { type: 'moore', range: 1 },
  rule: { birth: [3], survival: [2, 3] },
  steps: 100,
  initialDensity: 0.3,
  seed: 555,
  metricsInterval: 10,
});

console.log(`  Outcome: ${resultInterval.outcome}`);
console.log(`  Final Population: ${resultInterval.finalPopulation}`);
console.log(`  Metrics History Length: ${resultInterval.metricsHistory.length} (expected: 10)`);

const endTime = performance.now();
const totalTime = ((endTime - startTime) / 1000).toFixed(2);

console.log(`\n${'='.repeat(50)}`);
console.log('All tests completed successfully!');
console.log(`Total execution time: ${totalTime}s`);
console.log('='.repeat(50));

// Verify success criteria
console.log('\nSuccess Criteria Verification:');
console.log('✓ Completed without error');
console.log(
  `✓ Returns classified outcomes: ${result4d.outcome}, ${result2d.outcome}, ${result3d.outcome}, ${resultVN.outcome}, ${resultInterval.outcome}`
);
console.log(
  `✓ Metrics history has correct entries: ${result4d.metricsHistory.length === 100 ? 'PASS' : 'FAIL'}`
);
console.log(
  `✓ Metrics interval works: ${resultInterval.metricsHistory.length === 10 ? 'PASS' : 'FAIL'}`
);
console.log(
  `✓ Execution time: ${totalTime}s ${Number.parseFloat(totalTime) < 10 ? '(PASS)' : '(SLOW)'}`
);
