import { getApiBaseUrl } from 'config/apiBaseUrl';
import { readFetchError } from 'api/apiErrorMessage';

const API_BASE_URL = getApiBaseUrl();

export const verifyPhone = async (email, phone, verificationCode, options = {}) => {
  try {
    // Ensure code is sent as a 6-digit string (no spaces, no type coercion to number)
    const code = String(verificationCode ?? '').replace(/\D/g, '').slice(0, 6);
    const response = await fetch(`${API_BASE_URL}/api/verifyPhone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        phone,
        verificationCode: code,
        referByCode: options.referByCode
      })
    });

    if (!response.ok) {
      throw new Error(
        await readFetchError(response, {
          fallback: 'Phone verification failed.',
          context: 'phone verification'
        })
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying phone:', error);
    throw error;
  }
};

export const resendPhoneCode = async (email, phone) => {
  const response = await fetch(`${API_BASE_URL}/api/resendPhoneCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone })
  });
  if (!response.ok) {
    throw new Error(
      await readFetchError(response, {
        fallback: 'Failed to resend code.',
        context: 'SMS verification'
      })
    );
  }
  return response.json();
};

export const cleanupVerificationsByEmail = async (email) => {
  const response = await fetch(`${API_BASE_URL}/api/cleanupVerificationsByEmail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    throw new Error(
      await readFetchError(response, {
        fallback: 'Failed to cleanup verification rows.',
        context: 'verification cleanup'
      })
    );
  }
  return response.json();
};
