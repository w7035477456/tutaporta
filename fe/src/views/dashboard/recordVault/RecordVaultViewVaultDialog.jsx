import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import RecordVaultOneDriveVaultTreePanel from './RecordVaultOneDriveVaultTreePanel';

export default function RecordVaultViewVaultDialog({
  open,
  onClose,
  storageType = 'onedrive',
  folderName = '',
  tutaDrive = false
}) {
  const [treeLoading, setTreeLoading] = useState(false);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const isUsb = storageType === 'usb';

  useEffect(() => {
    if (open) setLoadGeneration((value) => value + 1);
  }, [open, storageType]);

  const title = isUsb
    ? 'View USB Folder/Files'
    : tutaDrive
      ? 'View TutaDrive Folder/Files'
      : 'View OneDrive Folder/Files';
  const busyLabel = isUsb
    ? 'Loading USB vault tree'
    : tutaDrive
      ? 'Loading TutaDrive vault tree'
      : 'Loading OneDrive vault tree';

  return (
    <>
      <BusyHourglassOverlay open={open && treeLoading} label={busyLabel} fontSize={BUSY_HOURGLASS_MODAL_SIZE} />
      <ColorTemplate16PopupCenterWide
        open={open}
        onClose={treeLoading ? undefined : onClose}
        closeOnBackdrop={false}
      >
        <ColorTemplate16PopupCenterWide.Title>{title}</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={1.5}>
          <RecordVaultOneDriveVaultTreePanel
            active={open}
            storageType={isUsb ? 'usb' : 'onedrive'}
            folderName={folderName}
            refreshToken={loadGeneration}
            onLoadingChange={setTreeLoading}
            maxHeight="28vh"
          />
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}

RecordVaultViewVaultDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  storageType: PropTypes.oneOf(['onedrive', 'usb']),
  folderName: PropTypes.string,
  tutaDrive: PropTypes.bool
};
