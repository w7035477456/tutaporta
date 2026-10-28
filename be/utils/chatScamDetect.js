/**
 * AI scam detection for 1:1 Buddies / Acquaint chat.
 *
 * After every sent message the conversation's last 50 messages (both sides) go to the local
 * Ollama model. A positive verdict citing new evidence adds a chat_scam_alert row (rows are
 * permanent and also appended to scamlog.txt). Only the victim is shown the warning; Admin Tools →
 * Scam Alert lists every row with the scammer profile and the scanned conversation.
 *
 * Cluster: the scan claim (chat_scam_scan.last_scanned_msg_id) is an atomic UPDATE on Primary, so
 * only one web server scans a given newest message even with round-robin requests.
 */
import pool from '../db/connection.js';
import { appendScamLog } from './scamLog.js';

const LOG = '[chatScam]';
const T_ALERT = 'outdateddbsnapshotoct2024.chat_scam_alert';
const T_SCAN = 'outdateddbsnapshotoct2024.chat_scam_scan';
const T_CHAT = 'outdateddbsnapshotoct2024.chat_log';
const T_SINGLES = 'outdateddbsnapshotoct2024.singles';

export const SCAM_ALERT_VICTIM_MESSAGE =
  'AI potential scam alert. Please exercise caution with this person.';

const LIVE_STATUSES = ['open', 'confirmed'];
const ADMIN_STATUSES = new Set(['open', 'confirmed', 'dismissed']);
const CATEGORIES = new Set([
  'romance',
  'money_request',
  'investment',
  'crypto',
  'job',
  'marketplace',
  'prize',
  'impersonation',
  'account_takeover',
  'loan_fee',
  'charity',
  'recovery',
  'partnership',
  'gift_card',
  'off_platform',
  'phishing',
  'sextortion',
  'identity',
  'other'
]);

export function getChatScamConfig(env = process.env) {
  const num = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    enabled: !/^(0|false|no|off)$/i.test(String(env.CHAT_SCAM_DETECT_ENABLED ?? 'true').trim()),
    ollamaBaseUrl: String(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    ollamaModel: String(env.CHAT_SCAM_OLLAMA_MODEL || env.OLLAMA_MODEL || 'qwen3:30b-a3b').trim(),
    historyMessages: Math.min(200, Math.trunc(num(env.CHAT_SCAM_HISTORY_MESSAGES, 50))),
    riskThreshold: Math.min(100, Math.trunc(num(env.CHAT_SCAM_RISK_THRESHOLD, 70))),
    llmTimeoutMs: Math.trunc(num(env.CHAT_SCAM_LLM_TIMEOUT_MS, 180000))
  };
}

