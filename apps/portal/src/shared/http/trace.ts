function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").slice(0, length);
}

function createRequestId(): string {
  return `req_${Date.now()}_${randomHex(8)}`;
}

export function applyTraceHeaders(headersInit?: HeadersInit): Headers {
  const headers = new Headers(headersInit);
  const traceId = randomHex(32);
  const spanId = randomHex(16);

  if (!headers.has("traceparent")) {
    headers.set("traceparent", `00-${traceId}-${spanId}-01`);
  }
  if (!headers.has("X-Trace-Id")) {
    headers.set("X-Trace-Id", traceId);
  }
  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", createRequestId());
  }

  return headers;
}

export function appendTraceToMessage(message: string, response: Response): string {
  const traceId = response.headers.get("x-trace-id") ?? response.headers.get("x-request-id");
  if (!traceId) {
    return message;
  }

  return `${message} (trace: ${traceId})`;
}
