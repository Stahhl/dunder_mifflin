package com.dundermifflin.wuphfservice.domain.service

import com.dundermifflin.wuphfservice.domain.model.CreateNotificationCommand
import com.dundermifflin.wuphfservice.domain.model.MarkNotificationReadResult
import com.dundermifflin.wuphfservice.domain.model.Notification
import com.dundermifflin.wuphfservice.domain.port.input.NotificationUseCase
import com.dundermifflin.wuphfservice.domain.port.output.NotificationRepositoryPort
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class NotificationDomainService(
    private val notificationRepositoryPort: NotificationRepositoryPort
) : NotificationUseCase {
    override fun listNotifications(userId: String, unreadOnly: Boolean): List<Notification> {
        return notificationRepositoryPort.listNotifications(userId, unreadOnly)
    }

    override fun markRead(userId: String, notificationId: String): MarkNotificationReadResult {
        val existing = notificationRepositoryPort.getNotificationForUser(userId, notificationId)
            ?: return MarkNotificationReadResult.NotFound(notificationId)

        if (existing.isRead) {
            return MarkNotificationReadResult.Updated(existing)
        }

        val updated = notificationRepositoryPort.markRead(userId, notificationId, Instant.now())
            ?: return MarkNotificationReadResult.NotFound(notificationId)

        return MarkNotificationReadResult.Updated(updated)
    }

    override fun createNotification(command: CreateNotificationCommand): Notification {
        val sourceEventId = command.sourceEventId?.trim().takeUnless { it.isNullOrBlank() }
        if (sourceEventId != null) {
            val existing = notificationRepositoryPort.findByUserAndSourceEventId(command.userId, sourceEventId)
            if (existing != null) {
                return existing
            }
        }

        return notificationRepositoryPort.createNotification(command)
    }
}
