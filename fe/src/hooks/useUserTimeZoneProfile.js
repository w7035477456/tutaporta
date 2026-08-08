import { useMemo } from 'react';
import { useAuth } from 'contexts/AuthContext';

/** Logged-in user zip/phone for datetime display (zip preferred over phone area code). */
export function useUserTimeZoneProfile(overrides = {}) {
  const { user } = useAuth();
  return useMemo(
    () => ({
      zip: overrides.zip ?? user?.mailing_zip ?? null,
      phone: overrides.phone ?? user?.phone ?? null
    }),
    [overrides.zip, overrides.phone, user?.mailing_zip, user?.phone]
  );
}
