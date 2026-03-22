// netlify/functions/_db.js
// Shared database + response helpers used by every function

const { neon } = require('@neondatabase/serverless');

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ok  = (data, status = 200) =>
  ({ statusCode: status, headers: CORS, body: JSON.stringify(data) });

const err = (msg, status = 400) =>
  ({ statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) });

const pre = () =>
  ({ statusCode: 204, headers: CORS, body: '' });

module.exports = { getDb, ok, err, pre };
