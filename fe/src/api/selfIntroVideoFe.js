import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { readFileAsDataUrl } from 'utils/publicVaultMediaUpload';

export function selfIntroVideoUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getApiBaseUrl()}/api/video/${id}`;
}

/** Stored JPEG thumbnail (play icon baked in on save). */
export function videoThumbnailUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getApiBaseUrl()}/api/video/${id}/thumbnail`;
}

export function videoThumbnailUrlFromPostingUrl(url) {
  const id = parseSelfIntroVideoIdFromUrl(url);
  return id ? videoThumbnailUrl(id) : '';
}

export async function fetchSelfIntroVideoSlots() {
  const { data } = await api.get('/api/self-intro-video/slots');
  return Array.isArray(data?.slots) ? data.slots : [];
}

export async function postSaveSelfIntroVideo(introVideoDataUrl, { vaultFileUpload = false } = {}) {
  const { data } = await api.post('/api/self-intro-video/save', {
    intro_video: introVideoDataUrl,
    vault_file_upload: vaultFileUpload
  });
  return data;
}

export async function uploadPublicVaultMediaFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return postSaveSelfIntroVideo(dataUrl, { vaultFileUpload: true });
}

export async function deleteSelfIntroVideoSlot(slot) {
  const { data } = await api.delete(`/api/self-intro-video/slot/${slot}`);
  return data;
}

export function isSelfIntroVideoPostingUrl(url) {
  return /\/api\/video\/\d+/i.test(String(url ?? ''));
}

export function parseSelfIntroVideoIdFromUrl(url) {
  const match = String(url ?? '').match(/\/api\/video\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
