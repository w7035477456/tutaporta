import useSWR, { mutate } from 'swr';
import { useMemo } from 'react';

import { isNavigationCollapseDisabled } from 'config/navigationCollapseEnv';
import { sidebarMobileCloseMatches } from 'config/sidebarMobileCloseEnv';

const initialState = {
  isDashboardDrawerOpened: isNavigationCollapseDisabled()
};

const endpoints = {
  key: 'api/menu',
  master: 'master'
};

export function useGetMenuMaster() {
  const { data, isLoading } = useSWR(endpoints.key + endpoints.master, () => initialState, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const memoizedValue = useMemo(
    () => ({
      menuMaster: data ?? initialState,
      menuMasterLoading: isLoading && data == null
    }),
    [data, isLoading]
  );

  return memoizedValue;
}

export function handlerDrawerOpen(isDashboardDrawerOpened) {
  if (isNavigationCollapseDisabled() && !isDashboardDrawerOpened) {
    return;
  }
  // to update local state based on key

  mutate(
    endpoints.key + endpoints.master,
    (currentMenuMaster) => {
      return { ...currentMenuMaster, isDashboardDrawerOpened };
    },
    false
  );
}

/** Mobile viewport only — collapse sidebar after user picks a nav item (matches « Close Menu). */
export function closeSidebarAfterNavSelectIfMobile() {
  if (isNavigationCollapseDisabled()) return;
  if (!sidebarMobileCloseMatches()) return;
  handlerDrawerOpen(false);
}
