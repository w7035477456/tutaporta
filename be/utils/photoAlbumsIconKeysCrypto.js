import crypto from 'crypto';
import {
  fingerprintPhotoAlbumsMasterKeyRaw,
  resolvePhotoAlbumsMasterKey
} from './photoAlbumsMasterKey.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(options = {}) {
  return resolvePhotoAlbumsMasterKey(options.masterKeyRaw);
}

/** Safe fingerprint of an encrypted icon-keys blob (no plaintext). */
export function fingerprintPhotoAlbumsIconKeysEncBlob(encBase64) {
  const original = encBase64 == null ? '' : String(encBase64);
  const blob = original.trim();
  let buf;
  try {
    buf = Buffer.from(blob, 'base64');
  } catch (err) {
    return {
      charLen: blob.length,
      base64DecodeOk: false,
      decodeError: String(err?.message || err)
    };
  }
  return {
    charLen: blob.length,
    rawCharLenBeforeTrim: original.length,
    leadingWs: original.length > 0 && /^\s/.test(original),
    trailingWs: original.length > 0 && /\s$/.test(original),
    hasCr: original.includes('\r'),
    hasLf: original.includes('\n'),
    base64DecodeOk: true,
    decodedByteLen: buf.length,
    minExpectedByteLen: IV_LEN + TAG_LEN + 1,
    sha256OfDecodedPrefix16: buf.length
      ? crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
      : '(empty)',
    ivHex: buf.length >= IV_LEN ? buf.subarray(0, IV_LEN).toString('hex') : null,
    tagHexPrefix8: buf.length >= IV_LEN + 4 ? buf.subarray(IV_LEN, IV_LEN + 4).toString('hex') : null,
    first8Base64Chars: blob.slice(0, 8),
    last8Base64Chars: blob.slice(-8)
  };
}

/** Encrypt icon-name -> secret map; returns base64(iv || tag || ciphertext). */
export function encryptPhotoAlbumsIconKeyMap(map, options = {}) {
  const key = resolveKey(options);
  const plain = Buffer.from(JSON.stringify(map), 'utf8');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt base64 blob back to icon-name -> secret map. */
export function decryptPhotoAlbumsIconKeyMap(encBase64, options = {}) {
  const blob = String(encBase64 ?? '').trim();
  if (!blob) {
    throw new Error('Record Vault icon keys are not seeded (encrypted blob is empty)');
  }
  const blobFp = fingerprintPhotoAlbumsIconKeysEncBlob(encBase64);
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error(
      `Record Vault icon keys blob is corrupt or truncated: ${JSON.stringify(blobFp)}`
    );
  }
  const key = resolveKey(options);
  const keyFp = fingerprintPhotoAlbumsMasterKeyRaw(
    options.masterKeyRaw != null
      ? options.masterKeyRaw
      : process.env.RECORD_PHOTOALBUMS_ICON_KEYS_MASTER_KEY
  );
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    if (/unsupported state|unable to authenticate data/i.test(String(err?.message || ''))) {
      const detail = {
        cryptoMessage: String(err?.message || err),
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        openssl: process.versions?.openssl ?? '(unknown)',
        masterKeyFingerprint: keyFp,
        encBlobFingerprint: blobFp
      };
      throw new Error(
        'Record Vault icon keys cannot be decrypted (AES-GCM auth tag mismatch — wrong master key for this ciphertext, or corrupt blob). ' +
          'This is not a Mac/Ubuntu filesystem difference for the blob itself: the ciphertext comes from Postgres. ' +
          `Debug: ${JSON.stringify(detail)}`
      );
    }
    throw err;
  }
  const parsed = JSON.parse(plain);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Decrypted Record Vault icon keys are not a valid map');
  }
  return parsed;
}
