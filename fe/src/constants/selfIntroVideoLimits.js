/** Self intro video library — slot count and per-file size cap (matches BE save route). */
export const SELF_INTRO_VIDEO_SLOT_MAX = 3;
export const SELF_INTRO_VIDEO_MAX_MB = 30;
export const SELF_INTRO_VIDEO_MAX_BYTES = SELF_INTRO_VIDEO_MAX_MB * 1024 * 1024;

/** Public Video Vault file upload (MyStory drag-drop / UPLOAD) — 10 MB cap. */
export const PUBLIC_VAULT_UPLOAD_MAX_MB = 10;
export const PUBLIC_VAULT_UPLOAD_MAX_BYTES = PUBLIC_VAULT_UPLOAD_MAX_MB * 1024 * 1024;

export const SELF_INTRO_VIDEO_LIMITS_MESSAGE =
  'We allow up to 3 videos or audio clips in Public Video Vault. Record up to 30 MB each, or upload .mp3/.mp4/.webm/.mov/.avi/.wmv up to 10 MB each.';
