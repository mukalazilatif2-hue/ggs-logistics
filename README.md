# GGS Logistics — Unified ERP Platform
## Deployment Guide

---

## Project Structure

```
ggs-logistics/
├── public/
│   └── index.html              ← Full frontend (HTML + CSS + JS)
├── netlify/
│   └── functions/
│       ├── _db.js              ← Shared DB helper (internal)
│       ├── transport-jobs.js   ← Container jobs CRUD
│       ├── transport-payments.js
│       ├── supplier-payments.js
│       ├── expenses.js
│       ├── loans.js
│       ├── loan-repayments.js
│       └── dashboard-summary.js
├── schema.sql                  ← Run once in Neon SQL Editor
├── package.json
├── netlify.toml
└── README.md
```

---

## Step 1 — Set Up Neon Database

1. Go to **https://neon.tech** and sign up (free tier is sufficient)
2. Create a new project — name it `ggs-logistics`
3. Open the **SQL Editor** tab
4. Paste the entire contents of `schema.sql` and click **Run**
5. You should see all tables created successfully
6. Copy your **Connection string** from the dashboard — it looks like:
   ```
   postgresql://username:password@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## Step 2 — Deploy to Netlify

### Option A — GitHub (recommended)
1. Push this folder to a GitHub repository
2. Go to **https://app.netlify.com** → **Add new site** → **Import from Git**
3. Select your repository
4. Build settings are auto-detected from `netlify.toml` (no changes needed)
5. Click **Deploy site**

### Option B — Drag and Drop
1. Zip the entire `ggs-logistics` folder
2. Go to **https://app.netlify.com** → **Add new site** → **Deploy manually**
3. Drag the zip file onto the upload area

---

## Step 3 — Set Environment Variables

In Netlify → **Site configuration** → **Environment variables** → **Add a variable**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string from Step 1 |

Click **Save** and then **Trigger deploy** → **Deploy site**.

---

## Step 4 — Verify Deployment

1. Open your Netlify site URL (e.g. `https://ggs-logistics.netlify.app`)
2. The dashboard should load with empty state (no demo data)
3. Try adding a container job — it should save and persist across devices
4. Check Netlify → **Functions** tab to see function invocation logs

---

## API Endpoints (all relative to your Netlify URL)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/.netlify/functions/transport-jobs` | List / create jobs |
| GET/PUT/DELETE | `/.netlify/functions/transport-jobs?id=N` | Single job CRUD |
| GET/POST | `/.netlify/functions/transport-payments` | Client payments |
| PUT/DELETE | `/.netlify/functions/transport-payments?id=N` | Edit/delete payment |
| GET/POST | `/.netlify/functions/supplier-payments` | Supplier payments |
| PUT/DELETE | `/.netlify/functions/supplier-payments?id=N` | Edit/delete |
| GET/POST | `/.netlify/functions/expenses` | Company expenses |
| PUT/DELETE | `/.netlify/functions/expenses?id=N` | Edit/delete |
| GET/POST | `/.netlify/functions/loans` | Loans |
| PUT/DELETE | `/.netlify/functions/loans?id=N` | Edit/delete |
| GET/POST | `/.netlify/functions/loan-repayments` | Repayments |
| DELETE | `/.netlify/functions/loan-repayments?id=N` | Delete repayment |
| GET | `/.netlify/functions/dashboard-summary` | All dashboard KPIs |

---

## Adding Authentication Later

The codebase is structured for easy auth addition:

1. All database tables have a `company_id` column (default: 1)
2. Add a Netlify Identity check to `_db.js` — one function, applied everywhere
3. Replace `company_id = 1` with the authenticated company's ID
4. This turns the product into a multi-tenant SaaS

---

## Adding PDF/Excel Export

The Generate Report buttons are scaffolded. To wire them up:

**Excel export** — add `xlsx` to `package.json` dependencies, then in a new function:
```js
const XLSX = require('xlsx');
// query DB, build workbook, return as base64
```

**PDF export** — use `pdfkit` or `puppeteer` (requires Netlify Pro for larger functions).

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Neon PostgreSQL connection string |
| `APP_PASSWORD` | Optional | Add later for password gate |

---

## Troubleshooting

**Functions returning 500:** Check `DATABASE_URL` is set correctly in Netlify env vars.

**Tables don't exist:** Re-run `schema.sql` in Neon SQL Editor.

**Data not persisting:** Confirm you're not on a free Neon plan that has been paused — wake the database from the Neon dashboard.

**CORS errors locally:** Run `netlify dev` (Netlify CLI) instead of opening `index.html` directly.
