import { useSyncExternalStore } from 'react';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE } from 'config/busyHourglassEnv';
import {
  getPhotoAlbumsLeaveBusySnapshot,
  subscribePhotoAlbumsLeaveBusy
} from 'utils/photoAlbumsLeaveBusyUi';

const leaveBusyBackdropSx = {
  bgcolor: 'rgba(0, 0, 0, 0.72)',
  backgroundImage: 'none'
};

/** Full-app hourglass while Exit to Mall / Logout flushes Cloud + USB. */
export default function PhotoAlbumsLeaveBusyOverlay() {
  const busy = useSyncExternalStore(
    subscribePhotoAlbumsLeaveBusy,
    getPhotoAlbumsLeaveBusySnapshot,
    () => ({ open: false, title: 'Saving vault', percent: 0, label: '' })
  );

  return (
    <BusyHourglassOverlay
      open={Boolean(busy.open)}
      label={busy.title || 'Saving vault'}
      progressPercent={busy.open ? busy.percent : null}
      progressLabel={busy.label || ''}
      backdropSx={leaveBusyBackdropSx}
      fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
    />
  );
}
