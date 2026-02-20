package com.dundermifflin.gateway.application.controller

import com.dundermifflin.gateway.application.dto.GatewayProperties
import com.dundermifflin.gateway.domain.model.GatewaySession
import com.dundermifflin.gateway.domain.service.SessionService
import com.dundermifflin.gateway.infrastructure.client.OrderServiceClient
import com.dundermifflin.gateway.infrastructure.security.OidcService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Duration

@RestController
class GatewayController(
    private val sessionService: SessionService,
    private val oidcService: OidcService,
    private val gatewayProperties: GatewayProperties,
    private val orderServiceClient: OrderServiceClient
) {
    @GetMapping("/oauth2/authorization/keycloak")
    fun oauthStart(
        request: HttpServletRequest,
        @RequestParam(name = "returnTo", required = false, defaultValue = "/infinity") returnTo: String
    ): ResponseEntity<Void> {
        val state = sessionService.createState(returnTo)
        val location = oidcService.buildAuthorizationUrl(request, state)

        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(HttpHeaders.LOCATION, location)
            .build()
    }

    @GetMapping("/login/oauth2/code/keycloak", produces = [MediaType.TEXT_HTML_VALUE])
    fun oauthCallback(
        request: HttpServletRequest,
        @RequestParam(name = "state", required = false) state: String?,
        @RequestParam(name = "code", required = false) code: String?,
        @RequestParam(name = "error", required = false) error: String?
    ): ResponseEntity<String> {
        if (!error.isNullOrBlank()) {
            return htmlResponse(HttpStatus.UNAUTHORIZED, renderErrorPage("Keycloak returned error: $error"))
        }

        if (state.isNullOrBlank() || code.isNullOrBlank()) {
            return htmlResponse(HttpStatus.BAD_REQUEST, renderErrorPage("Missing authorization callback parameters."))
        }

        val stateEntry = sessionService.consumeState(state)
            ?: return htmlResponse(HttpStatus.BAD_REQUEST, renderErrorPage("Login state expired. Please try again."))

        val claims = try {
            oidcService.decodeJwtPayload(oidcService.exchangeAuthorizationCode(request, code).accessToken)
        } catch (exception: Exception) {
            return htmlResponse(HttpStatus.UNAUTHORIZED, renderErrorPage(exception.message ?: "Unknown token exchange error"))
        }

        val userName = claims["preferred_username"]?.toString()?.takeIf { it.isNotBlank() } ?: "unknown-user"
        val displayName = claims["name"]?.toString()?.takeIf { it.isNotBlank() }
            ?: claims["given_name"]?.toString()?.takeIf { it.isNotBlank() }
            ?: userName

        val roles = realmRoles(claims)
        val groups = stringList(claims["groups"])

        val sessionId = sessionService.createSession(
            userId = userName,
            displayName = displayName,
            roles = roles,
            groups = groups
        )

        val cookie = ResponseCookie.from("dmf_session", sessionId)
            .path("/")
            .sameSite("Lax")
            .httpOnly(true)
            .maxAge(Duration.ofMillis(gatewayProperties.sessionMaxAgeMs))
            .build()

        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .header(HttpHeaders.LOCATION, stateEntry.returnTo)
            .body("")
    }

    @GetMapping("/logout")
    fun logout(request: HttpServletRequest): ResponseEntity<Void> {
        sessionService.readSession(request)?.let { (sessionId, _) ->
            sessionService.deleteSession(sessionId)
        }

        val expiredCookie = ResponseCookie.from("dmf_session", "")
            .path("/")
            .sameSite("Lax")
            .httpOnly(true)
            .maxAge(Duration.ZERO)
            .build()

        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
            .header(HttpHeaders.LOCATION, "/")
            .build()
    }

    @GetMapping("/api/v1/auth/me")
    fun authMe(request: HttpServletRequest): ResponseEntity<Any> {
        val session = sessionService.readSession(request)?.second
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(mapOf("error" to "unauthenticated"))

        val apps = mutableListOf("portal")
        if (session.roles.any { it == "manager" || it == "sales-associate" }) {
            apps += "infinity"
        }
        if (session.roles.any { it == "manager" || it == "warehouse-operator" }) {
            apps += "warehouse-mobile"
        }
        if (session.roles.any { it == "manager" || it == "accountant" }) {
            apps += "accounting"
        }

        return ResponseEntity.ok(
            mapOf(
                "userId" to session.userId,
                "displayName" to session.displayName,
                "roles" to session.roles,
                "groups" to session.groups,
                "apps" to apps,
                "sessionExpiresAt" to java.time.Instant.ofEpochMilli(session.expiresAtEpochMs).toString()
            )
        )
    }

    @PostMapping("/api/v1/orders", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun createOrder(
        request: HttpServletRequest,
        @RequestBody(required = false) body: String?
    ): ResponseEntity<Any> {
        val session = requireSalesSession(request) ?: return unauthOrForbidden(request)
        return forwardJsonResponse("/internal/orders", "POST", session.userId, body ?: "")
    }

    @GetMapping("/api/v1/orders", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun listOrders(request: HttpServletRequest): ResponseEntity<Any> {
        val session = requireSalesSession(request) ?: return unauthOrForbidden(request)
        val query = request.queryString?.takeIf { it.isNotBlank() }?.let { "?$it" } ?: ""
        return forwardJsonResponse("/internal/orders$query", "GET", session.userId)
    }

    @GetMapping("/api/v1/orders/{orderId}", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun getOrder(request: HttpServletRequest, @PathVariable orderId: String): ResponseEntity<Any> {
        val session = requireSalesSession(request) ?: return unauthOrForbidden(request)
        return forwardJsonResponse("/internal/orders/${encodePath(orderId)}", "GET", session.userId)
    }

    @GetMapping("/api/v1/orders/{orderId}/timeline", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun getOrderTimeline(request: HttpServletRequest, @PathVariable orderId: String): ResponseEntity<Any> {
        val session = requireSalesSession(request) ?: return unauthOrForbidden(request)
        return forwardJsonResponse(
            "/internal/orders/${encodePath(orderId)}/timeline",
            "GET",
            session.userId
        )
    }

    @GetMapping("/", "/index.html", produces = [MediaType.TEXT_HTML_VALUE])
    fun home(request: HttpServletRequest): ResponseEntity<String> {
        val session = sessionService.readSession(request)?.second
        val authNotice = if (session == null) {
            "<p>You are not signed in.</p>"
        } else {
            "<p>Signed in as <strong>${escapeHtml(session.displayName)}</strong>.</p><p><a href=\"/logout\">Sign out</a></p>"
        }

        return htmlResponse(
            HttpStatus.OK,
            """
            <!doctype html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <title>Dunder Mifflin Gateway</title>
              </head>
              <body>
                <h1>Dunder Mifflin Gateway</h1>
                $authNotice
                <p><a href="/infinity">Open Sales App (Infinity)</a></p>
              </body>
            </html>
            """.trimIndent()
        )
    }

    @GetMapping("/apps/infinity")
    fun infinityShortcut(): ResponseEntity<Void> = ResponseEntity.status(HttpStatus.FOUND)
        .header(HttpHeaders.LOCATION, "/infinity")
        .build()

    @GetMapping("/infinity", produces = [MediaType.TEXT_HTML_VALUE])
    fun infinity(request: HttpServletRequest): ResponseEntity<String> {
        val session = sessionService.readSession(request)?.second
        if (session == null) {
            val returnTo = URLEncoder.encode("/infinity", StandardCharsets.UTF_8)
            return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, "/oauth2/authorization/keycloak?returnTo=$returnTo")
                .build()
        }

        if (!canAccessOrders(session.roles)) {
            return htmlResponse(HttpStatus.FORBIDDEN, renderForbiddenPage())
        }

        return htmlResponse(HttpStatus.OK, renderInfinityPage(session))
    }

    private fun htmlResponse(status: HttpStatus, html: String): ResponseEntity<String> =
        ResponseEntity.status(status)
            .contentType(MediaType.TEXT_HTML)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(html)

    private fun requireSalesSession(request: HttpServletRequest): GatewaySession? {
        val session = sessionService.readSession(request)?.second ?: return null
        return session.takeIf { canAccessOrders(it.roles) }
    }

    private fun unauthOrForbidden(request: HttpServletRequest): ResponseEntity<Any> {
        val hasSession = sessionService.readSession(request) != null
        return if (!hasSession) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                mapOf(
                    "error" to mapOf(
                        "code" to "UNAUTHENTICATED",
                        "message" to "Login is required"
                    )
                )
            )
        } else {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                mapOf(
                    "error" to mapOf(
                        "code" to "FORBIDDEN",
                        "message" to "Sales role is required to access orders"
                    )
                )
            )
        }
    }

    private fun canAccessOrders(roles: List<String>): Boolean {
        return roles.any { it == "sales-associate" || it == "manager" }
    }

    private fun forwardJsonResponse(
        pathAndQuery: String,
        method: String,
        userId: String,
        body: String? = null
    ): ResponseEntity<Any> {
        val forwarded = orderServiceClient.forward(pathAndQuery, method, userId, body)
        return ResponseEntity.status(forwarded.statusCode)
            .headers(forwarded.headers)
            .body(forwarded.body ?: "")
    }

    @Suppress("UNCHECKED_CAST")
    private fun realmRoles(claims: Map<String, Any?>): List<String> {
        val realmAccess = claims["realm_access"] as? Map<String, Any?> ?: return emptyList()
        val roles = realmAccess["roles"]
        return stringList(roles)
    }

    private fun stringList(value: Any?): List<String> {
        if (value !is List<*>) {
            return emptyList()
        }
        return value.mapNotNull { it?.toString() }
    }

    private fun encodePath(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8)

    private fun escapeHtml(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")

    private fun renderForbiddenPage(): String =
        """
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
        </html>
        """.trimIndent()

    private fun renderErrorPage(message: String): String =
        """
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
        </html>
        """.trimIndent()

    private fun renderInfinityPage(session: GatewaySession): String {
        val defaultShipDate = java.time.LocalDate.now().plusDays(1).toString()
        val roles = escapeHtml(session.roles.joinToString(", "))
        val userName = escapeHtml(session.displayName)

        return """
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
              <p>Welcome, <strong>$userName</strong>. Roles: $roles</p>

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
                      <input id="requestedShipDate" name="requestedShipDate" type="date" value="$defaultShipDate" required />
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
        </html>
        """.trimIndent()
    }
}
