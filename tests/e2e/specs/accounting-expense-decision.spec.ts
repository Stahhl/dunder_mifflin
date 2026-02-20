import { expect, test } from "@playwright/test";

test("accountant can create an expense and reject it with a reason", async ({ page }) => {
  await page.goto("/accounting");

  await expect(page.locator("#kc-form-login")).toBeVisible();
  await page.locator("#username").fill("amartin");
  await page.locator("#password").fill("password");
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/(\/accounting$|:3002\/?$)/);
  await expect(page.getByRole("heading", { name: /Accounting Suite/ })).toBeVisible();

  const marker = `${Date.now()}`;
  await page.locator("#description").fill(`PR6 expense review ${marker}`);
  await page.getByTestId("accounting-create-btn").click();

  await expect(page.getByTestId("accounting-notice")).toContainText(/Expense exp_\d+ created with status PENDING/);
  const noticeText = await page.getByTestId("accounting-notice").textContent();
  const expenseIdMatch = noticeText?.match(/Expense\s+(exp_\d+)\s+created/i);
  expect(expenseIdMatch?.[1]).toBeTruthy();
  const expenseId = expenseIdMatch![1];

  await expect(page.getByTestId("accounting-table-body")).toContainText(expenseId);
  await expect(page.getByTestId("accounting-table-body")).toContainText("PENDING");

  await page.getByTestId("accounting-filter-status").selectOption("ALL");
  await page.getByTestId("accounting-refresh-btn").click();
  await expect(page.getByTestId("accounting-table-body")).toContainText(expenseId);

  await page.getByTestId(`accounting-select-${expenseId}`).click();
  await expect(page.getByTestId("accounting-selected-id")).toContainText(expenseId);

  await page.getByTestId("accounting-decision").selectOption("REJECTED");
  await page.getByTestId("accounting-comment").fill(`Missing receipts ${marker}`);
  await page.getByTestId("accounting-submit-decision").click();

  await expect(page.getByTestId("accounting-notice")).toContainText(`Expense ${expenseId} updated to REJECTED`);
  await expect(page.getByTestId("accounting-table-body")).toContainText(expenseId);
  await expect(page.getByTestId("accounting-table-body")).toContainText("REJECTED");
});
