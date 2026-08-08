/** Human-readable label for a FA5 object icon kebab name (not the encryption key). */
export function formatIconDisplayName(iconName) {
  const name = String(iconName ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
  if (!name) return '';
  return name
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
}
