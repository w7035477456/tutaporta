/**
 * Self intro recorder max duration (seconds).
 * Set in ~/.ssh/be/.env — mirrored at Vite startup (fe/vite.config.mjs).
 */
const DEFAULT_SELF_INTRO_VIDEO_MAX_LENGTH_SEC = 30;

export function getSelfIntroVideoMaxLengthSeconds() {
  const raw = String(import.meta.env.SELF_INTRO_VIDEO_MAX_LENGTH ?? '').trim();
  if (!raw) return DEFAULT_SELF_INTRO_VIDEO_MAX_LENGTH_SEC;
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SELF_INTRO_VIDEO_MAX_LENGTH_SEC;
  return parsed;
}
