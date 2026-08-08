import pool, { getDBSchema } from '../../db/connection.js';

let paymentNotificationSchemaPromise = null;

async function ensurePaymentNotificationSchemaReady() {
  if (paymentNotificationSchemaPromise) return paymentNotificationSchemaPromise;
  paymentNotificationSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_payment_notification_dismissed (
        singles_id bigint NOT NULL,
        payment_id bigint NOT NULL,
        dismissed_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (singles_id, payment_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_payment_notification_dismissed_singles
      ON helloworldjunktest.user_payment_notification_dismissed (singles_id, dismissed_at DESC)
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_payment_notification_read_state (
        singles_id bigint PRIMARY KEY,
        baseline_at timestamptz NOT NULL DEFAULT NOW(),
        last_read_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  })().catch((err) => {
    paymentNotificationSchemaPromise = null;
    throw err;
  });
  return paymentNotificationSchemaPromise;
}

function pickColumn(existingColumns, candidates) {
  for (const candidate of candidates) {
    if (existingColumns.has(candidate)) return candidate;
  }
  return null;
}

function sqlIdent(columnName) {
  const raw = String(columnName || '').trim();
  if (!raw) return raw;
  if (/^[a-z][a-z0-9_]*$/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

async function getPaymentColumns(client) {
  const schema = getDBSchema();
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, 'payment']
  );
  return new Set((colRes.rows || []).map((r) => String(r.column_name || '').trim()).filter(Boolean));
}

/**
 * First bell fetch: new accounts use signup time so referral rewards still notify;
 * older accounts use NOW() so historical payments do not flood the bell.
 */
async function ensurePaymentNotificationBaseline(client, singlesId) {
  const existing = await client.query(
    `SELECT 1
     FROM helloworldjunktest.user_payment_notification_read_state
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  if (existing.rows.length) return;

  const accountRes = await client.query(
    `SELECT created_at
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  const createdAt = accountRes.rows[0]?.created_at ? new Date(accountRes.rows[0].created_at) : new Date();
  const ageMs = Date.now() - createdAt.getTime();
  const baselineAt = ageMs > 24 * 60 * 60 * 1000 ? new Date() : createdAt;

  await client.query(
    `INSERT INTO helloworldjunktest.user_payment_notification_read_state (singles_id, baseline_at, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (singles_id) DO NOTHING`,
    [singlesId, baselineAt]
  );
}

export async function getPaymentBalanceNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    await ensurePaymentNotificationSchemaReady();
    await ensurePaymentNotificationBaseline(client, me);

    const paymentColumns = await getPaymentColumns(client);
    const singlesIdColumn = pickColumn(paymentColumns, ['singles_id', 'singles_id_fk']);
    const paymentIdColumn = pickColumn(paymentColumns, ['payment_id']);
    const dateColumn = pickColumn(paymentColumns, ['transaction_date_time', 'last_paid_date', 'created_at']);
    const descriptionColumn = pickColumn(paymentColumns, [
      'transaction_description',
      'transaction_descripition',
      'payment_history',
      'description'
    ]);

    if (!singlesIdColumn || !paymentIdColumn) {
      return res.json({ notifications: [] });
    }

    const singlesIdSql = sqlIdent(singlesIdColumn);
    const paymentIdSql = sqlIdent(paymentIdColumn);
    const dateSql = dateColumn ? sqlIdent(dateColumn) : null;
    const descriptionSql = descriptionColumn ? sqlIdent(descriptionColumn) : null;

    const selectParts = [`p.${paymentIdSql} AS payment_id`];
    if (dateSql) selectParts.push(`p.${dateSql} AS created_at`);
    if (descriptionSql) selectParts.push(`p.${descriptionSql} AS description`);

    const dateFilterSql = dateSql
      ? `AND p.${dateSql} >= COALESCE(
           (SELECT rs.baseline_at
            FROM helloworldjunktest.user_payment_notification_read_state rs
            WHERE rs.singles_id = $1),
           TIMESTAMPTZ '1970-01-01'
         )`
      : '';

    const { rows } = await client.query(
      `SELECT ${selectParts.join(', ')}
       FROM helloworldjunktest.payment p
       WHERE p.${singlesIdSql} = $1
         ${dateFilterSql}
         AND NOT EXISTS (
           SELECT 1
           FROM helloworldjunktest.user_payment_notification_dismissed d
           WHERE d.singles_id = $1
             AND d.payment_id = p.${paymentIdSql}
         )
       ORDER BY p.${paymentIdSql} DESC
       LIMIT 20`,
      [me]
    );

    return res.json({
      notifications: (rows || []).map((row) => ({
        payment_id: Number(row.payment_id),
        description: row.description ?? '',
        created_at: row.created_at ?? null
      }))
    });
  } catch (error) {
    console.error('getPaymentBalanceNotifications error:', error);
    return res.status(500).json({ error: 'Failed to load balance notifications' });
  } finally {
    client.release();
  }
}

export async function dismissPaymentBalanceNotification(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const paymentId = Number(req.body?.paymentId);
  if (!Number.isFinite(paymentId) || paymentId < 1) {
    return res.status(400).json({ error: 'Invalid payment id' });
  }

  try {
    await ensurePaymentNotificationSchemaReady();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_payment_notification_dismissed (singles_id, payment_id, dismissed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (singles_id, payment_id)
       DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
      [me, paymentId]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('dismissPaymentBalanceNotification error:', error);
    return res.status(500).json({ error: 'Failed to dismiss balance notification' });
  }
}

export async function dismissAllPaymentBalanceNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const paymentIdsRaw = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds : [];
  const paymentIds = [...new Set(paymentIdsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))];

  try {
    await ensurePaymentNotificationSchemaReady();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_payment_notification_read_state (singles_id, baseline_at, last_read_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (singles_id)
       DO UPDATE SET
         baseline_at = EXCLUDED.baseline_at,
         last_read_at = EXCLUDED.last_read_at`,
      [me]
    );
    if (paymentIds.length) {
      await pool.query(
        `INSERT INTO helloworldjunktest.user_payment_notification_dismissed (singles_id, payment_id, dismissed_at)
         SELECT $1::bigint, x::bigint, NOW()
         FROM unnest($2::bigint[]) x
         ON CONFLICT (singles_id, payment_id)
         DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
        [me, paymentIds]
      );
    }
    return res.json({ ok: true, dismissed: paymentIds.length, marked_all_read: true });
  } catch (error) {
    console.error('dismissAllPaymentBalanceNotifications error:', error);
    return res.status(500).json({ error: 'Failed to dismiss balance notifications' });
  }
}
