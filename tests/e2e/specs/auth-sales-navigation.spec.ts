import { expect, test } from "@playwright/test";

test("sales app route redirects to Keycloak and returns after login", async ({ page }) => {
  await page.goto("/infinity");

  await expect(page.locator("#kc-form-login")).toBeVisible();

  await page.locator("#username").fill("jhalpert");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/\/infinity$/);
  await expect(page.getByRole("heading", { name: /Infinity Sales App/ })).toBeVisible();
  await expect(page.getByText("Place Paper Order")).toBeVisible();
});
