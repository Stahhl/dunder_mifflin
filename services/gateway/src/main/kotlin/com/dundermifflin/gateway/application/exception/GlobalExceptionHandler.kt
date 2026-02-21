package com.dundermifflin.gateway.application.exception

import com.dundermifflin.gateway.infrastructure.observability.TRACE_ID_ATTR
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(Exception::class)
    fun handleUnhandled(exception: Exception, request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        val traceId = request.getAttribute(TRACE_ID_ATTR)?.toString()

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            mapOf(
                "error" to mapOf(
                    "code" to "INTERNAL_ERROR",
                    "message" to (exception.message ?: "Unknown gateway error"),
                    "traceId" to traceId
                )
            )
        )
    }
}
