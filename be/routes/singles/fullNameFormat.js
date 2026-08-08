export function capitalizeNamePart(part) {
  const s = String(part ?? '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function parseFullNameParts(fullName) {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return { first: '', middle: '', last: '' };
  }
  if (parts.length === 1) {
    return { first: parts[0], middle: '', last: '' };
  }
  if (parts.length === 2) {
    return { first: parts[0], middle: '', last: parts[1] };
  }
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1]
  };
}

export function formatCapitalizedFullName(first, middle, last) {
  return [first, middle, last].map(capitalizeNamePart).filter(Boolean).join(' ');
}

export function formatCapitalizedFullNameString(fullName) {
  const { first, middle, last } = parseFullNameParts(fullName);
  return formatCapitalizedFullName(first, middle, last);
}
