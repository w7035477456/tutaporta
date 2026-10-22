// project imports
import Loadable, { lazy } from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';
import ProtectedRoute from 'ui-component/ProtectedRoute';
import { LIVE_FACE_SCAN_POPUP_PATH } from 'constants/liveFaceScanPopupRoute';
import { getSpecialLoginPath } from 'config/specialLoginEnv';
import {
  GET_MY_RAFFLE_PATH,
  RAFFLE_HOST_LEGACY_PATH,
  RAFFLE_HOST_PATH,
  RAFFLE_MUSTAFA_PATH,
  RAFFLE_PATH,
  RAFFLE_SAMPLE_PATH,
  RAFFLE_STEPS_PATH
} from 'constants/raffleRoute';
import RedirectPreservingLocation from './RedirectPreservingLocation';

// maintenance routing
const LoginPage = Loadable(lazy(() => import('views/pages/authentication/Login')));
const RegisterPage = Loadable(lazy(() => import('views/pages/authentication/Register')));
const ClaimTokenPage = Loadable(lazy(() => import('views/pages/authentication/ClaimToken')));
const EnterTokenPage = Loadable(lazy(() => import('views/pages/authentication/EnterToken')));
const VerifyEmailPage = Loadable(lazy(() => import('views/pages/authentication/VerifyEmail')));
const LoginFailurePage = Loadable(lazy(() => import('views/pages/authentication/LoginFailure')));
const RegistrationSuccessPage = Loadable(lazy(() => import('views/pages/authentication/RegistrationSuccess')));
const CreatePasswordPage = Loadable(lazy(() => import('views/pages/authentication/CreatePassword')));
const PhoneVerificationPage = Loadable(lazy(() => import('views/pages/authentication/PhoneVerification')));
const PhoneVerificationSuccessPage = Loadable(lazy(() => import('views/pages/authentication/PhoneVerificationSuccess')));
const PhoneVerificationFailurePage = Loadable(lazy(() => import('views/pages/authentication/PhoneVerificationFailure')));
const AboutUsPage = Loadable(lazy(() => import('views/pages/authentication/AboutUs')));
const TermsAndConditionsPage = Loadable(lazy(() => import('views/pages/authentication/TermsAndConditions')));
const PrivacyPolicyPage = Loadable(lazy(() => import('views/pages/authentication/PrivacyPolicy')));
const LoginBypassPage = Loadable(lazy(() => import('views/pages/authentication/LoginBypass')));
const ForgotPasswordPage = Loadable(lazy(() => import('views/pages/authentication/ForgotPassword')));
const PasswordResetSentPage = Loadable(lazy(() => import('views/pages/authentication/PasswordResetSent')));
const ResetPasswordPage = Loadable(lazy(() => import('views/pages/authentication/ResetPassword')));
const ConfirmEmailChangePage = Loadable(lazy(() => import('views/pages/authentication/ConfirmEmailChange')));
const MobilePhotoUploadPage = Loadable(lazy(() => import('views/pages/MobilePhotoUploadPage')));
const MobileHomeButtonPage = Loadable(lazy(() => import('views/pages/MobileHomeButtonPage')));
const InstallQrPage = Loadable(lazy(() => import('views/pages/InstallQrPage')));
const GoogleOAuthBridgePage = Loadable(lazy(() => import('views/pages/authentication/GoogleOAuthBridge')));
const LiveFaceScanPopupPage = Loadable(lazy(() => import('views/utilities/LiveFaceScanPopupPage')));
const ResumePage = Loadable(lazy(() => import('views/pages/ResumePage')));
const RaffleInfoPage = Loadable(lazy(() => import('views/pages/raffle/RaffleInfoPage')));
const RaffleRedirect = Loadable(lazy(() => import('views/pages/raffle/RaffleRedirect')));
const RaffleSamplePage = Loadable(lazy(() => import('views/pages/raffle/RaffleSamplePage')));
const RaffleStepsPage = Loadable(lazy(() => import('views/pages/raffle/RaffleStepsPage')));
const RaffleHostPage = Loadable(lazy(() => import('views/pages/raffle/RaffleHostPage')));

