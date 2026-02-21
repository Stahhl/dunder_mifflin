import { expect, test } from "@playwright/test";

const gatewayBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://host.docker.internal:8081";
const portalBaseUrl = process.env.PLAYWRIGHT_PORTAL_BASE_URL ?? "http://host.docker.internal:3000";
const infinityBaseUrl = process.env.PLAYWRIGHT_INFINITY_BASE_URL ?? "http://host.docker.internal:3001";
const accountingBaseUrl = process.env.PLAYWRIGHT_ACCOUNTING_BASE_URL ?? "http://host.docker.internal:3002";
const warehouseBaseUrl = process.env.PLAYWRIGHT_WAREHOUSE_BASE_URL ?? "http://host.docker.internal:3004";

test("gateway response includes trace identifiers and preserves provided trace id", async ({ request }) => {
  const traceId = "11111111111111111111111111111111";
  const requestId = "req_pr9_trace_check";
  const traceparent = `00-${traceId}-2222222222222222-01`;

  const response = await request.get(`${gatewayBaseUrl}/api/v1/auth/me`, {
    headers: {
      "X-Trace-Id": traceId,
      "X-Request-Id": requestId,
      traceparent
    }
  });

  expect(response.status()).toBe(401);

  const headers = response.headers();
  expect(headers["x-trace-id"]).toBe(traceId);
  expect(headers["x-request-id"]).toBe(requestId);
  expect(headers["traceparent"]).toBe(traceparent);
});

test("all apps show friendly fallback on render crash", async ({ page }) => {
  const appUrls = [portalBaseUrl, infinityBaseUrl, accountingBaseUrl, warehouseBaseUrl];

  for (const appUrl of appUrls) {
    await page.goto(`${appUrl}/?__e2e_force_error__=1`);
    await expect(page.getByTestId("app-error-boundary")).toBeVisible();
    await expect(page.getByTestId("app-error-boundary")).toContainText("Something went wrong");
  }
});
