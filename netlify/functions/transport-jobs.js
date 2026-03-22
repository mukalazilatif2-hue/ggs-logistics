// netlify/functions/transport-jobs.js
// GET    /transport-jobs            → list all jobs
// GET    /transport-jobs?id=N       → single job with costs
// POST   /transport-jobs            → create job + costs
// PUT    /transport-jobs?id=N       → update job + replace costs
// DELETE /transport-jobs?id=N       → delete job (costs cascade)

const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id  = event.queryStringParameters?.id
    ? parseInt(event.queryStringParameters.id) : null;

  try {
    // ── GET ────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      if (id) {
        const [job] = await sql`
          SELECT * FROM transport_jobs WHERE id = ${id} AND company_id = 1`;
        if (!job) return err('Job not found', 404);
        const costs = await sql`
          SELECT * FROM transport_costs WHERE job_id = ${id}
          ORDER BY cost_date, id`;
        return ok({ ...job, costs });
      }
      const jobs = await sql`
        SELECT j.*,
          COALESCE((SELECT SUM(amount) FROM transport_costs WHERE job_id = j.id), 0) AS total_costs
        FROM transport_jobs j
        WHERE j.company_id = 1
        ORDER BY j.created_at DESC`;
      return ok(jobs);
    }

    // ── POST ───────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.client_name) return err('client_name is required');

      const [job] = await sql`
        INSERT INTO transport_jobs
          (company_id, date_received, client_name, bl_number, container_no,
           container_size, weight_kg, shipping_line, items_desc, eta,
           status, invoice_no, invoice_date, invoice_amount, pay_status, notes)
        VALUES
          (1, ${b.date_received||null}, ${b.client_name}, ${b.bl_number||null},
           ${b.container_no||null}, ${b.container_size||null},
           ${b.weight_kg||null}, ${b.shipping_line||null},
           ${b.items_desc||null}, ${b.eta||null},
           ${b.status||'Pending'}, ${b.invoice_no||null},
           ${b.invoice_date||null}, ${b.invoice_amount||0},
           ${b.pay_status||'Unpaid'}, ${b.notes||null})
        RETURNING *`;

      const costs = await _saveCosts(sql, job.id, b.costs || []);
      return ok({ ...job, costs }, 201);
    }

    // ── PUT ────────────────────────────────────────────────────
    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');

      const [job] = await sql`
        UPDATE transport_jobs SET
          date_received  = ${b.date_received||null},
          client_name    = ${b.client_name},
          bl_number      = ${b.bl_number||null},
          container_no   = ${b.container_no||null},
          container_size = ${b.container_size||null},
          weight_kg      = ${b.weight_kg||null},
          shipping_line  = ${b.shipping_line||null},
          items_desc     = ${b.items_desc||null},
          eta            = ${b.eta||null},
          status         = ${b.status||'Pending'},
          invoice_no     = ${b.invoice_no||null},
          invoice_date   = ${b.invoice_date||null},
          invoice_amount = ${b.invoice_amount||0},
          pay_status     = ${b.pay_status||'Unpaid'},
          notes          = ${b.notes||null},
          updated_at     = NOW()
        WHERE id = ${id} AND company_id = 1
        RETURNING *`;

      if (!job) return err('Job not found', 404);

      // Replace costs
      await sql`DELETE FROM transport_costs WHERE job_id = ${id}`;
      const costs = await _saveCosts(sql, id, b.costs || []);
      return ok({ ...job, costs });
    }

    // ── DELETE ─────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM transport_jobs WHERE id = ${id} AND company_id = 1`;
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    console.error('transport-jobs error:', e);
    return err('Server error: ' + e.message, 500);
  }
};

async function _saveCosts(sql, jobId, costs) {
  const saved = [];
  for (const c of costs) {
    if (!c.description && !c.amount) continue;
    const [row] = await sql`
      INSERT INTO transport_costs (company_id, job_id, description, amount, cost_date, category)
      VALUES (1, ${jobId}, ${c.description||''}, ${c.amount||0}, ${c.cost_date||null}, ${c.category||'General'})
      RETURNING *`;
    saved.push(row);
  }
  return saved;
}
