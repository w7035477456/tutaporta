/**
 * Normalize login input as email, US phone (+1XXXXXXXXXX) or member code.
 * Member code: "M3902787" (M + digits, any case) or bare digits that are not a 10/11-digit phone.
 * @param {unknown} raw
 * @returns {{ type: 'email' | 'phone' | 'member_id', value: string } | null}
 */
export function normalizeLoginIdentifier(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return { type: 'email', value: trimmed.toLowerCase() };
  }

  const memberCode = /^m\s*-?\s*(\d{1,12})$/i.exec(trimmed);
  if (memberCode) return { type: 'member_id', value: String(BigInt(memberCode[1])) };

  const digits = trimmed.replace(/\D/g, '');
  const looksLikePhone = /^[\d\s().+-]+$/.test(trimmed);

  if (looksLikePhone && digits.length > 0) {
    let ten = null;
    if (digits.length === 10) ten = digits;
    else if (digits.length === 11 && digits.startsWith('1')) ten = digits.slice(1);
    if (ten) return { type: 'phone', value: `+1${ten}` };
    // Bare member number (e.g. 3902787): plain digits only, not a phone length.
    if (/^\d{1,9}$/.test(trimmed)) return { type: 'member_id', value: String(BigInt(trimmed)) };
    return null;
  }

  return { type: 'email', value: trimmed.toLowerCase() };
}
