export const ADMIN_TOOLS_PATH = '/adminTools';
export const ADMIN_TOOLS_TEST_TAB = 'test';
export const ADMIN_TOOLS_LOOKUP_TAB = 'lookup';

export function adminToolsPathWithTab(tab) {
  const value = String(tab ?? '').trim();
  if (!value) return ADMIN_TOOLS_PATH;
  return `${ADMIN_TOOLS_PATH}?tab=${encodeURIComponent(value)}`;
}
