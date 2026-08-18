import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import { BUSY_HOURGLASS_MY_NOTE_SIZE } from 'config/busyHourglassEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  fetchRecordVaultOneDriveStatus,
  fetchRecordVaultStorageConfig,
  fetchRecordVaultUsbStatus,
  logoffRecordVaultStorage,
  readRecordVaultApiError,
  setRecordVaultBridgeSinglesId,
  setRecordVaultBridgeStorageType
} from 'api/recordVaultFe';
import { probeRecordVaultBridge } from 'api/recordVaultBridgeFe';
import { useAuth } from 'contexts/AuthContext';
import { clearRecordVaultE2eSession } from 'utils/recordVaultClientSession';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { readRecordVaultLastUsbLocation } from 'utils/recordVaultUsbPreference';
import RecordVaultAccessGate from './RecordVaultAccessGate';
import RecordVaultOneDriveGate from './RecordVaultOneDriveGate';
import RecordVaultUsbGate from './RecordVaultUsbGate';
import RecordVaultWorkspacePane from './RecordVaultWorkspacePane';
import RecordVaultSessionFileCountsBar from './RecordVaultSessionFileCountsBar';
import { RecordVaultPaneProvider } from './RecordVaultPaneContext';
import ProfilesRecordsPage from 'views/utilities/ProfilesRecordsPage';
import { registerVaultProfilesRecordsOpener } from 'utils/vaultProfilesRecordsGate';
import { MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import TutaNotesBrandTitle from './TutaNotesBrandTitle';
import GreenButton from 'ui-component/GreenButton';
import { GREEN_BUTTON_HOVER_SCALE } from 'config/greenButton';
import {
  TUTANOTES_CLOUD_LOGO,
  TUTANOTES_CLOUD_PANE_TOOLTIP,
  TUTANOTES_ONEDRIVE_STRIP_COLOR,
  TUTANOTES_ONEDRIVE_WORKSPACE_TITLE,
  TUTANOTES_HALF_PANEL_WIDTH,
  TUTANOTES_USB_LOGO,
  TUTANOTES_USB_PANE_TOOLTIP,
  TUTANOTES_USB_STRIP_COLOR,
  TUTANOTES_USB_TAB_LABEL_COLOR,
  formatUsbWorkspaceTitle
} from './tutaNotesBranding';
import { clearTutaNotesTutorialChrome } from './tutaNotesTutorialChrome';

const myNoteLoadingBackdropSx = {
  bgcolor: 'rgba(0, 0, 0, 0.35)'
};

/** Tab + frame colors from TutaNotes dual-login mockup. */
const ONEDRIVE_TAB_COLOR = TUTANOTES_ONEDRIVE_STRIP_COLOR;
const USB_TAB_COLOR = TUTANOTES_USB_STRIP_COLOR;
const USB_TAB_LABEL_COLOR = TUTANOTES_USB_TAB_LABEL_COLOR;
const USB_TITLE_BUTTON_BG = '#9C3CBB';
const ACTIVE_PANE_BORDER_WIDTH = 16;

const TAB_LABEL_ONEDRIVE = TUTANOTES_ONEDRIVE_WORKSPACE_TITLE;

const storageTabButtonSx = {
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: '100%',
  flexGrow: 0,
  flexShrink: 0,
  fontWeight: 800,
  overflow: 'visible',
  zIndex: 3
};

const usbTitleButtonSx = {
  ...storageTabButtonSx,
  bgcolor: `${USB_TITLE_BUTTON_BG} !important`,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: `${USB_TITLE_BUTTON_BG} !important`,
      transform: `scale(${GREEN_BUTTON_HOVER_SCALE})`,
      position: 'relative',
      zIndex: 1
    }
  }
};

