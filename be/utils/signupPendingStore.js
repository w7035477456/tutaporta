import {
  clusterRedisDel,
  clusterRedisGetJson,
  clusterRedisSetJson,
  clusterRedisTakeRaw
} from './clusterRedisState.js';

export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
const TOKEN_TTL_SEC = Math.ceil(TOKEN_EXPIRY_MS / 1000);
const PENDING_VERIFY_TTL_SEC = 60 * 60;

const CREATE_PASSWORD_PREFIX = 'v1:signup:create_password:';
const PENDING_VERIFY_PREFIX = 'v1:signup:pending_verify:';

function createPasswordKey(token) {
  return `${CREATE_PASSWORD_PREFIX}${String(token || '').trim()}`;
}

function pendingVerifyKey(email, phone) {
  return `${PENDING_VERIFY_PREFIX}${String(email || '').trim().toLowerCase()}_${String(phone || '').trim()}`;
}

export async function storeCreatePasswordToken(token, email, expiresAt) {
  const key = createPasswordKey(token);
  await clusterRedisSetJson(key, { email, expiresAt }, TOKEN_TTL_SEC);
}

export async function consumeCreatePasswordToken(token) {
  const key = createPasswordKey(token);
  // GETDEL when available so two round-robin nodes cannot both consume the same token.
  const raw = await clusterRedisTakeRaw(key);
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getCreatePasswordToken(token) {
  return clusterRedisGetJson(createPasswordKey(token));
}

export async function deleteCreatePasswordToken(token) {
  await clusterRedisDel(createPasswordKey(token));
}

export async function storePendingVerification(email, phone, data) {
  const key = pendingVerifyKey(email, phone);
  await clusterRedisSetJson(key, data, PENDING_VERIFY_TTL_SEC);
}

export async function getPendingVerification(email, phone) {
  return clusterRedisGetJson(pendingVerifyKey(email, phone));
}

export async function deletePendingVerification(email, phone) {
  await clusterRedisDel(pendingVerifyKey(email, phone));
}
