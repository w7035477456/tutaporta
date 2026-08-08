import { getApiBaseUrl } from 'config/apiBaseUrl';
import { readFetchError } from 'api/apiErrorMessage';

const API_BASE_URL = getApiBaseUrl();

/** Dev/staging only when BE BY_PASS_SMS_PHONE_VERIFICATION=true */
export const bypassSignupSmsVerification = async (code, email, phone) => {
  const response = await fetch(`${API_BASE_URL}/api/signup/bypass-sms-phone-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, email, phone })
  });
  if (!response.ok) {
    throw new Error(
      await readFetchError(response, {
        fallback: 'Failed to bypass SMS verification.',
        context: 'phone verification'
      })
    );
  }
  return response.json();
};
