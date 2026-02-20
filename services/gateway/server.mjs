import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const serverPort = Number.parseInt(process.env.SERVER_PORT ?? "8081", 10);
const keycloakRealm = process.env.KEYCLOAK_REALM ?? "scranton-branch";
const keycloakInternalBaseUrl = process.env.KEYCLOAK_INTERNAL_BASE_URL ?? "http://keycloak:8080";
const keycloakPublicPort = process.env.KEYCLOAK_PUBLIC_PORT ?? "8080";
const oidcClientId = process.env.OIDC_CLIENT_ID ?? "dunder-mifflin-gateway";
const oidcClientSecret = process.env.OIDC_CLIENT_SECRET ?? "gateway-secret-change-me";
const orderServiceBaseUrl = process.env.ORDER_SERVICE_BASE_URL ?? "http://order-service:8093";
const sessionMaxAgeMs = Number.parseInt(process.env.SESSION_MAX_AGE_MS ?? "1800000", 10);
const stateMaxAgeMs = Number.parseInt(process.env.OIDC_STATE_MAX_AGE_MS ?? "300000", 10);

const sessions = new Map();
const loginStates = new Map();

function htmlResponse(statusCode, html) {
  return {
    statusCode,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    },
    body: html
  };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function passThroughJsonResponse(statusCode, payloadText) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: payloadText
  };
}

function redirectResponse(location, cookies = []) {
  const headers = {
    location,
    "cache-control": "no-store"
  };
  if (cookies.length > 0) {
    headers["set-cookie"] = cookies;
  }

  return {
    statusCode: 302,
    headers,
    body: ""
  };
}

function send(res, response) {
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
}

function parseCookies(rawCookieHeader) {
  const entries = rawCookieHeader ? rawCookieHeader.split(";") : [];
  const cookies = {};

  for (const entry of entries) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (!rawName) {
      continue;
    }
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
}

function setCookie(name, value, { maxAgeSeconds = undefined, expires = undefined, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (httpOnly) {
    parts.push("HttpOnly");
  }
  if (maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  if (expires) {
    parts.push(`Expires=${expires.toUTCString()}`);
  }
  return parts.join("; ");
}

function clearCookie(name) {
  return setCookie(name, "", { maxAgeSeconds: 0, expires: new Date(0) });
}

async function readTextBody(req) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of req) {
    totalLength += chunk.length;
    if (totalLength > 512 * 1024) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return "";
  }

  return Buffer.concat(chunks).toString("utf8");
}

function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("hex");
}

function pruneExpiredMaps(now = Date.now()) {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
  for (const [state, value] of loginStates.entries()) {
    if (value.expiresAt <= now) {
      loginStates.delete(state);
    }
  }
}

function decodeJwtPayload(token) {
  const payload = token?.split(".")?.[1];
  if (!payload) {
    return {};
  }
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  try {
    const decoded = Buffer.from(normalized + padding, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function getRequestOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0]?.trim() || "http";
  const host = req.headers.host ?? `localhost:${serverPort}`;
  return `${protocol}://${host}`;
}

function getKeycloakBrowserBaseUrl(req) {
  const gatewayHost = req.headers.host ?? `localhost:${serverPort}`;
  const hostname = gatewayHost.split(":")[0];
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0]?.trim() || "http";
  return `${protocol}://${hostname}:${keycloakPublicPort}`;
}

function getOidcEndpoints(req) {
  const keycloakBrowserBaseUrl = getKeycloakBrowserBaseUrl(req);
  return {
    authUrl: `${keycloakBrowserBaseUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`,
    logoutUrl: `${keycloakBrowserBaseUrl}/realms/${keycloakRealm}/protocol/openid-connect/logout`,
    tokenUrl: `${keycloakInternalBaseUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`
  };
}

function readSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.dmf_session;
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return { id: sessionId, ...session };
}

