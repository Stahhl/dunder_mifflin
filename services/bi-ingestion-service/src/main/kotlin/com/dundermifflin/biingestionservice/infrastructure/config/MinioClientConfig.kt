package com.dundermifflin.biingestionservice.infrastructure.config

import io.minio.MinioClient
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class MinioClientConfig {
    @Bean
    fun minioClient(biStorageProperties: BiStorageProperties): MinioClient {
        return MinioClient.builder()
            .endpoint(biStorageProperties.minio.endpoint)
            .credentials(
                biStorageProperties.minio.accessKey,
                biStorageProperties.minio.secretKey
            )
            .build()
    }
}
