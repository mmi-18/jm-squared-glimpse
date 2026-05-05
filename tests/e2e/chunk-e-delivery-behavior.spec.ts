import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * End-to-end smoke for Chunk E — file deliveries.
 *
 *   Voltfang hires Kiri → both accept → Voltfang deposits → status=active
 *   Kiri uploads a delivery file + types a note → submits
 *   → status flips to `delivered`, Delivery row created
 *   Voltfang opens the project → sees the file, downloads it
 *   Voltfang signs off → status=completed
 *
 * Verifies:
 *   - upload PUTs to bucket end-to-end (anchor href contains
 *     nbg1.your-objectstorage.com)
 *   - delivery panel renders the file + the creator's note
 *   - downloading the file via the bucket URL returns the bytes (200
 *     + image/png content-type)
 *
 * Cleanup: delete the test project + its delivery (cascade), plus the
 * uploaded file is left in the bucket — 72-byte test PNG, periodic
 * bucket-orphan GC will pick it up.
 */

const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PROJECT_TITLE = `[chunk-e-smoke ${STAMP}] Delivery handoff exercise`;
const DELIVERY_NOTE = `[chunk-e-smoke ${STAMP}] Final cut — raws are in the shared drive`;

// Tiny 1×1 transparent PNG — same as messaging-attachments smoke
const TINY_PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4" +
    "890000000D4944415478DA63FCFFFF3F0300050001A55C9DCD0000000049454E44AE426082",
  "hex",
);

let createdProjectId: string | null = null;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.afterAll(async () => {
  const db = new PrismaClient();
  try {
    if (createdProjectId) {
      // Deliveries cascade-delete with the project (FK onDelete: Cascade)
      await db.review.deleteMany({ where: { projectId: createdProjectId } });
      await db.project.delete({ where: { id: createdProjectId } });
      console.log(`[chunk-e-smoke] cleaned up project ${createdProjectId}`);
      return;
    }
    const orphans = await db.project.findMany({
      where: { title: { startsWith: "[chunk-e-smoke" } },
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
        `[chunk-e-smoke] cleaned up ${orphans.length} orphan project(s)`,
      );
    }
  } finally {
    await db.$disconnect();
  }
});

test("hire → deposit → upload delivery → client downloads", async ({
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
    // 1. Voltfang hires Kiri, both accept, Voltfang deposits
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/creator/${KIRI_ID}`);
    await voltfang.getByRole("button", { name: /^Hire /i }).first().click();
    await voltfang.locator("#agreement-title").fill(PROJECT_TITLE);
    await voltfang
      .locator("#agreement-scope")
      .fill("Delivery flow exercise.");
    await voltfang
      .locator("#agreement-deliverables")
      .fill("- 1× hero image\n- Final exports");
    await voltfang.locator("#agreement-price").fill("1000");
    const future = new Date();
    future.setDate(future.getDate() + 14);
    await voltfang
      .locator("#agreement-deadline")
      .fill(future.toISOString().slice(0, 10));
    await voltfang.locator("#agreement-revisions").fill("1");
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

    await kiri.goto(`/project/${createdProjectId}`);
    await kiri.getByRole("button", { name: /accept terms/i }).click();
    await expect(kiri.locator("body")).toContainText(/Both accepted/i, {
      timeout: 10_000,
    });

    await voltfang.goto(`/project/${createdProjectId}`);
    await voltfang.getByRole("button", { name: /^Deposit /i }).click();
    await expect(voltfang.locator("body")).toContainText(/In progress/, {
      timeout: 10_000,
    });

    // ════════════════════════════════════════════════════════════════
    // 2. Kiri uploads a delivery file + note → submits
    // ════════════════════════════════════════════════════════════════
    await kiri.goto(`/project/${createdProjectId}`);

    // The "Submit delivery" panel should be visible to Kiri
    await expect(kiri.locator("body")).toContainText(/Submit delivery/i);

    // Hidden file input — set it directly
    const fileInput = kiri.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "final-cut.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });

    // Wait for upload to settle (the "Uploading N file" footer copy
    // should disappear when the bucket PUT completes)
    await expect(kiri.locator("body")).not.toContainText(/Uploading \d+/, {
      timeout: 15_000,
    });

    // Note in the textarea
    await kiri
      .locator(`#delivery-message-${createdProjectId}`)
      .fill(DELIVERY_NOTE);

    // Submit
    await kiri.getByRole("button", { name: /^Submit delivery$/i }).click();

    // Status should flip to "Awaiting client approval" (delivered, creator POV)
    await expect(kiri.locator("body")).toContainText(
      /Awaiting client approval/i,
      { timeout: 10_000 },
    );

    // Delivery panel should now render with the file + note
    await expect(kiri.locator("body")).toContainText(/Submitted to client/i);
    await expect(kiri.locator("body")).toContainText(DELIVERY_NOTE);
    await expect(kiri.locator("body")).toContainText(/final-cut\.png/);

    // ════════════════════════════════════════════════════════════════
    // 3. Voltfang opens the project, sees the delivery, downloads
    // ════════════════════════════════════════════════════════════════
    await voltfang.goto(`/project/${createdProjectId}`);
    await expect(voltfang.locator("body")).toContainText(
      /Submitted for your review/i,
    );
    await expect(voltfang.locator("body")).toContainText(DELIVERY_NOTE);

    // The file should be a clickable link with the bucket URL
    const downloadLink = voltfang
      .locator('a[href*="nbg1.your-objectstorage.com"]')
      .first();
    await expect(downloadLink).toBeVisible();
    const url = await downloadLink.getAttribute("href");
    expect(url).toBeTruthy();

    // Bucket round-trip: the file should serve real bytes
    const resp = await voltfang.request.get(url!);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toMatch(/^image\//);

    // ════════════════════════════════════════════════════════════════
    // 4. Voltfang signs off → status flips to completed
    // ════════════════════════════════════════════════════════════════
    await voltfang
      .getByRole("button", { name: /mark complete & sign off/i })
      .click();
    await voltfang.getByRole("button", { name: /^sign off$/i }).click();
    await expect(voltfang.locator("body")).toContainText(/Completed/, {
      timeout: 10_000,
    });
    // Delivery panel persists into completed state
    await expect(voltfang.locator("body")).toContainText(DELIVERY_NOTE);
  } finally {
    await voltfangCtx.close();
    await kiriCtx.close();
  }
});
