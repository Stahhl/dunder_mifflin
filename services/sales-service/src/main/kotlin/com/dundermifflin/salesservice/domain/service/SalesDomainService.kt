package com.dundermifflin.salesservice.domain.service

import com.dundermifflin.salesservice.domain.model.ConvertLeadCommand
import com.dundermifflin.salesservice.domain.model.CreateLeadCommand
import com.dundermifflin.salesservice.domain.model.LeadConversionResult
import com.dundermifflin.salesservice.domain.model.LeadStatus
import com.dundermifflin.salesservice.domain.model.UpdateLeadCommand
import com.dundermifflin.salesservice.domain.port.input.SalesUseCase
import com.dundermifflin.salesservice.domain.port.output.SalesEventPublisherPort
import com.dundermifflin.salesservice.domain.port.output.SalesRepositoryPort
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class SalesDomainService(
    private val salesRepositoryPort: SalesRepositoryPort,
    private val salesEventPublisherPort: SalesEventPublisherPort
) : SalesUseCase {
    private val logger = LoggerFactory.getLogger(SalesDomainService::class.java)

    override fun createLead(command: CreateLeadCommand) = salesRepositoryPort.createLead(command)

    override fun listLeads(status: LeadStatus?) = salesRepositoryPort.listLeads(status)

    override fun getLead(leadId: String) = salesRepositoryPort.getLeadById(leadId)

    override fun updateLead(command: UpdateLeadCommand) = salesRepositoryPort.updateLead(command)

    override fun listClients() = salesRepositoryPort.listClients()

    @Transactional
    override fun convertLead(command: ConvertLeadCommand): LeadConversionResult {
        val lead = salesRepositoryPort.getLeadById(command.leadId)
            ?: return LeadConversionResult.NotFound(command.leadId)

        if (lead.convertedClientId != null) {
            val existingClient = salesRepositoryPort.getClientBySourceLeadId(lead.leadId)
            return if (existingClient != null) {
                LeadConversionResult.Converted(lead = lead, client = existingClient, alreadyConverted = true)
            } else {
                LeadConversionResult.NotFound(command.leadId)
            }
        }

        if (lead.status != LeadStatus.QUALIFIED) {
            return LeadConversionResult.NotQualified(lead.leadId, lead.status)
        }

        val convertedAt = Instant.now()
        val client = salesRepositoryPort.createClientFromLead(lead, command.convertedBy, convertedAt)
        val convertedLead = salesRepositoryPort.markLeadConverted(lead.leadId, client.clientId, convertedAt)
            ?: return LeadConversionResult.NotFound(command.leadId)

        try {
            salesEventPublisherPort.publishLeadConverted(convertedLead, client, command.convertedBy)
        } catch (exception: Exception) {
            logger.error("Failed to publish sales.lead.converted.v1 in sales-service", exception)
        }

        return LeadConversionResult.Converted(
            lead = convertedLead,
            client = client,
            alreadyConverted = false
        )
    }
}
