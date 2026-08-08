import pool from '../db/connection.js';
import { DEFAULT_REFER_BY_CODE } from './referByCode.js';
import { buildTotalsHistoryDisplay, STATISTICS_HISTORY_METRICS } from './statisticsStorageEstimate.js';

const SEARCH_EVENT_TYPES = new Set(['identification_search', 'work_email_domain_search', 'academic_record_search']);
let tablesReadyPromise = null;

const SNAPSHOT_WINDOWS = [
  { key: 'm12', label: '12 M ago', intervalSql: "INTERVAL '12 months'" },
  { key: 'm6', label: '6 M ago', intervalSql: "INTERVAL '6 months'" },
  { key: 'm2', label: '2 M ago', intervalSql: "INTERVAL '2 months'" },
  { key: 'm1', label: '1 M ago', intervalSql: "INTERVAL '1 month'" },
  { key: 'w1', label: '1 w ago', intervalSql: "INTERVAL '1 week'" },
  { key: 'now', label: 'Now', intervalSql: null }
];

/** Run once per process at startup (search events + statistics share the same promise). */
export async function initUserActivityStatsSchema() {
  return ensureTablesReady();
}

async function ensureTablesReady() {
  if (tablesReadyPromise) return tablesReadyPromise;
  tablesReadyPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_search_events (
        event_id BIGSERIAL PRIMARY KEY,
        singles_id BIGINT NOT NULL REFERENCES helloworldjunktest.singles(singles_id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        meta JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_search_events_type_time
      ON helloworldjunktest.user_search_events (event_type, created_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_search_events_user_type
      ON helloworldjunktest.user_search_events (singles_id, event_type, created_at DESC)
    `);
  })().catch((err) => {
    tablesReadyPromise = null;
    throw err;
  });
  return tablesReadyPromise;
}

export async function trackUserSearchEvent(singlesId, eventType, meta = {}) {
  const userId = Number(singlesId);
  if (!Number.isFinite(userId) || userId < 1) return;
  const type = String(eventType || '').trim().toLowerCase();
  if (!SEARCH_EVENT_TYPES.has(type)) return;
  await ensureTablesReady();
  await pool.query(
    `INSERT INTO helloworldjunktest.user_search_events (singles_id, event_type, meta)
     VALUES ($1, $2, $3::jsonb)`,
    [userId, type, JSON.stringify(meta && typeof meta === 'object' ? meta : {})]
  );
}

export async function getSystemStatisticsSnapshot() {
  await ensureTablesReady();

  const postingsSchemaResult = await pool.query(`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'helloworldjunktest'
          AND table_name = 'postings'
      ) THEN 'helloworldjunktest'
      ELSE 'public'
    END AS schema_name
  `);
  const postingsSchema = String(postingsSchemaResult.rows[0]?.schema_name || 'public') === 'helloworldjunktest'
    ? 'helloworldjunktest'
    : 'public';

  const snapshots = {};
  for (const windowDef of SNAPSHOT_WINDOWS) {
    const cutoffExpr = windowDef.intervalSql ? `NOW() - ${windowDef.intervalSql}` : 'NOW()';
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM helloworldjunktest.singles WHERE created_at <= ${cutoffExpr}) AS users_count,
        (SELECT COUNT(*)::bigint FROM helloworldjunktest.photos WHERE created_at <= ${cutoffExpr}) AS photos_count,
        (SELECT COUNT(*)::bigint FROM helloworldjunktest.chat_log WHERE created_at <= ${cutoffExpr}) AS messages_count,
        (SELECT COUNT(*)::bigint FROM ${postingsSchema}.postings WHERE created_at <= ${cutoffExpr}) AS postings_count,
        (SELECT COUNT(*)::bigint FROM helloworldjunktest.user_search_events WHERE event_type = 'identification_search' AND created_at <= ${cutoffExpr}) AS identification_search_count,
        (SELECT COUNT(*)::bigint FROM helloworldjunktest.user_search_events WHERE event_type = 'work_email_domain_search' AND created_at <= ${cutoffExpr}) AS work_email_domain_search_count,
        (SELECT COUNT(*)::bigint FROM helloworldjunktest.user_search_events WHERE event_type = 'academic_record_search' AND created_at <= ${cutoffExpr}) AS academic_record_search_count
    `);
    snapshots[windowDef.key] = result.rows[0] || {};
  }

  const topReferrersResult = await pool.query(
    `
    SELECT
      referrer.singles_id,
      COALESCE(referrer.alias, referrer.email, CONCAT('user-', referrer.singles_id::text)) AS user_label,
      COUNT(referee.singles_id)::int AS refer_count
    FROM helloworldjunktest.singles referrer
    INNER JOIN helloworldjunktest.singles referee
      ON btrim(COALESCE(referee.refer_by_code::text, '')) = btrim(COALESCE(referrer.my_refer_code::text, ''))
     AND btrim(COALESCE(referee.refer_by_code::text, '')) <> ''
     AND btrim(COALESCE(referee.refer_by_code::text, '')) <> $1
     AND referee.singles_id <> referrer.singles_id
    WHERE btrim(COALESCE(referrer.my_refer_code::text, '')) <> ''
      AND btrim(COALESCE(referrer.my_refer_code::text, '')) <> $1
    GROUP BY referrer.singles_id, user_label
    ORDER BY refer_count DESC, referrer.singles_id ASC
    LIMIT 5
    `,
    [DEFAULT_REFER_BY_CODE]
  );

  const valueByWindow = (field) =>
    SNAPSHOT_WINDOWS.reduce((acc, w) => {
      acc[w.key] = Number(snapshots[w.key]?.[field] || 0);
      return acc;
    }, {});

  const totalsHistory = Object.fromEntries(
    STATISTICS_HISTORY_METRICS.map((m) => [m.key, valueByWindow(m.dbField)])
  );

  const { display: totalsHistoryDisplay, mbEstimate: totalsHistoryMbEstimate } = buildTotalsHistoryDisplay(
    snapshots,
    SNAPSHOT_WINDOWS
  );

  return {
    totals: {
      usersCount: totalsHistory.usersCount.now,
      photosCount: totalsHistory.photosCount.now,
      messagesCount: totalsHistory.messagesCount.now,
      postingsCount: totalsHistory.postingsCount.now,
      identificationSearchCount: totalsHistory.identificationSearchCount.now,
      workEmailDomainSearchCount: totalsHistory.workEmailDomainSearchCount.now,
      academicRecordSearchCount: totalsHistory.academicRecordSearchCount.now
    },
    totalsHistory,
    totalsHistoryDisplay,
    totalsHistoryMbEstimate,
    storageEstimateNote:
      'MB is a rough estimate (fixed bytes per row). Photo files on disk may differ from DB row counts.',
    totalsWindows: SNAPSHOT_WINDOWS.map((w) => ({ key: w.key, label: w.label })),
    topReferrers: topReferrersResult.rows.map((row) => ({
      singlesId: Number(row.singles_id),
      userLabel: row.user_label,
      referCount: Number(row.refer_count || 0)
    }))
  };
}
