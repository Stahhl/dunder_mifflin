package com.dundermifflin.gateway.domain.model

data class GatewaySession(
    val userId: String,
    val displayName: String,
    val roles: List<String>,
    val groups: List<String>,
    val expiresAtEpochMs: Long
)

data class LoginState(
    val returnTo: String,
    val expiresAtEpochMs: Long
)
