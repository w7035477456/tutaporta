import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

export async function verifyPasswordResetLink(email, code) {
  const params = new URLSearchParams();
  params.set('email', email);
  params.set('code', code);
  const response = await fetch(`${API_BASE_URL}/api/verifyPasswordResetLink?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { valid: Boolean(data.valid) };
}
