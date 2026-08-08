import { getDBSchema } from '../config/envConfig.js';

const SCHEMA = getDBSchema();

let poolRef = null;

export function setPgQueryErrorCountsPool(pool) {
  poolRef = pool;
}

const INCREMENT_BY_OP = {
  select: `UPDATE ${SCHEMA}.pg_query_error_counts SET select_count = select_count + 1, updated_at = NOW() WHERE id = 1`,
  insert: `UPDATE ${SCHEMA}.pg_query_error_counts SET insert_count = insert_count + 1, updated_at = NOW() WHERE id = 1`,
  update: `UPDATE ${SCHEMA}.pg_query_error_counts SET update_count = update_count + 1, updated_at = NOW() WHERE id = 1`,
  delete: `UPDATE ${SCHEMA}.pg_query_error_counts SET delete_count = delete_count + 1, updated_at = NOW() WHERE id = 1`,
  other: `UPDATE ${SCHEMA}.pg_query_error_counts SET other_count = other_count + 1, updated_at = NOW() WHERE id = 1`
};

let skipPersistence = false;

export function classifySqlOperation(sqlText) {
  const normalized = String(sqlText ?? '')
    .trim()
    .replace(/^\(\s*/u, '')
    .toUpperCase();
  if (normalized.startsWith('SELECT') || normalized.startsWith('WITH')) return 'select';
  if (normalized.startsWith('INSERT')) return 'insert';
  if (normalized.startsWith('UPDATE')) return 'update';
  if (normalized.startsWith('DELETE')) return 'delete';
  return 'other';
}

export function isPgErrorStatsSql(sqlText) {
  return /pg_query_error_counts/i.test(String(sqlText ?? ''));
}

function mapRow(row) {
  if (!row) {
    return { select: 0, insert: 0, update: 0, delete: 0, other: 0, updatedAt: null };
  }
  return {
    select: Number(row.select_count ?? 0),
    insert: Number(row.insert_count ?? 0),
    update: Number(row.update_count ?? 0),
    delete: Number(row.delete_count ?? 0),
    other: Number(row.other_count ?? 0),
    updatedAt: row.updated_at ?? null
  };
}

function getPool() {
  if (!poolRef) throw new Error('PG query error counts pool not initialized');
  return poolRef;
}

export async function getPgQueryErrorCounts() {
  const result = await getPool().query(
    `SELECT select_count, insert_count, update_count, delete_count, other_count, updated_at
     FROM ${SCHEMA}.pg_query_error_counts
     WHERE id = 1`
  );
  return mapRow(result.rows[0]);
}

/** Fire-and-forget increment when a pooled query fails (all app servers share row id=1). */
export function recordPgQueryError(sqlText) {
  if (skipPersistence) return;
  if (isPgErrorStatsSql(sqlText)) return;

  const op = classifySqlOperation(sqlText);
  const sql = INCREMENT_BY_OP[op] ?? INCREMENT_BY_OP.other;
  skipPersistence = true;
  void getPool()
    .query(sql)
    .catch(() => {
      /* avoid recursive logging / crash on stats write failure */
    })
    .finally(() => {
      skipPersistence = false;
    });
}

export async function resetPgQueryErrorCounts() {
  skipPersistence = true;
  try {
    const result = await getPool().query(
      `UPDATE ${SCHEMA}.pg_query_error_counts
       SET select_count = 0,
           insert_count = 0,
           update_count = 0,
           delete_count = 0,
           other_count = 0,
           updated_at = NOW()
       WHERE id = 1
       RETURNING select_count, insert_count, update_count, delete_count, other_count, updated_at`
    );
    if (!result.rows.length) {
      await getPool().query(`INSERT INTO ${SCHEMA}.pg_query_error_counts (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
      return getPgQueryErrorCounts();
    }
    return mapRow(result.rows[0]);
  } finally {
    skipPersistence = false;
  }
}
