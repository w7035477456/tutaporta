import { getApiBaseUrl } from 'config/apiBaseUrl';
import {
  CONSENT_DESCRIPTION_VIEW_BRIEF_BIO,
  CONSENT_DESCRIPTION_VIEW_FULL_BIO,
  CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO
} from 'constants/consentRecordVariants';
import api from './axios';

const API_BASE_URL = getApiBaseUrl();

export async function fetchConsentRecords() {
  const { data } = await api.get('/api/consent-record/list');
  return Array.isArray(data?.rows) ? data.rows : [];
}

export function formatConsentImageLinkId(mediaId) {
  const id = Number(mediaId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `VIEW_100${id}`;
}

export function formatConsentRecordViewLinkLabel(description) {
  const trimmed = String(description ?? '').trim();
  if (trimmed === CONSENT_DESCRIPTION_VIEW_BRIEF_BIO) return 'View brief Bio';
  if (trimmed === CONSENT_DESCRIPTION_VIEW_FULL_BIO) return 'View Full Bio';
  return '';
}

export function formatConsentImageLinkLabel(description, mediaId) {
  const viewLabel = formatConsentRecordViewLinkLabel(description);
  if (viewLabel) return viewLabel;
  return formatConsentImageLinkId(mediaId);
}

export function consentRecordPhotoUrl(photosId) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${API_BASE_URL}/api/photo/${id}`;
}

export function consentRecordVideoUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${API_BASE_URL}/api/video/${id}`;
}

/** Load member-owned video with auth cookies; returns a blob URL for `<video src>`. Caller must revokeObjectURL. */
export async function fetchConsentVideoObjectUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid video id');
  }

  try {
    const { data } = await api.get(`/api/video/${id}`, { responseType: 'blob' });
    if (!(data instanceof Blob)) {
      throw new Error('Video response was not a file');
    }

    if (data.type === 'application/json' || (data.size < 128 && !data.type.startsWith('video/') && !data.type.startsWith('audio/'))) {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Failed to load video');
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Failed to load video' && !parseErr.message.startsWith('Unexpected')) {
          throw parseErr;
        }
        throw new Error(text.trim() || 'Failed to load video');
      }
    }

    return URL.createObjectURL(data);
  } catch (err) {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Failed to load video');
      } catch {
        // fall through
      }
    }
    throw err;
  }
}

export function isConsentRecordVideoDescription(description) {
  return String(description ?? '').trim() === CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO;
}

/** Consent row media id for link label (videos table for live-scan video; photos for images). */
export function getConsentRecordMediaId(row) {
  if (isConsentRecordVideoDescription(row?.description)) {
    const videoId = Number(row?.consent_signature_video_fk);
    return Number.isFinite(videoId) && videoId > 0 ? videoId : null;
  }
  const photoId = Number(row?.consent_signature_image_fk);
  return Number.isFinite(photoId) && photoId > 0 ? photoId : null;
}

export function hasConsentRecordMedia(row) {
  return getConsentRecordMediaId(row) != null;
}

/** Stream URL for consent image or video row. */
export function resolveConsentRecordMediaUrl(row) {
  if (isConsentRecordVideoDescription(row?.description)) {
    return consentRecordVideoUrl(row?.consent_signature_video_fk);
  }
  return consentRecordPhotoUrl(row?.consent_signature_image_fk);
}

export async function postSaveLiveFaceScanVideoConsent({
  full_name_signed,
  viewer_approved,
  consent_video
}) {
  const response = await fetch(`${API_BASE_URL}/api/consent-record/save-live-face-scan-video`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name_signed,
      viewer_approved: Number(viewer_approved),
      consent_video
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const err = new Error(payload?.error || `Failed to save live face scan video (${response.status})`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function deleteLiveFaceScanVideoConsent() {
  const response = await fetch(`${API_BASE_URL}/api/consent-record/live-face-scan-video`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const err = new Error(payload?.error || `Failed to delete live face scan video (${response.status})`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function postSaveConsentRecord({
  full_name_signed,
  viewer_approved,
  date_signed,
  consent_signature_image,
  description,
  watermark_variant
}) {
  const response = await fetch(`${API_BASE_URL}/api/consent-record/save`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name_signed,
      viewer_approved: Number(viewer_approved),
      ...(date_signed ? { date_signed } : {}),
      ...(consent_signature_image ? { consent_signature_image } : {}),
      ...(description ? { description } : {}),
      ...(watermark_variant ? { watermark_variant } : {})
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const err = new Error(payload?.error || `Failed to save consent record (${response.status})`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}
