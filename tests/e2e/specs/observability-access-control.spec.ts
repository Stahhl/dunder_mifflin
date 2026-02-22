import { Page, expect, test } from "@playwright/test";

const grafanaBaseUrl = process.env.PLAYWRIGHT_GRAFANA_BASE_URL ?? "http://host.docker.internal:3005";

test("it-support user can sign in to Grafana with viewer access", async ({ page }) => {
  await loginToGrafana(page, "nick", "password");

  await expect(page).toHaveURL(/host\.docker\.internal:3005|localhost:3005/);

  await expect
    .poll(async () => {
      const response = await page.context().request.get(`${grafanaBaseUrl}/api/user`);
      if (response.status() !== 200) {
        return `status:${response.status()}`;
      }

      const payload = (await response.json()) as { login?: string };
      return payload.login ?? "missing";
    })
    .toContain("nick");
});

test("non it-support user cannot sign in to Grafana", async ({ page }) => {
  await loginToGrafana(page, "jhalpert", "password");

  await expect(page).toHaveURL(/host\.docker\.internal:3005\/login|localhost:3005\/login/);
  await expect(page.getByText(/Sign in with Keycloak/i)).toBeVisible();

  await expect
    .poll(async () => {
      const response = await page.context().request.get(`${grafanaBaseUrl}/api/user`);
      return response.status();
    })
    .toBe(401);
});

async function loginToGrafana(page: Page, username: string, password: string) {
  await page.goto(grafanaBaseUrl);
  const signInAction = page.getByText(/Sign in with Keycloak/i).first();
  await expect(signInAction).toBeVisible();
  await signInAction.click();

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
}
