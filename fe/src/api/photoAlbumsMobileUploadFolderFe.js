import api from './axios';
import { readFileAsDataUrl } from 'api/photoAlbumsFe';

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

/** POST /api/photoAlbums/mobile-upload/files — mirror phone upload into UPLOAD_FOLDER for desktop tray. */
export async function stageMobileUploadFile(file) {
  if (!file) throw new Error('Missing file');
  const dataUrl = await readFileAsDataUrl(file);
  const { data } = await api.post('/api/photoAlbums/mobile-upload/files', {
    file: dataUrl,
    file_name: file.name || 'photo.jpg'
  });
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
