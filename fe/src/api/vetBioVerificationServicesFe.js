import api from './axios';

export async function fetchVetBioVerificationServices() {
  const { data } = await api.get('/api/vet-bio/verification-services');
  return data;
}

export async function patchVetBioVerificationServices(payload) {
  const { data } = await api.patch('/api/vet-bio/verification-services', payload);
  return data;
}

/** Reset vet_bio.id_verification to notstarted (profile photo change). */
export async function resetIdVerification() {
  const { data } = await api.post('/api/vet-bio/reset-id-verification');
  return data;
}

/** Called when Identification Verification dialog closes (before dismiss). */
export async function postIdVerificationDateOnClose({ verificationComplete }) {
  const { data } = await api.post('/api/vet-bio/id-verification-date-on-close', { verificationComplete });
  return data;
}
