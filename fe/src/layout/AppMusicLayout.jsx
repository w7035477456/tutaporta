import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { BackgroundMusicProvider } from 'contexts/BackgroundMusicContext';
import { MY_PHOTO_ALBUMS_VIEW_PATH } from 'constants/myPhotoAlbumsRoute';

/** Site-wide background music context (auth + main app routes). */
export default function AppMusicLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const shouldForce100Percent =
      pathname === '/pages/login' ||
      pathname.startsWith('/pages/login/') ||
      pathname === '/pages/mall' ||
      pathname.startsWith('/pages/mall/') ||
      pathname === MY_PHOTO_ALBUMS_VIEW_PATH ||
      pathname.startsWith(MY_PHOTO_ALBUMS_VIEW_PATH);

    if (shouldForce100Percent) {
      // Note: CSS zoom is non-standard but works in Chromium-based browsers.
      document.documentElement.style.zoom = '100%';
      document.body.style.zoom = '100%';
      return undefined;
    }

    document.documentElement.style.zoom = '';
    document.body.style.zoom = '';
    return undefined;
  }, [pathname]);

  return (
    <BackgroundMusicProvider>
      <Outlet />
    </BackgroundMusicProvider>
  );
}
