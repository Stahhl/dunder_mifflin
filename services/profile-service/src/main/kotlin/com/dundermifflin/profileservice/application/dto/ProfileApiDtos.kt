package com.dundermifflin.profileservice.application.dto

import java.time.Instant

data class ProfileResponse(
    val userId: String,
    val profile: ProfileDetailsResponse,
    val preferences: ProfilePreferencesResponse,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class ProfileDetailsResponse(
    val fullName: String,
    val email: String,
    val title: String,
    val phone: String
)

data class ProfilePreferencesResponse(
    val defaultApp: String,
    val notificationsEnabled: Boolean
)

data class UpdateProfileRequest(
    val profile: UpdateProfileDetailsRequest?,
    val preferences: UpdateProfilePreferencesRequest?
)

data class UpdateProfileDetailsRequest(
    val fullName: String?,
    val email: String?,
    val title: String?,
    val phone: String?
)

data class UpdateProfilePreferencesRequest(
    val defaultApp: String?,
    val notificationsEnabled: Boolean?
)

data class ApiErrorEnvelope(
    val error: ApiError
)

data class ApiError(
    val code: String,
    val message: String,
    val details: List<ApiErrorDetail> = emptyList(),
    val traceId: String? = null
)

data class ApiErrorDetail(
    val field: String,
    val issue: String
)
