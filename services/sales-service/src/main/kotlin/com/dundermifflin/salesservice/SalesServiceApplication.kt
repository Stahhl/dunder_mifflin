package com.dundermifflin.salesservice

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class SalesServiceApplication

fun main(args: Array<String>) {
    runApplication<SalesServiceApplication>(*args)
}
