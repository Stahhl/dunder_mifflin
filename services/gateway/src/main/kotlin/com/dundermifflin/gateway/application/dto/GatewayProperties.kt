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
    val financeServiceBaseUrl: String = "http://finance-service:8095",
    val wuphfServiceBaseUrl: String = "http://wuphf-service:8096",
    val mobileWebOrigins: String =
        "http://localhost:3001,http://host.docker.internal:3001,http://localhost:3002,http://host.docker.internal:3002,http://localhost:3004,http://host.docker.internal:3004",
    val portalWebBaseUrl: String = "http://localhost:3000",
    val infinityWebBaseUrl: String = "http://localhost:3001",
    val accountingWebBaseUrl: String = "http://localhost:3002",
    val sessionMaxAgeMs: Long = 1_800_000,
    val oidcStateMaxAgeMs: Long = 300_000
)
