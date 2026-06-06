import type { Page } from "@playwright/test";

export function adminCredentials(): { email: string; password: string } | null {
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function loginAsAdmin(page: Page): Promise<boolean> {
  const creds = adminCredentials();
  if (!creds) return false;

  await page.goto("/auth");
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  return true;
}
