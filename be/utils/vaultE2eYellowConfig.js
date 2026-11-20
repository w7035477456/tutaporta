/** ~/.ssh/be/.env NOTES_E2E_YELLOW — client KEK/DEK; Postgres stores salt + wrapped DEK only. */

import { isTutaNotesEncryptAllowed } from './tutaEncryptAllowed.js';

function parseEnvBool(raw, defaultValue = true) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

/** Yellow E2E path (default true). Password/KEK/DEK never on webservers. Forced off when TUTANOTES_ENCRYPT_ALLOWED=false. */
export function isVaultE2eYellow() {
  if (!isTutaNotesEncryptAllowed()) return false;
  return parseEnvBool(process.env.NOTES_E2E_YELLOW, true);
}
