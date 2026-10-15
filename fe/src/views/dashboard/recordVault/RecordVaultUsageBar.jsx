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
  formatUsageDataAmount,
  formatUsageDataAmountCompact
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

/** TutaDrive notes+photos disk use in MB (falls back to the vault folder size). */
function tutaDriveUsedMb(usage) {
  const bytes = Number(usage?.tutaDriveStorage?.totalBytes);
  if (Number.isFinite(bytes) && bytes >= 0) return bytes / (1024 * 1024);
  return Math.max(0, Number(usage?.vaultFolderMb) || 0);
}

/** Red segment never shrinks below this, so its label stays readable. */
const USAGE_METER_MIN_RED_PX = 76;

const usageMeterLabelSx = {
  ...usageBarFontSx,
  fontSize: { xs: '0.8rem !important', sm: '0.92rem !important', md: '1rem !important' },
  fontWeight: 900,
  color: '#000',
  WebkitTextFillColor: '#000',
  whiteSpace: 'nowrap',
  px: 0.75
};

/**
 * Red = bytes used (TutaDrive disk total, else data used), green = data plan bought.
 * Click anywhere (except an admin-editable amount) to open Refill / Add blocks.
 */
function UsageMeter({ usedMb, boughtMb, remainMb, blockLabel, depleted, onOpenPlan, onSaved }) {
  const used = Math.max(0, Number(usedMb) || 0);
  const bought = Math.max(0, Number(boughtMb) || 0);
  const usedPct = used + bought > 0 ? (used / (used + bought)) * 100 : 0;
  const title =
    `Used ${formatUsageDataAmount(used)} · Data Remain ${formatUsageDataAmount(remainMb)} of ` +
    `${formatUsageDataAmount(bought)}. Click to Refill/Add ${blockLabel} blocks.`;
  const openPlan = (event) => {
    if (event.target instanceof Element && event.target.closest('[data-admin-usage-amount]')) return;
    onOpenPlan();
  };
  return (
    <Box
      component="button"
      type="button"
      onClick={openPlan}
      title={title}
      aria-label={title}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        maxWidth: 640,
        minHeight: 30,
        p: 0,
        border: '2px solid #fff',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: '#000',
        cursor: 'pointer'
      }}
    >
      <Box
        sx={{
          flex: '0 0 auto',
          width: `max(${USAGE_METER_MIN_RED_PX}px, ${usedPct.toFixed(2)}%)`,
          bgcolor: '#e53935',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '2px solid #000'
        }}
      >
        <Box component="span" sx={usageMeterLabelSx}>
          {formatUsageDataAmountCompact(used)}
        </Box>
      </Box>
      <Box
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          bgcolor: depleted ? '#9e9e9e' : '#60C447',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box component="span" sx={usageMeterLabelSx}>
          <AdminEditableUsageDataAmount field="bought" valueMb={bought} onSaved={onSaved} compact />
          {depleted ? ' — depleted, click to refill' : ''}
        </Box>
      </Box>
    </Box>
  );
}

UsageMeter.propTypes = {
  usedMb: PropTypes.number,
  boughtMb: PropTypes.number,
  remainMb: PropTypes.number,
  blockLabel: PropTypes.string,
  depleted: PropTypes.bool,
  onOpenPlan: PropTypes.func.isRequired,
  onSaved: PropTypes.func
};

function AddMoreGbLink({ onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 0.75,
        py: 0.25,
        border: '1px solid #000',
        borderRadius: 0.5,
        bgcolor: 'var(--theme-yellow-color)',
        cursor: 'pointer',
        lineHeight: 1.1
      }}
    >
      <Box
        component="span"
        sx={{
          ...usageBarFontSx,
          lineHeight: 1.1,
          color: '#000',
          WebkitTextFillColor: '#000',
          textDecoration: 'underline',
          whiteSpace: 'nowrap'
        }}
      >
        Click here
      </Box>
      <Box
        component="span"
        sx={{
          ...usageBarFontSx,
          fontSize: { xs: '0.55rem !important', sm: '0.62rem !important', md: '0.68rem !important' },
          lineHeight: 1.1,
          color: '#000',
          WebkitTextFillColor: '#000',
          whiteSpace: 'nowrap'
        }}
      >
        to add more gb
      </Box>
    </Box>
  );
}

AddMoreGbLink.propTypes = {
  onClick: PropTypes.func.isRequired
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
  const isOneDrive = storageType === 'tutadrive';
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
        iconHeight={{ xs: 56, sm: 64 }}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <UsageMeter
            usedMb={usage?.tutaDrive ? tutaDriveUsedMb(usage) : Math.max(0, refillBoughtMb - refillRemainMb)}
            boughtMb={refillBoughtMb}
            remainMb={refillRemainMb}
            blockLabel={blockLabel}
            depleted={depleted}
            onOpenPlan={() => setDataPlanOpen(true)}
            onSaved={() => onPurchased?.()}
          />
          <AddMoreGbLink onClick={() => setDataPlanOpen(true)} />
          {depleted ? (
            <Typography component="span" sx={{ ...yellowTextSx, whiteSpace: 'nowrap' }}>
              (<VaultOverageSpeedThrottledPhrase />)
            </Typography>
          ) : null}
        </Box>
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
