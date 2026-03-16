import { test, expect } from "@playwright/test";
import { loginAsFaculty } from "../helpers/auth";
import { FACULTY_PAGES } from "../config/constants";
import { TEST_CONFIG } from "../config/env";

test.describe("Faculty Pages - Authenticated", () => {
  test.skip(
    !TEST_CONFIG.FACULTY_EMAIL || !TEST_CONFIG.FACULTY_PASSWORD,
    "Skipped: set TEST_FACULTY_EMAIL and TEST_FACULTY_PASSWORD env vars"
  );

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsFaculty(page);
    await context.storageState({ path: "tests/.auth/faculty.json" });
    await context.close();
  });

  test.use({ storageState: "tests/.auth/faculty.json" });

  for (const facultyPage of FACULTY_PAGES) {
    test(`loads ${facultyPage.name} (${facultyPage.path})`, async ({
      page,
    }) => {
      const response = await page.goto(facultyPage.path, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      expect(response?.status()).toBeLessThan(500);

      await page.waitForTimeout(2_000);

      // Should NOT have been redirected to login
      const currentUrl = page.url();
      const isOnLoginPage =
        currentUrl.endsWith("/") &&
        !currentUrl.includes("LandingPages") &&
        !currentUrl.includes("faculty");

      if (isOnLoginPage) {
        const loginForm = page
          .locator('form.form input[type="email"]')
          .first();
        const isLoginVisible = await loginForm.isVisible().catch(() => false);
        expect(
          isLoginVisible,
          `Redirected to login on ${facultyPage.path} -- auth state invalid`
        ).toBe(false);
      }

      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});
