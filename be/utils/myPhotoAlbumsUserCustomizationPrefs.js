/** Parse / validate myPhotoAlbums prefs stored on helloworldjunktest.user_customization. */

const COLOR_INDEX_MAX = 6;
const EDITOR_FONT_PT_MIN = 4;
const EDITOR_FONT_PT_MAX = 128;

/** Effective defaults when DB column is NULL (columns stay nullable). */
export const MYNOTE_DEFAULT_FONT_COLOR_INDEX = 0;
export const MYNOTE_DEFAULT_CONTENT_BG_INDEX = 1;
/** null = no text highlight (white default painted a visible box around note text). */
export const MYNOTE_DEFAULT_TEXT_HIGHLIGHT_INDEX = null;
export const MYNOTE_DEFAULT_EDITOR_FONT_SIZE_PT = 20;
/** Menu button font size in tenths of rem (20 = 2.0 rem). */
export const MYNOTE_DEFAULT_FONT_SIZE_TENTHS = 20;

function parseNullableBigint(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.trunc(n);
}

function parseNullableColorIndex(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > COLOR_INDEX_MAX) return undefined;
  return Math.trunc(n);
}

function parseNullableEditorFontSizePt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < EDITOR_FONT_PT_MIN || n > EDITOR_FONT_PT_MAX) return undefined;
  return Math.trunc(n);
}

function parseNullableNonNegativeInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.trunc(n);
}

function colorIndexOrDefault(raw, fallback) {
  const parsed = parseNullableColorIndex(raw);
  if (parsed === undefined) return fallback;
  return parsed == null ? fallback : parsed;
}

function editorFontSizePtOrDefault(raw) {
  const parsed = parseNullableEditorFontSizePt(raw);
  if (parsed === undefined) return MYNOTE_DEFAULT_EDITOR_FONT_SIZE_PT;
  return parsed == null ? MYNOTE_DEFAULT_EDITOR_FONT_SIZE_PT : parsed;
}

export function mynotePrefsFromDbRow(row) {
  if (!row) {
    return {
      mynoteLastNotebookId: null,
      mynoteLastNoteId: null,
      mynoteContentBgIndex: MYNOTE_DEFAULT_CONTENT_BG_INDEX,
      mynoteFontColorIndex: MYNOTE_DEFAULT_FONT_COLOR_INDEX,
      mynoteTextHighlightIndex: MYNOTE_DEFAULT_TEXT_HIGHLIGHT_INDEX,
      mynoteEditorFontSizePt: MYNOTE_DEFAULT_EDITOR_FONT_SIZE_PT,
      mynoteNoteScrollTop: null,
      mynoteEditorCaretPos: null
    };
  }
  const nb = row.myphotoalbums_last_notebook_id;
  const note = row.myphotoalbums_last_note_id;
  return {
    mynoteLastNotebookId: nb == null ? null : Number(nb),
    mynoteLastNoteId: note == null ? null : Number(note),
    mynoteContentBgIndex: colorIndexOrDefault(row.myphotoalbums_content_bg_index, MYNOTE_DEFAULT_CONTENT_BG_INDEX),
    mynoteFontColorIndex: colorIndexOrDefault(row.myphotoalbums_font_color_index, MYNOTE_DEFAULT_FONT_COLOR_INDEX),
    mynoteTextHighlightIndex: colorIndexOrDefault(
      row.myphotoalbums_text_highlight_index,
      MYNOTE_DEFAULT_TEXT_HIGHLIGHT_INDEX
    ),
    mynoteEditorFontSizePt: editorFontSizePtOrDefault(
      row.myphotoalbums_editor_font_size_pt ?? row.myphotoalbums_editor_font_size
    ),
    mynoteNoteScrollTop: parseNullableNonNegativeInt(row.myphotoalbums_note_scroll_top),
    mynoteEditorCaretPos: parseNullableNonNegativeInt(row.myphotoalbums_editor_caret_pos)
  };
}

export function mynotePrefsToDbRow(prefs = {}) {
  const editorPt =
    prefs.mynoteEditorFontSizePt === undefined
      ? undefined
      : parseNullableEditorFontSizePt(prefs.mynoteEditorFontSizePt);
  return {
    myphotoalbums_last_notebook_id: parseNullableBigint(prefs.mynoteLastNotebookId),
    myphotoalbums_last_note_id: parseNullableBigint(prefs.mynoteLastNoteId),
    myphotoalbums_content_bg_index:
      prefs.mynoteContentBgIndex === undefined
        ? undefined
        : parseNullableColorIndex(prefs.mynoteContentBgIndex),
    myphotoalbums_font_color_index:
      prefs.mynoteFontColorIndex === undefined
        ? undefined
        : parseNullableColorIndex(prefs.mynoteFontColorIndex),
    myphotoalbums_text_highlight_index:
      prefs.mynoteTextHighlightIndex === undefined
        ? undefined
        : parseNullableColorIndex(prefs.mynoteTextHighlightIndex),
    // Live schema has both names; keep them in sync.
    myphotoalbums_editor_font_size_pt: editorPt,
    myphotoalbums_editor_font_size: editorPt,
    myphotoalbums_note_scroll_top:
      prefs.mynoteNoteScrollTop === undefined
        ? undefined
        : parseNullableNonNegativeInt(prefs.mynoteNoteScrollTop),
    myphotoalbums_editor_caret_pos:
      prefs.mynoteEditorCaretPos === undefined
        ? undefined
        : parseNullableNonNegativeInt(prefs.mynoteEditorCaretPos)
  };
}

export function parseMynotePrefsPatch(body = {}) {
  const out = {};
  const fields = [
    ['mynoteLastNotebookId', 'myphotoalbums_last_notebook_id', parseNullableBigint],
    ['mynoteLastNoteId', 'myphotoalbums_last_note_id', parseNullableBigint],
    ['mynoteContentBgIndex', 'myphotoalbums_content_bg_index', parseNullableColorIndex],
    ['mynoteFontColorIndex', 'myphotoalbums_font_color_index', parseNullableColorIndex],
    ['mynoteTextHighlightIndex', 'myphotoalbums_text_highlight_index', parseNullableColorIndex],
    ['mynoteEditorFontSizePt', 'myphotoalbums_editor_font_size_pt', parseNullableEditorFontSizePt],
    ['mynoteNoteScrollTop', 'myphotoalbums_note_scroll_top', parseNullableNonNegativeInt],
    ['mynoteEditorCaretPos', 'myphotoalbums_editor_caret_pos', parseNullableNonNegativeInt]
  ];

  for (const [apiKey, , parser] of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, apiKey)) continue;
    const parsed = parser(body[apiKey]);
    if (parsed === undefined) {
      return { error: `Invalid ${apiKey}` };
    }
    out[apiKey] = parsed;
  }
  return { patch: out };
}

export const MYNOTE_PREFS_API_KEYS = [
  'mynoteLastNotebookId',
  'mynoteLastNoteId',
  'mynoteContentBgIndex',
  'mynoteFontColorIndex',
  'mynoteTextHighlightIndex',
  'mynoteEditorFontSizePt',
  'mynoteNoteScrollTop',
  'mynoteEditorCaretPos'
];
