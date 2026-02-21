package com.dundermifflin.profileservice.infrastructure.messaging

import com.dundermifflin.profileservice.domain.model.UserProfile
import com.dundermifflin.profileservice.domain.port.output.ProfileEventPublisherPort
import com.dundermifflin.profileservice.infrastructure.config.ProfileMessagingProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.amqp.core.MessageDeliveryMode
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Component
import java.util.UUID

private const val PROFILE_UPDATED_EVENT_TYPE = "com.dundermifflin.profile.updated.v1"
private const val PROFILE_UPDATED_ROUTING_KEY = "profile.updated.v1"

@Component
class RabbitProfileEventPublisher(
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val profileMessagingProperties: ProfileMessagingProperties
) : ProfileEventPublisherPort {
    override fun publishProfileUpdated(profile: UserProfile, updatedBy: String) {
        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "")}" 

        val payload = mapOf(
            "specversion" to "1.0",
            "id" to eventId,
            "type" to PROFILE_UPDATED_EVENT_TYPE,
            "source" to "/profile-service",
            "subject" to "profile/${profile.userId}",
            "time" to profile.updatedAt.toString(),
            "datacontenttype" to "application/json",
            "data" to mapOf(
                "userId" to profile.userId,
                "fullName" to profile.fullName,
                "email" to profile.email,
                "defaultApp" to profile.defaultApp.toExternal(),
                "notificationsEnabled" to profile.notificationsEnabled,
                "updatedBy" to updatedBy,
                "updatedAt" to profile.updatedAt.toString()
            )
        )

        val body = objectMapper.writeValueAsString(payload)
        rabbitTemplate.convertAndSend(profileMessagingProperties.exchange, PROFILE_UPDATED_ROUTING_KEY, body) { message ->
            message.messageProperties.contentType = "application/cloudevents+json"
            message.messageProperties.deliveryMode = MessageDeliveryMode.PERSISTENT
            message.messageProperties.messageId = eventId
            message.messageProperties.type = PROFILE_UPDATED_EVENT_TYPE
            message
        }
    }
}
