import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';

const PhotoAlbumsPaneContext = createContext(null);

export function PhotoAlbumsPaneProvider({ storageType, children }) {
  const normalized = String(storageType || '').trim().toLowerCase();
  const value = normalized === 'onedrive' ? 'onedrive' : 'usb';
  return <PhotoAlbumsPaneContext.Provider value={value}>{children}</PhotoAlbumsPaneContext.Provider>;
}

PhotoAlbumsPaneProvider.propTypes = {
  storageType: PropTypes.oneOf(['onedrive', 'usb']).isRequired,
  children: PropTypes.node
};

export function usePhotoAlbumsPaneStorageType() {
  return useContext(PhotoAlbumsPaneContext);
}
