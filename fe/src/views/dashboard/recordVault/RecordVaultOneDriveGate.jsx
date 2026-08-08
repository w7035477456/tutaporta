import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';
import RecordVaultOneDriveLoginModal from './RecordVaultOneDriveLoginModal';
import RecordVaultOneDriveInvalidDialog from './RecordVaultOneDriveInvalidDialog';
import RecordVaultOneDriveBackupDialog from './RecordVaultOneDriveBackupDialog';
import RecordVaultViewVaultDialog from './RecordVaultViewVaultDialog';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import {
  fetchRecordVaultStorageConfig,
  fetchRecordVaultOneDriveConfig,
  fetchRecordVaultOneDriveEmails,
  rememberRecordVaultOneDriveEmail,
  fetchRecordVaultOneDriveStatus,
  disconnectRecordVaultOneDrive,
  formatRecordVaultOneDrive,
  initRecordVaultOneDrive,
  restoreRecordVaultOneDriveBackupZip,
  unlockRecordVaultOneDrive
} from 'api/recordVaultFe';
import {
  openRecordVaultOneDriveOAuthPopup,
  RECORD_VAULT_ONEDRIVE_OAUTH_RESULT_KEY
} from 'utils/recordVaultOneDriveOAuth';
import { rvCloudError, rvCloudLog, rvCloudWarn } from 'utils/recordVaultCloudDebugLog';
import { themedConfirm } from 'utils/themedDialog';
import {
  TUTANOTES_HALF_PANEL_WIDTH,
  tutaNotesHalfPanelSx
} from './tutaNotesBranding';

function isOneDriveOAuthPopupClosedError(err) {
  const message = String(err?.message || err?.response?.data?.error || '');
  return /closed before completion/i.test(message);
}

function oneDriveErrorNeedsFormat(errorText) {
  return /vault\.meta\.json|older format|unreadable|reformat|not be found|itemnotfound|resource could not be found|vault\.db/i.test(
    String(errorText || '')
  );
}

function isOneDriveVaultFilesystemInvalid(onedrive) {
  return Boolean(onedrive?.vaultFilesystemInvalid || onedrive?.needsReformat);
}