function buildAuthMePayload(session) {
  const roleSet = new Set(session.roles ?? []);
  const apps = ["portal"];
  if (roleSet.has("manager") || roleSet.has("sales-associate")) {
    apps.push("infinity");
  }
  if (roleSet.has("manager") || roleSet.has("warehouse-operator")) {
    apps.push("warehouse-mobile");
  }
  if (roleSet.has("manager") || roleSet.has("accountant")) {
    apps.push("accounting");
  }

  return {
    userId: session.userId,
    displayName: session.displayName,
    roles: session.roles,
    groups: session.groups,
    apps,
    sessionExpiresAt: new Date(session.expiresAt).toISOString()
  };
}

function renderHomePage(session) {
  const userName = session?.displayName ?? "Guest";
  const authNotice = session
    ? `<p>Signed in as <strong>${escapeHtml(userName)}</strong>.</p><p><a href="/logout">Sign out</a></p>`
    : '<p>You are not signed in.</p>';

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Dunder Mifflin Gateway</title>
  </head>
  <body>
    <h1>Dunder Mifflin Gateway</h1>
    ${authNotice}
    <p><a href="/infinity">Open Sales App (Infinity)</a></p>
  </body>
</html>`;
}

function renderInfinityPage(session) {
  const roles = (session.roles ?? []).join(", ");
  const defaultShipDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Infinity Sales App</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        background: #f4f1ea;
        color: #1f2b33;
      }
      .wrap {
        max-width: 980px;
        margin: 2rem auto;
        padding: 0 1rem 2rem;
      }
      .panel {
        background: #fff;
        border: 1px solid #d3cec4;
        border-radius: 10px;
        box-shadow: 0 2px 6px rgba(31, 43, 51, 0.08);
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
      }
      label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.35rem;
      }
      input,
      textarea,
      button {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #b9b2a6;
        border-radius: 6px;
        padding: 0.55rem 0.65rem;
        font: inherit;
      }
      textarea {
        min-height: 80px;
        resize: vertical;
      }
      button {
        cursor: pointer;
        background: #004a8f;
        color: #fff;
        font-weight: 700;
      }
      button:hover {
        background: #003a70;
      }
      .alert {
        margin-top: 0.75rem;
        padding: 0.65rem 0.75rem;
        border-radius: 6px;
      }
      .alert-error {
        background: #fde8e8;
        border: 1px solid #f4b8b8;
        color: #8e1919;
      }
      .alert-success {
        background: #e8f6ec;
        border: 1px solid #b9e2c5;
        color: #1f6c3d;
      }
      .hidden {
        display: none;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        border-bottom: 1px solid #e2ddd3;
        padding: 0.5rem;
      }
      th {
        background: #f7f5f0;
      }
      .meta {
        color: #57534e;
        margin-top: 0.35rem;
      }
      .inline-link {
        color: #004a8f;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Infinity Sales App (PR3)</h1>
      <p>Welcome, <strong>${escapeHtml(session.displayName)}</strong>. Roles: ${escapeHtml(roles)}</p>

      <section class="panel">
        <h2>Place Paper Order</h2>
        <form id="order-form" novalidate>
          <div class="row">
            <div>
              <label for="clientId">Client ID</label>
              <input id="clientId" name="clientId" value="client_501" required />
            </div>
            <div>
              <label for="requestedShipDate">Requested ship date</label>
              <input id="requestedShipDate" name="requestedShipDate" type="date" value="${defaultShipDate}" required />
            </div>
          </div>

          <div class="row" style="margin-top:0.75rem;">
            <div>
              <label for="sku">Product SKU</label>
              <input id="sku" name="sku" value="PPR-A4-WHT-500" required />
            </div>
            <div>
              <label for="quantity">Quantity</label>
              <input id="quantity" name="quantity" type="number" min="1" step="1" value="10" required />
            </div>
          </div>

          <div style="margin-top:0.75rem;">
            <label for="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Loading dock closes at 5 PM"></textarea>
          </div>

          <div style="margin-top:0.75rem;">
            <button type="submit" id="place-order-btn">Place Order</button>
          </div>
          <div id="form-error" class="alert alert-error hidden" role="alert"></div>
          <div id="order-success" class="alert alert-success hidden"></div>
        </form>
      </section>

      <section class="panel">
        <h2>Order History</h2>
        <div class="row">
          <div>
            <label for="history-client-id">Filter by client ID</label>
            <input id="history-client-id" name="history-client-id" placeholder="client_501" />
          </div>
          <div style="align-self:end;">
            <button id="refresh-history-btn" type="button">Refresh History</button>
          </div>
        </div>
        <p class="meta" id="history-meta">Loading...</p>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Client</th>
              <th>Status</th>
              <th>Requested Ship Date</th>
              <th>Created At (UTC)</th>
            </tr>
          </thead>
          <tbody id="history-body"></tbody>
        </table>
      </section>

      <p><a class="inline-link" href="/">Back to gateway home</a></p>
    </div>

    <script>
      const formElement = document.getElementById("order-form");
      const clientIdElement = document.getElementById("clientId");
      const shipDateElement = document.getElementById("requestedShipDate");
      const skuElement = document.getElementById("sku");
      const quantityElement = document.getElementById("quantity");
      const notesElement = document.getElementById("notes");
      const errorElement = document.getElementById("form-error");
      const successElement = document.getElementById("order-success");
      const historyFilterElement = document.getElementById("history-client-id");
      const historyMetaElement = document.getElementById("history-meta");
      const historyBodyElement = document.getElementById("history-body");
      const refreshHistoryButton = document.getElementById("refresh-history-btn");
      const submitButton = document.getElementById("place-order-btn");

      function showError(messages) {
        const html = "<strong>Fix these fields:</strong><ul>" + messages.map((message) => "<li>" + escapeHtml(message) + "</li>").join("") + "</ul>";
        errorElement.innerHTML = html;
        errorElement.classList.remove("hidden");
      }

      function hideError() {
        errorElement.innerHTML = "";
        errorElement.classList.add("hidden");
      }

      function showSuccess(message) {
        successElement.textContent = message;
        successElement.classList.remove("hidden");
      }

      function hideSuccess() {
        successElement.textContent = "";
        successElement.classList.add("hidden");
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function validateForm() {
        const errors = [];
        const clientId = clientIdElement.value.trim();
        const sku = skuElement.value.trim();
        const shipDate = shipDateElement.value.trim();
        const quantity = Number.parseInt(quantityElement.value, 10);

        if (!clientId) {
          errors.push("Client ID is required");
        }
        if (!sku) {
          errors.push("Product SKU is required");
        }
        if (!shipDate) {
          errors.push("Requested ship date is required");
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          errors.push("Quantity must be a whole number greater than 0");
        }

        return { errors, clientId, sku, shipDate, quantity };
      }

      async function loadHistory(clientId = historyFilterElement.value.trim()) {
        const query = clientId ? "?clientId=" + encodeURIComponent(clientId) : "";
        const response = await fetch("/api/v1/orders" + query, { headers: { accept: "application/json" } });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "Unable to load order history");
        }

        historyBodyElement.innerHTML = "";
        for (const item of payload.items ?? []) {
          const row = document.createElement("tr");
          row.innerHTML = [
            "<td>" + escapeHtml(item.orderId) + "</td>",
            "<td>" + escapeHtml(item.clientId) + "</td>",
            "<td>" + escapeHtml(item.status) + "</td>",
            "<td>" + escapeHtml(item.requestedShipDate) + "</td>",
            "<td>" + escapeHtml(item.createdAt) + "</td>"
          ].join("");
          historyBodyElement.appendChild(row);
        }

        historyMetaElement.textContent = "Showing " + (payload.total ?? 0) + " order(s)" + (clientId ? " for " + clientId : "");
      }

      formElement.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideError();
        hideSuccess();

        const { errors, clientId, sku, shipDate, quantity } = validateForm();
        if (errors.length > 0) {
          showError(errors);
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Placing...";
        try {
          const response = await fetch("/api/v1/orders", {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              clientId,
              requestedShipDate: shipDate,
              items: [{ sku, quantity }],
              notes: notesElement.value
            })
          });

          const payload = await response.json();
          if (!response.ok) {
            const details = payload?.error?.details?.map((detail) => detail.field + ": " + detail.issue) ?? [];
            showError([payload?.error?.message ?? "Order submission failed", ...details]);
            return;
          }

          showSuccess("Order " + payload.orderId + " created with status " + payload.status + ".");
          historyFilterElement.value = clientId;
          await loadHistory(clientId);
        } catch (errorObject) {
          showError([errorObject instanceof Error ? errorObject.message : "Unexpected request failure"]);
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Place Order";
        }
      });

      refreshHistoryButton.addEventListener("click", async () => {
        hideError();
        hideSuccess();
        try {
          await loadHistory();
        } catch (errorObject) {
          showError([errorObject instanceof Error ? errorObject.message : "Unexpected history failure"]);
        }
      });

      loadHistory().catch((errorObject) => {
        showError([errorObject instanceof Error ? errorObject.message : "Unable to load history"]);
      });
    </script>
  </body>
</html>`;
}

