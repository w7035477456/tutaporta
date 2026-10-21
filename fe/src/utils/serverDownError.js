export const SERVER_DOWN_MESSAGE = 'Backend server and Frontend server down. Please contact admin';

function hasAppErrorBody(data) {
  return Boolean(data && typeof data === 'object' && (data.error || data.message || data.code));
}

/** True when the request never reached a live backend (network error, proxy / HAProxy gateway failure). */
export function isServerDownError(error) {
  if (!error || error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return false;
  const res = error.response;
  if (!res) return error.code === 'ERR_NETWORK' || error.message === 'Network Error';
  const headers = res.headers || {};
  const upstreamDown =
    typeof headers.get === 'function' ? headers.get('x-tuta-upstream-down') : headers['x-tuta-upstream-down'];
  if (upstreamDown || res.data?.serverDown === true) return true;
  if ([502, 503, 504].includes(res.status)) return !hasAppErrorBody(res.data);
  if (res.status === 500) {
    const data = res.data;
    return data == null || (typeof data === 'string' && !data.trim());
  }
  return false;
}

/** Rewrites the axios error so every popup shows SERVER_DOWN_MESSAGE. */
export function markServerDownError(error) {
  error.serverDown = true;
  error.message = SERVER_DOWN_MESSAGE;
  if (error.response) {
    error.response.data = { error: SERVER_DOWN_MESSAGE, serverDown: true };
  }
  return error;
}
