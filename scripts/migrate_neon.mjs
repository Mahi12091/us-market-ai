import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@neondatabase/serverless';

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error('NEON_DATABASE_URL is not configured.');

const client = new Client(url);
await client.connect();

try {
  await client.query(`create table if not exists public._schema_migrations (version text primary key, applied_at timestamptz not null default now())`);
  const dir = path.resolve('supabase/migrations');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const version = file;
    const existing = await client.query('select 1 from public._schema_migrations where version = $1', [version]);
    if (existing.rows.length) {
      console.log(`[neon] ${file} already applied`);
      continue;
    }

    let migrationSql = await fs.readFile(path.join(dir, file), 'utf8');
    // Neon is the application database; Supabase-specific RLS roles/policies are removed.
    migrationSql = migrationSql
      .replace(/alter table [^;]+ enable row level security;\s*/gi, '')
      .replace(/create policy[\s\S]*?;\s*/gi, '');

    console.log(`[neon] applying ${file}`);
    await client.query(migrationSql);
    await client.query('insert into public._schema_migrations(version) values ($1)', [version]);
  }

  console.log('[neon] schema migration complete');
} finally {
  await client.end();
}

// Neon migration runner is intentionally idempotent via _schema_migrations.
