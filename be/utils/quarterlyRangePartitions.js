/** UTC calendar-quarter helpers for RANGE-partitioned tables (chat_log, postings, etc.). */

export function quarterStartUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  const quarterMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), quarterMonth, 1));
}

export function addQuartersUtc(quarterStart, deltaQuarters) {
  const d = quarterStartUtc(quarterStart);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + deltaQuarters * 3, 1));
}

export function quarterNumberUtc(quarterStart) {
  const d = quarterStartUtc(quarterStart);
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

export function quarterlyPartitionName(tableBase, quarterStart) {
  const d = quarterStartUtc(quarterStart);
  const y = d.getUTCFullYear();
  const q = quarterNumberUtc(d);
  return `${tableBase}_${y}_quarter${q}`;
}

/** UTC quarter start (avoids date::timestamptz using session TimeZone in SQL). */
export function utcQuarterStartSql(quarterStart) {
  const d = quarterStartUtc(quarterStart);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `(DATE '${y}-${m}-01' + TIME '00:00:00') AT TIME ZONE 'UTC'`;
}

export function utcQuarterEndSql(quarterStart) {
  return utcQuarterStartSql(addQuartersUtc(quarterStart, 1));
}
