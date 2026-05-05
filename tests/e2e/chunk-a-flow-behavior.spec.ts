import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * End-to-end smoke for Chunk A's full flow:
 *
 *   Voltfang (startup, client) creates a project via /dev/project/new
 *   Kiri (creator) submits a delivery (Chunk E — uploads a tiny PNG,
 *     then submits, which flips status to delivered)
 *   Voltfang signs off → status=completed
 *   Voltfang submits review (released=false, blind)
 *   Kiri submits review (both flip to released=true atomically)
 *   Both reviews are visible on the project page
 *
 * Cleanup: at end of test (passed or failed), the test project (and
 * its cascaded reviews + deliveries) are deleted via Prisma so we
 * don't accumulate stale rows in production. Identified by a
 * smoke-stamped title.
 */

const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";
const VOLTFANG_ID = "9e35ad25-44d7-45cf-acd3-c7780319d429";

// Unique-per-run stamp so retries / parallel CI shards don't collide.
const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PROJECT_TITLE = `[chunk-a-smoke ${STAMP}] Brand film for Q3 launch`;

let createdProjectId: string | null = null;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.afterAll(async () => {
  // Best-effort cleanup. Re-uses Neon directly via Prisma so we don't
  // depend on the live site to clean up after us.
  if (!createdProjectId) return;
  const db = new PrismaClient();
  try {
    await db.review.deleteMany({ where: { projectId: createdProjectId } });
    await db.project.delete({ where: { id: createdProjectId } });
    console.log(`[chunk-a-smoke] cleaned up project ${createdProjectId}`);
  } catch (err) {
    console.error(`[chunk-a-smoke] cleanup failed for ${createdProjectId}:`, err);
  } finally {
    await db.$disconnect();
  }
});

