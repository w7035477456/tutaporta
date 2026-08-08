import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

/**
 * Read-only check that email + registration code match an unused, non-expired row.
 */
export async function verifyRegistrationLink(email, code) {
  const params = new URLSearchParams();
  params.set('email', email);
  params.set('code', code);
  const response = await fetch(`${API_BASE_URL}/api/verifyRegistrationLink?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { valid: Boolean(data.valid) };
}
