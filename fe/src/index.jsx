import { createRoot } from 'react-dom/client';

import { isGlobalErrorPopupEnabled } from 'config/globalErrorPopupEnv';
import { bootstrapStaleModuleRecovery, installHardReloadOnStaleModule } from 'utils/hardReloadOnStaleModule';

bootstrapStaleModuleRecovery();
installHardReloadOnStaleModule();

// Patch console.error to show red ERROR popup only when GLOBAL_ERROR_POPUP=true in fe/.env
const _originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args
    .map((a) => {
      if (a instanceof Error) return `${a.message}${a.stack ? '\n' + a.stack : ''}`;
      if (typeof a === 'object' && a !== null) return JSON.stringify(a, null, 2);
      return String(a);
    })
    .join(' ');
  const vaultAccessHandled =
    /incorrect encrypt password/i.test(msg) ||
    /encrypt password try \d+ of \d+/i.test(msg) ||
    /five consecutive fails will cause format/i.test(msg);
  if (typeof window !== 'undefined' && isGlobalErrorPopupEnabled() && !vaultAccessHandled) {
    window.dispatchEvent(new CustomEvent('appConsoleError', { detail: msg }));
  }
  _originalConsoleError.apply(console, args);
};

// project imports
import api from 'api/axios';
import { installFeBeTrafficLog, syncFeBeTrafficLogFromPublicConfig } from 'utils/feBeTrafficLog';
import { installClientApiCooldownFetchGuard } from 'utils/clientApiCooldown';
import App from 'App';

installClientApiCooldownFetchGuard();
installFeBeTrafficLog(api);
void syncFeBeTrafficLogFromPublicConfig();
import * as serviceWorker from 'serviceWorker';
import reportWebVitals from 'reportWebVitals';
import { ConfigProvider } from 'contexts/ConfigContext';
import { SiteAudioProvider } from 'contexts/SiteAudioContext';

// style + assets
import 'assets/scss/style.scss';

// google-fonts
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/700.css';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

// ==============================|| REACT DOM RENDER ||============================== //

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <ConfigProvider>
    <SiteAudioProvider>
      <App />
    </SiteAudioProvider>
  </ConfigProvider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
