package com.dundermifflin.inventoryservice.domain.port.output

import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentCommand
import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentResult
import com.dundermifflin.inventoryservice.domain.model.OrderCreatedEvent
import com.dundermifflin.inventoryservice.domain.model.RecordScanCommand
import com.dundermifflin.inventoryservice.domain.model.ScanShipmentResult
import com.dundermifflin.inventoryservice.domain.model.ShipmentSummary

interface InventoryRepositoryPort {
    fun upsertShipmentFromOrderCreated(event: OrderCreatedEvent)

    fun listShipments(status: String?): List<ShipmentSummary>

    fun recordScan(command: RecordScanCommand): ScanShipmentResult?

    fun dispatchShipment(command: DispatchShipmentCommand): DispatchShipmentResult?
}
