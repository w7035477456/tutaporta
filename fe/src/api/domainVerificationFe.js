import api from './axios';

export async function sendDomainVerificationCode(companyEmail) {
  const { data } = await api.post('/api/domain-verification/send-code', { companyEmail });
  return data;
}

export async function verifyDomainVerificationCode(code, companyEmail) {
  const { data } = await api.post('/api/domain-verification/verify', { code, companyEmail });
  return data;
}
