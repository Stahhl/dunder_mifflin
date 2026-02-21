package com.dundermifflin.inventoryservice.domain.service

import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentCommand
import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentResult
import com.dundermifflin.inventoryservice.domain.model.OrderCreatedEvent
import com.dundermifflin.inventoryservice.domain.model.RecordScanCommand
import com.dundermifflin.inventoryservice.domain.model.ScanShipmentResult
import com.dundermifflin.inventoryservice.domain.model.ShipmentSummary
import com.dundermifflin.inventoryservice.domain.port.input.InventoryUseCase
import com.dundermifflin.inventoryservice.domain.port.output.InventoryRepositoryPort
import com.dundermifflin.inventoryservice.domain.port.output.ShipmentEventPublisherPort
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class InventoryDomainService(
    private val inventoryRepositoryPort: InventoryRepositoryPort,
    private val shipmentEventPublisherPort: ShipmentEventPublisherPort
) : InventoryUseCase {
    private val logger = LoggerFactory.getLogger(InventoryDomainService::class.java)

    override fun registerOrderCreated(event: OrderCreatedEvent) {
        inventoryRepositoryPort.upsertShipmentFromOrderCreated(event)
    }

    override fun listShipments(status: String?): List<ShipmentSummary> = inventoryRepositoryPort.listShipments(status)

    override fun recordScan(command: RecordScanCommand): ScanShipmentResult? = inventoryRepositoryPort.recordScan(command)

    override fun dispatchShipment(command: DispatchShipmentCommand): DispatchShipmentResult? {
        val result = inventoryRepositoryPort.dispatchShipment(command) ?: return null

        if (!result.alreadyDispatched) {
            try {
                shipmentEventPublisherPort.publishShipmentDispatched(result)
            } catch (exception: Exception) {
                logger.error("Failed to publish shipment.dispatched.v1 in inventory-service", exception)
            }
        }

        return result
    }
}
