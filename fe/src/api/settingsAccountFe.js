import api from 'api/axios';

export async function changeSettingsPassword(payload) {
  const { data } = await api.post('/api/settings/changePassword', payload);
  return data;
}

export async function sendSettingsChangePasswordSms() {
  const { data } = await api.post('/api/settings/changePassword/sendSms');
  return data;
}

export async function verifySettingsChangePasswordSms(verificationCode) {
  const { data } = await api.post('/api/settings/changePassword/verifySms', { verificationCode });
  return data;
}

export async function completeSettingsChangePassword(payload) {
  const { data } = await api.post('/api/settings/changePassword/complete', payload);
  return data;
}

export async function changeSettingsEmail(payload) {
  const { data } = await api.post('/api/settings/changeEmail', payload);
  return data;
}

export async function sendSettingsChangeEmailSms() {
  const { data } = await api.post('/api/settings/changeEmail/sendSms');
  return data;
}

export async function verifySettingsChangeEmailSms(verificationCode) {
  const { data } = await api.post('/api/settings/changeEmail/verifySms', { verificationCode });
  return data;
}

export async function submitSettingsChangeEmail(payload) {
  const { data } = await api.post('/api/settings/changeEmail/submit', payload);
  return data;
}

export async function completeSettingsChangeEmail(payload) {
  const { data } = await api.post('/api/settings/changeEmail/complete', payload);
  return data;
}

export async function changeSettingsPhone(payload) {
  const { data } = await api.post('/api/settings/changePhone', payload);
  return data;
}

export async function submitSettingsChangePhone(payload) {
  const { data } = await api.post('/api/settings/changePhone/submit', payload);
  return data;
}

export async function verifySettingsChangePhoneEmailCode(verificationCode) {
  const { data } = await api.post('/api/settings/changePhone/verifyEmailCode', { verificationCode });
  return data;
}

export async function sendSettingsChangePhoneSms() {
  const { data } = await api.post('/api/settings/changePhone/sendSms');
  return data;
}

export async function verifySettingsChangePhoneSms(verificationCode) {
  const { data } = await api.post('/api/settings/changePhone/verifySms', { verificationCode });
  return data;
}

export async function requestSettingsEmailChange(payload) {
  const { data } = await api.post('/api/settings/requestEmailChange', payload);
  return data;
}

export async function verifyEmailChangeLink(email, code) {
  const { data } = await api.get('/api/verifyEmailChangeLink', {
    params: { email: email.trim().toLowerCase(), code: code.trim().toUpperCase() }
  });
  return data;
}

export async function completeEmailChange(payload) {
  const { data } = await api.post('/api/completeEmailChange', payload);
  return data;
}
