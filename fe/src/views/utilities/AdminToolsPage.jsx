import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import { forceAuthLoginRedirect, isAuthFailureMessage } from 'utils/forceAuthLoginRedirect';
import { themedConfirm } from 'utils/themedDialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ColorTemplate14LandingFrame from 'ui-component/ColorTemplate14LandingFrame';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import {
  adminPhotoStorageFileUrl,
  fetchAdminPhotoStorageDuplicates,
  fetchAdminPhotoStorageFiles,
  removeAdminPhotoStorageDuplicates
} from 'api/adminToolsFe';
import AdminToolsTestTab from './AdminToolsTestTab';
import AdminToolsStatisticTab from './AdminToolsStatisticTab';
import AdminToolsPasswordCheckTab from './AdminToolsPasswordCheckTab';
import AdminToolsLookupTab from './AdminToolsLookupTab';
import AdminToolsAsnTab from './AdminToolsAsnTab';
import AdminToolsTablesTab from './AdminToolsTablesTab';
import AdminToolsWipeByIdTab from './AdminToolsWipeByIdTab';
import AdminToolsLoginLogTab from './AdminToolsLoginLogTab';

const ADMIN_TOOLS_TABS = [
  { value: 'lookup', label: 'LookupByID' },
  { value: 'login-log', label: 'Login Log' },
  { value: 'password-check', label: 'Password Check' },
  { value: 'statistic', label: 'Statistic' },
  { value: 'test', label: 'Test' },
  { value: 'backup', label: 'Backup' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'asn', label: 'ASN' },
  { value: 'tables', label: 'TableDel' },
  { value: 'wipe-by-id', label: 'DeleteById' }
];

function resolveAdminToolsTab(tabParam) {
  const tab = String(tabParam ?? '').trim().toLowerCase();
  return ADMIN_TOOLS_TABS.some((t) => t.value === tab) ? tab : null;
}

const THUMB_COL_PX = 56;

function listRowGridSx(showChecksum) {
  const desktopCols = showChecksum
    ? `${THUMB_COL_PX}px 2fr 1.4fr 0.8fr 1.6fr 1fr`
    : `${THUMB_COL_PX}px 2fr 1.4fr 0.8fr 1fr`;
  return {
    xs: `${THUMB_COL_PX}px 1fr`,
    sm: desktopCols
  };
}

function FileListHeader({ showChecksum = false, onRemoveDup, removeDupBusy = false }) {
  const gridTemplateColumns = listRowGridSx(showChecksum);
  return (
    <ColorTemplate9TableData.HeaderRow gridTemplateColumns={gridTemplateColumns}>
      <ColorTemplate9TableData.HeaderCell aria-hidden />
      <ColorTemplate9TableData.HeaderCell>
        {onRemoveDup ? (
          <ColorTemplate9TableData.Button
            type="button"
            disabled={removeDupBusy}
            onClick={onRemoveDup}
            sx={{ borderRadius: 999, px: 2, py: 0.5, minHeight: 32 }}
          >
            {removeDupBusy ? 'Removing…' : 'Remove Dup'}
          </ColorTemplate9TableData.Button>
        ) : (
          'File Name'
        )}
      </ColorTemplate9TableData.HeaderCell>
      <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
        Date Modified
      </ColorTemplate9TableData.HeaderCell>
      <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>Size</ColorTemplate9TableData.HeaderCell>
      {showChecksum ? (
        <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
          Checksum
        </ColorTemplate9TableData.HeaderCell>
      ) : null}
      <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>Kind</ColorTemplate9TableData.HeaderCell>
    </ColorTemplate9TableData.HeaderRow>
  );
}

