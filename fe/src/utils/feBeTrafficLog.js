/**
 * Console logging for browser ↔ server HTTP traffic when FE_BE_TRAFFIC_LOG=true (~/.ssh/be/.env).
 * All lines prefixed with >>>>> so they are easy to grep in DevTools / PM2 logs.
 */
import { getApiBaseUrl } from 'config/apiBaseUrl';

const PREFIX = '>>>>>';
let enabled =
  String(import.meta.env.VITE_FE_BE_TRAFFIC_LOG || '')
    .trim()
    .toLowerCase() === 'true';
let fetchPatched = false;
let axiosPatched = false;

export function isFeBeTrafficLogEnabled() {
  return enabled;
}

export function setFeBeTrafficLogEnabled(next) {
  enabled = next === true;
}

function logLine(...parts) {
  if (!enabled) return;
  console.log(PREFIX, ...parts);
}

function urlFromInput(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === 'string') return input.url;
  return String(input);
}

function isApiTrafficUrl(url) {
  const base = getApiBaseUrl();
  const s = String(url);
  return s.startsWith(base) || s.startsWith('/api');
}

function summarizePayload(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') {
    return payload.length > 120 ? ` chars=${payload.length}` : ` ${payload}`;
  }
  try {
    const s = JSON.stringify(payload);
    return s.length > 200 ? ` jsonChars=${s.length}` : ` ${s}`;
  } catch {
    return ' [unserializable]';
  }
}

/** One-time read from GET /api/publicConfig (optional; also set VITE_FE_BE_TRAFFIC_LOG in fe/.env). */
export async function syncFeBeTrafficLogFromPublicConfig() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    if (json.feBeTrafficLog === true) setFeBeTrafficLogEnabled(true);
  } catch {
    /* keep VITE / prior value */
  }
}

export function installFetchTrafficLog() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = urlFromInput(input);
    const method = (init?.method || 'GET').toUpperCase();
    const track = enabled && isApiTrafficUrl(url);
    if (track) logLine('[FE HTTP →]', method, url);
    const started = Date.now();
    try {
      const res = await nativeFetch(input, init);
      if (track) logLine('[FE HTTP ←]', method, url, res.status, `${Date.now() - started}ms`);
      return res;
    } catch (err) {
      if (track) logLine('[FE HTTP ✗]', method, url, err?.message || err);
      throw err;
    }
  };
}

export function installAxiosTrafficLog(axiosInstance) {
  if (axiosPatched || !axiosInstance) return;
  axiosPatched = true;

  axiosInstance.interceptors.request.use((config) => {
    if (!enabled) return config;
    const method = (config.method || 'get').toUpperCase();
    const url = `${config.baseURL || ''}${config.url || ''}`;
    logLine('[FE HTTP →]', method, url, summarizePayload(config.data));
    config.metadata = { ...(config.metadata || {}), feBeTrafficStarted: Date.now() };
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      if (enabled) {
        const started = response.config?.metadata?.feBeTrafficStarted;
        const ms = Number.isFinite(started) ? Date.now() - started : null;
        const method = (response.config?.method || 'get').toUpperCase();
        const url = `${response.config?.baseURL || ''}${response.config?.url || ''}`;
        logLine('[FE HTTP ←]', method, url, response.status, ms != null ? `${ms}ms` : '');
      }
      return response;
    },
    (error) => {
      if (enabled) {
        const cfg = error.config || {};
        const method = (cfg.method || 'get').toUpperCase();
        const url = `${cfg.baseURL || ''}${cfg.url || ''}`;
        const status = error.response?.status;
        logLine('[FE HTTP ✗]', method, url, status ?? 'network', error.message || '');
      }
      return Promise.reject(error);
    }
  );
}

export function installFeBeTrafficLog(axiosInstance) {
  installFetchTrafficLog();
  installAxiosTrafficLog(axiosInstance);
}
