package com.dundermifflin.biingestionservice.infrastructure.config

import com.dundermifflin.biingestionservice.domain.port.output.BiWarehousePort
import com.dundermifflin.biingestionservice.domain.port.output.RawObjectStorePort
import org.springframework.boot.actuate.health.Health
import org.springframework.boot.actuate.health.HealthIndicator
import org.springframework.stereotype.Component

@Component("biDependencies")
class BiDependenciesHealthIndicator(
    private val biWarehousePort: BiWarehousePort,
    private val rawObjectStorePort: RawObjectStorePort
) : HealthIndicator {
    override fun health(): Health {
        val clickhouseReady = biWarehousePort.ping()
        val minioReady = rawObjectStorePort.isAvailable()

        return if (clickhouseReady && minioReady) {
            Health.up()
                .withDetail("clickhouse", "up")
                .withDetail("minio", "up")
                .build()
        } else {
            Health.down()
                .withDetail("clickhouse", if (clickhouseReady) "up" else "down")
                .withDetail("minio", if (minioReady) "up" else "down")
                .build()
        }
    }
}
