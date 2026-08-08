/**
 * myNote menu button default label size (rem).
 * Set in ~/.ssh/be/.env — mirrored at Vite startup (fe/vite.config.mjs).
 */
const DEFAULT_VAULT_BUTTON_FONT_SIZE_REM = 2;

export function getVaultDefaultButtonFontSizeRem() {
  const raw = String(import.meta.env.NOTES_DEFAULT_BUTTON_FONT_SIZE_REM ?? '').trim();
  if (!raw) return DEFAULT_VAULT_BUTTON_FONT_SIZE_REM;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_VAULT_BUTTON_FONT_SIZE_REM;
  return Math.min(parsed, 8);
}
