/** Parse boolean_enum ('true' / 'false') or legacy boolean from API/DB. */
export function parseBooleanEnumRaw(raw) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === 't' || s === 'yes' || s === '1';
}
