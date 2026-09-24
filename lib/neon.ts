import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL is not configured');
}

export const sql = neon(process.env.NEON_DATABASE_URL);

type Filter = { op: string; value: unknown };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const quoteIdent = (value: string) => {
  if (!IDENT.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
};

const columns = (select: string) => {
  if (select.trim() === '*') return '*';
  return select.split(',').map((part) => {
    const name = part.trim();
    if (!IDENT.test(name)) throw new Error(`Unsupported select expression: ${name}`);
    return quoteIdent(name);
  }).join(',');
};

export class NeonQuery<T = Record<string, unknown>> implements PromiseLike<{ data: T[] | null; error: Error | null }> {
  private table: string;
  private selectColumns = '*';
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private limitCount?: number;
  private offsetCount?: number;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Record<string, unknown>[] = [];
  private conflictColumns: string[] = [];

  constructor(table: string) {
    this.table = quoteIdent(table);
  }

  select(value = '*') { this.selectColumns = value; return this; }
  eq(column: string, value: unknown) { this.filters.push({ op: `${quoteIdent(column)} =`, value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ op: `${quoteIdent(column)} <>`, value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ op: `${quoteIdent(column)} >`, value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ op: `${quoteIdent(column)} >=`, value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ op: `${quoteIdent(column)} <`, value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ op: `${quoteIdent(column)} <=`, value }); return this; }
  is(column: string, value: null | boolean) { this.filters.push({ op: value === null ? `${quoteIdent(column)} IS` : `${quoteIdent(column)} IS`, value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ op: `${quoteIdent(column)} IN`, value: values }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.limitCount = value; return this; }
  range(from: number, to: number) { this.offsetCount = from; this.limitCount = Math.max(0, to - from + 1); return this; }
  single() { this.limitCount = 1; return this; }
  maybeSingle() { this.limitCount = 1; return this; }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.action = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictColumns = (options?.onConflict ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    return this;
  }
  update(values: Record<string, unknown>) { this.action = 'update'; this.payload = [values]; return this; }
  delete() { this.action = 'delete'; return this; }

  async execute(): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const whereValues: unknown[] = [];
      const where = this.filters.map((filter) => {
        if (filter.op.endsWith(' IN')) {
          const values = Array.isArray(filter.value) ? filter.value : [];
          const placeholders = values.map((value) => { whereValues.push(value); return `$${whereValues.length}`; }).join(',');
          return `${filter.op} (${placeholders || 'NULL'})`;
        }
        if (filter.op === '"x" IS') return `${filter.op}`;
        if (filter.value === null) return `${filter.op} NULL`;
        whereValues.push(filter.value);
        return `${filter.op} $${whereValues.length}`;
      }).join(' AND ');
      const whereSql = where ? ` WHERE ${where}` : '';

      if (this.action === 'select') {
        let q = `SELECT ${columns(this.selectColumns)} FROM ${this.table}${whereSql}`;
        if (this.orderBy) q += ` ORDER BY ${quoteIdent(this.orderBy.column)} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`;
        if (this.limitCount != null) q += ` LIMIT ${Math.max(0, this.limitCount)}`;
        if (this.offsetCount != null) q += ` OFFSET ${Math.max(0, this.offsetCount)}`;
        const data = await sql.query(q, whereValues);
        return { data: data as T[], error: null };
      }

      if (this.action === 'delete') {
        const data = await sql.query(`DELETE FROM ${this.table}${whereSql} RETURNING *`, whereValues);
        return { data: data as T[], error: null };
      }

      if (this.action === 'update') {
        const row = this.payload[0] ?? {};
        const keys = Object.keys(row);
        const values = [...whereValues];
        const assignments = keys.map((key) => { values.push(row[key]); return `${quoteIdent(key)} = $${values.length}`; }).join(', ');
        const data = await sql.query(`UPDATE ${this.table} SET ${assignments}${whereSql} RETURNING *`, values);
        return { data: data as T[], error: null };
      }

      if (!this.payload.length) return { data: [], error: null };
      const keys = [...new Set(this.payload.flatMap((row) => Object.keys(row)))];
      const values: unknown[] = [];
      const tuples = this.payload.map((row) => `(${keys.map((key) => { values.push(row[key] ?? null); return `$${values.length}`; }).join(',')})`).join(',');
      const cols = keys.map(quoteIdent).join(',');
      let q = `INSERT INTO ${this.table} (${cols}) VALUES ${tuples}`;
      if (this.action === 'upsert' && this.conflictColumns.length) {
        const conflicts = this.conflictColumns.map(quoteIdent).join(',');
        const updates = keys.filter((key) => !this.conflictColumns.includes(key)).map((key) => `${quoteIdent(key)} = EXCLUDED.${quoteIdent(key)}`).join(', ');
        q += ` ON CONFLICT (${conflicts}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
      }
      q += ' RETURNING *';
      const data = await sql.query(q, values);
      return { data: data as T[], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  then<TResult1 = { data: T[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createDatabaseClient() {
  return {
    from<T = Record<string, unknown>>(table: string) {
      return new NeonQuery<T>(table);
    },
  };
}