function DualLogOffButton({ label, onClick, disabled }) {
  return (
    <SliderControlButton
      type="button"
      variant="logoff"
      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
      singleLineLabel
      onClick={onClick}
      disabled={Boolean(disabled)}
      aria-label={label}
      title={label}
      sx={{
        px: 2,
        py: 0.75,
        fontSize: { xs: '0.95rem', sm: '1.05rem' },
        fontWeight: 800
      }}
    >
      {label}
    </SliderControlButton>
  );
}

function StorageCenterCluster({ children }) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.25,
        px: 1.5,
        overflow: 'visible'
      }}
    >
      {children}
    </Box>
  );
}

const paneHeaderBarSx = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  px: 1.25,
  py: 0.35,
  bgcolor: 'var(--theme-yellow-color)',
  borderBottom: '2px solid #000'
};

const paneTitleSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '1.15rem', sm: '1.45rem' },
  lineHeight: 1.2,
  color: '#000',
  WebkitTextFillColor: '#000',
  WebkitTextStroke: '0',
  textShadow: 'none',
  userSelect: 'none',
  cursor: 'help'
};

const paneHeaderTooltipSlotProps = {
  tooltip: {
    sx: {
      bgcolor: 'var(--theme-yellow-color)',
      color: '#000',
      WebkitTextFillColor: '#000',
      fontFamily: MAIN_FONT_FAMILY,
      fontSize: '0.95rem',
      fontWeight: 700,
      lineHeight: 1.35,
      px: 1.5,
      py: 1,
      maxWidth: 420,
      border: '2px solid #000',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      '& .MuiTooltip-arrow': {
        color: 'var(--theme-yellow-color)',
        '&::before': {
          border: '2px solid #000'
        }
      }
    }
  }
};

const storageTabBarSx = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'stretch',
  width: '100%',
  overflow: 'visible',
  zIndex: 3
};

const storageTabStripSx = (stripColor) => ({
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: { xs: 1, sm: 1.5 },
  pt: 2,
  pb: 1,
  boxSizing: 'border-box',
  bgcolor: stripColor,
  overflow: 'visible'
});

function PaneHeader({ title, logoSrc, titleTooltip, stripColor, titleColor }) {
  const stripTitleColor = titleColor || 'var(--theme-yellow-color)';
  return (
    <Box
      sx={{
        ...paneHeaderBarSx,
        ...(stripColor
          ? {
              bgcolor: stripColor,
              borderBottom: '2px solid #000'
            }
          : null)
      }}
    >
      <Tooltip
        title={titleTooltip || ''}
        arrow
        placement="left"
        enterDelay={200}
        slotProps={paneHeaderTooltipSlotProps}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
          <TutaNotesBrandTitle
            logoSrc={logoSrc}
            title={title}
            logoSize={40}
            labelSx={{
              ...paneTitleSx,
              ...(stripColor
                ? {
                    color: stripTitleColor,
                    WebkitTextFillColor: stripTitleColor,
                    WebkitTextStroke: '1.15px #000',
                    paintOrder: 'stroke fill'
                  }
                : null)
            }}
            sx={{ width: 'auto', maxWidth: '100%' }}
          />
        </Box>
      </Tooltip>
    </Box>
  );
}

function loginColumnSx() {
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
    border: `${ACTIVE_PANE_BORDER_WIDTH}px solid transparent`
  };
}

function LoginScrollArea({ children }) {
  return (
    <Box
      {...guestDemoAllowProps()}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflow: 'auto',
        p: { xs: 1, sm: 1.5 }
      }}
    >
      <Box sx={{ flex: '1 0 0', minHeight: 0, width: '100%', pointerEvents: 'none' }} aria-hidden />
      <Box sx={{ width: '100%', maxWidth: TUTANOTES_HALF_PANEL_WIDTH, flex: '0 0 auto' }}>{children}</Box>
      <Box sx={{ flex: '1 0 0', minHeight: 0, width: '100%', pointerEvents: 'none' }} aria-hidden />
    </Box>
  );
}