// ==============================|| AUTHENTICATION ROUTING ||============================== //

const specialLoginPath = getSpecialLoginPath();

const authenticationChildren = [
  {
    path: '/pages/login',
    element: <LoginPage />
  },
  {
    path: '/pages/login/google-oauth-bridge',
    element: <GoogleOAuthBridgePage />
  },
  {
    path: '/pages/forgotPassword',
    element: <ForgotPasswordPage />
  },
  {
    path: '/pages/passwordResetSent',
    element: <PasswordResetSentPage />
  },
  {
    path: '/pages/resetPassword',
    element: <ResetPasswordPage />
  },
  {
    path: '/pages/confirmEmailChange',
    element: <ConfirmEmailChangePage />
  },
  {
    path: '/register',
    element: <RegisterPage />
  },
  {
    path: '/pages/register',
    element: <RegisterPage />
  },
  {
    path: '/claimtoken',
    element: <ClaimTokenPage />
  },
  {
    path: '/entertoken',
    element: <EnterTokenPage />
  },
  {
    path: '/verifyemail',
    element: <VerifyEmailPage />
  },
  {
    path: '/pages/loginFailure',
    element: <LoginFailurePage />
  },
  {
    path: '/pages/registrationEmailed',
    element: <RegistrationSuccessPage />
  },
  {
    path: '/pages/createPassword',
    element: <CreatePasswordPage />
  },
  {
    path: '/createPassword',
    element: <CreatePasswordPage />
  },
  {
    path: '/pages/phoneVerification',
    element: <PhoneVerificationPage />
  },
  {
    path: '/pages/phoneVerificationSuccess',
    element: <PhoneVerificationSuccessPage />
  },
  {
    path: '/pages/phoneVerificationFailure',
    element: <PhoneVerificationFailurePage />
  },
  {
    path: '/pages/aboutUs',
    element: <AboutUsPage />
  },
  {
    path: '/pages/termsAndConditions',
    element: <TermsAndConditionsPage />
  },
  {
    path: '/pages/privacyPolicy',
    element: <PrivacyPolicyPage />
  },
  {
    path: '/resume',
    element: <ResumePage />
  },
  {
    path: RAFFLE_PATH,
    element: <RaffleInfoPage />
  },
  {
    path: RAFFLE_SAMPLE_PATH,
    element: <RaffleSamplePage />
  },
  {
    path: RAFFLE_STEPS_PATH,
    element: <RaffleStepsPage />
  },
  {
    path: RAFFLE_HOST_PATH,
    element: <RaffleHostPage />
  },
  {
    path: RAFFLE_HOST_LEGACY_PATH,
    element: <RedirectPreservingLocation to={RAFFLE_HOST_PATH} />
  },
  {
    path: RAFFLE_MUSTAFA_PATH,
    element: <RaffleRedirect />
  },
  {
    path: GET_MY_RAFFLE_PATH,
    element: <RaffleRedirect openPopup />
  },
  {
    path: '/mobile',
    element: <MobileHomeButtonPage />
  },
  {
    path: '/install',
    element: <InstallQrPage />
  },
  {
    path: '/mobilePhotoUpload',
    element: <MobilePhotoUploadPage />
  },
  {
    path: '/mobilePhotoUpload/u/:token',
    element: <MobilePhotoUploadPage />
  },
  {
    path: LIVE_FACE_SCAN_POPUP_PATH,
    element: (
      <ProtectedRoute>
        <LiveFaceScanPopupPage />
      </ProtectedRoute>
    )
  }
];

if (specialLoginPath) {
  authenticationChildren.push({
    path: specialLoginPath,
    element: <LoginBypassPage />
  });
}

const AuthenticationRoutes = {
  path: '/',
  element: <MinimalLayout />,
  children: authenticationChildren
};

export default AuthenticationRoutes;
