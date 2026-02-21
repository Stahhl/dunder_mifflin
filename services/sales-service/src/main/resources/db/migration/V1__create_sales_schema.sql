CREATE SCHEMA IF NOT EXISTS sales;

CREATE SEQUENCE IF NOT EXISTS sales.lead_number_seq START WITH 4001;
CREATE SEQUENCE IF NOT EXISTS sales.client_number_seq START WITH 7001;

CREATE TABLE IF NOT EXISTS sales.leads (
  lead_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  converted_client_id TEXT NULL,
  converted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_leads_status_created
  ON sales.leads (status, created_at DESC);

CREATE TABLE IF NOT EXISTS sales.clients (
  client_id TEXT PRIMARY KEY,
  source_lead_id TEXT NOT NULL UNIQUE REFERENCES sales.leads(lead_id) ON DELETE RESTRICT,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_clients_created
  ON sales.clients (created_at DESC);
