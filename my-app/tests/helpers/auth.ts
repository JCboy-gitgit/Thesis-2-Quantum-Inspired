import { Page } from "@playwright/test";
import { TEST_CONFIG } from "../config/env";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("form.form", { timeout: 15_000 });

  const emailInput = page.locator('form.form input[type="email"]').first();
  await emailInput.fill(TEST_CONFIG.ADMIN_EMAIL);

  const passwordInput = page
    .locator('form.form input[type="password"]')
    .first();
  await passwordInput.fill(TEST_CONFIG.ADMIN_PASSWORD);

  await page.getByRole("button", { name: "LOGIN" }).click();

  await page.waitForURL("**/LandingPages/Home", { timeout: 30_000 });
}

export async function loginAsFaculty(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("form.form", { timeout: 15_000 });

  const emailInput = page.locator('form.form input[type="email"]').first();
  await emailInput.fill(TEST_CONFIG.FACULTY_EMAIL);

  const passwordInput = page
    .locator('form.form input[type="password"]')
    .first();
  await passwordInput.fill(TEST_CONFIG.FACULTY_PASSWORD);

  await page.getByRole("button", { name: "LOGIN" }).click();

  await page.waitForURL("**/faculty/home", { timeout: 30_000 });
}
