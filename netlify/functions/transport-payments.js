// netlify/functions/transport-payments.js
const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id  = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`
        SELECT p.*,
          j.container_no, j.status AS job_status
        FROM transport_payments p
        LEFT JOIN transport_jobs j ON j.id = p.job_id
        WHERE p.company_id = 1
        ORDER BY p.created_at DESC`;
      return ok(rows);
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.client_name) return err('client_name required');
      const [row] = await sql`
        INSERT INTO transport_payments
          (company_id, job_id, client_name, invoice_no, total_amount, amount_paid, payment_date, method, notes)
        VALUES
          (1, ${b.job_id||null}, ${b.client_name}, ${b.invoice_no||null},
           ${b.total_amount||0}, ${b.amount_paid||0},
           ${b.payment_date||null}, ${b.method||'Bank Transfer'}, ${b.notes||null})
        RETURNING *`;
      // Sync pay_status on linked job
      if (b.job_id) await _syncJobPayStatus(sql, b.job_id);
      return ok(row, 201);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [row] = await sql`
        UPDATE transport_payments SET
          client_name  = ${b.client_name},
          invoice_no   = ${b.invoice_no||null},
          total_amount = ${b.total_amount||0},
          amount_paid  = ${b.amount_paid||0},
          payment_date = ${b.payment_date||null},
          method       = ${b.method||'Bank Transfer'},
          notes        = ${b.notes||null},
          updated_at   = NOW()
        WHERE id = ${id} AND company_id = 1
        RETURNING *`;
      if (!row) return err('Not found', 404);
      if (row.job_id) await _syncJobPayStatus(sql, row.job_id);
      return ok(row);
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      const [row] = await sql`
        DELETE FROM transport_payments WHERE id = ${id} AND company_id = 1 RETURNING job_id`;
      if (row?.job_id) await _syncJobPayStatus(sql, row.job_id);
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    console.error('transport-payments error:', e);
    return err('Server error: ' + e.message, 500);
  }
};

async function _syncJobPayStatus(sql, jobId) {
  const [job] = await sql`SELECT invoice_amount FROM transport_jobs WHERE id = ${jobId}`;
  if (!job) return;
  const [{ total_paid }] = await sql`
    SELECT COALESCE(SUM(amount_paid),0) AS total_paid
    FROM transport_payments WHERE job_id = ${jobId}`;
  const pct = job.invoice_amount > 0 ? (total_paid / job.invoice_amount) : 0;
  const status = pct <= 0 ? 'Unpaid' : pct >= 1 ? 'Paid' : 'Partial';
  await sql`UPDATE transport_jobs SET pay_status = ${status}, updated_at = NOW() WHERE id = ${jobId}`;
}
