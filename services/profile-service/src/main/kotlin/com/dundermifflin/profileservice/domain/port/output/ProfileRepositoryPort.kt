package com.dundermifflin.profileservice.domain.port.output

import com.dundermifflin.profileservice.domain.model.UpdateProfileCommand
import com.dundermifflin.profileservice.domain.model.UserProfile

interface ProfileRepositoryPort {
    fun findByUserId(userId: String): UserProfile?
    fun createDefaultProfile(userId: String, displayName: String?): UserProfile
    fun updateProfile(command: UpdateProfileCommand): UserProfile
}
