import { useSyncExternalStore } from 'react';

let siteFooterSuppressed = false;
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return siteFooterSuppressed;
}

/** Hide site footer (About Us / Terms) while a vault workspace is in focus-view. */
export function setVaultWorkspaceFocusSiteFooterSuppressed(suppressed) {
  const next = Boolean(suppressed);
  if (next === siteFooterSuppressed) return;
  siteFooterSuppressed = next;
  listeners.forEach((listener) => listener());
}

export function useVaultWorkspaceFocusSiteFooterSuppressed() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
