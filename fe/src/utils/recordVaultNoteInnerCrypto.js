/**
 * Optional per-note / per-notebook inner encryption (6-digit PIN).
 *
 * Same E2E model as yellow Encrypt Password:
 *   PIN → KEK (Argon2id) → wrap note DEK → seal note body with DEK
 *
 * The PIN, KEK, and plaintext DEK never leave the browser.
 * Storage (USB/OneDrive vault.db) gets only an opaque body blob:
 *   salt + wrapped DEK + ciphertext — never the PIN.
 *
 * Unlock writes plaintext back and clears the flag; re-encrypt is manual only.
 */
import {
  base64ToBytes,
  bytesToBase64,
  decryptUtf8WithKey,
  deriveKekFromPassword,
  encryptUtf8WithKey,
  generateDek,
  randomBytes,
  unwrapDek,
  wrapDek,
  VAULT_E2E_KDF
} from './recordVaultClientVaultCrypto';

/** Legacy v1: PIN derives AES key directly; salt in notes.inner_pin_salt. */
export const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

/** v2 E2E: self-contained salt + wrapped DEK + body cipher (no separate salt column). */
export const NOTE_INNER_ENCRYPT_V2_PREFIX = '\u2063RVI2:';

/** Argon2id params — same family as outer vault E2E. */
export const INNER_ENCRYPT_KDF = {
  type: VAULT_E2E_KDF.type,
  iterations: VAULT_E2E_KDF.iterations,
  memorySize: VAULT_E2E_KDF.memorySize,
  parallelism: VAULT_E2E_KDF.parallelism,
  hashLength: VAULT_E2E_KDF.hashLength
};

const IV_LEN = 12;
const TAG_LEN = 16;

export function isValidInnerEncryptPin(pin) {
  return /^\d{6}$/.test(String(pin || '').trim());
}

export function isRecordVaultInnerEncryptedBody(bodyText) {
  const raw = String(bodyText || '');
  return raw.startsWith(NOTE_INNER_ENCRYPT_V2_PREFIX) || raw.startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX);
}

function isV2InnerBody(bodyText) {
  return String(bodyText || '').startsWith(NOTE_INNER_ENCRYPT_V2_PREFIX);
}

/** Legacy v1: PIN → AES key (kept for decrypt of notes locked before v2). */
async function deriveInnerAesKeyFromPinV1(pin, saltBase64) {
  const { argon2id } = await import('hash-wasm');
  const salt = base64ToBytes(saltBase64);
  if (!salt.length) throw new Error('Missing inner encryption salt');
  const keyBytes = await argon2id({
    password: String(pin).trim(),
    salt,
    iterations: INNER_ENCRYPT_KDF.iterations,
    memorySize: INNER_ENCRYPT_KDF.memorySize,
    hashLength: INNER_ENCRYPT_KDF.hashLength,
    parallelism: INNER_ENCRYPT_KDF.parallelism,
    outputType: 'binary'
  });
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function aesGcmDecryptV1(payloadBase64, key) {
  const combined = base64ToBytes(payloadBase64);
  // Empty plaintext is valid (IV + tag only) — notebook force-lock encrypts empty notes.
  if (combined.length < IV_LEN + TAG_LEN) {
    throw new Error('Inner encrypted note data is corrupt');
  }
  const iv = combined.subarray(0, IV_LEN);
  const data = combined.subarray(IV_LEN);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 }, key, data);
  return new TextDecoder().decode(plainBuf);
}

function packV2Payload({ saltB64, wrappedDekB64, bodyCipherB64 }) {
  const json = JSON.stringify({
    v: 2,
    s: saltB64,
    w: wrappedDekB64,
    c: bodyCipherB64
  });
  return `${NOTE_INNER_ENCRYPT_V2_PREFIX}${bytesToBase64(new TextEncoder().encode(json))}`;
}

function unpackV2Payload(bodyText) {
  const raw = String(bodyText || '');
  if (!raw.startsWith(NOTE_INNER_ENCRYPT_V2_PREFIX)) {
    throw new Error('Note is not inner-encrypted (v2)');
  }
  const packed = raw.slice(NOTE_INNER_ENCRYPT_V2_PREFIX.length);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(packed)));
  } catch {
    throw new Error('Inner encrypted note data is corrupt');
  }
  if (Number(parsed?.v) !== 2 || !parsed?.s || !parsed?.w || !parsed?.c) {
    throw new Error('Inner encrypted note data is corrupt');
  }
  return {
    saltB64: String(parsed.s),
    wrappedDekB64: String(parsed.w),
    bodyCipherB64: String(parsed.c)
  };
}

/**
 * Encrypt note body with PIN (client-only).
 * Returns { bodyText, innerPinSalt: null } — salt lives inside the opaque body blob.
 * `existingSaltBase64` is ignored for v2 (kept for call-site compatibility).
 */
export async function encryptRecordVaultNoteInnerBody(plainBody, pin, _existingSaltBase64 = null) {
  if (!isValidInnerEncryptPin(pin)) {
    throw new Error('PIN must be exactly 6 digits');
  }
  const salt = randomBytes(16);
  const saltB64 = bytesToBase64(salt);
  // Same chain as yellow Encrypt Password: PIN → KEK → wrap DEK → seal content with DEK.
  const kek = await deriveKekFromPassword(String(pin).trim(), saltB64, INNER_ENCRYPT_KDF);
  const { key: dek, raw: dekRaw } = await generateDek();
  const wrappedDekB64 = await wrapDek(dekRaw, kek);
  const bodyCipherB64 = await encryptUtf8WithKey(plainBody, dek);
  return {
    bodyText: packV2Payload({ saltB64, wrappedDekB64, bodyCipherB64 }),
    // Salt is embedded in bodyText — do not store PIN or a separate salt column.
    innerPinSalt: null
  };
}

/** Decrypt inner-layer body; wrong PIN → failure. PIN never leaves the browser. */
export async function decryptRecordVaultNoteInnerBody(encryptedBody, pin, saltBase64 = null) {
  if (!isValidInnerEncryptPin(pin)) {
    throw new Error('PIN must be exactly 6 digits');
  }
  const raw = String(encryptedBody || '');

  if (isV2InnerBody(raw)) {
    const { saltB64, wrappedDekB64, bodyCipherB64 } = unpackV2Payload(raw);
    try {
      const kek = await deriveKekFromPassword(String(pin).trim(), saltB64, INNER_ENCRYPT_KDF);
      const { key: dek } = await unwrapDek(wrappedDekB64, kek);
      return await decryptUtf8WithKey(bodyCipherB64, dek);
    } catch (err) {
      if (String(err?.message || '').includes('corrupt') || String(err?.message || '').includes('Invalid DEK')) {
        throw err;
      }
      throw new Error('Incorrect PIN for this note');
    }
  }

  // Legacy v1: PIN → key directly; salt from notes.inner_pin_salt.
  if (!raw.startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX)) {
    throw new Error('Note is not inner-encrypted');
  }
  const payloadBase64 = raw.slice(NOTE_INNER_ENCRYPT_BODY_PREFIX.length);
  const key = await deriveInnerAesKeyFromPinV1(pin, saltBase64);
  try {
    return await aesGcmDecryptV1(payloadBase64, key);
  } catch {
    throw new Error('Incorrect PIN for this note');
  }
}

/** @deprecated use encrypt/decrypt helpers — exported for older imports */
export async function deriveInnerAesKeyFromPin(pin, saltBase64) {
  return deriveInnerAesKeyFromPinV1(pin, saltBase64);
}
