package com.dundermifflin.wuphfservice.domain.port.input

import com.dundermifflin.wuphfservice.domain.model.CreateNotificationCommand
import com.dundermifflin.wuphfservice.domain.model.MarkNotificationReadResult
import com.dundermifflin.wuphfservice.domain.model.Notification

interface NotificationUseCase {
    fun listNotifications(userId: String, unreadOnly: Boolean): List<Notification>

    fun markRead(userId: String, notificationId: String): MarkNotificationReadResult

    fun createNotification(command: CreateNotificationCommand): Notification
}
