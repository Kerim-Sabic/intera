import pg from 'pg';

export interface Sql {
  query<T extends pg.QueryResultRow = Record<string, any>>(sql: string, values?: any[]): Promise<{ rows: T[] }>;
}
export interface Database extends Sql { transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> }

export function postgres(connectionString: string): Database & { close(): Promise<void> } {
  const pool = new pg.Pool({ connectionString, max: 6, connectionTimeoutMillis: 10_000 });
  return {
    query: <T extends pg.QueryResultRow>(sql:string, values?:any[]) => pool.query<T>(sql, values),
    async transaction(fn) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

// Serializes canonical reads as well as writes across server processes. No stale fetch may
// overwrite a newer fetch. Small billing workload; split by provider object if scaling later.
export async function billingLock(sql: Sql) {
  await sql.query('select id from private.billing_lock where id = 1 for update');
}
