package com.dundermifflin.wuphfservice.application.exception

import com.dundermifflin.wuphfservice.application.dto.ApiError
import com.dundermifflin.wuphfservice.application.dto.ApiErrorEnvelope
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

private const val TRACE_ID_ATTR = "wuphf.traceId"

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException, request: HttpServletRequest): ResponseEntity<ApiErrorEnvelope> {
        val traceId = request.getAttribute(TRACE_ID_ATTR)?.toString()
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
                    details = details,
                    traceId = traceId
                )
            )
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleUnhandled(ex: Exception, request: HttpServletRequest): ResponseEntity<ApiErrorEnvelope> {
        val traceId = request.getAttribute(TRACE_ID_ATTR)?.toString()
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            ApiErrorEnvelope(
                error = ApiError(
                    code = "INTERNAL_ERROR",
                    message = ex.message ?: "Unexpected service error",
                    traceId = traceId
                )
            )
        )
    }
}
