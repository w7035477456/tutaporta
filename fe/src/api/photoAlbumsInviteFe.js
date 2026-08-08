import api from './axios';
import { readPhotoAlbumsApiError } from './photoAlbumsFe';

export async function fetchPhotoAlbumsInvites({ noteId, storageType }) {
  const { data } = await api.get('/api/photoAlbums/invites', {
    params: { noteId, storageType }
  });
  return Array.isArray(data?.invites) ? data.invites : [];
}

export async function sendPhotoAlbumsInvite({
  email,
  noteId,
  notebookId,
  storageType,
  albumSetName,
  albumName
}) {
  const { data } = await api.post(
    '/api/photoAlbums/invites',
    {
      email,
      noteId,
      notebookId,
      storageType,
      albumSetName,
      albumName
    },
    { params: { storageType } }
  );
  return data;
}

export async function revokePhotoAlbumsInvite(inviteId) {
  const { data } = await api.post(`/api/photoAlbums/invites/${inviteId}/revoke`);
  return data;
}

export async function previewPhotoAlbumsInvite(token) {
  const { data } = await api.get('/api/photoAlbums/invites/preview', {
    params: { token }
  });
  return data;
}

export async function acceptPhotoAlbumsInvite(token) {
  const { data } = await api.post('/api/photoAlbums/invites/accept', { token });
  return data;
}

export async function fetchPhotoAlbumsSharedAlbums() {
  const { data } = await api.get('/api/photoAlbums/shared-albums');
  return Array.isArray(data?.sharedAlbums) ? data.sharedAlbums : [];
}

export async function fetchPhotoAlbumsSharedAlbumContent(sharedAlbumId) {
  const id = Number(sharedAlbumId);
  if (!Number.isFinite(id) || id < 1) throw new Error('Invalid shared album id');
  const { data } = await api.get(`/api/photoAlbums/shared-albums/${id}/content`);
  return data?.sharedAlbum || null;
}

export async function fetchPhotoAlbumsSharedAlbumAttachmentBlob(
  sharedAlbumId,
  attachmentId,
  { inline = true } = {}
) {
  const albumId = Number(sharedAlbumId);
  const attId = Number(attachmentId);
  if (!Number.isFinite(albumId) || albumId < 1 || !Number.isFinite(attId) || attId < 1) {
    throw new Error('Invalid shared album or attachment id');
  }
  const path = `/api/photoAlbums/shared-albums/${albumId}/attachments/${attId}`;
  const { data } = await api.get(path, {
    params: inline ? { inline: 1 } : undefined,
    responseType: 'blob'
  });
  return data;
}

export async function removePhotoAlbumsSharedAlbum(sharedAlbumId) {
  const { data } = await api.delete(`/api/photoAlbums/shared-albums/${sharedAlbumId}`);
  return data;
}

export function readPhotoAlbumsInviteError(err, fallback = 'Request failed') {
  return readPhotoAlbumsApiError(err, fallback);
}
