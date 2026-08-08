import api from 'api/axios';

/**
 * @param {{ name: string, email: string, message: string, attachments?: Array<{ filename: string, contentBase64: string, mimeType: string }> }} payload
 */
export async function postSupportMessage(payload) {
  const { data } = await api.post('/api/supportMessage', payload);
  return data;
}
