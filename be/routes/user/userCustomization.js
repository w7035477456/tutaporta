import pool from '../../db/connection.js';
import { parseBooleanEnumRaw, sqlBooleanEnumParam, toBooleanEnumLabel } from '../../utils/booleanEnum.js';
import { normalizeYoutubeMusicUrl } from '../../utils/normalizeYoutubeMusicUrl.js';
import { loadGlobalDefaultMusicUrls, persistGlobalDefaultMusicUrls } from '../../utils/globalDefaultMusicUrl.js';
import { DEFAULT_GLOBAL_MUSIC_URLS } from '../../constants/defaultMusicUrls.js';
import { parseMynoteFontSizeTenths } from '../../utils/vaultDefaultButtonFontSizeConfig.js';
import {
  MYNOTE_PREFS_API_KEYS,
  MYNOTE_DEFAULT_CONTENT_BG_INDEX,
  MYNOTE_DEFAULT_EDITOR_FONT_SIZE_PT,
  MYNOTE_DEFAULT_FONT_COLOR_INDEX,
  MYNOTE_DEFAULT_FONT_SIZE_TENTHS,
  MYNOTE_DEFAULT_TEXT_HIGHLIGHT_INDEX,
  mynotePrefsFromDbRow,
  mynotePrefsToDbRow,
  parseMynotePrefsPatch
} from '../../utils/mynoteUserCustomizationPrefs.js';

const SOUND_PREFERENCES = new Set(['piano', 'harpbirds', 'spasauna', 'musictrance', 'storm', 'wavesseagulls', 'rain', 'violin', 'jazz', 'mute']);
const VSINGLES_LYRIC_VALUES = new Set(['lyric', 'mute']);
const CUSTOM_MUSIC_URL_SLOT_COUNT = 10;

/** Defaults for new members until they change preferences in the UI. */
const DEFAULT_NEW_USER_VOLUME = 0;
const DEFAULT_NEW_USER_LYRIC_VOLUME = 1;
const DEFAULT_NEW_USER_SOUND_PREFERENCE = 'mute';

function toSinglesId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeSoundPreference(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (SOUND_PREFERENCES.has(key)) return key;
  if (key === 'lyric') return 'piano';
  if (key === 'flute' || key === 'vocaltrance') return 'spasauna';
  return 'piano';
}

function normalizeVsinglesLyric(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  return VSINGLES_LYRIC_VALUES.has(key) ? key : 'lyric';
}

function parseLyricMute(value) {
  return parseBooleanEnumRaw(value);
}

function parseLevel0to100(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.trunc(n)));
}

function emptyCustomMusicUrlSlots() {
  return Array.from({ length: CUSTOM_MUSIC_URL_SLOT_COUNT }, () => null);
}

function defaultCustomMusicUrlSlots() {
  const slots = emptyCustomMusicUrlSlots();
  for (let i = 0; i < DEFAULT_GLOBAL_MUSIC_URLS.length && i < CUSTOM_MUSIC_URL_SLOT_COUNT; i++) {
    slots[i] = normalizeYoutubeMusicUrl(DEFAULT_GLOBAL_MUSIC_URLS[i]);
  }
  return slots;
}

function parseLoadDefaultFlag(row) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'load_default')) return true;
  return row.load_default === true || row.load_default === 'true';
}

function normalizeCustomMusicUrlSlots(value) {
  if (value == null) return emptyCustomMusicUrlSlots();
  if (typeof value === 'string') {
    const single = normalizeYoutubeMusicUrl(value);
    const slots = emptyCustomMusicUrlSlots();
    if (single) slots[0] = single;
    return slots;
  }
  if (!Array.isArray(value)) return emptyCustomMusicUrlSlots();
  const slots = emptyCustomMusicUrlSlots();
  for (let i = 0; i < CUSTOM_MUSIC_URL_SLOT_COUNT; i++) {
    const raw = value[i];
    if (raw == null || String(raw).trim() === '') {
      slots[i] = null;
      continue;
    }
    slots[i] = normalizeYoutubeMusicUrl(raw);
  }
  return slots;
}

function customMusicUrlSlotsToDb(slots) {
  const normalized = normalizeCustomMusicUrlSlots(slots);
  return normalized.map((slot) => slot ?? null);
}

