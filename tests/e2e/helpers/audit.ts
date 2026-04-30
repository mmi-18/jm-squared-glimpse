/**
 * Shared interactive-element audit helper.
 *
 * `auditCurrentView(page)` walks every visible interactive element on the
 * page in its CURRENT state (whatever step / modal / panel is open) and
 * runs Playwright's trial-click actionability check on each. Returns a
 * list of findings — empty list = everything's interactable.
 *
 * Trial click is non-destructive: it runs the full check (visible,
 * enabled, stable, hittable, non-zero hit area) but doesn't fire the
 * onClick handler, so audits can't accidentally mutate state.
 *
 * Skip rules (intentional, not bugs):
 *   - hidden / invisible elements
 *   - explicitly `disabled` HTML buttons + inputs
 *   - elements with `aria-disabled="true"`
 */
import type { Locator, Page } from "@playwright/test";

export type Finding = { selector: string; error: string };

export const INTERACTIVE_SELECTOR = [
  "button",
  // Skip type=range: BaseUI / shadcn sliders render the underlying
  // `<input type="range">` as a 1×1 visually-hidden a11y proxy and put a
  // `<div data-slot="slider-thumb">` on top as the real interaction
  // surface. The hidden input correctly fails an actionability check —
  // but it's not what the user clicks. Audit `[role="slider"]` (the
  // thumb) instead, which is included below.
  'input:not([type="hidden"]):not([type="file"]):not([type="range"])',
  "textarea",
  "select",
  'a[href]:not([href=""]):not([href="#"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="link"]',
].join(", ");

async function describeElement(el: Locator): Promise<string> {
  try {
    return await el.evaluate((e: Element) => {
      const tag = e.tagName.toLowerCase();
      const id = e.getAttribute("id");
      const role = e.getAttribute("role");
      const aria = e.getAttribute("aria-label");
      const name = (e as HTMLInputElement).name;
      const type = (e as HTMLInputElement).type;
      const text = (e.textContent ?? "").trim().slice(0, 60);
      const parts = [tag];
      if (id) parts.push(`#${id}`);
      if (name) parts.push(`[name="${name}"]`);
      if (type && tag === "input") parts.push(`[type="${type}"]`);
      if (role) parts.push(`[role="${role}"]`);
      if (aria) parts.push(`[aria-label="${aria}"]`);
      if (text) parts.push(`"${text}"`);
      return parts.join("");
    });
  } catch {
    return "<element gone>";
  }
}

async function isExplicitlyDisabled(el: Locator): Promise<boolean> {
  try {
    return await el.evaluate((e: Element) => {
      if ((e as HTMLButtonElement).disabled === true) return true;
      if (e.getAttribute("aria-disabled") === "true") return true;
      return false;
    });
  } catch {
    return true;
  }
}

export async function auditCurrentView(
  page: Page,
  scope?: Locator,
): Promise<Finding[]> {
  const root = scope ?? page;
  const elements = await root.locator(INTERACTIVE_SELECTOR).all();
  const findings: Finding[] = [];

  for (const el of elements) {
    let visible = false;
    try {
      visible = await el.isVisible({ timeout: 500 });
    } catch {
      continue;
    }
    if (!visible) continue;
    if (await isExplicitlyDisabled(el)) continue;

    try {
      await el.scrollIntoViewIfNeeded({ timeout: 1_000 });
    } catch {
      // can't scroll — let trial click surface the issue
    }

    try {
      await el.click({ trial: true, timeout: 2_000 });
    } catch (err) {
      const desc = await describeElement(el);
      const msg = (err instanceof Error ? err.message : String(err))
        .split("\n")[0]
        .replace(/^locator\.click: /, "")
        .slice(0, 220);
      findings.push({ selector: desc, error: msg });
    }
  }

  return findings;
}

export async function auditRoute(
  page: Page,
  route: string,
): Promise<Finding[]> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => {});
  return auditCurrentView(page);
}

export function formatFindings(label: string, findings: Finding[]): string {
  if (findings.length === 0) return "";
  return [
    `${findings.length} unactionable element(s) at ${label}:`,
    ...findings.map((f) => `  • ${f.selector}\n    → ${f.error}`),
  ].join("\n");
}
