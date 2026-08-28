import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import {
  isPhotoAlbumsFilesExplorerHiddenEntry,
  isPhotoAlbumsStagingPhotoFile,
  isPhotoAlbumsStagingVideoFile
} from 'utils/photoAlbumsFileFormats';
import PhotoAlbumsTrayCountLabel from './PhotoAlbumsTrayCountLabel';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import {
  ensureDirectoryReadPermission,
  formatFilesExplorerBreadcrumb,
  readFilesExplorerMeta,
  readFilesExplorerRootHandle,
  resolveDirectoryFromRoot,
  writeFilesExplorerMeta,
  writeFilesExplorerRootHandle
} from 'utils/photoAlbumsFilesExplorerPreference';
import {
  clearActiveFilesExplorerDrag,
  materializePhotoStagingFile,
  setActiveFilesExplorerDrag,
  takeFilesExplorerDragFilesAsync
} from './photoAlbumsFilesExplorerDrag';

const panelShellSx = {
  flex: '1 1 0',
  minHeight: 0,
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  mt: 0,
  overflow: 'hidden'
};

const panelScrollSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'scroll',
  overflowX: 'auto',
  bgcolor: 'var(--theme-daynight-color)',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  border: '2px solid #000',
  borderRadius: 1,
  p: 1,
  boxSizing: 'border-box',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: '0.78rem',
  lineHeight: 1.35,
  scrollbarWidth: 'thin',
  scrollbarColor: '#000 rgba(0,0,0,0.15)',
  '&::-webkit-scrollbar': {
    width: 12
  },
  '&::-webkit-scrollbar-track': {
    bgcolor: 'rgba(0,0,0,0.12)'
  },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: '#000',
    borderRadius: 6
  },
  '& .MuiTypography-root': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important'
  }
};

const rowSx = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  whiteSpace: 'nowrap',
  minHeight: '1.45em',
  px: 0.25,
  borderRadius: 0.5,
  cursor: 'pointer',
  userSelect: 'none',
  bgcolor: selected ? 'rgba(10, 132, 255, 0.35)' : 'transparent',
  outline: selected ? '1px solid rgba(10, 132, 255, 0.7)' : 'none',
  '&:hover': {
    bgcolor: selected ? 'rgba(10, 132, 255, 0.45)' : 'rgba(0,0,0,0.08)'
  }
});

function entryKey(entry) {
  return `${entry.kind}:${entry.name}`;
}

function formatTotalSizeMb(bytes) {
  const mb = Math.max(0, Math.round((Number(bytes) || 0) / (1024 * 1024)));
  return `Total size=${mb}mb`;
}

function entryIcon(entry) {
  if (entry.kind === 'directory') {
    return <FolderOutlinedIcon sx={{ fontSize: '1rem', color: '#000', flexShrink: 0 }} />;
  }
  if (entry.file && isPhotoAlbumsStagingVideoFile(entry.file)) {
    return <VideocamOutlinedIcon sx={{ fontSize: '1rem', color: '#000', flexShrink: 0 }} />;
  }
  if (entry.file && isPhotoAlbumsStagingPhotoFile(entry.file)) {
    return <ImageOutlinedIcon sx={{ fontSize: '1rem', color: '#000', flexShrink: 0 }} />;
  }
  return <InsertDriveFileOutlinedIcon sx={{ fontSize: '1rem', color: '#000', flexShrink: 0 }} />;
}

function explorerFileEntry(en) {
  return en?.kind === 'file' && (en.file || en.handle);
}

function sortExplorerEntries(a, b) {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

async function listDirectoryEntries(dirHandle) {
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (isPhotoAlbumsFilesExplorerHiddenEntry(name, handle.kind)) continue;
    if (handle.kind === 'directory') {
      entries.push({ name, kind: 'directory', handle, size: 0, file: null });
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const file = await handle.getFile();
      entries.push({
        name,
        kind: 'file',
        handle,
        size: Number(file.size) || 0,
        file
      });
    } catch {
      entries.push({ name, kind: 'file', handle, size: 0, file: null });
    }
  }
  entries.sort(sortExplorerEntries);
  return entries;
}

/**
 * Finder-like local folder browser for staging photos into the green thumbnail tray.
 * Remembers the last folder the user browsed (IndexedDB handle + breadcrumb).
 */
