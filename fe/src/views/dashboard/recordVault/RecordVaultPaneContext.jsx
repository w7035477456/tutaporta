import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import { normalizeVaultPaneStorageType, VAULT_CLOUD_STORAGE_TYPE } from 'utils/vaultPaneStorageType';

const RecordVaultPaneContext = createContext(null);

export function RecordVaultPaneProvider({ storageType, children }) {
  const value = normalizeVaultPaneStorageType(storageType);
  return <RecordVaultPaneContext.Provider value={value}>{children}</RecordVaultPaneContext.Provider>;
}

RecordVaultPaneProvider.propTypes = {
  storageType: PropTypes.oneOf([VAULT_CLOUD_STORAGE_TYPE, 'usb']).isRequired,
  children: PropTypes.node
};

export function useRecordVaultPaneStorageType() {
  return useContext(RecordVaultPaneContext);
}
