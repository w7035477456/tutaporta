/**
 * Sync VPN ASN list to Cloudflare custom WAF rule via API (no browser login).
 * ~/.ssh/be/.env: CLOUDFLARE_ASN_SYNC, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID,
 * CLOUDFLARE_ASN_RULE_ID (or CLOUDFLARE_RULE_ID), CLOUDFLARE_ASN_RULESET_ID (or CLOUDFLARE_RULESET_ID),
 */

import { parseClientAsn } from './blockedAsnConfig.js';

const CF_API = 'https://api.cloudflare.com/client/v4';

export function isCloudflareAsnSyncEnabled() {
  if (String(process.env.CLOUDFLARE_ASN_SYNC ?? 'false').trim().toLowerCase() !== 'true') {
    return false;
  }
  return Boolean(getCloudflareApiToken() && getCloudflareZoneId());
}

export function getCloudflareApiToken() {
  return String(process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
}

export function getCloudflareZoneId() {
  return String(process.env.CLOUDFLARE_ZONE_ID ?? '').trim();
}

export function getCloudflareAsnRuleId() {
  return String(
    process.env.CLOUDFLARE_ASN_RULE_ID ?? process.env.CLOUDFLARE_RULE_ID ?? ''
  ).trim();
}

/** From Cloudflare dashboard → Save with API call (rulesets/{this}/rules/{rule}). */
export function getCloudflareRulesetId() {
  return String(
    process.env.CLOUDFLARE_ASN_RULESET_ID ?? process.env.CLOUDFLARE_RULESET_ID ?? ''
  ).trim();
}

/** ASNs always merged with GitHub list (hosting / extra blocks not on X4BNet list). */
export function getCloudflareAsnExtraList() {
  const raw = String(process.env.CLOUDFLARE_ASN_EXTRA ?? '').trim();
  if (!raw) return [];
  const out = new Set();
  for (const part of raw.split(/[,\s]+/)) {
    const n = parseClientAsn(part) ?? Number.parseInt(part, 10);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }
  return [...out];
}

export function isCloudflareBlockNonNorthAmericaEnabled() {
  return String(process.env.CLOUDFLARE_ASN_BLOCK_NON_NA ?? 'true').trim().toLowerCase() !== 'false';
}

/** @param {number[]} asnNumbers */
export function mergeAsnsForCloudflareRule(githubAsns) {
  const merged = new Set();
  for (const n of githubAsns) {
    if (Number.isFinite(n) && n > 0) merged.add(n);
  }
  for (const n of getCloudflareAsnExtraList()) merged.add(n);
  return [...merged].sort((a, b) => a - b);
}

/** Parse ASN list from Cloudflare expressions (`in { }` or repeated `eq`). */
export function parseAsnsFromCloudflareExpression(expression) {
  const out = new Set();
  const text = String(expression ?? '');

  const inMatch =
    text.match(/ip\.src\.asnum\s+in\s+\{([^}]*)\}/i) ||
    text.match(/ip\.geoip\.asnum\s+in\s+\{([^}]*)\}/i);
  if (inMatch) {
    for (const part of inMatch[1].trim().split(/\s+/)) {
      const n = Number.parseInt(part, 10);
      if (Number.isFinite(n) && n > 0) out.add(n);
    }
  }

  const eqRe = /ip\.(?:src|geoip)\.asnum\s+eq\s+(\d+)/gi;
  let eqMatch;
  while ((eqMatch = eqRe.exec(text)) !== null) {
    const n = Number.parseInt(eqMatch[1], 10);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }

  return [...out].sort((a, b) => a - b);
}

/** @param {number[]} asnNumbers */
export function buildCloudflareAsnBlockExpression(asnNumbers) {
  const sorted = mergeAsnsForCloudflareRule(asnNumbers);
  if (sorted.length === 0) {
    throw new Error('Cloudflare ASN list is empty after merge');
  }
  const asnClause = `(ip.src.asnum in {${sorted.join(' ')}})`;
  if (isCloudflareBlockNonNorthAmericaEnabled()) {
    return `(ip.geoip.continent ne "NA") or ${asnClause}`;
  }
  return asnClause;
}

async function cloudflareApi(path, { method = 'GET', body } = {}) {
  const token = getCloudflareApiToken();
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set');

  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body != null ? JSON.stringify(body) : undefined
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Cloudflare API non-JSON response (HTTP ${res.status})`);
  }

  if (!json?.success) {
    const msg =
      json?.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
      `Cloudflare API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.result;
}

async function getCustomFirewallEntrypoint() {
  const zoneId = getCloudflareZoneId();
  return cloudflareApi(`/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`);
}

async function loadRulesetById(zoneId, rulesetId) {
  return cloudflareApi(`/zones/${zoneId}/rulesets/${rulesetId}`);
}

