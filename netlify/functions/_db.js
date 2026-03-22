// netlify/functions/_db.js
const { neon } = require('@neondatabase/serverless');

function getDb() {
  const url = process.env.DATABASE_URL 
    || process.env.NETLIFY_DATABASE_URL
    || process.env.NETLIFY_DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('No database URL configured');
  return neon(url);
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
