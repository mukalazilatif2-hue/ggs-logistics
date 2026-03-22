// netlify/functions/loan-repayments.js
const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id  = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`
        SELECT r.*, l.amount AS loan_principal, l.interest_rate
        FROM loan_repayments r
        JOIN loans l ON l.id = r.loan_id
        WHERE r.company_id = 1
        ORDER BY r.payment_date DESC, r.created_at DESC`;
      return ok(rows);
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.loan_id || !b.amount_paid) return err('loan_id and amount_paid required');

      const [loan] = await sql`SELECT * FROM loans WHERE id = ${b.loan_id}`;
      if (!loan) return err('Loan not found', 404);

      const [row] = await sql`
        INSERT INTO loan_repayments
          (company_id, loan_id, client_name, amount_paid, payment_date, repay_type, notes)
        VALUES
          (1, ${b.loan_id}, ${loan.client_name}, ${b.amount_paid},
           ${b.payment_date||null}, ${b.repay_type||'Both'}, ${b.notes||null})
        RETURNING *`;

      // Auto-update loan status if fully repaid
      await _syncLoanStatus(sql, b.loan_id);
      return ok(row, 201);
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      const [row] = await sql`
        DELETE FROM loan_repayments WHERE id = ${id} AND company_id = 1 RETURNING loan_id`;
      if (row?.loan_id) await _syncLoanStatus(sql, row.loan_id);
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    console.error('loan-repayments error:', e);
    return err('Server error: ' + e.message, 500);
  }
};

async function _syncLoanStatus(sql, loanId) {
  const [loan] = await sql`SELECT amount, interest_rate FROM loans WHERE id = ${loanId}`;
  if (!loan) return;
  const interest = Math.round(loan.amount * loan.interest_rate / 100);
  const totalDue = Number(loan.amount) + interest;
  const [{ total_paid }] = await sql`
    SELECT COALESCE(SUM(amount_paid),0) AS total_paid FROM loan_repayments WHERE loan_id = ${loanId}`;
  const status = Number(total_paid) >= totalDue ? 'Cleared' : 'Active';
  await sql`UPDATE loans SET status = ${status}, updated_at = NOW() WHERE id = ${loanId}`;
}
