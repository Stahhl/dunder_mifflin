CREATE SCHEMA IF NOT EXISTS finance;

CREATE SEQUENCE IF NOT EXISTS finance.expense_number_seq START WITH 6001;

CREATE TABLE IF NOT EXISTS finance.expenses (
  expense_id TEXT PRIMARY KEY,
  submitter_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  decided_by TEXT NULL,
  decided_at TIMESTAMPTZ NULL,
  decision_comment TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_status_created
  ON finance.expenses (status, created_at DESC);
