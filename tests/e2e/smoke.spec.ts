import { test, expect } from "@playwright/test";

/**
 * Smoke suite — three critical-path checks against a live glimpse install.
 *
 * 1. Signup creates a fresh creator account → lands on /membership
 * 2. Login as a migrated seed user (Kiri) → lands on /feed
 * 3. Public creator profile of a migrated user renders without crashing
 *
 * What it proves:
 *   - BetterAuth signup works (write to User + Account + auto-sign-in)
 *   - BetterAuth signin works against migrated scrypt-hashed accounts
 *   - Prisma can read the migrated domain data (User, CreatorProfile, etc.)
 *     and the JSON-LD / metadata pipeline still renders
 *
 * What it does NOT prove:
 *   - The full onboarding wizard, the cell-spanning grid, messaging,
 *     payments, briefs. Those are for a regression suite later.
 *
 * Cleanup: every account this test creates uses the email prefix
 * `pw-smoke-`. The global teardown (tests/e2e/global-teardown.ts) deletes
 * all users with that prefix from the DB, so even runs that fail mid-test
 * leave nothing behind on the next run.
 */

// Unique-per-run suffix so retries / parallel CI shards don't collide.
const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_EMAIL = `pw-smoke-${STAMP}@test.glimpse.app`;
const TEST_PASSWORD = "pw-smoke-2026!";
const TEST_NAME = `Smoke ${STAMP}`;

// Migrated seed user — exists in Neon since the Supabase migration.
// UUID stays stable because we preserved Supabase IDs during migration.
const KIRI_EMAIL = "kiri@seed.glimpse.app";
const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";
const SHARED_SEED_PASSWORD = "glimpse-seed-2026";

test.describe.serial("glimpse smoke", () => {
  test("signup creates a creator account and lands on /membership", async ({
    page,
  }) => {
    await page.goto("/signup");

    // Default tab is "creator"; click anyway to make the test explicit.
    await page.getByRole("button", { name: "Creator", exact: true }).click();

    await page.locator("#name").fill(TEST_NAME);
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(TEST_PASSWORD);

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/membership/, { timeout: 20_000 });
    expect(page.url()).toContain("/membership");
  });

  test("login as a migrated seed user (Kiri) lands on /feed", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.locator("#email").fill(KIRI_EMAIL);
    await page.locator("#password").fill(SHARED_SEED_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/feed/, { timeout: 20_000 });
  });

  test("public creator profile (Kiri) renders without crashing", async ({
    page,
  }) => {
    // No login needed — creator profiles are public for SEO.
    const response = await page.goto(`/creator/${KIRI_ID}`);
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/Kiri/i);

    // Sanity: the migrated bio text renders somewhere on the page.
    const body = await page.textContent("body");
    expect(body).toMatch(/kiri/i);
  });
});
