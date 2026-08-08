/** Age since videos.created_at — e.g. "3 Days 1 hr", "0 Days 1 hr". */
export function formatVideoFileAge(createdAt) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '—';

  const diffMs = Math.max(0, Date.now() - created.getTime());
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return `${days} Days ${hours} hr`;
}

function videoCreatedAtMs(createdAt) {
  const ms = new Date(createdAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Newest video timestamp on a lookup row (for Age sort). */
export function rowNewestVideoCreatedAtMs(row) {
  const videos = Array.isArray(row?.videos) ? row.videos : [];
  let newest = null;
  for (const video of videos) {
    const ms = videoCreatedAtMs(video?.createdAt);
    if (ms != null && (newest == null || ms > newest)) newest = ms;
  }
  return newest;
}

/** @param {'asc' | 'desc'} direction — asc: youngest video first; desc: oldest first */
export function compareSinglesRowsByVideoAge(a, b, direction) {
  const aMs = rowNewestVideoCreatedAtMs(a);
  const bMs = rowNewestVideoCreatedAtMs(b);
  if (aMs == null && bMs == null) return 0;
  if (aMs == null) return 1;
  if (bMs == null) return -1;
  if (direction === 'asc') return bMs - aMs;
  return aMs - bMs;
}

export function sortSinglesRowsByVideoAge(rows, direction) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  return [...rows].sort((a, b) => compareSinglesRowsByVideoAge(a, b, direction));
}
