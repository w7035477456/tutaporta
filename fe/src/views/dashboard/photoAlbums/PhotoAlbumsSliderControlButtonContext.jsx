import { createContext, useContext, useMemo } from 'react';
import { getVaultDefaultButtonFontSizeRem } from 'config/photoAlbumsDefaultButtonFontSizeEnv';

/** myPhotoAlbums slider output (rem) — shared by SliderControlButton + font slider. */
const PhotoAlbumsSliderControlButtonFontContext = createContext(getVaultDefaultButtonFontSizeRem());

export function PhotoAlbumsSliderControlButtonProvider({ fontRem, children }) {
  const value = useMemo(() => fontRem, [fontRem]);
  return (
    <PhotoAlbumsSliderControlButtonFontContext.Provider value={value}>
      {children}
    </PhotoAlbumsSliderControlButtonFontContext.Provider>
  );
}

export function usePhotoAlbumsSliderControlButtonFontRem() {
  return useContext(PhotoAlbumsSliderControlButtonFontContext);
}
