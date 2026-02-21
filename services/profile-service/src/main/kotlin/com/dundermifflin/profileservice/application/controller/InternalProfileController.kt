package com.dundermifflin.profileservice.application.controller

import com.dundermifflin.profileservice.application.dto.ApiError
import com.dundermifflin.profileservice.application.dto.ApiErrorEnvelope
import com.dundermifflin.profileservice.application.dto.ProfileDetailsResponse
import com.dundermifflin.profileservice.application.dto.ProfilePreferencesResponse
import com.dundermifflin.profileservice.application.dto.ProfileRequestValidator
import com.dundermifflin.profileservice.application.dto.ProfileResponse
import com.dundermifflin.profileservice.application.dto.UpdateProfileRequest
import com.dundermifflin.profileservice.domain.model.PreferredApp
import com.dundermifflin.profileservice.domain.model.UpdateProfileCommand
import com.dundermifflin.profileservice.domain.port.input.ProfileUseCase
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/internal/profile")
class InternalProfileController(
    private val profileUseCase: ProfileUseCase,
    private val profileRequestValidator: ProfileRequestValidator
) {
    @GetMapping("/me")
    fun getMe(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestHeader(name = "x-user-display-name", required = false) displayName: String?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val profile = profileUseCase.getOrCreateCurrentProfile(authenticatedUser, displayName)
        return ResponseEntity.ok(profile.toResponse())
    }

    @PostMapping("/me")
    fun updateMe(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestBody(required = false) payload: UpdateProfileRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val validationDetails = profileRequestValidator.validateUpdate(payload)
        if (validationDetails.isNotEmpty()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Profile update validation failed",
                        details = validationDetails
                    )
                )
            )
        }

        val defaultApp = PreferredApp.fromExternal(payload!!.preferences!!.defaultApp!!.trim())
            ?: return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Profile update validation failed",
                        details = listOf(
                            com.dundermifflin.profileservice.application.dto.ApiErrorDetail(
                                field = "preferences.defaultApp",
                                issue = "defaultApp must be one of: portal, infinity, warehouse-mobile, accounting"
                            )
                        )
                    )
                )
            )

        val updated = profileUseCase.updateCurrentProfile(
            UpdateProfileCommand(
                userId = authenticatedUser,
                fullName = payload.profile!!.fullName!!.trim(),
                email = payload.profile.email!!.trim(),
                title = payload.profile.title?.trim().orEmpty(),
                phone = payload.profile.phone?.trim().orEmpty(),
                defaultApp = defaultApp,
                notificationsEnabled = payload.preferences.notificationsEnabled!!,
                updatedBy = authenticatedUser
            )
        )

        return ResponseEntity.ok(updated.toResponse())
    }

    private fun unauthenticatedResponse(): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "UNAUTHENTICATED",
                message = "x-user-id header is required for internal endpoints"
            )
        )
    )
}

private fun com.dundermifflin.profileservice.domain.model.UserProfile.toResponse(): ProfileResponse =
    ProfileResponse(
        userId = this.userId,
        profile = ProfileDetailsResponse(
            fullName = this.fullName,
            email = this.email,
            title = this.title,
            phone = this.phone
        ),
        preferences = ProfilePreferencesResponse(
            defaultApp = this.defaultApp.toExternal(),
            notificationsEnabled = this.notificationsEnabled
        ),
        createdAt = this.createdAt,
        updatedAt = this.updatedAt
    )