function defaultCustomizationDbRow() {
  return {
    chat_font_size: null,
    mynote_font_size: null,
    sound_preference: DEFAULT_NEW_USER_SOUND_PREFERENCE,
    vsingles_lyric: 'lyric',
    lyric_mute: false,
    lyric_volume: DEFAULT_NEW_USER_LYRIC_VOLUME,
    volume: DEFAULT_NEW_USER_VOLUME,
    custom_music_url: customMusicUrlSlotsToDb(defaultCustomMusicUrlSlots())
  };
}

function rowToPayload(row) {
  if (!row) {
    return {
      chatFontSize: null,
      mynoteFontSize: MYNOTE_DEFAULT_FONT_SIZE_TENTHS,
      soundPreference: DEFAULT_NEW_USER_SOUND_PREFERENCE,
      vsinglesLyric: 'lyric',
      lyricMute: false,
      lyricVolume: DEFAULT_NEW_USER_LYRIC_VOLUME,
      volume: DEFAULT_NEW_USER_VOLUME,
      customMusicUrls: defaultCustomMusicUrlSlots(),
      loadDefault: true,
      ...mynotePrefsFromDbRow(null)
    };
  }
  const chatFontSizeRaw = row.chat_font_size;
  const chatFontSize =
    chatFontSizeRaw == null ? null : Number.isFinite(Number(chatFontSizeRaw)) ? Number(chatFontSizeRaw) : null;
  const mynoteFontSizeRaw = row.mynote_font_size;
  const mynoteFontSizeParsed =
    mynoteFontSizeRaw == null
      ? null
      : Number.isFinite(Number(mynoteFontSizeRaw))
        ? Number(mynoteFontSizeRaw)
        : null;
  const mynoteFontSize = mynoteFontSizeParsed == null ? MYNOTE_DEFAULT_FONT_SIZE_TENTHS : mynoteFontSizeParsed;
  const volumeRaw = row.volume;
  let volume = volumeRaw == null ? DEFAULT_NEW_USER_VOLUME : Number(volumeRaw);
  if (!Number.isFinite(volume)) volume = DEFAULT_NEW_USER_VOLUME;
  volume = Math.min(100, Math.max(0, Math.trunc(volume)));

  let vsinglesLyric = normalizeVsinglesLyric(row.vsingles_lyric);
  let lyricMute = row.lyric_mute != null ? parseLyricMute(row.lyric_mute) : false;
  let lyricVolume = parseLevel0to100(row.lyric_volume, DEFAULT_NEW_USER_LYRIC_VOLUME);
  if (vsinglesLyric === 'mute') {
    lyricMute = true;
    vsinglesLyric = 'lyric';
  }

  return {
    chatFontSize,
    mynoteFontSize,
    soundPreference: normalizeSoundPreference(row.sound_preference),
    vsinglesLyric,
    lyricMute,
    lyricVolume,
    loadDefault: parseLoadDefaultFlag(row),
    volume,
    customMusicUrls: normalizeCustomMusicUrlSlots(row.custom_music_url),
    ...mynotePrefsFromDbRow(row)
  };
}

function isMissingColumn(err, column) {
  return err?.code === '42703' && String(err?.message ?? '').includes(column);
}

let customizationSchemaPromise = null;

/** Run once per process (startup + first request share the same promise). */
export async function initUserCustomizationSchema() {
  if (customizationSchemaPromise) return customizationSchemaPromise;
  customizationSchemaPromise = runCustomizationSchemaDdl().catch((err) => {
    customizationSchemaPromise = null;
    throw err;
  });
  return customizationSchemaPromise;
}

async function ensureCustomizationSchema() {
  return initUserCustomizationSchema();
}

