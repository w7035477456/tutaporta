import { getSameOriginApiBaseUrl } from 'config/apiBaseUrl';

/**
 * Ask TutaSupport RAG (public widget endpoint; rate-limited server-side).
 * @param {{ question: string, conversationId?: string }} payload
 * @returns {Promise<{ conversationId?: string, answer?: string, mode?: string, citations?: unknown[], node?: string }>}
 */
export async function askTechSupport({ question, conversationId }) {
  const body = { question: String(question ?? '').trim() };
  if (conversationId) body.conversationId = conversationId;

  const res = await fetch(`${getSameOriginApiBaseUrl()}/techsupport/api/public/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail || data?.title || data?.error || data?.message;
    throw new Error(detail || `Tech Support ask failed (${res.status})`);
  }

  return data ?? {};
}
