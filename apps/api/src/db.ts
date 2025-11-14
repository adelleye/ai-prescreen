import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from 'pg';

import { env } from './env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const max = Number(process.env.PG_POOL_MAX ?? '5');
    pool = new Pool({ connectionString: env.DATABASE_URL, max, idleTimeoutMillis: 30_000 });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> {
  const p = getPool();
  return params !== undefined ? p.query<T>(text, [...params]) : p.query<T>(text);
}

/**
 * Executes a function within a database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @param fn - Function that receives a PoolClient and returns a Promise
 * @returns Promise resolving to the return value of fn
 * @throws Error if transaction fails (rollback is automatic)
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
