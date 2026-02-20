package com.dundermifflin.gateway.infrastructure.security

import com.dundermifflin.gateway.application.dto.GatewayProperties
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Service
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.Base64

@Service
class OidcService(
    private val gatewayProperties: GatewayProperties,
    private val objectMapper: ObjectMapper
) {
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()

    fun buildAuthorizationUrl(request: HttpServletRequest, state: String): String {
        val redirectUri = "${requestOrigin(request)}/login/oauth2/code/keycloak"
        val authUrl = "${keycloakBrowserBaseUrl(request)}/realms/${gatewayProperties.keycloakRealm}/protocol/openid-connect/auth"

        val query = listOf(
            "client_id" to gatewayProperties.oidcClientId,
            "response_type" to "code",
            "scope" to "openid profile email",
            "redirect_uri" to redirectUri,
            "state" to state
        ).joinToString("&") { (key, value) ->
            "${encode(key)}=${encode(value)}"
        }

        return "$authUrl?$query"
    }

    fun exchangeAuthorizationCode(request: HttpServletRequest, code: String): TokenSet {
        val redirectUri = "${requestOrigin(request)}/login/oauth2/code/keycloak"
        val tokenUrl =
            "${gatewayProperties.keycloakInternalBaseUrl}/realms/${gatewayProperties.keycloakRealm}/protocol/openid-connect/token"

        val form = listOf(
            "grant_type" to "authorization_code",
            "client_id" to gatewayProperties.oidcClientId,
            "client_secret" to gatewayProperties.oidcClientSecret,
            "code" to code,
            "redirect_uri" to redirectUri
        ).joinToString("&") { (key, value) ->
            "${encode(key)}=${encode(value)}"
        }

        val response = httpClient.send(
            HttpRequest.newBuilder()
                .uri(URI.create(tokenUrl))
                .timeout(Duration.ofSeconds(10))
                .header("content-type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build(),
            HttpResponse.BodyHandlers.ofString()
        )

        if (response.statusCode() !in 200..299) {
            throw IllegalStateException("Token exchange failed (${response.statusCode()}): ${response.body()}")
        }

        val node = objectMapper.readTree(response.body())
        val accessToken = node.path("access_token").asText("")
        if (accessToken.isBlank()) {
            throw IllegalStateException("Token exchange returned empty access token")
        }

        return TokenSet(accessToken = accessToken)
    }

    @Suppress("UNCHECKED_CAST")
    fun decodeJwtPayload(token: String): Map<String, Any?> {
        val payload = token.split('.').getOrNull(1) ?: return emptyMap()
        val normalized = payload
            .replace('-', '+')
            .replace('_', '/')
            .let { candidate ->
                val padding = (4 - candidate.length % 4) % 4
                candidate + "=".repeat(padding)
            }

        return try {
            val json = String(Base64.getDecoder().decode(normalized), StandardCharsets.UTF_8)
            objectMapper.readValue(json, Map::class.java) as Map<String, Any?>
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun requestOrigin(request: HttpServletRequest): String {
        val forwardedProto = request.getHeader("x-forwarded-proto")
            ?.split(',')
            ?.firstOrNull()
            ?.trim()
            ?.takeIf { it.isNotBlank() }

        val protocol = forwardedProto ?: request.scheme
        val host = request.getHeader("host") ?: "localhost:${request.serverPort}"
        return "$protocol://$host"
    }

    private fun keycloakBrowserBaseUrl(request: HttpServletRequest): String {
        val forwardedProto = request.getHeader("x-forwarded-proto")
            ?.split(',')
            ?.firstOrNull()
            ?.trim()
            ?.takeIf { it.isNotBlank() }

        val protocol = forwardedProto ?: request.scheme
        val gatewayHost = request.getHeader("host") ?: "localhost:${request.serverPort}"
        val hostname = gatewayHost.substringBefore(':')
        return "$protocol://$hostname:${gatewayProperties.keycloakPublicPort}"
    }

    private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8)
}

data class TokenSet(
    val accessToken: String
)
