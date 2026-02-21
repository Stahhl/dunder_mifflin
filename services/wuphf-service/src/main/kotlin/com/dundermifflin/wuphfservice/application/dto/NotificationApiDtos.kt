package com.dundermifflin.wuphfservice.application.dto

import com.dundermifflin.wuphfservice.domain.model.Notification
import java.time.Instant

data class NotificationResponse(
    val notificationId: String,
    val userId: String,
    val kind: String,
    val title: String,
    val body: String,
    val deepLink: String,
    val isRead: Boolean,
    val createdAt: Instant,
    val readAt: Instant?
)

fun Notification.toApiResponse(): NotificationResponse = NotificationResponse(
    notificationId = notificationId,
    userId = userId,
    kind = kind.name,
    title = title,
    body = body,
    deepLink = deepLink,
    isRead = isRead,
    createdAt = createdAt,
    readAt = readAt
)
