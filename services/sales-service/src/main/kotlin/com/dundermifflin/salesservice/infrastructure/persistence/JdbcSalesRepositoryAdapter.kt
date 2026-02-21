package com.dundermifflin.salesservice.infrastructure.persistence

import com.dundermifflin.salesservice.domain.model.Client
import com.dundermifflin.salesservice.domain.model.CreateLeadCommand
import com.dundermifflin.salesservice.domain.model.Lead
import com.dundermifflin.salesservice.domain.model.LeadStatus
import com.dundermifflin.salesservice.domain.model.LeadSummary
import com.dundermifflin.salesservice.domain.model.UpdateLeadCommand
import com.dundermifflin.salesservice.domain.port.output.SalesRepositoryPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant

@Component
class JdbcSalesRepositoryAdapter(
    private val jdbcTemplate: JdbcTemplate
) : SalesRepositoryPort {
    @Transactional
    override fun createLead(command: CreateLeadCommand): Lead {
        val leadId = jdbcTemplate.queryForObject(
            "SELECT 'lead_' || nextval('sales.lead_number_seq')",
            String::class.java
        ) ?: throw IllegalStateException("Failed to allocate lead id")

        val now = Instant.now()

        jdbcTemplate.update(
            """
            INSERT INTO sales.leads (
              lead_id,
              company_name,
              contact_name,
              contact_email,
              phone,
              status,
              notes,
              created_by,
              created_at,
              updated_at,
              converted_client_id,
              converted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            leadId,
            command.companyName,
            command.contactName,
            command.contactEmail,
            command.phone,
            LeadStatus.NEW.name,
            command.notes,
            command.createdBy,
            Timestamp.from(now),
            Timestamp.from(now),
            null,
            null
        )

        return Lead(
            leadId = leadId,
            companyName = command.companyName,
            contactName = command.contactName,
            contactEmail = command.contactEmail,
            phone = command.phone,
            status = LeadStatus.NEW,
            notes = command.notes,
            createdBy = command.createdBy,
            createdAt = now,
            updatedAt = now,
            convertedClientId = null,
            convertedAt = null
        )
    }

    override fun listLeads(status: LeadStatus?): List<LeadSummary> {
        val sql: String
        val args: Array<Any>

        if (status == null) {
            sql =
                """
                SELECT
                  lead_id,
                  company_name,
                  contact_name,
                  contact_email,
                  status,
                  created_at,
                  converted_client_id
                FROM sales.leads
                ORDER BY created_at DESC, lead_id DESC
                """.trimIndent()
            args = emptyArray()
        } else {
            sql =
                """
                SELECT
                  lead_id,
                  company_name,
                  contact_name,
                  contact_email,
                  status,
                  created_at,
                  converted_client_id
                FROM sales.leads
                WHERE status = ?
                ORDER BY created_at DESC, lead_id DESC
                """.trimIndent()
            args = arrayOf(status.name)
        }

        return jdbcTemplate.query(sql, leadSummaryRowMapper, *args)
    }

    override fun getLeadById(leadId: String): Lead? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              lead_id,
              company_name,
              contact_name,
              contact_email,
              phone,
              status,
              notes,
              created_by,
              created_at,
              updated_at,
              converted_client_id,
              converted_at
            FROM sales.leads
            WHERE lead_id = ?
            """.trimIndent(),
            leadRowMapper,
            leadId
        )

        return rows.firstOrNull()
    }

    @Transactional
    override fun updateLead(command: UpdateLeadCommand): Lead? {
        val now = Instant.now()
        val updatedRows = jdbcTemplate.update(
            """
            UPDATE sales.leads
            SET status = ?,
                notes = ?,
                updated_at = ?
            WHERE lead_id = ?
            """.trimIndent(),
            command.status.name,
            command.notes,
            Timestamp.from(now),
            command.leadId
        )

        if (updatedRows == 0) {
            return null
        }

        return getLeadById(command.leadId)
    }

    override fun getClientBySourceLeadId(leadId: String): Client? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              client_id,
              source_lead_id,
              company_name,
              contact_name,
              contact_email,
              phone,
              created_by,
              created_at
            FROM sales.clients
            WHERE source_lead_id = ?
            LIMIT 1
            """.trimIndent(),
            clientRowMapper,
            leadId
        )

        return rows.firstOrNull()
    }

    @Transactional
    override fun createClientFromLead(lead: Lead, convertedBy: String, convertedAt: Instant): Client {
        val existing = getClientBySourceLeadId(lead.leadId)
        if (existing != null) {
            return existing
        }

        val clientId = jdbcTemplate.queryForObject(
            "SELECT 'client_' || nextval('sales.client_number_seq')",
            String::class.java
        ) ?: throw IllegalStateException("Failed to allocate client id")

        jdbcTemplate.update(
            """
            INSERT INTO sales.clients (
              client_id,
              source_lead_id,
              company_name,
              contact_name,
              contact_email,
              phone,
              created_by,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            clientId,
            lead.leadId,
            lead.companyName,
            lead.contactName,
            lead.contactEmail,
            lead.phone,
            convertedBy,
            Timestamp.from(convertedAt)
        )

        return Client(
            clientId = clientId,
            sourceLeadId = lead.leadId,
            companyName = lead.companyName,
            contactName = lead.contactName,
            contactEmail = lead.contactEmail,
            phone = lead.phone,
            createdBy = convertedBy,
            createdAt = convertedAt
        )
    }

    @Transactional
    override fun markLeadConverted(leadId: String, clientId: String, convertedAt: Instant): Lead? {
        val updatedRows = jdbcTemplate.update(
            """
            UPDATE sales.leads
            SET status = ?,
                converted_client_id = ?,
                converted_at = ?,
                updated_at = ?
            WHERE lead_id = ?
            """.trimIndent(),
            LeadStatus.CONVERTED.name,
            clientId,
            Timestamp.from(convertedAt),
            Timestamp.from(convertedAt),
            leadId
        )

        if (updatedRows == 0) {
            return null
        }

        return getLeadById(leadId)
    }

    override fun listClients(): List<Client> {
        return jdbcTemplate.query(
            """
            SELECT
              client_id,
              source_lead_id,
              company_name,
              contact_name,
              contact_email,
              phone,
              created_by,
              created_at
            FROM sales.clients
            ORDER BY created_at DESC, client_id DESC
            """.trimIndent(),
            clientRowMapper
        )
    }

    private val leadSummaryRowMapper = RowMapper { rs: ResultSet, _: Int ->
        LeadSummary(
            leadId = rs.getString("lead_id"),
            companyName = rs.getString("company_name"),
            contactName = rs.getString("contact_name"),
            contactEmail = rs.getString("contact_email"),
            status = LeadStatus.valueOf(rs.getString("status")),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            convertedClientId = rs.getString("converted_client_id")
        )
    }

    private val leadRowMapper = RowMapper { rs: ResultSet, _: Int ->
        Lead(
            leadId = rs.getString("lead_id"),
            companyName = rs.getString("company_name"),
            contactName = rs.getString("contact_name"),
            contactEmail = rs.getString("contact_email"),
            phone = rs.getString("phone"),
            status = LeadStatus.valueOf(rs.getString("status")),
            notes = rs.getString("notes") ?: "",
            createdBy = rs.getString("created_by"),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            updatedAt = rs.getTimestamp("updated_at").toInstant(),
            convertedClientId = rs.getString("converted_client_id"),
            convertedAt = rs.getTimestamp("converted_at")?.toInstant()
        )
    }

    private val clientRowMapper = RowMapper { rs: ResultSet, _: Int ->
        Client(
            clientId = rs.getString("client_id"),
            sourceLeadId = rs.getString("source_lead_id"),
            companyName = rs.getString("company_name"),
            contactName = rs.getString("contact_name"),
            contactEmail = rs.getString("contact_email"),
            phone = rs.getString("phone"),
            createdBy = rs.getString("created_by"),
            createdAt = rs.getTimestamp("created_at").toInstant()
        )
    }
}
