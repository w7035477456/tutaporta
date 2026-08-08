import { formatAliasWithMemberCode } from 'utils/memberLabel';

export function countUnreadPicksPostNotifications(notifications) {
  return Array.isArray(notifications) ? notifications.length : 0;
}

/** First N words of post text (photos omitted by caller). */
export function firstWords(text, wordCount = 10) {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  if (words.length <= wordCount) return words.join(' ');
  return `${words.slice(0, wordCount).join(' ')}…`;
}

import { formatUserDateTime } from 'utils/userTimeZone';

export function formatTimeAgo(isoDate, userTimeZoneProfile = null) {
  const then = Date.parse(isoDate ?? '');
  if (!Number.isFinite(then)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return sec <= 5 ? 'just now' : `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return formatUserDateTime(new Date(then), userTimeZoneProfile || {});
}

/** Bell list line 1: "Alias (M######)" or "M######". */
export function picksPostNotificationAlias(row) {
  return formatAliasWithMemberCode({
    alias: row?.alias,
    prefix: row?.prefix,
    memberId: row?.member_id,
    singlesId: row?.author_singles_id ?? row?.singles_id
  });
}

export function picksPostNotificationProfileUrl(singlesId, apiBaseUrl) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${apiBaseUrl}/api/profile-photo/${id}`;
}
