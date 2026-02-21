package com.dundermifflin.gateway.infrastructure.client

import com.dundermifflin.gateway.application.dto.GatewayProperties
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Component
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

@Component
class WuphfServiceClient(
    private val gatewayProperties: GatewayProperties
) {
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()

    fun forward(
        pathAndQuery: String,
        method: String,
        userId: String,
        body: String? = null,
        additionalHeaders: Map<String, String> = emptyMap()
    ): ResponseEntity<String> {
        val requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create("${gatewayProperties.wuphfServiceBaseUrl}$pathAndQuery"))
            .timeout(Duration.ofSeconds(15))
            .header("content-type", "application/json")
            .header("x-user-id", userId)

        additionalHeaders.forEach { (name, value) ->
            requestBuilder.header(name, value)
        }

        val request = when (method) {
            "GET" -> requestBuilder.GET().build()
            "POST" -> requestBuilder.POST(HttpRequest.BodyPublishers.ofString(body ?: "")).build()
            else -> throw IllegalArgumentException("Unsupported method: $method")
        }

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        return ResponseEntity
            .status(HttpStatusCode.valueOf(response.statusCode()))
            .header("cache-control", "no-store")
            .header("content-type", "application/json; charset=utf-8")
            .body(response.body())
    }
}
