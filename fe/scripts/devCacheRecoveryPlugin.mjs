/**
 * Mac dev: when Vite restarts, Chrome may keep stale pre-bundled dep files (504 Outdated
 * Optimize Dep) even after Cmd+Shift+R. Incognito works because it has no HTTP cache.
 * Injects a sync bootstrap in index.html that purges Cache Storage / SW and reloads once
 * before any module scripts run — same effect as a clean tab.
 */
const INLINE_RECOVERY = String.raw`
(function () {
  var host = String(location.hostname || '').toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') return;

  var SESSION_KEY = 'omViteDevSession';
  var PURGE_FOR = 'omDevPurgedSession';
  var OMR_PURGE = 'omOmrPurge';

  var meta = document.querySelector('meta[name="om-vite-dev-session"]');
  var session = meta && meta.getAttribute('content');
  if (!session) return;

  var prev = localStorage.getItem(SESSION_KEY);
  var needsPurge = prev !== session;

  if (!needsPurge && location.search.indexOf('_omr=') !== -1 && !sessionStorage.getItem(OMR_PURGE)) {
    needsPurge = true;
    sessionStorage.setItem(OMR_PURGE, '1');
  }

  if (!needsPurge) return;
  if (sessionStorage.getItem(PURGE_FOR) === session) return;

  sessionStorage.setItem(PURGE_FOR, session);
  localStorage.setItem(SESSION_KEY, session);
  try {
    sessionStorage.removeItem('omStaleModuleHardReloadAt');
    sessionStorage.removeItem('omStaleModuleHardReloadCount');
  } catch (e) {}

  var url = new URL(location.href);
  url.searchParams.delete('_omr');
  url.searchParams.set('_omdv', String(Date.now()));
  var next = url.pathname + url.search + url.hash;

  var navigate = function () {
    location.replace(next);
  };

  var purge = Promise.resolve();
  if ('serviceWorker' in navigator) {
    purge = purge.then(function () {
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      });
    });
  }
  if (window.caches && window.caches.keys) {
    purge = purge.then(function () {
      return caches.keys().then(function (names) {
        return Promise.all(names.map(function (n) { return caches.delete(n); }));
      });
    });
  }
  purge.then(navigate).catch(navigate);
})();
`.trim();

export function devCacheRecoveryPlugin() {
  let devSession = '';

  return {
    name: 'om-dev-cache-recovery',
    configureServer(server) {
      devSession = String(Date.now());
      server.middlewares.use((req, res, next) => {
        if (req.url && !req.url.includes('.')) {
          res.setHeader('Cache-Control', 'no-store');
        }
        next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html;
        if (!devSession) devSession = String(Date.now());
        const meta = `<meta name="om-vite-dev-session" content="${devSession}" />`;
        const script = `<script>${INLINE_RECOVERY}</script>`;
        return html.replace('<head>', `<head>\n    ${meta}\n    ${script}`);
      }
    }
  };
}
