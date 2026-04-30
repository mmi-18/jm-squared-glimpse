import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Interactive element audit — visits every route in the lists below and
 * runs a "trial click" on every visible interactive element on each page.
 *
 * Trial click (Playwright's `element.click({ trial: true })`) performs the
 * full actionability check — visible, enabled, stable, hittable, has a
 * non-zero hit area — but doesn't actually fire the click handler. So the
 * audit is non-destructive: nothing gets clicked, no posts get deleted,
 * no navigation happens.
 *
 * Skip rules (intentional, not bugs):
 *   - hidden elements
 *   - explicitly `disabled` HTML buttons / inputs
 *   - elements with `aria-disabled="true"`
 *
 * Anything left over that fails actionability is reported as a finding —
 * the test message names the element so you know exactly what's broken.
 */

// Stable IDs from the migrated seed data — kept here so deep-link tests
// don't depend on whatever happens to be the latest row.
const KIRI = {
  id: "fc99f0ee-f9fb-4399-91a5-a87f54ff1379",
  email: "kiri@seed.glimpse.app",
};
const VOLTFANG = { id: "9e35ad25-44d7-45cf-acd3-c7780319d429" };
const POST = { id: "a3f9f6ac-e7fd-47df-af13-9ad70422c258" };
const SHARED_PASSWORD = "glimpse-seed-2026";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  `/creator/${KIRI.id}`,
  `/startup/${VOLTFANG.id}`,
  `/post/${POST.id}`,
];

const AUTHED_ROUTES = [
  "/feed",
  "/inbox",
  "/new-post",
  "/membership",
  "/onboarding/creator",
  "/onboarding/startup",
];

const INTERACTIVE_SELECTOR = [
  "button",
  'input:not([type="hidden"]):not([type="file"])',
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

type Finding = { selector: string; error: string };

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
    return true; // detached → skip
  }
}

async function auditRoute(page: Page, route: string): Promise<Finding[]> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // Let client-side hydration + any data fetching settle. networkidle can
  // hang on apps with long-poll connections, so cap at 5s.
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => {});

  const elements = await page.locator(INTERACTIVE_SELECTOR).all();
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
      // can't scroll into view → trial click will likely fail too,
      // let it surface that error
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

function formatFindings(route: string, findings: Finding[]): string {
  if (findings.length === 0) return "";
  const lines = [
    `${findings.length} unactionable element(s) on ${route}:`,
    ...findings.map((f) => `  • ${f.selector}\n    → ${f.error}`),
  ];
  return lines.join("\n");
}

test.describe.configure({ mode: "serial" });

test.describe("interaction audit — public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`audit ${route}`, async ({ page }) => {
      const findings = await auditRoute(page, route);
      // soft expect → collect findings across the whole suite, don't bail
      // on the first failure. The full picture matters more than the
      // first broken element.
      expect.soft(findings, formatFindings(route, findings)).toEqual([]);
    });
  }
});

test.describe("interaction audit — authed routes (signed in as Kiri)", () => {
  // Reuse the cookies the auth-setup project wrote — no per-test login,
  // no rate-limit flakes against BetterAuth.
  test.use({ storageState: "tests/e2e/.auth/kiri.json" });

  for (const route of AUTHED_ROUTES) {
    test(`audit ${route}`, async ({ page }) => {
      const findings = await auditRoute(page, route);
      expect.soft(findings, formatFindings(route, findings)).toEqual([]);
    });
  }
});
