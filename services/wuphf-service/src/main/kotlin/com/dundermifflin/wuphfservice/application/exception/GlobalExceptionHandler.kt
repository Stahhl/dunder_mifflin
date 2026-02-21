package com.dundermifflin.wuphfservice.application.exception

import com.dundermifflin.wuphfservice.application.dto.ApiError
import com.dundermifflin.wuphfservice.application.dto.ApiErrorEnvelope
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ApiErrorEnvelope> {
        val details = ex.bindingResult.fieldErrors.map {
            com.dundermifflin.wuphfservice.application.dto.ApiErrorDetail(
                field = it.field,
                issue = it.defaultMessage ?: "invalid"
            )
        }

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "VALIDATION_ERROR",
                    message = "Request validation failed",
                    details = details
                )
            )
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleUnhandled(ex: Exception): ResponseEntity<ApiErrorEnvelope> {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "INTERNAL_ERROR",
                    message = ex.message ?: "Unexpected service error"
                )
            )
        )
    }
}
