import { expect, test } from "@playwright/test";

test("sales user can convert a qualified lead to client and place order", async ({ page }) => {
  await page.goto("/infinity");

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill("jhalpert");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/(\/infinity$|:3001\/?$)/);
  await expect(page.getByRole("heading", { name: /Infinity Sales App/ })).toBeVisible();

  const stamp = Date.now();
  await page.locator("#lead-company-name").fill(`Dunder Client ${stamp}`);
  await page.locator("#lead-contact-name").fill("Pam Beesly");
  await page.locator("#lead-contact-email").fill(`pam.${stamp}@dundermifflin.test`);
  await page.locator("#lead-phone").fill("570-555-0123");
  await page.locator("#lead-notes").fill("PR11 CRM conversion flow");
  await page.locator("#create-lead-btn").click();

  await expect(page.locator("#crm-success")).toContainText(/Lead lead_\d+ created with status NEW/);
  const createdText = (await page.locator("#crm-success").textContent()) ?? "";
  const leadIdMatch = createdText.match(/Lead\s+(lead_\d+)\s+created/i);
  expect(leadIdMatch?.[1]).toBeTruthy();
  const leadId = leadIdMatch![1];

  const leadRow = page.locator("#leads-body tr", { hasText: leadId }).first();
  await expect(leadRow).toBeVisible();

  await leadRow.getByRole("button", { name: "Set QUALIFIED" }).click();
  await expect(page.locator("#crm-success")).toContainText(`Lead ${leadId} updated to QUALIFIED`);

  await leadRow.getByRole("button", { name: "Convert" }).click();
  await expect(page.locator("#crm-success")).toContainText(/converted to client client_\d+/i);

  const convertedText = (await page.locator("#crm-success").textContent()) ?? "";
  const clientIdMatch = convertedText.match(/client\s+(client_\d+)/i);
  expect(clientIdMatch?.[1]).toBeTruthy();
  const clientId = clientIdMatch![1];

  await expect(page.locator("#clientId")).toHaveValue(clientId);

  await page.locator("#requestedShipDate").fill(tomorrowAsIsoDate());
  await page.locator("#sku").fill("PPR-A4-WHT-500");
  await page.locator("#quantity").fill("4");
  await page.locator("#notes").fill(`PR11 converted lead order ${stamp}`);
  await page.locator("#place-order-btn").click();

  await expect(page.locator("#order-success")).toContainText(/Order ord_\d+ created with status CREATED/);
  await expect(page.locator("#history-body")).toContainText(clientId);
});

function tomorrowAsIsoDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}
