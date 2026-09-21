/** Staging buckets under UPLOAD_FOLDER — one per TutaMall product. */
export const MOBILE_UPLOAD_PRODUCT_TUTAPHOTO = 'tutaphoto';
export const MOBILE_UPLOAD_PRODUCT_TUTANOTES = 'tutanotes';
export const MOBILE_UPLOAD_PRODUCT_TUTADATES = 'tutadates';

export const MOBILE_UPLOAD_PRODUCTS = [
  MOBILE_UPLOAD_PRODUCT_TUTAPHOTO,
  MOBILE_UPLOAD_PRODUCT_TUTANOTES,
  MOBILE_UPLOAD_PRODUCT_TUTADATES
];

export function normalizeMobileUploadProduct(raw) {
  const p = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (
    p === MOBILE_UPLOAD_PRODUCT_TUTAPHOTO ||
    p === 'photo_albums' ||
    p === 'photoalbums' ||
    p === 'photos' ||
    p === 'albums'
  ) {
    return MOBILE_UPLOAD_PRODUCT_TUTAPHOTO;
  }
  if (
    p === MOBILE_UPLOAD_PRODUCT_TUTANOTES ||
    p === 'notes' ||
    p === 'record_vault' ||
    p === 'recordvault'
  ) {
    return MOBILE_UPLOAD_PRODUCT_TUTANOTES;
  }
  if (p === MOBILE_UPLOAD_PRODUCT_TUTADATES || p === 'dates' || p === 'mystory' || p === 'my_story') {
    return MOBILE_UPLOAD_PRODUCT_TUTADATES;
  }
  return '';
}

export function requireMobileUploadProduct(raw) {
  const product = normalizeMobileUploadProduct(raw);
  if (!product) {
    throw new Error(
      `Invalid mobile upload product. Use one of: ${MOBILE_UPLOAD_PRODUCTS.join(', ')}`
    );
  }
  return product;
}
