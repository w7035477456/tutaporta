import api from 'api/axios';
import { readStoredSignupReferralCode } from 'utils/signupReferralCode';
import { readStoredGoogleSignupToken } from 'utils/googleSignupOAuth';

/**
 * Finish Google signup after phone + Terms (no create-password email).
 * Sets auth cookie; caller should refresh AuthContext session.
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
