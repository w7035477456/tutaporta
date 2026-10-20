/**
 * Bytes moved between this browser tab and the server because of the most recent click.
 * Each pointerdown resets the tally; downloads come from Resource Timing `transferSize`
 * (0 for browser-cache hits), uploads from the axios request body. Only requests that
 * start within CLICK_WINDOW_MS of the click count, so background polls do not pile up.
 * Display-only, per tab.
 */
import { useSyncExternalStore } from 'react';

const CLICK_WINDOW_MS = 15000;
const BYTES_PER_MB = 1024 * 1024;

let clickStartedAt = null;
let bytes = 0;
let installed = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function inClickWindow(atMs) {
  return clickStartedAt != null && atMs >= clickStartedAt && atMs - clickStartedAt <= CLICK_WINDOW_MS;
}

function addBytes(n, atMs) {
  const b = Number(n);
  if (!Number.isFinite(b) || b <= 0 || !inClickWindow(atMs)) return;
  bytes += b;
  emit();
}

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function stringBytes(s) {
  return textEncoder ? textEncoder.encode(s).length : s.length;
}

function requestBodyBytes(data) {
  if (data == null) return 0;
  if (typeof data === 'string') return stringBytes(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.size;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    let total = 0;
    for (const [key, value] of data.entries()) {
      total += stringBytes(String(key));
      total += typeof value === 'string' ? stringBytes(value) : Number(value?.size) || 0;
    }
    return total;
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return stringBytes(data.toString());
  }
  try {
    return stringBytes(JSON.stringify(data));
  } catch {
    return 0;
  }
}

export function installLastClickTransferMeter(axiosInstance) {
  if (installed || typeof window === 'undefined' || typeof performance === 'undefined') return;
  installed = true;

  window.addEventListener(
    'pointerdown',
    () => {
      clickStartedAt = performance.now();
      bytes = 0;
      emit();
    },
    true
  );

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) addBytes(entry.transferSize, entry.startTime);
      }).observe({ type: 'resource', buffered: false });
    } catch {
      // Older browsers without resource observers: uploads are still counted.
    }
  }

  axiosInstance?.interceptors?.request?.use((config) => {
    addBytes(requestBodyBytes(config.data), performance.now());
    return config;
  });
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getMb() {
  return bytes / BYTES_PER_MB;
}

/** MB transferred by the last click (live; grows while that click's requests finish). */
export function useLastClickTransferMb() {
  return useSyncExternalStore(subscribe, getMb, getMb);
}
