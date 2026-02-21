import { expect, test } from "@playwright/test";

const warehouseBaseUrl = process.env.PLAYWRIGHT_WAREHOUSE_BASE_URL ?? "http://host.docker.internal:3004";

test("warehouse queues actions offline and replays on reconnect", async ({ browser, page }) => {
  await page.goto("/infinity");

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill("jhalpert");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/(\/infinity$|:3001\/?$)/);

  const clientId = `client_pr8_${Date.now()}`;
  await page.locator("#clientId").fill(clientId);
  await page.locator("#requestedShipDate").fill(tomorrowAsIsoDate());
  await page.locator("#sku").fill("PPR-A4-WHT-500");
  await page.locator("#quantity").fill("4");
  await page.locator("#notes").fill("PR8 offline queue replay");
  await page.locator("#place-order-btn").click();

  await expect(page.locator("#order-success")).toContainText(/Order ord_\d+ created with status CREATED/);
  const successText = await page.locator("#order-success").textContent();
  const orderIdMatch = successText?.match(/Order\s+(ord_\d+)\s+created/i);
  expect(orderIdMatch?.[1]).toBeTruthy();
  const orderId = orderIdMatch![1];

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

  await warehouseContext.setOffline(true);

  await warehousePage.getByTestId("warehouse-mock-barcode").fill("SKU:PPR-A4-WHT-500");
  await warehousePage.getByTestId("warehouse-mock-qty").fill("4");
  await warehousePage.getByTestId("warehouse-mock-scan-btn").click();
  await expect(warehousePage.getByTestId("warehouse-notice")).toContainText("Queued scan");

  await warehousePage.getByTestId("warehouse-dispatch-btn").click();
  await expect(warehousePage.getByTestId("warehouse-notice")).toContainText("Queued dispatch");
  await expect(warehousePage.getByTestId("warehouse-queue-count")).toContainText("2 queued action(s)");

  await warehouseContext.setOffline(false);

  const syncButton = warehousePage.getByTestId("warehouse-sync-now-btn");
  if (await syncButton.isEnabled()) {
    await syncButton.click();
  }

  await expect(warehousePage.getByTestId("warehouse-queue-count")).toContainText("0 queued action(s)");
  await expect(warehousePage.getByTestId("warehouse-notice")).toContainText("Synced");

  await closeContextIgnoreArtifactsError(warehouseContext);

  await page.locator("#refresh-history-btn").click();
  await expect(page.locator("#history-body")).toContainText(orderId);
  await expect(page.locator("#history-body")).toContainText("SHIPPED");
});

function tomorrowAsIsoDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

async function closeContextIgnoreArtifactsError(context: { close: () => Promise<void> }) {
  try {
    await context.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ENOENT")) {
      throw error;
    }
  }
}
