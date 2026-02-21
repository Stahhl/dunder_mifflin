package com.dundermifflin.profileservice.infrastructure.persistence

import com.dundermifflin.profileservice.domain.model.PreferredApp
import com.dundermifflin.profileservice.domain.model.UpdateProfileCommand
import com.dundermifflin.profileservice.domain.model.UserProfile
import com.dundermifflin.profileservice.domain.port.output.ProfileRepositoryPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant

@Component
class JdbcProfileRepositoryAdapter(
    private val jdbcTemplate: JdbcTemplate
) : ProfileRepositoryPort {
    override fun findByUserId(userId: String): UserProfile? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              user_id,
              full_name,
              email,
              title,
              phone,
              default_app,
              notifications_enabled,
              created_at,
              updated_at
            FROM profile.user_profiles
            WHERE user_id = ?
            """.trimIndent(),
            rowMapper,
            userId
        )

        return rows.firstOrNull()
    }

    @Transactional
    override fun createDefaultProfile(userId: String, displayName: String?): UserProfile {
        val existing = findByUserId(userId)
        if (existing != null) {
            return existing
        }

        val now = Instant.now()
        val normalizedName = displayName?.trim().takeUnless { it.isNullOrBlank() } ?: userId
        val fallbackEmailLocal = userId.trim().ifBlank { "user" }
        val normalizedEmail = "$fallbackEmailLocal@dundermifflin.local"

        jdbcTemplate.update(
            """
            INSERT INTO profile.user_profiles (
              user_id,
              full_name,
              email,
              title,
              phone,
              default_app,
              notifications_enabled,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            userId,
            normalizedName,
            normalizedEmail,
            "",
            "",
            PreferredApp.PORTAL.name,
            true,
            Timestamp.from(now),
            Timestamp.from(now)
        )

        return findByUserId(userId) ?: throw IllegalStateException("Created profile was not found")
    }

    @Transactional
    override fun updateProfile(command: UpdateProfileCommand): UserProfile {
        val now = Instant.now()
        val updatedRows = jdbcTemplate.update(
            """
            UPDATE profile.user_profiles
            SET full_name = ?,
                email = ?,
                title = ?,
                phone = ?,
                default_app = ?,
                notifications_enabled = ?,
                updated_at = ?
            WHERE user_id = ?
            """.trimIndent(),
            command.fullName,
            command.email,
            command.title,
            command.phone,
            command.defaultApp.name,
            command.notificationsEnabled,
            Timestamp.from(now),
            command.userId
        )

        if (updatedRows == 0) {
            throw IllegalStateException("Profile ${command.userId} was not found")
        }

        return findByUserId(command.userId) ?: throw IllegalStateException("Updated profile was not found")
    }

    private val rowMapper = RowMapper { rs: ResultSet, _: Int ->
        UserProfile(
            userId = rs.getString("user_id"),
            fullName = rs.getString("full_name"),
            email = rs.getString("email"),
            title = rs.getString("title") ?: "",
            phone = rs.getString("phone") ?: "",
            defaultApp = PreferredApp.valueOf(rs.getString("default_app")),
            notificationsEnabled = rs.getBoolean("notifications_enabled"),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            updatedAt = rs.getTimestamp("updated_at").toInstant()
        )
    }
}
