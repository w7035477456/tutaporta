import { isAdminSession, isToolsOnlyAdminSession } from 'utils/adminSession';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';

/** Global admin login (`admin`) may open these app routes (not only Tools). */
export const TOOLS_ONLY_ADMIN_ALLOWED_PATHS = [ADMIN_TOOLS_PATH, '/allSingles'];

export function isToolsOnlyAdminAllowedPath(pathname) {
  const path = String(pathname ?? '');
  return TOOLS_ONLY_ADMIN_ALLOWED_PATHS.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
}

/** Auth screens where signed-in chrome must not show (brief session overlap on login routes). */
export function isPreLoginAuthRoute(pathname) {
  const path = String(pathname ?? '');
  if (!path) return false;
  const prefixes = [
    '/pages/login',
    '/register',
    '/pages/register',
    '/claimtoken',
    '/entertoken',
    '/verifyemail',
    '/pages/loginFailure',
    '/pages/forgotPassword',
    '/pages/passwordResetSent',
    '/pages/resetPassword',
    '/pages/createPassword',
    '/createPassword'
  ];
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True when the Tools sidebar item should show (Admin JWT only). */
export function isToolsMenuVisible({ hasUser = true, pathname, user } = {}) {
  if (!hasUser) return false;
  if (pathname && isPreLoginAuthRoute(pathname)) return false;
  return isAdminSession(user);
}

/** True when sidebar should show only the Tools item (global admin login). */
export function isToolsOnlyMenuSession({ hasUser = true, pathname, user } = {}) {
  if (!hasUser || !isToolsOnlyAdminSession(user)) return false;
  if (pathname && isPreLoginAuthRoute(pathname)) return false;
  return true;
}
