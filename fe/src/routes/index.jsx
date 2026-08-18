import { createBrowserRouter } from 'react-router-dom';

// routes
import AppMusicLayout from 'layout/AppMusicLayout';
import AuthenticationRoutes from './AuthenticationRoutes';
import MainRoutes from './MainRoutes';
import TooManyRequests from 'views/pages/tooManyRequests/TooManyRequests';
import Loadable, { lazy } from 'ui-component/Loadable';
import ProtectedRoute from 'ui-component/ProtectedRoute';
import ErrorBoundary from './ErrorBoundary';
import { MY_PHOTO_ALBUMS_VIEW_PATH } from 'constants/myPhotoAlbumsRoute';

const PhotoAlbumsFullscreenView = Loadable(lazy(() => import('views/dashboard/photoAlbums/PhotoAlbumsFullscreenView')));
const PhotoAlbumsAcceptInvite = Loadable(lazy(() => import('views/dashboard/photoAlbums/PhotoAlbumsAcceptInvite')));

// ==============================|| ROUTING RENDER ||============================== //

// TooManyRequests first so 429 redirect shows image-only page; then MainRoutes, AuthenticationRoutes
const router = createBrowserRouter(
  [
    {
      element: <AppMusicLayout />,
      errorElement: <ErrorBoundary />,
      children: [
        {
          path: '/tooManyRequests',
          element: <TooManyRequests />
        },
        {
          path: MY_PHOTO_ALBUMS_VIEW_PATH,
          element: (
            <ProtectedRoute>
              <PhotoAlbumsFullscreenView />
            </ProtectedRoute>
          )
        },
        {
          path: '/photoAlbums/accept-invite',
          element: <PhotoAlbumsAcceptInvite />
        },
        MainRoutes,
        AuthenticationRoutes
      ]
    }
  ],
  {
    basename: '/'
  }
);

export default router;
