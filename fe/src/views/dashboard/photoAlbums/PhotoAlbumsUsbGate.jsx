import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import GreenButton from 'ui-component/GreenButton';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import PhotoAlbumsUsbLocationPicker from './PhotoAlbumsUsbLocationPicker';
import PhotoAlbumsUsbAssignmentDropZone from './PhotoAlbumsUsbAssignmentDropZone';
import PhotoAlbumsOneDriveGate from './PhotoAlbumsOneDriveGate';
import PhotoAlbumsViewVaultDialog from './PhotoAlbumsViewVaultDialog';
import PhotoAlbumsUsbBackupDialog from './PhotoAlbumsUsbBackupDialog';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import { themedConfirm } from 'utils/themedDialog';
import { photoAlbumsPopupCloseSx } from './photoAlbumsPopupCloseSx';
import {
  tutaPhotoAlbumsFormatPostLoginButtonSx,
  tutaPhotoAlbumsOrangePostLoginButtonSx,
  tutaPhotoAlbumsPostLoginActionButtonSx,
  tutaPhotoAlbumsPostLoginButtonRowSx,
  tutaPhotoAlbumsUsbMoreChoicesButtonSx,
  tutaPhotoAlbumsYellowPostLoginButtonSx
} from './tutaPhotoAlbumsPostLoginActionButtonSx';
import {
  fetchPhotoAlbumsUsbUnlockGuard,
  formatPhotoAlbumsUsb,
  fetchPhotoAlbumsUsbLocations,
  initPhotoAlbumsUsb,
  unlockPhotoAlbumsUsb,
  fetchPhotoAlbumsUsbStatus,
  isPhotoAlbumsBridgeAvailable,
  isPhotoAlbumsBridgeRouteMissingError,
  PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE,
  probePhotoAlbumsBridgeSupportsPhotoAlbums,
  fetchPhotoAlbumsOneDriveConfig,
  fetchPhotoAlbumsOneDriveStatus,
  initPhotoAlbumsOneDrive,
  unlockPhotoAlbumsOneDrive,
  fetchPhotoAlbumsStorageConfig
} from 'api/photoAlbumsFe';
import { normalizeUsbBridgeInstallerUrl } from 'utils/usbBridgeInstallerDownloadUrl';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { useAuth } from 'contexts/AuthContext';
import {
  setPhotoAlbumsBridgeSinglesId,
  markPhotoAlbumsBridgeUserGesture,
  isPhotoAlbumsBridgeHostContext,
  formatPhotoAlbumsBridgeClientError,
  setPhotoAlbumsBridgeStorageType
} from 'api/photoAlbumsBridgeFe';
import { rvCloudWarn } from 'utils/photoAlbumsCloudDebugLog';
import {
  readPhotoAlbumsLastUsbLocation,
  readPhotoAlbumsLastBackupUsbLocation,
  writePhotoAlbumsLastUsbLocation,
  writePhotoAlbumsLastBackupUsbLocation,
  clearPhotoAlbumsLastBackupUsbLocation,
  clearPhotoAlbumsLastUsbLocation
} from 'utils/photoAlbumsUsbPreference';
import { mergePhotoAlbumsUsbLocationStats } from 'utils/photoAlbumsUsbStatsLabel';
import {
  TUTAPHOTOALBUMS_USB_LOGO,
  TUTAPHOTOALBUMS_USB_LOGIN_TITLE,
  TUTAPHOTOALBUMS_HALF_PANEL_WIDTH,
  tutaPhotoAlbumsHalfPanelSx
} from './tutaPhotoAlbumsBranding';
import TutaPhotoAlbumsBrandTitle from './TutaPhotoAlbumsBrandTitle';
import TutaPhotoAlbumsVideoTutorialLink from './TutaPhotoAlbumsVideoTutorialLink';
import PhotoAlbumsUsbBridgeStatusPanel from './PhotoAlbumsUsbBridgeStatusPanel';

const ASSIGNED_USB_STATS_REFRESH_MS = 2500;

function pickDefaultStorageBackend(cfg) {
  if (cfg?.oneDrive?.visible) return 'onedrive';
  if (cfg?.localUsb?.visible) return 'usb';
  return 'onedrive';
}

function buildPrivacyStorageLabel(cfg) {
  const parts = [];
  if (cfg?.oneDrive?.visible) parts.push('OneDrive');
  if (cfg?.localUsb?.visible) parts.push('personal USB');
  return parts.length ? parts.join(', ') : 'your chosen storage';
}

