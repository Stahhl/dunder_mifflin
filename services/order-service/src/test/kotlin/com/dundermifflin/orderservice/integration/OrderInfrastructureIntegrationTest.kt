package com.dundermifflin.orderservice.integration

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.OrderItem
import com.dundermifflin.orderservice.domain.port.output.DomainEventPublisherPort
import com.dundermifflin.orderservice.domain.port.output.OrderRepositoryPort
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.TopicExchange
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.containers.RabbitMQContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.LocalDate

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class OrderInfrastructureIntegrationTest {
    @Autowired
    lateinit var orderRepositoryPort: OrderRepositoryPort

    @Autowired
    lateinit var domainEventPublisherPort: DomainEventPublisherPort

    @Autowired
    lateinit var rabbitTemplate: RabbitTemplate

    @Autowired
    lateinit var topicExchange: TopicExchange

    @Test
    fun `persists order and publishes order created event`() {
        val order = orderRepositoryPort.createOrder(
            CreateOrderCommand(
                clientId = "it_client_${System.currentTimeMillis()}",
                requestedShipDate = LocalDate.parse("2026-03-01"),
                items = listOf(OrderItem("PPR-A4-WHT-500", 7)),
                notes = "integration test",
                createdBy = "jhalpert"
            )
        )

        assertNotNull(order.orderId)
        val loaded = orderRepositoryPort.getOrderById(order.orderId)
        assertNotNull(loaded)
        assertEquals("CREATED", loaded!!.status.name)

        val queue = Queue("order-service-it-${System.currentTimeMillis()}", false, true, true)
        val binding = BindingBuilder.bind(queue).to(topicExchange).with("order.created.v1")
        rabbitTemplate.execute { channel ->
            channel.queueDeclare(queue.name, false, true, true, null)
            channel.queueBind(queue.name, topicExchange.name, "order.created.v1")
            true
        }

        domainEventPublisherPort.publishOrderCreated(order)

        val received = rabbitTemplate.receiveAndConvert(queue.name, 5_000)
        assertNotNull(received)
    }

    companion object {
        @Container
        private val postgres = PostgreSQLContainer("postgres:16-alpine")

        @Container
        private val rabbit = RabbitMQContainer("rabbitmq:3.13-management-alpine")

        @JvmStatic
        @DynamicPropertySource
        fun registerProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
            registry.add("spring.rabbitmq.host", rabbit::getHost)
            registry.add("spring.rabbitmq.port", rabbit::getAmqpPort)
            registry.add("spring.rabbitmq.username", rabbit::getAdminUsername)
            registry.add("spring.rabbitmq.password", rabbit::getAdminPassword)
            registry.add("order.exchange") { "dm.domain.events" }
        }
    }
}