function renderForbiddenPage() {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Access Denied</title>
  </head>
  <body>
    <h1>Access denied</h1>
    <p>Your account does not have permission to open the Sales app.</p>
    <p><a href="/">Return home</a></p>
  </body>
</html>`;
}

function renderErrorPage(message) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Gateway Error</title>
  </head>
  <body>
    <h1>Authentication error</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/">Return home</a></p>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function exchangeAuthorizationCode(tokenUrl, code, redirectUri) {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", oidcClientId);
  form.set("client_secret", oidcClientSecret);
  form.set("code", code);
  form.set("redirect_uri", redirectUri);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function handleOauthStart(req, parsedUrl) {
  const now = Date.now();
  pruneExpiredMaps(now);

  const returnToRaw = parsedUrl.searchParams.get("returnTo") ?? "/infinity";
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/infinity";
  const state = randomToken(18);
  loginStates.set(state, {
    returnTo,
    expiresAt: now + stateMaxAgeMs
  });

  const { authUrl } = getOidcEndpoints(req);
  const redirectUri = `${getRequestOrigin(req)}/login/oauth2/code/keycloak`;
  const authParams = new URLSearchParams();
  authParams.set("client_id", oidcClientId);
  authParams.set("response_type", "code");
  authParams.set("scope", "openid profile email");
  authParams.set("redirect_uri", redirectUri);
  authParams.set("state", state);

  return redirectResponse(`${authUrl}?${authParams.toString()}`);
}

async function handleOauthCallback(req, parsedUrl) {
  const state = parsedUrl.searchParams.get("state");
  const code = parsedUrl.searchParams.get("code");
  const error = parsedUrl.searchParams.get("error");

  if (error) {
    return htmlResponse(401, renderErrorPage(`Keycloak returned error: ${error}`));
  }

  if (!state || !code) {
    return htmlResponse(400, renderErrorPage("Missing authorization callback parameters."));
  }

  const stateEntry = loginStates.get(state);
  loginStates.delete(state);
  if (!stateEntry || stateEntry.expiresAt <= Date.now()) {
    return htmlResponse(400, renderErrorPage("Login state expired. Please try again."));
  }

  const { tokenUrl } = getOidcEndpoints(req);
  const redirectUri = `${getRequestOrigin(req)}/login/oauth2/code/keycloak`;

  let tokenSet;
  try {
    tokenSet = await exchangeAuthorizationCode(tokenUrl, code, redirectUri);
  } catch (errorObject) {
    const message = errorObject instanceof Error ? errorObject.message : "Unknown token exchange error";
    return htmlResponse(401, renderErrorPage(message));
  }

  const claims = decodeJwtPayload(tokenSet.access_token);
  const userName = claims.preferred_username ?? "unknown-user";
  const displayName = claims.name ?? claims.given_name ?? userName;
  const roles = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles : [];
  const groups = Array.isArray(claims.groups) ? claims.groups : [];

  const sessionId = randomToken();
  sessions.set(sessionId, {
    userId: userName,
    displayName,
    roles,
    groups,
    expiresAt: Date.now() + sessionMaxAgeMs
  });

  const cookie = setCookie("dmf_session", sessionId, { maxAgeSeconds: Math.floor(sessionMaxAgeMs / 1000) });
  return redirectResponse(stateEntry.returnTo, [cookie]);
}

function handleLogout(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.dmf_session) {
    sessions.delete(cookies.dmf_session);
  }

  const { logoutUrl } = getOidcEndpoints(req);
  const postLogoutRedirectUri = `${getRequestOrigin(req)}/`;
  const logoutParams = new URLSearchParams();
  logoutParams.set("post_logout_redirect_uri", postLogoutRedirectUri);

  return redirectResponse(`${logoutUrl}?${logoutParams.toString()}`, [clearCookie("dmf_session")]);
}

function canAccessInfinity(roles) {
  return roles.includes("sales-associate") || roles.includes("manager");
}

function canAccessOrdersApi(roles) {
  return roles.includes("sales-associate") || roles.includes("manager");
}

async function callOrderService(pathAndQuery, method, userId, requestBody = "") {
  const response = await fetch(`${orderServiceBaseUrl}${pathAndQuery}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-user-id": userId
    },
    body: method === "GET" ? undefined : requestBody
  });

  const payloadText = await response.text();
  return passThroughJsonResponse(response.status, payloadText);
}

