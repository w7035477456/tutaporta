/**
 * After sign-in, land on /mall (mall hub) — not the last app the user had open.
 * Only a few deep links (e.g. album invite) may resume their target URL.
 */

const POST_LOGIN_RESUME_PATH_PREFIXES = ['/photoAlbums/accept-invite'];

function mayResumePathAfterLogin(pathname) {
  const lower = String(pathname || '').trim().toLowerCase();
  if (!lower) return false;
  return POST_LOGIN_RESUME_PATH_PREFIXES.some((prefix) => {
    const p = prefix.toLowerCase();
    return lower === p || lower.startsWith(`${p}/`);
  });
}

/** @returns {string | { pathname: string, search?: string, hash?: string }} */
export function resolvePostLoginPath(from) {
  const pathname = String(from?.pathname || '').trim();
  if (mayResumePathAfterLogin(pathname)) {
    return {
      pathname,
      search: from.search || '',
      hash: from.hash || ''
    };
  }
  return '/mall';
}
