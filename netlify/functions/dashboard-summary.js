// netlify/functions/dashboard-summary.js
const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  if (event.httpMethod !== 'GET') return err('GET only', 405);
  const sql = getDb();

  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    // ── Transport ─────────────────────────────────────────────
    const [transport] = await sql`
      SELECT
        COUNT(*)                                                     AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'Delivered')                AS delivered,
        COUNT(*) FILTER (WHERE status IN ('Pending','InProgress'))   AS active,
        COALESCE(SUM(invoice_amount) FILTER (WHERE status='Delivered'), 0) AS gross_revenue,
        COALESCE(SUM(invoice_amount) FILTER (
          WHERE status='Delivered' AND date_received >= ${monthStart}
        ), 0) AS month_revenue
      FROM transport_jobs WHERE company_id = 1`;

    const [payments] = await sql`
      SELECT
        COALESCE(SUM(amount_paid), 0)                              AS total_collected,
        COALESCE(SUM(total_amount - amount_paid)
          FILTER (WHERE total_amount > amount_paid), 0)            AS outstanding
      FROM transport_payments WHERE company_id = 1`;

    const [costs_agg] = await sql`
      SELECT COALESCE(SUM(c.amount),0) AS total_costs
      FROM transport_costs c
      JOIN transport_jobs j ON j.id = c.job_id
      WHERE j.company_id = 1`;

    const [expenses_agg] = await sql`
      SELECT COALESCE(SUM(amount),0) AS total_expenses
      FROM expenses WHERE company_id = 1`;

    const [supplier_agg] = await sql`
      SELECT
        COALESCE(SUM(total_owed),0)                                AS total_owed,
        COALESCE(SUM(total_owed - amount_paid)
          FILTER (WHERE total_owed > amount_paid), 0)              AS arrears
      FROM supplier_payments WHERE company_id = 1`;

    // ── Loans ─────────────────────────────────────────────────
    const [loans] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Active')  AS active_loans,
        COUNT(*) FILTER (WHERE status = 'Cleared') AS cleared_loans,
        COALESCE(SUM(amount) FILTER (WHERE status = 'Active'), 0) AS principal_outstanding,
        COALESCE(SUM(amount), 0) AS total_lent
      FROM loans WHERE company_id = 1`;

    const [loan_revenue] = await sql`
      SELECT COALESCE(SUM(r.amount_paid),0) AS total_collected
      FROM loan_repayments r WHERE r.company_id = 1`;

    // Loans due today = loans where date_issued + payment_period ≈ today
    // We track this simply: active loans where (date_issued + interval) <= today
    const due_today = await sql`
      SELECT l.id, l.client_name, l.amount, l.interest_rate,
        l.amount + ROUND(l.amount * l.interest_rate / 100) AS total_due,
        COALESCE((SELECT SUM(amount_paid) FROM loan_repayments WHERE loan_id = l.id),0) AS total_paid
      FROM loans l
      WHERE l.company_id = 1 AND l.status = 'Active'
        AND (l.date_issued +
             CASE
               WHEN l.payment_period LIKE '%30%' THEN INTERVAL '30 days'
               WHEN l.payment_period LIKE '%60%' THEN INTERVAL '60 days'
               WHEN l.payment_period LIKE '%90%' THEN INTERVAL '90 days'
               ELSE INTERVAL '30 days'
             END) <= NOW()`;

    // ── Recent overdue transport jobs ──────────────────────────
    const overdue_jobs = await sql`
      SELECT id, client_name, container_no, eta, status
      FROM transport_jobs
      WHERE company_id = 1 AND status != 'Delivered'
        AND eta < ${today}
      ORDER BY eta`;

    return ok({
      transport: {
        total_jobs:       Number(transport.total_jobs),
        active:           Number(transport.active),
        delivered:        Number(transport.delivered),
        gross_revenue:    Number(transport.gross_revenue),
        month_revenue:    Number(transport.month_revenue),
        total_collected:  Number(payments.total_collected),
        outstanding:      Number(payments.outstanding),
        total_costs:      Number(costs_agg.total_costs),
        total_expenses:   Number(expenses_agg.total_expenses),
        supplier_owed:    Number(supplier_agg.total_owed),
        supplier_arrears: Number(supplier_agg.arrears),
        net_profit:       Number(transport.gross_revenue)
                          - Number(costs_agg.total_costs)
                          - Number(expenses_agg.total_expenses),
      },
      lending: {
        active_loans:          Number(loans.active_loans),
        cleared_loans:         Number(loans.cleared_loans),
        total_lent:            Number(loans.total_lent),
        principal_outstanding: Number(loans.principal_outstanding),
        interest_collected:    Number(loan_revenue.total_collected),
        due_today_count:       due_today.length,
        due_today,
      },
      overdue_jobs,
    });
  } catch (e) {
    console.error('dashboard-summary error:', e);
    return err('Server error: ' + e.message, 500);
  }
};
