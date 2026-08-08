import {
  addBlockedAsnVpn,
  readBlockedAsnVpnFromDb,
  removeBlockedAsnVpn,
  setBlockedAsnVpnList
} from '../../utils/globalBlockedAsnVpn.js';
import { runBlockedAsnGithubRefreshNow, fetchGithubAsnListPreview, syncPostgresFromGithubOnly } from '../../utils/blockedAsnRefresh.js';
import {
  fetchCloudflareAsnRulePreview,
  isCloudflareAsnSyncEnabled,
  syncCloudflareAsnFromDbList
} from '../../utils/cloudflareAsnRuleSync.js';

function parseAsnBody(body) {
  const raw = body?.asn ?? body?.asnum ?? body?.blocked_asn;
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, error: 'asn is required' };
  }
  return { ok: true, asn: raw };
}

/** GET /api/admin/blocked-asn-vpn */
export async function getAdminBlockedAsnVpn(_req, res) {
  try {
    const asns = await readBlockedAsnVpnFromDb();
    return res.status(200).json({ asns, count: asns.length });
  } catch (err) {
    console.error('[adminBlockedAsnVpn] GET failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load blocked_asn_vpn' });
  }
}

/** PUT /api/admin/blocked-asn-vpn — replace entire list. Body: { asns: [9009, "AS20448", ...] } */
export async function putAdminBlockedAsnVpn(req, res) {
  try {
    const raw = req.body?.asns ?? req.body?.blocked_asn_vpn;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: 'asns must be an array' });
    }
    const asns = await setBlockedAsnVpnList(raw);
    let cloudflare = { ok: false, skipped: true };
    if (isCloudflareAsnSyncEnabled()) {
      try {
        cloudflare = await syncCloudflareAsnFromDbList(asns);
      } catch (cfErr) {
        console.warn('[adminBlockedAsnVpn] Cloudflare sync after PUT failed:', cfErr?.message ?? cfErr);
        cloudflare = { ok: false, error: cfErr?.message ?? String(cfErr) };
      }
    }
    return res.status(200).json({ ok: true, asns, count: asns.length, cloudflare });
  } catch (err) {
    console.error('[adminBlockedAsnVpn] PUT failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update blocked_asn_vpn' });
  }
}

/** POST /api/admin/blocked-asn-vpn — add one ASN. Body: { asn: 9009 | "AS9009" } */
export async function postAdminBlockedAsnVpn(req, res) {
  try {
    const parsed = parseAsnBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const asns = await addBlockedAsnVpn(parsed.asn);
    return res.status(200).json({ ok: true, asns, count: asns.length });
  } catch (err) {
    const message = err?.message === 'Invalid ASN' ? err.message : 'Failed to add ASN';
    if (err?.message === 'Invalid ASN') return res.status(400).json({ error: message });
    console.error('[adminBlockedAsnVpn] POST failed:', err?.message ?? err);
    return res.status(500).json({ error: message });
  }
}

/** DELETE /api/admin/blocked-asn-vpn — remove one ASN. Body: { asn: 9009 | "AS9009" } */
export async function deleteAdminBlockedAsnVpn(req, res) {
  try {
    const parsed = parseAsnBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const asns = await removeBlockedAsnVpn(parsed.asn);
    return res.status(200).json({ ok: true, asns, count: asns.length });
  } catch (err) {
    const message = err?.message === 'Invalid ASN' ? err.message : 'Failed to remove ASN';
    if (err?.message === 'Invalid ASN') return res.status(400).json({ error: message });
    console.error('[adminBlockedAsnVpn] DELETE failed:', err?.message ?? err);
    return res.status(500).json({ error: message });
  }
}

/** GET /api/admin/blocked-asn-vpn/github — read GitHub list (no save). */
export async function getAdminBlockedAsnVpnGithub(_req, res) {
  try {
    const data = await fetchGithubAsnListPreview();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[adminBlockedAsnVpn] GET github failed:', err?.message ?? err);
    return res.status(502).json({ error: err?.message || 'Failed to fetch GitHub ASN list' });
  }
}

/** GET /api/admin/blocked-asn-vpn/cloudflare — read Cloudflare rule ASNs (no changes). */
export async function getAdminBlockedAsnVpnCloudflare(_req, res) {
  try {
    const data = await fetchCloudflareAsnRulePreview();
    if (!data.ok) {
      return res.status(503).json({ error: data.error || 'Cloudflare not configured' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('[adminBlockedAsnVpn] GET cloudflare failed:', err?.message ?? err);
    return res.status(502).json({ error: err?.message || 'Failed to fetch Cloudflare ASN list' });
  }
}

/** POST /api/admin/blocked-asn-vpn/sync-from-github — Postgres only (GitHub → global.blocked_asn_vpn). */
export async function postAdminBlockedAsnVpnSyncFromGithub(_req, res) {
  try {
    const result = await syncPostgresFromGithubOnly();
    if (!result.ok && !result.skipped) {
      return res.status(502).json({ error: result.error || 'GitHub sync failed', url: result.url });
    }
    const asns = await readBlockedAsnVpnFromDb();
    return res.status(200).json({ ok: true, ...result, asns, count: asns.length });
  } catch (err) {
    console.error('[adminBlockedAsnVpn] sync-from-github failed:', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to sync Postgres from GitHub' });
  }
}

/** POST /api/admin/blocked-asn-vpn/sync-cloudflare */
export async function postAdminBlockedAsnVpnSyncCloudflare(_req, res) {
  try {
    if (!isCloudflareAsnSyncEnabled()) {
      return res.status(503).json({
        error: 'Cloudflare ASN sync is not configured (CLOUDFLARE_ASN_SYNC, token, zone id)'
      });
    }
    const asns = await readBlockedAsnVpnFromDb();
    const cloudflare = await syncCloudflareAsnFromDbList(asns);
    if (!cloudflare.ok) {
      return res.status(502).json({ error: cloudflare.error || 'Cloudflare sync failed', cloudflare });
    }
    return res.status(200).json({ ok: true, asns, count: asns.length, cloudflare });
  } catch (err) {
    console.error('[adminBlockedAsnVpn] sync-cloudflare failed:', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to sync Cloudflare rule' });
  }
}

export async function postAdminBlockedAsnVpnRefreshFromGithub(_req, res) {
  try {
    const result = await runBlockedAsnGithubRefreshNow();
    if (!result.ok && !result.skipped) {
      return res.status(502).json({
        error: result.error || 'GitHub refresh failed',
        url: result.url
      });
    }
    const asns = await readBlockedAsnVpnFromDb();
    return res.status(200).json({ ok: true, ...result, asns, count: asns.length });
  } catch (err) {
    console.error('[adminBlockedAsnVpn] refresh-from-github failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to refresh from GitHub' });
  }
}
