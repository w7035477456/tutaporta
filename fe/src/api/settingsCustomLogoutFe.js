import api from 'api/axios';
import { buildAutoLogoutPresets } from 'constants/customLogoutDuration';

export async function fetchCustomLogoutDuration() {
  const { data } = await api.get('/api/settings/custom-logout-duration');
  const logoutAutoMin = Number(data?.logout_auto_min) || 15;
  const presetMinutes = Array.isArray(data?.logout_presets) ? data.logout_presets.map(Number) : null;
  return {
    minutes: Number(data?.custom_logout_duration) || 60,
    adminCustomAllowed: data?.admin_custom_allowed === true,
    logoutAutoMin,
    presets: buildAutoLogoutPresets(logoutAutoMin, presetMinutes),
    presetMinutes: presetMinutes || buildAutoLogoutPresets(logoutAutoMin).map((p) => p.minutes)
  };
}

export async function saveCustomLogoutDuration(minutes) {
  const { data } = await api.put('/api/settings/custom-logout-duration', {
    custom_logout_duration: minutes
  });
  return Number(data?.custom_logout_duration) || minutes;
}
