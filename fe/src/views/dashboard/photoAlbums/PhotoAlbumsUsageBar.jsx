import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import PhotoAlbumsDataPlanDialog from './PhotoAlbumsDataPlanDialog';
import { reportPhotoAlbumsOverageThrottleDepleted } from 'utils/photoAlbumsOverageThrottleUi';
import {
  registerPhotoAlbumsDataPlanOpener,
  setPhotoAlbumsDataPlanDialogOpen
} from 'utils/photoAlbumsDataPlanGate';
import { registerPhotoAlbumsUsageRefresher } from 'utils/photoAlbumsUsageRefreshGate';
import { VaultOverageSpeedThrottledPhrase } from 'ui-component/PhotoAlbumsOverageThrottleNotice';
import { formatUsageDataAmount } from 'ui-component/AdminEditableUsageDataAmount';
import WorkspaceVideoTutorialPair from 'components/WorkspaceVideoTutorialPair';
import SliderControlButton, { SLIDER_CONTROL_BUTTON_HOVER_SCALE_15 } from 'ui-component/SliderControlButton';
import {
  AddMoreGbLink,
  LastClickTransferLabel,
  ThrottleIndexLabel,
  UsageMeter,
  UsageStoragePill,
  transferUsedMb
} from '../recordVault/RecordVaultUsageBar';
import { openPhotoAlbumsContextTutorialPopout } from './photoAlbumsContextTutorialSync';

/** Fallback when site global video_tutorial_tutaphotoalbums is unset. */
const DEFAULT_PHOTO_ALBUMS_WATCH_TUTORIALS_URL = 'https://youtu.be/dMiwcH027fM';

const usageBarFontSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontSize: { xs: '0.72rem !important', sm: '0.82rem !important', md: '0.9rem !important' },
  lineHeight: 1.35,
  fontWeight: 700
};

const yellowTextSx = {
  ...usageBarFontSx,
  color: 'var(--theme-yellow-color)',
  WebkitTextFillColor: 'var(--theme-yellow-color)'
};

function UsageBarShell({ children, actions, blackBar = false }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: '100%',
        bgcolor: blackBar ? '#000' : 'var(--theme-daynight-color)',
        borderBottom: blackBar ? '2px solid #000' : '2px solid var(--theme-daynight-color)',
        px: { xs: 1, md: 1.5 },
        py: 0.55,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0
      }}
    >
      <Box sx={{ flex: '1 1 auto', minWidth: 0, overflowX: 'auto' }}>{children}</Box>
      {actions ? (
        <Box
          sx={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            ml: 'auto'
          }}
        >
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}

UsageBarShell.propTypes = {
  children: PropTypes.node,
  actions: PropTypes.node,
  blackBar: PropTypes.bool
};

function displayRemainMb(transfer) {
  if (!transfer) return 0;
  if (transfer.refillRemainMbExact != null && Number.isFinite(Number(transfer.refillRemainMbExact))) {
    return Number(transfer.refillRemainMbExact);
  }
  return transfer.refillRemainMb != null ? Number(transfer.refillRemainMb) : Number(transfer.leftMb) || 0;
}

/** MB stored on disk for this member's TutaPhotos, or null when the server did not report it. */
function tutaPhotosStorageMb(usage) {
  const photosBytes = Number(usage?.tutaDriveStorage?.photosBytes);
  if (Number.isFinite(photosBytes) && photosBytes >= 0) return photosBytes / (1024 * 1024);
  const folderMb = Number(usage?.vaultFolderMb);
  if (Number.isFinite(folderMb) && folderMb > 0) return folderMb;
  return null;
}

function StorageAndLastClickRow({ usage }) {
  const storageMb = tutaPhotosStorageMb(usage);
  const title =
    storageMb == null
      ? ''
      : `TutaPhotos storage ${formatUsageDataAmount(storageMb, { precisionGb: 2 })} on disk`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      {storageMb == null ? null : <UsageStoragePill storageMb={storageMb} title={title} />}
      <LastClickTransferLabel />
    </Box>
  );
}

StorageAndLastClickRow.propTypes = {
  usage: PropTypes.object
};

