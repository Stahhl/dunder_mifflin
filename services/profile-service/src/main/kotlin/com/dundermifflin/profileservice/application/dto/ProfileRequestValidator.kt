package com.dundermifflin.profileservice.application.dto

import com.dundermifflin.profileservice.domain.model.PreferredApp
import org.springframework.stereotype.Component

@Component
class ProfileRequestValidator {
    fun validateUpdate(payload: UpdateProfileRequest?): List<ApiErrorDetail> {
        if (payload == null) {
            return listOf(ApiErrorDetail(field = "body", issue = "request body is required"))
        }

        val details = mutableListOf<ApiErrorDetail>()

        val profile = payload.profile
        if (profile == null) {
            details += ApiErrorDetail(field = "profile", issue = "profile object is required")
        } else {
            val fullName = profile.fullName?.trim().orEmpty()
            val email = profile.email?.trim().orEmpty()
            if (fullName.isBlank()) {
                details += ApiErrorDetail(field = "profile.fullName", issue = "fullName is required")
            }
            if (email.isBlank()) {
                details += ApiErrorDetail(field = "profile.email", issue = "email is required")
            } else if (!email.contains("@")) {
                details += ApiErrorDetail(field = "profile.email", issue = "email must be valid")
            }
        }

        val preferences = payload.preferences
        if (preferences == null) {
            details += ApiErrorDetail(field = "preferences", issue = "preferences object is required")
        } else {
            val defaultApp = preferences.defaultApp?.trim().orEmpty()
            if (defaultApp.isBlank()) {
                details += ApiErrorDetail(field = "preferences.defaultApp", issue = "defaultApp is required")
            } else if (PreferredApp.fromExternal(defaultApp) == null) {
                details += ApiErrorDetail(
                    field = "preferences.defaultApp",
                    issue = "defaultApp must be one of: portal, infinity, warehouse-mobile, accounting"
                )
            }

            if (preferences.notificationsEnabled == null) {
                details += ApiErrorDetail(
                    field = "preferences.notificationsEnabled",
                    issue = "notificationsEnabled is required"
                )
            }
        }

        return details
    }
}
