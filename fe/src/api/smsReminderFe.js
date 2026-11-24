import api from './axios';

/** { phone, days_before, configured } — phone = last one used, else the member's own. */
export async function fetchSmsReminderDefaults() {
  const { data } = await api.get('/api/smsReminder/defaults');
  return data;
}

/** { sms_reminder_id, phone, days_before, last_sent_due_date, last_error } */
export async function fetchSmsReminder(id) {
  const { data } = await api.get(`/api/smsReminder/${encodeURIComponent(id)}`);
  return data;
}

/**
 * Create / update a reminder and text a confirmation.
 * body { sms_reminder_id?, kind: 'monthly'|'yearly'|'todo', phone, days_before, label, due_date?, bill_id? }
 * → { ok, sms_reminder_id, confirmation_sent, warning }
 */
export async function saveSmsReminder(body) {
  const { data } = await api.post('/api/smsReminder', body);
  return data;
}

export async function deleteSmsReminder(id) {
  const { data } = await api.delete(`/api/smsReminder/${encodeURIComponent(id)}`);
  return data;
}
