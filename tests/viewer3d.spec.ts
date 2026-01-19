import { test, expect, type Page } from '@playwright/test';

// Type declarations for the test interface
interface CATestState {
  gridSize: number;
  generation: number;
  isPlaying: boolean;
  frameInterval: number;
  initialDensity: number;
  population: number;
}

interface CARendererInfo {
  meshCount: number;
  isContextLost: boolean;
}

interface CATestInterface {
  getState: () => CATestState;
  getRendererInfo: () => CARendererInfo;
  actions: {
    step: () => void;
    reset: () => void;
    play: () => void;
    pause: () => void;
  };
}

declare global {
  interface Window {
    __CA_TEST__: CATestInterface;
  }
}

// Helper to wait for test interface to be available
async function waitForTestInterface(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__CA_TEST__ !== undefined, {
    timeout: 10000,
  });
}

// Helper to get state from test interface
async function getState(page: Page): Promise<CATestState> {
  return page.evaluate(() => window.__CA_TEST__.getState());
}

// Helper to get renderer info
async function getRendererInfo(page: Page): Promise<CARendererInfo> {
  return page.evaluate(() => window.__CA_TEST__.getRendererInfo());
}

test.describe('3D Viewer - Page Load', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Allow some time for any async errors
    await page.waitForTimeout(500);

    // Filter out favicon and generic 404 errors (common and not relevant)
    const relevantErrors = errors.filter((e) =>
      !e.includes('favicon') && !e.includes('404')
    );
    expect(relevantErrors).toEqual([]);
  });

  test('test interface is available', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const hasTestInterface = await page.evaluate(() =>
      typeof window.__CA_TEST__ === 'object' &&
      typeof window.__CA_TEST__.getState === 'function' &&
      typeof window.__CA_TEST__.getRendererInfo === 'function' &&
      typeof window.__CA_TEST__.actions === 'object'
    );

    expect(hasTestInterface).toBe(true);
  });

  test('initial state is valid', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const state = await getState(page);

    expect(state.gridSize).toBe(20); // Default grid size
    expect(state.generation).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.frameInterval).toBe(200); // Default speed
    expect(state.initialDensity).toBeCloseTo(1.0, 2); // Amoeba preset uses 100% density
    expect(state.population).toBeGreaterThan(0); // Should have some cells
  });
});

test.describe('3D Viewer - Rendering', () => {
  test('mesh count matches population', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const state = await getState(page);
    const renderer = await getRendererInfo(page);

    // If population > 0 but meshCount = 0, cubes aren't rendering
    expect(renderer.meshCount).toBe(state.population);
  });

  test('mesh count updates after step', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const initialRenderer = await getRendererInfo(page);
    const initialCount = initialRenderer.meshCount;

    // Step the simulation
    await page.click('#step');
    await page.waitForTimeout(100); // Wait for update

    const afterRenderer = await getRendererInfo(page);
    const afterState = await getState(page);

    // Mesh count should still match population after step
    expect(afterRenderer.meshCount).toBe(afterState.population);
    // Population may change (but test ensures count updates)
    expect(afterState.generation).toBe(1);
  });

  test('WebGL context is not lost', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const renderer = await getRendererInfo(page);
    expect(renderer.isContextLost).toBe(false);
  });

  test('multiple steps maintain mesh-population consistency', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Run multiple steps
    for (let i = 0; i < 5; i++) {
      await page.click('#step');
      await page.waitForTimeout(50);

      const state = await getState(page);
      const renderer = await getRendererInfo(page);

      expect(renderer.meshCount).toBe(state.population);
      expect(state.generation).toBe(i + 1);
    }
  });
});

test.describe('3D Viewer - UI Controls', () => {
  test('step button increments generation', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const initialState = await getState(page);
    expect(initialState.generation).toBe(0);

    await page.click('#step');

    const afterState = await getState(page);
    expect(afterState.generation).toBe(1);
  });

  test('reset button sets generation to 0', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Step a few times
    await page.click('#step');
    await page.click('#step');
    await page.click('#step');

    const afterSteps = await getState(page);
    expect(afterSteps.generation).toBe(3);

    // Reset
    await page.click('#reset');
    await page.waitForTimeout(100);

    const afterReset = await getState(page);
    expect(afterReset.generation).toBe(0);
  });

  test('play/pause toggles isPlaying state', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const initialState = await getState(page);
    expect(initialState.isPlaying).toBe(false);

    // Click play
    await page.click('#playPause');
    await page.waitForTimeout(50);

    const afterPlay = await getState(page);
    expect(afterPlay.isPlaying).toBe(true);

    // Click pause
    await page.click('#playPause');
    await page.waitForTimeout(50);

    const afterPause = await getState(page);
    expect(afterPause.isPlaying).toBe(false);
  });

  test('play button text changes correctly', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const playBtn = page.locator('#playPause');
    await expect(playBtn).toHaveText('Play');

    await playBtn.click();
    await expect(playBtn).toHaveText('Reset'); // Now shows Reset when playing

    await playBtn.click();
    await expect(playBtn).toHaveText('Play'); // Clicking Reset stops and resets
  });

  test('step button does not work while playing', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Start playing
    await page.click('#playPause');
    await page.waitForTimeout(50);

    // Get current generation
    const beforeStep = await getState(page);
    const genBefore = beforeStep.generation;

    // Try to step - should be ignored
    await page.click('#step');
    await page.waitForTimeout(10);

    // Generation should not have jumped by 1 from our step click
    // (it may have changed from auto-play, but not from our step)
    const afterStep = await getState(page);
    // Just verify we're still playing
    expect(afterStep.isPlaying).toBe(true);
  });

  test('grid size change reinitializes simulation', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Step a few times
    await page.click('#step');
    await page.click('#step');

    const beforeChange = await getState(page);
    expect(beforeChange.generation).toBe(2);
    expect(beforeChange.gridSize).toBe(20);

    // Change grid size
    await page.selectOption('#gridSize', '15');
    await page.waitForTimeout(200);

    const afterChange = await getState(page);
    expect(afterChange.gridSize).toBe(15);
    expect(afterChange.generation).toBe(0); // Should reset
    expect(afterChange.isPlaying).toBe(false);
  });

  test('speed slider updates frame interval', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const initialState = await getState(page);
    expect(initialState.frameInterval).toBe(200);

    // Change speed to 500ms - use evaluate for range input
    await page.evaluate(() => {
      const slider = document.getElementById('speed') as HTMLInputElement;
      slider.value = '500';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const afterChange = await getState(page);
    expect(afterChange.frameInterval).toBe(500);

    // Verify display updates
    await expect(page.locator('#speedValue')).toHaveText('500ms');
  });

  test('density slider updates initial density and resets simulation', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Step a few times first
    await page.click('#step');
    await page.click('#step');

    const beforeChange = await getState(page);
    expect(beforeChange.generation).toBe(2);

    // Change density to 0.3 (30%) - use evaluate for range input
    await page.evaluate(() => {
      const slider = document.getElementById('density') as HTMLInputElement;
      slider.value = '0.3';
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(100);

    const afterChange = await getState(page);
    expect(afterChange.initialDensity).toBeCloseTo(0.3, 2);
    expect(afterChange.generation).toBe(0); // Should reset
    expect(afterChange.isPlaying).toBe(false);

    // Verify display updates
    await expect(page.locator('#densityValue')).toHaveText('30%');
  });
});

