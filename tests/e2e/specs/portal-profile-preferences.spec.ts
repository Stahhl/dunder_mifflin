import { Page, expect, test } from "@playwright/test";

test("portal profile preferences persist and default app route is applied after re-login", async ({ page }) => {
  await loginViaGateway(page, "/portal", "jhalpert", "password");

  await expect(page.locator(".portal-header__title")).toHaveText("Scranton Portal");
  await page.getByRole("link", { name: /Profile & preferences/i }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.locator("#profile-settings-form")).toBeVisible();

  const stamp = Date.now();
  const fullName = `Jim Halpert PR12 ${stamp}`;
  const email = `jim.pr12.${stamp}@dundermifflin.test`;
  const title = "Assistant Regional Manager";
  const phone = "570-555-0112";

  await page.locator("#profile-full-name").fill(fullName);
  await page.locator("#profile-email").fill(email);
  await page.locator("#profile-title").fill(title);
  await page.locator("#profile-phone").fill(phone);
  await page.locator("#profile-default-app").selectOption("infinity");
  await page.locator("#profile-notifications-enabled").uncheck();
  await page.locator("#save-profile-btn").click();

  await expect(page.locator("#profile-success")).toContainText("Profile and preferences saved.");

  await page.reload();
  await expect(page.locator("#profile-full-name")).toHaveValue(fullName);
  await expect(page.locator("#profile-email")).toHaveValue(email);
  await expect(page.locator("#profile-title")).toHaveValue(title);
  await expect(page.locator("#profile-phone")).toHaveValue(phone);
  await expect(page.locator("#profile-default-app")).toHaveValue("infinity");
  await expect(page.locator("#profile-notifications-enabled")).not.toBeChecked();

  await page.getByRole("button", { name: /Log out/i }).click();
  await expect(page).toHaveURL(/:8081\/$/);

  await loginViaGateway(page, "/portal", "jhalpert", "password");
  await expect(page).toHaveURL(/\/apps\/infinity$/);
  await expect(page.getByRole("heading", { name: /Infinity/i })).toBeVisible();
  await expect(page.getByText(/Continue to Infinity/i)).toBeVisible();

  await page.getByRole("link", { name: /Profile & preferences/i }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.locator("#profile-settings-form")).toBeVisible();
  await expect(page.locator("#profile-full-name")).toHaveValue(fullName);
  await expect(page.locator("#profile-default-app")).toHaveValue("infinity");
});

async function loginViaGateway(page: Page, path: string, username: string, password: string) {
  await page.goto(path);

  const loginForm = page.locator("#kc-form-login");
  const requiresCredentials = await loginForm.isVisible({ timeout: 5000 }).catch(() => false);
  if (requiresCredentials) {
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
  }
}
