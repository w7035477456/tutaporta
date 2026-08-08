/** Profiles → Auto logout after (min) — first preset label uses logout_auto_min from API. */

export function formatAutoLogoutPresetLabel(minutes) {
  const m = Math.trunc(Number(minutes));
  if (m === 1440) return '24 hour';
  if (m === 480) return '8 hour';
  if (m === 60) return '60 min';
  return `${m} min`;
}

export function buildAutoLogoutPresets(logoutAutoMin, presetMinutes) {
  const mins =
    Array.isArray(presetMinutes) && presetMinutes.length
      ? presetMinutes
      : [logoutAutoMin || 15, 60, 480, 1440];
  return mins.map((minutes) => ({
    minutes,
    label: formatAutoLogoutPresetLabel(minutes)
  }));
}

export function isAutoLogoutPresetMinutes(minutes, presetMinutes) {
  const mins =
    Array.isArray(presetMinutes) && presetMinutes.length
      ? presetMinutes
      : [15, 60, 480, 1440];
  return mins.includes(Math.trunc(Number(minutes)));
}
