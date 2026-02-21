package com.dundermifflin.profileservice.domain.service

import com.dundermifflin.profileservice.domain.model.UpdateProfileCommand
import com.dundermifflin.profileservice.domain.port.input.ProfileUseCase
import com.dundermifflin.profileservice.domain.port.output.ProfileEventPublisherPort
import com.dundermifflin.profileservice.domain.port.output.ProfileRepositoryPort
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ProfileDomainService(
    private val profileRepositoryPort: ProfileRepositoryPort,
    private val profileEventPublisherPort: ProfileEventPublisherPort
) : ProfileUseCase {
    private val logger = LoggerFactory.getLogger(ProfileDomainService::class.java)

    override fun getOrCreateCurrentProfile(userId: String, displayName: String?) =
        profileRepositoryPort.findByUserId(userId)
            ?: profileRepositoryPort.createDefaultProfile(userId, displayName)

    @Transactional
    override fun updateCurrentProfile(command: UpdateProfileCommand) =
        profileRepositoryPort.updateProfile(command).also { updated ->
            try {
                profileEventPublisherPort.publishProfileUpdated(updated, command.updatedBy)
            } catch (exception: Exception) {
                logger.error("Failed to publish profile.updated.v1 in profile-service", exception)
            }
        }
}
