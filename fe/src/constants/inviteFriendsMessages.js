/** Post FB + Refer Email — body templates loaded from global.promotional_array; promo footer stays in code. */
export const INVITE_FRIENDS_MESSAGE_PROMO_FOOTER =
  "Get a free token to spend at the site, worth $10, when you sign up! (Learn how to earn more tokens on the site.) This promotion ends soon, so claim yours here: [Link]\n\nAlternatively, if you don't feel safe with links, then go directly to https://tutamall.com/entertoken and enter code [Code].";

export function formatInviteFriendsPromoFooter(referralUrl, referCode) {
  const code = String(referCode ?? '').trim();
  return INVITE_FRIENDS_MESSAGE_PROMO_FOOTER.replace(/\[Link\]/gi, referralUrl).replace(/\[Code\]/gi, code);
}

/**
 * @param {string[]} templates
 * @param {number|null} excludeIndex — when picking another, avoid repeating the same template if possible
 */
export function pickRandomInviteFriendsTemplateIndex(templates, excludeIndex = null) {
  const count = Array.isArray(templates) ? templates.length : 0;
  if (count <= 0) return 0;
  if (count === 1) return 0;
  let idx = Math.floor(Math.random() * count);
  if (excludeIndex != null && Number.isFinite(excludeIndex) && excludeIndex >= 0 && excludeIndex < count) {
    let guard = 0;
    while (idx === excludeIndex && guard < count) {
      idx = Math.floor(Math.random() * count);
      guard += 1;
    }
  }
  return idx;
}

/**
 * @param {string} template
 * @param {string} referralUrl
 * @param {string} referCode
 * @param {string} [optionalUserText] — inserted before promo footer, after a blank line
 */
export function formatInviteFriendsMessage(template, referralUrl, referCode, optionalUserText = '') {
  const body = String(template ?? '').trimEnd();
  const userLine = String(optionalUserText ?? '').trim();
  const footer = formatInviteFriendsPromoFooter(referralUrl, referCode);
  if (userLine) {
    return `${body}\n\n${userLine}\n\n${footer}`;
  }
  return `${body}\n\n${footer}`;
}
