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
import { useLastClickTransferMb } from 'utils/lastClickTransferMeter';
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

function LastClickTransferLabel() {
  const mb = useLastClickTransferMb();
  return (
    <Typography
      component="span"
      sx={yellowTextSx}
      title="Data moved between server and browser by your last click"
    >
      {mb.toFixed(1)} mb
    </Typography>
  );
}

/** MB stored on disk for this member's TutaNotes, or null when the server did not report it. */
function tutaNotesStorageMb(usage) {
  const notesBytes = Number(usage?.tutaDriveStorage?.notesBytes);
  if (Number.isFinite(notesBytes) && notesBytes >= 0) return notesBytes / (1024 * 1024);
  const folderMb = Number(usage?.vaultFolderMb);
  if (Number.isFinite(folderMb) && folderMb > 0) return folderMb;
  return null;
}

/** Yellow strip above the data meter: total TutaNotes storage for this member. */
function TutaNotesStorageBar({ usage }) {
  const storageMb = tutaNotesStorageMb(usage);
  if (storageMb == null) return null;
  const photosMb = (Number(usage?.tutaDriveStorage?.photosBytes) || 0) / (1024 * 1024);
  const title = usage?.tutaDriveStorage
    ? `TutaNotes storage ${formatUsageDataAmount(storageMb, { precisionGb: 2 })} on disk ` +
      `(photos ${formatUsageDataAmount(photosMb, { precisionGb: 2 })} counted separately)`
    : `TutaNotes storage ${formatUsageDataAmount(storageMb, { precisionGb: 2 })} on disk`;
  return (
    <Box
      title={title}
      aria-label={title}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        minHeight: 26,
        px: 1,
        border: '2px solid #fff',
        borderRadius: 1,
        bgcolor: 'var(--theme-yellow-color)'
      }}
    >
      <Box component="span" sx={usageMeterLabelSx}>
        Storage {formatUsageDataAmountCompact(storageMb)}
      </Box>
    </Box>
  );
}

TutaNotesStorageBar.propTypes = {
  usage: PropTypes.object
};

function StorageAndLastClickRow({ usage }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <TutaNotesStorageBar usage={usage} />
      <LastClickTransferLabel />
    </Box>
  );
}

StorageAndLastClickRow.propTypes = {
  usage: PropTypes.object
};

/**
 * Data used from the current plan: singles.refill_bought_mb − refill_remain_mb (Postgres, per user)
 * minus Redis sub-MB pending. Every TutaNotes / TutaPhoto download / upload / restore / merge / open
 * lowers remain, so this only grows until the next purchase.
 */
function transferUsedMb(transfer, boughtMb) {
  const remainExact = Number(transfer?.refillRemainMbExact);
  const remain = Number.isFinite(remainExact) ? remainExact : Number(transfer?.refillRemainMb) || 0;
  return Math.max(0, (Number(boughtMb) || 0) - remain);
}

const throttleIndexSx = {
  ...usageBarFontSx,
  flexShrink: 0,
  fontWeight: 900,
  color: '#fff',
  WebkitTextFillColor: '#fff',
  whiteSpace: 'nowrap',
  px: 0.5
};

/** "T10" = transfers currently run 10× slower; "T1" = full speed. */
function ThrottleIndexLabel({ factor }) {
  const n = Math.max(1, Math.round(Number(factor) || 1));
  const title = n > 1 ? `Data depleted — transfers are ${n}× slower. Refill to return to full speed.` : 'Full transfer speed';
  return (
    <Typography component="span" sx={throttleIndexSx} title={title}>
      T{n}
    </Typography>
  );
}

ThrottleIndexLabel.propTypes = {
  factor: PropTypes.number
};

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
 * Red = data used. Green = data still left.
 * Widths are shares of the purchased total, so the two labels add up to that total
 * (10gb bought and 4gb used → red 4gb + green 6gb).
 * Click anywhere (except an admin-editable amount) to open Refill / Add blocks.
 */
function UsageMeter({ usedMb, boughtMb, remainMb, blockLabel, depleted, onOpenPlan, onSaved }) {
  const bought = Math.max(0, Number(boughtMb) || 0);
  const usedRaw = Math.max(0, Number(usedMb) || 0);
  const used = bought > 0 ? Math.min(usedRaw, bought) : usedRaw;
  const remain = bought > 0 ? Math.max(0, bought - used) : Math.max(0, Number(remainMb) || 0);
  const showUsed = used > 0;
  const showRemain = remain > 0 || !showUsed;
  const fmt = (mb) => formatUsageDataAmount(mb, { precisionGb: 2 });
  const title =
    `Used ${fmt(used)} · ${fmt(remain)} left of ${fmt(bought)}. Click to Refill/Add ${blockLabel} blocks.`;
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
      {showUsed ? (
        <Box
          sx={{
            flexGrow: used,
            flexShrink: 1,
            flexBasis: 0,
            minWidth: showRemain && remain > 0 ? USAGE_METER_MIN_RED_PX : 0,
            bgcolor: '#e53935',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: showRemain && remain > 0 ? '2px solid #000' : 'none'
          }}
        >
          <Box component="span" sx={usageMeterLabelSx}>
            {formatUsageDataAmountCompact(used)}
          </Box>
        </Box>
      ) : null}
      {showRemain ? (
        <Box
          sx={{
            flexGrow: remain > 0 ? remain : 1,
            flexShrink: 1,
            flexBasis: 0,
            minWidth: 0,
            bgcolor: depleted ? '#9e9e9e' : '#60C447',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box component="span" sx={usageMeterLabelSx}>
            <AdminEditableUsageDataAmount field="remain" valueMb={remain} onSaved={onSaved} compact />
            {depleted ? ' — depleted, click to refill' : ''}
          </Box>
        </Box>
      ) : null}
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
      <WorkspaceVideoTutorialPair
        videoTutorialUrl={videoTutorialUrl}
        onTutorialClick={() => setTutorialOpen(true)}
        tutorialVariant="orange"
        tutorialAriaLabel={tutorialDetail}
        tutorialTitle={tutorialDetail}
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
          <StorageAndLastClickRow usage={usage} />
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
