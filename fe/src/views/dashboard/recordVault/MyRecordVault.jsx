import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  fetchRecordVaultStorageConfig,
  fetchRecordVaultTutaDriveStatus,
  logoffRecordVaultStorage,
  readRecordVaultApiError,
  setRecordVaultBridgeSinglesId,
  setRecordVaultBridgeStorageType
} from 'api/recordVaultFe';
import { useAuth } from 'contexts/AuthContext';
import { clearRecordVaultE2eSession } from 'utils/recordVaultClientSession';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import RecordVaultAccessGate from './RecordVaultAccessGate';
import RecordVaultTutaDriveGate from './RecordVaultTutaDriveGate';
import RecordVaultWorkspacePane from './RecordVaultWorkspacePane';
import RecordVaultSessionFileCountsBar from './RecordVaultSessionFileCountsBar';
import { RecordVaultPaneProvider } from './RecordVaultPaneContext';
import ProfilesRecordsPage from 'views/utilities/ProfilesRecordsPage';
import { registerVaultProfilesRecordsOpener } from 'utils/vaultProfilesRecordsGate';
import { MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import TutaNotesBrandTitle from './TutaNotesBrandTitle';
import GreenButton from 'ui-component/GreenButton';
import { GREEN_BUTTON_HOVER_SCALE } from 'config/greenButton';
import { isLeftSideOfferedFromVite, isLeftSideTutaDriveFromVite, parseLeftSideMode } from 'config/leftSideEnv';
import { parseRightSideMode } from 'config/rightSideEnv';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { isRecordVaultRagUiEnabled } from 'config/recordVaultRagUiEnv';
import { useCompactLoginViewport } from 'config/compactLoginViewport';
import {
  clearMobileTutaNotesUploadSession,
  consumeMobileTutaNotesUploadPending,
  markMobileTutaNotesUploadSession,
  peekMobileTutaNotesUploadPending,
  peekMobileTutaNotesUploadSession
} from 'utils/mobilePostLoginChoice';
import { MOBILE_UPLOAD_PRODUCT_TUTANOTES } from 'constants/mobileUploadProduct';
import RecordVaultMobileDirectUploadDialog from './RecordVaultMobileDirectUploadDialog';
import {
  TUTANOTES_CLOUD_LOGO,
  TUTANOTES_CLOUD_PANE_TOOLTIP,
  TUTANOTES_TUTACLOUD_STRIP_COLOR,
  TUTANOTES_TUTACLOUD_WORKSPACE_TITLE,
  TUTANOTES_TUTADRIVE_STRIP_COLOR,
  TUTANOTES_TUTADRIVE_WORKSPACE_TITLE,
  TUTANOTES_HALF_PANEL_WIDTH,
  TUTANOTES_USB_LOGO,
  TUTANOTES_USB_PANE_TOOLTIP,
  TUTANOTES_USB_STRIP_COLOR,
  TUTANOTES_USB_TAB_LABEL_COLOR,
  TUTANOTES_WORKSPACE_PANEL_BG,
  formatUsbWorkspaceTitle
} from './tutaNotesBranding';
import { clearTutaNotesTutorialChrome } from './tutaNotesTutorialChrome';

const myNoteLoadingBackdropSx = {
  bgcolor: 'rgba(0, 0, 0, 0.35)'
};

/** Tab + frame colors from TutaNotes dual-login mockup. */
const TUTACLOUD_TAB_COLOR = TUTANOTES_TUTACLOUD_STRIP_COLOR;
const TUTADRIVE_TAB_COLOR = TUTANOTES_TUTADRIVE_STRIP_COLOR;
const USB_TAB_COLOR = TUTANOTES_USB_STRIP_COLOR;
const USB_TAB_LABEL_COLOR = TUTANOTES_USB_TAB_LABEL_COLOR;
const USB_TITLE_BUTTON_BG = '#9C3CBB';
const ACTIVE_PANE_BORDER_WIDTH = 16;

const TAB_LABEL_TUTACLOUD = TUTANOTES_TUTACLOUD_WORKSPACE_TITLE;

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
  bgcolor: TUTANOTES_WORKSPACE_PANEL_BG,
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
  const [tutaCloudOffered, setTutaCloudOffered] = useState(() => isLeftSideOfferedFromVite());
  const [tutaDriveMode, setTutaDriveMode] = useState(() => isLeftSideTutaDriveFromVite());
  const [localUsbOffered, setLocalUsbOffered] = useState(false);
  const [tutaCloudUnlocked, setTutaCloudUnlocked] = useState(false);
  const [usbUnlocked, setUsbUnlocked] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [error, setError] = useState('');
  /** 'both' = side-by-side login chooser; 'tutadrive' | 'usb' = full-window pane; 'compare' = both workspaces for drag-drop. */
  const [paneFocus, setPaneFocus] = useState('both');
  /** Which single pane to restore when leaving compare mode. */
  const [compareReturnFocus, setCompareReturnFocus] = useState('tutadrive');
  /** Shared vault-password gate before Open TutaNotes Cloud / USB. */
  const [accessGateOpen, setAccessGateOpen] = useState(false);
  const accessUnlockedRef = useRef(false);
  /** Pending open side for Access Gate: `{ storageType, mountPath? }`. */
  const pendingOpenRef = useRef(null);
  const [accessGateStorageType, setAccessGateStorageType] = useState('tutadrive');
  const [accessGateUsbMountPath, setAccessGateUsbMountPath] = useState('');
  const [tutaCloudProceedOpenToken, setTutaCloudProceedOpenToken] = useState(0);
  const [usbProceedOpenToken, setUsbProceedOpenToken] = useState(0);
  const [usbGateRefreshToken, setUsbGateRefreshToken] = useState(0);
  const [sessionCountsRefreshToken, setSessionCountsRefreshToken] = useState(0);
  const [tutaCloudGateRefreshToken, setTutaCloudGateRefreshToken] = useState(0);
  const [usbDualLogoffBusy, setUsbDualLogoffBusy] = useState(false);
  const [tutaCloudDualLogoffBusy, setTutaCloudDualLogoffBusy] = useState(false);
  /** Header Profile & Records — full page overlay (no dating sidebar). */
  const [profilesRecordsOpen, setProfilesRecordsOpen] = useState(false);
  const [profilesRecordsInitialTab, setProfilesRecordsInitialTab] = useState('profiles');
  const [ragUiEnabled, setRagUiEnabled] = useState(() => isRecordVaultRagUiEnabled());
  const isCompactViewport = useCompactLoginViewport();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mobileTutaNotesUploadSession, setMobileTutaNotesUploadSession] = useState(() =>
    peekMobileTutaNotesUploadSession()
  );
  useEffect(() => {
    const sync = () => setMobileTutaNotesUploadSession(peekMobileTutaNotesUploadSession());
    window.addEventListener('vsingles-mobile-tutanotes-upload-session', sync);
    return () => window.removeEventListener('vsingles-mobile-tutanotes-upload-session', sync);
  }, []);
  const hideMyNoteShellForMobileUpload = isCompactViewport && mobileTutaNotesUploadSession;

  /** Compact + upload intent only — never treat desktop as mobile-upload. */
  const isMobileUploadOnly =
    isCompactViewport &&
    (searchParams.get('mobileUpload') === '1' ||
      peekMobileTutaNotesUploadPending() ||
      peekMobileTutaNotesUploadSession() ||
      mobileTutaNotesUploadSession);

  /** Desktop must never inherit a phone upload session (or unlock) from an earlier mobile visit. */
  useEffect(() => {
    if (isCompactViewport) return;
    const hadMobileSession =
      peekMobileTutaNotesUploadSession() || mobileTutaNotesUploadSession;
    clearMobileTutaNotesUploadSession();
    setMobileTutaNotesUploadSession(false);
    if (!hadMobileSession) return;
    // Prior mobile path unlocked vault without FDE — force logoff so desktop asks for password again.
    void (async () => {
      try {
        if (tutaCloudOffered) await logoffRecordVaultStorage({ storageType: 'tutadrive' });
      } catch {
        // ignore
      }
      try {
        if (localUsbOffered) await logoffRecordVaultStorage({ storageType: 'usb' });
      } catch {
        // ignore
      }
      setTutaCloudUnlocked(false);
      setUsbUnlocked(false);
      accessUnlockedRef.current = false;
    })();
  }, [isCompactViewport, mobileTutaNotesUploadSession, tutaCloudOffered, localUsbOffered]);

  /** Phone: only mall ↔ upload popup — never the desktop TutaNotes workspace. */
  useEffect(() => {
    if (!isCompactViewport) return;
    const uploadIntent =
      searchParams.get('mobileUpload') === '1' ||
      peekMobileTutaNotesUploadPending() ||
      peekMobileTutaNotesUploadSession();
    if (!uploadIntent) {
      navigate('/mall', { replace: true });
    }
  }, [isCompactViewport, searchParams, navigate]);

  useEffect(() => {
    // Yellow E2E: DEK lives only in this tab — clear on each /myNote visit.
    clearRecordVaultE2eSession();
    accessUnlockedRef.current = false;
  }, []);

  /** Mobile mall tile: stage-only upload sheet — do not unlock vault (desktop must still ask FDE). */
  useEffect(() => {
    if (!isMobileUploadOnly) return;
    markMobileTutaNotesUploadSession();
    setMobileTutaNotesUploadSession(true);
    consumeMobileTutaNotesUploadPending();
    if (searchParams.get('mobileUpload') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('mobileUpload');
      window.history.replaceState(null, '', `${window.location.pathname}${next.toString() ? `?${next}` : ''}`);
    }
  }, [isMobileUploadOnly, searchParams]);

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
        tutaCloudOffered
          ? (tutaDriveMode
              ? fetchRecordVaultTutaDriveStatus()
              : fetchRecordVaultTutaDriveStatus()
            ).catch(() => null)
          : Promise.resolve(null),
        localUsbOffered ? fetchRecordVaultUsbStatus().catch(() => null) : Promise.resolve(null)
      ]);
      setTutaCloudUnlocked(Boolean(oneDriveStatus?.session?.unlocked));
      setUsbUnlocked(Boolean(usbStatus?.session?.unlocked));
      const sessionUsbLabel = String(usbStatus?.session?.label || '').trim();
      if (usbStatus?.session?.unlocked && sessionUsbLabel && sessionUsbLabel !== 'OneDrive') {
        setUsbVolumeLabel((prev) => prev || sessionUsbLabel);
      }
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Unable to read vault storage sessions'));
      setTutaCloudUnlocked(false);
      setUsbUnlocked(false);
    } finally {
      setSessionChecking(false);
    }
  }, [tutaCloudOffered, localUsbOffered, tutaDriveMode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const applyPanelSides = (cfg) => {
        if (!cfg) {
          setTutaDriveMode(isLeftSideTutaDriveFromVite());
          setTutaCloudOffered(isLeftSideOfferedFromVite());
          setLocalUsbOffered(false);
          return;
        }
        if (cfg.leftSide != null || cfg.tutaDrive != null) {
          const leftMode = parseLeftSideMode(cfg.leftSide);
          setTutaDriveMode(Boolean(cfg.tutaDrive) || leftMode === 'TutaDrive');
          if (cfg.tutaCloud?.visible != null) {
            setTutaCloudOffered(Boolean(cfg.tutaCloud.visible));
          } else {
            setTutaCloudOffered(leftMode !== 'None');
          }
        }
        setLocalUsbOffered(false);
      };
      try {
        // Runtime BE env (authoritative after pm2/be restart) — no auth required.
        const pubRes = await fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' });
        if (pubRes.ok) {
          const pub = await pubRes.json();
          if (!cancelled) {
            applyPanelSides(pub);
            if (pub.ragUiEnabled != null) {
              setRagUiEnabled(Boolean(pub.ragUiEnabled));
            }
          }
        }
      } catch {
        // keep Vite / prior value
      }
      try {
        const cfg = await fetchRecordVaultStorageConfig();
        if (cancelled) return;
        applyPanelSides(cfg);
        setTutaCloudOffered(Boolean(cfg.tutaCloud?.visible));
        setLocalUsbOffered(false);
      } catch {
        if (!cancelled) {
          setTutaCloudOffered(isLeftSideOfferedFromVite());
          setLocalUsbOffered(false);
          setTutaDriveMode(isLeftSideTutaDriveFromVite());
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
    if (!storageConfigLoaded) return;
    void refreshPaneSessions();
  }, [storageConfigLoaded, refreshPaneSessions]);

  useEffect(() => {
    if (!storageConfigLoaded) return;
    if (tutaCloudOffered && localUsbOffered) return;
    if (tutaCloudOffered) setPaneFocus('tutadrive');
    else if (localUsbOffered) setPaneFocus('usb');
  }, [localUsbOffered, tutaCloudOffered, storageConfigLoaded]);

  const handleUsbUnlocked = useCallback(() => {
    setUsbUnlocked(true);
    // Dual layout: stay on side-by-side “Click this tab…” until the user clicks a tab.
    if (tutaCloudOffered && localUsbOffered) {
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
  }, [localUsbOffered, tutaCloudOffered]);

  const handleTutaCloudUnlocked = useCallback(() => {
    setTutaCloudUnlocked(true);
    if (tutaCloudOffered && localUsbOffered) {
      setPaneFocus('both');
    } else {
      setPaneFocus('tutadrive');
    }
    setError('');
    void (async () => {
      try {
        const cloudStatus = tutaDriveMode
          ? await fetchRecordVaultTutaDriveStatus()
          : await fetchRecordVaultTutaDriveStatus();
        if (cloudStatus?.session?.unlocked) {
          setTutaCloudUnlocked(true);
        }
      } catch {
        // keep optimistic unlock
      }
    })();
  }, [localUsbOffered, tutaCloudOffered, tutaDriveMode]);

  const selectTutaCloudTab = useCallback(() => {
    setPaneFocus((prev) => {
      if (prev === 'compare') return 'tutadrive';
      // Toggle back to dual login/tips when both storages are offered.
      if (prev === 'tutadrive' && tutaCloudOffered && localUsbOffered) return 'both';
      return 'tutadrive';
    });
  }, [localUsbOffered, tutaCloudOffered]);

  const selectUsbTab = useCallback(() => {
    setPaneFocus((prev) => {
      if (prev === 'compare') return 'usb';
      if (prev === 'usb' && tutaCloudOffered && localUsbOffered) return 'both';
      return 'usb';
    });
  }, [localUsbOffered, tutaCloudOffered]);

  const enterCompareMode = useCallback(() => {
    if (!(tutaCloudUnlocked && usbUnlocked && tutaCloudOffered && localUsbOffered)) return;
    if (paneFocus === 'tutadrive' || paneFocus === 'usb') {
      setCompareReturnFocus(paneFocus);
    }
    setPaneFocus('compare');
  }, [localUsbOffered, tutaCloudOffered, tutaCloudUnlocked, paneFocus, usbUnlocked]);

  const returnFromCompareMode = useCallback(() => {
    setPaneFocus(compareReturnFocus === 'usb' ? 'usb' : 'tutadrive');
  }, [compareReturnFocus]);

  const handleTutaCloudSessionEnded = useCallback(() => {
    setTutaCloudUnlocked(false);
    setSessionCountsRefreshToken((n) => n + 1);
    setPaneFocus((prev) => {
      if (prev === 'compare') return usbUnlocked ? 'usb' : 'both';
      if (prev === 'tutadrive' && localUsbOffered) return 'both';
      return prev;
    });
  }, [localUsbOffered, usbUnlocked]);

  const handleUsbSessionEnded = useCallback(() => {
    setUsbUnlocked(false);
    setSessionCountsRefreshToken((n) => n + 1);
    setPaneFocus((prev) => {
      if (prev === 'compare') return tutaCloudUnlocked ? 'tutadrive' : 'both';
      if (prev === 'usb' && tutaCloudOffered) return 'both';
      return prev;
    });
  }, [tutaCloudOffered, tutaCloudUnlocked]);

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
    if (tutaCloudDualLogoffBusy || !tutaCloudUnlocked) return;
    setTutaCloudDualLogoffBusy(true);
    setError('');
    try {
      await logoffRecordVaultStorage({ storageType: 'tutadrive' });
      handleTutaCloudSessionEnded();
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Log off TutaCloud failed'));
    } finally {
      setTutaCloudDualLogoffBusy(false);
    }
  }, [tutaCloudDualLogoffBusy, tutaCloudUnlocked, handleTutaCloudSessionEnded, tutaDriveMode]);

  const handleUsbLocationChange = useCallback((label) => {
    setUsbVolumeLabel(String(label || '').trim());
  }, []);

  // Open TutaNotes Cloud / USB share one vault-password popup (Step 1), then resume icon unlock.
  // Mobile upload uses a separate sheet and never reaches these handlers.
  const handleTutaCloudOpenClicked = useCallback(() => {
    if (accessUnlockedRef.current) return false;
    pendingOpenRef.current = { storageType: 'tutadrive' };
    setAccessGateStorageType('tutadrive');
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
    if (pending?.storageType === 'tutadrive') {
      setTutaCloudProceedOpenToken((n) => n + 1);
    } else if (pending?.storageType === 'usb') {
      setUsbProceedOpenToken((n) => n + 1);
    }
  }, []);

  const handleAccessGateClose = useCallback(() => {
    setAccessGateOpen(false);
    pendingOpenRef.current = null;
    navigate('/mall', { replace: true });
  }, [navigate]);

  const handleAccessVaultFormatted = useCallback((formattedSide) => {
    if (formattedSide === 'usb') {
      setUsbGateRefreshToken((n) => n + 1);
    } else if (formattedSide === 'tutadrive') {
      setTutaCloudGateRefreshToken((n) => n + 1);
    }
  }, []);

  const showWorkspace = storageConfigLoaded && !sessionChecking;
  const showTabBar = tutaCloudOffered && localUsbOffered;
  const showDual = showTabBar && paneFocus === 'both';
  const showCompare = showTabBar && paneFocus === 'compare';
  const canEnterCompare = Boolean(tutaCloudUnlocked && usbUnlocked && showTabBar);
  const cloudTabLabel = TAB_LABEL_TUTACLOUD;
  const cloudTabColor = TUTACLOUD_TAB_COLOR;
  const cloudLogOffLabel = 'Log off TutaCloud';
  const CloudGate = RecordVaultTutaDriveGate;

  // Tutorial lives on the usage bar (USB + TutaCloud) — never in the site header.
  useEffect(() => {
    clearTutaNotesTutorialChrome();
    return () => {
      clearTutaNotesTutorialChrome();
    };
  }, []);

  const tutaCloudVisible =
    tutaCloudOffered && (showDual || showCompare || paneFocus === 'tutadrive' || !localUsbOffered);
  const usbVisible = localUsbOffered && (showDual || showCompare || paneFocus === 'usb' || !tutaCloudOffered);
  const sideBySideLayout = showDual || showCompare;

  const renderTutaCloudBody = () => {
    if (showDual && tutaCloudUnlocked) {
      return (
        <StorageCenterCluster>
          <GreenButton
            type="button"
            role="tab"
            aria-selected={paneFocus === 'tutadrive'}
            title={
              tutaDriveMode
                ? 'Open or reload TutaNotes notes on TutaDrive'
                : 'Open or reload TutaNotes notes on OneDrive'
            }
            onClick={selectTutaCloudTab}
            sx={storageTabButtonSx}
          >
            {cloudTabLabel}
          </GreenButton>
          <DualLogOffButton
            label={cloudLogOffLabel}
            onClick={() => void handleDualPaneLogOffOneDrive()}
            disabled={tutaCloudDualLogoffBusy}
          />
        </StorageCenterCluster>
      );
    }
    // Expanded Cloud tab, compare mode, or Cloud-only → notebooks workspace.
    if (tutaCloudUnlocked && (paneFocus === 'tutadrive' || paneFocus === 'compare' || !localUsbOffered)) {
      return (
        <RecordVaultPaneProvider storageType="tutadrive">
          <RecordVaultWorkspacePane
            unlocked
            compact
            compareMode={showCompare}
            paneLabel="TutaCloud"
            canEnterCompare={canEnterCompare}
            onEnterCompare={enterCompareMode}
            onReturnFromCompare={returnFromCompareMode}
            onSessionEnded={handleTutaCloudSessionEnded}
            ragUiEnabled={ragUiEnabled}
          />
        </RecordVaultPaneProvider>
      );
    }
    if (showDual || !tutaCloudUnlocked) {
      return (
        <LoginScrollArea>
          {showDual ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <GreenButton
                type="button"
                role="tab"
                aria-selected={paneFocus === 'tutadrive'}
                title={
                  tutaDriveMode
                    ? 'Expand TutaNotes on TutaDrive to the full window'
                    : 'Expand TutaNotes on OneDrive to the full window'
                }
                onClick={selectTutaCloudTab}
                sx={storageTabButtonSx}
              >
                {cloudTabLabel}
              </GreenButton>
              <CloudGate
                embedded
                open
                onUnlocked={handleTutaCloudUnlocked}
                onOpenClicked={handleTutaCloudOpenClicked}
                proceedOpenToken={tutaCloudProceedOpenToken}
                accessFormatRefreshToken={tutaCloudGateRefreshToken}
                {...(tutaDriveMode && !localUsbOffered ? { autoOpenOnMount: true } : {})}
              />
            </Box>
          ) : (
            <CloudGate
              embedded
              open
              onUnlocked={handleTutaCloudUnlocked}
              onOpenClicked={handleTutaCloudOpenClicked}
              proceedOpenToken={tutaCloudProceedOpenToken}
              accessFormatRefreshToken={tutaCloudGateRefreshToken}
              {...(tutaDriveMode && !localUsbOffered ? { autoOpenOnMount: true } : {})}
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
        bgcolor: TUTANOTES_WORKSPACE_PANEL_BG
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

      {isMobileUploadOnly ? (
        <RecordVaultMobileDirectUploadDialog
          open
          onClose={() => {}}
          disabled={false}
          title="Upload to TutaNotes"
          noteTitle="Mobile Upload"
          onPickFile={async () => true}
          onExitToMall={async () => {
            clearMobileTutaNotesUploadSession();
            setMobileTutaNotesUploadSession(false);
          }}
          product={MOBILE_UPLOAD_PRODUCT_TUTANOTES}
        />
      ) : null}

      {isMobileUploadOnly ? null : (
      <>
      <BusyHourglassOverlay
        open={!storageConfigLoaded || sessionChecking}
        label="Loading vault"
        backdropSx={myNoteLoadingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={usbDualLogoffBusy || tutaCloudDualLogoffBusy}
        label={tutaCloudDualLogoffBusy ? 'Logging off OneDrive' : 'Logging off USB'}
        backdropSx={myNoteLoadingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />

      {error ? (
        <Typography sx={{ color: 'error.main', fontWeight: 700, px: 1, py: 0.5 }}>{error}</Typography>
      ) : null}

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {showWorkspace ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {showTabBar && !showCompare && !showDual && !hideMyNoteShellForMobileUpload ? (
            <Box role="tablist" aria-label="TutaNotes storage" {...guestDemoAllowProps()} sx={storageTabBarSx}>
              <Box sx={storageTabStripSx(cloudTabColor)}>
                <GreenButton
                  type="button"
                  role="tab"
                  aria-selected={paneFocus === 'tutadrive'}
                  title={
                    paneFocus === 'tutadrive'
                      ? tutaCloudOffered && localUsbOffered
                        ? 'Click again to show TutaCloud and USB side by side'
                        : 'TutaCloud is open'
                      : tutaCloudUnlocked
                        ? 'Open or reload TutaNotes notes on TutaCloud'
                        : 'Expand TutaNotes on TutaCloud to the full window'
                  }
                  onClick={selectTutaCloudTab}
                  sx={storageTabButtonSx}
                >
                  {cloudTabLabel}
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
            {tutaCloudOffered ? (
              <Box
                sx={{
                  ...loginColumnSx(),
                  display: tutaCloudVisible ? 'flex' : 'none',
                  borderColor: cloudTabColor,
                  overflow: showDual ? 'visible' : 'hidden',
                  bgcolor:
                    showDual || !tutaCloudUnlocked ? cloudTabColor : TUTANOTES_WORKSPACE_PANEL_BG
                }}
              >
                {/* Yellow title row when only one storage mode is offered, or per-pane titles in compare. */}
                {(!showTabBar || showCompare) && !hideMyNoteShellForMobileUpload ? (
                  <PaneHeader
                    title={cloudTabLabel}
                    logoSrc={TUTANOTES_CLOUD_LOGO}
                    titleTooltip={TUTANOTES_CLOUD_PANE_TOOLTIP}
                    stripColor={showCompare ? cloudTabColor : undefined}
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
                  {renderTutaCloudBody()}
                </Box>
                {!tutaCloudUnlocked ? (
                  <RecordVaultSessionFileCountsBar refreshToken={sessionCountsRefreshToken} />
                ) : null}
              </Box>
            ) : null}

          </Box>
        </Box>
      ) : null}
      </Box>
      </>
      )}

      {profilesRecordsOpen ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 15000,
            overflow: 'auto',
            bgcolor: TUTANOTES_WORKSPACE_PANEL_BG,
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
  );
}

MyRecordVault.path = MY_RECORD_VAULT_PATH;