export default function PhotoAlbumsFilesExplorerPanel({
  active = true,
  onStageOsFiles,
  onStageTrayBusyChange,
  disabled = false
}) {
  const [rootHandle, setRootHandle] = useState(null);
  const [relativePath, setRelativePath] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(true);
  /** Finder-style multi-select: click / Shift-click / Cmd-click. */
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const selectionAnchorRef = useRef(null);
  const folderInputRef = useRef(null);
  const rootName = rootHandle?.name || '';

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    selectionAnchorRef.current = null;
  }, []);

  const persistLocation = useCallback((nextRoot, nextRelativePath) => {
    if (!nextRoot?.name) return;
    writeFilesExplorerMeta({
      rootName: nextRoot.name,
      relativePath: nextRelativePath
    });
    void writeFilesExplorerRootHandle(nextRoot);
  }, []);

  const loadCurrentFolder = useCallback(
    async (nextRoot, nextRelativePath, { silent = false } = {}) => {
      if (!nextRoot) {
        setEntries([]);
        clearSelection();
        return;
      }
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const dir = await resolveDirectoryFromRoot(nextRoot, nextRelativePath);
        const listed = await listDirectoryEntries(dir);
        setRootHandle(nextRoot);
        setRelativePath(nextRelativePath);
        setEntries(listed);
        clearSelection();
        persistLocation(nextRoot, nextRelativePath);
        setError('');
      } catch (err) {
        if (!silent) {
          setEntries([]);
          clearSelection();
          setError(err?.message || 'Unable to open this folder');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [clearSelection, persistLocation]
  );

  // Restore last folder on mount / when panel becomes active.
  useEffect(() => {
    if (!active) {
      setRestoring(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setRestoring(true);
      try {
        const meta = readFilesExplorerMeta();
        const saved = await readFilesExplorerRootHandle();
        if (cancelled) return;
        if (!saved) {
          setRootHandle(null);
          setRelativePath([]);
          setEntries([]);
          return;
        }
        const ok = await ensureDirectoryReadPermission(saved, { interactive: false });
        if (cancelled) return;
        if (!ok) {
          // Need a user gesture to re-grant — keep meta for breadcrumb hint.
          setRootHandle(null);
          setRelativePath(meta?.relativePath || []);
          setEntries([]);
          setError('Click “Open folder…” to continue browsing your last import folder.');
          return;
        }
        const path =
          meta && meta.rootName === saved.name ? meta.relativePath || [] : [];
        try {
          await loadCurrentFolder(saved, path, { silent: false });
        } catch {
          await loadCurrentFolder(saved, [], { silent: false });
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, loadCurrentFolder]);

  const pickDirectoryWithApi = useCallback(async () => {
    if (typeof window.showDirectoryPicker !== 'function') return false;
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      const ok = await ensureDirectoryReadPermission(dir, { interactive: true });
      if (!ok) {
        setError('Permission to read this folder was denied.');
        return true;
      }
      await loadCurrentFolder(dir, []);
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return true;
      setError(err?.message || 'Unable to open folder picker');
      return true;
    }
  }, [loadCurrentFolder]);

  const openFolderPicker = useCallback(async () => {
    if (disabled) return;
    setError('');
    // If we have a saved handle that just needs permission, try that first under this gesture.
    const saved = await readFilesExplorerRootHandle();
    if (saved) {
      const ok = await ensureDirectoryReadPermission(saved, { interactive: true });
      if (ok) {
        const meta = readFilesExplorerMeta();
        const path =
          meta && meta.rootName === saved.name ? meta.relativePath || [] : [];
        try {
          await loadCurrentFolder(saved, path);
          return;
        } catch {
          await loadCurrentFolder(saved, []);
          return;
        }
      }
    }
    const usedApi = await pickDirectoryWithApi();
    if (!usedApi) {
      folderInputRef.current?.click();
    }
  }, [disabled, loadCurrentFolder, pickDirectoryWithApi]);

  const changeFolder = useCallback(async () => {
    if (disabled) return;
    setError('');
    const usedApi = await pickDirectoryWithApi();
    if (!usedApi) {
      folderInputRef.current?.click();
    }
  }, [disabled, pickDirectoryWithApi]);

  const onFolderInputChange = useCallback(
    async (event) => {
      const fileList = Array.from(event.target.files || []);
      event.target.value = '';
      if (!fileList.length) return;

      // webkitdirectory: files have webkitRelativePath like "MEMBERS/__ALL/hike1.jpg"
      const byDir = new Map();
      for (const file of fileList) {
        const rel = String(file.webkitRelativePath || file.name).replace(/\\/g, '/');
        const parts = rel.split('/').filter(Boolean);
        const dirKey = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
        if (!byDir.has(dirKey)) byDir.set(dirKey, []);
        byDir.get(dirKey).push(file);
      }
      // Prefer deepest folders that contain files (closest to Finder leaf).
      let bestKey = '';
      let bestDepth = -1;
      for (const key of byDir.keys()) {
        const depth = key ? key.split('/').length : 0;
        if (depth > bestDepth) {
          bestDepth = depth;
          bestKey = key;
        }
      }
      const files = byDir.get(bestKey) || fileList;
      const segments = bestKey ? bestKey.split('/').filter(Boolean) : [];
      const displayRoot = segments[0] || 'Folder';
      const relative = segments.slice(1);
      const listed = files
        .filter((file) => !isPhotoAlbumsFilesExplorerHiddenEntry(file.name, 'file'))
        .map((file) => ({
          name: file.name,
          kind: 'file',
          handle: null,
          size: Number(file.size) || 0,
          file
        }))
        .sort(sortExplorerEntries);

      // No real DirectoryHandle in this fallback — remember breadcrumb names only.
      setRootHandle({ name: displayRoot, __synthetic: true });
      setRelativePath(relative);
      setEntries(listed);
      clearSelection();
      writeFilesExplorerMeta({ rootName: displayRoot, relativePath: relative });
      setError(
        'Folder remembered for this session. Use Chrome/Edge “Open folder…” for full browse + restore.'
      );
    },
    [clearSelection]
  );

  const navigateInto = useCallback(
    async (entry) => {
      if (disabled || !entry || entry.kind !== 'directory' || !rootHandle || rootHandle.__synthetic) {
        return;
      }
      await loadCurrentFolder(rootHandle, [...relativePath, entry.name]);
    },
    [disabled, loadCurrentFolder, relativePath, rootHandle]
  );

  const navigateToBreadcrumbIndex = useCallback(
    async (index) => {
      if (disabled || !rootHandle || rootHandle.__synthetic) return;
      // index 0 = root; index N = relativePath.slice(0, N)
      if (index <= 0) {
        await loadCurrentFolder(rootHandle, []);
        return;
      }
      await loadCurrentFolder(rootHandle, relativePath.slice(0, index));
    },
    [disabled, loadCurrentFolder, relativePath, rootHandle]
  );

  /** Click / Shift-click / Cmd-Ctrl-click — Finder selection. Folders open on double-click only. */
  const selectEntryAt = useCallback(
    (event, entry, index) => {
      if (disabled || !entry) return;
      const key = entryKey(entry);
      const isToggle = event.metaKey || event.ctrlKey;
      const isRange = event.shiftKey;

      if (isRange && selectionAnchorRef.current != null && entries.length) {
        const from = Math.min(selectionAnchorRef.current, index);
        const to = Math.max(selectionAnchorRef.current, index);
        const next = new Set();
        for (let i = from; i <= to; i += 1) {
          const row = entries[i];
          if (row) next.add(entryKey(row));
        }
        setSelectedKeys(next);
        return;
      }

      if (isToggle) {
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        selectionAnchorRef.current = index;
        return;
      }

      setSelectedKeys(new Set([key]));
      selectionAnchorRef.current = index;
    },
    [disabled, entries]
  );

  const toggleEntryCheckbox = useCallback(
    (event, entry, index) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled || !entry) return;
      const key = entryKey(entry);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      selectionAnchorRef.current = index;
    },
    [disabled]
  );

  const filesForKeys = useCallback(
    (keys) => {
      const set = keys instanceof Set ? keys : new Set(keys);
      return entries.filter((en) => set.has(entryKey(en)) && explorerFileEntry(en));
    },
    [entries]
  );

  const materializeExplorerEntries = useCallback(async (selected) => {
    const files = [];
    for (const en of selected) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const file = await materializePhotoStagingFile(en.file, {
          handle: en.handle,
          entryName: en.name
        });
        if (file) files.push(file);
      } catch {
        // skip unreadable entry
      }
    }
    return files;
  }, []);

  const stageSelectedOrEntry = useCallback(
    async (entry) => {
      if (disabled || typeof onStageOsFiles !== 'function') return;
      const key = entry ? entryKey(entry) : null;
      const keys =
        key && selectedKeys.has(key) && selectedKeys.size > 0
          ? selectedKeys
          : key
            ? new Set([key])
            : selectedKeys;
      const selected = filesForKeys(keys);
      if (!selected.length) {
        setError(
          'No supported album photos or MP4 videos in the selection. Supported: PNG, JPEG, SVG, WebP, GIF, AVIF, ICO, BMP, TIFF, APNG, HEIC/HEIF, MP4.'
        );
        return;
      }
      const files = await materializeExplorerEntries(selected);
      if (!files.length) {
        setError('Could not read the selected photo files. Try “Open folder…” if access was revoked.');
        return;
      }
      if (rootHandle && !rootHandle.__synthetic) {
        persistLocation(rootHandle, relativePath);
      }
      onStageOsFiles(files);
    },
    [
      disabled,
      filesForKeys,
      materializeExplorerEntries,
      onStageOsFiles,
      persistLocation,
      relativePath,
      rootHandle,
      selectedKeys
    ]
  );

  /**
   * Pointer drag → green tray. HTML5 DnD cannot carry File System Access files
   * reliably; hit-test the staging tray and stage rematerialized Files.
   */
  const pointerDragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const endPointerDrag = useCallback(async (clientX, clientY) => {
    const drag = pointerDragRef.current;
    pointerDragRef.current = null;
    document.body.style.removeProperty('cursor');
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-rv-album-staging-tray]').forEach((el) => {
        el.removeAttribute('data-pa-explorer-drag-over');
      });
    }
    if (!drag?.moved || disabled || typeof onStageOsFiles !== 'function') {
      clearActiveFilesExplorerDrag();
      return;
    }
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const el =
      typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null;
    const overTray = Boolean(el?.closest?.('[data-rv-album-staging-tray]'));
    if (!overTray) {
      clearActiveFilesExplorerDrag();
      return;
    }
    try {
      if (rootHandle && !rootHandle.__synthetic) {
        await ensureDirectoryReadPermission(rootHandle, { interactive: true });
      }
      const files = await takeFilesExplorerDragFilesAsync();
      if (files.length) {
        if (rootHandle && !rootHandle.__synthetic) {
          persistLocation(rootHandle, relativePath);
        }
        onStageOsFiles(files);
      } else {
        setError('Could not read the dragged photo file(s). Try “Open folder…” if folder access was revoked.');
      }
    } catch {
      clearActiveFilesExplorerDrag();
    }
  }, [disabled, onStageOsFiles, persistLocation, relativePath, rootHandle, setError]);

  const onFilePointerDown = useCallback(
    (event, entry, index) => {
      if (disabled || entry?.kind !== 'file' || !entry?.file) return;
      if (event.button !== 0) return;
      // Allow click/shift-click selection without starting a tray drag.
      if (event.shiftKey || event.metaKey || event.ctrlKey) return;

      const key = entryKey(entry);
      const keys = selectedKeys.has(key) ? selectedKeys : new Set([key]);
      if (!selectedKeys.has(key)) {
        setSelectedKeys(keys);
        selectionAnchorRef.current = index;
      }
      const entriesToDrag = filesForKeys(keys).filter((en) => en.file);
      if (!entriesToDrag.length) return;

      setActiveFilesExplorerDrag(
        entriesToDrag.map((en) => ({
          file: en.file,
          handle: en.handle && typeof en.handle.getFile === 'function' ? en.handle : null,
          name: en.name
        }))
      );

      pointerDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        count: entriesToDrag.length
      };

      const onMove = (e) => {
        const drag = pointerDragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.moved && dx * dx + dy * dy > 36) {
          drag.moved = true;
          document.body.style.cursor = 'copy';
        }
        if (!drag.moved) return;
        const under =
          typeof document !== 'undefined' ? document.elementFromPoint(e.clientX, e.clientY) : null;
        const tray = under?.closest?.('[data-rv-album-staging-tray]');
        document.querySelectorAll('[data-rv-album-staging-tray]').forEach((node) => {
          if (node === tray) node.setAttribute('data-pa-explorer-drag-over', '1');
          else node.removeAttribute('data-pa-explorer-drag-over');
        });
      };

      const onUp = (e) => {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
        void endPointerDrag(e.clientX, e.clientY);
      };

      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    },
    [disabled, endPointerDrag, filesForKeys, selectedKeys]
  );

  const stageSelectedPhotos = useCallback(async () => {
    if (disabled || typeof onStageOsFiles !== 'function') return;
    const selected = filesForKeys(selectedKeys);
    if (!selected.length) {
      setError('Select one or more photos first, then add them to the thumbnail tray.');
      return;
    }
    onStageTrayBusyChange?.(true, 'Adding photos to Thumbnail Tray');
    try {
      const files = await materializeExplorerEntries(selected);
      if (!files.length) {
        setError('Could not read the selected photo files. Try “Open folder…” if access was revoked.');
        return;
      }
      if (rootHandle && !rootHandle.__synthetic) {
        persistLocation(rootHandle, relativePath);
      }
      await onStageOsFiles(files);
    } finally {
      onStageTrayBusyChange?.(false);
    }
  }, [
    disabled,
    filesForKeys,
    materializeExplorerEntries,
    onStageOsFiles,
    onStageTrayBusyChange,
    persistLocation,
    relativePath,
    rootHandle,
    selectedKeys
  ]);

  const stageAllPhotosInFolder = useCallback(async () => {
    if (disabled || typeof onStageOsFiles !== 'function') return;
    const allFiles = entries.filter(explorerFileEntry);
    if (!allFiles.length) {
      setError('No photos in this folder to add to the thumbnail tray.');
      return;
    }
    onStageTrayBusyChange?.(true, 'Adding photos to Thumbnail Tray');
    try {
      const files = await materializeExplorerEntries(allFiles);
      if (!files.length) {
        setError('Could not read photo files in this folder. Try “Open folder…” if access was revoked.');
        return;
      }
      if (rootHandle && !rootHandle.__synthetic) {
        persistLocation(rootHandle, relativePath);
      }
      await onStageOsFiles(files);
    } finally {
      onStageTrayBusyChange?.(false);
    }
  }, [
    disabled,
    entries,
    materializeExplorerEntries,
    onStageOsFiles,
    onStageTrayBusyChange,
    persistLocation,
    relativePath,
    rootHandle
  ]);

  const trayButtonSx = {
    flexShrink: 0,
    fontSize: '0.72rem',
    py: 0.35,
    bgcolor: 'var(--theme-secondary-color) !important',
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    border: '2px solid #000'
  };

  const totalBytes = entries.reduce(
    (sum, entry) => sum + (entry.kind === 'file' ? Number(entry.size) || 0 : 0),
    0
  );
  const folderFileCount = entries.filter(explorerFileEntry).length;
  const breadcrumb = formatFilesExplorerBreadcrumb(rootName, relativePath);
  const crumbParts = [rootName, ...relativePath].filter(Boolean);
  const hasFolder = Boolean(rootHandle) && !rootHandle.__synthetic;
  const showEmptyPick = !restoring && !rootHandle;

  return (
    <Box sx={panelShellSx} aria-label="Files Explorer">
      <input
        ref={folderInputRef}
        type="file"
        // eslint-disable-next-line react/no-unknown-property
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={(e) => void onFolderInputChange(e)}
      />
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, mb: 0.5 }}>
        <SliderControlButton
          type="button"
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => void openFolderPicker()}
          disabled={disabled}
          aria-label={hasFolder ? 'Reopen last folder' : 'Open folder'}
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.72rem',
            py: 0.25,
            bgcolor: 'var(--theme-secondary-color) !important',
            color: '#000 !important',
            WebkitTextFillColor: '#000 !important'
          }}
        >
          {hasFolder || rootHandle ? 'Reopen folder' : 'Open folder…'}
        </SliderControlButton>
        <SliderControlButton
          type="button"
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => void changeFolder()}
          disabled={disabled}
          aria-label="Choose a different folder"
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.72rem',
            py: 0.25,
            bgcolor: 'var(--theme-secondary-color) !important',
            color: '#000 !important',
            WebkitTextFillColor: '#000 !important'
          }}
        >
          Change…
        </SliderControlButton>
      </Box>
      <SliderControlButton
        type="button"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        onClick={() => void stageSelectedPhotos()}
        disabled={disabled || selectedKeys.size < 1}
        aria-label="Add selected photos to Thumbnail Tray"
        sx={{ ...trayButtonSx, mb: 0.5 }}
      >
        Add selected to Thumbnail Tray
      </SliderControlButton>
      <SliderControlButton
        type="button"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        onClick={() => void stageAllPhotosInFolder()}
        disabled={disabled || !entries.some(explorerFileEntry)}
        aria-label="Add all photos in this folder to Thumbnail Tray"
        sx={{ ...trayButtonSx, mb: 0.5 }}
      >
        Add ALL to Thumbnail Tray
      </SliderControlButton>
      <Box sx={panelScrollSx} role="listbox" aria-multiselectable aria-label="Local folder files">
        {error ? (
          <Typography
            component="span"
            sx={{
              display: 'block',
              mb: 0.75,
              color: '#b00020 !important',
              WebkitTextFillColor: '#b00020 !important',
              whiteSpace: 'pre-wrap',
              fontSize: 'inherit',
              fontFamily: 'inherit'
            }}
          >
            {error}
          </Typography>
        ) : null}
        {(loading || restoring) && !entries.length ? (
          <Typography component="span" sx={{ display: 'block', fontWeight: 400 }}>
            Loading…
          </Typography>
        ) : null}
        {showEmptyPick ? (
          <Typography component="span" sx={{ display: 'block', fontWeight: 400 }}>
            Open a folder to browse files. Last folder is remembered for import into the green photo tray.
          </Typography>
        ) : null}
        {!showEmptyPick && crumbParts.length ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 1,
                mb: 0.5
              }}
            >
              <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>
                {formatTotalSizeMb(totalBytes)}
              </Typography>
              <PhotoAlbumsTrayCountLabel count={folderFileCount} />
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.25,
                mb: 0.75,
                fontWeight: 700
              }}
              aria-label={`Path ${breadcrumb}`}
            >
              {crumbParts.map((part, index) => (
                <Box key={`${index}:${part}`} sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  {index > 0 ? (
                    <Typography component="span" sx={{ mx: 0.35, fontWeight: 700 }}>
                      &gt;
                    </Typography>
                  ) : null}
                  <Typography
                    component="button"
                    type="button"
                    onClick={() => void navigateToBreadcrumbIndex(index)}
                    disabled={disabled || !hasFolder}
                    sx={{
                      border: 'none',
                      background: 'none',
                      p: 0,
                      m: 0,
                      cursor: hasFolder && !disabled ? 'pointer' : 'default',
                      font: 'inherit',
                      fontWeight: 700,
                      color: '#000 !important',
                      WebkitTextFillColor: '#000 !important',
                      textDecoration: index < crumbParts.length - 1 ? 'underline' : 'none'
                    }}
                  >
                    {part}
                  </Typography>
                </Box>
              ))}
            </Box>
            {entries.map((entry, index) => {
              const key = entryKey(entry);
              const selected = selectedKeys.has(key);
              const canDrag = entry.kind === 'file' && Boolean(entry.file) && !disabled;
              return (
              <Box
                key={key}
                role="option"
                aria-selected={selected}
                draggable={false}
                onPointerDown={(e) => onFilePointerDown(e, entry, index)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  if (entry.kind === 'directory') void navigateInto(entry);
                  else void stageSelectedOrEntry(entry);
                }}
                onClick={(e) => {
                  if (suppressClickRef.current) return;
                  selectEntryAt(e, entry, index);
                }}
                sx={{ ...rowSx(selected), cursor: canDrag ? 'grab' : 'pointer' }}
                title={
                  entry.kind === 'directory'
                    ? `Select ${entry.name} (double-click to open)`
                    : `Select ${entry.name} — drag to Thumbnail Tray, or use “Add selected to Thumbnail Tray”`
                }
              >
                <Box
                  component="input"
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => toggleEntryCheckbox(e, entry, index)}
                  aria-label={`Select ${entry.name}`}
                  sx={{
                    m: 0,
                    flexShrink: 0,
                    width: 14,
                    height: 14,
                    cursor: disabled ? 'default' : 'pointer',
                    accentColor: '#0a84ff'
                  }}
                />
                {entryIcon(entry)}
                <Typography
                  component="span"
                  sx={{
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: entry.kind === 'directory' ? 700 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {entry.name}
                </Typography>
              </Box>
              );
            })}
            {!loading && !restoring && entries.length === 0 ? (
              <Typography component="span" sx={{ display: 'block', fontWeight: 400 }}>
                (empty folder)
              </Typography>
            ) : null}
          </>
        ) : null}
      </Box>
    </Box>
  );
}

PhotoAlbumsFilesExplorerPanel.propTypes = {
  active: PropTypes.bool,
  onStageOsFiles: PropTypes.func,
  onStageTrayBusyChange: PropTypes.func,
  disabled: PropTypes.bool
};
