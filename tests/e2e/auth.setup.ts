/**
 * One-time auth setup. Signs in once each as Kiri (creator) and Voltfang
 * (startup) — two of the migrated seed users — and writes their
 * BetterAuth session cookies to tests/e2e/.auth/{kiri,voltfang}.json.
 * Audit + behavior specs reuse those storage states so every test
 * starts already-signed-in, no re-login per test, no BetterAuth
 * same-IP rate-limit flakes.
 *
 * Lives in its own Playwright project (`auth-setup`) so it only runs
 * when the audit project runs, not for smoke.
 */
import { test as setup, expect, type Page } from "@playwright/test";

const SHARED_PASSWORD = "glimpse-seed-2026";

async function signInAs(page: Page, email: string, storageFile: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SHARED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/feed/, { timeout: 30_000 });
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name.includes("session"))).toBe(true);

  await page.context().storageState({ path: storageFile });
}

setup("authenticate as Kiri (creator)", async ({ page }) => {
  await signInAs(page, "kiri@seed.glimpse.app", "tests/e2e/.auth/kiri.json");
});

setup("authenticate as Voltfang (startup)", async ({ page }) => {
  await signInAs(
    page,
    "voltfang@seed.glimpse.app",
    "tests/e2e/.auth/voltfang.json",
  );
});
