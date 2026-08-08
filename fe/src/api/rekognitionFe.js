import api from './axios';

export async function fetchRekognitionStatus() {
  const { data } = await api.get('/api/rekognition/status');
  return data;
}

export async function createRekognitionLivenessSession() {
  const { data } = await api.post('/api/rekognition/liveness/session');
  return data;
}

export async function fetchRekognitionLivenessResults(sessionId) {
  const { data } = await api.get(`/api/rekognition/liveness/results/${encodeURIComponent(sessionId)}`);
  return data;
}

export async function verifyIdentityWithRekognition({
  idImage,
  driverLicenseImage,
  passportImage,
  selfieImage,
  livenessSessionId,
  consentFullName
}) {
  const { data } = await api.post(
    '/api/rekognition/verify',
    {
      ...(driverLicenseImage || idImage ? { driverLicenseImage: driverLicenseImage || idImage } : {}),
      ...(passportImage ? { passportImage } : {}),
      ...(selfieImage ? { selfieImage } : {}),
      ...(livenessSessionId ? { livenessSessionId } : {}),
      ...(consentFullName ? { consentFullName: String(consentFullName).trim() } : {})
    },
    { timeout: 120000 }
  );
  return data;
}

export async function previewFaceMatchForIdImage({ idImage }) {
  const { data } = await api.post('/api/rekognition/face-match-preview', { idImage }, { timeout: 120000 });
  return data;
}

/** Compare AWS liveness reference image to on-file profile photo (authoritative live scan match readout). */
export async function previewLiveScanProfileMatch({ livenessSessionId }) {
  const { data } = await api.post(
    '/api/rekognition/live-scan-profile-match',
    { livenessSessionId },
    { timeout: 120000 }
  );
  return data;
}

/** OCR one government ID slot and persist dl_* or pp_nationality on singles. idImage optional for admin impersonation bypass. */
export async function captureDriverLicenseFromIdImage({ idImage, documentType }) {
  const { data } = await api.post(
    '/api/rekognition/id-capture',
    {
      ...(idImage ? { idImage } : {}),
      documentType
    },
    { timeout: 120000 }
  );
  return data;
}

/** Notify support@onlinemall.website for manual ID verification review (one email per dialog session). */
export async function postIdVerificationManualSupportEmail(payload) {
  const { data } = await api.post('/api/rekognition/manual-support-email', payload, { timeout: 120000 });
  return data;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
