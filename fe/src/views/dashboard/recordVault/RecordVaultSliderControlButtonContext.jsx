import { createContext, useContext, useMemo } from 'react';
import { getVaultDefaultButtonFontSizeRem } from 'config/vaultDefaultButtonFontSizeEnv';

/** myNote slider output (rem) — shared by SliderControlButton + font slider. */
const RecordVaultSliderControlButtonFontContext = createContext(getVaultDefaultButtonFontSizeRem());

export function RecordVaultSliderControlButtonProvider({ fontRem, children }) {
  const value = useMemo(() => fontRem, [fontRem]);
  return (
    <RecordVaultSliderControlButtonFontContext.Provider value={value}>
      {children}
    </RecordVaultSliderControlButtonFontContext.Provider>
  );
}

export function useRecordVaultSliderControlButtonFontRem() {
  return useContext(RecordVaultSliderControlButtonFontContext);
}
