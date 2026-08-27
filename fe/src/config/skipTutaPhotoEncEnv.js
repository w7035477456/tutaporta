/**
 * SKIP_TUTAPHOTO_ENC — skip Full Disk Encryption for TutaPhotoAlbums only.
 * Build-time: mirrored from ~/.ssh/be/.env via vite.config.mjs.
 * Runtime (authoritative): GET /api/publicConfig.skipTutaPhotoEnc.
 * TutaNotes never honors this flag.
 */

function parseEnvBool(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export function isSkipTutaPhotoEncFromVite() {
  return (
    parseEnvBool(import.meta.env.SKIP_TUTAPHOTO_ENC) ||
    parseEnvBool(import.meta.env.VITE_SKIP_TUTAPHOTO_ENC)
  );
}
