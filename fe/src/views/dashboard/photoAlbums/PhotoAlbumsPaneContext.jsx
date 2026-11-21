import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import {
  normalizeVaultPaneStorageType,
  VAULT_CLOUD_STORAGE_TYPE,
  VAULT_USB_STORAGE_TYPE
} from 'utils/vaultPaneStorageType';

const PhotoAlbumsPaneContext = createContext(null);

export function PhotoAlbumsPaneProvider({ storageType, children }) {
  const value = normalizeVaultPaneStorageType(storageType);
  return <PhotoAlbumsPaneContext.Provider value={value}>{children}</PhotoAlbumsPaneContext.Provider>;
}

PhotoAlbumsPaneProvider.propTypes = {
  storageType: PropTypes.oneOf([VAULT_CLOUD_STORAGE_TYPE, VAULT_USB_STORAGE_TYPE]).isRequired,
  children: PropTypes.node
};

export function usePhotoAlbumsPaneStorageType() {
  return useContext(PhotoAlbumsPaneContext);
}
