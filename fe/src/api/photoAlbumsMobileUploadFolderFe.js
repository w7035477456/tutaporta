import api from './axios';
import { readFileAsDataUrl } from 'api/photoAlbumsFe';
import { requireMobileUploadProduct } from 'constants/mobileUploadProduct';

function productQuery(product) {
  return { product: requireMobileUploadProduct(product) };
}

/** GET /api/photoAlbums/mobile-upload/files?product=… */
export async function listMobileUploadFiles(product) {
  const { data } = await api.get('/api/photoAlbums/mobile-upload/files', {
    params: productQuery(product)
  });
  return Array.isArray(data?.files) ? data.files : [];
}

/** GET /api/photoAlbums/mobile-upload/files/:fileName → Blob */
export async function fetchMobileUploadFileBlob(fileName, product) {
  const name = String(fileName ?? '').trim();
  if (!name) throw new Error('Missing file name');
  const params = product ? productQuery(product) : undefined;
  const { data } = await api.get(
    `/api/photoAlbums/mobile-upload/files/${encodeURIComponent(name)}`,
    { responseType: 'blob', params }
  );
  return data;
}

/** POST /api/photoAlbums/mobile-upload/files — mirror phone upload into UPLOAD_FOLDER for one product tray. */
export async function stageMobileUploadFile(file, product) {
  if (!file) throw new Error('Missing file');
  const safeProduct = requireMobileUploadProduct(product);
  const dataUrl = await readFileAsDataUrl(file);
  const { data } = await api.post('/api/photoAlbums/mobile-upload/files', {
    file: dataUrl,
    file_name: file.name || 'photo.jpg',
    product: safeProduct
  });
  return data;
}

/** DELETE /api/photoAlbums/mobile-upload/files/:fileName?product=… */
export async function deleteMobileUploadFile(fileName, product) {
  const name = String(fileName ?? '').trim();
  if (!name) throw new Error('Missing file name');
  const { data } = await api.delete(
    `/api/photoAlbums/mobile-upload/files/${encodeURIComponent(name)}`,
    { params: productQuery(product) }
  );
  return data;
}