function FileThumbnail({ fileName }) {
  const src = adminPhotoStorageFileUrl(fileName);
  if (!src) {
    return <Box sx={{ width: THUMB_COL_PX, height: THUMB_COL_PX, flexShrink: 0 }} />;
  }
  return (
    <Box
      component="img"
      src={src}
      alt=""
      loading="lazy"
      sx={{
        width: THUMB_COL_PX,
        height: THUMB_COL_PX,
        flexShrink: 0,
        objectFit: 'cover',
        display: 'block',
        border: '1px solid var(--theme-primary-color)',
        bgcolor: 'transparent'
      }}
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

function FileListRow({ file, rowIndex, showChecksum = false }) {
  const gridTemplateColumns = listRowGridSx(showChecksum);
  const checksum = String(file?.checksum ?? '').trim();

  return (
    <ColorTemplate9TableData.BodyRow rowIndex={rowIndex} gridTemplateColumns={gridTemplateColumns}>
      <ColorTemplate9TableData.BodyCell>
        <FileThumbnail fileName={file.fileName} />
      </ColorTemplate9TableData.BodyCell>
      <ColorTemplate9TableData.BodyCell
        sx={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
      >
        <ColorTemplate9TableData.BodyText sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
          {file.fileName}
        </ColorTemplate9TableData.BodyText>
        <ColorTemplate9TableData.BodyText sx={{ display: { xs: 'block', sm: 'none' }, opacity: 0.85 }}>
          {file.modifiedLabel} · {file.sizeLabel}
          {showChecksum && checksum ? ` · ${checksum}` : ''} · {file.fileType}
        </ColorTemplate9TableData.BodyText>
      </ColorTemplate9TableData.BodyCell>
      <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
        <ColorTemplate9TableData.BodyText>{file.modifiedLabel}</ColorTemplate9TableData.BodyText>
      </ColorTemplate9TableData.BodyCell>
      <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
        <ColorTemplate9TableData.BodyText>{file.sizeLabel}</ColorTemplate9TableData.BodyText>
      </ColorTemplate9TableData.BodyCell>
      {showChecksum ? (
        <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
          <ColorTemplate9TableData.BodyText
            component="code"
            title={checksum || undefined}
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.72em',
              wordBreak: 'break-all',
              lineHeight: 1.3
            }}
          >
            {checksum || '—'}
          </ColorTemplate9TableData.BodyText>
        </ColorTemplate9TableData.BodyCell>
      ) : null}
      <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
        <ColorTemplate9TableData.BodyText>{file.fileType}</ColorTemplate9TableData.BodyText>
      </ColorTemplate9TableData.BodyCell>
    </ColorTemplate9TableData.BodyRow>
  );
}

function FileListPanel({ files, emptyMessage, showChecksum = false, onRemoveDup, removeDupBusy = false }) {
  if (!files.length) {
    return <ColorTemplate9TableData.EmptyText>{emptyMessage}</ColorTemplate9TableData.EmptyText>;
  }
  return (
    <ColorTemplate9TableData.Table minTableWidth={showChecksum ? 920 : 720}>
      <FileListHeader showChecksum={showChecksum} onRemoveDup={onRemoveDup} removeDupBusy={removeDupBusy} />
      {files.map((file, index) => (
        <FileListRow key={`${file.fileName}-${index}`} file={file} rowIndex={index} showChecksum={showChecksum} />
      ))}
    </ColorTemplate9TableData.Table>
  );
}

export default function AdminToolsPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    () => resolveAdminToolsTab(searchParams.get('tab')) ?? 'statistic'
  );
  const [folder, setFolder] = useState('');
  const [backupFiles, setBackupFiles] = useState([]);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [removingChecksum, setRemovingChecksum] = useState('');

  const handleToolsError = useCallback((messageOrErr) => {
    if (typeof messageOrErr === 'string' && isAuthFailureMessage(messageOrErr)) {
      void forceAuthLoginRedirect();
      return;
    }
    if (messageOrErr && typeof messageOrErr === 'object' && messageOrErr.response) {
      const serverError = String(messageOrErr.response?.data?.error ?? '').trim();
      if (
        (messageOrErr.response.status === 401 && serverError === 'Authentication required') ||
        (messageOrErr.response.status === 403 && serverError === 'Admin access required')
      ) {
        void forceAuthLoginRedirect({ message: serverError });
        return;
      }
    }
    const message =
      typeof messageOrErr === 'string'
        ? messageOrErr
        : messageOrErr?.response?.data?.error || messageOrErr?.message || 'Request failed';
    setError(message);
  }, []);

  const loadBackup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminPhotoStorageFiles();
      setFolder(String(data?.folder ?? ''));
      setBackupFiles(Array.isArray(data?.files) ? data.files : []);
    } catch (err) {
      handleToolsError(err);
      setBackupFiles([]);
    } finally {
      setLoading(false);
    }
  }, [handleToolsError]);

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminPhotoStorageDuplicates();
      setFolder(String(data?.folder ?? ''));
      setDuplicateGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (err) {
      handleToolsError(err);
      setDuplicateGroups([]);
    } finally {
      setLoading(false);
    }
  }, [handleToolsError]);

  const handleRemoveDup = useCallback(
    async (group) => {
      const checksum = String(group?.checksum ?? '').trim();
      if (!checksum || !Array.isArray(group?.files) || group.files.length < 2) return;
      const summary = `${group.sizeLabel ?? ''} — ${group.files.length} copies`;
      if (
        !(await themedConfirm(
          `Remove duplicates for this group (${summary})?\n\nKeeps the lowest photos_id (and its file), repoints profile photos and story posts to it, then deletes the other copies.`
        ))
      ) {
        return;
      }
      setRemovingChecksum(checksum);
      setError('');
      try {
        const data = await removeAdminPhotoStorageDuplicates(checksum);
        setFolder(String(data?.folder ?? folder));
        setDuplicateGroups(Array.isArray(data?.groups) ? data.groups : []);
      } catch (err) {
        handleToolsError(err);
      } finally {
        setRemovingChecksum('');
      }
    },
    [folder, handleToolsError]
  );

  const visibleTabs = useMemo(() => ADMIN_TOOLS_TABS, []);

  useEffect(() => {
    const fromUrl = resolveAdminToolsTab(searchParams.get('tab'));
    setActiveTab(fromUrl ?? 'lookup');
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'backup') {
      void loadBackup();
    } else if (activeTab === 'duplicate') {
      void loadDuplicates();
    }
  }, [activeTab, loadBackup, loadDuplicates]);

  const duplicateFiles = duplicateGroups.flatMap((group) => group.files ?? []);

  const adminSession = isAdminSession(user);
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!adminSession) {
    return <Navigate to="/pages/login" replace />;
  }

  return (
    <ColorTemplate14LandingFrame sx={{ gap: 1.5 }}>
      <ColorTemplate9TableData.Title component="h1">Tools</ColorTemplate9TableData.Title>
      <ColorTemplate9TableData.Panel fullWidth>
        <ColorTemplate9TableData.TabBar
          sx={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 0.75,
            '& .MuiButton-root': {
              fontSize: '50%',
              minHeight: 28,
              px: 1.5,
              py: 0.5
            }
          }}
        >
          {visibleTabs.map((tab) => (
            <ColorTemplate9TableData.TabButton
              key={tab.value}
              selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </ColorTemplate9TableData.TabButton>
          ))}
        </ColorTemplate9TableData.TabBar>
        <ColorTemplate9TableData.PanelDivider />
        <ColorTemplate9TableData.Content>
          {activeTab !== 'test' && folder ? (
            <ColorTemplate9TableData.BodyText sx={{ mb: 1, wordBreak: 'break-all' }}>
              Folder: {folder}
            </ColorTemplate9TableData.BodyText>
          ) : null}
          {error ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          ) : null}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : null}
          {!loading && activeTab === 'backup' ? (
            <FileListPanel
              files={backupFiles}
              emptyMessage="No image files found in TUTADATES_PHOTO_FOLDER."
              showChecksum={false}
            />
          ) : null}
          {!loading && activeTab === 'test' ? (
            <AdminToolsTestTab onError={handleToolsError} />
          ) : null}
          {!loading && activeTab === 'statistic' ? (
            <AdminToolsStatisticTab onError={handleToolsError} />
          ) : null}
          {!loading && activeTab === 'password-check' ? (
            <AdminToolsPasswordCheckTab onError={handleToolsError} />
          ) : null}
          {!loading && activeTab === 'lookup' ? <AdminToolsLookupTab onError={handleToolsError} /> : null}
          {!loading && activeTab === 'login-log' ? <AdminToolsLoginLogTab onError={handleToolsError} /> : null}
          {!loading && activeTab === 'asn' ? <AdminToolsAsnTab onError={handleToolsError} /> : null}
          {!loading && activeTab === 'tables' ? <AdminToolsTablesTab onError={handleToolsError} /> : null}
          {!loading && activeTab === 'wipe-by-id' ? <AdminToolsWipeByIdTab onError={handleToolsError} /> : null}
          {!loading && activeTab === 'duplicate' ? (
            duplicateGroups.length === 0 ? (
              <ColorTemplate9TableData.EmptyText>
                No duplicate image files found (same byte size and SHA-256 checksum).
              </ColorTemplate9TableData.EmptyText>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <ColorTemplate9TableData.BodyText>
                  {duplicateGroups.length} duplicate group(s), {duplicateFiles.length} file(s) total.
                </ColorTemplate9TableData.BodyText>
                {duplicateGroups.map((group) => (
                  <ColorTemplate9TableData.Panel key={group.checksum}>
                    <ColorTemplate9TableData.GroupTitle>
                      Same file ({group.sizeLabel}) — {group.files.length} copies
                    </ColorTemplate9TableData.GroupTitle>
                    <FileListPanel
                      files={group.files}
                      emptyMessage=""
                      showChecksum
                      onRemoveDup={() => void handleRemoveDup(group)}
                      removeDupBusy={removingChecksum === group.checksum}
                    />
                  </ColorTemplate9TableData.Panel>
                ))}
              </Box>
            )
          ) : null}
        </ColorTemplate9TableData.Content>
      </ColorTemplate9TableData.Panel>
    </ColorTemplate14LandingFrame>
  );
}
