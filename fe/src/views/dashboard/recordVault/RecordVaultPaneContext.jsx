import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';

const RecordVaultPaneContext = createContext(null);

export function RecordVaultPaneProvider({ storageType, children }) {
  const normalized = String(storageType || '').trim().toLowerCase();
  const value = normalized === 'onedrive' ? 'onedrive' : 'usb';
  return <RecordVaultPaneContext.Provider value={value}>{children}</RecordVaultPaneContext.Provider>;
}

RecordVaultPaneProvider.propTypes = {
  storageType: PropTypes.oneOf(['onedrive', 'usb']).isRequired,
  children: PropTypes.node
};

export function useRecordVaultPaneStorageType() {
  return useContext(RecordVaultPaneContext);
}
