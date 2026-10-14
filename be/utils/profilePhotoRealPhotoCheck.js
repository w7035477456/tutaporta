import { detectImageLabels, detectSingleFace, getRekognitionConfig, isRekognitionConfigured } from '../lib/rekognitionClient.js';

export const PROFILE_PHOTO_AVATAR_REJECT_MESSAGE = 'Please upload your actual photo';

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
  return terms.some((term) => name.includes(term));
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

  return { isLikelyAvatar: false };
}

/**
 * Rejects illustrated / avatar profile images (Make this Profile).
 * @param {Buffer} bytes
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function validateProfilePhotoLooksReal(bytes) {
  const cfg = getRekognitionConfig();
  if (!cfg.enabled || !isRekognitionConfigured()) {
    return { ok: true };
  }

  try {
    const [labels, faceResult] = await Promise.all([
      detectImageLabels(bytes, { maxLabels: 50, minConfidence: 50 }),
      detectSingleFace(bytes)
    ]);
    const labelAssessment = assessProfilePhotoLabels(labels);
    if (labelAssessment.isLikelyAvatar) {
      console.log('[profilePhotoRealPhotoCheck] reject avatar-like image', {
        matchedLabel: labelAssessment.matchedLabel,
        confidence: labelAssessment.confidence,
        faceCount: faceResult?.faceCount ?? 0
      });
      return { ok: false, error: PROFILE_PHOTO_AVATAR_REJECT_MESSAGE };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[profilePhotoRealPhotoCheck] Rekognition check failed; allowing profile set', err?.message ?? err);
    return { ok: true };
  }
}
