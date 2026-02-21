package com.dundermifflin.profileservice.domain.port.output

import com.dundermifflin.profileservice.domain.model.UserProfile

interface ProfileEventPublisherPort {
    fun publishProfileUpdated(profile: UserProfile, updatedBy: String)
}
