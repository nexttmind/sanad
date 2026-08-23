import { test, expect, type Page } from "@playwright/test";
import { adminCredentials, loginAsAdmin } from "./helpers/auth";

const hasAdminCreds = Boolean(adminCredentials());
const LIST_STATE_KEY = "sanad-admin-requests-list-ui";

async function mockAdminUsersList(page: Page) {
  await page.route("**/rest/v1/rpc/list_admin_users", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          user_id: "existing-user",
          email: "staff@sanad.lb",
          display_name: "Staff User",
          role: "reviewer",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
          last_sign_in_at: null,
        },
      ]),
    });
  });
}

test.describe("session fixes regression", () => {
  test.describe("admin user create", () => {
    test.skip(!hasAdminCreds, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD.");

    test.beforeEach(async ({ page }) => {
      await mockAdminUsersList(page);
      await loginAsAdmin(page);
    });

    test("shows server message from HTTP error when create fails", async ({ page }) => {
      await page.route("**/functions/v1/admin-user-management", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, message: "هذا البريد مسجّل مسبقاً." }),
        });
      });

      await page.goto("/admin/users");
      await page.getByRole("button", { name: "+ مستخدم جديد" }).click();
      await page.getByPlaceholder("الاسم الكامل").fill("مستخدم تجريبي");
      await page.getByPlaceholder("البريد الإلكتروني").fill("new-user@sanad.lb");
      await page.getByPlaceholder("كلمة المرور (8+ أحرف)").fill("secret1234");
      await page.getByRole("button", { name: "إنشاء" }).click();

      await expect(page.getByText("هذا البريد مسجّل مسبقاً.")).toBeVisible();
      await expect(page.getByText("تعذّر تنفيذ العملية.")).not.toBeVisible();
    });

    test("closes create form after successful create", async ({ page }) => {
      await page.route("**/functions/v1/admin-user-management", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, user_id: "created-user-id" }),
        });
      });

      await page.goto("/admin/users");
      await page.getByRole("button", { name: "+ مستخدم جديد" }).click();
      await page.getByPlaceholder("الاسم الكامل").fill("مستخدم جديد");
      await page.getByPlaceholder("البريد الإلكتروني").fill("created@sanad.lb");
      await page.getByPlaceholder("كلمة المرور (8+ أحرف)").fill("secret1234");
      await page.getByRole("button", { name: "إنشاء" }).click();

      await expect(page.getByText("مستخدم جديد")).toBeHidden();
      await expect(page.getByRole("button", { name: "+ مستخدم جديد" })).toBeVisible();
    });
  });

  test.describe("admin requests list state", () => {
    test.skip(!hasAdminCreds, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD.");

    test("restores saved list filters from sessionStorage", async ({ page }) => {
      await page.addInitScript(
        ({ key }) => {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              q: "",
              status: "all",
              risk: "all",
              tier: "all",
              governorate: "all",
              tagIds: [],
              createdFrom: "",
              createdTo: "",
              pageSize: 25,
              dailyBatchEnabled: false,
              batchDate: "2026-08-23",
              batchNumber: 1,
              assignFilter: "all",
              trustMin: "",
              trustMax: "",
              urgencyMin: "",
              urgencyMax: "",
              queueFrom: "",
              queueTo: "",
              hasFlags: false,
              needs: [],
              referenceResult: "all",
              showAdvancedFilters: false,
              urlSearch: { sort: "created_at", dir: "desc" },
              scrollY: 0,
              loadedPages: 1,
            }),
          );
        },
        { key: LIST_STATE_KEY },
      );

      await loginAsAdmin(page);
      await page.goto("/admin/requests?sort=created_at&dir=desc");
      await page.waitForLoadState("networkidle");

      const batchToggle = page.getByRole("checkbox", { name: /وضع الدفعة اليومية/ });
      await expect(batchToggle).not.toBeChecked();
      await expect(page).toHaveURL(/sort=created_at/);
      await expect(page).toHaveURL(/dir=desc/);
    });
  });

  test.describe("admin analytics regions", () => {
    test.skip(!hasAdminCreds, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD.");

    test("labels regional chart by current residence", async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/analytics");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("المناطق الحالية الأكثر طلباً")).toBeVisible();
      await expect(page.getByText("موقع الإقامة الحالي")).toBeVisible();
    });
  });
});
