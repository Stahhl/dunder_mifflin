package com.dundermifflin.financeservice

import com.dundermifflin.financeservice.infrastructure.config.FinanceMessagingProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(FinanceMessagingProperties::class)
class FinanceServiceApplication

fun main(args: Array<String>) {
    runApplication<FinanceServiceApplication>(*args)
}
