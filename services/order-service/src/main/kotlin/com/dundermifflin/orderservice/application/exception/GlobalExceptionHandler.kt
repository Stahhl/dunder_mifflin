package com.dundermifflin.orderservice.application.exception

import com.dundermifflin.orderservice.application.dto.ApiError
import com.dundermifflin.orderservice.application.dto.ApiErrorEnvelope
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleInvalidJson(exception: HttpMessageNotReadableException): ResponseEntity<ApiErrorEnvelope> {
        return ResponseEntity.badRequest().body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "INVALID_JSON",
                    message = exception.mostSpecificCause?.message ?: "Invalid JSON payload"
                )
            )
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleUnhandled(exception: Exception): ResponseEntity<ApiErrorEnvelope> {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "INTERNAL_ERROR",
                    message = exception.message ?: "Unknown order-service error"
                )
            )
        )
    }
}
