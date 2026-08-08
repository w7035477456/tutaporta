import {
  getBlockedAsnGithubUrl,
  getRefreshAsnVpnAtHour,
  formatRefreshAsnVpnAtLabel,
  parseBlockedAsnListText
} from './blockedAsnConfig.js';
import {
  getBlockedAsnVpnCount,
  initBlockedAsnVpnCache,
  loadBlockedAsnVpnCache,
  readBlockedAsnVpnFromDb,
  setBlockedAsnVpnList
} from './globalBlockedAsnVpn.js';
import { isCloudflareAsnSyncEnabled, syncCloudflareAsnFirewallRule, logCloudflareAsnSyncStartupStatus } from './cloudflareAsnRuleSync.js';

let refreshTimer = null;
let refreshInFlight = null;

function msUntilNextScheduledRefresh() {
  const targetHour = getRefreshAsnVpnAtHour();
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export async function refreshBlockedAsnListFromGithub() {
  try {
    const preview = await fetchGithubAsnListPreview();
    const saved = await setBlockedAsnVpnList(preview.asns);
    console.log(
      `[blocked-asn] GitHub → global.blocked_asn_vpn updated (${saved.length} ASNs) from ${preview.url} at ${new Date().toISOString()}`
    );

    let cloudflare = { ok: false, skipped: true };
    if (isCloudflareAsnSyncEnabled()) {
      try {
        cloudflare = await syncCloudflareAsnFirewallRule(saved);
      } catch (cfErr) {
        console.warn('[cloudflare-asn] sync failed:', cfErr?.message ?? cfErr);
        cloudflare = { ok: false, error: cfErr?.message ?? String(cfErr) };
      }
    }

    return { ok: true, count: saved.length, url: preview.url, cloudflare };
  } catch (err) {
    const url = getBlockedAsnGithubUrl();
    console.warn(
      `[blocked-asn] GitHub refresh failed (${url}): ${err?.message ?? err}; keeping DB list (${getBlockedAsnVpnCount()} ASNs in cache)`
    );
    await loadBlockedAsnVpnCache({ bypassCache: true });
    return { ok: false, error: err?.message ?? String(err), url };
  }
}

export async function fetchGithubAsnListPreview() {
  const url = getBlockedAsnGithubUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain', 'User-Agent': 'vsingles-blocked-asn-refresh/1.0' }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    const parsed = parseBlockedAsnListText(text);
    if (parsed.size === 0) {
      throw new Error('parsed list is empty');
    }
    const asns = [...parsed].sort((a, b) => a - b);
    return { ok: true, url, asns, count: asns.length };
  } finally {
    clearTimeout(timeout);
  }
}

/** GitHub → Postgres only (no Cloudflare). */
export async function syncPostgresFromGithubOnly() {
  const preview = await fetchGithubAsnListPreview();
  const saved = await setBlockedAsnVpnList(preview.asns);
  console.log(
    `[blocked-asn] GitHub → Postgres sync (${saved.length} ASNs) from ${preview.url} at ${new Date().toISOString()}`
  );
  return { ok: true, url: preview.url, asns: saved, count: saved.length };
}

function scheduleNextDailyRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delayMs = msUntilNextScheduledRefresh();
  refreshTimer = setTimeout(() => {
    void (async () => {
      await refreshBlockedAsnListFromGithub();
      scheduleNextDailyRefresh();
    })();
  }, delayMs);
  refreshTimer.unref?.();
  const nextAt = new Date(Date.now() + delayMs).toISOString();
  console.log(
    `[startup] blocked-asn GitHub refresh scheduled daily at REFRESH_ASN_VPN_AT=${formatRefreshAsnVpnAtLabel()} local (next run ~${nextAt}) from ${getBlockedAsnGithubUrl()}`
  );
}

export async function startBlockedAsnDailyRefresh() {
  await initBlockedAsnVpnCache();
  const dbList = await readBlockedAsnVpnFromDb();
  if (dbList.length === 0) {
    console.log('[blocked-asn] global.blocked_asn_vpn empty — seeding from GitHub');
    await refreshBlockedAsnListFromGithub();
  }

  scheduleNextDailyRefresh();
  logCloudflareAsnSyncStartupStatus();
}

export function runBlockedAsnGithubRefreshNow() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshBlockedAsnListFromGithub().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
