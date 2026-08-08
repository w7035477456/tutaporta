import api from './axios';

/** GET /api/photoAlbums/mobile-upload/files */
export async function listMobileUploadFiles() {
  const { data } = await api.get('/api/photoAlbums/mobile-upload/files');
  return Array.isArray(data?.files) ? data.files : [];
}

/** GET /api/photoAlbums/mobile-upload/files/:fileName → Blob */
export async function fetchMobileUploadFileBlob(fileName) {
  const name = String(fileName ?? '').trim();
  if (!name) throw new Error('Missing file name');
  const { data } = await api.get(
    `/api/photoAlbums/mobile-upload/files/${encodeURIComponent(name)}`,
    { responseType: 'blob' }
  );
  return data;
}

/** DELETE /api/photoAlbums/mobile-upload/files/:fileName */
export async function deleteMobileUploadFile(fileName) {
  const name = String(fileName ?? '').trim();
  if (!name) throw new Error('Missing file name');
  const { data } = await api.delete(
    `/api/photoAlbums/mobile-upload/files/${encodeURIComponent(name)}`
  );
  return data;
}
