/**
 * Admin ASN list (Tools → ASN): global.blocked_asn_vpn in Postgres.
 * GitHub sync: X4BNet/lists_vpn daily at REFRESH_ASN_VPN_AT (~/.ssh/be/.env; 24 = midnight).
 * Incoming requests are not filtered by ASN — this config is for admin CRUD/sync only.
 */

export function getBlockedAsnGithubUrl() {
  const custom = String(process.env.BLOCKED_ASN_GITHUB_URL ?? '').trim();
  if (custom) return custom;
  return 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/input/vpn/ASN.txt';
}

/**
 * Daily GitHub refresh hour from REFRESH_ASN_VPN_AT (24-hour display).
 * 24 or 0 → midnight (00:00 local). 1–23 → that hour at :00.
 * Default: 24 (midnight).
 * @returns {number} 0–23
 */
export function getRefreshAsnVpnAtHour() {
  const raw = String(process.env.REFRESH_ASN_VPN_AT ?? '24').trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  if (n === 24 || n === 0) return 0;
  if (n >= 1 && n <= 23) return n;
  return 0;
}

/** Human label for logs, e.g. "24 (midnight)" or "14:00". */
export function formatRefreshAsnVpnAtLabel(hour = getRefreshAsnVpnAtHour()) {
  if (hour === 0) return '24 (midnight)';
  return `${String(hour).padStart(2, '0')}:00`;
}

/** @returns {number | null} */
export function parseClientAsn(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/^AS/i, '').trim();
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse X4BNet ASN.txt lines: `AS9009 # comment`. */
export function parseBlockedAsnListText(text) {
  const out = new Set();
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^AS(\d+)/i);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }
  return out;
}
