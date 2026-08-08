export const CONSENT_WATERMARK_VARIANTS = {
  checkr_check: {
    titleLine: 'Self-Report-Biography',
    strokeColor: '#0066ff',
    strokeWidthRatio: 0.04,
    description: 'Self-Report-Biography'
  },
  request_about_me: {
    titleLine: 'Viewing Consent',
    strokeColor: '#ff0000',
    strokeWidthRatio: 0.04,
    description: 'Viewing Consent'
  },
  identification_verification: {
    titleLine: 'Live scan and Gov Id and Profile cross reference',
    strokeColor: '#ff0000',
    strokeWidthRatio: 0.04,
    description: 'Live scan and Gov Id and Profile cross reference'
  },
  view_brief_bio: {
    titleLine: 'View Brief Bio',
    strokeColor: '#ff0000',
    strokeWidthRatio: 0.04,
    description: 'View Brief Bio'
  },
  view_full_bio: {
    titleLine: 'View Full Bio',
    strokeColor: '#ff0000',
    strokeWidthRatio: 0.04,
    description: 'View Full Bio'
  }
};

export const CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO = 'Live Face Scan fallback video';

export const CONSENT_RECORD_DESCRIPTION = 'Self-Report-Biography';

export function resolveConsentWatermarkVariant(variantKey) {
  const key = String(variantKey ?? '').trim();
  return CONSENT_WATERMARK_VARIANTS[key] || CONSENT_WATERMARK_VARIANTS.request_about_me;
}

export function resolveConsentDescription(variantKey, explicitDescription) {
  const trimmed = String(explicitDescription ?? '').trim();
  if (trimmed) return trimmed;
  return resolveConsentWatermarkVariant(variantKey).description || CONSENT_RECORD_DESCRIPTION;
}
