import { createContext, useContext, useMemo } from 'react';
import { getVaultDefaultButtonFontSizeRem } from 'config/photoAlbumsDefaultButtonFontSizeEnv';

const defaultFontConfig = () => ({
  fontRem: getVaultDefaultButtonFontSizeRem(),
  followEnvVw: true
});

/** myPhotoAlbums slider output (rem) — shared by SliderControlButton + font slider. */
const PhotoAlbumsSliderControlButtonFontContext = createContext(defaultFontConfig());

export function PhotoAlbumsSliderControlButtonProvider({ fontRem, followEnvVw = true, children }) {
  const value = useMemo(
    () => ({
      fontRem,
      followEnvVw: Boolean(followEnvVw)
    }),
    [fontRem, followEnvVw]
  );
  return (
    <PhotoAlbumsSliderControlButtonFontContext.Provider value={value}>
      {children}
    </PhotoAlbumsSliderControlButtonFontContext.Provider>
  );
}

export function usePhotoAlbumsSliderControlButtonFontConfig() {
  return useContext(PhotoAlbumsSliderControlButtonFontContext);
}

export function usePhotoAlbumsSliderControlButtonFontRem() {
  return usePhotoAlbumsSliderControlButtonFontConfig().fontRem;
}
