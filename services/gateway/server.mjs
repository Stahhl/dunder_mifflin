import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const serverPort = Number.parseInt(process.env.SERVER_PORT ?? "8081", 10);
const keycloakRealm = process.env.KEYCLOAK_REALM ?? "scranton-branch";
const keycloakInternalBaseUrl = process.env.KEYCLOAK_INTERNAL_BASE_URL ?? "http://keycloak:8080";
const keycloakPublicPort = process.env.KEYCLOAK_PUBLIC_PORT ?? "8080";
const oidcClientId = process.env.OIDC_CLIENT_ID ?? "dunder-mifflin-gateway";
const oidcClientSecret = process.env.OIDC_CLIENT_SECRET ?? "gateway-secret-change-me";
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
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Infinity Sales App</title>
  </head>
  <body>
    <h1>Infinity Sales App (PR2)</h1>
    <p>Welcome, <strong>${escapeHtml(session.displayName)}</strong>.</p>
    <p>Roles: ${escapeHtml(roles)}</p>
    <p>This PR2 page confirms gateway auth navigation only. Sales workflows land in later PRs.</p>
    <p><a href="/">Back to gateway home</a></p>
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
