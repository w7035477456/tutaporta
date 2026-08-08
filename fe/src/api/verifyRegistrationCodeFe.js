import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

/**
 * Verify registration email code entered on /verifyemail (no email required).
 */
export async function verifyRegistrationCode(code) {
  const response = await fetch(`${API_BASE_URL}/api/verifyRegistrationCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: String(code ?? '').trim().toUpperCase() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify code.');
  }
  return data;
}
