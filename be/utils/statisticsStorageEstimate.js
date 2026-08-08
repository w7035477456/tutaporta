/**
 * Rough storage estimates for Tools → Statistic (count / MB).
 * Fixed bytes-per-row — no table scans or filesystem walks.
 * Tune via ~/.ssh/be/.env if needed (see read*Bytes helpers).
 */

function readPositiveIntEnv(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** @returns {Record<string, number>} map db count field → bytes per row */
export function getStatisticsBytesPerRow() {
  return {
    users_count: readPositiveIntEnv('STATS_BYTES_PER_USER', 4 * 1024),
    photos_count: readPositiveIntEnv('STATS_BYTES_PER_PHOTO', 1024 * 1024),
    messages_count: readPositiveIntEnv('STATS_BYTES_PER_MESSAGE', 78 * 1024),
    postings_count: readPositiveIntEnv('STATS_BYTES_PER_POSTING', 64 * 1024),
    identification_search_count: readPositiveIntEnv('STATS_BYTES_PER_SEARCH_EVENT', 512),
    work_email_domain_search_count: readPositiveIntEnv('STATS_BYTES_PER_SEARCH_EVENT', 512),
    academic_record_search_count: readPositiveIntEnv('STATS_BYTES_PER_SEARCH_EVENT', 512)
  };
}

export function estimateMegabytesForCount(count, dbField) {
  const n = Number(count) || 0;
  if (n <= 0) return 0;
  const perRow = getStatisticsBytesPerRow()[dbField] ?? 1024;
  return (n * perRow) / (1024 * 1024);
}

/** @returns {string} e.g. "310/24mb", "0", "2/<1mb" */
export function formatCountWithStorageEstimate(count, dbField) {
  const n = Number(count) || 0;
  if (n <= 0) return '0';
  const mb = estimateMegabytesForCount(n, dbField);
  const mbLabel = mb < 1 ? '<1mb' : `${Math.round(mb)}mb`;
  return `${n}/${mbLabel}`;
}

export const STATISTICS_HISTORY_METRICS = [
  { key: 'usersCount', dbField: 'users_count' },
  { key: 'photosCount', dbField: 'photos_count' },
  { key: 'messagesCount', dbField: 'messages_count' },
  { key: 'postingsCount', dbField: 'postings_count' },
  { key: 'identificationSearchCount', dbField: 'identification_search_count' },
  { key: 'workEmailDomainSearchCount', dbField: 'work_email_domain_search_count' },
  { key: 'academicRecordSearchCount', dbField: 'academic_record_search_count' }
];

/**
 * @param {Record<string, Record<string, unknown>>} snapshots keyed by window (m12, now, …)
 */
export function buildTotalsHistoryDisplay(snapshots, windows) {
  const display = {};
  const mbEstimate = {};

  for (const metric of STATISTICS_HISTORY_METRICS) {
    display[metric.key] = {};
    mbEstimate[metric.key] = {};
    for (const w of windows) {
      const count = Number(snapshots[w.key]?.[metric.dbField] || 0);
      const mb = estimateMegabytesForCount(count, metric.dbField);
      display[metric.key][w.key] = formatCountWithStorageEstimate(count, metric.dbField);
      mbEstimate[metric.key][w.key] = Math.round(mb * 100) / 100;
    }
  }

  return { display, mbEstimate };
}