const SYSTEM_PROMPT = `You are a trust and safety analyst for a friendship and dating website.
You read one private chat between two members, A and B, and judge EACH member separately:
is A trying to scam B, and is B trying to scam A? Both can be scamming at the same time, so
finding a scam by one member never clears the other.

Scam themes (category in brackets):
1. Romance [romance]: builds a relationship fast, professes love early, then needs money for an
   emergency, travel, visa, customs or medical bills; always has a reason not to video chat or meet.
2. "Pig butchering" [crypto]: slowly builds trust, shows off big profits on a crypto or trading
   platform or app and invites the other member in (the platform is fake; withdrawals fail).
3. Investment / trading "mentor" [investment]: invites the other member to invest in a company,
   fund, forex, options or crypto scheme, sells trading signals or VIP Telegram / WhatsApp groups,
   or asks them to deposit / send money for you to trade or manage, with promised or guaranteed
   returns ("30% return guaranteed", "risk free", "double your money").
4. Wrong-number opener [romance or investment]: "Hi, is this Jennifer?", "Are we still on for
   golf?" - alone this is only a mild signal (risk 30-50) unless followed by other red flags.
5. Impersonating friends or family [impersonation]: claims to be someone the member knows, stuck
   abroad, locked out, or needing a quick loan or gift cards.
6. Verification-code / account recovery [account_takeover]: "I accidentally sent my code to your
   number, can you forward it?", or asks for any login code, password or 2FA code.
7. Fake job [job]: easy remote work (liking videos, rating products, "tasks") that pays a little
   at first, then needs a deposit to unlock bigger earnings.
8. Marketplace [marketplace]: overpays and asks for a refund, wants items shipped before payment
   clears, fake "payment pending" Zelle / PayPal notices, or takes a deposit for rentals, puppies,
   tickets or goods that don't exist.
9. Fake giveaway or prize [prize]: "You won! Just pay shipping / a processing fee".
10. Celebrity or influencer impersonation [impersonation]: claims to be famous and promises gifts,
    investments or a personal relationship.
11. Sextortion [sextortion]: flirts to get intimate photos or video, then threatens to send them
    to contacts unless paid. Any threat to leak intimate images is risk 95+.
12. Phishing links [phishing]: "Is this you in this video?", "Your account will be disabled",
    copyright notices, or any link to log in or verify.
13. Fake customer support [impersonation]: poses as official support and asks for login details,
    remote access or payment.
14. Government or authority impersonation [impersonation]: fake IRS, police, immigration or tax
    agent threatening fines or arrest unless paid now.
15. Loan / debt relief [loan_fee]: "guaranteed approval, no credit check" that needs an upfront fee.
16. Charity / disaster relief [charity]: fundraisers for hurricanes, wars or viral tragedies.
17. Grant or "government money" [prize]: "You qualify for a $10,000 grant, just pay the fee".
18. Crypto / funds recovery [recovery]: offers to recover money lost to an earlier scam for a fee.
19. Fake business or brand partnership [partnership]: sponsorship or collaboration that needs
    buying products upfront, paying for promotion, or clicking a contract link.
20. Deepfake voice / video [impersonation]: claims a voice note or video of a relative, boss or
    celebrity asks for urgent money or promotes an investment.
Also: plain money / loan / gift requests with sob stories [money_request]; asking for gift cards
[gift_card]; asking for ID numbers, SSN or bank / card details [identity].

Universal red flags (raise the risk, especially in combination):
- urgency or secrecy ("don't tell anyone", "act now");
- payment by gift cards, crypto, wire transfer or Zelle;
- moving the chat to WhatsApp, Telegram or another app [off_platform];
- refusing live video or keeps postponing meeting in person;
- asking for verification codes, passwords or remote access;
- returns or rewards that seem too good to be true.

Scoring: any request or invitation for money, investment, deposits, fees, gift cards, crypto,
codes, passwords or financial / ID details that fits a theme above is a scam (risk 85 or higher)
even before bank details are given and even if the other member agrees. A single red flag with no
request (e.g. only asking to move to WhatsApp, or only a wrong-number opener) is risk 40-60.
Normal friendly chat, flirting, planning a date, or one member OFFERING to pay for a meal is not
a scam. The member who REQUESTS money, investment or sensitive data is the scammer; the member who
replies or agrees is the victim, never the scammer for that reason alone.

Reply with JSON only, no other text. One object per member:
{"A": {"is_scam": true|false,
       "risk_score": 0-100,
       "category": "romance"|"money_request"|"investment"|"crypto"|"job"|"marketplace"|"prize"|"impersonation"|"account_takeover"|"loan_fee"|"charity"|"recovery"|"partnership"|"gift_card"|"off_platform"|"phishing"|"sextortion"|"identity"|"other"|"none",
       "reason": "one short sentence about what A did",
       "evidence": [numbers of A's messages that show the scam]},
 "B": {same fields, about B}}`;

function displayText(raw) {
  const text = String(raw ?? '').trim();
  if (/^\/api\/chat\/image\/\S+$/.test(text)) return '[photo]';
  return text.replace(/\s+/g, ' ').slice(0, 1200);
}

function parseLlmJson(raw) {
  const s = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('LLM reply had no JSON object');
  return JSON.parse(s.slice(start, end + 1));
}

