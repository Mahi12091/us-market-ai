import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is not configured');

export const sql = neon(process.env.NEON_DATABASE_URL);

type Filter = { sql: string; values: unknown[] };
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const quoteIdent = (value: string) => {
  if (!IDENT.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
};
const columns = (select: string) => select.trim() === '*' ? '*' : select.split(',').map((part) => quoteIdent(part.trim())).join(',');

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

  constructor(table: string) { this.table = quoteIdent(table); }
  select(value = '*') { this.selectColumns = value; return this; }
  eq(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} = $VALUE`, values: [value] }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} <> $VALUE`, values: [value] }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} > $VALUE`, values: [value] }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} >= $VALUE`, values: [value] }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} < $VALUE`, values: [value] }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} <= $VALUE`, values: [value] }); return this; }
  is(column: string, value: null | boolean) {
    if (value === null) this.filters.push({ sql: `${quoteIdent(column)} IS NULL`, values: [] });
    else this.filters.push({ sql: `${quoteIdent(column)} IS ${value ? 'TRUE' : 'FALSE'}`, values: [] });
    return this;
  }
  in(column: string, values: unknown[]) { this.filters.push({ sql: `${quoteIdent(column)} IN ($VALUES)`, values }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.limitCount = value; return this; }
  range(from: number, to: number) { this.offsetCount = from; this.limitCount = Math.max(0, to - from + 1); return this; }
  single() { this.limitCount = 1; return this; }
  maybeSingle() { this.limitCount = 1; return this; }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.action = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) { this.action = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.conflictColumns = (options?.onConflict ?? '').split(',').map((v) => v.trim()).filter(Boolean); return this; }
  update(values: Record<string, unknown>) { this.action = 'update'; this.payload = [values]; return this; }
  delete() { this.action = 'delete'; return this; }

  private buildWhere(startIndex: number) {
    let index = startIndex;
    const values: unknown[] = [];
    const parts = this.filters.map((filter) => {
      if (filter.sql.includes('$VALUES')) {
        const placeholders = filter.values.map((value) => { values.push(value); return `$${++index}`; }).join(',');
        return filter.sql.replace('$VALUES', placeholders || 'NULL');
      }
      if (filter.sql.includes('$VALUE')) {
        values.push(filter.values[0]);
        return filter.sql.replace('$VALUE', `$${++index}`);
      }
      return filter.sql;
    });
    return { where: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', values, nextIndex: index };
  }

  async execute(): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const where = this.buildWhere(0);
      if (this.action === 'select') {
        let q = `SELECT ${columns(this.selectColumns)} FROM ${this.table}${where.where}`;
        if (this.orderBy) q += ` ORDER BY ${quoteIdent(this.orderBy.column)} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`;
        if (this.limitCount != null) q += ` LIMIT ${Math.max(0, this.limitCount)}`;
        if (this.offsetCount != null) q += ` OFFSET ${Math.max(0, this.offsetCount)}`;
        return { data: (await sql(q, where.values)) as T[], error: null };
      }
      if (this.action === 'delete') return { data: (await sql(`DELETE FROM ${this.table}${where.where} RETURNING *`, where.values)) as T[], error: null };
      if (this.action === 'update') {
        const row = this.payload[0] ?? {};
        const values = [...where.values];
        const assignments = Object.keys(row).map((key) => { values.push(row[key]); return `${quoteIdent(key)} = $${values.length}`; }).join(', ');
        return { data: (await sql(`UPDATE ${this.table} SET ${assignments}${where.where} RETURNING *`, values)) as T[], error: null };
      }
      if (!this.payload.length) return { data: [], error: null };
      const keys = [...new Set(this.payload.flatMap((row) => Object.keys(row)))];
      const values: unknown[] = [];
      const tuples = this.payload.map((row) => `(${keys.map((key) => { values.push(row[key] ?? null); return `$${values.length}`; }).join(',')})`).join(',');
      let q = `INSERT INTO ${this.table} (${keys.map(quoteIdent).join(',')}) VALUES ${tuples}`;
      if (this.action === 'upsert' && this.conflictColumns.length) {
        const updates = keys.filter((key) => !this.conflictColumns.includes(key)).map((key) => `${quoteIdent(key)} = EXCLUDED.${quoteIdent(key)}`).join(', ');
        q += ` ON CONFLICT (${this.conflictColumns.map(quoteIdent).join(',')}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
      }
      return { data: (await sql(`${q} RETURNING *`, values)) as T[], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  then<TResult1 = { data: T[] | null; error: Error | null }, TResult2 = never>(onfulfilled?: ((value: { data: T[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return this.execute().then(onfulfilled, onrejected); }
}

export function createDatabaseClient() {
  return { from<T = Record<string, unknown>>(table: string) { return new NeonQuery<T>(table); } };
}
