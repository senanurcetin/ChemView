import { defineConfig, devices } from '@playwright/test';

const port = 9002;

export default defineConfig({
  testDir: './e2e',
  // The plant is a single server-side simulation shared by every page, so tests run one by one.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      // Lets sandboxes with a preinstalled browser skip `playwright install`.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    url: `http://localhost:${port}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
