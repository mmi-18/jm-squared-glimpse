import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * Playwright config for the smoke suite.
 *
 * Defaults to running against the live production URL because we don't
 * have a local dev environment Mario can spin up easily. Override with:
 *
 *   SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
 *
 * `workers: 1` + serial test order are deliberate — the signup test
 * mutates the production database (via cleaned-up test data), so racy
 * parallel runs would fight each other.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"]] : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,

  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "https://glimpse.jm-squared.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // After the suite finishes, clean up any rows the tests created. See
  // tests/e2e/global-teardown.ts for the pattern-match it uses.
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
