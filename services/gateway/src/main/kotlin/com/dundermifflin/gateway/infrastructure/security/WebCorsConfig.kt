package com.dundermifflin.gateway.infrastructure.security

import com.dundermifflin.gateway.application.dto.GatewayProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.filter.CorsFilter

@Configuration
class WebCorsConfig(
    private val gatewayProperties: GatewayProperties
) {
    @Bean
    fun corsFilter(): CorsFilter {
        val allowedOrigins = gatewayProperties.mobileWebOrigins
            .split(',')
            .map { it.trim() }
            .filter { it.isNotBlank() }

        val config = CorsConfiguration().apply {
            allowCredentials = true
            this.allowedOrigins = allowedOrigins
            allowedHeaders = listOf("Authorization", "Content-Type", "Idempotency-Key", "Accept")
            allowedMethods = listOf("GET", "POST", "OPTIONS")
            exposedHeaders = listOf("content-type", "cache-control")
            maxAge = 3_600
        }

        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/api/v1/**", config)

        return CorsFilter(source)
    }
}
