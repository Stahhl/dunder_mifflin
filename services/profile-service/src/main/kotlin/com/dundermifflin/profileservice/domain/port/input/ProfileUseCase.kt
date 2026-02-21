package com.dundermifflin.profileservice.domain.port.input

import com.dundermifflin.profileservice.domain.model.UpdateProfileCommand
import com.dundermifflin.profileservice.domain.model.UserProfile

interface ProfileUseCase {
    fun getOrCreateCurrentProfile(userId: String, displayName: String?): UserProfile
    fun updateCurrentProfile(command: UpdateProfileCommand): UserProfile
}
