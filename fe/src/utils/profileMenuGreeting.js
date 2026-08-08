import { formatAliasWithMemberCode } from 'utils/memberLabel';

/** `{name}` = "Alias (M######)" or "M######" when no alias. */
export const PROFILE_MENU_GREETING_PHRASES = [
  'How are you today, {name}?',
  'Great to see you, {name}!',
  'Looking good today, {name}!',
  'You make this place brighter, {name}!',
  'Welcome back, {name}!',
  'Hope you are having a wonderful day, {name}!',
  'So glad you are here, {name}!',
  'The mall is happier with you here, {name}!',
  'Ready for a great day, {name}?',
  'Nice to see you again, {name}!',
  'You are always welcome here, {name}!',
  'Thanks for being part of our community, {name}!',
  // Additional greetings (profile dropdown)
  'So happy you stopped by, {name}!',
  'Your profile is looking sharp, {name}!',
  'Welcome back, {name}—we missed you!',
  'Always a pleasure to see you, {name}!',
  "What's new, {name}?",
  "You've arrived, {name}!",
  'Shine bright today, {name}!',
  "Let's mingle, {name}!",
  'Wishing you a wonderful day, {name}!',
  'You bring the good energy, {name}!',
  'Smile, {name}, it looks great on you!',
  'Hope something makes you laugh today, {name}!',
  'Who are we meeting today, {name}?',
  'Time to spark some connections, {name}!',
  'Your next adventure awaits, {name}!',
  "Let's find some smiles today, {name}!"
];

export function formatProfileMenuDisplayName({ alias, prefix, memberId, singlesId, fallback = 'VSingles Member' } = {}) {
  return formatAliasWithMemberCode({ alias, prefix, memberId, singlesId, fallback });
}

/** Split greeting so alias/member sits on line 2 (narrower popup). */
export function buildProfileMenuGreetingLines(phrase, user) {
  const name = formatProfileMenuDisplayName({
    alias: user?.alias,
    prefix: user?.prefix,
    memberId: user?.member_id,
    singlesId: user?.singles_id
  });
  const template = String(phrase ?? '');
  const marker = '{name}';
  const markerIndex = template.indexOf(marker);
  if (markerIndex < 0) {
    return { lead: template.trim(), nameLine: name };
  }
  const before = template.slice(0, markerIndex).trimEnd();
  const after = template.slice(markerIndex + marker.length);
  const nameLine = `${name}${after}`.trim();
  return {
    lead: before,
    nameLine
  };
}

export function pickRandomProfileMenuGreetingLines(user) {
  const phrase = PROFILE_MENU_GREETING_PHRASES[Math.floor(Math.random() * PROFILE_MENU_GREETING_PHRASES.length)];
  return buildProfileMenuGreetingLines(phrase, user);
}

/** @deprecated use pickRandomProfileMenuGreetingLines */
export function pickRandomProfileMenuGreeting(user) {
  const { lead, nameLine } = pickRandomProfileMenuGreetingLines(user);
  return nameLine ? `${lead} ${nameLine}`.trim() : lead;
}
