package com.dundermifflin.orderservice.domain.service

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderItem
import com.dundermifflin.orderservice.domain.model.OrderStatus
import com.dundermifflin.orderservice.domain.port.output.DomainEventPublisherPort
import com.dundermifflin.orderservice.domain.port.output.OrderRepositoryPort
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate

class OrderDomainServiceTest {
    private val orderRepositoryPort = mockk<OrderRepositoryPort>()
    private val domainEventPublisherPort = mockk<DomainEventPublisherPort>()
    private val orderDomainService = OrderDomainService(orderRepositoryPort, domainEventPublisherPort)

    @Test
    fun `createOrder persists order and publishes cloud event`() {
        val command = CreateOrderCommand(
            clientId = "client_501",
            requestedShipDate = LocalDate.parse("2026-02-25"),
            items = listOf(OrderItem("PPR-A4-WHT-500", 10)),
            notes = "Front desk delivery",
            createdBy = "jhalpert"
        )

        val createdOrder = Order(
            orderId = "ord_9001",
            clientId = command.clientId,
            requestedShipDate = command.requestedShipDate,
            items = command.items,
            notes = command.notes,
            createdBy = command.createdBy,
            status = OrderStatus.CREATED,
            createdAt = Instant.parse("2026-02-20T14:00:00Z"),
            shipmentId = null
        )

        every { orderRepositoryPort.createOrder(command) } returns createdOrder
        every { domainEventPublisherPort.publishOrderCreated(createdOrder) } just runs

        val result = orderDomainService.createOrder(command)

        assertEquals(createdOrder.orderId, result.orderId)
        assertEquals(OrderStatus.CREATED, result.status)
        verify(exactly = 1) { orderRepositoryPort.createOrder(command) }
        verify(exactly = 1) { domainEventPublisherPort.publishOrderCreated(createdOrder) }
    }

    @Test
    fun `createOrder survives publisher failure`() {
        val command = CreateOrderCommand(
            clientId = "client_501",
            requestedShipDate = LocalDate.parse("2026-02-25"),
            items = listOf(OrderItem("PPR-A4-WHT-500", 10)),
            notes = "Front desk delivery",
            createdBy = "jhalpert"
        )

        val createdOrder = Order(
            orderId = "ord_9001",
            clientId = command.clientId,
            requestedShipDate = command.requestedShipDate,
            items = command.items,
            notes = command.notes,
            createdBy = command.createdBy,
            status = OrderStatus.CREATED,
            createdAt = Instant.parse("2026-02-20T14:00:00Z"),
            shipmentId = null
        )

        every { orderRepositoryPort.createOrder(command) } returns createdOrder
        every { domainEventPublisherPort.publishOrderCreated(createdOrder) } throws RuntimeException("rabbit unavailable")

        val result = orderDomainService.createOrder(command)

        assertEquals(createdOrder.orderId, result.orderId)
        verify(exactly = 1) { orderRepositoryPort.createOrder(command) }
        verify(exactly = 1) { domainEventPublisherPort.publishOrderCreated(createdOrder) }
    }
}