/** Flatten custom-firewall rules from entrypoint and nested execute rulesets. */
async function collectCustomFirewallRules(zoneId, ruleset, rulesetId, out = [], depth = 0) {
  if (!ruleset || depth > 6) return out;
  const currentRulesetId = rulesetId || ruleset.id;
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];

  for (const rule of rules) {
    out.push({ rule, rulesetId: currentRulesetId });

    if (rule?.action === 'execute') {
      const childRulesetId =
        rule?.action_parameters?.id ||
        rule?.action_parameters?.ruleset ||
        rule?.action_parameters?.ruleset_id;
      if (childRulesetId) {
        try {
          const child = await loadRulesetById(zoneId, childRulesetId);
          await collectCustomFirewallRules(zoneId, child, child.id, out, depth + 1);
        } catch (err) {
          console.warn('[cloudflare-asn] nested ruleset load failed:', childRulesetId, err?.message ?? err);
        }
      }
    }
  }

  return out;
}

async function loadRuleFromRuleset(zoneId, rulesetId, ruleId, depth = 0) {
  if (!zoneId || !rulesetId || !ruleId || depth > 6) return null;

  let ruleset;
  try {
    ruleset = await loadRulesetById(zoneId, rulesetId);
  } catch (err) {
    throw new Error(
      `Cloudflare ruleset ${rulesetId} could not be loaded: ${err?.message ?? err}`
    );
  }

  const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  const rule = rules.find((r) => r.id === ruleId || r.ref === ruleId);
  if (rule?.id) return { rule, rulesetId };

  for (const nested of rules) {
    if (nested?.action !== 'execute') continue;
    const childRulesetId =
      nested?.action_parameters?.id ||
      nested?.action_parameters?.ruleset ||
      nested?.action_parameters?.ruleset_id;
    if (!childRulesetId) continue;
    const hit = await loadRuleFromRuleset(zoneId, childRulesetId, ruleId, depth + 1);
    if (hit) return hit;
  }

  const summary = rules
    .map((r) => `${r.id}${r.description ? ` (${r.description})` : ''}`)
    .join('; ');
  throw new Error(
    `Cloudflare rule ${ruleId} not found in ruleset ${rulesetId}. Rules in that ruleset: ${summary || 'none'}`
  );
}

