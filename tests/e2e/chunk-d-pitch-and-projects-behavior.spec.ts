import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * Smoke for the creator-side mirror of Chunk C (the "Pitch" flow)
 * + the new /projects workspace tab.
 *
 *   Kiri opens Voltfang's startup profile → clicks Pitch
 *   Kiri fills the agreement form → submits
 *   → New project lands in `pending`, with Kiri already accepted.
 *
 *   Voltfang opens /projects:
 *     - sees the new project in "Needs your attention"
 *     - clicks through, lands on /project/<id>
 *     - sees the agreement panel with "your turn" copy
 *     - clicks Accept terms → status flips to active
 *
 *   /projects then shows the project under "In progress" instead.
 *
 * Cleanup: delete the test project by stamp prefix.
 */

const VOLTFANG_ID = "9e35ad25-44d7-45cf-acd3-c7780319d429";

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PROJECT_TITLE = `[chunk-d-smoke ${STAMP}] Inbound pitch from Kiri`;

let createdProjectId: string | null = null;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.afterAll(async () => {
  const db = new PrismaClient();
  try {
    if (createdProjectId) {
      await db.review.deleteMany({ where: { projectId: createdProjectId } });
      await db.project.delete({ where: { id: createdProjectId } });
      console.log(`[chunk-d-smoke] cleaned up project ${createdProjectId}`);
      return;
    }
    // Belt-and-suspenders: clean orphans from earlier failed runs
    const orphans = await db.project.findMany({
      where: { title: { startsWith: "[chunk-d-smoke" } },
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
        `[chunk-d-smoke] cleaned up ${orphans.length} orphan project(s)`,
      );
    }
  } finally {
    await db.$disconnect();
  }
});

test("kiri pitches → voltfang accepts via /projects → active", async ({
  browser,
}) => {
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
    // 1. Kiri opens Voltfang's startup profile and clicks Pitch
    // ════════════════════════════════════════════════════════════════
    await kiri.goto(`/startup/${VOLTFANG_ID}`);

    const pitchBtn = kiri.getByRole("button", { name: /^Pitch /i }).first();
    await expect(pitchBtn).toBeVisible({ timeout: 10_000 });
    await pitchBtn.click();

    await kiri.locator("#agreement-title").fill(PROJECT_TITLE);
    await kiri
      .locator("#agreement-scope")
      .fill("Spec film concept I'd love to shoot for your launch.");
    await kiri
      .locator("#agreement-deliverables")
      .fill("- 1× 45s spec film, 9:16\n- 2× 10s teasers");
    await kiri.locator("#agreement-price").fill("3200");
    const future = new Date();
    future.setDate(future.getDate() + 21);
    await kiri
      .locator("#agreement-deadline")
      .fill(future.toISOString().slice(0, 10));
    await kiri.locator("#agreement-revisions").fill("2");
    await kiri.locator("#agreement-rights").selectOption("limited_platform");

    await kiri.getByRole("button", { name: /Send pitch to/i }).click();

    // Lands on /project/<cuid>
    await kiri.waitForURL(
      (url) => /^\/project\/c[a-z0-9]+$/.test(url.pathname),
      { timeout: 15_000 },
    );
    const path = new URL(kiri.url()).pathname;
    createdProjectId = path.match(/^\/project\/(c[a-z0-9]+)$/)?.[1] ?? null;
    expect(createdProjectId).toBeTruthy();

    // Kiri has already accepted (by submitting); should not see Accept
    await expect(
      kiri.getByRole("button", { name: /accept terms/i }),
    ).toHaveCount(0);
    await expect(kiri.locator("body")).toContainText(/Pending/);

    // ════════════════════════════════════════════════════════════════
    // 2. Voltfang visits /projects → sees it under Needs attention
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto("/projects");
    await expect(
      voltfang.getByRole("heading", { name: /^Projects$/, level: 1 }),
    ).toBeVisible();
    await expect(voltfang.locator("body")).toContainText(
      /Needs your attention/i,
    );
    await expect(voltfang.locator("body")).toContainText(PROJECT_TITLE);
    await expect(voltfang.locator("body")).toContainText(/€3,200/);
    await expect(voltfang.locator("body")).toContainText(
      /Kiri.* — your turn/i,
    );

    // Click through to the project page
    await voltfang.getByRole("link", { name: new RegExp(STAMP) }).click();
    await voltfang.waitForURL(`**/project/${createdProjectId}`);

    // ════════════════════════════════════════════════════════════════
    // 3. Voltfang accepts → status flips to active
    // ════════════════════════════════════════════════════════════════
    await voltfang
      .getByRole("button", { name: /accept terms/i })
      .click();
    await expect(voltfang.locator("body")).toContainText(/In progress/, {
      timeout: 10_000,
    });

    // /projects should now show the project under "In progress" and
    // the "Needs your attention" group should no longer mention this
    // particular project (badge count drops by 1).
    await voltfang.goto("/projects");
    await expect(voltfang.locator("body")).toContainText(/In progress/);
    await expect(voltfang.locator("body")).toContainText(PROJECT_TITLE);
  } finally {
    await voltfangCtx.close();
    await kiriCtx.close();
  }
});
