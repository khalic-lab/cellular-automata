import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3456',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { channel: 'chrome' } },
  ],
  webServer: {
    command: 'python3 -m http.server 3456 -d src/web',
    url: 'http://localhost:3456/viewer3d.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