export default function PhotoAlbumsUsbGate({
  open,
  embedded = false,
  usbOnly = false,
  onUnlocked,
  onSkip,
  onOpenClicked,
  /** Selected USB volume name (radio) — updates the USB tab / pane title immediately. */
  onUsbLocationChange,
  proceedOpenToken = 0,
  /** Bumped when Access Gate formats USB after 5 wrong vault passwords. */
  accessFormatRefreshToken = 0,
  /** Hide inline error+Dismiss while Full Disk Encryption covers this gate. */
  suppressInlineErrors = false,
  /** Expired vault session — show on login panel instead of the workspace editor. */
  sessionNotice = ''
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPrimary, setSelectedPrimary] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorSecondary, setErrorSecondary] = useState('');
  const [unlockGuard, setUnlockGuard] = useState(null);
  const [preferredMountPath, setPreferredMountPath] = useState('');
  const [pickerRefreshToken, setPickerRefreshToken] = useState(0);
  const [dragOverRole, setDragOverRole] = useState('');
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeError, setBridgeError] = useState('');
  const [bridgeConnecting, setBridgeConnecting] = useState(false);
  const [bridgeDriveLabels, setBridgeDriveLabels] = useState([]);
  const [bridgeHasAnyUsb, setBridgeHasAnyUsb] = useState(false);
  const [usbBridgeInstallerMac, setUsbBridgeInstallerMac] = useState(
    '/api/photoAlbums/bridge/installer/mac'
  );
  const [usbBridgeInstallerWin, setUsbBridgeInstallerWin] = useState(
    '/api/photoAlbums/bridge/installer/win'
  );
  const [includeUsbDmgExe, setIncludeUsbDmgExe] = useState(true);
  const prodBridgeHost = isPhotoAlbumsBridgeHostContext();
  const [oneDriveEnabled, setOneDriveEnabled] = useState(false);
  const [oneDriveVisible, setOneDriveVisible] = useState(false);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [oneDriveEmail, setOneDriveEmail] = useState('');
  const [oneDriveHasVault, setOneDriveHasVault] = useState(false);
  const [oneDriveNeedsReformat, setOneDriveNeedsReformat] = useState(false);
  const [oneDriveLegacyPinVault, setOneDriveLegacyPinVault] = useState(false);
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [storageBackend, setStorageBackend] = useState(usbOnly ? 'usb' : 'onedrive');
  const [localUsbVisible, setLocalUsbVisible] = useState(usbOnly);
  const [backupUsbEnabled, setBackupUsbEnabled] = useState(false);
  const [videoTutorialUrl, setVideoTutorialUrl] = useState('');
  const [privacyStorageLabel, setPrivacyStorageLabel] = useState('your chosen storage');
  const [viewVaultOpen, setViewVaultOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  /** Compact: Open + More Choices. Expanded: full 2×2 post-login grid. Independent of Cloud. */
  const [showMoreUsbChoices, setShowMoreUsbChoices] = useState(false);
  /** After unlock: 'open' → workspace, 'view' → View USB dialog, 'backup' → Backup dialog. */
  const pendingAfterUnlockRef = useRef('open');

  useEffect(() => {
    if (!open) setShowMoreUsbChoices(false);
  }, [open]);

  useEffect(() => {
    const notice = String(sessionNotice || '').trim();
    if (!notice) return;
    setError(notice);
    setErrorSecondary('');
  }, [sessionNotice]);

  useEffect(() => {
    setPhotoAlbumsBridgeSinglesId(user?.singles_id ?? null);
  }, [user?.singles_id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchPhotoAlbumsStorageConfig();
        if (cancelled) return;
        if (usbOnly) {
          setOneDriveVisible(false);
          setOneDriveEnabled(false);
          setLocalUsbVisible(true);
          setStorageBackend('usb');
          setPrivacyStorageLabel('personal USB');
        } else {
          setOneDriveVisible(Boolean(cfg.oneDrive.visible));
          setOneDriveEnabled(Boolean(cfg.oneDrive.enabled));
          setLocalUsbVisible(Boolean(cfg.localUsb.visible));
          setStorageBackend(pickDefaultStorageBackend(cfg));
          setPrivacyStorageLabel(buildPrivacyStorageLabel(cfg));
        }
        const backupEnabled = cfg.backupUsbEnabled !== false;
        setBackupUsbEnabled(backupEnabled);
        if (!backupEnabled) {
          setSelectedBackup(null);
          clearPhotoAlbumsLastBackupUsbLocation();
        }
        setVideoTutorialUrl(String(cfg?.videoTutorialTutaphotoalbums || '').trim());
        setIncludeUsbDmgExe(cfg?.includeUsbDmgExe !== false);
        if (cfg?.usbBridgeInstallers?.mac) {
          setUsbBridgeInstallerMac(normalizeUsbBridgeInstallerUrl(cfg.usbBridgeInstallers.mac, 'mac'));
        }
        if (cfg?.usbBridgeInstallers?.win) {
          setUsbBridgeInstallerWin(normalizeUsbBridgeInstallerUrl(cfg.usbBridgeInstallers.win, 'win'));
        }
      } catch (err) {
        if (cancelled) return;
        const status = Number(err?.response?.status);
        if (status === 404) {
          // Backend predates /storage/config — show all choices until BE is restarted.
          if (usbOnly) {
            setOneDriveVisible(false);
            setLocalUsbVisible(true);
            setStorageBackend('usb');
            setPrivacyStorageLabel('personal USB');
          } else {
            setOneDriveVisible(true);
            setLocalUsbVisible(true);
            setPrivacyStorageLabel('OneDrive or personal USB');
          }
          return;
        }
        rvCloudWarn('PhotoAlbums', 'storage config unavailable — sections stay hidden until BE restart', {
          status: status || null,
          message: err?.response?.data?.error || err?.message || null
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, usbOnly]);

  useEffect(() => {
    if (backupUsbEnabled) return;
    setSelectedBackup(null);
    clearPhotoAlbumsLastBackupUsbLocation();
  }, [backupUsbEnabled]);

  const applyUsbLocationLabels = useCallback((locations) => {
    const list = Array.isArray(locations) ? locations : [];
    setBridgeHasAnyUsb(list.length > 0);
    const labels = list
      .filter((loc) => loc?.hasVault || loc?.partial)
      .map((loc) => String(loc.label || '').trim())
      .filter(Boolean);
    setBridgeDriveLabels(labels);
    return list.length > 0;
  }, []);

  const connectLocalBridge = useCallback(async () => {
    markPhotoAlbumsBridgeUserGesture();
    setBridgeConnecting(true);
    setBridgeError('');
    const support = await probePhotoAlbumsBridgeSupportsPhotoAlbums();
    setBridgeConnected(support.ok && !support.outdated);
    if (support.outdated) {
      setBridgeDriveLabels([]);
      setBridgeHasAnyUsb(false);
      setBridgeError(support.error || PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
      setError(support.error || PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
      setBridgeConnecting(false);
      return;
    }
    if (!support.ok) {
      // Localhost can still list USBs via the API — keep that so we hide the download banner.
      if (!prodBridgeHost) {
        try {
          const locations = await fetchPhotoAlbumsUsbLocations();
          if (applyUsbLocationLabels(locations)) {
            setBridgeError('');
            setPickerRefreshToken((token) => token + 1);
            setBridgeConnecting(false);
            return;
          }
        } catch {
          // Fall through to clear + error.
        }
      }
      setBridgeDriveLabels([]);
      setBridgeHasAnyUsb(false);
      setBridgeError(support.error || 'Unable to reach the local bridge.');
      setBridgeConnecting(false);
      return;
    }
    try {
      const locations = await fetchPhotoAlbumsUsbLocations();
      applyUsbLocationLabels(locations);
      setBridgeError('');
      setPickerRefreshToken((token) => token + 1);
    } catch (err) {
      if (isPhotoAlbumsBridgeRouteMissingError(err)) {
        setBridgeError(PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
        setError(PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
      } else {
        setBridgeError(formatPhotoAlbumsBridgeClientError(err));
      }
      setBridgeHasAnyUsb(false);
      setBridgeDriveLabels([]);
    } finally {
      setBridgeConnecting(false);
    }
  }, [applyUsbLocationLabels, prodBridgeHost]);

  useEffect(() => {
    if (!open || !oneDriveConnected) return;
    setError((prev) => (/OneDrive connection failed/i.test(prev) ? '' : prev));
    setErrorSecondary((prev) =>
      /Microsoft|Azure|redirect URI|MICROSOFT_OAUTH|Graph API|server_error/i.test(prev) ? '' : prev
    );
  }, [open, oneDriveConnected]);

  useEffect(() => {
    if (!open || !localUsbVisible) return undefined;
    const refreshBridge = async () => {
      const support = await probePhotoAlbumsBridgeSupportsPhotoAlbums();
      setBridgeConnected(support.ok && !support.outdated);
      if (support.outdated) {
        setBridgeDriveLabels([]);
        setBridgeHasAnyUsb(false);
        setBridgeError(support.error || PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
        setError(support.error || PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
        return;
      }
      if (!support.ok) {
        if (!prodBridgeHost) {
          try {
            const locations = await fetchPhotoAlbumsUsbLocations();
            if (applyUsbLocationLabels(locations)) {
              setBridgeError('');
              return;
            }
          } catch {
            // Fall through to clear labels.
          }
        }
        setBridgeDriveLabels([]);
        setBridgeHasAnyUsb(false);
        return;
      }
      try {
        const locations = await fetchPhotoAlbumsUsbLocations();
        applyUsbLocationLabels(locations);
        setBridgeError('');
      } catch (err) {
        if (isPhotoAlbumsBridgeRouteMissingError(err)) {
          setBridgeError(PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
          setError(PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
        } else {
          setBridgeError(formatPhotoAlbumsBridgeClientError(err));
        }
        setBridgeHasAnyUsb(false);
        setBridgeDriveLabels([]);
      }
    };
    void refreshBridge();
    const timerId = window.setInterval(() => {
      void refreshBridge();
    }, 4000);
    return () => window.clearInterval(timerId);
  }, [open, localUsbVisible, prodBridgeHost, applyUsbLocationLabels]);

  useEffect(() => {
    if (bridgeConnected) {
      setPickerRefreshToken((token) => token + 1);
    }
  }, [bridgeConnected]);

  const refreshOneDriveStatus = useCallback(async () => {
    if (!oneDriveVisible) {
      setOneDriveEnabled(false);
      setOneDriveConnected(false);
      setOneDriveEmail('');
      setOneDriveHasVault(false);
      setOneDriveNeedsReformat(false);
      setOneDriveLegacyPinVault(false);
      return;
    }
    try {
      const config = await fetchPhotoAlbumsOneDriveConfig();
      setOneDriveEnabled(Boolean(config.enabled));
      if (!config.enabled) {
        setOneDriveConnected(false);
        setOneDriveEmail('');
        setOneDriveHasVault(false);
        setOneDriveNeedsReformat(false);
        setOneDriveLegacyPinVault(false);
        return;
      }
      const status = await fetchPhotoAlbumsOneDriveStatus();
      const connected = Boolean(status.onedrive?.connected);
      setOneDriveConnected(connected);
      setOneDriveEmail(status.onedrive?.email || '');
      setOneDriveHasVault(Boolean(status.onedrive?.hasVault));
      setOneDriveNeedsReformat(Boolean(status.onedrive?.needsReformat));
      setOneDriveLegacyPinVault(Boolean(status.onedrive?.legacyPinVault));
      if (connected) {
        setError((prev) => (/OneDrive/i.test(prev) ? '' : prev));
        setErrorSecondary((prev) =>
          /Microsoft|Azure|redirect URI|MICROSOFT_OAUTH|Graph API/i.test(prev) ? '' : prev
        );
      }
    } catch {
      setOneDriveConnected(false);
    }
  }, [oneDriveVisible]);

  useEffect(() => {
    if (!open || !oneDriveVisible) return undefined;
    void refreshOneDriveStatus();
    const timerId = window.setInterval(() => {
      void refreshOneDriveStatus();
    }, 8000);
    return () => window.clearInterval(timerId);
  }, [open, oneDriveVisible, refreshOneDriveStatus]);

  const refreshUnlockGuard = useCallback(async (mountPath) => {
    const pathValue = String(mountPath ?? '').trim();
    if (!pathValue) {
      setUnlockGuard(null);
      return;
    }
    try {
      const status = await fetchPhotoAlbumsUsbUnlockGuard(pathValue);
      setUnlockGuard(status);
    } catch {
      setUnlockGuard(null);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setSelectedPrimary(null);
      setSelectedBackup(null);
      setError('');
      setUnlockGuard(null);
      setPreferredMountPath('');
      setStorageBackend(usbOnly ? 'usb' : 'onedrive');
      setOneDriveVisible(false);
      setLocalUsbVisible(usbOnly);
      setOneDriveEmail('');
      setOneDriveConnected(false);
      setOneDriveHasVault(false);
      setOneDriveNeedsReformat(false);
      setOneDriveLegacyPinVault(false);
      return undefined;
    }
    setPreferredMountPath(readPhotoAlbumsLastUsbLocation()?.mountPath || '');
    return undefined;
  }, [open, usbOnly]);

  useEffect(() => {
    if (!unlockGuard?.locked || !unlockGuard?.remainingSeconds) return undefined;
    if (unlockGuard.remainingSeconds <= 0) return undefined;
    const timerId = window.setInterval(() => {
      setUnlockGuard((prev) => {
        if (!prev?.locked) return prev;
        const nextRemaining = Math.max(0, Number(prev.remainingSeconds || 0) - 1);
        if (nextRemaining <= 0) {
          return { ...prev, locked: false, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: nextRemaining };
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [unlockGuard?.locked, unlockGuard?.remainingSeconds]);

  const handleSelectPrimary = useCallback((location) => {
    setSelectedPrimary(location);
    writePhotoAlbumsLastUsbLocation(location);
    setSelectedBackup((prev) => {
      if (prev?.mountPath === location?.mountPath) {
        clearPhotoAlbumsLastBackupUsbLocation();
        return null;
      }
      return prev;
    });
    setError('');
    setUnlockGuard(null);
  }, []);

  useEffect(() => {
    const label = String(selectedPrimary?.label || '').trim();
    if (!label) return;
    onUsbLocationChange?.(label);
  }, [onUsbLocationChange, selectedPrimary?.label, selectedPrimary?.mountPath]);

  const handleSelectBackup = useCallback((location) => {
    if (selectedPrimary?.mountPath === location?.mountPath) return;
    setSelectedBackup(location);
    writePhotoAlbumsLastBackupUsbLocation(location);
    setError('');
  }, [selectedPrimary?.mountPath]);

  const handleClearBackup = useCallback(() => {
    setSelectedBackup(null);
    clearPhotoAlbumsLastBackupUsbLocation();
    setError('');
  }, []);

  useEffect(() => {
    if (!open || !localUsbVisible || (!selectedPrimary?.mountPath && !selectedBackup?.mountPath)) return undefined;
    let cancelled = false;

    const refreshAssignedStats = async () => {
      try {
        const locations = await fetchPhotoAlbumsUsbLocations();
        if (cancelled) return;
        setSelectedPrimary((prev) => {
          if (!prev?.mountPath) return prev;
          const match = locations.find((loc) => loc.mountPath === prev.mountPath);
          return match ? mergePhotoAlbumsUsbLocationStats(prev, match) : prev;
        });
        setSelectedBackup((prev) => {
          if (!prev?.mountPath) return prev;
          const match = locations.find((loc) => loc.mountPath === prev.mountPath);
          return match ? mergePhotoAlbumsUsbLocationStats(prev, match) : prev;
        });
      } catch {
        // ignore refresh errors
      }
    };

    void refreshAssignedStats();
    const timerId = window.setInterval(() => {
      void refreshAssignedStats();
    }, ASSIGNED_USB_STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [open, localUsbVisible, selectedPrimary?.mountPath, selectedBackup?.mountPath]);

  const tryAssignPrimary = useCallback(
    (location) => {
      if (!location?.mountPath) return;
      if (selectedBackup?.mountPath === location.mountPath) return;
      setDragOverRole('');
      handleSelectPrimary(location);
    },
    [handleSelectPrimary, selectedBackup?.mountPath]
  );

  const tryAssignBackup = useCallback(
    (location) => {
      if (!location?.mountPath) return;
      if (selectedPrimary?.mountPath === location.mountPath) return;
      setDragOverRole('');
      handleSelectBackup(location);
    },
    [handleSelectBackup, selectedPrimary?.mountPath]
  );

  const assignmentPanelFontSx = {
    fontSize: '0.75em',
    '& .MuiTypography-root': {
      fontSize: 'inherit'
    },
    '& .MuiButton-root': {
      fontSize: 'inherit !important'
    }
  };

  const vaultActionButtonSx = {
    width: '100%',
    justifyContent: 'center',
    whiteSpace: 'normal',
    textAlign: 'center',
    lineHeight: 1.25,
    py: 0.85,
    px: 1.25,
    height: 'auto',
    minHeight: 40,
    '& .MuiButton-label': {
      whiteSpace: 'normal',
      lineHeight: 1.25
    }
  };

  const unlockIconRowButtonSx = {
    ...tutaPhotoAlbumsPostLoginActionButtonSx,
    ...vaultActionButtonSx,
    width: 'auto',
    minWidth: { xs: '100%', sm: 260 },
    maxWidth: { xs: '100%', sm: 320 },
    flexShrink: 0,
    alignSelf: { xs: 'stretch', sm: 'center' },
    whiteSpace: 'nowrap'
  };

  const handleCloseToMall = useCallback(() => {
    navigate('/mall');
  }, [navigate]);

  const handleCloseGate = useCallback(() => {
    if (onSkip) {
      onSkip();
      return;
    }
    handleCloseToMall();
  }, [onSkip, handleCloseToMall]);

  const handleResetAssignments = useCallback(() => {
    setSelectedPrimary(null);
    setSelectedBackup(null);
    clearPhotoAlbumsLastUsbLocation();
    clearPhotoAlbumsLastBackupUsbLocation();
    setPreferredMountPath('');
    setUnlockGuard(null);
    setError('');
    setDragOverRole('');
    setPickerRefreshToken((value) => value + 1);
    onUsbLocationChange?.('');
  }, [onUsbLocationChange]);

  const finishUsbUnlockSuccess = useCallback(() => {
    const pending = pendingAfterUnlockRef.current || 'open';
    pendingAfterUnlockRef.current = 'open';
    setUnlockGuard(null);
    setPhotoAlbumsBridgeStorageType('usb');
    if (pending === 'view') {
      setViewVaultOpen(true);
      return;
    }
    if (pending === 'backup') {
      setBackupDialogOpen(true);
      return;
    }
    onUnlocked?.();
  }, [onUnlocked]);

  const unlockOrInitUsbVaultRef = useRef(null);

  const unlockOrInitUsbVault = async ({ backend, location, setup } = {}) => {
    const activeBackend = backend || storageBackend;
    if (activeBackend === 'onedrive') {
      if (!oneDriveConnected) {
        setError('Connect OneDrive first');
        return;
      }
      setBusy(true);
      setError('');
      try {
        if (!oneDriveHasVault) {
          await initPhotoAlbumsOneDrive();
          setOneDriveHasVault(true);
          onUnlocked?.();
          return;
        }
        await unlockPhotoAlbumsOneDrive();
        setUnlockGuard(null);
        onUnlocked?.();
      } catch (err) {
        const data = err?.response?.data || {};
        if (data.vaultWiped) {
          setOneDriveHasVault(false);
          setOneDriveNeedsReformat(false);
          setUnlockGuard(null);
          setError(data.error || 'This OneDrive vault has been security-wiped clean.');
          return;
        }
        if (data.lockedUntil || data.remainingSeconds) {
          setUnlockGuard({
            locked: Number(data.remainingSeconds) > 0,
            lockedUntil: data.lockedUntil || null,
            remainingSeconds: Math.max(0, Number(data.remainingSeconds) || 0),
            failedAttempts: data.failedAttempts ?? null
          });
        }
        setError(data.error || err?.message || 'Unable to open OneDrive vault');
      } finally {
        setBusy(false);
      }
      return;
    }

    const primaryLocation = location || selectedPrimary;
    const mountPath = String(primaryLocation?.mountPath ?? '').trim();
    const backupMountPath =
      backupUsbEnabled && selectedBackup?.mountPath
        ? String(selectedBackup.mountPath).trim() || null
        : null;
    if (!mountPath) {
      setError('Choose a USB drive first');
      return;
    }
    const usbSetup = setup === true || Boolean(primaryLocation && !primaryLocation.hasVault);
    setBusy(true);
    setError('');
    try {
      if (usbSetup) {
        await initPhotoAlbumsUsb({ mountPath, backupMountPath });
        writePhotoAlbumsLastUsbLocation({ mountPath, label: primaryLocation.label, hasVault: true });
        if (backupMountPath) {
          writePhotoAlbumsLastBackupUsbLocation({
            mountPath: backupMountPath,
            label: selectedBackup.label,
            hasVault: true
          });
        }
        pendingAfterUnlockRef.current = 'open';
        finishUsbUnlockSuccess();
        return;
      }
      await unlockPhotoAlbumsUsb({ mountPath, backupMountPath });
      writePhotoAlbumsLastUsbLocation({ mountPath, label: primaryLocation.label, hasVault: true });
      if (backupMountPath) {
        writePhotoAlbumsLastBackupUsbLocation({
          mountPath: backupMountPath,
          label: selectedBackup.label,
          hasVault: true
        });
      }
      finishUsbUnlockSuccess();
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.vaultWiped) {
        setSelectedPrimary((prev) => (prev ? { ...prev, hasVault: false, legacyPinVault: false } : prev));
        writePhotoAlbumsLastUsbLocation({ mountPath, label: selectedPrimary?.label, hasVault: false });
        setUnlockGuard(null);
        setError(data.error || 'This USB vault has been security-wiped clean.');
        return;
      }
      setError(data.error || err?.message || 'Unable to open USB vault');
      if (data.lockedUntil || data.remainingSeconds) {
        setUnlockGuard({
          locked: Number(data.remainingSeconds) > 0,
          lockedUntil: data.lockedUntil || null,
          remainingSeconds: Math.max(0, Number(data.remainingSeconds) || 0),
          failedAttempts: data.failedAttempts ?? null
        });
      } else if (selectedPrimary?.mountPath) {
        await refreshUnlockGuard(selectedPrimary.mountPath);
      }
    } finally {
      setBusy(false);
    }
  };

  unlockOrInitUsbVaultRef.current = unlockOrInitUsbVault;

  const openUsbVault = useCallback(
    async (afterUnlock = 'open') => {
      const intent = afterUnlock === 'view' || afterUnlock === 'backup' ? afterUnlock : 'open';
      pendingAfterUnlockRef.current = intent;

      // Already unlocked this vault — skip login hop and go straight to workspace/action.
      try {
        const status = await fetchPhotoAlbumsUsbStatus();
        if (status?.session?.unlocked) {
          if (intent === 'view') {
            pendingAfterUnlockRef.current = 'open';
            setViewVaultOpen(true);
            return;
          }
          if (intent === 'backup') {
            pendingAfterUnlockRef.current = 'open';
            setBackupDialogOpen(true);
            return;
          }
          finishUsbUnlockSuccess();
          return;
        }
      } catch {
        // Fall through to server-key unlock.
      }

      setStorageBackend('usb');
      await unlockOrInitUsbVaultRef.current?.({ backend: 'usb' });
    },
    [finishUsbUnlockSuccess]
  );

  const lastProceedOpenTokenRef = useRef(0);
  useEffect(() => {
    if (!proceedOpenToken || proceedOpenToken === lastProceedOpenTokenRef.current) return;
    lastProceedOpenTokenRef.current = proceedOpenToken;
    void openUsbVault('open');
  }, [proceedOpenToken, openUsbVault]);

  const lastAccessFormatRefreshTokenRef = useRef(0);
  useEffect(() => {
    if (!accessFormatRefreshToken || accessFormatRefreshToken === lastAccessFormatRefreshTokenRef.current) {
      return;
    }
    lastAccessFormatRefreshTokenRef.current = accessFormatRefreshToken;
    setSelectedPrimary((prev) => {
      if (!prev?.mountPath) return prev;
      const next = { ...prev, hasVault: false, legacyPinVault: false, partial: false };
      writePhotoAlbumsLastUsbLocation(next);
      return next;
    });
    setUnlockGuard(null);
    setPickerRefreshToken((value) => value + 1);
    setError('USB vault was formatted after five incorrect Encrypt Password attempts.');
  }, [accessFormatRefreshToken]);

  const handleFormatUsb = async (role) => {
    const location = role === 'primary' ? selectedPrimary : selectedBackup;
    const mountPath = String(location?.mountPath ?? '').trim();
    if (!mountPath || busy) return;
    const label = String(location?.label ?? mountPath);
    const confirmed = await themedConfirm(
      `Format and wipe the TutaPhotoAlbums vault on "${label}"?\n\nThis permanently deletes the TutaPhotoAlbums folder on this USB. Other files on the drive are not touched.`
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      const result = await formatPhotoAlbumsUsb(mountPath);
      const nextLocation = {
        mountPath: result.mountPath || mountPath,
        label: result.label || label,
        hasVault: false,
        legacyPinVault: false,
        partial: false
      };
      if (role === 'primary') {
        setSelectedPrimary(nextLocation);
        writePhotoAlbumsLastUsbLocation(nextLocation);
      } else {
        setSelectedBackup(nextLocation);
        writePhotoAlbumsLastBackupUsbLocation(nextLocation);
      }
      setUnlockGuard(null);
      setPickerRefreshToken((value) => value + 1);
      // After wipe, create a fresh vault with the USB key configured on the server.
      if (role === 'primary') {
        pendingAfterUnlockRef.current = 'open';
        await unlockOrInitUsbVault({ backend: 'usb', location: nextLocation, setup: true });
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to format USB vault');
    } finally {
      setBusy(false);
    }
  };

  const dismissLoginError = useCallback(() => {
    setError('');
    setErrorSecondary('');
  }, []);

  const loginErrorPopup = (
    <ColorTemplate16PopupCenterWide
      open={Boolean(error) && !suppressInlineErrors}
      onClose={dismissLoginError}
      closeOnBackdrop
      closeButtonAriaLabel="Close USB error"
    >
      <ColorTemplate16PopupCenterWide.Body spacing={2}>
        <ColorTemplate16PopupCenterWide.Title>TutaPhotoAlbums USB</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.ErrorBar sx={{ whiteSpace: 'pre-wrap' }}>{error}</ColorTemplate16PopupCenterWide.ErrorBar>
        {errorSecondary ? (
          <ColorTemplate16PopupCenterWide.SectionDescription
            sx={{ color: '#ffb4a9', fontWeight: 600, whiteSpace: 'pre-wrap', mb: 0, textAlign: 'center' }}
          >
            {errorSecondary}
          </ColorTemplate16PopupCenterWide.SectionDescription>
        ) : null}
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate16PopupCenterWide.ActionButton onClick={dismissLoginError}>OK</ColorTemplate16PopupCenterWide.ActionButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );

  const legacyPinVault =
    storageBackend === 'onedrive'
      ? oneDriveLegacyPinVault
      : Boolean(selectedPrimary?.legacyPinVault);
  const usbSelected =
    Boolean(selectedPrimary?.mountPath) && !busy && !oneDriveBusy;
  /** Valid TutaPhotoAlbums vault only — Open/View/Backup. Missing/broken → Format only. */
  const usbVaultBroken =
    Boolean(selectedPrimary?.legacyPinVault) || Boolean(selectedPrimary?.partial);
  const usbVaultReady = usbSelected && Boolean(selectedPrimary?.hasVault) && !usbVaultBroken;
  const canFormatUsb = usbSelected;
  const canOpenUsb = usbVaultReady;
  const canViewOrBackupUsb = usbVaultReady;
  const combinedStorageChoice = Boolean(!usbOnly && oneDriveVisible && localUsbVisible);

  const usbPostLoginActions = (
    <Box sx={tutaPhotoAlbumsPostLoginButtonRowSx}>
      {showMoreUsbChoices ? (
        <>
          <GreenButton
            type="button"
            singleLineLabel={false}
            onClick={() => setShowMoreUsbChoices(false)}
            sx={tutaPhotoAlbumsPostLoginActionButtonSx}
          >
            Less Choices
          </GreenButton>
          <GreenButton
            type="button"
            singleLineLabel={false}
            disabled={!canViewOrBackupUsb}
            onClick={() => {
              void openUsbVault('view');
            }}
            sx={tutaPhotoAlbumsYellowPostLoginButtonSx}
          >
            View USB
          </GreenButton>
          <GreenButton
            type="button"
            singleLineLabel={false}
            disabled={!canViewOrBackupUsb}
            onClick={() => {
              void openUsbVault('backup');
            }}
            sx={tutaPhotoAlbumsOrangePostLoginButtonSx}
          >
            Backup &amp; Restore USB
          </GreenButton>
          <GreenButton
            type="button"
            singleLineLabel={false}
            disabled={!canFormatUsb}
            onClick={() => void handleFormatUsb('primary')}
            sx={tutaPhotoAlbumsFormatPostLoginButtonSx}
          >
            Format TutaPhotoAlbums USB
          </GreenButton>
        </>
      ) : (
        <>
          <GreenButton
            type="button"
            singleLineLabel={false}
            disabled={!canOpenUsb}
            onClick={() => {
              if (
                onOpenClicked?.({ mountPath: selectedPrimary?.mountPath || '' }) === true
              ) {
                return;
              }
              void openUsbVault('open');
            }}
            {...guestDemoAllowProps()}
            sx={tutaPhotoAlbumsPostLoginActionButtonSx}
          >
            Open TutaPhotoAlbums USB
          </GreenButton>
          <GreenButton
            type="button"
            singleLineLabel={false}
            onClick={() => setShowMoreUsbChoices(true)}
            sx={tutaPhotoAlbumsUsbMoreChoicesButtonSx}
          >
            More Choices
          </GreenButton>
        </>
      )}
    </Box>
  );

  const usbBridgeStatus = localUsbVisible && includeUsbDmgExe ? (
    <>
      <PhotoAlbumsUsbBridgeStatusPanel
        bridgeConnected={bridgeConnected}
        bridgeConnecting={bridgeConnecting}
        driveLabels={bridgeDriveLabels}
        hasAnyUsb={bridgeHasAnyUsb || Boolean(selectedPrimary?.mountPath)}
        installerMacUrl={usbBridgeInstallerMac}
        installerWinUrl={usbBridgeInstallerWin}
        showConnectButton={!bridgeConnected}
        onConnectClick={() => void connectLocalBridge()}
      />
      {bridgeError ? (
        <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: '#b00020', fontWeight: 700, mb: 0 }}>
          {bridgeError}
        </ColorTemplate7PopupLargeDark.SectionDescription>
      ) : null}
    </>
  ) : null;

  const usbStorageColumn = localUsbVisible ? (
    <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0, alignSelf: 'stretch', height: 'fit-content' }}>
      {usbOnly ? (
        <>
          <TutaPhotoAlbumsBrandTitle
            logoSrc={TUTAPHOTOALBUMS_USB_LOGO}
            title={TUTAPHOTOALBUMS_USB_LOGIN_TITLE}
            logoSize={64}
            fitWidth
            sx={{
              width: '100%',
              justifyContent: 'flex-start',
              flexWrap: 'nowrap',
              px: 0.25,
              py: 0.5,
              boxSizing: 'border-box'
            }}
            labelSx={{
              fontWeight: 800,
              color: '#fff',
              WebkitTextFillColor: '#fff',
              lineHeight: 1.1
            }}
          />
          <TutaPhotoAlbumsVideoTutorialLink
            href={videoTutorialUrl}
            label="Click here for video tutorial on TutaPhotoAlbums"
          />
        </>
      ) : null}
      {usbBridgeStatus}
      <PhotoAlbumsUsbLocationPicker
        headerLabel={usbOnly || embedded ? TUTAPHOTOALBUMS_USB_LOGIN_TITLE : 'Pick Local USB Storage Location'}
        headerLogoSrc={usbOnly || embedded ? TUTAPHOTOALBUMS_USB_LOGO : null}
        hideHeader={Boolean(usbOnly)}
        bridgeConnected={bridgeConnected}
        waitForBridge={prodBridgeHost}
        selectedPath={selectedPrimary?.mountPath || ''}
        preferredMountPath={preferredMountPath}
        refreshToken={pickerRefreshToken}
        excludePaths={selectedBackup?.mountPath ? [selectedBackup.mountPath] : []}
        assignedPaths={
          usbOnly
            ? [selectedBackup?.mountPath].filter(Boolean)
            : [selectedPrimary?.mountPath, selectedBackup?.mountPath].filter(Boolean)
        }
        onSelect={handleSelectPrimary}
        onReset={handleResetAssignments}
      />

      {!combinedStorageChoice && !usbOnly && !embedded ? (
        <ColorTemplate7PopupLargeDark.SectionDescription sx={{ fontWeight: 700, mb: 0 }}>
          Or use USB storage (optional)
        </ColorTemplate7PopupLargeDark.SectionDescription>
      ) : null}

      {!usbOnly ? (
        <Stack
          spacing={0.75}
          sx={assignmentPanelFontSx}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setDragOverRole('');
            }
          }}
        >
          <Box onDragEnter={() => setDragOverRole('primary')}>
            <PhotoAlbumsUsbAssignmentDropZone
              label="Primary MyVault USB:"
              location={selectedPrimary}
              dragActive={dragOverRole === 'primary'}
              busy={busy}
              onAssign={(location) => {
                setStorageBackend('usb');
                tryAssignPrimary(location);
              }}
              onFormat={() => void handleFormatUsb('primary')}
            />
          </Box>
          {backupUsbEnabled ? (
            <Box onDragEnter={() => setDragOverRole('backup')}>
              <PhotoAlbumsUsbAssignmentDropZone
                label="Optional - Backup MyVault USB"
                location={selectedBackup}
                dragActive={dragOverRole === 'backup'}
                busy={busy}
                onAssign={(location) => {
                  setStorageBackend('usb');
                  tryAssignBackup(location);
                }}
                onClear={handleClearBackup}
                onFormat={() => void handleFormatUsb('backup')}
              />
            </Box>
          ) : null}
        </Stack>
      ) : null}
      {!usbOnly ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'center',
            gap: 2,
            width: '100%',
            mt: 0.5
          }}
        >
          <GreenButton
            type="button"
            singleLineLabel
            sx={unlockIconRowButtonSx}
            onClick={() => {
              void openUsbVault('open');
            }}
            disabled={!canOpenUsb}
            {...guestDemoAllowProps()}
          >
            Open TutaPhotoAlbums USB
          </GreenButton>
        </Box>
      ) : (
        usbPostLoginActions
      )}
    </Stack>
  ) : null;

  const usbOnlyHints = showMoreUsbChoices ? (
    <Stack spacing={1.5} sx={{ mt: embedded ? 1 : 0 }}>
      {localUsbVisible && storageBackend === 'usb' && !selectedPrimary ? (
        <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700 }}>
          Choose a USB drive below for primary.
        </ColorTemplate7PopupLargeDark.SectionDescription>
      ) : null}

      {localUsbVisible && storageBackend === 'usb' && selectedPrimary && !legacyPinVault ? (
        <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700 }}>
          {selectedPrimary?.hasVault && !selectedPrimary?.partial
            ? 'Primary USB assigned. Use Open TutaPhotoAlbums USB to continue.'
            : 'No valid TutaPhotoAlbums vault on this drive. Use Format TutaPhotoAlbums USB to create one.'}
        </ColorTemplate7PopupLargeDark.SectionDescription>
      ) : null}

      {legacyPinVault ? (
        <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700 }}>
          This folder has an older 6-digit PIN vault. Create a new vault in a different folder to use
          Encrypt Password vault protection.
        </ColorTemplate7PopupLargeDark.SectionDescription>
      ) : null}
    </Stack>
  ) : null;

  if (embedded) {
    if (!open) return null;
    return (
      <Box sx={{ width: '100%' }}>
        <BusyHourglassOverlay
          open={Boolean(open) && busy}
          label="Opening…"
          fontSize={BUSY_HOURGLASS_MODAL_SIZE}
        />
        {loginErrorPopup}
        <PhotoAlbumsViewVaultDialog
          open={open && viewVaultOpen}
          onClose={() => setViewVaultOpen(false)}
          storageType="usb"
          folderName={selectedPrimary?.label || ''}
        />
        <PhotoAlbumsUsbBackupDialog
          open={open && backupDialogOpen}
          onClose={() => setBackupDialogOpen(false)}
          folderLabel={selectedPrimary?.label || 'USB'}
          onOpenMyPhotoAlbums={() => {
            setBackupDialogOpen(false);
            void openUsbVault('open');
          }}
        />
        {usbOnly ? (
          <Box
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', md: TUTAPHOTOALBUMS_HALF_PANEL_WIDTH },
              mx: 'auto',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            <Box
              sx={{
                ...tutaPhotoAlbumsHalfPanelSx,
                width: '100%',
                maxWidth: '100%',
                bgcolor: 'var(--theme-secondary-color)',
                borderRadius: 1,
                border: '2px solid var(--theme-yellow-color)',
                p: 1.5,
                color: '#fff',
                alignSelf: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              {usbStorageColumn}
              {usbOnlyHints}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              alignItems: 'flex-start'
            }}
          >
            {combinedStorageChoice ? (
              <>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <PhotoAlbumsOneDriveGate
                    embedded
                    open={open}
                    onUnlocked={() => onUnlocked?.('onedrive')}
                  />
                </Box>
                {usbStorageColumn}
              </>
            ) : (
              <>
                {usbStorageColumn}
                {oneDriveVisible && !localUsbVisible ? (
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <PhotoAlbumsOneDriveGate
                      embedded
                      open={open}
                      onUnlocked={() => onUnlocked?.('onedrive')}
                    />
                  </Box>
                ) : null}
              </>
            )}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <>
      <BusyHourglassOverlay
        open={Boolean(open) && busy}
        label="Opening…"
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={handleCloseGate}
        closeOnBackdrop={false}
        showCloseButton
        maxWidth="1280px"
        closeButtonSx={photoAlbumsPopupCloseSx}
      >
        <ColorTemplate7PopupLargeDark.Title>USB Record Vault</ColorTemplate7PopupLargeDark.Title>
        {!combinedStorageChoice ? usbBridgeStatus : null}
        <ColorTemplate7PopupLargeDark.Body bodyTextAlignLeft spacing={2}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              alignItems: 'flex-start'
            }}
          >
            {combinedStorageChoice ? (
              <>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <PhotoAlbumsOneDriveGate
                    embedded
                    open={open}
                    onUnlocked={() => onUnlocked?.('onedrive')}
                  />
                </Box>
                {usbStorageColumn}
              </>
            ) : (
              <>
                {usbStorageColumn}
                {oneDriveVisible && !localUsbVisible ? (
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <PhotoAlbumsOneDriveGate
                      embedded
                      open={open}
                      onUnlocked={() => onUnlocked?.('onedrive')}
                    />
                  </Box>
                ) : null}
              </>
            )}
          </Box>

          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {localUsbVisible || oneDriveVisible ? (
              <Stack
                spacing={1.5}
                sx={{
                  px: 1.25,
                  py: 1.25,
                  borderRadius: 1,
                  border: '2px solid var(--theme-yellow-color)',
                  bgcolor: 'var(--theme-secondary-color)'
                }}
              >
                <ColorTemplate7PopupLargeDark.SectionTitle leadLine>
                  The MyPhotoAlbums Privacy Commitment: 🔐
                </ColorTemplate7PopupLargeDark.SectionTitle>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  <Box component="li" sx={{ mb: 1 }}>
                    <ColorTemplate7PopupLargeDark.BodyText>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        Zero Server Storage:
                      </Box>{' '}
                      Your entire Records Vault (text, images, and data) lives exclusively in your{' '}
                      {privacyStorageLabel}. We store nothing on our servers.
                    </ColorTemplate7PopupLargeDark.BodyText>
                  </Box>
                  <Box component="li">
                    <ColorTemplate7PopupLargeDark.BodyText>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        Encrypted at Rest:
                      </Box>{' '}
                      All data in your vault is fully encrypted before it reaches {privacyStorageLabel}. Even if your
                      storage is lost or stolen, your information remains permanently locked and impenetrable.
                    </ColorTemplate7PopupLargeDark.BodyText>
                  </Box>
                </Box>
              </Stack>
            ) : null}
            {localUsbVisible && storageBackend === 'usb' && !selectedPrimary ? (
              <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700 }}>
                Drag or click a USB above for primary
                {oneDriveVisible ? ', or use OneDrive on the left.' : '.'}
              </ColorTemplate7PopupLargeDark.SectionDescription>
            ) : null}

            {localUsbVisible && storageBackend === 'usb' && selectedPrimary && !legacyPinVault ? (
              <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700 }}>
                {selectedPrimary?.hasVault && !selectedPrimary?.partial
                  ? 'Primary USB assigned. Use Open TutaPhotoAlbums USB to continue.'
                  : 'No valid TutaPhotoAlbums vault on this drive. Use Format TutaPhotoAlbums USB to create one.'}
              </ColorTemplate7PopupLargeDark.SectionDescription>
            ) : null}

            {legacyPinVault ? (
              <ColorTemplate7PopupLargeDark.SectionDescription sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700 }}>
                This folder has an older 6-digit PIN vault. Create a new vault in a different folder to use
                Encrypt Password vault protection.
              </ColorTemplate7PopupLargeDark.SectionDescription>
            ) : null}

            {backupUsbEnabled ? (
            <ColorTemplate7PopupLargeDark.SectionDescription sx={assignmentPanelFontSx}>
              * Optional Backup: Insert a second USB drive to automatically clone your data. We recommend storing
              this backup drive in a secure location in case your primary USB is lost or damaged. Your data will sync
              automatically whenever both drives are connected and selected here.
            </ColorTemplate7PopupLargeDark.SectionDescription>
            ) : null}
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
      {loginErrorPopup}
    </>
  );
}
