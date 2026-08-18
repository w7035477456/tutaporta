// project imports
import Loadable, { lazy } from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';
import ProtectedRoute from 'ui-component/ProtectedRoute';
import { LIVE_FACE_SCAN_POPUP_PATH } from 'constants/liveFaceScanPopupRoute';
import { getSpecialLoginPath } from 'config/specialLoginEnv';

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
const LiveFaceScanPopupPage = Loadable(lazy(() => import('views/utilities/LiveFaceScanPopupPage')));

// ==============================|| AUTHENTICATION ROUTING ||============================== //

const specialLoginPath = getSpecialLoginPath();

const authenticationChildren = [
    {
      path: '/pages/login',
      element: <LoginPage />
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
