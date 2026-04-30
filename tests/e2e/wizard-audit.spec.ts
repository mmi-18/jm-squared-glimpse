import { test, expect, type Page } from "@playwright/test";
import { auditCurrentView, formatFindings, type Finding } from "./helpers/audit";

/**
 * Wizard-walk audit — drives the multi-step onboarding flows and audits
 * every step's freshly-rendered DOM along the way.
 *
 * The plain interaction-audit only sees the wizard's first step on
 * initial page load. This test fills the required fields on each step,
 * clicks "Next" / "Skip" to advance, and runs the audit on each new
 * view. Stops one click short of "Finish" so it doesn't actually
 * overwrite Kiri's profile in the DB — wizard state is React-local
 * until Finish, so the walk is a pure read against the server.
 *
 * Coverage today:
 *   - /onboarding/creator   6 steps (0..5)
 *   - /onboarding/startup   N steps (whatever the page exposes)
 */

test.describe.configure({ mode: "serial" });

test.use({ storageState: "tests/e2e/.auth/kiri.json" });

// Wizards have many steps × many chips per step. Default 30s isn't
// enough for the full walk + audit per step.
test.setTimeout(240_000);

type StepFindings = { step: string; findings: Finding[] };

async function nextButton(page: Page) {
  // The StepShell button labelled "Next" is always the rightmost CTA.
  // Use exact match to avoid colliding with chip labels that contain "Next".
  return page.getByRole("button", { name: "Next", exact: true });
}

async function clickAdvance(
  page: Page,
  expectedNextHeading: RegExp,
) {
  const next = await nextButton(page);
  await next.click();
  await page.getByRole("heading", { name: expectedNextHeading }).waitFor({
    state: "visible",
    timeout: 5_000,
  });
}

async function clickSkip(page: Page, expectedNextHeading: RegExp) {
  const skip = page.getByRole("button", { name: /skip/i }).first();
  await skip.click();
  await page.getByRole("heading", { name: expectedNextHeading }).waitFor({
    state: "visible",
    timeout: 5_000,
  });
}

async function auditStep(
  page: Page,
  stepLabel: string,
  collected: StepFindings[],
  scope?: Parameters<typeof auditCurrentView>[1],
) {
  const findings = await auditCurrentView(page, scope);
  collected.push({ step: stepLabel, findings });
}

function joinStepFindings(all: StepFindings[]): string {
  const broken = all.filter((s) => s.findings.length > 0);
  if (broken.length === 0) return "";
  return broken
    .map((s) => formatFindings(s.step, s.findings))
    .join("\n\n");
}

// ════════════════════════════════════════════════════════════════════════
// Creator onboarding wizard — 6 steps
// ════════════════════════════════════════════════════════════════════════

test("creator onboarding — walk all 6 steps, audit each", async ({ page }) => {
  await page.goto("/onboarding/creator");
  await page.getByRole("heading", { name: /Who you are/ }).waitFor();

  const collected: StepFindings[] = [];

  // ── Step 0: Who you are ──
  await auditStep(page, "creator step 0 — Who you are", collected);
  await page.locator("#name").fill("Audit Walker");
  await page.locator("#city").fill("Munich");
  await page.locator("#country").fill("Germany");
  await page.getByRole("button", { name: "German", exact: true }).click();
  await clickAdvance(page, /What you do/);

  // ── Step 1: What you do ──
  await auditStep(page, "creator step 1 — What you do", collected);
  await page
    .getByRole("button", { name: "Tech & Product", exact: true })
    .click();
  await clickAdvance(page, /Your style/);

  // ── Step 2: Your style ──
  await auditStep(page, "creator step 2 — Your style", collected);
  await clickAdvance(page, /Your work/);

  // ── Step 3: Your work ──
  await auditStep(page, "creator step 3 — Your work", collected);
  await page
    .getByRole("button", { name: "Short Social Clip", exact: true })
    .click();
  await clickAdvance(page, /Go deeper/);

  // ── Step 4: Go deeper ── (optional, skip is the affordance to test)
  await auditStep(page, "creator step 4 — Go deeper", collected);
  await clickSkip(page, /Preferences/);

  // ── Step 5: Preferences ── (final — DO NOT click Finish)
  await auditStep(page, "creator step 5 — Preferences", collected);
  // Hard stop. No Finish click → no DB write → Kiri's profile unchanged.

  expect.soft(
    collected.flatMap((s) => s.findings),
    joinStepFindings(collected),
  ).toEqual([]);
});

// ════════════════════════════════════════════════════════════════════════
// New-post wizard — 3 steps, requires uploading at least one image to
// advance from step 1.
// ════════════════════════════════════════════════════════════════════════

// 1×1 transparent PNG, used to satisfy step 1's "at least one image" rule.
const TINY_PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4" +
    "890000000D4944415478DA63FCFFFF3F0300050001A55C9DCD0000000049454E44AE426082",
  "hex",
);