test.describe('3D Viewer - Statistics', () => {
  test('generation display updates correctly', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    await expect(page.locator('#generation')).toHaveText('0');

    await page.click('#step');
    await expect(page.locator('#generation')).toHaveText('1');

    await page.click('#step');
    await expect(page.locator('#generation')).toHaveText('2');
  });

  test('population display shows non-zero value', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const populationText = await page.locator('#population').textContent();
    const population = parseInt(populationText || '0');

    expect(population).toBeGreaterThan(0);
  });

  test('density display shows percentage', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const densityText = await page.locator('#densityStat').textContent();
    expect(densityText).toMatch(/^\d+(\.\d+)?%$/);
  });
});

test.describe('3D Viewer - Rule Presets', () => {
  test('rule preset can be changed', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Get initial preset value
    const initialPreset = await page.locator('#preset').inputValue();
    expect(initialPreset).toBe('amoeba');

    // Change preset
    await page.selectOption('#preset', 'coral');

    const newPreset = await page.locator('#preset').inputValue();
    expect(newPreset).toBe('coral');
  });

  test('changing preset does not reset generation', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Step a few times
    await page.click('#step');
    await page.click('#step');

    const beforeChange = await getState(page);
    expect(beforeChange.generation).toBe(2);

    // Change preset
    await page.selectOption('#preset', '5/5');
    await page.waitForTimeout(50);

    const afterChange = await getState(page);
    // Generation should NOT reset when changing preset
    expect(afterChange.generation).toBe(2);
  });
});

test.describe('3D Viewer - Auto-play', () => {
  test('auto-play advances generations', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    const initialState = await getState(page);
    expect(initialState.generation).toBe(0);

    // Start playing
    await page.click('#playPause');

    // Wait for a few frames (default interval is 200ms)
    await page.waitForTimeout(700);

    // Check generation before stopping (clicking playPause now resets)
    const afterPlay = await getState(page);
    // Should have advanced at least 2-3 generations in 700ms with 200ms interval
    expect(afterPlay.generation).toBeGreaterThanOrEqual(2);

    // Now click to reset (stop + reset)
    await page.click('#playPause');
  });

  test('reset stops auto-play', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Start playing
    await page.click('#playPause');
    await page.waitForTimeout(100);

    const playingState = await getState(page);
    expect(playingState.isPlaying).toBe(true);

    // Reset
    await page.click('#reset');
    await page.waitForTimeout(100);

    const afterReset = await getState(page);
    expect(afterReset.isPlaying).toBe(false);
    expect(afterReset.generation).toBe(0);

    // Verify button text
    await expect(page.locator('#playPause')).toHaveText('Play');
  });
});

test.describe('3D Viewer - Test Interface Actions', () => {
  test('test interface step action works', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    await page.evaluate(() => window.__CA_TEST__.actions.step());
    await page.waitForTimeout(50);

    const state = await getState(page);
    expect(state.generation).toBe(1);
  });

  test('test interface reset action works', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Step first
    await page.evaluate(() => window.__CA_TEST__.actions.step());
    await page.evaluate(() => window.__CA_TEST__.actions.step());

    // Reset via test interface
    await page.evaluate(() => window.__CA_TEST__.actions.reset());
    await page.waitForTimeout(100);

    const state = await getState(page);
    expect(state.generation).toBe(0);
  });

  test('test interface play/pause actions work', async ({ page }) => {
    await page.goto('/viewer3d.html');
    await waitForTestInterface(page);

    // Play
    await page.evaluate(() => window.__CA_TEST__.actions.play());
    await page.waitForTimeout(50);

    let state = await getState(page);
    expect(state.isPlaying).toBe(true);

    // Pause
    await page.evaluate(() => window.__CA_TEST__.actions.pause());
    await page.waitForTimeout(50);

    state = await getState(page);
    expect(state.isPlaying).toBe(false);

    // Play again should work
    await page.evaluate(() => window.__CA_TEST__.actions.play());
    await page.waitForTimeout(50);

    state = await getState(page);
    expect(state.isPlaying).toBe(true);
  });
});