function normalizeFinding(obj, scammer, lines) {
  const risk = Math.round(Number(obj?.risk_score));
  const category = String(obj?.category ?? '').trim().toLowerCase();
  const evidence = (Array.isArray(obj?.evidence) ? obj.evidence : [])
    .map((n) => Math.trunc(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= lines.length && lines[n - 1].who === scammer);
  return {
    scammer,
    is_scam: obj?.is_scam === true,
    risk_score: Number.isFinite(risk) ? Math.min(100, Math.max(0, risk)) : 0,
    category: CATEGORIES.has(category) ? category : 'other',
    reason: String(obj?.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
    evidence: [...new Set(evidence)]
  };
}

/** Per-member findings plus an overall summary (is_scam / risk_score / reason) for callers and logs. */
function normalizeVerdict(obj, lines) {
  const findings = ['A', 'B'].map((side) => normalizeFinding(obj?.[side], side, lines));
  const scams = findings.filter((f) => f.is_scam);
  return {
    is_scam: scams.length > 0,
    risk_score: Math.max(0, ...findings.map((f) => (f.is_scam ? f.risk_score : 0))),
    reason: scams.map((f) => `${f.scammer}: ${f.reason}`).join(' ') || findings.map((f) => f.reason).find(Boolean) || '',
    findings
  };
}

async function ollamaChat(cfg, body) {
  const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(cfg.llmTimeoutMs)
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

/** Ask the model for a verdict on numbered chat lines. */
export async function classifyChatTranscript({ aliasA, aliasB, lines }, cfg = getChatScamConfig()) {
  const transcript = lines.map((l, i) => `[${i + 1}] ${l.who}: ${l.text}`).join('\n');
  const body = {
    model: cfg.ollamaModel,
    stream: false,
    format: 'json',
    think: false,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '10m',
    options: { temperature: 0 },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `A is "${aliasA}". B is "${aliasB}". Oldest message first.\n\n${transcript}`
      }
    ]
  };
  let reply = await ollamaChat(cfg, body);
  if (!reply.ok && reply.status === 400 && /think/i.test(reply.text)) {
    delete body.think;
    reply = await ollamaChat(cfg, body);
  }
  if (!reply.ok) throw new Error(`Ollama HTTP ${reply.status}: ${reply.text.slice(0, 200)}`);
  const content = JSON.parse(reply.text)?.message?.content;
  return normalizeVerdict(parseLlmJson(content), lines);
}

async function loadRecentMessages(convId, limit) {
  const { rows } = await pool.query(
    `SELECT l.msg_id, l.sender_id, l.receiver_id, l.user1_id, l.user2_id, l.msg_text, l.created_at,
            s.alias
       FROM ${T_CHAT} l
       LEFT JOIN ${T_SINGLES} s ON s.singles_id = l.sender_id
      WHERE l.conv_id = $1
      ORDER BY l.created_at DESC, l.msg_id DESC
      LIMIT $2`,
    [convId, limit]
  );
  return rows.reverse();
}

async function loadAliases(ids) {
  const { rows } = await pool.query(`SELECT singles_id, alias FROM ${T_SINGLES} WHERE singles_id = ANY($1::bigint[])`, [
    ids
  ]);
  return new Map(rows.map((r) => [Number(r.singles_id), String(r.alias || `#${r.singles_id}`)]));
}

/**
 * Claim the newest message of a conversation for scanning (Primary, atomic). Returns false when
 * this or another web server already scanned that message (unless `force`).
 */
async function claimScan(convId, newestMsgId, force) {
  await pool.query(`INSERT INTO ${T_SCAN} (conv_id) VALUES ($1) ON CONFLICT (conv_id) DO NOTHING`, [convId]);
  const { rowCount } = await pool.query(
    `UPDATE ${T_SCAN}
        SET last_scanned_msg_id = $2, last_scanned_at = NOW(), scan_count = scan_count + 1, updated_at = NOW()
      WHERE conv_id = $1 AND ($3::boolean OR last_scanned_msg_id < $2)`,
    [convId, newestMsgId, Boolean(force)]
  );
  return rowCount > 0;
}

async function recordScanResult(convId, verdict, error = '') {
  await pool.query(
    `UPDATE ${T_SCAN}
        SET last_is_scam = $2, last_risk_score = $3, last_verdict = $4::jsonb, last_error = $5, updated_at = NOW()
      WHERE conv_id = $1`,
    [
      convId,
      Boolean(verdict?.is_scam),
      Number(verdict?.risk_score) || 0,
      JSON.stringify(verdict || {}),
      String(error || '').slice(0, 500)
    ]
  );
}

/**
 * After an admin dismisses an alert, the same old messages must not re-open it on the next scan:
 * a new alert needs evidence sent after the latest dismissal.
 */
async function evidenceAlreadyDismissed(convId, scammerId, victimId, evidence) {
  const { rows } = await pool.query(
    `SELECT MAX(updated_at) AS dismissed_at FROM ${T_ALERT}
      WHERE conv_id = $1 AND scammer_singles_id = $2 AND victim_singles_id = $3 AND status = 'dismissed'`,
    [convId, scammerId, victimId]
  );
  const dismissedAt = rows[0]?.dismissed_at ? new Date(rows[0].dismissed_at).getTime() : 0;
  if (!dismissedAt) return false;
  return !evidence.some((e) => new Date(e.sent_at).getTime() > dismissedAt);
}

/**
 * New scam evidence (messages not already cited by an earlier alert for this pair) → new row.
 * The same evidence flagged again (e.g. a harmless reply re-triggered the scan) only bumps
 * detection_count on the latest row. Advisory lock: two web servers never race on one pair.
 */
async function recordAlert({ convId, scammerId, victimId, triggerMsgId, verdict, conversation, evidence, model }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`chat_scam_alert:${convId}`]);
    const { rows: prior } = await client.query(
      `SELECT scam_alert_id, evidence FROM ${T_ALERT}
        WHERE conv_id = $1 AND scammer_singles_id = $2 AND victim_singles_id = $3
        ORDER BY scam_alert_id DESC`,
      [convId, scammerId, victimId]
    );
    const citedMsgIds = new Set(
      prior.flatMap((r) => (Array.isArray(r.evidence) ? r.evidence : []).map((e) => Number(e?.msg_id)))
    );
    const hasNewEvidence = evidence.some((e) => !citedMsgIds.has(Number(e.msg_id)));

    if (prior.length && !hasNewEvidence) {
      const { rows } = await client.query(
        `UPDATE ${T_ALERT}
            SET detection_count = detection_count + 1,
                risk_score = GREATEST(risk_score, $2),
                updated_at = NOW()
          WHERE scam_alert_id = $1
          RETURNING scam_alert_id, detection_count`,
        [prior[0].scam_alert_id, verdict.risk_score]
      );
      await client.query('COMMIT');
      return rows[0] ? { ...rows[0], created: false } : null;
    }

    const { rows } = await client.query(
      `INSERT INTO ${T_ALERT} (
         conv_id, scammer_singles_id, victim_singles_id, trigger_msg_id, risk_score, scam_category,
         reason, evidence, conversation, llm_model
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
       RETURNING scam_alert_id, detection_count, status, created_at`,
      [
        convId,
        scammerId,
        victimId,
        triggerMsgId,
        verdict.risk_score,
        verdict.category,
        verdict.reason,
        JSON.stringify(evidence),
        JSON.stringify(conversation),
        model
      ]
    );
    await client.query('COMMIT');
    return rows[0] ? { ...rows[0], created: true } : null;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Scan one conversation now. Returns { scanned, verdict?, alert?, skipped? }.
 * `force` re-scans even when the newest message was already scanned (admin "Scan now").
 */
