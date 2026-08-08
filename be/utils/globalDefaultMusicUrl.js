import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { DEFAULT_GLOBAL_MUSIC_URLS } from '../constants/defaultMusicUrls.js';
import { normalizeYoutubeMusicUrl } from './normalizeYoutubeMusicUrl.js';

const GLOBAL_ROW_ID = 1;
/** Matches CUSTOM_MUSIC_URL_SLOT_COUNT — slots 1–9 tracks + slot 10 Slide Show Music. */
const SLOT_COUNT = 10;

function globalTableName() {
  const schema = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
  return `"${schema}"."global"`;
}

export function normalizeDefaultMusicUrlArray(raw) {
  const slots = Array.from({ length: SLOT_COUNT }, () => null);
  const source = Array.isArray(raw) ? raw : DEFAULT_GLOBAL_MUSIC_URLS;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const item = source[i];
    if (item == null || String(item).trim() === '') continue;
    slots[i] = normalizeYoutubeMusicUrl(item);
  }
  return slots;
}

export async function ensureGlobalDefaultMusicUrlColumn() {
  await pool.query(`
    ALTER TABLE ${globalTableName()}
      ADD COLUMN IF NOT EXISTS default_music_url text[] NOT NULL DEFAULT ARRAY[]::text[]
  `);
}

/** Upsert canonical defaults onto global row id=1; returns normalized 10 slots. */
export async function persistGlobalDefaultMusicUrls() {
  await ensureGlobalDefaultMusicUrlColumn();
  const normalized = normalizeDefaultMusicUrlArray(DEFAULT_GLOBAL_MUSIC_URLS);
  const dbArray = normalized.map((slot) => slot ?? null);
  await pool.query(`UPDATE ${globalTableName()} SET default_music_url = $1::text[] WHERE id = $2`, [
    dbArray,
    GLOBAL_ROW_ID
  ]);
  return normalized;
}

/** Read global.default_music_url; falls back to code constant when empty. */
export async function loadGlobalDefaultMusicUrls() {
  await ensureGlobalDefaultMusicUrlColumn();
  const { rows } = await pool.query(
    `SELECT default_music_url FROM ${globalTableName()} WHERE id = $1 LIMIT 1`,
    [GLOBAL_ROW_ID]
  );
  const raw = rows[0]?.default_music_url;
  if (Array.isArray(raw) && raw.some((item) => String(item ?? '').trim())) {
    return normalizeDefaultMusicUrlArray(raw);
  }
  return normalizeDefaultMusicUrlArray(DEFAULT_GLOBAL_MUSIC_URLS);
}
