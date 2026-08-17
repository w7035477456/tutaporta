import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import RedirectPreservingLocation, { RedirectLegacyVettedFriendsMember } from './RedirectPreservingLocation';
import { VETTED_FRIENDS_PATH } from './vettedFriendsPaths';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';
import { isSpeedDatingEnabled } from 'config/speedDatingEnv';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';
import ProtectedRoute from 'ui-component/ProtectedRoute';
import AllSingles from '../views/dashboard/allSingles/AllSingles';
import MyStory from '../views/dashboard/myStory/MyStory';
import MyPicks from '../views/dashboard/interested/MyPicks';
import UnderConstruction from '../views/dashboard/underConstruction/UnderConstruction';
import Landing from '../views/dashboard/landing/Landing';
import VsinglesLanding from '../views/dashboard/vsingles/VsinglesLanding';

// dashboard routing
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/default/defaultIndex')));
// utilities routing
const VerifySelf = Loadable(lazy(() => import('views/utilities/VerifySelf')));
const ReceivedBioRequestsPage = Loadable(lazy(() => import('views/utilities/ReceivedBioRequestsPage')));
const RequestsSent = Loadable(lazy(() => import('views/utilities/requestsSentIndex')));
const RequestApprovedMemberVettingView = Loadable(lazy(() => import('views/utilities/RequestApprovedMemberVettingView')));
const ProfilesRecordsPage = Loadable(lazy(() => import('views/utilities/ProfilesRecordsPage')));
const SendFlowerPage = Loadable(lazy(() => import('views/utilities/SendFlowerPage')));
const EMarketPlaceFlowerShopPage = Loadable(lazy(() => import('views/utilities/EMarketPlaceFlowerShopPage')));
const InterestedAlbumPage = Loadable(lazy(() => import('views/utilities/InterestedAlbumPage')));
const SelfReportBiographyPage = Loadable(lazy(() => import('views/utilities/SelfReportBiographyPage')));
const AdminToolsPage = Loadable(lazy(() => import('views/utilities/AdminToolsPage')));
const SpeedDatePage = Loadable(lazy(() => import('../views/dashboard/speedDate/SpeedDatePage')));
const MeasureOneLaunchPage = Loadable(lazy(() => import('views/utilities/MeasureOneLaunchPage')));
const MyRecordVault = Loadable(lazy(() => import('../views/dashboard/recordVault/MyRecordVault')));
const MyPhotoAlbums = Loadable(lazy(() => import('../views/dashboard/photoAlbums/MyPhotoAlbums')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  element: (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  ),
  children: [
    {
      path: '/',
      element: <Navigate to="/mall" replace />
    },
    {
      path: 'landing',
      element: <Landing />
    },
    {
      path: 'mall',
      element: <Landing />
    },
    {
      path: 'eMarketPlace',
      children: [
        {
          index: true,
          element: <UnderConstruction />
        },
        {
          path: 'flowerShop',
          element: <EMarketPlaceFlowerShopPage />
        }
      ]
    },
    {
      path: 'onlineProfessionals',
      element: <UnderConstruction />
    },
    {
      path: 'eClassifieds',
      element: <UnderConstruction />
    },
    {
      path: 'eServices',
      element: <UnderConstruction />
    },
    {
      path: 'vsingles',
      children: [
        {
          index: true,
          element: <VsinglesLanding />
        },
        {
          path: 'myStory',
          element: <Navigate to="/myStory" replace />
        },
        {
          path: 'myStore',
          element: <MyStory />
        },
        {
          path: 'allSingles',
          element: <AllSingles />
        }
      ]
    },
    {
      path: 'myStory',
      element: <MyStory />
    },
    {
      path: 'myNote',
      element: <MyRecordVault />
    },
    {
      path: 'myRecordVault',
      element: <Navigate to="/myNote" replace />
    },
    {
      path: 'myPhotoAlbums',
      element: <MyPhotoAlbums />
    },
    {
      path: 'myPhotoAlbumsLegacy',
      element: <Navigate to="/myPhotoAlbums" replace />
    },
    {
      path: 'default',
      element: <DashboardDefault />
    },
    {
      path: 'allSingles',
      element: <AllSingles />
    },
    {
      path: 'myPicks',
      element: <MyPicks />
    },
    {
      path: 'speedDating',
      element: isSpeedDatingEnabled() ? <SpeedDatePage /> : <Navigate to="/allSingles" replace />
    },
    {
      path: 'interestedSingles',
      element: <Navigate to="/myPicks" replace />
    },
    {
      path: 'verifyself',
      element: <VerifySelf />
    },
    {
      path: 'receivedBioRequests',
      element: <ReceivedBioRequestsPage />
    },
    {
      path: 'request-about-me',
      element: <Navigate to={RECEIVED_BIO_REQUESTS_PATH} replace />
    },
    {
      path: 'vettedFriends/member/:memberId',
      element: <RequestApprovedMemberVettingView />
    },
    {
      path: 'vettedFriends',
      element: <RequestsSent />
    },
    {
      path: 'request-ive-sent/member/:memberId',
      element: <RedirectLegacyVettedFriendsMember />
    },
    {
      path: 'request-ive-sent',
      element: <RedirectPreservingLocation />
    },
    {
      path: 'chat-with-friends',
      element: <RedirectPreservingLocation />
    },
    {
      path: 'profilesRecords',
      element: <ProfilesRecordsPage />
    },
    {
      path: 'adminTools',
      element: <AdminToolsPage />
    },
    {
      path: 'paymenthistory',
      element: <Navigate to={PROFILES_RECORDS_PATH} replace />
    },
    {
      path: 'settings',
      element: <Navigate to={PROFILES_RECORDS_PATH} replace />
    },
    {
      path: 'selfReportBiography',
      element: <SelfReportBiographyPage />
    },
    {
      path: 'measureone/education',
      element: <MeasureOneLaunchPage />
    },
    {
      path: 'checkr-check',
      element: <Navigate to={SELF_REPORT_BIOGRAPHY_PATH} replace />
    },
    {
      path: 'send-flower',
      element: <SendFlowerPage />
    },
    {
      path: 'publicPrivateAlbum',
      element: <InterestedAlbumPage />
    },
    {
      path: 'publicPrivateAbum',
      element: <Navigate to="/publicPrivateAlbum" replace />
    },
    {
      path: 'interestedAlbum',
      element: <Navigate to="/publicPrivateAlbum" replace />
    },
    {
      path: 'intestedAlbum',
      element: <Navigate to="/publicPrivateAlbum" replace />
    },
    {
      path: 'dashboard/myStory',
      element: <Navigate to="/myStory" replace />
    },
    {
      path: 'dashboard/default',
      element: <Navigate to="/default" replace />
    },
    {
      path: 'dashboard/allSingles',
      element: <Navigate to="/allSingles" replace />
    },
    {
      path: 'dashboard/interestedSingles',
      element: <Navigate to="/myPicks" replace />
    },
    {
      path: 'dashboard/myPicks',
      element: <Navigate to="/myPicks" replace />
    },
    {
      path: 'dashboard/verifyself',
      element: <Navigate to="/verifyself" replace />
    },
    {
      path: 'dashboard/receivedBioRequests',
      element: <Navigate to={RECEIVED_BIO_REQUESTS_PATH} replace />
    },
    {
      path: 'dashboard/request-about-me',
      element: <Navigate to={RECEIVED_BIO_REQUESTS_PATH} replace />
    },
    {
      path: 'dashboard/request-ive-sent',
      element: <Navigate to={VETTED_FRIENDS_PATH} replace />
    },
    {
      path: 'dashboard/vettedFriends',
      element: <Navigate to={VETTED_FRIENDS_PATH} replace />
    },
    {
      path: 'dashboard/chat-with-friends',
      element: <Navigate to={VETTED_FRIENDS_PATH} replace />
    },
    {
      path: 'dashboard/profilesRecords',
      element: <Navigate to={PROFILES_RECORDS_PATH} replace />
    },
    {
      path: 'dashboard/adminTools',
      element: <Navigate to={ADMIN_TOOLS_PATH} replace />
    },
    {
      path: 'dashboard/paymenthistory',
      element: <Navigate to={PROFILES_RECORDS_PATH} replace />
    },
    {
      path: 'dashboard/settings',
      element: <Navigate to={PROFILES_RECORDS_PATH} replace />
    },
    {
      path: 'dashboard/selfReportBiography',
      element: <Navigate to={SELF_REPORT_BIOGRAPHY_PATH} replace />
    },
    {
      path: 'dashboard/checkr-check',
      element: <Navigate to={SELF_REPORT_BIOGRAPHY_PATH} replace />
    }
  ]
};

export default MainRoutes;
