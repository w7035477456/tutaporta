const EMAIL_REGEX = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}\b/gi;
const PHONE_JOINER_REGEX = /^[\s().\-_/,:;+*]+$/;

const DIGIT_WORD_MAP = new Map([
  ['zero', '0'],
  ['oh', '0'],
  ['o', '0'],
  ['one', '1'],
  ['won', '1'],
  ['two', '2'],
  ['too', '2'],
  ['to', '2'],
  ['three', '3'],
  ['tree', '3'],
  ['four', '4'],
  ['for', '4'],
  ['five', '5'],
  ['six', '6'],
  ['seven', '7'],
  ['eight', '8'],
  ['ate', '8'],
  ['nine', '9']
]);

function normalizedTokenToDigits(rawToken) {
  const token = String(rawToken ?? '').trim().toLowerCase();
  if (!token) return '';
  if (/^\d+$/.test(token)) return token;
  return DIGIT_WORD_MAP.get(token) ?? '';
}

function collectPhoneRanges(text) {
  const source = String(text ?? '');
  const tokenRegex = /[a-zA-Z]+|\d+/g;
  const tokens = [];
  let match = tokenRegex.exec(source);
  while (match) {
    const token = match[0];
    tokens.push({
      start: match.index,
      end: match.index + token.length,
      digits: normalizedTokenToDigits(token)
    });
    match = tokenRegex.exec(source);
  }
  if (!tokens.length) return [];

  const ranges = [];
  let index = 0;
  while (index < tokens.length) {
    if (!tokens[index].digits) {
      index += 1;
      continue;
    }

    let endIndex = index;
    let digitCount = tokens[index].digits.length;
    while (endIndex + 1 < tokens.length) {
      const gap = source.slice(tokens[endIndex].end, tokens[endIndex + 1].start);
      if (!PHONE_JOINER_REGEX.test(gap) || !tokens[endIndex + 1].digits) break;
      endIndex += 1;
      digitCount += tokens[endIndex].digits.length;
      if (digitCount > 20) break;
    }

    // Keep likely phone-like spans only.
    if (digitCount >= 7 && digitCount <= 15) {
      ranges.push([tokens[index].start, tokens[endIndex].end]);
    }
    index = Math.max(index + 1, endIndex + 1);
  }
  return ranges;
}

function hasEmail(text) {
  const source = String(text ?? '');
  const matched = EMAIL_REGEX.test(source);
  EMAIL_REGEX.lastIndex = 0;
  return matched;
}

function hasPhone(text) {
  return collectPhoneRanges(text).length > 0;
}

export function containsPostingCommentContactInfo(text) {
  const source = String(text ?? '');
  if (!source) return false;
  return hasEmail(source) || hasPhone(source);
}

/**
 * If contact info exists (email or phone-like text), collapse entire public text.
 * Handles phone obfuscation such as "seven zero three 5-four-7 SEVEN FOUR 56".
 */
export function sanitizePostingCommentText(text) {
  const source = String(text ?? '');
  if (!source) return '';
  return containsPostingCommentContactInfo(source) ? '' : source;
}
