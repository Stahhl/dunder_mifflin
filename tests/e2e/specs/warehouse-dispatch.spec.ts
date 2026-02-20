import { expect, test } from "@playwright/test";

const warehouseBaseUrl = process.env.PLAYWRIGHT_WAREHOUSE_BASE_URL ?? "http://host.docker.internal:3004";

test("warehouse mobile can dispatch shipment and sales sees SHIPPED", async ({ browser, page }) => {
  await page.goto("/infinity");

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill("jhalpert");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/\/infinity$/);

  const clientId = `client_pr4_${Date.now()}`;
  const requestedShipDate = tomorrowAsIsoDate();

  await page.locator("#clientId").fill(clientId);
  await page.locator("#requestedShipDate").fill(requestedShipDate);
  await page.locator("#sku").fill("PPR-A4-WHT-500");
  await page.locator("#quantity").fill("6");
  await page.locator("#notes").fill("PR4 warehouse dispatch flow");
  await page.locator("#place-order-btn").click();

  await expect(page.locator("#order-success")).toContainText(/Order ord_\d+ created with status CREATED/);
  const successText = await page.locator("#order-success").textContent();
  const orderIdMatch = successText?.match(/Order\s+(ord_\d+)\s+created/i);
  expect(orderIdMatch?.[1]).toBeTruthy();
  const orderId = orderIdMatch![1];

  await expect(page.locator("#history-body")).toContainText(orderId);
  await expect(page.locator("#history-body")).toContainText("CREATED");

  const warehouseContext = await browser.newContext();
  const warehousePage = await warehouseContext.newPage();

  await warehousePage.goto(warehouseBaseUrl);
  await expect(warehousePage.getByTestId("warehouse-sign-in-btn")).toBeVisible();
  await warehousePage.getByTestId("warehouse-sign-in-btn").click();

  await expect(warehousePage.locator("#kc-form-login")).toBeVisible();
  await warehousePage.locator("#username").fill("dphilbin");
  await warehousePage.locator("#password").fill("password");
  await warehousePage.locator("#kc-login").click();

  await expect(warehousePage).toHaveURL(/host\.docker\.internal:3004|localhost:3004/);
  await expect(warehousePage.getByTestId("warehouse-user-label")).toContainText("dphilbin");

  await warehousePage.getByTestId("warehouse-refresh-btn").click();

  const shipmentCard = warehousePage.locator("[data-testid^='shipment-']").filter({ hasText: orderId }).first();
  await expect(shipmentCard).toBeVisible();
  await shipmentCard.click();

  await warehousePage.getByTestId("warehouse-mock-barcode").fill("SKU:PPR-A4-WHT-500");
  await warehousePage.getByTestId("warehouse-mock-qty").fill("6");
  await warehousePage.getByTestId("warehouse-mock-scan-btn").click();
  await expect(warehousePage.getByTestId("warehouse-notice")).toContainText("Scanned SKU:PPR-A4-WHT-500 x6");

  await warehousePage.getByTestId("warehouse-dispatch-btn").click();
  await expect(warehousePage.getByTestId("warehouse-notice")).toContainText("Order is now SHIPPED");

  await warehouseContext.close();

  await page.locator("#refresh-history-btn").click();
  await expect(page.locator("#history-body")).toContainText(orderId);
  await expect(page.locator("#history-body")).toContainText("SHIPPED");
});

function tomorrowAsIsoDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}
