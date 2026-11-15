/**
 * Client for the TutaMall LLM Gateway (rag_service FastAPI on :8765).
 *
 * Prefer this over calling Ollama at 127.0.0.1:11434 from each web worker —
 * especially once GPU/Ollama lives on xbox4 and web servers are on xbox3/xbox4.
 *
 * Escape hatch: LLM_GATEWAY_ENABLED=false → call Ollama directly (legacy).
 */

const DEFAULT_GATEWAY = 'http://127.0.0.1:8765';
const DEFAULT_OLLAMA = 'http://127.0.0.1:11434';

export function getLlmGatewayConfig(env = process.env) {
  const enabled = !/^(0|false|no|off)$/i.test(String(env.LLM_GATEWAY_ENABLED ?? 'true').trim());
  const gatewayUrl = String(env.LLM_GATEWAY_URL || env.RAG_SERVICE_URL || DEFAULT_GATEWAY).replace(
    /\/$/,
    ''
  );
  const secret = String(env.LLM_GATEWAY_SECRET || '').trim();
  const ollamaBaseUrl = String(env.OLLAMA_BASE_URL || DEFAULT_OLLAMA).replace(/\/$/, '');
  return { enabled, gatewayUrl, secret, ollamaBaseUrl };
}

function gatewayHeaders(secret, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (secret) headers['X-LLM-Gateway-Key'] = secret;
  return headers;
}

/**
 * Chat completion via the gateway (or direct Ollama when LLM_GATEWAY_ENABLED=false).
 *
 * @param {object} opts
 * @param {Array<{role:string, content:string}>} opts.messages
 * @param {string} opts.model
 * @param {string} [opts.format]  e.g. 'json'
 * @param {boolean} [opts.think]
 * @param {string} [opts.keepAlive]
 * @param {object} [opts.options]
 * @param {number} [opts.timeoutMs]
 * @param {ReturnType<typeof getLlmGatewayConfig>} [opts.cfg]
 * @returns {Promise<{ content: string, model: string, modelLoadMs: number }>}
 */
export async function llmChat({
  messages,
  model,
  format,
  think,
  keepAlive,
  options,
  timeoutMs = 180000,
  cfg = getLlmGatewayConfig()
}) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('llmChat: messages is required');
  }
  const resolvedModel = String(model || process.env.OLLAMA_MODEL || 'qwen3:30b-a3b').trim();
  const resolvedKeepAlive = keepAlive ?? process.env.OLLAMA_KEEP_ALIVE ?? '10m';

  if (cfg.enabled) {
    const body = {
      messages,
      model: resolvedModel,
      stream: false,
      keep_alive: resolvedKeepAlive
    };
    if (format != null) body.format = format;
    if (think != null) body.think = think;
    if (options && typeof options === 'object') body.options = options;

    let res;
    try {
      res = await fetch(`${cfg.gatewayUrl}/chat`, {
        method: 'POST',
        headers: gatewayHeaders(cfg.secret),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      const msg = err?.message || String(err);
      throw new Error(`LLM gateway unreachable at ${cfg.gatewayUrl}: ${msg}`);
    }
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      const detail = data?.detail || data?.error || text.slice(0, 200) || res.statusText;
      const message = Array.isArray(detail)
        ? detail.map((d) => d?.msg || String(d)).join('; ')
        : String(detail);
      throw new Error(`LLM gateway HTTP ${res.status}: ${message}`);
    }
    const content = String(data.content ?? '').trim();
    if (!content) throw new Error('LLM gateway returned an empty answer');
    return {
      content,
      model: String(data.model || resolvedModel),
      modelLoadMs: Number(data.model_load_ms) || 0
    };
  }

  // Legacy: talk to Ollama directly (same host as this Node process).
  const payload = {
    model: resolvedModel,
    messages,
    stream: false,
    keep_alive: resolvedKeepAlive,
    options: options && typeof options === 'object' ? options : undefined
  };
  if (format != null) payload.format = format;
  if (think != null) payload.think = think;

  const call = async (body) => {
    const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  };

  let reply = await call(payload);
  if (!reply.ok && reply.status === 400 && /think/i.test(reply.text) && payload.think != null) {
    delete payload.think;
    reply = await call(payload);
  }
  if (!reply.ok) throw new Error(`Ollama HTTP ${reply.status}: ${reply.text.slice(0, 200)}`);
  let data = {};
  try {
    data = JSON.parse(reply.text);
  } catch {
    throw new Error('Ollama returned non-JSON');
  }
  const content = String(data?.message?.content ?? '').trim();
  if (!content) throw new Error('Ollama returned an empty answer');
  return {
    content,
    model: String(data.model || resolvedModel),
    modelLoadMs: 0
  };
}

/** Headers for RAG routes that still call /query-notes and /keep-model on the same process. */
export function llmGatewayFetchHeaders(cfg = getLlmGatewayConfig()) {
  return gatewayHeaders(cfg.secret);
}
