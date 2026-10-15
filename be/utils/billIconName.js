/** Bill Schedule row icon (security icon set name, e.g. 'car') → stored value, or null for "?". */
export function normalizeBillIcon(raw) {
  const name = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
  return /^[a-z0-9-]{1,64}$/.test(name) ? name : null;
}
