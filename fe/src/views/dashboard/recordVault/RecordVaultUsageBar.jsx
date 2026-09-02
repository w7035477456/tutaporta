import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import WorkspaceVideoTutorialPair from 'components/WorkspaceVideoTutorialPair';
import {
  TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL,
  TUTANOTES_USB_VIDEO_TUTORIAL_LABEL,
  TUTANOTES_WORKSPACE_PANEL_BG
} from './tutaNotesBranding';
import RecordVaultDataPlanDialog from './RecordVaultDataPlanDialog';
import TutaNotesWelcomeTutorialPopup from './TutaNotesWelcomeTutorialPopup';
import { reportRecordVaultOverageThrottleDepleted } from 'utils/recordVaultOverageThrottleUi';
import { VaultOverageSpeedThrottledPhrase } from 'ui-component/VaultOverageThrottleNotice';
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
        bgcolor: blackBar ? '#000' : TUTANOTES_WORKSPACE_PANEL_BG,
        borderBottom: blackBar ? '2px solid #000' : '2px solid var(--theme-primary-color)',
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

export default function RecordVaultUsageBar({
  usage,
  storageType = 'usb',
  videoTutorialUrl = '',
  onPurchased,
  onGetMoreTokens
}) {
  const [dataPlanOpen, setDataPlanOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const transfer = usage?.transfer;
  const sessionFileCounts = usage?.sessionFileCounts || {};
  const usbTxRx = Number(sessionFileCounts.usbTxRx) || 0;
  const uiTxRx = Number(sessionFileCounts.uiTxRx) || 0;
  const isOneDrive = storageType === 'onedrive';
  const tutorialDetail = isOneDrive
    ? TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL
    : TUTANOTES_USB_VIDEO_TUTORIAL_LABEL;

  useEffect(() => {
    if (!transfer) {
      return reportRecordVaultOverageThrottleDepleted(false);
    }
    const refillRemainMb =
      transfer.refillRemainMb != null ? Number(transfer.refillRemainMb) : Number(transfer.leftMb) || 0;
    const depleted = Boolean(transfer.overageThrottled) || refillRemainMb <= 0;
    return reportRecordVaultOverageThrottleDepleted(depleted);
  }, [transfer]);

  const actions = (
    <>
      <SessionFileCountLabel usbTxRx={usbTxRx} uiTxRx={uiTxRx} />
      <WorkspaceVideoTutorialPair
        videoTutorialUrl={videoTutorialUrl}
        onTutorialClick={() => setTutorialOpen(true)}
        tutorialVariant="orange"
        tutorialAriaLabel={tutorialDetail}
        tutorialTitle={tutorialDetail}
        iconHeight={{ xs: 28, sm: 32 }}
        sx={{ ml: 0 }}
      />
    </>
  );

  if (!transfer && !isOneDrive) {
    // USB often has no transfer quota — still show USB Bridge promo line + actions.
    return (
      <>
        <UsageBarShell actions={actions}>
          <Typography
            component="div"
            sx={{
              ...usageBarFontSx,
              color: 'var(--theme-primary-color)',
              whiteSpace: 'nowrap'
            }}
          >
            2M+ users trust local USB vaults —{' '}
            <Link
              component={RouterLink}
              to={PROFILES_RECORDS_PATH}
              state={{ openTab: 'buyTokens' }}
              underline="always"
              sx={{
                ...usageBarFontSx,
                color: 'var(--theme-primary-color)',
                textDecorationColor: 'currentColor'
              }}
            >
              USB Bridge
            </Link>
          </Typography>
        </UsageBarShell>
        <TutaNotesWelcomeTutorialPopup open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
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
        <TutaNotesWelcomeTutorialPopup open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      </>
    );
  }

  const refillRemainMb =
    transfer.refillRemainMb != null ? Number(transfer.refillRemainMb) : Number(transfer.leftMb) || 0;
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
      <RecordVaultDataPlanDialog
        open={dataPlanOpen}
        usage={usage}
        onClose={() => setDataPlanOpen(false)}
        onPurchased={onPurchased}
        onGetMoreTokens={onGetMoreTokens}
      />
      <TutaNotesWelcomeTutorialPopup open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </>
  );
}

RecordVaultUsageBar.propTypes = {
  usage: PropTypes.object,
  storageType: PropTypes.oneOf(['usb', 'onedrive']),
  videoTutorialUrl: PropTypes.string,
  onPurchased: PropTypes.func,
  onGetMoreTokens: PropTypes.func
};
