package com.dundermifflin.salesservice.domain.port.output

import com.dundermifflin.salesservice.domain.model.Client
import com.dundermifflin.salesservice.domain.model.Lead

interface SalesEventPublisherPort {
    fun publishLeadConverted(lead: Lead, client: Client, convertedBy: String)
}
