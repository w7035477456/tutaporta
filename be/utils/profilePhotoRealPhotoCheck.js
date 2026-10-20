import { detectImageLabels, detectSingleFace, getRekognitionConfig, isRekognitionConfigured } from '../lib/rekognitionClient.js';

export const PROFILE_PHOTO_AVATAR_REJECT_MESSAGE =
  'Please upload real photo, because momentarily, your profile must match your Driver License Photo and live facial scan to continue.';

export const PROFILE_PHOTO_NOT_REAL_CODE = 'PROFILE_PHOTO_NOT_REAL';

/**
 * Stylized avatars often score high on Person/Photography yet pick up many weak
 * "artificial" tags at once; real selfies rarely hit more than one or two.
 */
const ARTIFICIAL_CLUSTER_TERMS = new Set([
  'art',
  'drawing',
  'comics',
  'comic',
  'cartoon',
  'illustration',
  'anime',
  'animation',
  'sketch',
  'doodle',
  'clip art',
  'painting',
  'sticker',
  'stencil',
  'toy',
  'figurine',
  'doll',
  'elf',
  'mannequin',
  'graphics',
  'emoji',
  'modern art',
  'statue',
  'sculpture'
]);
const ARTIFICIAL_CLUSTER_MIN_CONFIDENCE = 50;
const ARTIFICIAL_CLUSTER_MIN_COUNT = 5;

const STRONG_AVATAR_LABEL_TERMS = [
  'cartoon',
  'illustration',
  'animation',
  'animated',
  'anime',
  'comic',
  'clip art',
  'drawing',
  'sketch',
  'vector'
];

const WEAK_AVATAR_LABEL_TERMS = ['graphic design', 'computer graphics', 'graphics', 'painting', 'art'];

function collectLabelNames(label) {
  const names = [label?.Name, ...(label?.Parents || []).map((p) => p?.Name)].filter(Boolean);
  return names.map((n) => String(n).toLowerCase());
}

function labelConfidence(label) {
  const conf = Number(label?.Confidence);
  return Number.isFinite(conf) ? conf : 0;
}

function matchesAvatarTerm(name, terms) {
  return terms.some((term) => new RegExp(`\\b${term}`).test(name));
}

/**
 * @param {import('@aws-sdk/client-rekognition').Label[]} labels
 * @returns {{ isLikelyAvatar: boolean, matchedLabel?: string, confidence?: number }}
 */
export function assessProfilePhotoLabels(labels) {
  const list = Array.isArray(labels) ? labels : [];
  const hasPhotography = list.some(
    (label) => String(label?.Name ?? '').toLowerCase() === 'photography' && labelConfidence(label) >= 55
  );

  let bestStrong = null;
  let bestWeak = null;

  for (const label of list) {
    const conf = labelConfidence(label);
    for (const name of collectLabelNames(label)) {
      if (matchesAvatarTerm(name, STRONG_AVATAR_LABEL_TERMS) && conf >= 55) {
        if (!bestStrong || conf > bestStrong.confidence) {
          bestStrong = { matchedLabel: name, confidence: conf };
        }
      }
      if (matchesAvatarTerm(name, WEAK_AVATAR_LABEL_TERMS) && conf >= 82) {
        if (!bestWeak || conf > bestWeak.confidence) {
          bestWeak = { matchedLabel: name, confidence: conf };
        }
      }
    }
  }

  if (bestStrong && !(hasPhotography && bestStrong.confidence < 70)) {
    return { isLikelyAvatar: true, ...bestStrong };
  }
  if (bestWeak && !hasPhotography) {
    return { isLikelyAvatar: true, ...bestWeak };
  }

  const artificialNames = new Set();
  for (const label of list) {
    if (labelConfidence(label) < ARTIFICIAL_CLUSTER_MIN_CONFIDENCE) continue;
    const name = String(label?.Name ?? '').toLowerCase();
    if (ARTIFICIAL_CLUSTER_TERMS.has(name)) artificialNames.add(name);
  }
  if (artificialNames.size >= ARTIFICIAL_CLUSTER_MIN_COUNT) {
    return {
      isLikelyAvatar: true,
      matchedLabel: [...artificialNames].join(','),
      confidence: ARTIFICIAL_CLUSTER_MIN_CONFIDENCE
    };
  }

  return { isLikelyAvatar: false };
}

function failClosedWhenUnavailable() {
  const raw = String(process.env.PROFILE_PHOTO_REAL_CHECK_FAIL_CLOSED ?? '').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function unavailableResult(reason) {
  if (failClosedWhenUnavailable()) {
    console.warn('[profilePhotoRealPhotoCheck] check unavailable; rejecting (fail-closed)', reason);
    return {
      ok: false,
      code: PROFILE_PHOTO_NOT_REAL_CODE,
      error: 'We could not verify your photo right now. Please try again in a minute.'
    };
  }
  console.warn('[profilePhotoRealPhotoCheck] check unavailable; allowing profile set', reason);
  return { ok: true };
}

/**
 * Rejects illustrated / avatar profile images (Make this Profile).
 * @param {Buffer} bytes
 * @returns {Promise<{ ok: true } | { ok: false, error: string, code: string }>}
 */
export async function validateProfilePhotoLooksReal(bytes) {
  const cfg = getRekognitionConfig();
  if (!cfg.enabled || !isRekognitionConfigured()) {
    return unavailableResult('rekognition disabled or not configured');
  }

  try {
    const [labels, faceResult] = await Promise.all([
      detectImageLabels(bytes, { maxLabels: 50, minConfidence: 50 }),
      detectSingleFace(bytes)
    ]);
    const faceCount = (faceResult?.faces || []).filter(
      (f) => Number(f?.Confidence) >= 90 && Number(f?.BoundingBox?.Width) >= 0.08
    ).length;
    const labelAssessment = assessProfilePhotoLabels(labels);
    if (labelAssessment.isLikelyAvatar || faceCount !== 1) {
      console.log('[profilePhotoRealPhotoCheck] reject non-real profile image', {
        matchedLabel: labelAssessment.matchedLabel,
        confidence: labelAssessment.confidence,
        faceCount
      });
      return { ok: false, code: PROFILE_PHOTO_NOT_REAL_CODE, error: PROFILE_PHOTO_AVATAR_REJECT_MESSAGE };
    }
    return { ok: true };
  } catch (err) {
    return unavailableResult(err?.message ?? err);
  }
}