test("new-post wizard — walk all 3 steps, audit each", async ({ page }) => {
  await page.goto("/new-post");
  // Wait for the step indicator or any visible button on step 1
  await page.locator("body").waitFor();
  // Settle
  await page.waitForTimeout(500);

  const collected: StepFindings[] = [];

  // ── Step 1: pictures + title + description ──
  await auditStep(page, "new-post step 1 — Pictures + title + description", collected);

  // Upload one image to satisfy step 1 validation
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "audit-test.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  // Settle: the FileReader → setState → re-render takes a tick
  await page.waitForTimeout(300);

  // Continue → step 2
  await page.getByRole("button", { name: /continue|next/i }).click();
  await page.waitForTimeout(300);

  // ── Step 2: industry / content type / format ──
  await auditStep(page, "new-post step 2 — Categorize", collected);

  // ── Step 3: style sliders ──
  // Step 2's "Continue" needs a non-empty industry; Kiri's profile
  // probably pre-fills it. Try advancing; if disabled, skip step 3.
  const continueBtn = page.getByRole("button", { name: /continue|next/i });
  if (
    (await continueBtn.isVisible().catch(() => false)) &&
    !(await continueBtn.isDisabled().catch(() => true))
  ) {
    await continueBtn.click();
    await page.waitForTimeout(300);
    await auditStep(page, "new-post step 3 — Style", collected);
  }

  // Hard stop. Do NOT click Publish — that would write to the DB.

  expect.soft(
    collected.flatMap((s) => s.findings),
    joinStepFindings(collected),
  ).toEqual([]);
});

// ════════════════════════════════════════════════════════════════════════
// Owner affordances — three-dot menu / delete confirmation on Kiri's
// own post. Only visible when the viewer owns the post.
// ════════════════════════════════════════════════════════════════════════

test("post detail (owner view) — open three-dot menu and audit", async ({
  page,
}) => {
  // Kiri's own first post
  await page.goto("/post/a3f9f6ac-e7fd-47df-af13-9ad70422c258");
  await page.waitForLoadState("domcontentloaded");

  const collected: StepFindings[] = [];

  // First, audit the page as-is (with the menu closed)
  await auditStep(page, "post detail — closed", collected);

  // Try to find a "more" / three-dot trigger. Be flexible about the
  // accessible name since DeletePostButton might use Lucide icon.
  const moreTrigger = page.getByRole("button", {
    name: /more|options|delete|menu/i,
  }).first();
  const triggerVisible = await moreTrigger.isVisible().catch(() => false);

  if (triggerVisible) {
    await moreTrigger.click();
    await page.waitForTimeout(300);
    // Radix DropdownMenu defaults to modal=true: it intentionally blocks
    // pointer events on the rest of the page while open. Auditing the
    // whole page here would surface every header link as "unactionable",
    // which is by design. Scope the audit to just the menu's content
    // (and the surrounding Dialog if Delete was already clicked) to find
    // real bugs in the menu itself.
    const menu = page.locator('[role="menu"]').first();
    if (await menu.isVisible().catch(() => false)) {
      await auditStep(page, "post detail — menu open (scoped)", collected, menu);
    } else {
      console.log("[audit] menu trigger clicked but no [role=menu] appeared");
    }
  } else {
    console.log(
      "[audit] no three-dot trigger visible on this post — owner affordance might be missing or selector is wrong",
    );
  }

  expect.soft(
    collected.flatMap((s) => s.findings),
    joinStepFindings(collected),
  ).toEqual([]);
});

// ════════════════════════════════════════════════════════════════════════
// Startup onboarding wizard — same shape, different field set
// ════════════════════════════════════════════════════════════════════════

test("startup onboarding — walk all steps, audit each", async ({ page }) => {
  await page.goto("/onboarding/startup");
  // Wait for the first step's heading. We don't know exactly what it
  // says; grab the first visible h1 in the StepShell.
  await page.locator("h1").first().waitFor();

  const collected: StepFindings[] = [];

  let stepIndex = 0;
  // Cap at 10 to avoid an infinite loop if the wizard structure changes.
  while (stepIndex < 10) {
    const heading = (await page.locator("h1").first().textContent()) ?? "";
    await auditStep(
      page,
      `startup step ${stepIndex} — ${heading.trim()}`,
      collected,
    );

    // Look for a "Next" button. If the next-button text is anything else
    // (Save / Finish), we're on the last step — STOP here, don't submit.
    const next = page.getByRole("button", { name: "Next", exact: true });
    if (!(await next.isVisible().catch(() => false))) {
      // Probably the final step, with "Finish" or "Save" instead.
      break;
    }

    if (await next.isDisabled().catch(() => true)) {
      // Validation blocks advancement. Try to satisfy by clicking the
      // first chip on the page (often required), then retry. If still
      // disabled, accept that we can't advance further.
      const firstChip = page.locator(
        'main button[type="button"]:not([aria-label])',
      ).first();
      if (await firstChip.isVisible().catch(() => false)) {
        await firstChip.click();
      }
      // Fill any visible empty inputs as a fallback to satisfy validation.
      const inputs = await page.locator('input:not([type="hidden"]):not([type="file"])').all();
      for (const inp of inputs) {
        if (!(await inp.isVisible().catch(() => false))) continue;
        const val = await inp.inputValue().catch(() => "");
        if (val) continue;
        const type = await inp.getAttribute("type");
        if (type === "number") {
          await inp.fill("100").catch(() => {});
        } else if (type === "date") {
          await inp.fill("2026-12-31").catch(() => {});
        } else {
          await inp.fill("audit-walker").catch(() => {});
        }
      }
    }

    if (await next.isDisabled().catch(() => true)) {
      // Still blocked — accept that this step can't be advanced and stop.
      break;
    }

    await next.click();
    // Wait for the next step's content to appear. Heading text changes.
    await page.waitForTimeout(300);
    stepIndex++;
  }

  expect.soft(
    collected.flatMap((s) => s.findings),
    joinStepFindings(collected),
  ).toEqual([]);
});
