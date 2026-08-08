import { useEffect, useMemo, useState } from 'react';

import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
export function isCssDarkThemeActive() {
  if (typeof document === 'undefined') return false;
  const raw = String(getComputedStyle(document.documentElement).getPropertyValue('--theme-daynight-color') || '')
    .trim()
    .toLowerCase();
  if (raw === '#000' || raw === '#000000' || raw === 'black') return true;
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return false;
  const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r === 0 && g === 0 && b === 0;
}

/** Text colors for /send-flower and /eMarketPlace/flowerShop (plain white page background). */
export default function useFriendsThemeBackground() {
  const [isDarkTheme, setIsDarkTheme] = useState(() => isCssDarkThemeActive());

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const refreshTheme = () => setIsDarkTheme(isCssDarkThemeActive());
    refreshTheme();
    const observer = new MutationObserver(refreshTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => observer.disconnect();
  }, []);

  const darkThemeActive = isDarkTheme;
  const pageTextColor = darkThemeActive ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)';
  const filterTextColor = 'var(--theme-inverse-daynight-color)';

  const titleFontSx = useMemo(
    () => ({
      color: 'var(--theme-primary-color)',
      fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() }
    }),
    []
  );

  const friendsBackgroundBoxSx = useMemo(
    () => ({
      width: '100%',
      p: { xs: 1, sm: 1.5 },
      borderRadius: 1,
      backgroundColor: '#ffffff'
    }),
    []
  );

  return {
    isDarkTheme,
    darkThemeActive,
    pageTextColor,
    filterTextColor,
    titleFontSx,
    friendsBackgroundBoxSx
  };
}
