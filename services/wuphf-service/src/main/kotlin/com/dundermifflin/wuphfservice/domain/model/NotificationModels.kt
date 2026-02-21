package com.dundermifflin.wuphfservice.domain.model

import java.time.Instant

enum class NotificationKind {
    ORDER_PLACED,
    SHIPMENT_DISPATCHED,
    EXPENSE_DECIDED
}

data class Notification(
    val notificationId: String,
    val userId: String,
    val kind: NotificationKind,
    val title: String,
    val body: String,
    val deepLink: String,
    val isRead: Boolean,
    val createdAt: Instant,
    val readAt: Instant?,
    val sourceEventId: String?
)

data class CreateNotificationCommand(
    val userId: String,
    val kind: NotificationKind,
    val title: String,
    val body: String,
    val deepLink: String,
    val sourceEventId: String?,
    val createdAt: Instant
)

sealed interface MarkNotificationReadResult {
    data class Updated(val notification: Notification) : MarkNotificationReadResult
    data class NotFound(val notificationId: String) : MarkNotificationReadResult
}
