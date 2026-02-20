package com.dundermifflin.gateway.domain.service

import com.dundermifflin.gateway.application.dto.GatewayProperties
import com.dundermifflin.gateway.domain.model.GatewaySession
import com.dundermifflin.gateway.domain.model.LoginState
import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

@Service
class SessionService(
    private val gatewayProperties: GatewayProperties
) {
    private val sessions = ConcurrentHashMap<String, GatewaySession>()
    private val states = ConcurrentHashMap<String, LoginState>()
    private val secureRandom = SecureRandom()

    fun createState(returnTo: String): String {
        pruneExpired()
        val state = randomToken(18)
        states[state] = LoginState(
            returnTo = if (returnTo.startsWith("/")) returnTo else "/infinity",
            expiresAtEpochMs = System.currentTimeMillis() + gatewayProperties.oidcStateMaxAgeMs
        )
        return state
    }

    fun consumeState(state: String): LoginState? {
        pruneExpired()
        return states.remove(state)?.takeIf { it.expiresAtEpochMs > System.currentTimeMillis() }
    }

    fun createSession(userId: String, displayName: String, roles: List<String>, groups: List<String>): String {
        pruneExpired()
        val sessionId = randomToken(24)
        sessions[sessionId] = GatewaySession(
            userId = userId,
            displayName = displayName,
            roles = roles,
            groups = groups,
            expiresAtEpochMs = System.currentTimeMillis() + gatewayProperties.sessionMaxAgeMs
        )
        return sessionId
    }

    fun readSession(request: HttpServletRequest): Pair<String, GatewaySession>? {
        pruneExpired()
        val sessionId = parseCookies(request.getHeader("cookie"))["dmf_session"] ?: return null
        val session = sessions[sessionId] ?: return null

        if (session.expiresAtEpochMs <= System.currentTimeMillis()) {
            sessions.remove(sessionId)
            return null
        }

        return sessionId to session
    }

    fun deleteSession(sessionId: String) {
        sessions.remove(sessionId)
    }

    fun parseCookies(rawCookieHeader: String?): Map<String, String> {
        if (rawCookieHeader.isNullOrBlank()) {
            return emptyMap()
        }

        return rawCookieHeader
            .split(";")
            .mapNotNull { entry ->
                val parts = entry.trim().split("=", limit = 2)
                if (parts.size != 2 || parts[0].isBlank()) {
                    null
                } else {
                    parts[0] to parts[1]
                }
            }
            .toMap()
    }

    private fun pruneExpired() {
        val now = System.currentTimeMillis()
        sessions.entries.removeIf { (_, session) -> session.expiresAtEpochMs <= now }
        states.entries.removeIf { (_, state) -> state.expiresAtEpochMs <= now }
    }

    private fun randomToken(bytes: Int): String {
        val buffer = ByteArray(bytes)
        secureRandom.nextBytes(buffer)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer)
    }
}
