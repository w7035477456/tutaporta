import api from 'api/axios';
import { readStoredSignupReferralCode } from 'utils/signupReferralCode';
import { readStoredGoogleSignupToken } from 'utils/googleSignupOAuth';

/**
 * Finish Google signup after SMS verify (no password UI, no auto-login).
 * Account is created; caller navigates to congratulations / Go to Login.
 */
export async function completeGoogleSignup({ email, phone, signupToken, termsAccepted = true }) {
  const ref = readStoredSignupReferralCode();
  const token = String(signupToken || readStoredGoogleSignupToken() || '').trim();
  const { data } = await api.post('/api/auth/google/signup/complete', {
    email,
    phone,
    signupToken: token,
    termsAccepted: Boolean(termsAccepted),
    ref: ref || undefined,
    token: ref || undefined
  });
  return data;
}
