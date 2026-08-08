/** Admin login / API access IP allowlist (~/.ssh/be/.env ADMIN_IP). Comma-separated; unset = no restriction. */

function normalizeIp(raw) {
  let ip = String(raw ?? '').trim().toLowerCase();
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice('::ffff:'.length);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}

/** @returns {string[]} */
export function getAdminIpAllowlist() {
  const raw = String(process.env.ADMIN_IP ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => normalizeIp(part))
    .filter(Boolean);
}

export function isAdminIpRestrictionEnabled() {
  return getAdminIpAllowlist().length > 0;
}

/** Client IP from Express req (trust proxy + X-Forwarded-For first hop). */
export function getRequestClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }
  return normalizeIp(req?.ip) || 'unknown';
}

export function isAdminIpAllowed(req) {
  const allowlist = getAdminIpAllowlist();
  if (!allowlist.length) return true;
  const clientIp = getRequestClientIp(req);
  return allowlist.includes(clientIp);
}
