/**
 * Normalize login input as email or US phone (+1XXXXXXXXXX).
 * @param {unknown} raw
 * @returns {{ type: 'email' | 'phone', value: string } | null}
 */
export function normalizeLoginIdentifier(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return { type: 'email', value: trimmed.toLowerCase() };
  }

  const digits = trimmed.replace(/\D/g, '');
  const looksLikePhone = /^[\d\s().+-]+$/.test(trimmed);

  if (looksLikePhone && digits.length > 0) {
    let ten = null;
    if (digits.length === 10) ten = digits;
    else if (digits.length === 11 && digits.startsWith('1')) ten = digits.slice(1);
    if (ten) return { type: 'phone', value: `+1${ten}` };
    return null;
  }

  return { type: 'email', value: trimmed.toLowerCase() };
}
