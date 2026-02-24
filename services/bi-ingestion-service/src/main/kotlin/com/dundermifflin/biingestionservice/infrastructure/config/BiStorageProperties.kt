package com.dundermifflin.biingestionservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "bi")
data class BiStorageProperties(
    val rawStore: RawStore = RawStore(),
    val clickhouse: Clickhouse = Clickhouse(),
    val minio: Minio = Minio()
) {
    data class RawStore(
        val bucket: String = "dmf-bi-raw-events"
    )

    data class Clickhouse(
        val database: String = "bi_warehouse",
        val readerUsername: String = "bi_reader",
        val readerPassword: String = "bi_reader_password"
    )

    data class Minio(
        val endpoint: String = "http://minio:9000",
        val accessKey: String = "minioadmin",
        val secretKey: String = "minioadmin"
    )
}
