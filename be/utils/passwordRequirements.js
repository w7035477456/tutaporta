/**
 * Shared password rules for signup, legacy upgrade, and settings change-password.
 */
export function isLegacySixDigitPassword(plain) {
  return /^\d{6}$/.test(String(plain ?? '').trim());
}

export function validateNewPasswordRequirements(plain) {
  const password = typeof plain === 'string' ? plain : '';
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: 'Password must include at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: 'Password must include at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(password) && !/[^a-zA-Z0-9]/.test(password)) {
    return { ok: false, error: 'Password must include at least one number or symbol.' };
  }
  if (isLegacySixDigitPassword(password)) {
    return { ok: false, error: 'Please choose a stronger password than a 6-digit code.' };
  }
  return { ok: true };
}
