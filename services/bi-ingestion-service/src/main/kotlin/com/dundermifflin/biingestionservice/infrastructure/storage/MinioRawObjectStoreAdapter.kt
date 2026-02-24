package com.dundermifflin.biingestionservice.infrastructure.storage

import com.dundermifflin.biingestionservice.domain.model.DomainEventEnvelope
import com.dundermifflin.biingestionservice.domain.port.output.RawObjectStorePort
import com.dundermifflin.biingestionservice.infrastructure.config.BiStorageProperties
import io.minio.BucketExistsArgs
import io.minio.MakeBucketArgs
import io.minio.MinioClient
import io.minio.PutObjectArgs
import io.minio.StatObjectArgs
import io.minio.errors.ErrorResponseException
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets
import java.time.ZoneOffset

@Component
class MinioRawObjectStoreAdapter(
    private val minioClient: MinioClient,
    private val biStorageProperties: BiStorageProperties
) : RawObjectStorePort {
    private val logger = LoggerFactory.getLogger(MinioRawObjectStoreAdapter::class.java)
    private val bucketName = biStorageProperties.rawStore.bucket

    override fun storeRawEventIfMissing(event: DomainEventEnvelope, rawPayload: String) {
        ensureBucketExists()

        val objectName = buildObjectName(event)
        if (objectExists(objectName)) {
            return
        }

        val payloadBytes = rawPayload.toByteArray(StandardCharsets.UTF_8)
        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket(bucketName)
                .`object`(objectName)
                .stream(ByteArrayInputStream(payloadBytes), payloadBytes.size.toLong(), -1)
                .contentType("application/cloudevents+json")
                .build()
        )
    }

    override fun isAvailable(): Boolean {
        return try {
            minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())
        } catch (_: Exception) {
            false
        }
    }

    private fun ensureBucketExists() {
        val exists = try {
            minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())
        } catch (exception: Exception) {
            logger.warn("Failed to check MinIO bucket existence", exception)
            false
        }

        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build())
        }
    }

    private fun objectExists(objectName: String): Boolean {
        return try {
            minioClient.statObject(
                StatObjectArgs.builder()
                    .bucket(bucketName)
                    .`object`(objectName)
                    .build()
            )
            true
        } catch (exception: ErrorResponseException) {
            exception.errorResponse().code() != "NoSuchKey"
        } catch (_: Exception) {
            false
        }
    }

    private fun buildObjectName(event: DomainEventEnvelope): String {
        val datePartition = event.occurredAt.atOffset(ZoneOffset.UTC).toLocalDate().toString()
        val eventTypeSegment = event.eventType.replace(Regex("[^a-zA-Z0-9_.-]"), "_")
        return "event_date=$datePartition/event_type=$eventTypeSegment/${event.eventId}.json"
    }
}
