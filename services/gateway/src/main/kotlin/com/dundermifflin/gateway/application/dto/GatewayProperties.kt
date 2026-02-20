package com.dundermifflin.gateway.application.dto

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "gateway")
data class GatewayProperties(
    val keycloakRealm: String = "scranton-branch",
    val keycloakInternalBaseUrl: String = "http://keycloak:8080",
    val keycloakPublicPort: Int = 8080,
    val oidcClientId: String = "dunder-mifflin-gateway",
    val oidcClientSecret: String = "gateway-secret-change-me",
    val orderServiceBaseUrl: String = "http://order-service:8093",
    val sessionMaxAgeMs: Long = 1_800_000,
    val oidcStateMaxAgeMs: Long = 300_000
)
