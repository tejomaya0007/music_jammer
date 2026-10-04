import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end: the real app in mock mode (VITE_BACKEND=mock, fake player),
 * served by Vite, talking to the local PGlite backend. No network needed.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    viewport: { width: 412, height: 860 },
  },
  projects: [{ name: 'phone-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 412, height: 860 } } }],
  webServer: [
    {
      command: 'npx tsx server/start.ts',
      url: 'http://127.0.0.1:8787/mock-api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npx vite --mode mock --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
