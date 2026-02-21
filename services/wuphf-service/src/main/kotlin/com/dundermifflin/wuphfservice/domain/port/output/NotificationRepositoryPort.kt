package com.dundermifflin.wuphfservice.domain.port.output

import com.dundermifflin.wuphfservice.domain.model.CreateNotificationCommand
import com.dundermifflin.wuphfservice.domain.model.Notification
import java.time.Instant

interface NotificationRepositoryPort {
    fun listNotifications(userId: String, unreadOnly: Boolean): List<Notification>

    fun getNotificationForUser(userId: String, notificationId: String): Notification?

    fun markRead(userId: String, notificationId: String, readAt: Instant): Notification?

    fun createNotification(command: CreateNotificationCommand): Notification

    fun findByUserAndSourceEventId(userId: String, sourceEventId: String): Notification?
}