async function runCustomizationSchemaDdl() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sound_preference_enum') THEN
        CREATE TYPE sound_preference_enum AS ENUM ('piano', 'flute', 'rain', 'violin', 'jazz', 'mute', 'spasauna', 'storm', 'harpbirds', 'wavesseagulls');
      END IF;
    END
    $$;
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'violin'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'jazz'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'vocaltrance'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'musictrance'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'spasauna'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'storm'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'harpbirds'
  `);
  await pool.query(`
    ALTER TYPE sound_preference_enum ADD VALUE IF NOT EXISTS 'wavesseagulls'
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vsingles_lyric_enum') THEN
        CREATE TYPE vsingles_lyric_enum AS ENUM ('lyric', 'mute');
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'helloworldjunktest'
          AND t.typname = 'boolean_enum'
      ) THEN
        CREATE TYPE helloworldjunktest.boolean_enum AS ENUM ('true', 'false');
      END IF;
    END
    $$;
  `);
  await pool.query(`
    ALTER TABLE helloworldjunktest.user_customization
      ADD COLUMN IF NOT EXISTS sound_preference sound_preference_enum NOT NULL DEFAULT 'piano',
      ADD COLUMN IF NOT EXISTS vsingles_lyric vsingles_lyric_enum NOT NULL DEFAULT 'lyric',
      ADD COLUMN IF NOT EXISTS lyric_mute helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      ADD COLUMN IF NOT EXISTS lyric_volume smallint NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS volume smallint NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS custom_music_url text NULL,
      ADD COLUMN IF NOT EXISTS mynote_font_size smallint NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS mynote_last_notebook_id bigint NULL,
      ADD COLUMN IF NOT EXISTS mynote_last_note_id bigint NULL,
      ADD COLUMN IF NOT EXISTS mynote_content_bg_index smallint NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS mynote_font_color_index smallint NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS mynote_text_highlight_index smallint NULL DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS mynote_editor_font_size smallint NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS mynote_editor_font_size_pt smallint NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS mynote_note_scroll_top integer NULL,
      ADD COLUMN IF NOT EXISTS mynote_editor_caret_pos integer NULL,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()
  `);
  // Existing rows keep true (no one-time overwrite); new inserts default false until first Track Load Default.
  await pool.query(`
    ALTER TABLE helloworldjunktest.user_customization
      ADD COLUMN IF NOT EXISTS load_default boolean NOT NULL DEFAULT true
  `);
  await pool.query(`
    ALTER TABLE helloworldjunktest.user_customization
      ALTER COLUMN load_default SET DEFAULT false
  `);
  await pool.query(`
    ALTER TABLE helloworldjunktest.user_customization
      ALTER COLUMN mynote_font_color_index SET DEFAULT 0,
      ALTER COLUMN mynote_content_bg_index SET DEFAULT 1,
      ALTER COLUMN mynote_text_highlight_index SET DEFAULT NULL,
      ALTER COLUMN mynote_font_size SET DEFAULT 20,
      ALTER COLUMN mynote_editor_font_size SET DEFAULT 20,
      ALTER COLUMN mynote_editor_font_size_pt SET DEFAULT 20
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'helloworldjunktest'
          AND table_name = 'user_customization'
          AND column_name = 'lyric_mute'
          AND udt_name = 'bool'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN lyric_mute DROP DEFAULT;
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN lyric_mute TYPE helloworldjunktest.boolean_enum
          USING (
            CASE
              WHEN lyric_mute IS TRUE THEN 'true'::helloworldjunktest.boolean_enum
              ELSE 'false'::helloworldjunktest.boolean_enum
            END
          );
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN lyric_mute SET DEFAULT 'false'::helloworldjunktest.boolean_enum;
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN lyric_mute SET NOT NULL;
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_customization_volume_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_volume_range_chk CHECK (volume >= 0 AND volume <= 100);
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_customization_lyric_volume_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_lyric_volume_range_chk CHECK (lyric_volume >= 0 AND lyric_volume <= 100);
      END IF;
    END
    $$;
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_customization_singles_id_uniq_idx
      ON helloworldjunktest.user_customization (singles_id)
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_customization'
          AND column_name = 'custom_music_url'
          AND udt_name = 'text'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN custom_music_url DROP DEFAULT;
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN custom_music_url TYPE text[]
          USING CASE
            WHEN custom_music_url IS NULL OR btrim(custom_music_url) = '' THEN ARRAY[]::text[]
            ELSE ARRAY[custom_music_url]::text[]
          END;
        ALTER TABLE helloworldjunktest.user_customization
          ALTER COLUMN custom_music_url SET DEFAULT ARRAY[]::text[];
      END IF;
    END
    $$;
  `);
  await pool.query(`
    ALTER TABLE helloworldjunktest.user_customization
      DROP CONSTRAINT IF EXISTS user_customization_custom_music_url_limit_chk
  `);
  await pool.query(`
    ALTER TABLE helloworldjunktest.user_customization
      ADD CONSTRAINT user_customization_custom_music_url_limit_chk
      CHECK (
        custom_music_url IS NULL
        OR (
          cardinality(custom_music_url) <= ${CUSTOM_MUSIC_URL_SLOT_COUNT}
          AND (array_ndims(custom_music_url) IS NULL OR array_ndims(custom_music_url) = 1)
        )
      )
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_customization_mynote_font_size_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_mynote_font_size_range_chk
          CHECK (mynote_font_size IS NULL OR (mynote_font_size >= 5 AND mynote_font_size <= 80));
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_customization_mynote_color_index_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_mynote_color_index_range_chk
          CHECK (
            (mynote_content_bg_index IS NULL OR (mynote_content_bg_index >= 0 AND mynote_content_bg_index <= 6))
            AND (mynote_font_color_index IS NULL OR (mynote_font_color_index >= 0 AND mynote_font_color_index <= 6))
            AND (mynote_text_highlight_index IS NULL OR (mynote_text_highlight_index >= 0 AND mynote_text_highlight_index <= 6))
          );
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_customization_mynote_editor_font_size_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_mynote_editor_font_size_range_chk
          CHECK (mynote_editor_font_size IS NULL OR (mynote_editor_font_size >= 4 AND mynote_editor_font_size <= 128));
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_customization_mynote_note_scroll_top_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_mynote_note_scroll_top_range_chk
          CHECK (mynote_note_scroll_top IS NULL OR mynote_note_scroll_top >= 0);
      END IF;
    END
    $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_customization_mynote_editor_caret_pos_range_chk'
      ) THEN
        ALTER TABLE helloworldjunktest.user_customization
          ADD CONSTRAINT user_customization_mynote_editor_caret_pos_range_chk
          CHECK (mynote_editor_caret_pos IS NULL OR mynote_editor_caret_pos >= 0);
      END IF;
    END
    $$;
  `);
}

async function selectCustomizationRow(me) {
  try {
    const { rows } = await pool.query(
      `SELECT chat_font_size, mynote_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume
             , custom_music_url, load_default
             , mynote_last_notebook_id, mynote_last_note_id
             , mynote_content_bg_index, mynote_font_color_index, mynote_text_highlight_index
             , mynote_editor_font_size, mynote_note_scroll_top, mynote_editor_caret_pos
       FROM helloworldjunktest.user_customization
       WHERE singles_id = $1`,
      [me]
    );
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingColumn(err, 'load_default')) {
      const { rows } = await pool.query(
        `SELECT chat_font_size, mynote_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume
               , custom_music_url
               , mynote_last_notebook_id, mynote_last_note_id
               , mynote_content_bg_index, mynote_font_color_index, mynote_text_highlight_index
               , mynote_editor_font_size, mynote_note_scroll_top, mynote_editor_caret_pos
         FROM helloworldjunktest.user_customization
         WHERE singles_id = $1`,
        [me]
      );
      return rows[0] ?? null;
    }
    if (isMissingColumn(err, 'mynote_last_notebook_id')) {
      const { rows } = await pool.query(
        `SELECT chat_font_size, mynote_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume, custom_music_url
         FROM helloworldjunktest.user_customization
         WHERE singles_id = $1`,
        [me]
      );
      return rows[0] ?? null;
    }
    if (isMissingColumn(err, 'mynote_font_size')) {
      const { rows } = await pool.query(
        `SELECT chat_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume, custom_music_url
         FROM helloworldjunktest.user_customization
         WHERE singles_id = $1`,
        [me]
      );
      return rows[0] ?? null;
    }
    if (isMissingColumn(err, 'lyric_mute')) {
      const { rows } = await pool.query(
        `SELECT chat_font_size, sound_preference, vsingles_lyric, lyric_volume, volume, custom_music_url
         FROM helloworldjunktest.user_customization
         WHERE singles_id = $1`,
        [me]
      );
      return rows[0] ?? null;
    }
    if (isMissingColumn(err, 'lyric_volume')) {
      const { rows } = await pool.query(
        `SELECT chat_font_size, sound_preference, vsingles_lyric, lyric_mute, volume, custom_music_url
         FROM helloworldjunktest.user_customization
         WHERE singles_id = $1`,
        [me]
      );
      return rows[0] ?? null;
    }
    throw err;
  }
}

async function upsertCustomizationRow(me, row) {
  const mynoteDb = mynotePrefsToDbRow(mynotePrefsFromDbRow(row));
  const params = [
    me,
    row.chat_font_size,
    row.mynote_font_size ?? MYNOTE_DEFAULT_FONT_SIZE_TENTHS,
    row.sound_preference,
    row.vsingles_lyric,
    toBooleanEnumLabel(row.lyric_mute),
    row.lyric_volume,
    row.volume,
    row.custom_music_url,
    mynoteDb.mynote_last_notebook_id,
    mynoteDb.mynote_last_note_id,
    mynoteDb.mynote_content_bg_index ?? MYNOTE_DEFAULT_CONTENT_BG_INDEX,
    mynoteDb.mynote_font_color_index ?? MYNOTE_DEFAULT_FONT_COLOR_INDEX,
    mynoteDb.mynote_text_highlight_index ?? MYNOTE_DEFAULT_TEXT_HIGHLIGHT_INDEX,
    mynoteDb.mynote_editor_font_size ?? MYNOTE_DEFAULT_EDITOR_FONT_SIZE_PT,
    mynoteDb.mynote_note_scroll_top,
    mynoteDb.mynote_editor_caret_pos
  ];
  const lyricMuteParam = sqlBooleanEnumParam('$6', 'helloworldjunktest');
  try {
    await pool.query(
      `
      INSERT INTO helloworldjunktest.user_customization (
        singles_id, chat_font_size, mynote_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume, custom_music_url,
        mynote_last_notebook_id, mynote_last_note_id, mynote_content_bg_index, mynote_font_color_index, mynote_text_highlight_index,
        mynote_editor_font_size, mynote_note_scroll_top, mynote_editor_caret_pos, updated_at
      )
      VALUES ($1, $2, $3, $4::sound_preference_enum, $5::vsingles_lyric_enum, ${lyricMuteParam}, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (singles_id) DO UPDATE SET
        chat_font_size = EXCLUDED.chat_font_size,
        mynote_font_size = EXCLUDED.mynote_font_size,
        sound_preference = EXCLUDED.sound_preference,
        vsingles_lyric = EXCLUDED.vsingles_lyric,
        lyric_mute = EXCLUDED.lyric_mute,
        lyric_volume = EXCLUDED.lyric_volume,
        volume = EXCLUDED.volume,
        custom_music_url = EXCLUDED.custom_music_url,
        mynote_last_notebook_id = EXCLUDED.mynote_last_notebook_id,
        mynote_last_note_id = EXCLUDED.mynote_last_note_id,
        mynote_content_bg_index = EXCLUDED.mynote_content_bg_index,
        mynote_font_color_index = EXCLUDED.mynote_font_color_index,
        mynote_text_highlight_index = EXCLUDED.mynote_text_highlight_index,
        mynote_editor_font_size = EXCLUDED.mynote_editor_font_size,
        mynote_note_scroll_top = EXCLUDED.mynote_note_scroll_top,
        mynote_editor_caret_pos = EXCLUDED.mynote_editor_caret_pos,
        updated_at = NOW()
      `,
      params
    );
  } catch (err) {
    if (isMissingColumn(err, 'mynote_last_notebook_id')) {
      const legacyParams = [
        me,
        row.chat_font_size,
        row.mynote_font_size ?? MYNOTE_DEFAULT_FONT_SIZE_TENTHS,
        row.sound_preference,
        row.vsingles_lyric,
        toBooleanEnumLabel(row.lyric_mute),
        row.lyric_volume,
        row.volume,
        row.custom_music_url
      ];
      await pool.query(
        `
        INSERT INTO helloworldjunktest.user_customization (singles_id, chat_font_size, mynote_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume, custom_music_url, updated_at)
        VALUES ($1, $2, $3, $4::sound_preference_enum, $5::vsingles_lyric_enum, ${lyricMuteParam}, $7, $8, $9, NOW())
        ON CONFLICT (singles_id) DO UPDATE SET
          chat_font_size = EXCLUDED.chat_font_size,
          mynote_font_size = EXCLUDED.mynote_font_size,
          sound_preference = EXCLUDED.sound_preference,
          vsingles_lyric = EXCLUDED.vsingles_lyric,
          lyric_mute = EXCLUDED.lyric_mute,
          lyric_volume = EXCLUDED.lyric_volume,
          volume = EXCLUDED.volume,
          custom_music_url = EXCLUDED.custom_music_url,
          updated_at = NOW()
        `,
        legacyParams
      );
      return;
    }
    if (isMissingColumn(err, 'mynote_font_size')) {
      await pool.query(
        `
        INSERT INTO helloworldjunktest.user_customization (singles_id, chat_font_size, sound_preference, vsingles_lyric, lyric_mute, lyric_volume, volume, custom_music_url, updated_at)
        VALUES ($1, $2, $3::sound_preference_enum, $4::vsingles_lyric_enum, ${sqlBooleanEnumParam('$5', 'helloworldjunktest')}, $6, $7, $8, NOW())
        ON CONFLICT (singles_id) DO UPDATE SET
          chat_font_size = EXCLUDED.chat_font_size,
          sound_preference = EXCLUDED.sound_preference,
          vsingles_lyric = EXCLUDED.vsingles_lyric,
          lyric_mute = EXCLUDED.lyric_mute,
          lyric_volume = EXCLUDED.lyric_volume,
          volume = EXCLUDED.volume,
          custom_music_url = EXCLUDED.custom_music_url,
          updated_at = NOW()
        `,
        [me, row.chat_font_size, row.sound_preference, row.vsingles_lyric, toBooleanEnumLabel(row.lyric_mute), row.lyric_volume, row.volume, row.custom_music_url]
      );
      return;
    }
    if (isMissingColumn(err, 'lyric_mute')) {
      await pool.query(
        `
        INSERT INTO helloworldjunktest.user_customization (singles_id, chat_font_size, sound_preference, vsingles_lyric, lyric_volume, volume, custom_music_url, updated_at)
        VALUES ($1, $2, $3::sound_preference_enum, $4::vsingles_lyric_enum, $5, $6, $7, NOW())
        ON CONFLICT (singles_id) DO UPDATE SET
          chat_font_size = EXCLUDED.chat_font_size,
          sound_preference = EXCLUDED.sound_preference,
          vsingles_lyric = EXCLUDED.vsingles_lyric,
          lyric_volume = EXCLUDED.lyric_volume,
          volume = EXCLUDED.volume,
          custom_music_url = EXCLUDED.custom_music_url,
          updated_at = NOW()
        `,
        [me, row.chat_font_size, row.sound_preference, row.vsingles_lyric, row.lyric_volume, row.volume, row.custom_music_url]
      );
      return;
    }
    if (isMissingColumn(err, 'lyric_volume')) {
      await pool.query(
        `
        INSERT INTO helloworldjunktest.user_customization (singles_id, chat_font_size, sound_preference, vsingles_lyric, lyric_mute, volume, custom_music_url, updated_at)
        VALUES ($1, $2, $3::sound_preference_enum, $4::vsingles_lyric_enum, ${lyricMuteParam}, $6, $7, NOW())
        ON CONFLICT (singles_id) DO UPDATE SET
          chat_font_size = EXCLUDED.chat_font_size,
          sound_preference = EXCLUDED.sound_preference,
          vsingles_lyric = EXCLUDED.vsingles_lyric,
          lyric_mute = EXCLUDED.lyric_mute,
          volume = EXCLUDED.volume,
          custom_music_url = EXCLUDED.custom_music_url,
          updated_at = NOW()
        `,
        [me, row.chat_font_size, row.sound_preference, row.vsingles_lyric, toBooleanEnumLabel(row.lyric_mute), row.volume, row.custom_music_url]
      );
      return;
    }
    throw err;
  }
}

export async function getUserCustomization(req, res) {
  const me = toSinglesId(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    await ensureCustomizationSchema();
    let row = await selectCustomizationRow(me);
    if (!row) {
      await upsertCustomizationRow(me, defaultCustomizationDbRow());
      row = await selectCustomizationRow(me);
    }
    return res.status(200).json(rowToPayload(row));
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return res.status(200).json(rowToPayload(null));
    }
    console.error('[userCustomization] get failed:', err);
    return res.status(500).json({ error: 'Failed to load customization' });
  }
}

export async function putUserCustomization(req, res) {
  const me = toSinglesId(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  const body = req.body ?? {};
  const hasChatFontSize = Object.prototype.hasOwnProperty.call(body, 'chatFontSize');
  const hasSoundPreference = Object.prototype.hasOwnProperty.call(body, 'soundPreference');
  const hasVsinglesLyric = Object.prototype.hasOwnProperty.call(body, 'vsinglesLyric');
  const hasLyricMute = Object.prototype.hasOwnProperty.call(body, 'lyricMute');
  const hasLyricVolume = Object.prototype.hasOwnProperty.call(body, 'lyricVolume');
  const hasVolume = Object.prototype.hasOwnProperty.call(body, 'volume');
  const hasCustomMusicUrls = Object.prototype.hasOwnProperty.call(body, 'customMusicUrls');
  const hasMynoteFontSize = Object.prototype.hasOwnProperty.call(body, 'mynoteFontSize');
  const hasAnyMynotePref = MYNOTE_PREFS_API_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key));

  if (
    !hasChatFontSize &&
    !hasMynoteFontSize &&
    !hasAnyMynotePref &&
    !hasSoundPreference &&
    !hasVsinglesLyric &&
    !hasLyricMute &&
    !hasLyricVolume &&
    !hasVolume &&
    !hasCustomMusicUrls
  ) {
    return res.status(400).json({ error: 'No customization fields provided' });
  }

  let chatFontSize = null;
  if (hasChatFontSize) {
    const raw = body.chatFontSize;
    if (raw === null || raw === undefined || raw === '') {
      chatFontSize = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) return res.status(400).json({ error: 'Invalid chatFontSize' });
      chatFontSize = Math.trunc(n);
    }
  }

  let mynoteFontSize = null;
  if (hasMynoteFontSize) {
    const parsed = parseMynoteFontSizeTenths(body.mynoteFontSize);
    if (body.mynoteFontSize != null && body.mynoteFontSize !== '' && parsed == null) {
      return res.status(400).json({ error: 'Invalid mynoteFontSize' });
    }
    mynoteFontSize = parsed;
  }

  const mynotePatchResult = parseMynotePrefsPatch(body);
  if (mynotePatchResult.error) {
    return res.status(400).json({ error: mynotePatchResult.error });
  }

  let soundPreference = null;
  if (hasSoundPreference) {
    soundPreference = normalizeSoundPreference(body.soundPreference);
  }

  let vsinglesLyric = null;
  if (hasVsinglesLyric) {
    vsinglesLyric = normalizeVsinglesLyric(body.vsinglesLyric);
  }

  let lyricMute = null;
  if (hasLyricMute) {
    lyricMute = parseLyricMute(body.lyricMute);
  }
  let lyricVolume = null;
  if (hasLyricVolume) {
    lyricVolume = parseLevel0to100(body.lyricVolume, NaN);
    if (!Number.isFinite(lyricVolume)) {
      return res.status(400).json({ error: 'Invalid lyricVolume' });
    }
  }

  let volume = null;
  if (hasVolume) {
    const raw = body.volume;
    if (raw === null || raw === undefined || raw === '') {
      volume = DEFAULT_NEW_USER_VOLUME;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({ error: 'Invalid volume' });
      }
      volume = Math.trunc(n);
    }
  }

  let customMusicUrls = null;
  if (hasCustomMusicUrls) {
    const rawSlots = body.customMusicUrls;
    if (rawSlots == null) {
      customMusicUrls = emptyCustomMusicUrlSlots();
    } else if (!Array.isArray(rawSlots)) {
      return res.status(400).json({ error: 'Invalid customMusicUrls (must be an array)' });
    } else if (rawSlots.length > CUSTOM_MUSIC_URL_SLOT_COUNT) {
      return res.status(400).json({ error: `customMusicUrls may have at most ${CUSTOM_MUSIC_URL_SLOT_COUNT} entries` });
    } else {
      for (let i = 0; i < rawSlots.length; i++) {
        const raw = rawSlots[i];
        if (raw == null || String(raw).trim() === '') continue;
        if (!normalizeYoutubeMusicUrl(raw)) {
          return res.status(400).json({ error: `Invalid customMusicUrls[${i}] (must be a YouTube URL)` });
        }
      }
      customMusicUrls = normalizeCustomMusicUrlSlots(rawSlots);
    }
  }

  try {
    await ensureCustomizationSchema();
    const prev = await selectCustomizationRow(me);
    const nextChatFontSize = hasChatFontSize ? chatFontSize : prev?.chat_font_size ?? null;
    const nextMynoteFontSize = hasMynoteFontSize ? mynoteFontSize : prev?.mynote_font_size ?? null;
    const nextSoundPreference = hasSoundPreference
      ? soundPreference
      : normalizeSoundPreference(prev?.sound_preference);
    let nextVsinglesLyric = hasVsinglesLyric ? vsinglesLyric : normalizeVsinglesLyric(prev?.vsingles_lyric);
    let nextLyricMute = hasLyricMute
      ? lyricMute
      : prev?.lyric_mute != null
        ? parseLyricMute(prev.lyric_mute)
        : false;
    let nextLyricVolume = hasLyricVolume
      ? lyricVolume
      : parseLevel0to100(prev?.lyric_volume, nextLyricMute ? 0 : DEFAULT_NEW_USER_LYRIC_VOLUME);
    const nextVolume = hasVolume ? volume : prev?.volume ?? DEFAULT_NEW_USER_VOLUME;
    const nextCustomMusicUrls = hasCustomMusicUrls
      ? customMusicUrls
      : normalizeCustomMusicUrlSlots(prev?.custom_music_url);

    const nextMynotePrefs = hasAnyMynotePref
      ? { ...mynotePrefsFromDbRow(prev), ...mynotePatchResult.patch }
      : mynotePrefsFromDbRow(prev);
    const nextMynoteDb = mynotePrefsToDbRow(nextMynotePrefs);

    if (nextVsinglesLyric === 'mute') {
      nextLyricMute = true;
      nextVsinglesLyric = 'lyric';
    }
    if (hasLyricMute && lyricMute === true) {
      nextVsinglesLyric = 'lyric';
    }
    if (hasLyricMute && lyricMute === false && !hasLyricVolume && nextLyricVolume <= 0) {
      nextLyricVolume = DEFAULT_NEW_USER_LYRIC_VOLUME;
    }
    if (hasLyricVolume) {
      nextLyricMute = nextLyricVolume <= 0;
    }

    await upsertCustomizationRow(me, {
      chat_font_size: nextChatFontSize,
      mynote_font_size: nextMynoteFontSize,
      sound_preference: nextSoundPreference,
      vsingles_lyric: nextVsinglesLyric,
      lyric_mute: nextLyricMute,
      lyric_volume: nextLyricVolume,
      volume: nextVolume,
      custom_music_url: customMusicUrlSlotsToDb(nextCustomMusicUrls),
      ...nextMynoteDb
    });
    return res.status(200).json(rowToPayload({
      chat_font_size: nextChatFontSize,
      mynote_font_size: nextMynoteFontSize,
      sound_preference: nextSoundPreference,
      vsingles_lyric: nextVsinglesLyric,
      lyric_mute: nextLyricMute,
      lyric_volume: nextLyricVolume,
      volume: nextVolume,
      custom_music_url: customMusicUrlSlotsToDb(nextCustomMusicUrls),
      load_default: parseLoadDefaultFlag(prev),
      ...nextMynoteDb
    }));
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return res.status(503).json({ error: 'user_customization table is not installed' });
    }
    console.error('[userCustomization] put failed:', err);
    return res.status(500).json({ error: 'Failed to save customization' });
  }
}

/** POST /api/user/customization/load-default-music-urls — global.default_music_url → user custom_music_url */
export async function postLoadDefaultMusicUrls(req, res) {
  const me = toSinglesId(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    await ensureCustomizationSchema();
    await persistGlobalDefaultMusicUrls();
    const defaultSlots = await loadGlobalDefaultMusicUrls();
    const prev = (await selectCustomizationRow(me)) ?? defaultCustomizationDbRow();
    const nextRow = {
      chat_font_size: prev.chat_font_size ?? null,
      mynote_font_size: prev.mynote_font_size ?? null,
      sound_preference: normalizeSoundPreference(prev.sound_preference),
      vsingles_lyric: normalizeVsinglesLyric(prev.vsingles_lyric),
      lyric_mute: prev.lyric_mute != null ? parseLyricMute(prev.lyric_mute) : false,
      lyric_volume: parseLevel0to100(prev.lyric_volume, DEFAULT_NEW_USER_LYRIC_VOLUME),
      volume: parseLevel0to100(prev.volume, DEFAULT_NEW_USER_VOLUME),
      custom_music_url: customMusicUrlSlotsToDb(defaultSlots)
    };

    await upsertCustomizationRow(me, nextRow);
    try {
      await pool.query(
        `UPDATE helloworldjunktest.user_customization
         SET load_default = true, updated_at = NOW()
         WHERE singles_id = $1`,
        [me]
      );
      nextRow.load_default = true;
    } catch (flagErr) {
      if (!isMissingColumn(flagErr, 'load_default')) throw flagErr;
    }
    return res.status(200).json(rowToPayload(nextRow));
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return res.status(503).json({ error: 'user_customization table is not installed' });
    }
    console.error('[userCustomization] load-default-music-urls failed:', err);
    return res.status(500).json({ error: 'Failed to load default music URLs' });
  }
}
