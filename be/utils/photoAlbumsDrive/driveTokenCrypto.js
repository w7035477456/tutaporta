import crypto from 'crypto';
import {
  fingerprintPhotoAlbumsMasterKeyRaw,
  resolvePhotoAlbumsMasterKey
} from '../photoAlbumsMasterKey.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(options = {}) {
  return resolvePhotoAlbumsMasterKey(options.masterKeyRaw);
}

export function encryptDriveRefreshToken(refreshToken, options = {}) {
  const plain = String(refreshToken ?? '').trim();
  if (!plain) return '';
  const key = resolveKey(options);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptDriveRefreshToken(encBase64, options = {}) {
  const blob = String(encBase64 ?? '').trim();
  if (!blob) return '';
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Drive token blob is corrupt or truncated');
  }
  const key = resolveKey(options);
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    if (/unsupported state|unable to authenticate data/i.test(String(err?.message || ''))) {
      const keyFp = fingerprintPhotoAlbumsMasterKeyRaw(
        options.masterKeyRaw != null
          ? options.masterKeyRaw
          : process.env.RECORD_PHOTOALBUMS_ICON_KEYS_MASTER_KEY
      );
      throw new Error(
        `Drive token AES-GCM auth failed (wrong master key or corrupt blob). ` +
          `Debug: ${JSON.stringify({
            cryptoMessage: String(err?.message || err),
            platform: process.platform,
            node: process.version,
            encCharLen: blob.length,
            encSha256Prefix16: crypto
              .createHash('sha256')
              .update(blob, 'utf8')
              .digest('hex')
              .slice(0, 16),
            masterKeyFingerprint: keyFp
          })}`
      );
    }
    throw err;
  }
}
