/**
 * TutaPhoto (photo albums) free-tier quotas from ~/.ssh/be/.env.
 *
 *   TUTAPHOTO_MAX_SIZE_IMAGE_UPLOAD_MB  per-image upload cap
 *   TUTAPHOTO_MAX_SIZE_VIDEO_UPLOAD_MB  per-video upload cap
 *   TUTAPHOTO_MAX_IMAGE_PER_ACCOUNT     total images kept per account
 *   TUTAPHOTO_MAX_VIDEO_PER_ACCOUNT     total videos kept per account
 *
 * Restart PM2 (or the Mac BE process) after changing these.
 */

export const TUTAPHOTO_QUOTA_DEFAULTS = Object.freeze({
  imageMaxMb: 20,
  videoMaxMb: 100,
  maxImagesPerAccount: 1000,
  maxVideosPerAccount: 100
});

function positiveNumber(raw, fallback, { max = 100000 } = {}) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export function tutaPhotoQuotaConfig() {
  return {
    imageMaxMb: positiveNumber(
      process.env.TUTAPHOTO_MAX_SIZE_IMAGE_UPLOAD_MB,
      TUTAPHOTO_QUOTA_DEFAULTS.imageMaxMb,
      { max: 2000 }
    ),
    videoMaxMb: positiveNumber(
      process.env.TUTAPHOTO_MAX_SIZE_VIDEO_UPLOAD_MB,
      TUTAPHOTO_QUOTA_DEFAULTS.videoMaxMb,
      { max: 2000 }
    ),
    maxImagesPerAccount: Math.floor(
      positiveNumber(
        process.env.TUTAPHOTO_MAX_IMAGE_PER_ACCOUNT,
        TUTAPHOTO_QUOTA_DEFAULTS.maxImagesPerAccount
      )
    ),
    maxVideosPerAccount: Math.floor(
      positiveNumber(
        process.env.TUTAPHOTO_MAX_VIDEO_PER_ACCOUNT,
        TUTAPHOTO_QUOTA_DEFAULTS.maxVideosPerAccount
      )
    )
  };
}

/**
 * Base64 data URLs inflate bytes by 4/3, so express.json must accept more than
 * the raw video cap or a legal upload dies as a 413 before reaching the route.
 */
export function tutaPhotoRequiredJsonLimitMb() {
  const { videoMaxMb, imageMaxMb } = tutaPhotoQuotaConfig();
  const largestMb = Math.max(videoMaxMb, imageMaxMb);
  return Math.ceil((largestMb * 4) / 3) + 8;
}
