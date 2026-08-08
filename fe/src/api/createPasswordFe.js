import { getApiBaseUrl } from 'config/apiBaseUrl';
import { readFetchError } from 'api/apiErrorMessage';

const API_BASE_URL = getApiBaseUrl();

export const createPassword = async (code, email, password, phone, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/createPassword`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code,
        email,
        password,
        phone,
        sendSms: options.sendSms,
        referByCode: options.referByCode
      })
    });

    if (!response.ok) {
      throw new Error(
        await readFetchError(response, {
          fallback: 'Failed to create password.',
          context: 'account setup'
        })
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating password:', error);
    throw error;
  }
};
