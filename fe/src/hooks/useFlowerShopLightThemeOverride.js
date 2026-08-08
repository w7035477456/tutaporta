import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { useSinglesPreferences } from 'api/singlesPreferencesFe';
import {
  DEFAULT_NEW_USER_THEME_NAME,
  findThemeByName,
  getThemeOptionsFromEnv,
  isFlowerShopPath
} from 'utils/themeConfig';
import { beginFlowerShopLightThemeOverride, endFlowerShopLightThemeOverride } from 'utils/flowerShopThemeOverride';

/**
 * On /send-flower and /eMarketPlace/flowerShop, temporarily apply the light theme counterpart
 * when the user's stored theme is in the dark series; restore on leave.
 */
export default function useFlowerShopLightThemeOverride() {
  const { pathname } = useLocation();
  const { preferences } = useSinglesPreferences();
  const themeOptionsRef = useRef(getThemeOptionsFromEnv());
  const wasOnFlowerShopRef = useRef(false);

  useEffect(() => {
    const themeOptions = themeOptionsRef.current;
    const onFlowerShop = isFlowerShopPath(pathname);
    const themeFromDb =
      typeof preferences?.theme === 'string' && preferences.theme.trim()
        ? preferences.theme
        : DEFAULT_NEW_USER_THEME_NAME;
    const resolvedName = findThemeByName(themeFromDb, themeOptions)?.name || DEFAULT_NEW_USER_THEME_NAME;

    if (onFlowerShop) {
      beginFlowerShopLightThemeOverride(resolvedName, themeOptions);
      wasOnFlowerShopRef.current = true;
      return undefined;
    }

    if (wasOnFlowerShopRef.current) {
      endFlowerShopLightThemeOverride(resolvedName, themeOptions);
      wasOnFlowerShopRef.current = false;
    }

    return undefined;
  }, [pathname, preferences?.theme]);

  useEffect(() => {
    return () => {
      if (!wasOnFlowerShopRef.current) return;
      const themeOptions = themeOptionsRef.current;
      const themeFromDb =
        typeof preferences?.theme === 'string' && preferences.theme.trim()
          ? preferences.theme
          : DEFAULT_NEW_USER_THEME_NAME;
      const resolvedName = findThemeByName(themeFromDb, themeOptions)?.name || DEFAULT_NEW_USER_THEME_NAME;
      endFlowerShopLightThemeOverride(resolvedName, themeOptions);
      wasOnFlowerShopRef.current = false;
    };
  }, [preferences?.theme]);
}
