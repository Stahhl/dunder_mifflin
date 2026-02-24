package com.dundermifflin.biingestionservice

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class BiIngestionServiceApplication

fun main(args: Array<String>) {
    runApplication<BiIngestionServiceApplication>(*args)
}
