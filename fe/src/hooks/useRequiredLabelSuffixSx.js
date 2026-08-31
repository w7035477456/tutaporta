import { useMemo, useSyncExternalStore } from 'react';
import { buildRequiredLabelSuffixSx } from 'config/requiredLabelSuffix';
import {
  DEFAULT_NEW_USER_THEME_NAME,
  getThemeOptionsFromEnv,
  readActiveThemeName
} from 'utils/themeConfig';

function subscribeThemeChoice(onStoreChange) {
  if (typeof window === 'undefined') return () => {};
  const onChange = () => onStoreChange();
  window.addEventListener('storage', onChange);
  window.addEventListener('vsingles-theme-choice', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('vsingles-theme-choice', onChange);
  };
}

function getThemeChoiceSnapshot() {
  return readActiveThemeName(getThemeOptionsFromEnv());
}

export default function useRequiredLabelSuffixSx() {
  const themeName = useSyncExternalStore(
    subscribeThemeChoice,
    getThemeChoiceSnapshot,
    () => DEFAULT_NEW_USER_THEME_NAME
  );
  return useMemo(() => buildRequiredLabelSuffixSx(themeName), [themeName]);
}
