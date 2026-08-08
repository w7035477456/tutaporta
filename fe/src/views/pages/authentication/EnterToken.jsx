import { useSearchParams } from 'react-router-dom';

import ClaimToken from './ClaimToken';
import Register from './Register';
import { getClaimTokenReferralFromSearchParams } from 'utils/signupReferralCode';

/** /entertoken — manual code entry, or full sign-up when ?token= is present. */
export default function EnterToken() {
  const [searchParams] = useSearchParams();
  const token = getClaimTokenReferralFromSearchParams(searchParams);
  if (token) {
    return <Register />;
  }
  return <ClaimToken />;
}
