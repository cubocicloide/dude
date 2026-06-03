import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright base configuration.
 *
 * Used by hooks.ts to launch the browser with the right settings.
 * BASE_URL defaults to the local Vite-served frontend on port 5173; override in CI:
 *   BASE_URL=https://staging.example.com pnpm test
 */
export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    headless: !process.env.HEADED,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  reporter: [
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
    ['line'],
  ],
})
