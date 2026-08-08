import PropTypes from 'prop-types';
import { createContext, useEffect, useMemo } from 'react';

// project imports
import config from 'config';
import {
  ENV_MAIN_FONT_FAMILY,
  applyMainFontFamily,
  ensureMainFontStylesheet,
  findMainFontOptionByStack
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

  const fontFamily = state.fontFamily || ENV_MAIN_FONT_FAMILY;

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
