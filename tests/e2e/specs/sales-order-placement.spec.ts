import { expect, test } from "@playwright/test";

test("sales user can place a valid order and sees it in history", async ({ page }) => {
  await page.goto("/infinity");

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill("jhalpert");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/\/infinity$/);
  await expect(page.getByRole("heading", { name: /Infinity Sales App/ })).toBeVisible();

  const invalidSubmission = await page.evaluate(async () => {
    const response = await fetch("/api/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        clientId: "",
        requestedShipDate: "2026-02-21",
        items: [{ sku: "PPR-A4-WHT-500", quantity: 0 }]
      })
    });

    return {
      status: response.status,
      body: await response.json()
    };
  });

  expect(invalidSubmission.status).toBe(400);
  expect(invalidSubmission.body.error.code).toBe("VALIDATION_ERROR");
  expect(invalidSubmission.body.error.details).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ field: "clientId" }),
      expect.objectContaining({ field: "items[0].quantity" })
    ])
  );

  const clientId = `client_pr3_${Date.now()}`;
  const requestedShipDate = tomorrowAsIsoDate();

  await page.locator("#clientId").fill(clientId);
  await page.locator("#requestedShipDate").fill(requestedShipDate);
  await page.locator("#sku").fill("PPR-A4-WHT-500");
  await page.locator("#quantity").fill("12");
  await page.locator("#notes").fill("Playwright PR3 order placement");
  await page.locator("#place-order-btn").click();

  await expect(page.locator("#order-success")).toContainText(/Order ord_\d+ created with status CREATED/);
  await expect(page.locator("#history-meta")).toContainText(`for ${clientId}`);
  await expect(page.locator("#history-body")).toContainText(clientId);
  await expect(page.locator("#history-body")).toContainText("CREATED");
  await expect(page.locator("#history-body")).toContainText(requestedShipDate);
});

function tomorrowAsIsoDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}