export async function runChatScamScan(convId, { force = false, cfg = getChatScamConfig() } = {}) {
  const id = String(convId || '').trim();
  if (!id) return { scanned: false, skipped: 'no_conversation' };
  const messages = await loadRecentMessages(id, cfg.historyMessages);
  if (!messages.length) return { scanned: false, skipped: 'empty' };

  const newest = messages[messages.length - 1];
  const newestMsgId = Number(newest.msg_id);
  if (!(await claimScan(id, newestMsgId, force))) return { scanned: false, skipped: 'already_scanned' };

  const userA = Number(newest.user1_id);
  const userB = Number(newest.user2_id);
  const aliases = await loadAliases([userA, userB]);
  const aliasA = aliases.get(userA) || `#${userA}`;
  const aliasB = aliases.get(userB) || `#${userB}`;
  const lines = messages.map((m) => ({
    who: Number(m.sender_id) === userA ? 'A' : 'B',
    text: displayText(m.msg_text)
  }));

  let verdict;
  try {
    verdict = await classifyChatTranscript({ aliasA, aliasB, lines }, cfg);
  } catch (err) {
    await recordScanResult(id, null, err?.message || String(err));
    throw err;
  }
  await recordScanResult(id, verdict);

  const flagged = verdict.findings.filter(
    (f) => f.is_scam && f.risk_score >= cfg.riskThreshold && f.evidence.length > 0
  );
  if (!flagged.length) return { scanned: true, verdict, alerts: [] };

  const conversation = messages.map((m, i) => ({
    n: i + 1,
    msg_id: Number(m.msg_id),
    sender_singles_id: Number(m.sender_id),
    sender_alias: String(m.alias || ''),
    text: displayText(m.msg_text),
    sent_at: m.created_at
  }));
  const alerts = [];
  for (const finding of flagged) {
    const scammerId = finding.scammer === 'A' ? userA : userB;
    const victimId = scammerId === userA ? userB : userA;
    const evidence = finding.evidence.map((n) => conversation[n - 1]).filter(Boolean);
    if (await evidenceAlreadyDismissed(id, scammerId, victimId, evidence)) continue;
    const alert = await recordAlert({
      convId: id,
      scammerId,
      victimId,
      triggerMsgId: newestMsgId,
      verdict: finding,
      conversation,
      evidence,
      model: cfg.ollamaModel
    });
    if (!alert) continue;
    alerts.push({ ...alert, scammer_singles_id: scammerId, victim_singles_id: victimId });
    console.warn(
      `${LOG} alert #${alert.scam_alert_id} ${alert.created ? 'NEW' : 'repeat'} conv=${id} scammer=${scammerId} victim=${victimId} risk=${finding.risk_score} (${finding.category})`
    );
    if (alert.created) {
      await appendScamLog({
        event: 'scam_alert_created',
        scam_alert_id: Number(alert.scam_alert_id),
        conv_id: id,
        created_at: alert.created_at,
        status: alert.status,
        scammer_singles_id: scammerId,
        scammer_alias: aliases.get(scammerId) || null,
        victim_singles_id: victimId,
        victim_alias: aliases.get(victimId) || null,
        trigger_msg_id: newestMsgId,
        risk_score: finding.risk_score,
        category: finding.category,
        reason: finding.reason,
        llm_model: cfg.ollamaModel,
        evidence,
        conversation
      });
    }
  }
  if (!alerts.length) return { scanned: true, verdict, alerts, skipped: 'dismissed_by_admin' };
  return { scanned: true, verdict, alerts, alert: alerts[0] };
}

