import { expect, test } from "@playwright/test";

test("sales user can load timeline details for a created order", async ({ page }) => {
  await page.goto("/infinity");

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill("jhalpert");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/(\/infinity$|:3001\/?$)/);
  await expect(page.getByRole("heading", { name: /Infinity Sales App/ })).toBeVisible();

  const clientId = `client_pr5_${Date.now()}`;
  const requestedShipDate = tomorrowAsIsoDate();

  await page.locator("#clientId").fill(clientId);
  await page.locator("#requestedShipDate").fill(requestedShipDate);
  await page.locator("#sku").fill("PPR-A4-WHT-500");
  await page.locator("#quantity").fill("3");
  await page.locator("#notes").fill("PR5 timeline coverage");
  await page.locator("#place-order-btn").click();

  await expect(page.locator("#order-success")).toContainText(/Order ord_\d+ created with status CREATED/);
  const successText = await page.locator("#order-success").textContent();
  const orderIdMatch = successText?.match(/Order\s+(ord_\d+)\s+created/i);
  expect(orderIdMatch?.[1]).toBeTruthy();
  const orderId = orderIdMatch![1];

  const orderRow = page.locator("#history-body tr", { hasText: orderId }).first();
  await expect(orderRow).toBeVisible();
  await orderRow.getByRole("button", { name: "View Timeline" }).click();

  await expect(page.locator("#timeline-meta")).toContainText(orderId);
  await expect(page.locator("#timeline-list")).toContainText("CREATED");
});

function tomorrowAsIsoDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}
