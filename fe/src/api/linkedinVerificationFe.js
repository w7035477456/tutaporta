import api from 'api/axios';

export async function fetchLinkedInStatus() {
  const { data } = await api.get('/api/linkedin/status');
  return data;
}

/** Save the member-entered LinkedIn profile URL to vet_bio.linkedin_url (no OAuth). */
export async function saveLinkedInProfileUrl(profileUrl) {
  const { data } = await api.post('/api/linkedin/save-url', { profileUrl: String(profileUrl || '').trim() });
  return data;
}

/** Save self-reported job title and employer from the LinkedIn popup (manual entry, not started). */
export async function saveSelfReportedEmployment({ jobTitle = '', currentCompany = '' } = {}) {
  const { data } = await api.post('/api/linkedin/save-employment', {
    jobTitle: String(jobTitle || '').trim(),
    currentCompany: String(currentCompany || '').trim()
  });
  return data;
}
