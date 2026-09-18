/**
 * TutaNotes toolbar: Keep Model + RAG buttons (and related RAG chrome).
 * Source: ~/.ssh/be/.env (mirrored in fe/vite.config.mjs). Default: shown.
 */

function parseEnvBool(raw, defaultValue = true) {
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/** @returns {boolean} */
export function isRecordVaultRagUiEnabled() {
  return parseEnvBool(import.meta.env.RAG_UI_ENABLED, true);
}
