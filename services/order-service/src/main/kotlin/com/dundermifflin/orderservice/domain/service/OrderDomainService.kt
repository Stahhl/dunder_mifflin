package com.dundermifflin.orderservice.domain.service

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderSummary
import com.dundermifflin.orderservice.domain.model.OrderTimelineEvent
import com.dundermifflin.orderservice.domain.port.input.OrderUseCase
import com.dundermifflin.orderservice.domain.port.output.DomainEventPublisherPort
import com.dundermifflin.orderservice.domain.port.output.OrderRepositoryPort
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class OrderDomainService(
    private val orderRepositoryPort: OrderRepositoryPort,
    private val domainEventPublisherPort: DomainEventPublisherPort
) : OrderUseCase {
    private val logger = LoggerFactory.getLogger(OrderDomainService::class.java)

    override fun createOrder(command: CreateOrderCommand): Order {
        val created = orderRepositoryPort.createOrder(command)

        try {
            domainEventPublisherPort.publishOrderCreated(created)
        } catch (exception: Exception) {
            logger.error("Failed to publish order.created.v1 in order-service", exception)
        }

        return created
    }

    override fun listOrders(clientId: String?): List<OrderSummary> = orderRepositoryPort.listOrders(clientId)

    override fun getOrder(orderId: String): Order? = orderRepositoryPort.getOrderById(orderId)

    override fun getTimeline(orderId: String): List<OrderTimelineEvent> = orderRepositoryPort.getTimeline(orderId)
}
