/**
 * Shared IP skip list for demo / signup logs: Postgres login_log, ~/.ssh/be/demolog.log,
 * ~/.ssh/be/registerlog.log, and Admin Tools → Login Log (reads login_log).
 */

/** Never write demo / signup logs for these client IPs (local / home). */
export const IP_LOG_SKIP_IPS = new Set(['127.0.0.1', '72.83.247.73']);

/** Plain client address: strips `::ffff:` IPv4 mapping and any `/prefix`. */
export function normalizeLogIp(raw) {
  let ip = String(raw ?? '').trim();
  if (!ip || ip === 'unknown') return null;
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  const slash = ip.indexOf('/');
  if (slash > 0) ip = ip.slice(0, slash);
  return ip || null;
}

/** True when this IP must not be recorded in demo / signup logs at all. */
export function shouldSkipIpLog(rawIp) {
  const ip = normalizeLogIp(rawIp);
  if (!ip) return false;
  return IP_LOG_SKIP_IPS.has(ip);
}
