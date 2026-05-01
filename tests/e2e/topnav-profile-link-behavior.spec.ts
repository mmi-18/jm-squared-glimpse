import { test, expect } from "@playwright/test";

/**
 * Regression test for the TopNav profile pill: clicking the avatar+name
 * in the top-right of the desktop header must navigate to the user's
 * own profile page.
 *
 * Background — Mario reported "the profile name in the top right is
 * not clickable". The Link was technically actionable (audit + trial
 * click both passed), but the visual affordance was missing: plain
 * `<Link><Avatar /><span>{name}</span></Link>` with no padding, border,
 * or hover background. Users mistook it for decorative text and
 * misclicked the adjacent SignOut icon. Fix: pill-shaped button styling
 * (rounded-full + hover:bg-muted + larger padding + min-h 40px hit area).
 *
 * This test verifies the click navigates correctly. The pill styling
 * itself (visual affordance) is captured by tests/e2e/topnav-screenshot
 * if a snapshot is needed.
 */

test.use({ storageState: "tests/e2e/.auth/kiri.json" });

const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";

test("clicking profile pill in TopNav navigates to own creator profile", async ({
  page,
}) => {
  await page.goto("/feed");
  await page.locator("body").waitFor();

  const profileLink = page
    .locator("header")
    .locator(`a[href$="/creator/${KIRI_ID}"]`);

  await expect(profileLink).toBeVisible();

  // The pill should have a min-h hit area of at least 40px (the
  // Tailwind `min-h-[40px]` class) so it meets WCAG 2.5.5 Level AA-ish
  // touch-target sizing.
  const box = await profileLink.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(36); // 40 - 4 tolerance for borders

  await profileLink.click();
  await page.waitForURL(`**/creator/${KIRI_ID}`, { timeout: 5_000 });
  expect(page.url()).toContain(`/creator/${KIRI_ID}`);
});
