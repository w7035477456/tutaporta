import { getApiBaseUrl } from 'config/apiBaseUrl';
import { errorMessageFromResponseBody } from 'api/apiErrorMessage';
import { readStoredSignupReferralCode } from 'utils/signupReferralCode';

const API_BASE_URL = getApiBaseUrl();

export const registerUser = async (email, phone, options = {}) => {
  const ref = options.ref ?? options.token ?? readStoredSignupReferralCode();
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      phone: phone || undefined,
      ref: ref || undefined,
      token: ref || undefined
    })
  });

  const text = await response.text();

  if (!response.ok) {
    const message = errorMessageFromResponseBody(text, response.status, {
      fallback: `Registration failed (${response.status}).`,
      context: 'registration',
      htmlFallback:
        `The server returned a web page instead of the registration API (HTTP ${response.status}). ` +
        'Usually this means nginx is not forwarding /api/register to the Node backend, or the app is down. ' +
        'On the server, confirm the API process is running and proxy /api to it.'
    });
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server.');
  }
  return data;
};
