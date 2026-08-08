export function isLegacySixDigitPassword(plain) {
  return /^\d{6}$/.test(String(plain ?? '').trim());
}

export function getPasswordRequirementChecks(password) {
  return {
    minLength: password.length >= 8,
    smallLetter: /[a-z]/.test(password),
    capitalLetter: /[A-Z]/.test(password),
    numberOrSymbol: /[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)
  };
}

export function passwordMeetsAllRequirements(password) {
  const checks = getPasswordRequirementChecks(password);
  return checks.minLength && checks.smallLetter && checks.capitalLetter && checks.numberOrSymbol;
}

export function passwordStrengthPercent(password) {
  const checks = getPasswordRequirementChecks(password);
  const met = Object.values(checks).filter(Boolean).length;
  return Math.round((met / 4) * 100);
}
