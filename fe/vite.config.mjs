import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildInfoVitePlugin } from './scripts/buildInfo.mjs';

function parseSimpleEnvFile(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Keys mirrored from ~/.ssh/be/.env into process.env before Vite bundles the FE (see config/*.js).
 *  MAIN_FONT wins over fe/.env when set in ~/.ssh/be/.env (dotenv does not override process.env).
 *  SPEEDDATING — sidebar Speed Dating item (speedDatingEnv.js). */
const BE_ENV_KEYS_FROM_HOME_FILE = [
  'SPECIAL_LINK',
  'SPECIAL_ID',
  'SPECIAL_P',
  'PRICE_PER_TOKEN',
  'MAIN_FONT',
  'FE_RATE_LIMIT_ENABLE',
  'FE_RATE_CLIENT_API_ACCESS_LIMIT',
  'FE_RATE_CLIENT_API_TIMESLICE_SECONDS',
  'FE_RATE_CLIENT_API_COOLDOWN_SECONDS',
  'FE_RATE_CLIENT_API_COOLDOWN_ENABLED',
  'FE_RATE_CLIENT_API_CONSOLE_LOG',
  'SELF_INTRO_VIDEO_MAX_LENGTH',
  'NOTES_DEFAULT_BUTTON_FONT_SIZE_REM',
  'PHOTOALBUMS_DEFAULT_BUTTON_FONT_SIZE_REM',
  'ONENOTE_USB_UPGRADE',
  'ALL_SINGLES_VIDEO_TUTORIAL',
  'PICKS_POSTS_VIDEO_TUTORIAL',
  'ACQUAINTS_BUDDIES_VIDEO_TUTORIAL',
  'ACQUAINT_BUDDIES_VIDEO_TUTORIAL',
  'MYALBUM_VIDEO_TUTORIAL',
  'MYSELFREPORTBIO_VIDEO_TUTORIAL',
  'RECEIVED_BIO_REQUEST_VIDEO_TUTORIAL',
  'PROFILE_RECORDS_VIDEO_TUTORIAL',
  'TOPRIGHT_VIDEO_TUTORIAL',
  'SPEEDDATING'
];

function loadBeEnvKeysFromHomeFile() {
  const candidates = [
    path.join(os.homedir(), '.ssh', 'be', '.env'),
    path.join(os.homedir(), '.ssh', 'be.env')
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const parsed = parseSimpleEnvFile(fs.readFileSync(envPath, 'utf8'));
    for (const key of BE_ENV_KEYS_FROM_HOME_FILE) {
      const value = parsed[key];
      if (value != null && String(value).trim() !== '') {
        process.env[key] = String(value).trim();
      }
    }
    return;
  }
}

loadBeEnvKeysFromHomeFile();

export default defineConfig(({ mode }) => {
  // depending on your application, base can also be "/"
  const PORT = 3000;
  const env = loadEnv(mode, process.cwd(), ['API_']);
  const apiPort = String(env.API_PORT || '40000').trim();
  const apiProxy = {
    '/api': {
      target: `http://127.0.0.1:${apiPort}`,
      changeOrigin: true
    }
  };

  return {
    // Expose API_PORT from fe/.env (same as VITE_* for client bundle)
    // VERTICAL_ / HORIZONTAL_ — auth dialog scrollbars (see config/authDialogEnv.js)
    // DEBUG_ — e.g. DEBUG_DOTTED_BORDERS (see config/debugEnv.js)
    // TOP_/RIGHT_/FOOTERPAGES_ — legal pages dialog margins (see config/legalDialogEnv.js)
    // DIALOG_ — standard auth dialogs (see config/standardAuthDialogEnv.js)
    // FOOTER_ — auth footer height (see config/authFooterEnv.js)
      // MOBILE_ / DESKTOP_ — All Singles / Interested typography (see config/singlesMemberCardFontEnv.js)
      // PRESS_ — sidebar press/hold zoom (see config/pressHoldZoomEnv.js)
      // FE_ — e.g. FE_DEBUG; FE_RATE_* mirrored from ~/.ssh/be/.env (clientApiRateLimitEnv.js)
      // DEFAULT_ — e.g. DEFAULT_THEME (see config/defaultThemeEnv.js)
      // ALBUM_ — e.g. ALBUM_BINDER_WIDTH_PCT (see config/albumBinderWidthEnv.js)
      // ALL_SINGLES_ / PICKS_ / ACQUAINT*_ / MYALBUM_ / … — page Video Tutorials URLs (pageVideoTutorialEnv.js)
      // SPEEDDATING — sidebar Speed Dating item (speedDatingEnv.js); mirrored from ~/.ssh/be/.env
      envPrefix: [
      'VITE_',
      'FE_',
      'API_',
      'VERTICAL_',
      'HORIZONTAL_',
      'DEBUG_',
      'GLOBAL_',
      'TOP_',
      'RIGHT_',
      'DIALOG_',
      'FOOTER_',
      'FOOTERPAGES_',
      'MOBILE_',
      'DESKTOP_',
      'PRESS_',
      'HOVER_',
      'MY_PICKS_',
      'VSINGLES_',
      'RATE_',
      'MAIN_',
      'DEFAULT_',
      'NEW_',
      'THEME_',
      'NOTIFICATION_',
      'SPECIAL_',
      'DISABLE_',
      'PRICE_',
      'SCAN_',
      'RECORD_',
      'SELF_',
      'YELLOW_',
      'NOTES_',
      'PHOTOALBUMS_',
      'ONENOTE_',
      'ALBUM_',
      'ALL_SINGLES_',
      'PICKS_',
      'ACQUAINTS_',
      'ACQUAINT_',
      'MYALBUM_',
      'MYSELFREPORTBIO_',
      'RECEIVED_',
      'PROFILE_',
      'TOPRIGHT_',
      'SPEEDDATING',
      'BSIZE'
    ],
    server: {
      // this ensures that the browser opens upon server start
      open: true,
      // this sets a default port to 3000
      port: PORT,
      host: true,
      proxy: apiProxy
    },
    build: {
      chunkSizeWarningLimit: 1600
    },
    preview: {
      open: true,
      host: true,
      proxy: apiProxy
    },
    define: {
      global: 'window'
    },
    resolve: {
      alias: {
        // { find: '', replacement: path.resolve(__dirname, 'src') },
        // {
        //   find: /^~(.+)/,
        //   replacement: path.join(process.cwd(), 'node_modules/$1')
        // },
        // {
        //   find: /^src(.+)/,
        //   replacement: path.join(process.cwd(), 'src/$1')
        // }
        // {
        //   find: 'assets',
        //   replacement: path.join(process.cwd(), 'src/assets')
        // }
      }
    },
    base: '/',
    plugins: [react(), jsconfigPaths(), buildInfoVitePlugin()]
  };
});
