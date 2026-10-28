/**
 * All Singles → "AI Filter". The viewer picks categories (age, hobbies, intro post, career,
 * location, ethnicity); the FE sends the visible candidates in small batches and the local Ollama
 * model scores how well each candidate matches the viewer on ONLY those categories.
 *
 * Only members of the opposite gender to the viewer are considered.
 *
 * Stateless per request (cluster-safe): every call loads both profiles from Postgres, and scores are
 * cached in ai_match_score keyed by an input hash, so unchanged profiles are never re-scored.
 */
import crypto from 'crypto';
import pool from '../../db/connection.js';
import { buildSinglesVisibilityWhereSql } from './memberVisibility.js';

const LOG = '[aiMatch]';
const SCHEMA = 'outdateddbsnapshotoct2024';
const MAX_BATCH = 8;
const INTRO_MAX_CHARS = 600;

export const AI_MATCH_CATEGORIES = Object.freeze(['age', 'hobbies', 'intro', 'career', 'location', 'ethnicity']);

const CATEGORY_LABELS = {
  age: 'Age',
  hobbies: 'Hobbies',
  intro: 'Intro post',
  career: 'Career',
  location: 'Location',
  ethnicity: 'Ethnicity'
};

function getAiMatchConfig(env = process.env) {
  const timeout = Number(env.AI_MATCH_LLM_TIMEOUT_MS);
  return {
    ollamaBaseUrl: String(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    ollamaModel: String(env.AI_MATCH_OLLAMA_MODEL || env.OLLAMA_MODEL || 'qwen3:30b-a3b').trim(),
    llmTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 180000
  };
}

const SYSTEM_PROMPT = `You are the matchmaker for a dating and friendship website.
You get the MEMBER's profile and a list of CANDIDATES. Score how well each candidate matches the
member, judging ONLY the categories listed - ignore everything else.

How to judge each category:
- Age: close in age, or inside the member's preferred age range when one is given.
- Hobbies: shared or complementary hobbies and interests.
- Intro post: compatible personality, values and what they are looking for.
- Career: compatible work, education and ambition.
- Location: same or nearby city / area, or near the member's preferred zip code.
- Ethnicity: same or similar background.
When a category is missing for someone, treat it as neutral (around 50) - never as a mismatch.

Reply with JSON only:
{"matches": [{"id": <candidate id>, "score": 0-100, "reason": "one short friendly sentence, max 15 words"}]}
Include every candidate exactly once. Each reason must name the concrete thing that matches or
differs for THAT candidate (e.g. "You both love hiking and live near Austin"), never a generic phrase.`;

function cleanText(value, maxChars = 200) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function parseCategories(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return AI_MATCH_CATEGORIES.filter((c) => list.includes(c));
}

function parseIds(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.map((v) => Math.trunc(Number(v))).filter((n) => Number.isFinite(n) && n > 0))].slice(
    0,
    MAX_BATCH
  );
}

/** 'M' / 'F' / NULL: self-report first, then driver license, passport, vetting. */
const GENDER_SQL = (alias) =>
  `UPPER(LEFT(COALESCE(
     NULLIF(TRIM(${alias}.gender_self_report::text), ''),
     NULLIF(TRIM(${alias}.dl_sex::text), ''),
     NULLIF(TRIM(${alias}.pp_sex), ''),
     (SELECT NULLIF(TRIM(v.official_gender), '') FROM ${SCHEMA}.vet_bio v
       WHERE v.singles_id = ${alias}.singles_id ORDER BY v.vet_bio_id DESC LIMIT 1)
   ), 1))`;

async function loadViewerGender(me) {
  const { rows } = await pool.query(`SELECT ${GENDER_SQL('s')} AS g FROM ${SCHEMA}.singles s WHERE s.singles_id = $1`, [
    me
  ]);
  const g = rows[0]?.g;
  return g === 'M' || g === 'F' ? g : null;
}

/**
 * Visible candidates (from `ids`, or everyone when null) of the opposite gender to the viewer.
 * Unknown viewer gender → no gender filter; unknown candidate gender → excluded.
 */
async function loadEligibleCandidateIds(me, ids = null) {
  const viewerGender = await loadViewerGender(me);
  const visibility = buildSinglesVisibilityWhereSql('s', 4);
  const { rows } = await pool.query(
    `SELECT s.singles_id FROM ${SCHEMA}.singles s
      WHERE s.singles_id <> $1
        AND ($2::bigint[] IS NULL OR s.singles_id = ANY($2::bigint[]))
        AND ($3::text IS NULL OR ${GENDER_SQL('s')} = $3::text)
        AND ${visibility.whereSql}
      ORDER BY s.created_at DESC`,
    [me, ids, viewerGender ? (viewerGender === 'M' ? 'F' : 'M') : null, ...visibility.params]
  );
  return { viewerGender, candidateIds: rows.map((r) => Number(r.singles_id)) };
}

