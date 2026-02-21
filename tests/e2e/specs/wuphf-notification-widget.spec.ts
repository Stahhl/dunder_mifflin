import { Browser, expect, Page, test } from "@playwright/test";

const gatewayBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8081";

interface WarehouseShipmentsResponse {
  items: Array<{
    shipmentId: string;
    orderId: string;
  }>;
}

test("infinity widget shows order placement and shipment notifications", async ({ page, browser }) => {
  await loginViaGateway(page, "/infinity", "jhalpert", "password");
  await expect(page.getByRole("heading", { name: /Infinity Sales App/ })).toBeVisible();

  const marker = `${Date.now()}`;
  const clientId = `client_pr7_${marker}`;

  await page.locator("#clientId").fill(clientId);
  await page.locator("#requestedShipDate").fill(tomorrowAsIsoDate());
  await page.locator("#sku").fill("PPR-A4-WHT-500");
  await page.locator("#quantity").fill("2");
  await page.locator("#notes").fill(`PR7 widget check ${marker}`);
  await page.locator("#place-order-btn").click();

  await expect(page.locator("#order-success")).toContainText(/Order ord_\d+ created with status CREATED/);
  const successText = await page.locator("#order-success").textContent();
  const orderIdMatch = successText?.match(/Order\s+(ord_\d+)\s+created/i);
  expect(orderIdMatch?.[1]).toBeTruthy();
  const orderId = orderIdMatch![1];

  await openWidgetPanel(page);
  await expect(page.getByTestId("wuphf-list")).toContainText(`Order ${orderId} created`);

  await dispatchShipmentForOrder(orderId, browser);

  await page.locator("[data-wuphf-action='refresh']").click();
  await expect(page.getByTestId("wuphf-list")).toContainText(`Order ${orderId} shipped`);

  await page.getByTestId("wuphf-list").getByRole("button", { name: `Order ${orderId} shipped` }).first().click();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return url.searchParams.get("orderId");
    })
    .toBe(orderId);
  await expect(page.locator("#timeline-meta")).toContainText(orderId);
});

test("accounting widget shows expense decision notification", async ({ page }) => {
  await loginViaGateway(page, "/accounting", "amartin", "password");
  await expect(page.getByRole("heading", { name: /Accounting Suite/ })).toBeVisible();

  const marker = `${Date.now()}`;
  await page.locator("#description").fill(`PR7 expense notification ${marker}`);
  await page.getByTestId("accounting-create-btn").click();

  await expect(page.getByTestId("accounting-notice")).toContainText(/Expense exp_\d+ created with status PENDING/);
  const createdText = await page.getByTestId("accounting-notice").textContent();
  const expenseIdMatch = createdText?.match(/Expense\s+(exp_\d+)\s+created/i);
  expect(expenseIdMatch?.[1]).toBeTruthy();
  const expenseId = expenseIdMatch![1];

  await page.getByTestId(`accounting-select-${expenseId}`).click();
  await page.getByTestId("accounting-decision").selectOption("REJECTED");
  await page.getByTestId("accounting-comment").fill(`PR7 rejection ${marker}`);
  await page.getByTestId("accounting-submit-decision").click();

  await expect(page.getByTestId("accounting-notice")).toContainText(`Expense ${expenseId} updated to REJECTED`);

  await openWidgetPanel(page);
  await page.locator("[data-wuphf-action='refresh']").click();
  await expect(page.getByTestId("wuphf-list")).toContainText(`Expense ${expenseId} REJECTED`);
});

async function loginViaGateway(page: Page, path: string, username: string, password: string) {
  await page.goto(path);

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
}

async function openWidgetPanel(page: Page) {
  const toggle = page.getByTestId("wuphf-toggle");
  await expect(toggle).toBeVisible();

  const expanded = await toggle.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await toggle.click();
  }

  await expect(page.getByTestId("wuphf-panel")).toBeVisible();
}

async function dispatchShipmentForOrder(orderId: string, browser: Browser) {
  const warehouseContext = await browser.newContext({ baseURL: gatewayBaseUrl });
  const warehousePage = await warehouseContext.newPage();
  await loginViaGateway(warehousePage, "/infinity", "dphilbin", "password");
  await expect(warehousePage.getByRole("heading", { name: /Access denied/i })).toBeVisible();

  const listResponse = await warehouseContext.request.get(`${gatewayBaseUrl}/api/v1/warehouse/shipments?status=PENDING`, {
    headers: {
      accept: "application/json"
    }
  });

  expect(listResponse.ok).toBeTruthy();
  const listPayload = (await listResponse.json()) as WarehouseShipmentsResponse;

  const shipment = listPayload.items.find((item) => item.orderId === orderId);
  expect(shipment?.shipmentId).toBeTruthy();

  const dispatchResponse = await warehouseContext.request.post(
    `${gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(shipment!.shipmentId)}/dispatch`,
    {
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": `pr7-${Date.now()}`
      },
      data: {
        truckId: "truck_scr_03",
        dispatchedAt: new Date().toISOString()
      }
    }
  );

  expect(dispatchResponse.ok).toBeTruthy();
  await closeContextIgnoreArtifactsError(warehouseContext);
}

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
