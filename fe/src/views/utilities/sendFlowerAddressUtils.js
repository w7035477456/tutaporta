export const EMPTY_SEND_FROM_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  zip: '',
  country: ''
};

export function splitFullName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/);
  if (parts.length <= 1) return { firstName: raw, lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join(' ')
  };
}

export function sendFromFormFromAddress(addr) {
  const { firstName, lastName } = splitFullName(addr?.full_name);
  return {
    firstName,
    lastName,
    email: String(addr?.email || ''),
    phone: String(addr?.phone || ''),
    street: String(addr?.street || ''),
    city: String(addr?.city || ''),
    zip: String(addr?.zip || ''),
    country: String(addr?.country || '')
  };
}

export function buildSendFromAddressPayload(form) {
  const firstName = String(form.firstName || '').trim();
  const lastName = String(form.lastName || '').trim();
  return {
    first_name: firstName,
    last_name: lastName,
    full_name: [firstName, lastName].filter(Boolean).join(' ') || null,
    street: String(form.street || '').trim(),
    city: String(form.city || '').trim(),
    zip: String(form.zip || '').trim(),
    country: String(form.country || '').trim(),
    email: String(form.email || '').trim(),
    phone: String(form.phone || '').trim()
  };
}

export function validateSendFromForm(form) {
  const payload = buildSendFromAddressPayload(form);
  const missing = [];
  if (!payload.full_name) missing.push('name');
  if (!payload.street) missing.push('street');
  if (!payload.city) missing.push('city');
  if (!payload.zip) missing.push('zip');
  if (!payload.country) missing.push('country');
  if (!payload.phone) missing.push('phone');
  if (missing.length) {
    return `Send from address is incomplete: ${missing.join(', ')}`;
  }
  return null;
}
