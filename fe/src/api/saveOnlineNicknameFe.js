import api from './axios';
import { ALIAS_ALNUM_ONLY_MESSAGE, isValidAliasFormat, formatAliasTakenMessage } from 'utils/aliasValidation';

export { ALIAS_ALNUM_ONLY_MESSAGE, isValidAliasFormat, formatAliasTakenMessage };

const SAVE_FAILED_MESSAGE = 'Failed to save nickname. Please try again.';

function mapNicknameSaveError(err) {
  const status = err?.response?.status;
  const serverError = err?.response?.data?.error;
  if (serverError && serverError !== 'Authentication required') {
    return serverError;
  }
  if (status === 409) {
    return serverError || formatAliasTakenMessage('');
  }
  if (status === 401 || status === 403) {
    if (err?.response?.data?.sessionInvalid === true) {
      return err?.response?.data?.error || 'Error: Please login again. If error persists, please contact admin (email support, orange icon lower right).';
    }
    return serverError || 'Please sign out and sign back in, then try Save again.';
  }
  if (status === 400) {
    return serverError || SAVE_FAILED_MESSAGE;
  }
  return err?.message || SAVE_FAILED_MESSAGE;
}

/**
 * Save nickname: server checks singles.alias for duplicates, then updates helloworldjunktest.singles.alias.
 * Requires the same login session cookie as the rest of My Story (no extra auth step).
 */
export async function saveOnlineNickname(aliasValue) {
  try {
    const { data } = await api.post('/api/settings/nickname', {
      alias: aliasValue
    });
    return data;
  } catch (err) {
    const msg = mapNicknameSaveError(err);
    const wrapped = new Error(msg);
    wrapped.response = err?.response;
    throw wrapped;
  }
}