// Per-process coalescing only (the DB claim is the cluster-wide guard): at most one scan per
// conversation at a time here, plus one follow-up if more messages arrived meanwhile.
const inFlight = new Map();

/** Fire-and-forget scan after a message is stored. Never throws. */
export function scheduleChatScamScan(convId) {
  const cfg = getChatScamConfig();
  const id = String(convId || '').trim();
  if (!cfg.enabled || !id) return;
  const state = inFlight.get(id);
  if (state) {
    state.again = true;
    return;
  }
  const entry = { again: false };
  inFlight.set(id, entry);
  void (async () => {
    try {
      do {
        entry.again = false;
        try {
          await runChatScamScan(id, { cfg });
        } catch (err) {
          console.error(`${LOG} scan failed conv=${id}:`, err?.message || err);
        }
      } while (entry.again);
    } finally {
      inFlight.delete(id);
    }
  })();
}

/**
 * Live alerts where `viewerId` is the victim and `partnerId` the suspected scammer (else null).
 * `evidence_msg_ids` lists every scam message cited by those alerts so the chat can show the
 * warning right under them.
 * When both members are flagged, whoever was flagged first is treated as the scammer and never
 * sees the warning; only the other member (the potential victim) does.
 */
export async function getVictimScamAlert(viewerId, partnerId) {
  const { rows } = await pool.query(
    `SELECT scam_alert_id, risk_score, scam_category, evidence, victim_first_seen_at, created_at, updated_at
       FROM ${T_ALERT}
      WHERE victim_singles_id = $1 AND scammer_singles_id = $2 AND status = ANY($3::text[])
      ORDER BY updated_at DESC`,
    [viewerId, partnerId, LIVE_STATUSES]
  );
  const row = rows[0];
  if (!row) return null;
  const { rows: viewerFlagged } = await pool.query(
    `SELECT MIN(created_at) AS first_at FROM ${T_ALERT}
      WHERE scammer_singles_id = $1 AND victim_singles_id = $2 AND status = ANY($3::text[])`,
    [viewerId, partnerId, LIVE_STATUSES]
  );
  const viewerFirstAt = viewerFlagged[0]?.first_at ? new Date(viewerFlagged[0].first_at).getTime() : 0;
  const partnerFirstAt = Math.min(...rows.map((r) => new Date(r.created_at).getTime()));
  if (viewerFirstAt && viewerFirstAt <= partnerFirstAt) return null;
  const unseen = rows.filter((r) => !r.victim_first_seen_at).map((r) => r.scam_alert_id);
  if (unseen.length) {
    await pool.query(
      `UPDATE ${T_ALERT} SET victim_first_seen_at = NOW()
        WHERE scam_alert_id = ANY($1::bigint[]) AND victim_first_seen_at IS NULL`,
      [unseen]
    );
  }
  const evidenceMsgIds = new Set();
  for (const r of rows) {
    for (const e of Array.isArray(r.evidence) ? r.evidence : []) {
      const msgId = Number(e?.msg_id);
      if (Number.isFinite(msgId) && Number(e?.sender_singles_id) === Number(partnerId)) evidenceMsgIds.add(msgId);
    }
  }
  return {
    scam_alert_id: Number(row.scam_alert_id),
    message: SCAM_ALERT_VICTIM_MESSAGE,
    risk_score: Math.max(...rows.map((r) => Number(r.risk_score) || 0)),
    category: row.scam_category,
    evidence_msg_ids: [...evidenceMsgIds].sort((a, b) => a - b),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapProfile(prefix, row) {
  return {
    singles_id: Number(row[`${prefix}_singles_id`]),
    alias: row[`${prefix}_alias`] ?? null,
    email: row[`${prefix}_email`] ?? null,
    member_id: row[`${prefix}_member_id`] ?? null,
    member_category: row[`${prefix}_member_category`] ?? null,
    prefix: row[`${prefix}_prefix`] ?? null
  };
}

/** Admin Tools → Scam Alert rows (newest first). */
export async function listScamAlerts({ status = '', limit = 200 } = {}) {
  const wanted = ADMIN_STATUSES.has(String(status)) ? String(status) : null;
  const { rows } = await pool.query(
    `SELECT a.*,
            sc.singles_id AS scammer_singles_id, sc.alias AS scammer_alias, sc.email AS scammer_email,
            sc.member_id AS scammer_member_id, sc.member_category::text AS scammer_member_category,
            sc.prefix AS scammer_prefix, sc.status::text AS scammer_status,
            (sl.singles_id IS NOT NULL) AS scammer_suspend_locked,
            v.singles_id AS victim_singles_id, v.alias AS victim_alias, v.email AS victim_email,
            v.member_id AS victim_member_id, v.member_category::text AS victim_member_category,
            v.prefix AS victim_prefix
       FROM ${T_ALERT} a
       LEFT JOIN ${T_SINGLES} sc ON sc.singles_id = a.scammer_singles_id
       LEFT JOIN outdateddbsnapshotoct2024.singles_suspend_lock sl ON sl.singles_id = a.scammer_singles_id
       LEFT JOIN ${T_SINGLES} v ON v.singles_id = a.victim_singles_id
      WHERE ($1::text IS NULL OR a.status = $1)
      ORDER BY a.created_at DESC
      LIMIT $2`,
    [wanted, Math.max(1, Math.min(1000, Math.trunc(Number(limit) || 200)))]
  );
  return rows.map((r) => ({
    scam_alert_id: Number(r.scam_alert_id),
    conv_id: r.conv_id,
    status: r.status,
    risk_score: Number(r.risk_score),
    category: r.scam_category,
    reason: r.reason,
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    conversation: Array.isArray(r.conversation) ? r.conversation : [],
    llm_model: r.llm_model,
    detection_count: Number(r.detection_count),
    admin_note: r.admin_note,
    victim_first_seen_at: r.victim_first_seen_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    scammer: {
      ...mapProfile('scammer', r),
      status: r.scammer_status ?? null,
      suspend_locked: Boolean(r.scammer_suspend_locked)
    },
    victim: mapProfile('victim', r)
  }));
}

export async function updateScamAlert(scamAlertId, { status, adminNote } = {}) {
  const id = Math.trunc(Number(scamAlertId));
  if (!Number.isFinite(id) || id < 1) throw Object.assign(new Error('Invalid scam alert id'), { statusCode: 400 });
  const nextStatus = status == null ? null : String(status);
  if (nextStatus != null && !ADMIN_STATUSES.has(nextStatus)) {
    throw Object.assign(new Error('status must be open, confirmed or dismissed'), { statusCode: 400 });
  }
  const { rows } = await pool.query(
    `UPDATE ${T_ALERT}
        SET status = COALESCE($2, status),
            admin_note = COALESCE($3, admin_note),
            updated_at = NOW()
      WHERE scam_alert_id = $1
      RETURNING scam_alert_id, status, admin_note`,
    [id, nextStatus, adminNote == null ? null : String(adminNote).slice(0, 2000)]
  );
  if (!rows[0]) throw Object.assign(new Error('Scam alert not found'), { statusCode: 404 });
  return rows[0];
}
