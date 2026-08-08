import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

// routing
import router from 'routes';

// project imports
import NavigationScroll from 'layout/NavigationScroll';
import DatabaseConnectionGuard from 'ui-component/DatabaseConnectionGuard';
import ThemeCustomization from 'themes';
import TooManyRequestsModal from 'ui-component/TooManyRequestsModal';
import RateWarnPopup from 'ui-component/RateWarnPopup';
import SessionTimeoutWarning from 'ui-component/SessionTimeoutWarning';
import BrowserZoomWarning from 'ui-component/BrowserZoomWarning';
import ErrorPopup from 'ui-component/ErrorPopup';
import ThemedDialogHost from 'ui-component/ThemedDialogHost';
import { isGlobalErrorPopupEnabled } from 'config/globalErrorPopupEnv';

// auth provider
import { AuthProvider } from 'contexts/AuthContext';
import { UiTestRecordingProvider } from 'contexts/UiTestRecordingContext';
import GlobalClickSound from 'ui-component/GlobalClickSound';
import GuestDemoGate from 'ui-component/GuestDemoGate';

// ==============================|| APP ||============================== //

export default function App() {
  useEffect(() => {
    const BASE_VIEWPORT_WIDTH = 1366;
    const BASE_VIEWPORT_HEIGHT = 768;
    const POPUP_SIZE_BOOST = 2.0;// 1.22;
    const MIN_SCALE = 0.73;
    const MAX_SCALE = 2.2;

    const updateDialogScale = () => {
      const widthScale = window.innerWidth / BASE_VIEWPORT_WIDTH;
      const heightScale = window.innerHeight / BASE_VIEWPORT_HEIGHT;
      const nextScale = Math.min(widthScale, heightScale) * POPUP_SIZE_BOOST;
      const boundedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      document.documentElement.style.setProperty('--app-dialog-scale', String(boundedScale));
    };

    updateDialogScale();
    window.addEventListener('resize', updateDialogScale);

    return () => window.removeEventListener('resize', updateDialogScale);
  }, []);

  useEffect(() => {
    // Long-press on links opens the native context menu (mobile + Chrome device emulation with mouse).
    // Do not gate on matchMedia(pointer:coarse)—emulation often reports fine pointer; capture still works.
    if (typeof window === 'undefined') return undefined;

    const onContextMenuCapture = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;
      const inSidebar = el.closest('[aria-label="mailbox folders"]');
      const inTouchSuppress = el.closest('[data-suppress-touch-contextmenu="true"]');
      if (!inSidebar && !inTouchSuppress) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('contextmenu', onContextMenuCapture, true);
    return () => document.removeEventListener('contextmenu', onContextMenuCapture, true);
  }, []);

  return (
    <ThemeCustomization>
      <DatabaseConnectionGuard>
        <AuthProvider>
          <UiTestRecordingProvider>
            <NavigationScroll>
              <>
                <GlobalClickSound />
                <GuestDemoGate />
                <RouterProvider router={router} />
                <TooManyRequestsModal />
                <RateWarnPopup />
                <SessionTimeoutWarning />
                <BrowserZoomWarning />
                <ThemedDialogHost />
                {isGlobalErrorPopupEnabled() ? <ErrorPopup /> : null}
              </>
            </NavigationScroll>
          </UiTestRecordingProvider>
        </AuthProvider>
      </DatabaseConnectionGuard>
    </ThemeCustomization>
  );
}
