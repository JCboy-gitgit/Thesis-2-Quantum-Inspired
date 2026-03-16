import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("form.form", { timeout: 15_000 });
  });

  test("renders login form with email and password inputs", async ({
    page,
  }) => {
    const emailInput = page.locator('form.form input[type="email"]').first();
    const passwordInput = page
      .locator('form.form input[type="password"]')
      .first();
    const loginButton = page.getByRole("button", { name: "LOGIN" });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
  });

  test("shows validation error for invalid email format", async ({ page }) => {
    const emailInput = page.locator('form.form input[type="email"]').first();
    const passwordInput = page
      .locator('form.form input[type="password"]')
      .first();

    await emailInput.fill("not-an-email");
    await passwordInput.fill("password123");
    await page.getByRole("button", { name: "LOGIN" }).click();

    // App validates with regex and shows .message.error
    const errorMsg = page.locator(".message.error");
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
  });

  test("shows error for wrong credentials", async ({ page }) => {
    const emailInput = page.locator('form.form input[type="email"]').first();
    const passwordInput = page
      .locator('form.form input[type="password"]')
      .first();

    await emailInput.fill("wrong@example.com");
    await passwordInput.fill("wrongpassword123");
    await page.getByRole("button", { name: "LOGIN" }).click();

    const errorMsg = page.locator(".message.error");
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });
  });

  test("shows error for short password", async ({ page }) => {
    const emailInput = page.locator('form.form input[type="email"]').first();
    const passwordInput = page
      .locator('form.form input[type="password"]')
      .first();

    await emailInput.fill("test@example.com");
    await passwordInput.fill("123"); // less than 6 chars
    await page.getByRole("button", { name: "LOGIN" }).click();

    const errorMsg = page.locator(".message.error");
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
  });

  test("can switch to signup tab", async ({ page }) => {
    const signupLink = page.locator(".link-button", {
      hasText: /sign up/i,
    });
    await signupLink.click();

    // Signup form should show Full Name field
    const fullNameInput = page.getByPlaceholder("Juan Dela Cruz");
    await expect(fullNameInput).toBeVisible({ timeout: 5_000 });
  });

  test("password visibility toggle works", async ({ page }) => {
    const passwordInput = page
      .locator('form.form input[type="password"]')
      .first();
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = page.locator(".toggle-password").first();
    await toggleButton.click();

    // After clicking toggle, input type changes to 'text'
    const visibleInput = page
      .locator(".password-input-wrapper input")
      .first();
    await expect(visibleInput).toHaveAttribute("type", "text");
  });
});
