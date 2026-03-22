// netlify/functions/expenses.js
const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id  = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`
        SELECT * FROM expenses WHERE company_id = 1 ORDER BY expense_date DESC, created_at DESC`;
      return ok(rows);
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.description || !b.amount) return err('description and amount required');
      const [row] = await sql`
        INSERT INTO expenses
          (company_id, expense_date, description, category, amount, method, container_no, notes)
        VALUES
          (1, ${b.expense_date||null}, ${b.description}, ${b.category||null},
           ${b.amount}, ${b.method||'Cash'}, ${b.container_no||null}, ${b.notes||null})
        RETURNING *`;
      return ok(row, 201);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [row] = await sql`
        UPDATE expenses SET
          expense_date = ${b.expense_date||null},
          description  = ${b.description},
          category     = ${b.category||null},
          amount       = ${b.amount},
          method       = ${b.method||'Cash'},
          container_no = ${b.container_no||null},
          notes        = ${b.notes||null},
          updated_at   = NOW()
        WHERE id = ${id} AND company_id = 1
        RETURNING *`;
      if (!row) return err('Not found', 404);
      return ok(row);
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM expenses WHERE id = ${id} AND company_id = 1`;
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    console.error('expenses error:', e);
    return err('Server error: ' + e.message, 500);
  }
};
