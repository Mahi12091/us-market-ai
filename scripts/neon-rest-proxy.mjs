import http from 'node:http';
import { neon } from '@neondatabase/serverless';

const connection = process.env.NEON_DATABASE_URL;
if (!connection) throw new Error('NEON_DATABASE_URL is not configured.');
const sql = neon(connection);
const PORT = Number(process.env.NEON_REST_PROXY_PORT || 8787);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ident = (v) => { if (!IDENT.test(v)) throw new Error(`Unsafe identifier: ${v}`); return `"${v}"`; };
const cols = (v) => v === '*' ? '*' : v.split(',').map((x) => ident(x.trim())).join(',');

function parseFilter(key, raw, values) {
  const column = ident(key);
  if (raw.startsWith('eq.')) { values.push(raw.slice(3)); return `${column} = $${values.length}`; }
  if (raw.startsWith('neq.')) { values.push(raw.slice(4)); return `${column} <> $${values.length}`; }
  if (raw.startsWith('gt.')) { values.push(raw.slice(3)); return `${column} > $${values.length}`; }
  if (raw.startsWith('gte.')) { values.push(raw.slice(4)); return `${column} >= $${values.length}`; }
  if (raw.startsWith('lt.')) { values.push(raw.slice(3)); return `${column} < $${values.length}`; }
  if (raw.startsWith('lte.')) { values.push(raw.slice(4)); return `${column} <= $${values.length}`; }
  if (raw === 'is.null') return `${column} IS NULL`;
  if (raw === 'is.true') return `${column} IS TRUE`;
  if (raw === 'is.false') return `${column} IS FALSE`;
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const items = raw.slice(4, -1).split(',').map((x) => x.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
    const placeholders = items.map((item) => { values.push(item); return `$${values.length}`; }).join(',');
    return `${column} IN (${placeholders || 'NULL'})`;
  }
  return null;
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : null;
}

async function query(req, res) {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const match = url.pathname.match(/^\/rest\/v1\/([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!match) return send(res, 404, { message: 'Not found' });
    const table = ident(match[1]);
    const method = req.method || 'GET';

    if (method === 'GET') {
      const values = [];
      const where = [];
      for (const [key, value] of url.searchParams.entries()) {
        if (['select','limit','offset','order'].includes(key)) continue;
        const condition = parseFilter(key, value, values);
        if (condition) where.push(condition);
      }
      let q = `SELECT ${cols(url.searchParams.get('select') || '*')} FROM ${table}`;
      if (where.length) q += ` WHERE ${where.join(' AND ')}`;
      const order = url.searchParams.get('order');
      if (order) {
        const orderParts = order.split(',').map((part) => {
          const [column, direction] = part.split('.');
          return `${ident(column)} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
        });
        q += ` ORDER BY ${orderParts.join(', ')}`;
      }
      if (url.searchParams.has('limit')) q += ` LIMIT ${Math.max(0, Number(url.searchParams.get('limit')))}`;
      if (url.searchParams.has('offset')) q += ` OFFSET ${Math.max(0, Number(url.searchParams.get('offset')))}`;
      return send(res, 200, await sql(q, values));
    }

    const data = await body(req);
    if (method === 'POST' || method === 'PATCH') {
      const rows = Array.isArray(data) ? data : [data || {}];
      if (method === 'PATCH') {
        const values = [];
        const where = [];
        for (const [key, value] of url.searchParams.entries()) { const c = parseFilter(key, value, values); if (c) where.push(c); }
        const row = rows[0];
        const assignments = Object.keys(row).map((key) => { values.push(row[key]); return `${ident(key)} = $${values.length}`; }).join(', ');
        const q = `UPDATE ${table} SET ${assignments}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} RETURNING *`;
        return send(res, 200, await sql(q, values));
      }
      const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const values = [];
      const tuples = rows.map((row) => `(${keys.map((key) => { values.push(row[key] ?? null); return `$${values.length}`; }).join(',')})`).join(',');
      let q = `INSERT INTO ${table} (${keys.map(ident).join(',')}) VALUES ${tuples}`;
      const conflict = url.searchParams.get('on_conflict');
      if (conflict) {
        const conflictCols = conflict.split(',').map((x) => x.trim());
        const updates = keys.filter((key) => !conflictCols.includes(key)).map((key) => `${ident(key)} = EXCLUDED.${ident(key)}`).join(', ');
        q += ` ON CONFLICT (${conflictCols.map(ident).join(',')}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
      }
      q += ' RETURNING *';
      return send(res, 201, await sql(q, values));
    }

    if (method === 'DELETE') {
      const values = [];
      const where = [];
      for (const [key, value] of url.searchParams.entries()) { const c = parseFilter(key, value, values); if (c) where.push(c); }
      const q = `DELETE FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} RETURNING *`;
      return send(res, 200, await sql(q, values));
    }
    return send(res, 405, { message: 'Method not allowed' });
  } catch (error) {
    console.error('[neon-rest]', error);
    return send(res, 500, { message: error instanceof Error ? error.message : String(error) });
  }
}

function send(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

http.createServer(query).listen(PORT, '127.0.0.1', () => console.log(`[neon-rest] listening on http://127.0.0.1:${PORT}/rest/v1`));
