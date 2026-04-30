import { test, expect } from "@playwright/test";

/**
 * Slider behavior verification.
 *
 * BaseUI's `<Slider>` renders the underlying `<input type="range">` as a
 * visually-hidden accessibility proxy — Playwright's actionability check
 * correctly flags those inputs as "not clickable", but the visible thumb
 * (a `<div data-slot="slider-thumb">` with `role="slider"`) is what the
 * user actually drags. The interaction-audit therefore filters out
 * `input[type="range"]` to suppress the noise.
 *
 * That's only safe IF the thumbs are truly draggable. This test proves
 * it: navigate to the style-slider step of creator onboarding, focus
 * the first thumb, hammer ArrowRight, assert the displayed value
 * changes. If a slider genuinely doesn't respond, this test catches it.
 */

test.describe.configure({ mode: "serial" });
test.use({ storageState: "tests/e2e/.auth/kiri.json" });
test.setTimeout(60_000);

test("creator style sliders respond to keyboard interaction", async ({ page }) => {
  await page.goto("/onboarding/creator");
  await page.getByRole("heading", { name: /Who you are/ }).waitFor();

  // Walk to step 2 (Your style)
  await page.locator("#name").fill("Slider Tester");
  await page.locator("#city").fill("Munich");
  await page.locator("#country").fill("Germany");
  await page.getByRole("button", { name: "German", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: "Tech & Product", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("heading", { name: /Your style/ }).waitFor();

  // The "Production value" card: label on the left, "5 / 10" value on
  // the right, slider below. Find the value-display span for the first
  // dimension and read it.
  // Each StyleSlider renders the value in a span like "5 / 10".
  const valueDisplays = page.locator('span:text-matches("^\\\\d+ / 10$")');
  const initialValues: string[] = [];
  const count = await valueDisplays.count();
  expect(count).toBeGreaterThanOrEqual(7);
  for (let i = 0; i < count; i++) {
    initialValues.push((await valueDisplays.nth(i).textContent()) ?? "");
  }
  // All seven sliders default to 5 / 10
  expect(initialValues.slice(0, 7)).toEqual(
    Array(7).fill("5 / 10"),
  );

  // Locate every slider thumb. There should be one per StyleSlider.
  const thumbs = page.locator('[data-slot="slider-thumb"]');
  const thumbCount = await thumbs.count();
  expect(thumbCount).toBeGreaterThanOrEqual(7);

  // Dump diagnostic snapshot of every thumb so the failure diff includes
  // the difference between working and broken sliders.
  console.log("\n--- Thumb DOM dump ---");
  for (let i = 0; i < thumbCount; i++) {
    const t = thumbs.nth(i);
    const info = await t.evaluate((e: HTMLElement) => ({
      tag: e.tagName,
      role: e.getAttribute("role"),
      tabindex: e.getAttribute("tabindex"),
      ariaValuenow: e.getAttribute("aria-valuenow"),
      ariaValuemin: e.getAttribute("aria-valuemin"),
      ariaValuemax: e.getAttribute("aria-valuemax"),
      dataDisabled: e.getAttribute("data-disabled"),
      dataIndex: e.getAttribute("data-index"),
      classList: Array.from(e.classList).slice(0, 3),
      childCount: e.children.length,
      childHTML: e.innerHTML.slice(0, 200),
      parentRole: e.parentElement?.getAttribute("role"),
      // Walk up to the SliderPrimitive.Root for context
      rootSlot: e.closest('[data-slot="slider"]')?.outerHTML.slice(0, 300),
    }));
    console.log(`thumb[${i}] (1-indexed: ${i + 1}):`, JSON.stringify(info, null, 2));
  }
  console.log("--- end dump ---\n");

  // Real-user interaction: click the thumb itself (using `force: true`
  // to bypass the actionability check, which fails on the 1×1 hidden
  // input that BaseUI nests inside — see helpers/audit.ts comment).
  // BaseUI's onClick on the thumb routes focus to the hidden input;
  // the subsequent ArrowRight is then handled correctly.
  //
  // Re-fetching the bounding box and re-scrolling per iteration matters
  // because earlier slider changes can shift layout slightly (the value
  // span "5 / 10" → "6 / 10" is the same width but renders cause flush).
  for (let i = 0; i < 7; i++) {
    const thumb = thumbs.nth(i);
    await thumb.scrollIntoViewIfNeeded();
    await page.waitForTimeout(50);

    const before =
      (await valueDisplays.nth(i).textContent()) ?? "<missing>";

    // force:true bypasses Playwright's actionability check (which
    // would fail on the visually-hidden inner input). We trust the
    // thumb is interactive because BaseUI's design says so.
    await thumb.click({ force: true });
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);

    const after = (await valueDisplays.nth(i).textContent()) ?? "<missing>";
    expect
      .soft(
        after,
        `Slider ${i + 1}/7 did not respond — before="${before}" after="${after}"`,
      )
      .not.toBe(before);
  }
});
