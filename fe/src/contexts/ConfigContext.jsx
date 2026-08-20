import PropTypes from 'prop-types';
import { createContext, useEffect, useMemo } from 'react';

// project imports
import config from 'config';
import {
  ALGERIAN_DEFAULT_MIGRATION_FLAG,
  ENV_MAIN_FONT_FAMILY,
  applyMainFontFamily,
  ensureMainFontStylesheet,
  findMainFontOptionByStack,
  resolveStoredMainFontStack
} from 'config/mainFontEnv';
import { useLocalStorage } from 'hooks/useLocalStorage';

// ==============================|| CONFIG CONTEXT ||============================== //

export const ConfigContext = createContext(undefined);

// ==============================|| CONFIG PROVIDER ||============================== //

export function ConfigProvider({ children }) {
  const { state, setState, setField, resetState } = useLocalStorage('vsingles-config-vite-js', config);

  // Always start each app session at the default zoom level.
  useEffect(() => {
    setField('pageZoom', config.pageZoom);
  }, [setField]);

  const fontFamily = resolveStoredMainFontStack(state) || ENV_MAIN_FONT_FAMILY;

  useEffect(() => {
    if (state.fontFamily === fontFamily && state[ALGERIAN_DEFAULT_MIGRATION_FLAG]) return;
    setState((prev) => ({
      ...prev,
      fontFamily,
      [ALGERIAN_DEFAULT_MIGRATION_FLAG]: true
    }));
  }, [fontFamily, setState, state.fontFamily, state[ALGERIAN_DEFAULT_MIGRATION_FLAG]]);

  // Apply MAIN_FONT override (CSS var) so MAIN_FONT_FAMILY consumers update site-wide.
  useEffect(() => {
    const option = findMainFontOptionByStack(fontFamily);
    ensureMainFontStylesheet(option);
    applyMainFontFamily(fontFamily);
  }, [fontFamily]);

  const stateWithFont = useMemo(() => ({ ...state, fontFamily }), [state, fontFamily]);

  const memoizedValue = useMemo(
    () => ({ state: stateWithFont, setState, setField, resetState }),
    [stateWithFont, setField, setState, resetState]
  );

  return <ConfigContext.Provider value={memoizedValue}>{children}</ConfigContext.Provider>;
}

ConfigProvider.propTypes = { children: PropTypes.node };