const DOB_AGE_SQL = (col) =>
  `CASE WHEN s.${col} ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
        THEN date_part('year', age(to_date(s.${col}, 'MM/DD/YYYY')))::int END`;

/** Category facts for each singles_id (only what the AI needs; no names, emails or ids). */
async function loadProfiles(ids) {
  const { rows } = await pool.query(
    `SELECT s.singles_id,
            COALESCE(vb.age::int, ${DOB_AGE_SQL('dl_dob')}, ${DOB_AGE_SQL('pp_dob')}) AS age,
            s.search_partner_age_from, s.search_partner_age_to, s.search_partner_zipcode,
            mb.favorite_hobbies, mb.ethnicity,
            vb.job_title, vb.current_company, vb.highest_degree_completed, vb.college_name,
            COALESCE(NULLIF(TRIM(vb.current_city), ''), NULLIF(TRIM(s.mailing_city), '')) AS city,
            s.mailing_zip,
            intro.content AS intro
       FROM ${SCHEMA}.singles s
       LEFT JOIN LATERAL (
         SELECT * FROM ${SCHEMA}.vet_bio v WHERE v.singles_id = s.singles_id ORDER BY v.vet_bio_id DESC LIMIT 1
       ) vb ON true
       LEFT JOIN LATERAL (
         SELECT * FROM ${SCHEMA}.misc_bio m WHERE m.singles_id = s.singles_id ORDER BY m.misc_bio_id DESC LIMIT 1
       ) mb ON true
       LEFT JOIN LATERAL (
         SELECT p.content FROM ${SCHEMA}.postings p
          WHERE p.singles_id = s.singles_id AND p.is_profile_intro
          ORDER BY p.created_at DESC LIMIT 1
       ) intro ON true
      WHERE s.singles_id = ANY($1::bigint[])`,
    [ids]
  );
  return new Map(rows.map((r) => [Number(r.singles_id), r]));
}

function profileFacts(row, categories, { isViewer = false } = {}) {
  const facts = {};
  if (!row) return facts;
  for (const c of categories) {
    if (c === 'age') {
      if (row.age) facts.age = Number(row.age);
      if (isViewer && row.search_partner_age_from && row.search_partner_age_to) {
        facts.preferred_age = `${row.search_partner_age_from}-${row.search_partner_age_to}`;
      }
    } else if (c === 'hobbies') {
      if (row.favorite_hobbies) facts.hobbies = cleanText(row.favorite_hobbies);
    } else if (c === 'intro') {
      if (row.intro) facts.intro_post = cleanText(row.intro, INTRO_MAX_CHARS);
    } else if (c === 'career') {
      const parts = [
        row.job_title,
        row.current_company && `at ${row.current_company}`,
        row.highest_degree_completed,
        row.college_name
      ]
        .map((v) => cleanText(v, 80))
        .filter(Boolean);
      if (parts.length) facts.career = parts.join(', ');
    } else if (c === 'location') {
      const place = [cleanText(row.city, 80), cleanText(row.mailing_zip, 10)].filter(Boolean).join(' ');
      if (place) facts.location = place;
      if (isViewer && row.search_partner_zipcode) facts.preferred_zip = cleanText(row.search_partner_zipcode, 10);
    } else if (c === 'ethnicity') {
      if (row.ethnicity) facts.ethnicity = cleanText(row.ethnicity, 80);
    }
  }
  return facts;
}

function hashInput(model, categoriesKey, viewerFacts, candidateFacts) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([model, SYSTEM_PROMPT, categoriesKey, viewerFacts, candidateFacts]))
    .digest('hex');
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

