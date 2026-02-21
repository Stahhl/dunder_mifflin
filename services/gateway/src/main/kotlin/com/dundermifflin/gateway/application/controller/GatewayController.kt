package com.dundermifflin.gateway.application.controller

import com.dundermifflin.gateway.application.dto.GatewayProperties
import com.dundermifflin.gateway.domain.model.GatewaySession
import com.dundermifflin.gateway.domain.service.SessionService
import com.dundermifflin.gateway.infrastructure.client.FinanceServiceClient
import com.dundermifflin.gateway.infrastructure.client.OrderServiceClient
import com.dundermifflin.gateway.infrastructure.client.WuphfServiceClient
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
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

@RestController
class GatewayController(
    private val sessionService: SessionService,
    private val oidcService: OidcService,
    private val gatewayProperties: GatewayProperties,
    private val orderServiceClient: OrderServiceClient,
    private val financeServiceClient: FinanceServiceClient,
    private val wuphfServiceClient: WuphfServiceClient
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

    @GetMapping("/api/v1/orders/{orderId}/timeline/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun streamOrderTimeline(request: HttpServletRequest, @PathVariable orderId: String): ResponseEntity<Any> {
        val session = requireSalesSession(request) ?: return unauthOrForbidden(request)

        val timelinePath = "/internal/orders/${encodePath(orderId)}/timeline"
        val emitter = SseEmitter(0L)
        val shutdown = AtomicBoolean(false)
        val lastPayload = AtomicReference<String?>(null)
        val scheduler = Executors.newSingleThreadScheduledExecutor()

        fun stopStream() {
            if (shutdown.compareAndSet(false, true)) {
                scheduler.shutdownNow()
            }
        }

        fun pushSnapshot() {
            if (shutdown.get()) {
                return
            }

            try {
                val forwarded = orderServiceClient.forward(timelinePath, "GET", session.userId)
                if (forwarded.statusCode.is2xxSuccessful) {
                    val payload = forwarded.body ?: "{\"orderId\":\"$orderId\",\"events\":[]}"
                    if (lastPayload.get() != payload) {
                        emitter.send(SseEmitter.event().name("timeline").data(payload))
                        lastPayload.set(payload)
                    }
                    return
                }

                if (forwarded.statusCode.value() == HttpStatus.NOT_FOUND.value()) {
                    emitter.send(
                        SseEmitter.event().name("error").data(
                            mapOf(
                                "message" to "Order $orderId was not found"
                            )
                        )
                    )
                    emitter.complete()
                    stopStream()
                    return
                }

                emitter.send(
                    SseEmitter.event().name("error").data(
                        mapOf(
                            "message" to "Unable to stream order timeline"
                        )
                    )
                )
            } catch (_: Exception) {
                emitter.complete()
                stopStream()
            }
        }

        emitter.onCompletion { stopStream() }
        emitter.onTimeout {
            stopStream()
            emitter.complete()
        }
        emitter.onError { _ ->
            stopStream()
        }

        pushSnapshot()
        scheduler.scheduleAtFixedRate({ pushSnapshot() }, 2, 2, TimeUnit.SECONDS)

        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .body(emitter)
    }

    @PostMapping("/api/v1/expenses", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun createExpense(
        request: HttpServletRequest,
        @RequestBody(required = false) body: String?
    ): ResponseEntity<Any> {
        val session = requireAccountingSession(request) ?: return accountingUnauthOrForbidden(request)
        return forwardFinanceJsonResponse("/internal/expenses", "POST", session.userId, body ?: "")
    }

    @GetMapping("/api/v1/expenses", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun listExpenses(request: HttpServletRequest): ResponseEntity<Any> {
        val session = requireAccountingSession(request) ?: return accountingUnauthOrForbidden(request)
        val query = request.queryString?.takeIf { it.isNotBlank() }?.let { "?$it" } ?: ""
        return forwardFinanceJsonResponse("/internal/expenses$query", "GET", session.userId)
    }

    @PostMapping("/api/v1/expenses/{expenseId}/decision", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun decideExpense(
        request: HttpServletRequest,
        @PathVariable expenseId: String,
        @RequestBody(required = false) body: String?
    ): ResponseEntity<Any> {
        val session = requireAccountingSession(request) ?: return accountingUnauthOrForbidden(request)
        return forwardFinanceJsonResponse(
            "/internal/expenses/${encodePath(expenseId)}/decision",
            "POST",
            session.userId,
            body ?: ""
        )
    }

    @GetMapping("/api/v1/notifications", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun listNotifications(
        request: HttpServletRequest,
        @RequestParam(name = "unreadOnly", required = false) unreadOnly: Boolean?
    ): ResponseEntity<Any> {
        val session = requireAuthenticatedSession(request) ?: return unauthenticatedOnly()
        val query = unreadOnly?.let { "?unreadOnly=$it" } ?: ""
        return forwardWuphfJsonResponse("/internal/notifications$query", "GET", session.userId)
    }

    @PostMapping("/api/v1/notifications/{notificationId}/read", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun markNotificationRead(
        request: HttpServletRequest,
        @PathVariable notificationId: String
    ): ResponseEntity<Any> {
        val session = requireAuthenticatedSession(request) ?: return unauthenticatedOnly()
        return forwardWuphfJsonResponse(
            "/internal/notifications/${encodePath(notificationId)}/read",
            "POST",
            session.userId,
            body = ""
        )
    }

    @GetMapping("/api/v1/warehouse/shipments", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun listShipments(
        request: HttpServletRequest,
        @RequestParam(name = "status", required = false) status: String?
    ): ResponseEntity<Any> {
        val principal = requireWarehousePrincipal(request) ?: return mobileUnauthOrForbidden(request)
        val query = status?.takeIf { it.isNotBlank() }?.let { "?status=${encodePath(it)}" } ?: ""
        return forwardJsonResponse("/internal/shipments$query", "GET", principal.userId)
    }

    @PostMapping("/api/v1/warehouse/shipments/{shipmentId}/scan", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun scanShipment(
        request: HttpServletRequest,
        @PathVariable shipmentId: String,
        @RequestBody(required = false) body: String?
    ): ResponseEntity<Any> {
        val principal = requireWarehousePrincipal(request) ?: return mobileUnauthOrForbidden(request)
        return forwardJsonResponse(
            "/internal/shipments/${encodePath(shipmentId)}/scan",
            "POST",
            principal.userId,
            body ?: ""
        )
    }

    @PostMapping("/api/v1/warehouse/shipments/{shipmentId}/dispatch", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun dispatchShipment(
        request: HttpServletRequest,
        @PathVariable shipmentId: String,
        @RequestBody(required = false) body: String?,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?
    ): ResponseEntity<Any> {
        val principal = requireWarehousePrincipal(request) ?: return mobileUnauthOrForbidden(request)
        val headers = idempotencyKey?.takeIf { it.isNotBlank() }?.let { mapOf("Idempotency-Key" to it) } ?: emptyMap()
        return forwardJsonResponse(
            "/internal/shipments/${encodePath(shipmentId)}/dispatch",
            "POST",
            principal.userId,
            body ?: "",
            headers
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
                <p><a href="/portal">Open Scranton Portal</a></p>
                <p><a href="/infinity">Open Sales App (Infinity)</a></p>
                <p><a href="/accounting">Open Accounting App</a></p>
              </body>
            </html>
            """.trimIndent()
        )
    }

    @GetMapping("/apps/portal")
    fun portalShortcut(): ResponseEntity<Void> = ResponseEntity.status(HttpStatus.FOUND)
        .header(HttpHeaders.LOCATION, "/portal")
        .build()

    @GetMapping("/portal")
    fun portal(request: HttpServletRequest): ResponseEntity<*> {
        val querySuffix = requestQuerySuffix(request)
        val session = sessionService.readSession(request)?.second
        if (session == null) {
            val returnTo = URLEncoder.encode("/portal$querySuffix", StandardCharsets.UTF_8)
            return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, "/oauth2/authorization/keycloak?returnTo=$returnTo")
                .build<Void>()
        }

        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(HttpHeaders.LOCATION, portalWebLocation(querySuffix))
            .build<Void>()
    }

    @GetMapping("/apps/infinity")
    fun infinityShortcut(): ResponseEntity<Void> = ResponseEntity.status(HttpStatus.FOUND)
        .header(HttpHeaders.LOCATION, "/infinity")
        .build()

    @GetMapping("/infinity")
    fun infinity(request: HttpServletRequest): ResponseEntity<*> {
        val querySuffix = requestQuerySuffix(request)
        val session = sessionService.readSession(request)?.second
        if (session == null) {
            val returnTo = URLEncoder.encode("/infinity$querySuffix", StandardCharsets.UTF_8)
            return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, "/oauth2/authorization/keycloak?returnTo=$returnTo")
                .build<Void>()
        }

        if (!canAccessOrders(session.roles)) {
            return htmlResponse(HttpStatus.FORBIDDEN, renderForbiddenPage("Sales"))
        }

        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(HttpHeaders.LOCATION, infinityWebLocation(querySuffix))
            .build<Void>()
    }

    @GetMapping("/apps/accounting")
    fun accountingShortcut(): ResponseEntity<Void> = ResponseEntity.status(HttpStatus.FOUND)
        .header(HttpHeaders.LOCATION, "/accounting")
        .build()

    @GetMapping("/accounting")
    fun accounting(request: HttpServletRequest): ResponseEntity<*> {
        val querySuffix = requestQuerySuffix(request)
        val session = sessionService.readSession(request)?.second
        if (session == null) {
            val returnTo = URLEncoder.encode("/accounting$querySuffix", StandardCharsets.UTF_8)
            return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, "/oauth2/authorization/keycloak?returnTo=$returnTo")
                .build<Void>()
        }

        if (!canAccessAccounting(session.roles)) {
            return htmlResponse(HttpStatus.FORBIDDEN, renderForbiddenPage("Accounting"))
        }

        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(HttpHeaders.LOCATION, accountingWebLocation(querySuffix))
            .build<Void>()
    }

    private fun requestQuerySuffix(request: HttpServletRequest): String {
        val raw = request.queryString?.trim().orEmpty()
        return if (raw.isBlank()) "" else "?$raw"
    }

    private fun portalWebLocation(querySuffix: String = ""): String {
        val base = gatewayProperties.portalWebBaseUrl.trim().ifBlank { "http://localhost:3000" }
        val rooted = if (base.endsWith('/')) base else "$base/"
        return "$rooted$querySuffix"
    }

    private fun infinityWebLocation(querySuffix: String = ""): String {
        val base = gatewayProperties.infinityWebBaseUrl.trim().ifBlank { "http://localhost:3001" }
        val rooted = if (base.endsWith('/')) base else "$base/"
        return "$rooted$querySuffix"
    }

    private fun accountingWebLocation(querySuffix: String = ""): String {
        val base = gatewayProperties.accountingWebBaseUrl.trim().ifBlank { "http://localhost:3002" }
        val rooted = if (base.endsWith('/')) base else "$base/"
        return "$rooted$querySuffix"
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

    private fun requireAuthenticatedSession(request: HttpServletRequest): GatewaySession? {
        return sessionService.readSession(request)?.second
    }

    private fun requireAccountingSession(request: HttpServletRequest): GatewaySession? {
        val session = sessionService.readSession(request)?.second ?: return null
        return session.takeIf { canAccessAccounting(it.roles) }
    }

    private fun requireWarehousePrincipal(request: HttpServletRequest): RequestPrincipal? {
        val bearer = readBearerPrincipal(request)
        if (bearer != null) {
            return bearer.takeIf { canAccessWarehouse(it.roles) }
        }

        val session = sessionService.readSession(request)?.second ?: return null
        return RequestPrincipal(
            userId = session.userId,
            roles = session.roles,
            source = PrincipalSource.SESSION
        ).takeIf { canAccessWarehouse(it.roles) }
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

    private fun mobileUnauthOrForbidden(request: HttpServletRequest): ResponseEntity<Any> {
        val hasPrincipal = readBearerPrincipal(request) != null || sessionService.readSession(request) != null
        return if (!hasPrincipal) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                mapOf(
                    "error" to mapOf(
                        "code" to "UNAUTHENTICATED",
                        "message" to "Bearer token or session is required"
                    )
                )
            )
        } else {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                mapOf(
                    "error" to mapOf(
                        "code" to "FORBIDDEN",
                        "message" to "Warehouse role is required to access shipments"
                    )
                )
            )
        }
    }

    private fun accountingUnauthOrForbidden(request: HttpServletRequest): ResponseEntity<Any> {
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
                        "message" to "Accounting role is required to access expenses"
                    )
                )
            )
        }
    }

    private fun unauthenticatedOnly(): ResponseEntity<Any> {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
            mapOf(
                "error" to mapOf(
                    "code" to "UNAUTHENTICATED",
                    "message" to "Login is required"
                )
            )
        )
    }

    private fun canAccessOrders(roles: List<String>): Boolean {
        return roles.any { it == "sales-associate" || it == "manager" }
    }

    private fun canAccessWarehouse(roles: List<String>): Boolean {
        return roles.any { it == "warehouse-operator" || it == "manager" }
    }

    private fun canAccessAccounting(roles: List<String>): Boolean {
        return roles.any { it == "accountant" || it == "manager" }
    }

    private fun forwardJsonResponse(
        pathAndQuery: String,
        method: String,
        userId: String,
        body: String? = null,
        additionalHeaders: Map<String, String> = emptyMap()
    ): ResponseEntity<Any> {
        val forwarded = orderServiceClient.forward(pathAndQuery, method, userId, body, additionalHeaders)
        return ResponseEntity.status(forwarded.statusCode)
            .headers(forwarded.headers)
            .body(forwarded.body ?: "")
    }

    private fun forwardFinanceJsonResponse(
        pathAndQuery: String,
        method: String,
        userId: String,
        body: String? = null
    ): ResponseEntity<Any> {
        val forwarded = financeServiceClient.forward(pathAndQuery, method, userId, body)
        return ResponseEntity.status(forwarded.statusCode)
            .headers(forwarded.headers)
            .body(forwarded.body ?: "")
    }

    private fun forwardWuphfJsonResponse(
        pathAndQuery: String,
        method: String,
        userId: String,
        body: String? = null
    ): ResponseEntity<Any> {
        val forwarded = wuphfServiceClient.forward(pathAndQuery, method, userId, body)
        return ResponseEntity.status(forwarded.statusCode)
            .headers(forwarded.headers)
            .body(forwarded.body ?: "")
    }

    private fun readBearerPrincipal(request: HttpServletRequest): RequestPrincipal? {
        val header = request.getHeader("authorization") ?: return null
        if (!header.startsWith("Bearer ")) {
            return null
        }

        val token = header.removePrefix("Bearer ").trim()
        if (token.isBlank()) {
            return null
        }

        val claims = oidcService.decodeJwtPayload(token)
        val userId = claims["preferred_username"]?.toString()?.takeIf { it.isNotBlank() } ?: return null
        val roles = realmRoles(claims)
        return RequestPrincipal(userId = userId, roles = roles, source = PrincipalSource.BEARER)
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

    private fun renderForbiddenPage(appName: String): String =
        """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Access Denied</title>
          </head>
          <body>
            <h1>Access denied</h1>
            <p>Your account does not have permission to open the ${escapeHtml(appName)} app.</p>
            <p><a href="/">Return home</a></p>
          </body>
        </html>
        """.trimIndent()
}

private data class RequestPrincipal(
    val userId: String,
    val roles: List<String>,
    val source: PrincipalSource
)

private enum class PrincipalSource {
    SESSION,
    BEARER
}
