package com.dundermifflin.salesservice.domain.port.input

import com.dundermifflin.salesservice.domain.model.Client
import com.dundermifflin.salesservice.domain.model.ConvertLeadCommand
import com.dundermifflin.salesservice.domain.model.CreateLeadCommand
import com.dundermifflin.salesservice.domain.model.Lead
import com.dundermifflin.salesservice.domain.model.LeadConversionResult
import com.dundermifflin.salesservice.domain.model.LeadStatus
import com.dundermifflin.salesservice.domain.model.LeadSummary
import com.dundermifflin.salesservice.domain.model.UpdateLeadCommand

interface SalesUseCase {
    fun createLead(command: CreateLeadCommand): Lead
    fun listLeads(status: LeadStatus?): List<LeadSummary>
    fun getLead(leadId: String): Lead?
    fun updateLead(command: UpdateLeadCommand): Lead?
    fun listClients(): List<Client>
    fun convertLead(command: ConvertLeadCommand): LeadConversionResult
}