test("end-to-end: create → deliver → sign off → both review", async ({
  browser,
}) => {
  // ── Two parallel browser contexts, each carrying one user's session ──
  const voltfangCtx = await browser.newContext({
    storageState: "tests/e2e/.auth/voltfang.json",
  });
  const kiriCtx = await browser.newContext({
    storageState: "tests/e2e/.auth/kiri.json",
  });
  const voltfang = await voltfangCtx.newPage();
  const kiri = await kiriCtx.newPage();

  try {
    // ════════════════════════════════════════════════════════════════
    // 1. Voltfang creates the project via /dev/project/new
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto("/dev/project/new");

    // If Voltfang has a pending review from an earlier failed run, the
    // page short-circuits to a "review your last project first" card.
    // Detect that and skip-fail loudly instead of silently hanging.
    const heading = await voltfang.locator("h1").first().textContent();
    expect(
      heading,
      "Voltfang has a pending review blocking project creation — clean up earlier test data first",
    ).not.toMatch(/Review your last project first/);

    await voltfang.locator("#title").fill(PROJECT_TITLE);
    await voltfang.locator("#otherUserId").selectOption({ value: KIRI_ID });
    await voltfang.getByRole("button", { name: /create project/i }).click();

    // Lands on /project/<cuid>. Use a path-anchored matcher so we
    // don't accidentally match the still-loading `/dev/project/new`
    // page (which my first version of this test did, causing the
    // captured project id to be "new" → Kiri 404'd downstream).
    await voltfang.waitForURL(
      (url) => /^\/project\/c[a-z0-9]+$/.test(url.pathname),
      { timeout: 15_000 },
    );
    const path = new URL(voltfang.url()).pathname;
    createdProjectId = path.match(/^\/project\/(c[a-z0-9]+)$/)?.[1] ?? null;
    expect(createdProjectId, `Expected cuid in path, got ${path}`).toBeTruthy();

    // Status pill should read "In progress"
    await expect(voltfang.locator("body")).toContainText(/In progress/);

    // ════════════════════════════════════════════════════════════════
    // 2. Kiri sees the project in her inbox + submits a delivery
    //    (Chunk E — upload a 1×1 PNG + submit, which flips status
    //    active → delivered atomically)
    // ════════════════════════════════════════════════════════════════
    await kiri.goto("/inbox");
    await expect(kiri.locator("body")).toContainText(PROJECT_TITLE);

    await kiri.goto(`/project/${createdProjectId}`);
    // Tiny 1×1 transparent PNG — same payload the messaging /
    // delivery smokes use
    const TINY_PNG = Buffer.from(
      "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4" +
        "890000000D4944415478DA63FCFFFF3F0300050001A55C9DCD0000000049454E44AE426082",
      "hex",
    );
    await kiri.locator('input[type="file"]').setInputFiles({
      name: "smoke.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(kiri.locator("body")).not.toContainText(/Uploading \d+/, {
      timeout: 15_000,
    });
    await kiri.getByRole("button", { name: /^Submit delivery$/i }).click();

    // After submission, page refreshes; assert new state
    await expect(kiri.locator("body")).toContainText(
      /Awaiting client approval/,
      { timeout: 10_000 },
    );

    // ════════════════════════════════════════════════════════════════
    // 3. Voltfang signs off
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/project/${createdProjectId}`);
    await expect(voltfang.locator("body")).toContainText(
      /Awaiting your approval/,
    );

    await voltfang
      .getByRole("button", { name: /mark complete & sign off/i })
      .click();

    // Confirm dialog → click "Sign off"
    await voltfang.getByRole("button", { name: /^sign off$/i }).click();

    // Now status should be "Completed"
    await expect(voltfang.locator("body")).toContainText(/Completed/, {
      timeout: 10_000,
    });

    // ════════════════════════════════════════════════════════════════
    // 4. Voltfang submits review — first half of the two-way blind
    // ════════════════════════════════════════════════════════════════
    await fillAndSubmitReview(voltfang, "Kiri delivered a stellar cut.");

    // After submit, the form is gone; "Waiting on…" state should appear.
    await expect(voltfang.locator("body")).toContainText(
      /Review submitted/,
      { timeout: 10_000 },
    );
    await expect(voltfang.locator("body")).toContainText(/Waiting on/);

    // Kiri (still on the project page from step 2) refreshes — should
    // NOT see Voltfang's review yet (blind). She gets the review form
    // for HER side instead.
    await kiri.goto(`/project/${createdProjectId}`);
    await expect(kiri.locator("body")).toContainText(
      /Rate your collaboration/,
    );
    // Defensive: the released-reviews "Reviews" header should NOT be there
    await expect(
      kiri.getByRole("heading", { name: /^Reviews$/i }),
    ).toHaveCount(0);

    // The amber pending-review banner should also be visible on every
    // page Kiri navigates to.
    await kiri.goto("/feed");
    await expect(kiri.locator("body")).toContainText(/Review pending/);

    // ════════════════════════════════════════════════════════════════
    // 5. Kiri submits her review — both flip to released=true
    // ════════════════════════════════════════════════════════════════
    await kiri.goto(`/project/${createdProjectId}`);
    await fillAndSubmitReview(kiri, "Clear brief, prompt feedback. 10/10.");

    // After Kiri submits, BOTH reviews release. The "Reviews" section
    // should now contain two entries (one per direction).
    await expect(
      kiri.getByRole("heading", { name: /^Reviews$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Voltfang refreshes and also sees both reviews now
    await voltfang.goto(`/project/${createdProjectId}`);
    await expect(
      voltfang.getByRole("heading", { name: /^Reviews$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Both review texts should be visible to both parties
    await expect(voltfang.locator("body")).toContainText(
      /stellar cut/,
    );
    await expect(voltfang.locator("body")).toContainText(/Clear brief/);
    await expect(kiri.locator("body")).toContainText(/stellar cut/);
    await expect(kiri.locator("body")).toContainText(/Clear brief/);

    // The pending-review banner should be gone for both now
    await voltfang.goto("/feed");
    await expect(voltfang.locator("body")).not.toContainText(
      /Review pending/,
    );
    await kiri.goto("/feed");
    await expect(kiri.locator("body")).not.toContainText(/Review pending/);
  } finally {
    await voltfangCtx.close();
    await kiriCtx.close();
  }
});

/**
 * Fill out the review form: pick 5 stars on each of the 4 dimensions,
 * type into the textarea, click Submit.
 */
async function fillAndSubmitReview(page: Page, text: string) {
  // The form has 4 dimension rows. Each row's 5-star scale is 5 buttons
  // labelled "1 star" / "2 stars" / ... / "5 stars". We click the
  // 5-star button in each row by index.
  const fiveStarButtons = page.getByRole("button", {
    name: /^5 stars$/,
  });
  const count = await fiveStarButtons.count();
  expect(count).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 4; i++) {
    await fiveStarButtons.nth(i).click();
  }

  await page.locator("#reviewText").fill(text);
  await page.getByRole("button", { name: /^submit review$/i }).click();
}
