package com.dundermifflin.orderservice.domain.service

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.DispatchShipmentCommand
import com.dundermifflin.orderservice.domain.model.DispatchShipmentResult
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderSummary
import com.dundermifflin.orderservice.domain.model.OrderTimelineEvent
import com.dundermifflin.orderservice.domain.model.ScanShipmentCommand
import com.dundermifflin.orderservice.domain.model.ShipmentWorkItem
import com.dundermifflin.orderservice.domain.port.input.OrderUseCase
import com.dundermifflin.orderservice.domain.port.output.DomainEventPublisherPort
import com.dundermifflin.orderservice.domain.port.output.OrderRepositoryPort
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap

@Service
class OrderDomainService(
    private val orderRepositoryPort: OrderRepositoryPort,
    private val domainEventPublisherPort: DomainEventPublisherPort
) : OrderUseCase {
    private val logger = LoggerFactory.getLogger(OrderDomainService::class.java)
    private val scanState = ConcurrentHashMap<String, MutableMap<String, Int>>()
    private val dispatchByIdempotency = ConcurrentHashMap<String, DispatchShipmentResult>()

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

    override fun listPendingShipments(): List<ShipmentWorkItem> = orderRepositoryPort.listPendingShipments()

    override fun recordScan(command: ScanShipmentCommand): ShipmentWorkItem? {
        val shipment = orderRepositoryPort.getShipmentById(command.shipmentId) ?: return null
        val shipmentScans = scanState.computeIfAbsent(command.shipmentId) { ConcurrentHashMap() }
        val previous = shipmentScans[command.barcode] ?: 0
        shipmentScans[command.barcode] = previous + command.quantity
        return shipment
    }

    override fun dispatchShipment(command: DispatchShipmentCommand): DispatchShipmentResult? {
        dispatchByIdempotency[command.idempotencyKey]?.let { return it }

        val dispatched = orderRepositoryPort.markShipmentDispatched(
            shipmentId = command.shipmentId,
            dispatchedAt = command.dispatchedAt
        ) ?: return null

        dispatchByIdempotency[command.idempotencyKey] = dispatched

        if (!dispatched.alreadyDispatched) {
            try {
                domainEventPublisherPort.publishShipmentDispatched(
                    result = dispatched,
                    dispatchedBy = command.dispatchedBy,
                    truckId = command.truckId
                )
            } catch (exception: Exception) {
                logger.error("Failed to publish shipment.dispatched.v1 in order-service", exception)
            }
        }

        return dispatched
    }
}
