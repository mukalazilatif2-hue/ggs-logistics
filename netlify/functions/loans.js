// netlify/functions/loans.js
const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id  = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`
        SELECT l.*,
          COALESCE((
            SELECT SUM(amount_paid) FROM loan_repayments WHERE loan_id = l.id
          ), 0) AS total_repaid
        FROM loans l
        WHERE l.company_id = 1
        ORDER BY l.created_at DESC`;
      return ok(rows);
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.client_name || !b.amount) return err('client_name and amount required');
      const [row] = await sql`
        INSERT INTO loans
          (company_id, client_name, amount, interest_rate, payment_period,
           date_issued, container_no, notes, status)
        VALUES
          (1, ${b.client_name}, ${b.amount}, ${b.interest_rate||0},
           ${b.payment_period||null}, ${b.date_issued||null},
           ${b.container_no||null}, ${b.notes||null}, 'Active')
        RETURNING *`;
      return ok({ ...row, total_repaid: 0 }, 201);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [row] = await sql`
        UPDATE loans SET
          client_name    = ${b.client_name},
          amount         = ${b.amount},
          interest_rate  = ${b.interest_rate||0},
          payment_period = ${b.payment_period||null},
          date_issued    = ${b.date_issued||null},
          container_no   = ${b.container_no||null},
          notes          = ${b.notes||null},
          status         = ${b.status||'Active'},
          updated_at     = NOW()
        WHERE id = ${id} AND company_id = 1
        RETURNING *`;
      if (!row) return err('Not found', 404);
      const [{ total_repaid }] = await sql`
        SELECT COALESCE(SUM(amount_paid),0) AS total_repaid FROM loan_repayments WHERE loan_id = ${id}`;
      return ok({ ...row, total_repaid });
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM loans WHERE id = ${id} AND company_id = 1`;
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    console.error('loans error:', e);
    return err('Server error: ' + e.message, 500);
  }
};
