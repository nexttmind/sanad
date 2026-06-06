import { test, expect } from "@playwright/test";
import { adminCredentials, loginAsAdmin } from "./helpers/auth";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

const PUBLIC_ROUTES = [
  { path: "/", slug: "home" },
  { path: "/donate", slug: "donate" },
  { path: "/track", slug: "track" },
  { path: "/auth", slug: "auth" },
] as const;

const ADMIN_ROUTES = [
  { path: "/admin", slug: "admin-overview" },
  { path: "/admin/queue", slug: "admin-queue" },
  { path: "/admin/requests", slug: "admin-requests" },
  { path: "/admin/donations", slug: "admin-donations" },
  { path: "/admin/references", slug: "admin-references" },
  { path: "/admin/distribution", slug: "admin-distribution" },
  { path: "/admin/analytics", slug: "admin-analytics" },
  { path: "/admin/scoring", slug: "admin-scoring" },
  { path: "/admin/users", slug: "admin-users" },
  { path: "/admin/audit", slug: "admin-audit" },
] as const;

const hasAdminCreds = Boolean(adminCredentials());

for (const route of PUBLIC_ROUTES) {
  for (const vp of VIEWPORTS) {
    test(`public ${route.slug} @ ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`${route.slug}-${vp.name}.png`, {
        fullPage: true,
      });
    });
  }
}

test.describe("admin routes", () => {
  test.skip(
    !hasAdminCreds,
    "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD for admin visual tests.",
  );

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ADMIN_ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route.slug} @ ${vp.width}px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        await expect(page).toHaveScreenshot(`${route.slug}-${vp.name}.png`, {
          fullPage: true,
        });
      });
    }
  }
});
