package com.dundermifflin.financeservice

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class FinanceServiceApplication

fun main(args: Array<String>) {
    runApplication<FinanceServiceApplication>(*args)
}