async function tryGetRuleDirect(zoneId, rulesetId, ruleId) {
  if (!zoneId || !rulesetId || !ruleId) return null;
  try {
    return await loadRuleFromRuleset(zoneId, rulesetId, ruleId);
  } catch (err) {
    console.warn('[cloudflare-asn] loadRuleFromRuleset failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Resolve rule via dashboard "Save with API call" ids first, else entrypoint search.
 * @returns {Promise<{ rule: object, rulesetId: string }>}
 */
async function resolveTargetRule(zoneId) {
  const configuredRulesetId = getCloudflareRulesetId();
  const configuredRuleId = getCloudflareAsnRuleId();

  if (configuredRulesetId && configuredRuleId) {
    try {
      return await loadRuleFromRuleset(zoneId, configuredRulesetId, configuredRuleId);
    } catch (err) {
      console.warn('[cloudflare-asn] configured ruleset/rule lookup failed:', err?.message ?? err);
      throw err;
    }
  }

  if (configuredRulesetId && !configuredRuleId) {
    const ruleset = await loadRulesetById(zoneId, configuredRulesetId);
    const needle = String(process.env.CLOUDFLARE_ASN_RULE_NAME ?? 'VPN ASNUM').trim().toLowerCase();
    const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
    const byName = rules.find((r) =>
      String(r.description ?? '').toLowerCase().includes(needle)
    );
    const byExpr = rules.find((r) =>
      /ip\.(?:src|geoip)\.asnum\s+(?:in|eq)/i.test(String(r.expression ?? ''))
    );
    const rule = byName || byExpr;
    if (rule?.id) return { rule, rulesetId: configuredRulesetId };
  }

  const entrypoint = await getCustomFirewallEntrypoint();
  return findTargetRuleResolved(zoneId, entrypoint);
}

/**
 * Resolve custom WAF rule + owning ruleset id (entrypoint or nested).
 * @returns {Promise<{ rule: object, rulesetId: string }>}
 */
async function findTargetRuleResolved(zoneId, entrypoint) {
  const entrypointId = entrypoint?.id;
  const configuredRuleId = getCloudflareAsnRuleId();

  if (configuredRuleId && entrypointId) {
    const direct = await tryGetRuleDirect(zoneId, entrypointId, configuredRuleId);
    if (direct) return direct;
  }

  const all = await collectCustomFirewallRules(zoneId, entrypoint, entrypointId);

  if (configuredRuleId) {
    const byId = all.find((item) => item.rule.id === configuredRuleId);
    if (byId) return byId;
    console.warn(
      `[cloudflare-asn] rule id ${configuredRuleId} not in entrypoint tree — trying name/expression fallback`
    );
  }

  const needle = String(process.env.CLOUDFLARE_ASN_RULE_NAME ?? 'VPN ASNUM').trim().toLowerCase();
  const byName = all.find((item) =>
    String(item.rule.description ?? '').toLowerCase().includes(needle)
  );
  if (byName) return byName;

  const byExpr = all.find((item) =>
    /ip\.(?:src|geoip)\.asnum\s+(?:in|eq)/i.test(String(item.rule.expression ?? ''))
  );
  if (byExpr) return byExpr;

  const summary = all
    .map((item) => `${item.rule.id}${item.rule.description ? ` (${item.rule.description})` : ''}`)
    .join('; ');
  throw new Error(
    `No Cloudflare custom firewall rule found${configuredRuleId ? ` for id ${configuredRuleId}` : ''}. ` +
      `Seen in http_request_firewall_custom: ${summary || 'no rules'}`
  );
}

function diffAsnLists(before, after) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((n) => !beforeSet.has(n)),
    removed: before.filter((n) => !afterSet.has(n))
  };
}

/**
 * Update Cloudflare custom WAF rule ASN list (GitHub ASNs + CLOUDFLARE_ASN_EXTRA).
 * @param {number[]} githubAsns
 */
export async function syncCloudflareAsnFirewallRule(githubAsns) {
  if (!isCloudflareAsnSyncEnabled()) {
    return { ok: false, skipped: true, reason: 'CLOUDFLARE_ASN_SYNC disabled or missing token/zone' };
  }

  const zoneId = getCloudflareZoneId();
  const merged = mergeAsnsForCloudflareRule(githubAsns);
  const expression = buildCloudflareAsnBlockExpression(githubAsns);

  const { rule, rulesetId } = await resolveTargetRule(zoneId);
  if (!rulesetId) throw new Error('Cloudflare ruleset id missing for target rule');

  const beforeAsns = parseAsnsFromCloudflareExpression(rule.expression);
  const { added, removed } = diffAsnLists(beforeAsns, merged);

  if (rule.expression === expression) {
    console.log(`[cloudflare-asn] rule unchanged (${merged.length} ASNs)`);
    return {
      ok: true,
      unchanged: true,
      ruleId: rule.id,
      rulesetId,
      zoneId,
      count: merged.length,
      asns: merged
    };
  }

  await cloudflareApi(`/zones/${zoneId}/rulesets/${rulesetId}/rules/${rule.id}`, {
    method: 'PATCH',
    body: {
      expression,
      action: rule.action || 'block',
      description: rule.description,
      enabled: rule.enabled !== false
    }
  });

  console.log(
    `[cloudflare-asn] rule ${rule.id} updated (${merged.length} ASNs; +${added.length} -${removed.length})` +
      (added.length ? ` added=[${added.join(',')}]` : '') +
      (removed.length ? ` removed=[${removed.join(',')}]` : '')
  );

  return {
    ok: true,
    unchanged: false,
    ruleId: rule.id,
    rulesetId,
    zoneId,
    count: merged.length,
    asns: merged,
    added,
    removed,
    expression
  };
}

/** Read current Cloudflare custom WAF rule ASN list (no changes). */
export async function fetchCloudflareAsnRulePreview() {
  if (!isCloudflareAsnSyncEnabled()) {
    return { ok: false, error: 'Cloudflare ASN sync is not configured (CLOUDFLARE_ASN_SYNC, token, zone id)' };
  }

  const zoneId = getCloudflareZoneId();
  const { rule, rulesetId } = await resolveTargetRule(zoneId);
  const asns = parseAsnsFromCloudflareExpression(rule.expression);

  return {
    ok: true,
    ruleId: rule.id,
    rulesetId,
    zoneId,
    description: rule.description || '',
    expression: rule.expression || '',
    asns,
    count: asns.length,
    extraAsns: getCloudflareAsnExtraList(),
    blockNonNorthAmerica: isCloudflareBlockNonNorthAmericaEnabled()
  };
}

/** Manual sync using ASNs currently stored in Postgres. */
export async function syncCloudflareAsnFromDbList(dbAsns) {
  return syncCloudflareAsnFirewallRule(dbAsns);
}

export function logCloudflareAsnSyncStartupStatus() {
  if (!isCloudflareAsnSyncEnabled()) {
    console.log('[startup] CLOUDFLARE_ASN_SYNC=false or missing token/zone — Cloudflare WAF rule not auto-updated');
    return;
  }
  const ruleId = getCloudflareAsnRuleId();
  const rulesetId = getCloudflareRulesetId();
  const extraCount = getCloudflareAsnExtraList().length;
  console.log(
    `[startup] CLOUDFLARE_ASN_SYNC=true zone=${getCloudflareZoneId()} ruleset=${rulesetId || '(auto)'} rule=${ruleId || '(auto by name)'} extraAsns=${extraCount} nonNA=${isCloudflareBlockNonNorthAmericaEnabled()}`
  );
  if (extraCount === 0) {
    console.warn(
      '[startup] CLOUDFLARE_ASN_EXTRA is empty — Cloudflare sync will only use GitHub VPN ASNs (hosting ASNs like 14618 may be removed)'
    );
  }
}
