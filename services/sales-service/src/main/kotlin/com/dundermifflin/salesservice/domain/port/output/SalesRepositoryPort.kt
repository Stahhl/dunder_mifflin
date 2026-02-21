package com.dundermifflin.salesservice.domain.port.output

import com.dundermifflin.salesservice.domain.model.Client
import com.dundermifflin.salesservice.domain.model.CreateLeadCommand
import com.dundermifflin.salesservice.domain.model.Lead
import com.dundermifflin.salesservice.domain.model.LeadStatus
import com.dundermifflin.salesservice.domain.model.LeadSummary
import com.dundermifflin.salesservice.domain.model.UpdateLeadCommand
import java.time.Instant

interface SalesRepositoryPort {
    fun createLead(command: CreateLeadCommand): Lead
    fun listLeads(status: LeadStatus?): List<LeadSummary>
    fun getLeadById(leadId: String): Lead?
    fun updateLead(command: UpdateLeadCommand): Lead?
    fun getClientBySourceLeadId(leadId: String): Client?
    fun createClientFromLead(lead: Lead, convertedBy: String, convertedAt: Instant): Client
    fun markLeadConverted(leadId: String, clientId: String, convertedAt: Instant): Lead?
    fun listClients(): List<Client>
}