async function handleRequest(req) {
  const parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/actuator/health") {
    return jsonResponse(200, { status: "UP", service: "gateway" });
  }

  if (req.method === "GET" && path === "/oauth2/authorization/keycloak") {
    return handleOauthStart(req, parsedUrl);
  }

  if (req.method === "GET" && path === "/login/oauth2/code/keycloak") {
    return handleOauthCallback(req, parsedUrl);
  }

  if (req.method === "GET" && path === "/logout") {
    return handleLogout(req);
  }

  const session = readSession(req);

  if (path.startsWith("/api/v1/orders")) {
    if (!session) {
      return jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Login is required" } });
    }

    if (!canAccessOrdersApi(session.roles)) {
      return jsonResponse(403, {
        error: { code: "FORBIDDEN", message: "Sales role is required to access orders" }
      });
    }

    const query = parsedUrl.search ? parsedUrl.search : "";

    if (req.method === "POST" && path === "/api/v1/orders") {
      const requestBody = await readTextBody(req);
      return callOrderService("/internal/orders", "POST", session.userId, requestBody);
    }

    if (req.method === "GET" && path === "/api/v1/orders") {
      return callOrderService(`/internal/orders${query}`, "GET", session.userId);
    }

    const timelineMatch = path.match(/^\/api\/v1\/orders\/([^/]+)\/timeline$/);
    if (req.method === "GET" && timelineMatch) {
      return callOrderService(`/internal/orders/${timelineMatch[1]}/timeline`, "GET", session.userId);
    }

    const detailMatch = path.match(/^\/api\/v1\/orders\/([^/]+)$/);
    if (req.method === "GET" && detailMatch) {
      return callOrderService(`/internal/orders/${detailMatch[1]}`, "GET", session.userId);
    }

    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Order route not found" } });
  }

  if (req.method === "GET" && path === "/api/v1/auth/me") {
    if (!session) {
      return jsonResponse(401, { error: "unauthenticated" });
    }
    return jsonResponse(200, buildAuthMePayload(session));
  }

  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    return htmlResponse(200, renderHomePage(session));
  }

  if (req.method === "GET" && path === "/apps/infinity") {
    return redirectResponse("/infinity");
  }

  if (req.method === "GET" && path === "/infinity") {
    if (!session) {
      const loginPath = `/oauth2/authorization/keycloak?${new URLSearchParams({ returnTo: "/infinity" })}`;
      return redirectResponse(loginPath);
    }

    if (!canAccessInfinity(session.roles)) {
      return htmlResponse(403, renderForbiddenPage());
    }

    return htmlResponse(200, renderInfinityPage(session));
  }

  return jsonResponse(404, { error: "not_found" });
}

const server = createServer(async (req, res) => {
  try {
    const response = await handleRequest(req);
    send(res, response);
  } catch (errorObject) {
    const message = errorObject instanceof Error ? errorObject.message : "Unknown gateway error";
    send(res, jsonResponse(500, { error: "internal_error", message }));
  }
});

server.listen(serverPort, "0.0.0.0", () => {
  console.log(`Gateway listening on ${serverPort}`);
});
