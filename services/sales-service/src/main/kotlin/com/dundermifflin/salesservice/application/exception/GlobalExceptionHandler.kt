package com.dundermifflin.salesservice.application.exception

import com.dundermifflin.salesservice.application.dto.ApiError
import com.dundermifflin.salesservice.application.dto.ApiErrorEnvelope
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

private const val TRACE_ID_ATTR = "sales.traceId"

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleInvalidJson(
        exception: HttpMessageNotReadableException,
        request: HttpServletRequest
    ): ResponseEntity<ApiErrorEnvelope> {
        val traceId = request.getAttribute(TRACE_ID_ATTR)?.toString()
        return ResponseEntity.badRequest().body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "INVALID_JSON",
                    message = exception.mostSpecificCause?.message ?: "Invalid JSON payload",
                    traceId = traceId
                )
            )
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleUnhandled(exception: Exception, request: HttpServletRequest): ResponseEntity<ApiErrorEnvelope> {
        val traceId = request.getAttribute(TRACE_ID_ATTR)?.toString()
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "INTERNAL_ERROR",
                    message = exception.message ?: "Unknown sales-service error",
                    traceId = traceId
                )
            )
        )
    }
}
