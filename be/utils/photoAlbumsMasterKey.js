import crypto from 'crypto';

const KEY_LEN = 32;

/**
 * Safe debug fingerprint for a master-key string (never logs the raw key).
 * Includes length, whitespace/control hints, and how resolvePhotoAlbumsMasterKey would derive bytes.
 */
export function fingerprintPhotoAlbumsMasterKeyRaw(raw) {
  const original = raw == null ? '' : String(raw);
  const value = original.trim();
  const bytes = Buffer.from(original, 'utf8');
  const hasCr = original.includes('\r');
  const hasLf = original.includes('\n');
  const hasNul = original.includes('\0');
  const leadingWs = original.length > 0 && /^\s/.test(original);
  const trailingWs = original.length > 0 && /\s$/.test(original);
  let decodePath = 'sha256-passphrase';
  let decodedLen = null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    decodedLen = decoded.length;
    if (decoded.length === KEY_LEN) {
      decodePath = 'base64url-32';
    }
  } catch {
    decodePath = 'base64url-throw→sha256';
  }
  let derivedFp = null;
  try {
    const derived = resolvePhotoAlbumsMasterKey(value);
    derivedFp = crypto.createHash('sha256').update(derived).digest('hex').slice(0, 16);
  } catch (err) {
    derivedFp = `error:${err?.message || err}`;
  }
  return {
    charLen: value.length,
    utf8ByteLen: Buffer.from(value, 'utf8').length,
    rawUtf8ByteLenBeforeTrim: bytes.length,
    sha256OfRawUtf8Prefix16: value
      ? crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16)
      : '(empty)',
    decodePath,
    base64urlDecodedLen: decodedLen,
    derivedKeySha256Prefix16: derivedFp,
    hasCr,
    hasLf,
    hasNul,
    leadingWs,
    trailingWs,
    first3Chars: value.slice(0, 3),
    last3Chars: value.slice(-3)
  };
}

/** Resolve 32-byte AES key from base64url or passphrase (SHA-256). */
export function resolvePhotoAlbumsMasterKey(raw) {
  const value =
    raw != null
      ? String(raw).trim()
      : String(process.env.RECORD_PHOTOALBUMS_ICON_KEYS_MASTER_KEY ?? '').trim();
  if (!value) {
    throw new Error('RECORD_PHOTOALBUMS_ICON_KEYS_MASTER_KEY is not configured');
  }
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length === KEY_LEN) {
      return decoded;
    }
  } catch {
    // fall through to SHA-256 derivation for long passphrases
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}
