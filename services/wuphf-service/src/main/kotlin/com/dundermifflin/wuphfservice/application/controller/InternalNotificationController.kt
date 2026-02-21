package com.dundermifflin.wuphfservice.application.controller

import com.dundermifflin.wuphfservice.application.dto.ApiError
import com.dundermifflin.wuphfservice.application.dto.ApiErrorEnvelope
import com.dundermifflin.wuphfservice.application.dto.toApiResponse
import com.dundermifflin.wuphfservice.domain.model.MarkNotificationReadResult
import com.dundermifflin.wuphfservice.domain.port.input.NotificationUseCase
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/internal/notifications")
class InternalNotificationController(
    private val notificationUseCase: NotificationUseCase
) {
    @GetMapping
    fun listNotifications(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestParam(name = "unreadOnly", required = false, defaultValue = "false") unreadOnly: Boolean
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val items = notificationUseCase.listNotifications(authenticatedUser, unreadOnly)
        val unreadCount = items.count { !it.isRead }

        return ResponseEntity.ok(
            mapOf(
                "items" to items.map { it.toApiResponse() },
                "total" to items.size,
                "unreadCount" to unreadCount
            )
        )
    }

    @PostMapping("/{notificationId}/read")
    fun markRead(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable notificationId: String
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        return when (val result = notificationUseCase.markRead(authenticatedUser, notificationId)) {
            is MarkNotificationReadResult.NotFound -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "NOTIFICATION_NOT_FOUND",
                        message = "Notification ${result.notificationId} was not found"
                    )
                )
            )

            is MarkNotificationReadResult.Updated -> ResponseEntity.ok(result.notification.toApiResponse())
        }
    }

    private fun unauthenticatedResponse(): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "UNAUTHENTICATED",
                message = "x-user-id header is required for internal endpoints"
            )
        )
    )
}
