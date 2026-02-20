import assert from "node:assert/strict";
import test from "node:test";
import { validateOrderRequest } from "../src/validation.mjs";

test("returns validation details for missing fields", () => {
  const details = validateOrderRequest({});

  assert.deepEqual(details, [
    { field: "clientId", issue: "required" },
    { field: "requestedShipDate", issue: "required" },
    { field: "items", issue: "min:1" }
  ]);
});

test("returns validation details for malformed fields", () => {
  const details = validateOrderRequest({
    clientId: "client_501",
    requestedShipDate: "02/20/2026",
    items: [{ sku: "PPR-A4-WHT-500", quantity: 0 }]
  });

  assert.deepEqual(details, [
    { field: "requestedShipDate", issue: "format:YYYY-MM-DD" },
    { field: "items[0].quantity", issue: "min:1" }
  ]);
});

test("returns empty validation details for valid payload", () => {
  const details = validateOrderRequest({
    clientId: "client_501",
    requestedShipDate: "2026-02-20",
    items: [{ sku: "PPR-A4-WHT-500", quantity: 10 }]
  });

  assert.equal(details.length, 0);
});