function oneDriveEmailsMatch(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function isOneDrivePostLoginSessionActive(loggedInEmail, connectedEmail) {
  return Boolean(loggedInEmail) && oneDriveEmailsMatch(loggedInEmail, connectedEmail);
}

export default function RecordVaultOneDriveGate({
  open,
  embedded = false,
  onUnlocked,
  onLoginModalOpenChange,
  onOpenClicked,
  proceedOpenToken = 0,
  /** Bumped when Access Gate formats OneDrive after 5 wrong vault passwords. */
  accessFormatRefreshToken = 0
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [oneDriveEnabled, setOneDriveEnabled] = useState(false);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [oneDriveEmail, setOneDriveEmail] = useState('');
  const [oneDriveHasVault, setOneDriveHasVault] = useState(false);
  const [oneDriveNeedsReformat, setOneDriveNeedsReformat] = useState(false);
  const [invalidDialogOpen, setInvalidDialogOpen] = useState(false);
  const [invalidDialogError, setInvalidDialogError] = useState('');
  const [viewVaultOpen, setViewVaultOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [oneDriveFolderName, setOneDriveFolderName] = useState('onlinemallwebsitevault');
  const [oneDriveBusy, setOneDriveBusy] = useState(false);
  const [oneDriveBusyLabel, setOneDriveBusyLabel] = useState('Connecting to OneDrive');
  /** Honest 0–100% while Opening downloads/unlocks Cloud vault (null = hide %). */
  const [oneDriveBusyProgressPercent, setOneDriveBusyProgressPercent] = useState(null);
  const [oneDriveLoginModalOpen, setOneDriveLoginModalOpen] = useState(false);
  const [oneDriveLoginError, setOneDriveLoginError] = useState('');
  const [oneDriveLoginErrorSecondary, setOneDriveLoginErrorSecondary] = useState('');
  const [oneDriveLoginSuccess, setOneDriveLoginSuccess] = useState('');
  const [oneDriveLoggedInEmail, setOneDriveLoggedInEmail] = useState('');
  const [oneDriveStatusLoaded, setOneDriveStatusLoaded] = useState(false);
  const [savedEmailsLoaded, setSavedEmailsLoaded] = useState(false);
  const [savedEmails, setSavedEmails] = useState([]);
  const [videoTutorialUrl, setVideoTutorialUrl] = useState('');
  const [, setUnlockGuard] = useState(null);
  const oneDriveGateHandledRef = useRef(false);

  const refreshOneDriveStatus = useCallback(async () => {
    try {
      const config = await fetchRecordVaultOneDriveConfig();
      setOneDriveEnabled(Boolean(config.enabled));
      if (config.folderName) setOneDriveFolderName(String(config.folderName));
      if (!config.enabled) {
        setOneDriveConnected(false);
        setOneDriveEmail('');
        setOneDriveHasVault(false);
        setOneDriveNeedsReformat(false);
        return;
      }
      const status = await fetchRecordVaultOneDriveStatus();
      const connected = Boolean(status.onedrive?.connected);
      setOneDriveConnected(connected);
      setOneDriveEmail(status.onedrive?.email || '');
      setOneDriveHasVault(Boolean(status.onedrive?.hasVault));
      setOneDriveNeedsReformat(isOneDriveVaultFilesystemInvalid(status.onedrive));
    } catch {
      setOneDriveConnected(false);
    }
  }, []);

  const openInvalidVaultDialog = useCallback(() => {
    setInvalidDialogError('');
    setOneDriveLoginModalOpen(false);
    setInvalidDialogOpen(true);
  }, []);

  const showInvalidVaultDialogIfNeeded = useCallback(
    async (status = null) => {
      const nextStatus = status || (await fetchRecordVaultOneDriveStatus());
      setOneDriveHasVault(Boolean(nextStatus.onedrive?.hasVault));
      setOneDriveNeedsReformat(isOneDriveVaultFilesystemInvalid(nextStatus.onedrive));
      const invalid = isOneDriveVaultFilesystemInvalid(nextStatus.onedrive);
      if (invalid) {
        openInvalidVaultDialog();
        return true;
      }
      return false;
    },
    [openInvalidVaultDialog]
  );

  const reportOpenProgress = useCallback(async ({ percent, label } = {}) => {
    const next = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    // Never jump backward while open is running (stale poll can still return 0).
    setOneDriveBusyProgressPercent((prev) => (next >= 100 ? 100 : Math.max(Number(prev) || 0, next)));
    if (label != null && String(label).trim()) {
      setOneDriveBusyLabel(String(label).trim());
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }, []);

  const openOneDriveVaultAfterConnect = useCallback(
    async () => {
      setOneDriveBusyProgressPercent(0);
      await reportOpenProgress({ percent: 0, label: 'Opening TutaNotes Cloud' });
      const status = await fetchRecordVaultOneDriveStatus();
      await reportOpenProgress({ percent: 8, label: 'Checking vault status' });
      const hasVault = Boolean(status.onedrive?.hasVault);
      setOneDriveHasVault(hasVault);
      setOneDriveNeedsReformat(isOneDriveVaultFilesystemInvalid(status.onedrive));
      if (!hasVault) {
        await initRecordVaultOneDrive();
        setOneDriveHasVault(true);
        setOneDriveNeedsReformat(false);
        await reportOpenProgress({ percent: 100, label: 'Done' });
        onUnlocked?.();
        return;
      }
      await unlockRecordVaultOneDrive({
        onProgress: (progress) => {
          void reportOpenProgress(progress);
        }
      });
      setOneDriveNeedsReformat(false);
      await reportOpenProgress({ percent: 100, label: 'Done' });
      onUnlocked?.();
    },
    [onUnlocked, reportOpenProgress]
  );

  useEffect(() => {
    if (!open) {
      setOneDriveLoginModalOpen(false);
      setOneDriveLoginError('');
      setOneDriveLoginErrorSecondary('');
      setOneDriveLoginSuccess('');
      setOneDriveLoggedInEmail('');
      setOneDriveStatusLoaded(false);
      setSavedEmailsLoaded(false);
      setSavedEmails([]);
      setUnlockGuard(null);
      setInvalidDialogOpen(false);
      setInvalidDialogError('');
      setViewVaultOpen(false);
      setBackupDialogOpen(false);
      oneDriveGateHandledRef.current = false;
      return undefined;
    }
    try {
      localStorage.removeItem(RECORD_VAULT_ONEDRIVE_OAUTH_RESULT_KEY);
    } catch {
      // ignore
    }
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchRecordVaultStorageConfig();
        if (!cancelled) {
          setVideoTutorialUrl(String(cfg?.videoTutorialTutanotes || '').trim());
        }
      } catch {
        // storage config optional
      }
    })();
    const loadSavedEmails = async () => {
      try {
        const emails = await fetchRecordVaultOneDriveEmails();
        if (!cancelled) {
          setSavedEmails(emails);
          setSavedEmailsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setSavedEmails([]);
          setSavedEmailsLoaded(true);
        }
      }
    };

    void (async () => {
      // Status + remembered emails are independent — load in parallel so the email
      // list is not blocked behind OneDrive status (often the slow hop).
      await Promise.all([refreshOneDriveStatus(), loadSavedEmails()]);
      if (!cancelled) setOneDriveStatusLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, refreshOneDriveStatus]);

  useEffect(() => {
    // Open Cloud login as soon as status is ready; emails may still be loading
    // (modal shows a spinner under “Choose a remembered One Drive account email”).
    if (!open || !oneDriveEnabled || !oneDriveStatusLoaded) return;
    if (oneDriveGateHandledRef.current && !embedded) return;
    setOneDriveLoginModalOpen(true);
  }, [open, oneDriveEnabled, oneDriveStatusLoaded, embedded]);

  useLayoutEffect(() => {
    if (embedded) return;
    onLoginModalOpenChange?.(
      Boolean(
        open &&
          (oneDriveLoginModalOpen ||
            invalidDialogOpen ||
            viewVaultOpen ||
            backupDialogOpen)
      )
    );
  }, [
    open,
    oneDriveLoginModalOpen,
    invalidDialogOpen,
    viewVaultOpen,
    backupDialogOpen,
    onLoginModalOpenChange
  ]);

  const loginPanelOpen = embedded ? open : open && oneDriveLoginModalOpen;

  const handleClose = () => {
    if (oneDriveBusy) return;
    setOneDriveLoginModalOpen(false);
    setInvalidDialogOpen(false);
    setInvalidDialogError('');
    setViewVaultOpen(false);
    setBackupDialogOpen(false);
    setOneDriveLoginError('');
    setOneDriveLoginErrorSecondary('');
    setOneDriveLoginSuccess('');
    setOneDriveLoggedInEmail('');
    if (!embedded) {
      navigate('/mall');
    }
  };

  const handleOneDriveLoginAndUse = async (loginEmail) => {
    const email = String(loginEmail || '').trim();
    const normalizedLogin = email.toLowerCase();
    const normalizedConnected = String(oneDriveEmail || '').trim().toLowerCase();
    if (!email || oneDriveBusy || !oneDriveEnabled) {
      rvCloudWarn('OneDrive', 'FE login-and-use ignored', {
        email: email || null,
        oneDriveBusy,
        oneDriveEnabled
      });
      return;
    }
    rvCloudLog('OneDrive', 'FE login-and-use start', { email, oneDriveConnected, normalizedConnected });
    setOneDriveBusyLabel('Connecting to OneDrive');
    setOneDriveBusyProgressPercent(null);
    setOneDriveBusy(true);
    setOneDriveLoginError('');
    setOneDriveLoginErrorSecondary('');
    setOneDriveLoginSuccess('');
    setOneDriveLoggedInEmail('');
    try {
      oneDriveGateHandledRef.current = true;

      if (oneDriveConnected && normalizedLogin === normalizedConnected) {
        rvCloudLog('OneDrive', 'FE login-and-use same account — skip oauth', { email: normalizedLogin });
        const status = await fetchRecordVaultOneDriveStatus();
        if (await showInvalidVaultDialogIfNeeded(status)) return;
        oneDriveGateHandledRef.current = true;
        setOneDriveLoggedInEmail(normalizedLogin);
        setOneDriveLoginSuccess('OneDrive connected. Choose an action below.');
        try {
          const remembered = await rememberRecordVaultOneDriveEmail(email);
          if (Array.isArray(remembered?.emails)) setSavedEmails(remembered.emails);
        } catch {
          // non-fatal — login succeeded
        }
        return;
      }

      if (oneDriveConnected && normalizedLogin !== normalizedConnected) {
        rvCloudLog('OneDrive', 'FE login-and-use switching account', {
          from: normalizedConnected,
          to: normalizedLogin
        });
        setOneDriveLoggedInEmail('');
        await disconnectRecordVaultOneDrive();
        setOneDriveConnected(false);
        setOneDriveEmail('');
        setOneDriveHasVault(false);
        setOneDriveNeedsReformat(false);
      }

      const oauthEmail = await openRecordVaultOneDriveOAuthPopup(email);
      rvCloudLog('OneDrive', 'FE login-and-use oauth resolved', { email: oauthEmail });
      setOneDriveEmail(oauthEmail);
      setOneDriveConnected(true);
      await refreshOneDriveStatus();
      const status = await fetchRecordVaultOneDriveStatus();
      if (await showInvalidVaultDialogIfNeeded(status)) return;
      oneDriveGateHandledRef.current = true;
      const resolvedEmail = String(oauthEmail || email).trim();
      setOneDriveLoggedInEmail(resolvedEmail.toLowerCase());
      setOneDriveLoginSuccess('OneDrive connected. Choose an action below.');
      try {
        const remembered = await rememberRecordVaultOneDriveEmail(resolvedEmail || email);
        if (Array.isArray(remembered?.emails)) setSavedEmails(remembered.emails);
      } catch {
        // non-fatal — login succeeded
      }
      rvCloudLog('OneDrive', 'FE login-and-use complete', { email: oauthEmail });
    } catch (err) {
      oneDriveGateHandledRef.current = false;
      setOneDriveLoggedInEmail('');
      if (isOneDriveOAuthPopupClosedError(err)) {
        return;
      }
      rvCloudError('OneDrive', 'FE login-and-use failed', err, {
        errorSecondary: err?.errorSecondary || null
      });
      const data = err?.response?.data || {};
      const message = data.error || err?.message || 'Unable to connect OneDrive';
      if (data.vaultWiped) {
        setOneDriveHasVault(false);
        setOneDriveNeedsReformat(false);
      }
      if (data.needsReformat || oneDriveErrorNeedsFormat(message)) {
        setOneDriveNeedsReformat(true);
        openInvalidVaultDialog();
        return;
      }
      setOneDriveLoginError(message);
      setOneDriveLoginErrorSecondary(String(err?.errorSecondary || data.errorSecondary || '').trim());
    } finally {
      setOneDriveBusy(false);
    }
  };

  const continueAfterValidVault = async () => {
    if (!embedded) setOneDriveLoginModalOpen(false);
    await openOneDriveVaultAfterConnect();
  };

  /** After Format: create/open blank vault like "Create New MyNote" — no Format Done popup. */
  const runCreateNewMyNoteAfterFormat = async () => {
    setOneDriveLoginSuccess('');
    setOneDriveLoginError('');
    setOneDriveLoginErrorSecondary('');
    setOneDriveBusyLabel('Creating MyNote');
    await openOneDriveVaultAfterConnect();
  };

  const handleInvalidFormat = async () => {
    if (oneDriveBusy || !oneDriveConnected) return;
    setOneDriveBusy(true);
    setInvalidDialogError('');
    try {
      await formatRecordVaultOneDrive();
      setOneDriveHasVault(false);
      setOneDriveNeedsReformat(false);
      setInvalidDialogOpen(false);
      await refreshOneDriveStatus();
      if (oneDriveEmail) setOneDriveLoggedInEmail(String(oneDriveEmail).trim().toLowerCase());
      await runCreateNewMyNoteAfterFormat();
    } catch (err) {
      const data = err?.response?.data || {};
      setInvalidDialogError(data.error || err?.message || 'Unable to format OneDrive vault');
      setOneDriveLoginModalOpen(true);
      oneDriveGateHandledRef.current = false;
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleInvalidRestore = async (file) => {
    if (oneDriveBusy || !file) return;
    setOneDriveBusy(true);
    setInvalidDialogError('');
    try {
      await restoreRecordVaultOneDriveBackupZip(file);
      await refreshOneDriveStatus();
      const status = await fetchRecordVaultOneDriveStatus();
      if (isOneDriveVaultFilesystemInvalid(status.onedrive)) {
        setInvalidDialogError('Restored backup still looks invalid. Try another zip or format and start blank.');
        return;
      }
      setOneDriveHasVault(Boolean(status.onedrive?.hasVault));
      setOneDriveNeedsReformat(false);
      setInvalidDialogOpen(false);
      await continueAfterValidVault();
    } catch (err) {
      const data = err?.response?.data || {};
      setInvalidDialogError(data.error || err?.message || 'Restore failed');
    } finally {
      setOneDriveBusy(false);
    }
  };

  const handleCloseInvalidDialog = () => {
    if (oneDriveBusy) return;
    setInvalidDialogOpen(false);
    setInvalidDialogError('');
    setOneDriveLoggedInEmail('');
    oneDriveGateHandledRef.current = false;
    setOneDriveLoginModalOpen(true);
  };

  const postLoginSessionActive = isOneDrivePostLoginSessionActive(oneDriveLoggedInEmail, oneDriveEmail);

  const openMyNoteAfterVaultAccess = async () => {
    if (!postLoginSessionActive || !oneDriveConnected || oneDriveBusy) return;
    setOneDriveBusyLabel('Opening…');
    setOneDriveBusyProgressPercent(0);
    setOneDriveBusy(true);
    try {
      // Already unlocked on this cluster — skip login hop and enter workspace.
      try {
        const status = await fetchRecordVaultOneDriveStatus();
        await reportOpenProgress({ percent: 10, label: 'Opening…' });
        if (status?.session?.unlocked) {
          await reportOpenProgress({ percent: 100, label: 'Done' });
          onUnlocked?.();
          return;
        }
      } catch {
        // Fall through to init/unlock.
      }
      await openOneDriveVaultAfterConnect();
    } catch (err) {
      setOneDriveLoginModalOpen(true);
      oneDriveGateHandledRef.current = false;
      setOneDriveLoginError(err?.message || 'Unable to open MyNote');
    } finally {
      setOneDriveBusy(false);
      setOneDriveBusyProgressPercent(null);
    }
  };

  const handleOpenMyNote = async () => {
    if (!postLoginSessionActive || !oneDriveConnected || oneDriveBusy) return;
    if (onOpenClicked?.() === true) return;
    await openMyNoteAfterVaultAccess();
  };

  const lastProceedOpenTokenRef = useRef(0);
  const openMyNoteAfterVaultAccessRef = useRef(openMyNoteAfterVaultAccess);
  openMyNoteAfterVaultAccessRef.current = openMyNoteAfterVaultAccess;
  useEffect(() => {
    if (!proceedOpenToken || proceedOpenToken === lastProceedOpenTokenRef.current) return;
    lastProceedOpenTokenRef.current = proceedOpenToken;
    void openMyNoteAfterVaultAccessRef.current();
  }, [proceedOpenToken]);

  const lastAccessFormatRefreshTokenRef = useRef(0);
  useEffect(() => {
    if (!accessFormatRefreshToken || accessFormatRefreshToken === lastAccessFormatRefreshTokenRef.current) {
      return;
    }
    lastAccessFormatRefreshTokenRef.current = accessFormatRefreshToken;
    setOneDriveHasVault(false);
    setUnlockGuard(null);
    setOneDriveLoginError('OneDrive vault was formatted after five incorrect Encrypt Password attempts.');
    void refreshOneDriveStatus();
  }, [accessFormatRefreshToken, refreshOneDriveStatus]);

  const handleViewOneDrive = () => {
    if (!postLoginSessionActive || !oneDriveConnected || oneDriveBusy) return;
    setViewVaultOpen(true);
  };

  const handleBackupRestore = () => {
    if (!postLoginSessionActive || !oneDriveConnected || oneDriveBusy) return;
    setBackupDialogOpen(true);
  };

  const handleFormatOneDriveVault = async () => {
    if (oneDriveBusy || !oneDriveConnected || !postLoginSessionActive) return;
    const ok = await themedConfirm(
      `Format ${oneDriveFolderName}?\n\nThis deletes the existing OneDrive MyNote folder and creates a fresh blank vault ready for your first note. Other OneDrive files are not touched.`
    );
    if (!ok) return;
    setOneDriveBusyLabel('Formatting MyNote Folder');
    setOneDriveBusy(true);
    setOneDriveLoginError('');
    setOneDriveLoginErrorSecondary('');
    setOneDriveLoginSuccess('');
    try {
      await formatRecordVaultOneDrive();
      setOneDriveHasVault(false);
      setOneDriveNeedsReformat(false);
      await refreshOneDriveStatus();
      // Skip Format Done dialog — auto "Create New MyNote".
      await runCreateNewMyNoteAfterFormat();
    } catch (err) {
      const data = err?.response?.data || {};
      setOneDriveLoginError(data.error || err?.message || 'Unable to format OneDrive vault');
      setOneDriveLoginModalOpen(true);
      oneDriveGateHandledRef.current = false;
    } finally {
      setOneDriveBusy(false);
    }
  };

  const loginPanelSx = {
    ...tutaNotesHalfPanelSx,
    bgcolor: 'var(--theme-secondary-color)',
    borderRadius: 1,
    border: '2px solid var(--theme-yellow-color)',
    p: 1.5,
    color: '#fff'
  };


  return (
    <>
      <BusyHourglassOverlay
        open={open && oneDriveBusy && !oneDriveLoginModalOpen}
        label={oneDriveBusyLabel}
        progressPercent={oneDriveBusyProgressPercent}
        progressLabel={oneDriveBusyLabel}
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <RecordVaultViewVaultDialog open={open && viewVaultOpen} onClose={() => setViewVaultOpen(false)} />
      <RecordVaultOneDriveBackupDialog
        open={open && backupDialogOpen}
        folderName={oneDriveFolderName}
        onClose={() => setBackupDialogOpen(false)}
        onOpenMyNote={() => {
          setBackupDialogOpen(false);
          void handleOpenMyNote();
        }}
        onFormatted={async () => {
          setOneDriveHasVault(false);
          setOneDriveNeedsReformat(false);
          await refreshOneDriveStatus();
        }}
        onRestored={async () => {
          setOneDriveHasVault(true);
          setOneDriveNeedsReformat(false);
          await refreshOneDriveStatus();
        }}
      />
      <RecordVaultOneDriveInvalidDialog
        open={open && invalidDialogOpen}
        busy={oneDriveBusy}
        error={invalidDialogError}
        onFormat={() => void handleInvalidFormat()}
        onRestoreFile={(file) => handleInvalidRestore(file)}
        onClose={handleCloseInvalidDialog}
      />
      {embedded ? (
        <Box
          sx={{
            width: '100%',
            maxWidth: { xs: '100%', md: TUTANOTES_HALF_PANEL_WIDTH },
            mx: 'auto',
            boxSizing: 'border-box',
            position: 'relative'
          }}
        >
          <Box sx={{ ...loginPanelSx, position: 'relative', width: '100%', maxWidth: '100%' }}>
            <RecordVaultOneDriveLoginModal
              embedded
              open={loginPanelOpen}
              defaultEmail={oneDriveEmail || user?.email || ''}
              savedEmails={savedEmails}
              emailsLoading={!savedEmailsLoaded}
              busy={oneDriveBusy}
              busyLabel={oneDriveBusyLabel}
              busyProgressPercent={oneDriveBusyProgressPercent}
              error={oneDriveLoginError}
              errorSecondary={oneDriveLoginErrorSecondary}
              success={oneDriveLoginSuccess}
              connectedEmail={oneDriveEmail}
              loggedInEmail={oneDriveLoggedInEmail}
              hasVault={oneDriveHasVault}
              needsReformat={oneDriveNeedsReformat}
              videoTutorialUrl={videoTutorialUrl}
              onOpenMyNote={() => void handleOpenMyNote()}
              onViewOneDrive={handleViewOneDrive}
              onBackupRestore={handleBackupRestore}
              onFormatMyNoteFolder={() => void handleFormatOneDriveVault()}
              onLogin={(email) => void handleOneDriveLoginAndUse(email)}
              onClose={handleClose}
            />
          </Box>
        </Box>
      ) : (
        <>
          <RecordVaultOneDriveLoginModal
            open={loginPanelOpen}
            defaultEmail={oneDriveEmail || user?.email || ''}
            savedEmails={savedEmails}
            emailsLoading={!savedEmailsLoaded}
            busy={oneDriveBusy}
            busyLabel={oneDriveBusyLabel}
            busyProgressPercent={oneDriveBusyProgressPercent}
            error={oneDriveLoginError}
            errorSecondary={oneDriveLoginErrorSecondary}
            success={oneDriveLoginSuccess}
            connectedEmail={oneDriveEmail}
            loggedInEmail={oneDriveLoggedInEmail}
            hasVault={oneDriveHasVault}
            needsReformat={oneDriveNeedsReformat}
            videoTutorialUrl={videoTutorialUrl}
            onOpenMyNote={() => void handleOpenMyNote()}
            onViewOneDrive={handleViewOneDrive}
            onBackupRestore={handleBackupRestore}
            onFormatMyNoteFolder={() => void handleFormatOneDriveVault()}
            onLogin={(email) => void handleOneDriveLoginAndUse(email)}
            onClose={handleClose}
          />
        </>
      )}
    </>
  );
}
