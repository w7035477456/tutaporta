import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ICON_LIST_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../constants/fontAwesome5ObjectsIcons.json');

let cachedIconSet = null;

function loadAllowedIconSet() {
  if (cachedIconSet) return cachedIconSet;
  const raw = JSON.parse(readFileSync(ICON_LIST_PATH, 'utf8'));
  const icons = Array.isArray(raw?.icons) ? raw.icons : [];
  cachedIconSet = new Set(icons.map((name) => String(name).trim().toLowerCase()).filter(Boolean));
  return cachedIconSet;
}

/** Normalize FA5 object icon name: lowercase kebab-case from allowlist. */
export function normalizeSecretIconName(raw) {
  const name = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
  if (!name || !loadAllowedIconSet().has(name)) return '';
  return name;
}

/** SHA-256 hex of lowercase icon name (stored in singles.secret_icon). */
export function hashSecretIconName(raw) {
  const name = normalizeSecretIconName(raw);
  if (!name) return '';
  return crypto.createHash('sha256').update(name, 'utf8').digest('hex');
}

export function isAllowedSecretIconName(raw) {
  return Boolean(normalizeSecretIconName(raw));
}

export function getFontAwesome5ObjectIconNames() {
  return [...loadAllowedIconSet()].sort();
}

/**
 * Verify chosen icon matches singles.secret_icon (no attempt tracking).
 * Prefer verifySecretIconWithAttemptTracking for user-facing verify flows.
 */
export async function verifyAccountSecretIcon(db, singlesId, rawIconName) {
  const candidateHash = hashSecretIconName(rawIconName);
  if (!candidateHash) {
    return { ok: false, statusCode: 400, body: { error: 'Please choose a valid security icon.' } };
  }
  const { rows } = await db.query(
    `SELECT secret_icon FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
    [singlesId]
  );
  const stored = String(rows[0]?.secret_icon ?? '').trim().toLowerCase();
  if (!stored) {
    return { ok: false, statusCode: 400, body: { error: 'No security icon is set on this account.' } };
  }
  if (stored !== candidateHash) {
    return { ok: false, statusCode: 403, body: { valid: false, error: 'Security icon does not match. Please try again.' } };
  }
  return { ok: true };
}
