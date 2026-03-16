import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { ADMIN_PAGES } from "../config/constants";
import { TEST_CONFIG } from "../config/env";

test.describe("Admin Pages - Authenticated", () => {
  test.skip(
    !TEST_CONFIG.ADMIN_EMAIL || !TEST_CONFIG.ADMIN_PASSWORD,
    "Skipped: set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars"
  );

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsAdmin(page);
    await context.storageState({ path: "tests/.auth/admin.json" });
    await context.close();
  });

  test.use({ storageState: "tests/.auth/admin.json" });

  for (const adminPage of ADMIN_PAGES) {
    test(`loads ${adminPage.name} (${adminPage.path})`, async ({ page }) => {
      const response = await page.goto(adminPage.path, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Should not return a server error
      expect(response?.status()).toBeLessThan(500);

      // Wait for page to settle
      await page.waitForTimeout(2_000);

      // Should NOT have been redirected back to the login page
      const currentUrl = page.url();
      const isOnLoginPage =
        currentUrl.endsWith("/") &&
        !currentUrl.includes("LandingPages") &&
        !currentUrl.includes("faculty");

      if (isOnLoginPage) {
        // Double-check by looking for the login form
        const loginForm = page
          .locator('form.form input[type="email"]')
          .first();
        const isLoginVisible = await loginForm.isVisible().catch(() => false);
        expect(
          isLoginVisible,
          `Redirected to login on ${adminPage.path} -- auth state invalid`
        ).toBe(false);
      }

      // Page body should have content
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});
