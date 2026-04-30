import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * Playwright config — three projects.
 *
 *   smoke       Runs the 3-test smoke suite. No auth setup, fast.
 *   auth-setup  Logs in as Kiri once, writes cookies to .auth/kiri.json.
 *               Only runs as a dependency of `audit`.
 *   audit       Runs the interaction audit. Public routes use fresh
 *               context (no auth); authed routes opt in to the saved
 *               storage state via `test.use(...)` inside the describe.
 *
 * Defaults to running against the live production URL because there's no
 * local dev environment Mario can spin up easily. Override with
 *   SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
 *
 * `workers: 1` + serial test order are deliberate — the smoke signup
 * test mutates the production database (then cleans up), so racy
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
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "audit",
      testMatch: /interaction-audit\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // After the suite finishes, clean up rows the smoke tests created.
  // The audit runs trial-clicks (no real interactions) so it doesn't
  // create anything itself — but teardown is harmless when there's
  // nothing to delete.
  globalTeardown: "./tests/e2e/global-teardown.ts",
});
