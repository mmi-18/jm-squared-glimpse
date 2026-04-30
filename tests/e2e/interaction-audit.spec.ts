import { test, expect } from "@playwright/test";
import { auditRoute, formatFindings } from "./helpers/audit";

/**
 * Interactive element audit — visits every route in the lists below and
 * runs a "trial click" on every visible interactive element on each page.
 * See helpers/audit.ts for the actionability check + skip rules.
 *
 * What this CAN'T see (covered by other specs):
 *   - elements rendered behind a wizard step / dialog / dropdown that
 *     hasn't been opened yet — see wizard-audit.spec.ts
 *   - state that requires owning a specific resource — see
 *     owner-affordance-audit.spec.ts (when added)
 */

const KIRI = { id: "fc99f0ee-f9fb-4399-91a5-a87f54ff1379" };
const VOLTFANG = { id: "9e35ad25-44d7-45cf-acd3-c7780319d429" };
const POST = { id: "a3f9f6ac-e7fd-47df-af13-9ad70422c258" };

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

test.describe.configure({ mode: "serial" });

test.describe("interaction audit — public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`audit ${route}`, async ({ page }) => {
      const findings = await auditRoute(page, route);
      expect.soft(findings, formatFindings(route, findings)).toEqual([]);
    });
  }
});

test.describe("interaction audit — authed routes (signed in as Kiri)", () => {
  test.use({ storageState: "tests/e2e/.auth/kiri.json" });

  for (const route of AUTHED_ROUTES) {
    test(`audit ${route}`, async ({ page }) => {
      const findings = await auditRoute(page, route);
      expect.soft(findings, formatFindings(route, findings)).toEqual([]);
    });
  }
});
