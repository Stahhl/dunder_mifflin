export function validateOrderRequest(payload) {
  const details = [];

  if (!payload || typeof payload !== "object") {
    details.push({ field: "body", issue: "required" });
    return details;
  }

  if (typeof payload.clientId !== "string" || payload.clientId.trim() === "") {
    details.push({ field: "clientId", issue: "required" });
  }

  if (typeof payload.requestedShipDate !== "string" || payload.requestedShipDate.trim() === "") {
    details.push({ field: "requestedShipDate", issue: "required" });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.requestedShipDate)) {
    details.push({ field: "requestedShipDate", issue: "format:YYYY-MM-DD" });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    details.push({ field: "items", issue: "min:1" });
  } else {
    payload.items.forEach((item, index) => {
      if (!item || typeof item.sku !== "string" || item.sku.trim() === "") {
        details.push({ field: `items[${index}].sku`, issue: "required" });
      }

      if (!Number.isInteger(item?.quantity) || item.quantity <= 0) {
        details.push({ field: `items[${index}].quantity`, issue: "min:1" });
      }
    });
  }

  return details;
}
