import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { ORANGE_BUTTON_ENABLED_BG } from 'config/orangeButton';
import {
  TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL,
  TUTANOTES_USB_VIDEO_TUTORIAL_LABEL
} from './tutaNotesBranding';
import RecordVaultDataPlanDialog from './RecordVaultDataPlanDialog';
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

const usageBarActionBtnSx = {
  flexShrink: 0,
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '0.68rem', sm: '0.78rem', md: '0.85rem' },
  lineHeight: 1.15,
  px: { xs: 0.85, sm: 1.1 },
  py: 0.4,
  minWidth: { xs: '11rem', sm: '14rem', md: '16.5rem' },
  bgcolor: ORANGE_BUTTON_ENABLED_BG,
  color: '#000',
  WebkitTextFillColor: '#000',
  border: '2px solid #000',
  borderRadius: 0.5,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  userSelect: 'none',
  transform: 'scale(1)',
  transformOrigin: 'center center',
  transition: 'transform 0.15s ease, filter 0.15s ease',
  '@media (hover: hover)': {
    '&:hover:not(:disabled)': {
      transform: 'scale(1.08)',
      filter: 'brightness(0.95)',
      bgcolor: ORANGE_BUTTON_ENABLED_BG,
      zIndex: 1
    }
  },
  '&:disabled': {
    opacity: 0.65,
    cursor: 'default',
    filter: 'none',
    transform: 'none'
  }
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
        bgcolor: blackBar ? '#000' : 'var(--theme-secondary-color)',
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

export default function RecordVaultUsageBar({
  usage,
  storageType = 'usb',
  videoTutorialUrl = '',
  onPurchased,
  onGetMoreTokens
}) {
  const [dataPlanOpen, setDataPlanOpen] = useState(false);
  const transfer = usage?.transfer;
  const sessionFileCounts = usage?.sessionFileCounts || {};
  const usbTxRx = Number(sessionFileCounts.usbTxRx) || 0;
  const uiTxRx = Number(sessionFileCounts.uiTxRx) || 0;
  const isOneDrive = storageType === 'onedrive';
  const tutorialUrl = String(videoTutorialUrl || '').trim();
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
      <Box
        component="button"
        type="button"
        disabled={!tutorialUrl}
        title={tutorialDetail}
        aria-label={tutorialDetail}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!tutorialUrl) return;
          window.open(tutorialUrl, '_blank', 'noopener,noreferrer');
        }}
        sx={usageBarActionBtnSx}
      >
        {tutorialDetail}
      </Box>
    </>
  );

  if (!transfer && !isOneDrive) {
    // USB often has no transfer quota — still show USB Bridge promo line + actions.
    return (
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
    );
  }

  if (!transfer) {
    return <UsageBarShell actions={actions}>{null}</UsageBarShell>;
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
