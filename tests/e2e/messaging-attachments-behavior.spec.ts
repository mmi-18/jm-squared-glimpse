import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * Messaging attachments smoke against the live site.
 *
 * Flow:
 *   1. Voltfang opens a conversation with Kiri
 *   2. Attaches a tiny test PNG (uploads to Hetzner Object Storage)
 *   3. Types text + sends
 *   4. Refreshes — sees the message bubble + attachment tile
 *   5. Kiri opens the same conversation — sees both
 *   6. Cleanup: deletes the test message via Prisma (so the bucket
 *      file is technically orphaned but it's a 72-byte test PNG;
 *      we'll periodically GC bucket-orphans in a separate task)
 *
 * Identifies the test message by a distinctive content stamp so
 * cleanup is bulletproof against half-failed runs.
 */

const KIRI_ID = "fc99f0ee-f9fb-4399-91a5-a87f54ff1379";
const VOLTFANG_ID = "9e35ad25-44d7-45cf-acd3-c7780319d429";

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const MESSAGE_TEXT = `[msg-attach-smoke ${STAMP}] hello with attachment`;

// Tiny 1×1 transparent PNG — same payload the upload API smoke uses.
const TINY_PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4" +
    "890000000D4944415478DA63FCFFFF3F0300050001A55C9DCD0000000049454E44AE426082",
  "hex",
);

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.afterAll(async () => {
  // Clean up test messages by stamp prefix
  const db = new PrismaClient();
  try {
    const result = await db.message.deleteMany({
      where: { content: { startsWith: "[msg-attach-smoke" } },
    });
    console.log(
      `[msg-attach-smoke] cleaned up ${result.count} test message(s)`,
    );
  } catch (err) {
    console.error("[msg-attach-smoke] cleanup failed:", err);
  } finally {
    await db.$disconnect();
  }
});

test("send + render attachment in a conversation (live)", async ({
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
    // Voltfang: open or create the conversation with Kiri by visiting
    // her creator page and using the message dialog. Easier shortcut:
    // both have an existing conversation from earlier tests / data, so
    // Voltfang can navigate via /inbox.
    await voltfang.goto("/inbox");
    // Find the conversation row pointing at Kiri (the migrated seed
    // data has one) and click into it.
    const kiriRow = voltfang.getByRole("link", { name: /Kiri/i }).first();
    await expect(kiriRow).toBeVisible({ timeout: 10_000 });
    await kiriRow.click();
    await voltfang.waitForURL(/\/inbox\/[^/]+/);
    const conversationUrl = voltfang.url();

    // Attach a file via the paperclip → file input
    const fileInput = voltfang.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "smoke.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });

    // Wait for the upload to finish — when no preview tile shows the
    // uploading spinner, we know the bucket PUT resolved. Detect via
    // the "Uploading N files…" status text disappearing.
    await expect(voltfang.locator("body")).not.toContainText(
      /Uploading \d+ files?/,
      { timeout: 15_000 },
    );

    // Type message + send
    await voltfang.locator('input[placeholder*="message" i]').fill(
      MESSAGE_TEXT,
    );
    await voltfang.getByRole("button", { name: /send message/i }).click();

    // Wait for refresh — server action revalidates the path
    await voltfang.waitForTimeout(1500);
    await voltfang.reload();

    // Voltfang sees the message text + at least one attachment image
    await expect(voltfang.locator("body")).toContainText(MESSAGE_TEXT);
    const voltfangAttachments = voltfang.locator(
      'a[href*="nbg1.your-objectstorage.com"]',
    );
    expect(await voltfangAttachments.count()).toBeGreaterThanOrEqual(1);

    // Kiri opens the same conversation, sees the same
    await kiri.goto(conversationUrl);
    await expect(kiri.locator("body")).toContainText(MESSAGE_TEXT);
    const kiriAttachments = kiri.locator(
      'a[href*="nbg1.your-objectstorage.com"]',
    );
    expect(await kiriAttachments.count()).toBeGreaterThanOrEqual(1);

    // Verify the attachment URL actually serves the bytes (bucket
    // round-trip from the browser's perspective)
    const url = await kiriAttachments.first().getAttribute("href");
    expect(url).toBeTruthy();
    const resp = await kiri.request.get(url!);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toMatch(/^image\//);
  } finally {
    await voltfangCtx.close();
    await kiriCtx.close();
  }
});
