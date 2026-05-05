import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * End-to-end smoke for Chunk F-prep — the full money flow with the
 * deposit gate + delayed payout cron.
 *
 *   Voltfang hires Kiri → both accept → status pending, awaiting deposit
 *   Voltfang clicks "Deposit €X to start" → status flips to active
 *   Kiri marks delivered
 *   Voltfang signs off → status=completed, payoutScheduledFor=now+24h
 *   Test bumps payoutScheduledFor into the past (simulating 24h elapsed)
 *   Test calls the cron endpoint with auth
 *   → payoutReleasedAt is set; project page shows "Payout released"
 *
 * The cron part is exercised directly via HTTP because waiting 24h
 * inside a Playwright test is a no.
 *
 * Cleanup: delete the test project + reviews by stamp prefix.
 */

const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PROJECT_TITLE = `[chunk-f-smoke ${STAMP}] Brand film with deposit`;

let createdProjectId: string | null = null;

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test.afterAll(async () => {
  const db = new PrismaClient();
  try {
    if (createdProjectId) {
      await db.review.deleteMany({ where: { projectId: createdProjectId } });
      await db.project.delete({ where: { id: createdProjectId } });
      console.log(`[chunk-f-smoke] cleaned up project ${createdProjectId}`);
      return;
    }
    const orphans = await db.project.findMany({
      where: { title: { startsWith: "[chunk-f-smoke" } },
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
        `[chunk-f-smoke] cleaned up ${orphans.length} orphan project(s)`,
      );
    }
  } finally {
    await db.$disconnect();
  }
});

test("hire → both-accept → deposit → deliver → sign-off → cron → paid out", async ({
  browser,
  request,
  baseURL,
}) => {
  const cronSecret = process.env.CRON_SECRET;
  expect(
    cronSecret,
    "CRON_SECRET env var must be set to exercise the payout cron",
  ).toBeTruthy();

  const voltfangCtx = await browser.newContext({
    storageState: "tests/e2e/.auth/voltfang.json",
  });
  const kiriCtx = await browser.newContext({
    storageState: "tests/e2e/.auth/kiri.json",
  });
  const voltfang = await voltfangCtx.newPage();
  const kiri = await kiriCtx.newPage();

  const db = new PrismaClient();

  try {
    // ════════════════════════════════════════════════════════════════
    // 1. Voltfang hires Kiri
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/creator/${KIRI_ID}`);
    await voltfang.getByRole("button", { name: /^Hire /i }).first().click();

    await voltfang.locator("#agreement-title").fill(PROJECT_TITLE);
    await voltfang
      .locator("#agreement-scope")
      .fill("Hero film with deposit gate exercise.");
    await voltfang
      .locator("#agreement-deliverables")
      .fill("- 1× 60s, 9:16\n- Raw + project files");
    await voltfang.locator("#agreement-price").fill("2000");
    const future = new Date();
    future.setDate(future.getDate() + 30);
    await voltfang
      .locator("#agreement-deadline")
      .fill(future.toISOString().slice(0, 10));
    await voltfang.locator("#agreement-revisions").fill("2");
    await voltfang
      .locator("#agreement-rights")
      .selectOption("limited_platform");
    await voltfang.getByRole("button", { name: /Send offer to/i }).click();

    await voltfang.waitForURL(
      (url) => /^\/project\/c[a-z0-9]+$/.test(url.pathname),
      { timeout: 15_000 },
    );
    const path = new URL(voltfang.url()).pathname;
    createdProjectId = path.match(/^\/project\/(c[a-z0-9]+)$/)?.[1] ?? null;
    expect(createdProjectId).toBeTruthy();

    // ════════════════════════════════════════════════════════════════
    // 2. Kiri accepts → status stays pending (deposit gate)
    // ════════════════════════════════════════════════════════════════
    await kiri.goto(`/project/${createdProjectId}`);
    await kiri.getByRole("button", { name: /accept terms/i }).click();

    // Should now show "Both accepted — waiting on Voltfang to deposit"
    // and NOT yet the "In progress" status (since we're awaiting deposit).
    await expect(kiri.locator("body")).toContainText(/Both accepted/i, {
      timeout: 10_000,
    });
    await expect(kiri.locator("body")).toContainText(/Pending/);
    // Kiri (creator) does NOT see a Deposit button — only the client does
    await expect(
      kiri.getByRole("button", { name: /^Deposit /i }),
    ).toHaveCount(0);

    // ════════════════════════════════════════════════════════════════
    // 3. Voltfang sees Deposit CTA, clicks → status flips to active
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/project/${createdProjectId}`);
    const depositBtn = voltfang.getByRole("button", { name: /^Deposit /i });
    await expect(depositBtn).toBeVisible({ timeout: 10_000 });
    // Includes the +10% client fee — €2,000 face → €2,200 total
    await expect(depositBtn).toContainText(/€2,200/);
    await depositBtn.click();

    await expect(voltfang.locator("body")).toContainText(/In progress/, {
      timeout: 10_000,
    });
    await expect(voltfang.locator("body")).toContainText(
      /Deposit held in escrow/,
    );

    // ════════════════════════════════════════════════════════════════
    // 4. Kiri marks delivered → Voltfang signs off → completed
    // ════════════════════════════════════════════════════════════════
    await kiri.goto(`/project/${createdProjectId}`);
    await kiri.getByRole("button", { name: /mark as delivered/i }).click();
    await expect(kiri.locator("body")).toContainText(
      /Awaiting client approval/,
      { timeout: 10_000 },
    );

    await voltfang.goto(`/project/${createdProjectId}`);
    await voltfang
      .getByRole("button", { name: /mark complete & sign off/i })
      .click();
    await voltfang.getByRole("button", { name: /^sign off$/i }).click();

    await expect(voltfang.locator("body")).toContainText(/Completed/, {
      timeout: 10_000,
    });
    // Payout status card should now read "Payout scheduled"
    await expect(voltfang.locator("body")).toContainText(/Payout scheduled/);

    // ════════════════════════════════════════════════════════════════
    // 5. Bump payoutScheduledFor into the past + run the cron
    // ════════════════════════════════════════════════════════════════
    await db.project.update({
      where: { id: createdProjectId! },
      data: { payoutScheduledFor: new Date(Date.now() - 60_000) },
    });

    // Hit the cron endpoint
    const cronResp = await request.post(
      `${baseURL}/api/cron/release-stale-reviews`,
      {
        headers: { Authorization: `Bearer ${cronSecret}` },
      },
    );
    expect(cronResp.status()).toBe(200);
    const cronJson = await cronResp.json();
    expect(cronJson.payoutsReleased).toBeGreaterThanOrEqual(1);

    // ════════════════════════════════════════════════════════════════
    // 6. Refresh project page → "Payout released" copy now shown
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/project/${createdProjectId}`);
    await expect(voltfang.locator("body")).toContainText(/Payout released/);

    await kiri.goto(`/project/${createdProjectId}`);
    await expect(kiri.locator("body")).toContainText(/Payout released/);

    // Sanity-check the database state directly
    const final = await db.project.findUnique({
      where: { id: createdProjectId! },
      select: { payoutReleasedAt: true, status: true, paidAt: true },
    });
    expect(final?.status).toBe("completed");
    expect(final?.paidAt).not.toBeNull();
    expect(final?.payoutReleasedAt).not.toBeNull();
  } finally {
    await db.$disconnect();
    await voltfangCtx.close();
    await kiriCtx.close();
  }
});
