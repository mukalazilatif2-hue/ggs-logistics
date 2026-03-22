-- ============================================================
-- GGS Logistics — PostgreSQL Schema (Neon)
-- Run once in your Neon SQL Editor before first deployment
-- Future-ready: company_id on all tables for multi-tenancy
-- ============================================================

-- ── COMPANIES (future multi-tenancy) ──────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default company so foreign keys work immediately
INSERT INTO companies (id, name) VALUES (1, 'GGS Logistics')
  ON CONFLICT (id) DO NOTHING;

-- ── TRANSPORT JOBS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_jobs (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  date_received   DATE,
  client_name     TEXT NOT NULL,
  bl_number       TEXT,
  container_no    TEXT,
  container_size  TEXT,
  weight_kg       INTEGER,
  shipping_line   TEXT,
  items_desc      TEXT,
  eta             DATE,
  status          TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending','InProgress','Delivered')),
  invoice_no      TEXT,
  invoice_date    DATE,
  invoice_amount  BIGINT DEFAULT 0,
  pay_status      TEXT NOT NULL DEFAULT 'Unpaid'
                    CHECK (pay_status IN ('Unpaid','Partial','Paid')),
  notes           TEXT,
  attachment_url  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSPORT COSTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_costs (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  job_id      INTEGER NOT NULL REFERENCES transport_jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      BIGINT NOT NULL DEFAULT 0,
  cost_date   DATE,
  category    TEXT DEFAULT 'General',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSPORT PAYMENTS (client payments) ──────────────────────
CREATE TABLE IF NOT EXISTS transport_payments (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  job_id      INTEGER REFERENCES transport_jobs(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  invoice_no  TEXT,
  total_amount BIGINT DEFAULT 0,
  amount_paid BIGINT DEFAULT 0,
  payment_date DATE,
  method      TEXT DEFAULT 'Bank Transfer',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUPPLIER PAYMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payments (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  supplier_name TEXT NOT NULL,
  container_no  TEXT,
  job_id        INTEGER REFERENCES transport_jobs(id) ON DELETE SET NULL,
  service       TEXT,
  total_owed    BIGINT DEFAULT 0,
  amount_paid   BIGINT DEFAULT 0,
  payment_date  DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── COMPANY EXPENSES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  category    TEXT,
  amount      BIGINT NOT NULL DEFAULT 0,
  method      TEXT DEFAULT 'Cash',
  container_no TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOANS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  client_name    TEXT NOT NULL,
  amount         BIGINT NOT NULL,
  interest_rate  NUMERIC(5,2) NOT NULL DEFAULT 0,
  payment_period TEXT,
  date_issued    DATE NOT NULL DEFAULT CURRENT_DATE,
  container_no   TEXT,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active','Cleared','Overdue')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOAN REPAYMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_repayments (
  id           SERIAL PRIMARY KEY,
  company_id   INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  loan_id      INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  client_name  TEXT NOT NULL,
  amount_paid  BIGINT NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  repay_type   TEXT DEFAULT 'Both'
                 CHECK (repay_type IN ('Principal','Interest','Both')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES for common lookups ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_company    ON transport_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON transport_jobs(status);
CREATE INDEX IF NOT EXISTS idx_costs_job       ON transport_costs(job_id);
CREATE INDEX IF NOT EXISTS idx_tpay_job        ON transport_payments(job_id);
CREATE INDEX IF NOT EXISTS idx_spay_company    ON supplier_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_loans_company   ON loans(company_id);
CREATE INDEX IF NOT EXISTS idx_loans_status    ON loans(status);
CREATE INDEX IF NOT EXISTS idx_repay_loan      ON loan_repayments(loan_id);
