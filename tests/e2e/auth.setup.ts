/**
 * One-time auth setup for the audit suite.
 *
 * Signs in once as Kiri (a migrated seed user) and writes the resulting
 * BetterAuth session cookie to tests/e2e/.auth/kiri.json. The audit
 * project then reuses that storage state so every authed audit test
 * starts already-signed-in — no re-login per test, no rate-limit flakes.
 *
 * Lives in its own Playwright project (`auth-setup`) so it only runs
 * when the audit runs, not for the smoke suite.
 */
import { test as setup, expect } from "@playwright/test";

const KIRI_EMAIL = "kiri@seed.glimpse.app";
const SHARED_PASSWORD = "glimpse-seed-2026";
const STORAGE_FILE = "tests/e2e/.auth/kiri.json";

setup("authenticate as Kiri", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(KIRI_EMAIL);
  await page.locator("#password").fill(SHARED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/feed/, { timeout: 30_000 });
  // Sanity: the BetterAuth session cookie is set
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name.includes("session"))).toBe(true);

  await page.context().storageState({ path: STORAGE_FILE });
});