export default function PhotoAlbumsUsageBar({
  usage,
  storageType = 'usb',
  videoTutorialUrl = '',
  onPurchased,
  onGetMoreTokens,
  onRequestUsageRefresh,
  /** Yellow "Restore Sample Album" button left of the tutorials; hidden when null. */
  onRestoreSampleAlbum = null,
  restoreSampleAlbumDisabled = false
}) {
  const [dataPlanOpen, setDataPlanOpen] = useState(false);
  const transfer = usage?.transfer;
  const isOneDrive = storageType === 'tutadrive';

  useEffect(() => {
    return registerPhotoAlbumsDataPlanOpener(() => setDataPlanOpen(true));
  }, []);

  useEffect(() => {
    if (typeof onRequestUsageRefresh !== 'function') return undefined;
    return registerPhotoAlbumsUsageRefresher(onRequestUsageRefresh);
  }, [onRequestUsageRefresh]);

  useEffect(() => {
    setPhotoAlbumsDataPlanDialogOpen(dataPlanOpen);
    return () => setPhotoAlbumsDataPlanDialogOpen(false);
  }, [dataPlanOpen]);

  useEffect(() => {
    if (!transfer) {
      return reportPhotoAlbumsOverageThrottleDepleted(false);
    }
    const refillRemainMb = displayRemainMb(transfer);
    const depleted = Boolean(transfer.overageThrottled) || refillRemainMb <= 0;
    return reportPhotoAlbumsOverageThrottleDepleted(depleted);
  }, [transfer]);

  const actions = (
    <>
      {typeof onRestoreSampleAlbum === 'function' ? (
        <SliderControlButton
          type="button"
          variant="yellow"
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          disabled={restoreSampleAlbumDisabled}
          onClick={onRestoreSampleAlbum}
          title="Bring back SAMPLE SET, SAMPLE ALBUM and its sample photos (your other albums are not touched)"
          sx={{ px: 0.75, py: 0.3, whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          Restore Sample Album
        </SliderControlButton>
      ) : null}
      <WorkspaceVideoTutorialPair
      videoTutorialUrl={String(videoTutorialUrl || '').trim() || DEFAULT_PHOTO_ALBUMS_WATCH_TUTORIALS_URL}
      onTutorialClick={() => openPhotoAlbumsContextTutorialPopout()}
      tutorialVariant="orange"
      tutorialAriaLabel="Open context tutorial"
      tutorialTitle="Open context tutorial in a floating window (stays in sync; drag to another monitor)"
      sx={{ ml: 0 }}
      />
    </>
  );

  const dataPlanDialog = (
    <PhotoAlbumsDataPlanDialog
      open={dataPlanOpen}
      usage={usage}
      onClose={() => setDataPlanOpen(false)}
      onPurchased={onPurchased}
      onGetMoreTokens={onGetMoreTokens}
    />
  );

  if (!transfer && !isOneDrive) {
    // USB often has no transfer quota — still show session/tutorial actions.
    return (
      <>
        <UsageBarShell actions={actions}>{null}</UsageBarShell>
        {dataPlanDialog}
      </>
    );
  }

  if (!transfer) {
    return (
      <>
        <UsageBarShell actions={actions}>
          <StorageAndLastClickRow usage={usage} />
        </UsageBarShell>
        {dataPlanDialog}
      </>
    );
  }

  const refillRemainMb = displayRemainMb(transfer);
  const depleted = Boolean(transfer.overageThrottled) || refillRemainMb <= 0;
  const refillBoughtMb =
    transfer.refillBoughtMb != null
      ? Number(transfer.refillBoughtMb)
      : Number(transfer.refillBlockMb) || 10 * 1024;
  const refillBlockMb = Number(transfer.refillBlockMb) || 10 * 1024;
  const blockLabel = formatUsageDataAmount(refillBlockMb);

  return (
    <>
      <UsageBarShell actions={actions} blackBar>
        <StorageAndLastClickRow usage={usage} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, mt: 0.5 }}>
          <UsageMeter
            usedMb={transferUsedMb(transfer, refillBoughtMb)}
            boughtMb={refillBoughtMb}
            remainMb={refillRemainMb}
            blockLabel={blockLabel}
            depleted={depleted}
            onOpenPlan={() => setDataPlanOpen(true)}
            onSaved={() => onPurchased?.()}
          />
          <AddMoreGbLink onClick={() => setDataPlanOpen(true)} />
          <ThrottleIndexLabel factor={Number(transfer.throttleFactor) || (depleted ? 10 : 1)} />
          {depleted ? (
            <Typography component="span" sx={{ ...yellowTextSx, whiteSpace: 'nowrap' }}>
              (<VaultOverageSpeedThrottledPhrase />)
            </Typography>
          ) : null}
        </Box>
      </UsageBarShell>
      {dataPlanDialog}
    </>
  );
}

PhotoAlbumsUsageBar.propTypes = {
  usage: PropTypes.object,
  storageType: PropTypes.oneOf(['usb', 'onedrive']),
  videoTutorialUrl: PropTypes.string,
  onPurchased: PropTypes.func,
  onGetMoreTokens: PropTypes.func,
  onRequestUsageRefresh: PropTypes.func,
  onRestoreSampleAlbum: PropTypes.func,
  restoreSampleAlbumDisabled: PropTypes.bool
};
