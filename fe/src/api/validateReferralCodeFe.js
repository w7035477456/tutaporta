import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

/** @returns {Promise<{ present: boolean, valid: boolean, code?: string, referrerAlias?: string|null, referrerMemberCode?: string|null }>} */
export async function validateReferralCode(ref) {
  const params = new URLSearchParams({ ref: String(ref ?? '') });
  const response = await fetch(`${API_BASE_URL}/api/public/validateReferralCode?${params}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to validate referral code.');
  }

  return response.json();
}
