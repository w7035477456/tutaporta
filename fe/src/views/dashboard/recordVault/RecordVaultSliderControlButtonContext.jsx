import { createContext, useContext, useMemo } from 'react';
import { getVaultDefaultButtonFontSizeRem } from 'config/vaultDefaultButtonFontSizeEnv';

const defaultFontConfig = () => ({
  fontRem: getVaultDefaultButtonFontSizeRem(),
  /** When true, SliderControlButton uses MOBILE_/DESKTOP_FONT_SIZE_BUTTON (vw) like the profile menu. */
  followEnvVw: true
});

/** myNote slider output — shared by SliderControlButton + layout helpers. */
const RecordVaultSliderControlButtonFontContext = createContext(defaultFontConfig());

export function RecordVaultSliderControlButtonProvider({ fontRem, followEnvVw = false, children }) {
  const value = useMemo(
    () => ({
      fontRem,
      followEnvVw: Boolean(followEnvVw)
    }),
    [fontRem, followEnvVw]
  );
  return (
    <RecordVaultSliderControlButtonFontContext.Provider value={value}>
      {children}
    </RecordVaultSliderControlButtonFontContext.Provider>
  );
}

export function useRecordVaultSliderControlButtonFontConfig() {
  return useContext(RecordVaultSliderControlButtonFontContext);
}

export function useRecordVaultSliderControlButtonFontRem() {
  return useRecordVaultSliderControlButtonFontConfig().fontRem;
}
