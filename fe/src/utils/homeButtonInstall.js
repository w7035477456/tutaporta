/** Chrome install prompt captured on /mobile so Make Home Button can open it. */

let deferredPrompt = null;
const listeners = new Set();

function isMobileHomePath() {
  if (typeof window === 'undefined') return false;
  const path = String(window.location.pathname || '').replace(/\/+$/, '') || '/';
  return path === '/mobile';
}

function notify() {
  for (const listener of listeners) listener(deferredPrompt);
}

export function getHomeInstallPrompt() {
  return deferredPrompt;
}

export function subscribeHomeInstallPrompt(listener) {
  listeners.add(listener);
  listener(deferredPrompt);
  return () => listeners.delete(listener);
}

export function clearHomeInstallPrompt() {
  deferredPrompt = null;
  notify();
}

export function isStandaloneHomeButton() {
  if (typeof window === 'undefined') return false;
  const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)')?.matches;
  return Boolean(standaloneDisplay || window.navigator.standalone);
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isMobileHomePath()) return;
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

const HOME_BUTTON_SW_URL = '/home-button-sw.js?v=2';

/** Register the no-cache worker Chrome needs before it will offer Add to Home screen. */
export function registerHomeButtonServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      const stale = regs.filter((reg) => {
        const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
        return scriptUrl && !scriptUrl.endsWith(HOME_BUTTON_SW_URL);
      });
      return Promise.all(stale.map((reg) => reg.unregister()));
    }).finally(() => {
      navigator.serviceWorker.register(HOME_BUTTON_SW_URL, { scope: '/' }).catch((error) => {
        console.error('Home button service worker registration failed:', error);
      });
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
