import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * End-to-end smoke for Chunk C — structured work agreement.
 *
 *   Voltfang opens Kiri's creator profile → clicks Hire
 *   Voltfang fills the agreement form (scope, deliverables, price,
 *     deadline, revisions, usage rights) → submits
 *   → New project lands in `pending`, with Voltfang already accepted.
 *
 *   Kiri visits /project/<id>:
 *     - sees the agreement panel with "your turn" header
 *     - sees Voltfang already-accepted pill, herself not-yet
 *     - clicks Accept terms
 *     → status flips to `active` (both accepted), agreement panel
 *       disappears, the regular project action bar takes over.
 *
 * Cleanup: delete the test project (and any review rows) by id.
 */

const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PROJECT_TITLE = `[chunk-c-smoke ${STAMP}] Brand video, Q3 launch`;

let createdProjectId: string | null = null;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.afterAll(async () => {
  if (!createdProjectId) {
    // Belt-and-suspenders: also wipe any earlier orphans from failed runs.
    const db = new PrismaClient();
    try {
      const orphans = await db.project.findMany({
        where: { title: { startsWith: "[chunk-c-smoke" } },
        select: { id: true },
      });
      if (orphans.length > 0) {
        await db.review.deleteMany({
          where: { projectId: { in: orphans.map((o) => o.id) } },
        });
        await db.project.deleteMany({
          where: { id: { in: orphans.map((o) => o.id) } },
        });
        console.log(
          `[chunk-c-smoke] cleaned up ${orphans.length} orphan project(s)`,
        );
      }
    } finally {
      await db.$disconnect();
    }
    return;
  }

  const db = new PrismaClient();
  try {
    await db.review.deleteMany({ where: { projectId: createdProjectId } });
    await db.project.delete({ where: { id: createdProjectId } });
    console.log(`[chunk-c-smoke] cleaned up project ${createdProjectId}`);
  } catch (err) {
    console.error(
      `[chunk-c-smoke] cleanup failed for ${createdProjectId}:`,
      err,
    );
  } finally {
    await db.$disconnect();
  }
});

test("hire → kiri accepts → status flips to active", async ({ browser }) => {
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
    // 1. Voltfang opens Kiri's profile and clicks Hire
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/creator/${KIRI_ID}`);

    // The Hire button uses the creator's first name, e.g. "Hire Kiri"
    const hireBtn = voltfang.getByRole("button", { name: /^Hire /i }).first();
    await expect(hireBtn).toBeVisible({ timeout: 10_000 });
    await hireBtn.click();

    // Modal: fill in the agreement form
    await voltfang.locator("#agreement-title").fill(PROJECT_TITLE);
    await voltfang
      .locator("#agreement-scope")
      .fill(
        "Hero film for our Series A announcement. 60s for landing page + cutdowns.",
      );
    await voltfang
      .locator("#agreement-deliverables")
      .fill("- 1× 60s hero, 9:16\n- 3× 15s cutdowns\n- Raw + project files");
    await voltfang.locator("#agreement-price").fill("4500");
    // Deadline: ~30 days out
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const futureIso = future.toISOString().slice(0, 10);
    await voltfang.locator("#agreement-deadline").fill(futureIso);
    await voltfang.locator("#agreement-revisions").fill("3");
    await voltfang
      .locator("#agreement-rights")
      .selectOption("limited_platform");

    // Submit the offer
    await voltfang
      .getByRole("button", { name: /Send offer to/i })
      .click();

    // Lands on /project/<cuid>
    await voltfang.waitForURL(
      (url) => /^\/project\/c[a-z0-9]+$/.test(url.pathname),
      { timeout: 15_000 },
    );
    const path = new URL(voltfang.url()).pathname;
    createdProjectId = path.match(/^\/project\/(c[a-z0-9]+)$/)?.[1] ?? null;
    expect(createdProjectId, `Expected cuid in path, got ${path}`).toBeTruthy();

    // The project page should show:
    //  - status pill "Pending"
    //  - the agreement panel with the deliverables text inside
    //  - "Waiting on Kiri to accept" copy (Voltfang already accepted)
    await expect(voltfang.locator("body")).toContainText(/Pending/);
    await expect(voltfang.locator("body")).toContainText(
      /Waiting on .* to accept/i,
    );
    await expect(voltfang.locator("body")).toContainText(/9:16/);
    await expect(voltfang.locator("body")).toContainText(/€4,500/);

    // The Hirer (Voltfang) should NOT see an "Accept terms" button —
    // they already accepted by submitting the form. They should see
    // a counter-propose / amend button instead.
    await expect(
      voltfang.getByRole("button", { name: /accept terms/i }),
    ).toHaveCount(0);
    await expect(
      voltfang.getByRole("button", { name: /counter-propose|amend terms/i }),
    ).toBeVisible();

    // ════════════════════════════════════════════════════════════════
    // 2. Kiri visits the project page → sees pending agreement
    // ════════════════════════════════════════════════════════════════
    await kiri.goto(`/project/${createdProjectId}`);
    await expect(kiri.locator("body")).toContainText(/Pending/);
    // Header should read "<Voltfang> accepted — your turn" from Kiri's POV
    await expect(kiri.locator("body")).toContainText(/your turn/i);
    // She should see the price + deliverables
    await expect(kiri.locator("body")).toContainText(/€4,500/);
    await expect(kiri.locator("body")).toContainText(/9:16/);

    // ════════════════════════════════════════════════════════════════
    // 3. Kiri clicks Accept terms → both-accepted, awaiting deposit
    //    (Chunk F-prep added a deposit gate between both-accept and
    //    active. Status flips to active only AFTER the client
    //    deposits. The Chunk-C-specific assertion is just that the
    //    handshake completed; the deposit + active flip is exercised
    //    by the Chunk F-prep smoke.)
    // ════════════════════════════════════════════════════════════════
    await kiri.getByRole("button", { name: /accept terms/i }).click();

    // Header should now read "Both accepted — waiting on … to deposit"
    await expect(kiri.locator("body")).toContainText(/Both accepted/i, {
      timeout: 10_000,
    });
    // Kiri (creator) shouldn't see Accept Terms anymore (she already did)
    await expect(
      kiri.getByRole("button", { name: /accept terms/i }),
    ).toHaveCount(0);
    // Status pill is still Pending until the deposit lands
    await expect(kiri.locator("body")).toContainText(/Pending/);

    // Voltfang refreshes and sees the deposit CTA (proves both
    // acceptances landed — only client sees the Deposit button)
    await voltfang.goto(`/project/${createdProjectId}`);
    await expect(
      voltfang.getByRole("button", { name: /^Deposit /i }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await voltfangCtx.close();
    await kiriCtx.close();
  }
});
