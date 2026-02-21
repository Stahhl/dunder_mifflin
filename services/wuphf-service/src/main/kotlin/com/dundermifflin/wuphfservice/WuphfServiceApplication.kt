package com.dundermifflin.wuphfservice

import com.dundermifflin.wuphfservice.infrastructure.config.WuphfMessagingProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(WuphfMessagingProperties::class)
class WuphfServiceApplication

fun main(args: Array<String>) {
    runApplication<WuphfServiceApplication>(*args)
}
