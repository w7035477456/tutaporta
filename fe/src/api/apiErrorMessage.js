function looksLikeHtmlResponse(text) {
  const raw = String(text ?? '').trim();
  return (
    raw.startsWith('<!DOCTYPE') ||
    raw.startsWith('<html') ||
    /<title>[\s\S]*<\/title>/i.test(raw)
  );
}

/**
 * Turn a non-OK fetch body into a user-safe error string (never raw HTML).
 */
export function errorMessageFromResponseBody(text, status, options = {}) {
  const raw = String(text ?? '').trim();
  const fallback = options.fallback || `Request failed (${status}).`;

  if (!raw) {
    return fallback;
  }

  if (looksLikeHtmlResponse(raw)) {
    if (options.htmlFallback) return options.htmlFallback;
    const context = options.context || 'this request';
    return (
      `We're temporarily unable to complete ${context} (HTTP ${status}). ` +
      'Please try again in a few minutes.'
    );
  }

  try {
    const data = JSON.parse(raw);
    if (data.details) {
      return `${data.error || 'Error'}: ${data.details}`;
    }
    return data.error || data.message || data.details || fallback;
  } catch {
    return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
  }
}

export async function readFetchError(response, options = {}) {
  const text = await response.text();
  return errorMessageFromResponseBody(text, response.status, options);
}
