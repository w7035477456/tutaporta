import { getApiBaseUrl } from 'config/apiBaseUrl';
import { errorMessageFromResponseBody } from 'api/apiErrorMessage';

const API_BASE_URL = getApiBaseUrl();

export const sendRegistrationSms = async (code, email, phone, options = {}) => {
  const signupToken = String(options.signupToken || '').trim();
  const body = { email, phone };
  if (signupToken) body.signupToken = signupToken;
  else body.code = code;

  const response = await fetch(`${API_BASE_URL}/api/sendRegistrationSms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      errorMessageFromResponseBody(text, response.status, {
        fallback: `Failed to send SMS (${response.status}).`,
        context: 'SMS verification'
      })
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    return { success: true };
  }
};