export default function MyRecordVault() {
  const { user } = useAuth();
  const [storageConfigLoaded, setStorageConfigLoaded] = useState(false);
  const [oneDriveOffered, setOneDriveOffered] = useState(false);
  const [localUsbOffered, setLocalUsbOffered] = useState(false);
  const [oneDriveUnlocked, setOneDriveUnlocked] = useState(false);
  const [usbUnlocked, setUsbUnlocked] = useState(false);
  const [usbVolumeLabel, setUsbVolumeLabel] = useState(
    () => String(readRecordVaultLastUsbLocation()?.label || '').trim()
  );
  const usbTabLabel = formatUsbWorkspaceTitle(usbVolumeLabel);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [error, setError] = useState('');
  /** 'both' = side-by-side login chooser; 'onedrive' | 'usb' = full-window pane; 'compare' = both workspaces for drag-drop. */
  const [paneFocus, setPaneFocus] = useState('both');
  /** Which single pane to restore when leaving compare mode. */
  const [compareReturnFocus, setCompareReturnFocus] = useState('onedrive');
  /** Shared vault-password gate before Open TutaNotes Cloud / USB. */
  const [accessGateOpen, setAccessGateOpen] = useState(false);
  const accessUnlockedRef = useRef(false);
  /** Pending open side for Access Gate: `{ storageType, mountPath? }`. */
  const pendingOpenRef = useRef(null);
  const [accessGateStorageType, setAccessGateStorageType] = useState('onedrive');
  const [accessGateUsbMountPath, setAccessGateUsbMountPath] = useState('');
  const [oneDriveProceedOpenToken, setOneDriveProceedOpenToken] = useState(0);
  const [usbProceedOpenToken, setUsbProceedOpenToken] = useState(0);
  const [usbGateRefreshToken, setUsbGateRefreshToken] = useState(0);
  const [sessionCountsRefreshToken, setSessionCountsRefreshToken] = useState(0);
  const [oneDriveGateRefreshToken, setOneDriveGateRefreshToken] = useState(0);
  const [usbDualLogoffBusy, setUsbDualLogoffBusy] = useState(false);
  const [oneDriveDualLogoffBusy, setOneDriveDualLogoffBusy] = useState(false);
  /** Header Profile & Records — full page overlay (no dating sidebar). */
  const [profilesRecordsOpen, setProfilesRecordsOpen] = useState(false);
  const [profilesRecordsInitialTab, setProfilesRecordsInitialTab] = useState('profiles');

  useEffect(() => {
    // Yellow E2E: DEK lives only in this tab — clear on each /myNote visit.
    clearRecordVaultE2eSession();
    accessUnlockedRef.current = false;
  }, []);

  useEffect(() => {
    return registerVaultProfilesRecordsOpener((options = {}) => {
      const tab = options?.openTab;
      setProfilesRecordsInitialTab(typeof tab === 'string' && tab ? tab : 'profiles');
      setProfilesRecordsOpen(true);
    });
  }, []);

  const refreshPaneSessions = useCallback(async () => {
    setSessionChecking(true);
    setError('');
    try {
      const [oneDriveStatus, usbStatus] = await Promise.all([
        oneDriveOffered ? fetchRecordVaultOneDriveStatus().catch(() => null) : Promise.resolve(null),
        localUsbOffered ? fetchRecordVaultUsbStatus().catch(() => null) : Promise.resolve(null)
      ]);
      setOneDriveUnlocked(Boolean(oneDriveStatus?.session?.unlocked));
      setUsbUnlocked(Boolean(usbStatus?.session?.unlocked));
      const sessionUsbLabel = String(usbStatus?.session?.label || '').trim();
      if (usbStatus?.session?.unlocked && sessionUsbLabel && sessionUsbLabel !== 'OneDrive') {
        setUsbVolumeLabel((prev) => prev || sessionUsbLabel);
      }
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Unable to read vault storage sessions'));
      setOneDriveUnlocked(false);
      setUsbUnlocked(false);
    } finally {
      setSessionChecking(false);
    }
  }, [oneDriveOffered, localUsbOffered]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchRecordVaultStorageConfig();
        if (cancelled) return;
        setOneDriveOffered(Boolean(cfg.oneDrive.visible));
        setLocalUsbOffered(Boolean(cfg.localUsb.visible));
      } catch {
        if (!cancelled) {
          setOneDriveOffered(true);
          setLocalUsbOffered(true);
        }
      } finally {
        if (!cancelled) setStorageConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRecordVaultBridgeSinglesId(user?.singles_id ?? null);
  }, [user?.singles_id]);

  useEffect(() => {
    void probeRecordVaultBridge();
    const timerId = window.setInterval(() => {
      void probeRecordVaultBridge();
    }, 5000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!storageConfigLoaded) return;
    void refreshPaneSessions();
  }, [storageConfigLoaded, refreshPaneSessions]);

  useEffect(() => {
    if (!storageConfigLoaded) return;
    if (oneDriveOffered && localUsbOffered) return;
    if (oneDriveOffered) setPaneFocus('onedrive');
    else if (localUsbOffered) setPaneFocus('usb');
  }, [localUsbOffered, oneDriveOffered, storageConfigLoaded]);

  const handleUsbUnlocked = useCallback(() => {
    setUsbUnlocked(true);
    // Dual layout: stay on side-by-side “Click this tab…” until the user clicks a tab.
    if (oneDriveOffered && localUsbOffered) {
      setPaneFocus('both');
    } else {
      setPaneFocus('usb');
    }
    setError('');
    void (async () => {
      try {
        const usbStatus = await fetchRecordVaultUsbStatus();
        if (usbStatus?.session?.unlocked) {
          setUsbUnlocked(true);
        }
      } catch {
        // Keep optimistic unlock
      }
    })();
  }, [localUsbOffered, oneDriveOffered]);

  const handleOneDriveUnlocked = useCallback(() => {
    setOneDriveUnlocked(true);
    if (oneDriveOffered && localUsbOffered) {
      setPaneFocus('both');
    } else {
      setPaneFocus('onedrive');
    }
    setError('');
    void (async () => {
      try {
        const oneDriveStatus = await fetchRecordVaultOneDriveStatus();
        if (oneDriveStatus?.session?.unlocked) {
          setOneDriveUnlocked(true);
        }
      } catch {
        // keep optimistic unlock
      }
    })();
  }, [localUsbOffered, oneDriveOffered]);

  const selectOneDriveTab = useCallback(() => {
    setPaneFocus((prev) => {
      if (prev === 'compare') return 'onedrive';
      // Toggle back to dual login/tips when both storages are offered.
      if (prev === 'onedrive' && oneDriveOffered && localUsbOffered) return 'both';
      return 'onedrive';
    });
  }, [localUsbOffered, oneDriveOffered]);

  const selectUsbTab = useCallback(() => {
    setPaneFocus((prev) => {
      if (prev === 'compare') return 'usb';
      if (prev === 'usb' && oneDriveOffered && localUsbOffered) return 'both';
      return 'usb';
    });
  }, [localUsbOffered, oneDriveOffered]);

  const enterCompareMode = useCallback(() => {
    if (!(oneDriveUnlocked && usbUnlocked && oneDriveOffered && localUsbOffered)) return;
    if (paneFocus === 'onedrive' || paneFocus === 'usb') {
      setCompareReturnFocus(paneFocus);
    }
    setPaneFocus('compare');
  }, [localUsbOffered, oneDriveOffered, oneDriveUnlocked, paneFocus, usbUnlocked]);

  const returnFromCompareMode = useCallback(() => {
    setPaneFocus(compareReturnFocus === 'usb' ? 'usb' : 'onedrive');
  }, [compareReturnFocus]);

  const handleOneDriveSessionEnded = useCallback(() => {
    setOneDriveUnlocked(false);
    setSessionCountsRefreshToken((n) => n + 1);
    setPaneFocus((prev) => {
      if (prev === 'compare') return usbUnlocked ? 'usb' : 'both';
      if (prev === 'onedrive' && localUsbOffered) return 'both';
      return prev;
    });
  }, [localUsbOffered, usbUnlocked]);

  const handleUsbSessionEnded = useCallback(() => {
    setUsbUnlocked(false);
    setSessionCountsRefreshToken((n) => n + 1);
    setPaneFocus((prev) => {
      if (prev === 'compare') return oneDriveUnlocked ? 'onedrive' : 'both';
      if (prev === 'usb' && oneDriveOffered) return 'both';
      return prev;
    });
  }, [oneDriveOffered, oneDriveUnlocked]);

  const handleDualPaneLogOffUsb = useCallback(async () => {
    if (usbDualLogoffBusy || !usbUnlocked) return;
    setUsbDualLogoffBusy(true);
    setError('');
    try {
      await logoffRecordVaultStorage({ storageType: 'usb' });
      setRecordVaultBridgeStorageType(null);
      handleUsbSessionEnded();
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Log off USB failed'));
    } finally {
      setUsbDualLogoffBusy(false);
    }
  }, [usbDualLogoffBusy, usbUnlocked, handleUsbSessionEnded]);

  const handleDualPaneLogOffOneDrive = useCallback(async () => {
    if (oneDriveDualLogoffBusy || !oneDriveUnlocked) return;
    setOneDriveDualLogoffBusy(true);
    setError('');
    try {
      await logoffRecordVaultStorage({ storageType: 'onedrive' });
      handleOneDriveSessionEnded();
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Log off OneDrive failed'));
    } finally {
      setOneDriveDualLogoffBusy(false);
    }
  }, [oneDriveDualLogoffBusy, oneDriveUnlocked, handleOneDriveSessionEnded]);

  const handleUsbLocationChange = useCallback((label) => {
    setUsbVolumeLabel(String(label || '').trim());
  }, []);

  // Open TutaNotes Cloud / USB share one vault-password popup (Step 1), then resume icon unlock.
  const handleOneDriveOpenClicked = useCallback(() => {
    if (accessUnlockedRef.current) return false;
    pendingOpenRef.current = { storageType: 'onedrive' };
    setAccessGateStorageType('onedrive');
    setAccessGateUsbMountPath('');
    setAccessGateOpen(true);
    return true;
  }, []);

  const handleUsbOpenClicked = useCallback((opts = {}) => {
    if (accessUnlockedRef.current) return false;
    const mountPath = String(opts?.mountPath ?? '').trim();
    pendingOpenRef.current = { storageType: 'usb', mountPath };
    setAccessGateStorageType('usb');
    setAccessGateUsbMountPath(mountPath);
    setAccessGateOpen(true);
    return true;
  }, []);

  const handleAccessUnlocked = useCallback(() => {
    accessUnlockedRef.current = true;
    setAccessGateOpen(false);
    const pending = pendingOpenRef.current;
    pendingOpenRef.current = null;
    if (pending?.storageType === 'onedrive') {
      setOneDriveProceedOpenToken((n) => n + 1);
    } else if (pending?.storageType === 'usb') {
      setUsbProceedOpenToken((n) => n + 1);
    }
  }, []);

  const handleAccessGateClose = useCallback(() => {
    setAccessGateOpen(false);
    pendingOpenRef.current = null;
  }, []);

  const handleAccessVaultFormatted = useCallback((formattedSide) => {
    if (formattedSide === 'usb') {
      setUsbGateRefreshToken((n) => n + 1);
    } else if (formattedSide === 'onedrive') {
      setOneDriveGateRefreshToken((n) => n + 1);
    }
  }, []);

  const showWorkspace = storageConfigLoaded && !sessionChecking;
  const showTabBar = oneDriveOffered && localUsbOffered;
  const showDual = showTabBar && paneFocus === 'both';
  const showCompare = showTabBar && paneFocus === 'compare';
  const canEnterCompare = Boolean(oneDriveUnlocked && usbUnlocked && showTabBar);

  // Tutorial lives on the usage bar (USB + OneDrive) — never in the site header.
  useEffect(() => {
    clearTutaNotesTutorialChrome();
    return () => {
      clearTutaNotesTutorialChrome();
    };
  }, []);

  const oneDriveVisible =
    oneDriveOffered && (showDual || showCompare || paneFocus === 'onedrive' || !localUsbOffered);
  const usbVisible = localUsbOffered && (showDual || showCompare || paneFocus === 'usb' || !oneDriveOffered);
  const sideBySideLayout = showDual || showCompare;

  const renderOneDriveBody = () => {
    if (showDual && oneDriveUnlocked) {
      return (
        <StorageCenterCluster>
          <GreenButton
            type="button"
            role="tab"
            aria-selected={paneFocus === 'onedrive'}
            title="Open or reload TutaNotes notes on OneDrive"
            onClick={selectOneDriveTab}
            sx={storageTabButtonSx}
          >
            {TAB_LABEL_ONEDRIVE}
          </GreenButton>
          <DualLogOffButton
            label="Log off OneDrive"
            onClick={() => void handleDualPaneLogOffOneDrive()}
            disabled={oneDriveDualLogoffBusy}
          />
        </StorageCenterCluster>
      );
    }
    // Expanded Cloud tab, compare mode, or Cloud-only → notebooks workspace.
    if (oneDriveUnlocked && (paneFocus === 'onedrive' || paneFocus === 'compare' || !localUsbOffered)) {
      return (
        <RecordVaultPaneProvider storageType="onedrive">
          <RecordVaultWorkspacePane
            unlocked
            compact
            compareMode={showCompare}
            paneLabel="OneDrive"
            canEnterCompare={canEnterCompare}
            onEnterCompare={enterCompareMode}
            onReturnFromCompare={returnFromCompareMode}
            onSessionEnded={handleOneDriveSessionEnded}
          />
        </RecordVaultPaneProvider>
      );
    }
    if (showDual || !oneDriveUnlocked) {
      return (
        <LoginScrollArea>
          {showDual ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <GreenButton
                type="button"
                role="tab"
                aria-selected={paneFocus === 'onedrive'}
                title="Expand TutaNotes on OneDrive to the full window"
                onClick={selectOneDriveTab}
                sx={storageTabButtonSx}
              >
                {TAB_LABEL_ONEDRIVE}
              </GreenButton>
              <RecordVaultOneDriveGate
                embedded
                open
                onUnlocked={handleOneDriveUnlocked}
                onOpenClicked={handleOneDriveOpenClicked}
                proceedOpenToken={oneDriveProceedOpenToken}
                accessFormatRefreshToken={oneDriveGateRefreshToken}
              />
            </Box>
          ) : (
            <RecordVaultOneDriveGate
              embedded
              open
              onUnlocked={handleOneDriveUnlocked}
              onOpenClicked={handleOneDriveOpenClicked}
              proceedOpenToken={oneDriveProceedOpenToken}
              accessFormatRefreshToken={oneDriveGateRefreshToken}
            />
          )}
        </LoginScrollArea>
      );
    }
    return null;
  };

  const renderUsbBody = () => {
    if (showDual && usbUnlocked) {
      return (
        <StorageCenterCluster>
          <GreenButton
            type="button"
            role="tab"
            aria-selected={paneFocus === 'usb'}
            title="Open or reload TutaNotes notes on USB"
            onClick={selectUsbTab}
            sx={usbTitleButtonSx}
          >
            {usbTabLabel}
          </GreenButton>
          <DualLogOffButton
            label="Log off USB"
            onClick={() => void handleDualPaneLogOffUsb()}
            disabled={usbDualLogoffBusy}
          />
        </StorageCenterCluster>
      );
    }
    if (usbUnlocked && (paneFocus === 'usb' || paneFocus === 'compare' || !oneDriveOffered)) {
      return (
        <RecordVaultPaneProvider storageType="usb">
          <RecordVaultWorkspacePane
            unlocked
            compact
            compareMode={showCompare}
            paneLabel="USB"
            canEnterCompare={canEnterCompare}
            onEnterCompare={enterCompareMode}
            onReturnFromCompare={returnFromCompareMode}
            onSessionEnded={handleUsbSessionEnded}
          />
        </RecordVaultPaneProvider>
      );
    }
    if (showDual || !usbUnlocked) {
      return (
        <LoginScrollArea>
          {showDual ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <GreenButton
                type="button"
                role="tab"
                aria-selected={paneFocus === 'usb'}
                title="Expand TutaNotes on USB to the full window"
                onClick={selectUsbTab}
                sx={usbTitleButtonSx}
              >
                {usbTabLabel}
              </GreenButton>
              <RecordVaultUsbGate
                embedded
                usbOnly
                open
                suppressInlineErrors={accessGateOpen}
                onUnlocked={handleUsbUnlocked}
                onUsbLocationChange={handleUsbLocationChange}
                onOpenClicked={handleUsbOpenClicked}
                proceedOpenToken={usbProceedOpenToken}
                accessFormatRefreshToken={usbGateRefreshToken}
              />
            </Box>
          ) : (
            <RecordVaultUsbGate
              embedded
              usbOnly
              open
              suppressInlineErrors={accessGateOpen}
              onUnlocked={handleUsbUnlocked}
              onUsbLocationChange={handleUsbLocationChange}
              onOpenClicked={handleUsbOpenClicked}
              proceedOpenToken={usbProceedOpenToken}
              accessFormatRefreshToken={usbGateRefreshToken}
            />
          )}
        </LoginScrollArea>
      );
    }
    return null;
  };

  return (
    <Box
      data-record-vault-shell
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: MAIN_FONT_FAMILY,
        bgcolor: 'var(--theme-daynight-color)'
      }}
    >
      <RecordVaultAccessGate
        open={accessGateOpen}
        onUnlocked={handleAccessUnlocked}
        onClose={handleAccessGateClose}
        storageType={accessGateStorageType}
        usbMountPath={accessGateUsbMountPath}
        onVaultFormatted={handleAccessVaultFormatted}
      />

      <BusyHourglassOverlay
        open={!storageConfigLoaded || sessionChecking}
        label="Loading vault"
        backdropSx={myNoteLoadingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={usbDualLogoffBusy || oneDriveDualLogoffBusy}
        label={oneDriveDualLogoffBusy ? 'Logging off OneDrive' : 'Logging off USB'}
        backdropSx={myNoteLoadingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />

      {error ? (
        <Typography sx={{ color: 'error.main', fontWeight: 700, px: 1, py: 0.5 }}>{error}</Typography>
      ) : null}

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {showWorkspace ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {showTabBar && !showCompare && !showDual ? (
            <Box role="tablist" aria-label="TutaNotes storage" {...guestDemoAllowProps()} sx={storageTabBarSx}>
              <Box sx={storageTabStripSx(ONEDRIVE_TAB_COLOR)}>
                <GreenButton
                  type="button"
                  role="tab"
                  aria-selected={paneFocus === 'onedrive'}
                  title={
                    paneFocus === 'onedrive'
                      ? oneDriveOffered && localUsbOffered
                        ? 'Click again to show OneDrive and USB side by side'
                        : 'TutaNotes Cloud is open'
                      : oneDriveUnlocked
                        ? 'Open or reload TutaNotes notes on OneDrive'
                        : 'Expand TutaNotes on OneDrive to the full window'
                  }
                  onClick={selectOneDriveTab}
                  sx={storageTabButtonSx}
                >
                  {TAB_LABEL_ONEDRIVE}
                </GreenButton>
              </Box>
              <Box sx={storageTabStripSx(USB_TAB_COLOR)}>
                <GreenButton
                  type="button"
                  role="tab"
                  aria-selected={paneFocus === 'usb'}
                  title={
                    paneFocus === 'usb'
                      ? oneDriveOffered && localUsbOffered
                        ? 'Click again to show OneDrive and USB side by side'
                        : 'TutaNotes USB is open'
                      : usbUnlocked
                        ? 'Open or reload TutaNotes notes on USB'
                        : 'Expand TutaNotes on USB to the full window'
                  }
                  onClick={selectUsbTab}
                  sx={usbTitleButtonSx}
                >
                  {usbTabLabel}
                </GreenButton>
              </Box>
            </Box>
          ) : null}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: sideBySideLayout ? { xs: 'column', md: 'row' } : 'column',
              overflow: 'hidden'
            }}
          >
            {oneDriveOffered ? (
              <Box
                sx={{
                  ...loginColumnSx(),
                  display: oneDriveVisible ? 'flex' : 'none',
                  borderColor: ONEDRIVE_TAB_COLOR,
                  overflow: showDual ? 'visible' : 'hidden',
                  bgcolor:
                    showDual || !oneDriveUnlocked ? ONEDRIVE_TAB_COLOR : 'var(--theme-daynight-color)'
                }}
              >
                {/* Yellow title row when only one storage mode is offered, or per-pane titles in compare. */}
                {!showTabBar || showCompare ? (
                  <PaneHeader
                    title={TUTANOTES_ONEDRIVE_WORKSPACE_TITLE}
                    logoSrc={TUTANOTES_CLOUD_LOGO}
                    titleTooltip={TUTANOTES_CLOUD_PANE_TOOLTIP}
                    stripColor={showCompare ? ONEDRIVE_TAB_COLOR : undefined}
                  />
                ) : null}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: showDual ? 'visible' : 'hidden'
                  }}
                >
                  {renderOneDriveBody()}
                </Box>
                {!oneDriveUnlocked ? (
                  <RecordVaultSessionFileCountsBar refreshToken={sessionCountsRefreshToken} />
                ) : null}
              </Box>
            ) : null}

            {localUsbOffered ? (
              <Box
                sx={{
                  ...loginColumnSx(),
                  display: usbVisible ? 'flex' : 'none',
                  borderColor: USB_TAB_COLOR,
                  overflow: showDual ? 'visible' : 'hidden',
                  bgcolor: showDual || !usbUnlocked ? USB_TAB_COLOR : 'var(--theme-daynight-color)'
                }}
              >
                {!showTabBar || showCompare ? (
                  <PaneHeader
                    title={usbTabLabel}
                    logoSrc={TUTANOTES_USB_LOGO}
                    titleTooltip={TUTANOTES_USB_PANE_TOOLTIP}
                    stripColor={showCompare ? USB_TAB_COLOR : undefined}
                    titleColor={showCompare ? USB_TAB_LABEL_COLOR : undefined}
                  />
                ) : null}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: showDual ? 'visible' : 'hidden'
                  }}
                >
                  {renderUsbBody()}
                </Box>
                {!usbUnlocked ? (
                  <RecordVaultSessionFileCountsBar refreshToken={sessionCountsRefreshToken} />
                ) : null}
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}

      {profilesRecordsOpen ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 15000,
            overflow: 'auto',
            bgcolor: 'var(--theme-daynight-color)',
            p: { xs: 1, sm: 2 }
          }}
        >
          <ProfilesRecordsPage
            key={`profiles-records-${profilesRecordsInitialTab}`}
            embedded
            initialTab={profilesRecordsInitialTab}
            onProfileSaved={() => setProfilesRecordsOpen(false)}
            onReturn={() => setProfilesRecordsOpen(false)}
          />
        </Box>
      ) : null}
      </Box>
    </Box>
  );
}

MyRecordVault.path = MY_RECORD_VAULT_PATH;
