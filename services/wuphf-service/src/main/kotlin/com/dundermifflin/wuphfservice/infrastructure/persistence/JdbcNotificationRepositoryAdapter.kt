package com.dundermifflin.wuphfservice.infrastructure.persistence

import com.dundermifflin.wuphfservice.domain.model.CreateNotificationCommand
import com.dundermifflin.wuphfservice.domain.model.Notification
import com.dundermifflin.wuphfservice.domain.model.NotificationKind
import com.dundermifflin.wuphfservice.domain.port.output.NotificationRepositoryPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant

@Component
class JdbcNotificationRepositoryAdapter(
    private val jdbcTemplate: JdbcTemplate
) : NotificationRepositoryPort {
    override fun listNotifications(userId: String, unreadOnly: Boolean): List<Notification> {
        val sql = if (unreadOnly) {
            """
            SELECT
              notification_id,
              user_id,
              kind,
              title,
              body,
              deep_link,
              is_read,
              created_at,
              read_at,
              source_event_id
            FROM wuphf.notifications
            WHERE user_id = ?
              AND is_read = false
            ORDER BY created_at DESC, notification_id DESC
            LIMIT 100
            """.trimIndent()
        } else {
            """
            SELECT
              notification_id,
              user_id,
              kind,
              title,
              body,
              deep_link,
              is_read,
              created_at,
              read_at,
              source_event_id
            FROM wuphf.notifications
            WHERE user_id = ?
            ORDER BY created_at DESC, notification_id DESC
            LIMIT 100
            """.trimIndent()
        }

        return jdbcTemplate.query(sql, rowMapper, userId)
    }

    override fun getNotificationForUser(userId: String, notificationId: String): Notification? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              notification_id,
              user_id,
              kind,
              title,
              body,
              deep_link,
              is_read,
              created_at,
              read_at,
              source_event_id
            FROM wuphf.notifications
            WHERE user_id = ?
              AND notification_id = ?
            """.trimIndent(),
            rowMapper,
            userId,
            notificationId
        )

        return rows.firstOrNull()
    }

    @Transactional
    override fun markRead(userId: String, notificationId: String, readAt: Instant): Notification? {
        jdbcTemplate.update(
            """
            UPDATE wuphf.notifications
            SET is_read = true,
                read_at = COALESCE(read_at, ?)
            WHERE user_id = ?
              AND notification_id = ?
            """.trimIndent(),
            Timestamp.from(readAt),
            userId,
            notificationId
        )

        return getNotificationForUser(userId, notificationId)
    }

    @Transactional
    override fun createNotification(command: CreateNotificationCommand): Notification {
        val sourceEventId = command.sourceEventId?.trim().takeUnless { it.isNullOrBlank() }

        if (sourceEventId != null) {
            val existing = findByUserAndSourceEventId(command.userId, sourceEventId)
            if (existing != null) {
                return existing
            }
        }

        val notificationId = jdbcTemplate.queryForObject(
            "SELECT 'ntf_' || nextval('wuphf.notification_number_seq')",
            String::class.java
        ) ?: throw IllegalStateException("Failed to allocate notification id")

        val insertedRows = jdbcTemplate.update(
            """
            INSERT INTO wuphf.notifications (
              notification_id,
              user_id,
              kind,
              title,
              body,
              deep_link,
              is_read,
              created_at,
              read_at,
              source_event_id
            ) VALUES (?, ?, ?, ?, ?, ?, false, ?, ?, ?)
            ON CONFLICT DO NOTHING
            """.trimIndent(),
            notificationId,
            command.userId,
            command.kind.name,
            command.title,
            command.body,
            command.deepLink,
            Timestamp.from(command.createdAt),
            null,
            sourceEventId
        )

        if (insertedRows == 0 && sourceEventId != null) {
            val existing = findByUserAndSourceEventId(command.userId, sourceEventId)
            if (existing != null) {
                return existing
            }
        }

        return getNotificationForUser(command.userId, notificationId)
            ?: throw IllegalStateException("Created notification not found")
    }

    override fun findByUserAndSourceEventId(userId: String, sourceEventId: String): Notification? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              notification_id,
              user_id,
              kind,
              title,
              body,
              deep_link,
              is_read,
              created_at,
              read_at,
              source_event_id
            FROM wuphf.notifications
            WHERE user_id = ?
              AND source_event_id = ?
            LIMIT 1
            """.trimIndent(),
            rowMapper,
            userId,
            sourceEventId
        )

        return rows.firstOrNull()
    }

    private val rowMapper = RowMapper { rs: ResultSet, _: Int ->
        Notification(
            notificationId = rs.getString("notification_id"),
            userId = rs.getString("user_id"),
            kind = NotificationKind.valueOf(rs.getString("kind")),
            title = rs.getString("title"),
            body = rs.getString("body"),
            deepLink = rs.getString("deep_link"),
            isRead = rs.getBoolean("is_read"),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            readAt = rs.getTimestamp("read_at")?.toInstant(),
            sourceEventId = rs.getString("source_event_id")
        )
    }
}
