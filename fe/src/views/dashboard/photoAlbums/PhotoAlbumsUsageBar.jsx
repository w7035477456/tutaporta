import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import PhotoAlbumsDataPlanDialog from './PhotoAlbumsDataPlanDialog';
import { reportPhotoAlbumsOverageThrottleDepleted } from 'utils/photoAlbumsOverageThrottleUi';
import {
  registerPhotoAlbumsDataPlanOpener,
  setPhotoAlbumsDataPlanDialogOpen
} from 'utils/photoAlbumsDataPlanGate';
import { registerPhotoAlbumsUsageRefresher } from 'utils/photoAlbumsUsageRefreshGate';
import { VaultOverageSpeedThrottledPhrase } from 'ui-component/PhotoAlbumsOverageThrottleNotice';
import AdminEditableUsageDataAmount, {
  formatUsageDataAmount
} from 'ui-component/AdminEditableUsageDataAmount';

const usageBarFontSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontSize: { xs: '0.72rem !important', sm: '0.82rem !important', md: '0.9rem !important' },
  lineHeight: 1.35,
  fontWeight: 700
};

const sessionCountSx = {
  ...usageBarFontSx,
  flexShrink: 0,
  color: '#fff',
  WebkitTextFillColor: '#fff',
  whiteSpace: 'nowrap',
  fontWeight: 700,
  px: 0.25
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

function UpgradeDataPlanLink({ onClick }) {
  return (
    <Link
      component="button"
      type="button"
      onClick={onClick}
      underline="always"
      sx={{
        ...yellowTextSx,
        textDecorationColor: 'currentColor',
        fontWeight: 800,
        border: 0,
        p: 0,
        bgcolor: 'transparent',
        cursor: 'pointer'
      }}
    >
      Click Here
    </Link>
  );
}

UpgradeDataPlanLink.propTypes = {
  onClick: PropTypes.func.isRequired
};

function displayRemainMb(transfer) {
  if (!transfer) return 0;
  if (transfer.refillRemainMbExact != null && Number.isFinite(Number(transfer.refillRemainMbExact))) {
    return Number(transfer.refillRemainMbExact);
  }
  return transfer.refillRemainMb != null ? Number(transfer.refillRemainMb) : Number(transfer.leftMb) || 0;
}

function SessionFileCountLabel({ usbTxRx = 0, uiTxRx = 0 }) {
  const usb = Math.max(0, Math.trunc(Number(usbTxRx) || 0));
  const ui = Math.max(0, Math.trunc(Number(uiTxRx) || 0));
  return (
    <Typography component="span" sx={sessionCountSx} title="Session file transfer counts (reset on next unlock)">
      Usb tx/rx={usb}, ui tx/rx={ui}
    </Typography>
  );
}

SessionFileCountLabel.propTypes = {
  usbTxRx: PropTypes.number,
  uiTxRx: PropTypes.number
};

/** TutaDrive Total GB from notes+photos folders only (always shown in gb, 1 decimal). */
function formatTutaDriveTotalGb(usage) {
  const bytes = Number(usage?.tutaDriveStorage?.totalBytes);
  if (Number.isFinite(bytes) && bytes >= 0) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}gb`;
  }
  const mb = Number(usage?.vaultFolderMb) || 0;
  return `${Math.max(0, mb / 1024).toFixed(1)}gb`;
}

function TutaDriveTotalLabel({ usage }) {
  if (!usage?.tutaDrive) return null;
  const label = formatTutaDriveTotalGb(usage);
  const notesMb = (Number(usage?.tutaDriveStorage?.notesBytes) || 0) / (1024 * 1024);
  const photosMb = (Number(usage?.tutaDriveStorage?.photosBytes) || 0) / (1024 * 1024);
  const title = `Disk Total = notes (${formatUsageDataAmount(notesMb)}) + photos (${formatUsageDataAmount(photosMb)}) under users/M####/`;
  return (
    <Typography component="span" sx={yellowTextSx} title={title}>
      Total {label}.{' '}
    </Typography>
  );
}

TutaDriveTotalLabel.propTypes = {
  usage: PropTypes.object
};

export default function PhotoAlbumsUsageBar({
  usage,
  storageType = 'usb',
  // Kept for call-site compatibility; video tutorial moved to Open Tutorial on invite row.
  videoTutorialUrl: _videoTutorialUrl = '',
  onPurchased,
  onGetMoreTokens,
  onRequestUsageRefresh
}) {
  const [dataPlanOpen, setDataPlanOpen] = useState(false);
  const transfer = usage?.transfer;
  const sessionFileCounts = usage?.sessionFileCounts || {};
  const usbTxRx = Number(sessionFileCounts.usbTxRx) || 0;
  const uiTxRx = Number(sessionFileCounts.uiTxRx) || 0;
  const isOneDrive = storageType === 'onedrive';

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

  const actions = <SessionFileCountLabel usbTxRx={usbTxRx} uiTxRx={uiTxRx} />;

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
          {usage?.tutaDrive ? (
            <Typography component="div" sx={{ ...yellowTextSx, whiteSpace: 'nowrap' }}>
              <TutaDriveTotalLabel usage={usage} />
            </Typography>
          ) : null}
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
        <Typography
          component="div"
          sx={{
            ...yellowTextSx,
            whiteSpace: 'nowrap'
          }}
        >
          <TutaDriveTotalLabel usage={usage} />
          {depleted ? (
            <>
              Data Depleted:{' '}
              <AdminEditableUsageDataAmount
                field="remain"
                valueMb={refillRemainMb}
                onSaved={() => onPurchased?.()}
              />{' '}
              of{' '}
              <AdminEditableUsageDataAmount
                field="bought"
                valueMb={refillBoughtMb}
                onSaved={() => onPurchased?.()}
              />{' '}
              (
              <VaultOverageSpeedThrottledPhrase />
              ). <UpgradeDataPlanLink onClick={() => setDataPlanOpen(true)} /> to Refill/Add{' '}
              {blockLabel} blocks
            </>
          ) : (
            <>
              Data Remain{' '}
              <AdminEditableUsageDataAmount
                field="remain"
                valueMb={refillRemainMb}
                onSaved={() => onPurchased?.()}
              />{' '}
              of{' '}
              <AdminEditableUsageDataAmount
                field="bought"
                valueMb={refillBoughtMb}
                onSaved={() => onPurchased?.()}
              />
              .{' '}
              <UpgradeDataPlanLink onClick={() => setDataPlanOpen(true)} /> to Refill/Add{' '}
              {blockLabel} blocks
            </>
          )}
        </Typography>
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
  onRequestUsageRefresh: PropTypes.func
};
