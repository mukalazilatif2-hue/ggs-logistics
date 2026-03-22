// netlify/functions/supplier-payments.js
const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id  = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`
        SELECT * FROM supplier_payments WHERE company_id = 1 ORDER BY created_at DESC`;
      return ok(rows);
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.supplier_name) return err('supplier_name required');
      const [row] = await sql`
        INSERT INTO supplier_payments
          (company_id, supplier_name, container_no, job_id, service, total_owed, amount_paid, payment_date, notes)
        VALUES
          (1, ${b.supplier_name}, ${b.container_no||null}, ${b.job_id||null},
           ${b.service||null}, ${b.total_owed||0}, ${b.amount_paid||0},
           ${b.payment_date||null}, ${b.notes||null})
        RETURNING *`;
      return ok(row, 201);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [row] = await sql`
        UPDATE supplier_payments SET
          supplier_name = ${b.supplier_name},
          container_no  = ${b.container_no||null},
          job_id        = ${b.job_id||null},
          service       = ${b.service||null},
          total_owed    = ${b.total_owed||0},
          amount_paid   = ${b.amount_paid||0},
          payment_date  = ${b.payment_date||null},
          notes         = ${b.notes||null},
          updated_at    = NOW()
        WHERE id = ${id} AND company_id = 1
        RETURNING *`;
      if (!row) return err('Not found', 404);
      return ok(row);
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM supplier_payments WHERE id = ${id} AND company_id = 1`;
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    console.error('supplier-payments error:', e);
    return err('Server error: ' + e.message, 500);
  }
};