async function scoreWithLlm(cfg, categories, viewerFacts, candidates) {
  const userContent = [
    `Categories to judge: ${categories.map((c) => CATEGORY_LABELS[c]).join(', ')}.`,
    `MEMBER: ${JSON.stringify(viewerFacts)}`,
    'CANDIDATES:',
    ...candidates.map((c) => JSON.stringify({ id: c.id, ...c.facts }))
  ].join('\n');
  const body = {
    model: cfg.ollamaModel,
    stream: false,
    format: 'json',
    think: false,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '10m',
    options: { temperature: 0 },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ]
  };
  const call = async () => {
    const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.llmTimeoutMs)
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  };
  let reply = await call();
  if (!reply.ok && reply.status === 400 && /think/i.test(reply.text)) {
    delete body.think;
    reply = await call();
  }
  if (!reply.ok) throw new Error(`Ollama HTTP ${reply.status}: ${reply.text.slice(0, 200)}`);
  const parsed = parseLlmJson(JSON.parse(reply.text)?.message?.content);
  const byId = new Map();
  for (const m of Array.isArray(parsed?.matches) ? parsed.matches : []) {
    const id = Math.trunc(Number(m?.id));
    const score = Math.round(Number(m?.score));
    if (!Number.isFinite(id) || !Number.isFinite(score)) continue;
    byId.set(id, { score: Math.min(100, Math.max(0, score)), reason: cleanText(m?.reason, 160) });
  }
  return byId;
}

/** GET /api/allSingles/aiMatch/candidates → { viewerGender, candidateIds } (opposite gender, visible). */
export async function getAllSinglesAiMatchCandidates(req, res) {
  const me = Math.trunc(Number(req.auth?.singles_id));
  if (!Number.isFinite(me) || me < 1) return res.status(401).json({ error: 'Authentication required' });
  try {
    return res.json(await loadEligibleCandidateIds(me));
  } catch (err) {
    console.error(`${LOG} candidates failed for singles_id=${me}:`, err?.message || err);
    return res.status(500).json({ error: 'Failed to load AI Filter candidates' });
  }
}

/**
 * POST /api/allSingles/aiMatch { categories: string[], candidateIds: number[] (max 8) }
 * → { results: [{ singles_id, score, reason, cached }] }
 */
export async function postAllSinglesAiMatch(req, res) {
  const me = Math.trunc(Number(req.auth?.singles_id));
  if (!Number.isFinite(me) || me < 1) return res.status(401).json({ error: 'Authentication required' });
  const categories = parseCategories(req.body?.categories);
  if (!categories.length) return res.status(400).json({ error: 'Pick at least one category first.' });
  const requestedIds = parseIds(req.body?.candidateIds).filter((id) => id !== me);
  if (!requestedIds.length) return res.json({ results: [] });

  const cfg = getAiMatchConfig();
  const categoriesKey = categories.join(',');
  try {
    const { candidateIds } = await loadEligibleCandidateIds(me, requestedIds);
    if (!candidateIds.length) return res.json({ results: [] });

    const profiles = await loadProfiles([me, ...candidateIds]);
    const viewerFacts = profileFacts(profiles.get(me), categories, { isViewer: true });
    const candidates = candidateIds.map((id) => {
      const facts = profileFacts(profiles.get(id), categories);
      return { id, facts, inputHash: hashInput(cfg.ollamaModel, categoriesKey, viewerFacts, facts) };
    });

    const cached = await pool.query(
      `SELECT candidate_singles_id, input_hash, score, reason FROM ${SCHEMA}.ai_match_score
        WHERE viewer_singles_id = $1 AND categories_key = $2 AND candidate_singles_id = ANY($3::bigint[])`,
      [me, categoriesKey, candidateIds]
    );
    const cacheById = new Map(cached.rows.map((r) => [Number(r.candidate_singles_id), r]));
    const results = [];
    const toScore = [];
    for (const c of candidates) {
      const hit = cacheById.get(c.id);
      if (hit && hit.input_hash === c.inputHash) {
        results.push({ singles_id: c.id, score: Number(hit.score), reason: hit.reason, cached: true });
      } else {
        toScore.push(c);
      }
    }

    if (toScore.length) {
      const scored = await scoreWithLlm(cfg, categories, viewerFacts, toScore);
      for (const c of toScore) {
        const s = scored.get(c.id);
        if (!s) continue;
        results.push({ singles_id: c.id, score: s.score, reason: s.reason, cached: false });
        await pool.query(
          `INSERT INTO ${SCHEMA}.ai_match_score
             (viewer_singles_id, candidate_singles_id, categories_key, input_hash, score, reason, llm_model)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (viewer_singles_id, candidate_singles_id, categories_key) DO UPDATE SET
             input_hash = EXCLUDED.input_hash, score = EXCLUDED.score, reason = EXCLUDED.reason,
             llm_model = EXCLUDED.llm_model, updated_at = NOW()`,
          [me, c.id, categoriesKey, c.inputHash, s.score, s.reason, cfg.ollamaModel]
        );
      }
    }
    return res.json({ results });
  } catch (err) {
    console.error(`${LOG} failed for singles_id=${me}:`, err?.message || err);
    return res.status(503).json({ error: 'Our AI matchmaker is busy right now. Please try again in a moment.' });
  }
}
