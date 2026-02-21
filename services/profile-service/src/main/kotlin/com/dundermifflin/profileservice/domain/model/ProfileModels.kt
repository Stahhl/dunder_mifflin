package com.dundermifflin.profileservice.domain.model

import java.time.Instant

enum class PreferredApp {
    PORTAL,
    INFINITY,
    WAREHOUSE_MOBILE,
    ACCOUNTING;

    companion object {
        fun fromExternal(value: String): PreferredApp? {
            return when (value.trim().lowercase()) {
                "portal" -> PORTAL
                "infinity" -> INFINITY
                "warehouse-mobile" -> WAREHOUSE_MOBILE
                "accounting" -> ACCOUNTING
                else -> null
            }
        }
    }

    fun toExternal(): String {
        return when (this) {
            PORTAL -> "portal"
            INFINITY -> "infinity"
            WAREHOUSE_MOBILE -> "warehouse-mobile"
            ACCOUNTING -> "accounting"
        }
    }
}

data class UserProfile(
    val userId: String,
    val fullName: String,
    val email: String,
    val title: String,
    val phone: String,
    val defaultApp: PreferredApp,
    val notificationsEnabled: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class UpdateProfileCommand(
    val userId: String,
    val fullName: String,
    val email: String,
    val title: String,
    val phone: String,
    val defaultApp: PreferredApp,
    val notificationsEnabled: Boolean,
    val updatedBy: String
)
