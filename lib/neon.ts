import { neon } from '@neondatabase/serverless';

const connection = process.env.NEON_DATABASE_URL || 'postgresql://invalid:invalid@invalid.invalid/invalid';
export const sql = neon(connection);

type Filter = { sql: string; values: unknown[] };
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdent = (value: string) => {
  if (!IDENT.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
};

const columns = (select: string) => {
  const value = select.trim();
  if (value === '*') return '*';
  return value.split(',').map((part) => {
    const trimmed = part.trim();
    if (!IDENT.test(trimmed)) throw new Error(`Unsupported select expression: ${trimmed}`);
    return quoteIdent(trimmed);
  }).join(',');
};

type ManyResult<T> = { data: T[]; error: Error | null };
type SingleResult<T> = { data: T | null; error: Error | null };

export class NeonQuery<T = Record<string, any>, Single extends boolean = false>
  implements PromiseLike<Single extends true ? SingleResult<T> : ManyResult<T>> {
  private table: string;
  private selectColumns = '*';
  private filters: Filter[] = [];
  private orderBy: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private limitCount?: number;
  private offsetCount?: number;
  private singleMode = false;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Record<string, unknown>[] = [];
  private conflictColumns: string[] = [];

  constructor(table: string) {
    this.table = quoteIdent(table);
  }

  select(value = '*') { this.selectColumns = value; return this; }
  eq(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} = $VALUE`, values: [value] }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} <> $VALUE`, values: [value] }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} > $VALUE`, values: [value] }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} >= $VALUE`, values: [value] }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} < $VALUE`, values: [value] }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ sql: `${quoteIdent(column)} <= $VALUE`, values: [value] }); return this; }
  is(column: string, value: null | boolean) {
    this.filters.push(value === null ? { sql: `${quoteIdent(column)} IS NULL`, values: [] } : { sql: `${quoteIdent(column)} IS ${value ? 'TRUE' : 'FALSE'}`, values: [] });
    return this;
  }
  in(column: string, values: unknown[]) { this.filters.push({ sql: `${quoteIdent(column)} IN ($VALUES)`, values }); return this; }
  or(expression: string) {
    const terms = expression.split(',').map((term) => term.trim()).filter(Boolean).map((term) => {
      const match = term.match(/^([A-Za-z_][A-Za-z0-9_]*)\.(eq|neq|gt|gte|lt|lte|ilike)\.(.*)$/);
      if (!match) throw new Error(`Unsupported OR filter: ${term}`);
      const [, column, op, rawValue] = match;
      const sqlOp = op === 'eq' ? '=' : op === 'neq' ? '<>' : op === 'gt' ? '>' : op === 'gte' ? '>=' : op === 'lt' ? '<' : op === 'lte' ? '<=' : 'ILIKE';
      return { sql: `${quoteIdent(column)} ${sqlOp} $VALUE`, value: rawValue };
    });
    this.filters.push({ sql: `(${terms.map((t) => t.sql).join(' OR ')})`, values: terms.map((t) => t.value) });
    return this;
  }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending !== false, nullsFirst: options?.nullsFirst });
    return this;
  }
  limit(value: number) { this.limitCount = value; return this; }
  range(from: number, to: number) { this.offsetCount = from; this.limitCount = Math.max(0, to - from + 1); return this; }
  single(): NeonQuery<T, true> { this.singleMode = true; this.limitCount = 1; return this as unknown as NeonQuery<T, true>; }
  maybeSingle(): NeonQuery<T, true> { this.singleMode = true; this.limitCount = 1; return this as unknown as NeonQuery<T, true>; }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.action = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictColumns = (options?.onConflict ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    return this;
  }
  update(values: Record<string, unknown>) { this.action = 'update'; this.payload = [values]; return this; }
  delete() { this.action = 'delete'; return this; }

  private buildWhere() {
    let index = 0;
    const values: unknown[] = [];
    const parts: string[] = [];
    for (const filter of this.filters) {
      if (filter.values.length > 1 && filter.sql.includes('$VALUE')) {
        const replacements = filter.values.map((value) => { values.push(value); return `$${++index}`; });
        parts.push(filter.sql.replace(/\$VALUE/g, () => replacements.shift() ?? 'NULL'));
        continue;
      }
      if (filter.sql.includes('$VALUES')) {
        const placeholders = filter.values.map((value) => { values.push(value); return `$${++index}`; }).join(',');
        parts.push(filter.sql.replace('$VALUES', placeholders || 'NULL'));
        continue;
      }
      if (filter.sql.includes('$VALUE')) {
        values.push(filter.values[0]);
        parts.push(filter.sql.replace('$VALUE', `$${++index}`));
        continue;
      }
      parts.push(filter.sql);
    }
    return { where: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', values };
  }

  async execute(): Promise<Single extends true ? SingleResult<T> : ManyResult<T>> {
    try {
      const where = this.buildWhere();
      if (this.action === 'select') {
        let q = `SELECT ${columns(this.selectColumns)} FROM ${this.table}${where.where}`;
        if (this.orderBy.length) q += ' ORDER BY ' + this.orderBy.map((item) => `${quoteIdent(item.column)} ${item.ascending ? 'ASC' : 'DESC'}${item.nullsFirst == null ? '' : item.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'}`).join(', ');
        if (this.limitCount != null) q += ` LIMIT ${Math.max(0, this.limitCount)}`;
        if (this.offsetCount != null) q += ` OFFSET ${Math.max(0, this.offsetCount)}`;
        const rows = (await sql(q, where.values)) as T[];
        const result = this.singleMode ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
        return result as Single extends true ? SingleResult<T> : ManyResult<T>;
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

  then<TResult1 = Single extends true ? SingleResult<T> : ManyResult<T>, TResult2 = never>(
    onfulfilled?: ((value: Single extends true ? SingleResult<T> : ManyResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createDatabaseClient() {
  return {
    from<T = Record<string, any>>(table: string) {
      return new NeonQuery<T>(table);
    },
  };
}
