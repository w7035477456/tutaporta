import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import {
  deleteMobileUploadFile,
  fetchMobileUploadFileBlob,
  listMobileUploadFiles
} from 'api/photoAlbumsMobileUploadFolderFe';
import PhotoAlbumsTrayCountLabel from './PhotoAlbumsTrayCountLabel';

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
  gap: 0.75,
  whiteSpace: 'nowrap',
  minHeight: '2.1em',
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

const trayButtonSx = {
  flexShrink: 0,
  fontSize: '0.72rem',
  py: 0.35,
  bgcolor: 'var(--theme-secondary-color) !important',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  border: '2px solid #000'
};

function isVideoContentType(contentType, name) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.startsWith('video/')) return true;
  const lower = String(name || '').toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov');
}

function displayName(name) {
  const raw = String(name || '');
  const withoutPrefix = raw.replace(/^\d+_/, '');
  return withoutPrefix || raw;
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lists phone uploads staged under UPLOAD_FOLDER; stages selected files into the green tray.
 */
export default function PhotoAlbumsMobileUploadFolderPanel({
  active = true,
  disabled = false,
  onStageOsFiles,
  onStageTrayBusyChange,
  refreshToken = 0
}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedNames, setSelectedNames] = useState(() => new Set());
  const [thumbUrls, setThumbUrls] = useState(() => ({}));
  const selectionAnchorRef = useRef(null);
  const thumbUrlsRef = useRef({});

  const clearSelection = useCallback(() => {
    setSelectedNames(new Set());
    selectionAnchorRef.current = null;
  }, []);

  const revokeThumbs = useCallback(() => {
    Object.values(thumbUrlsRef.current).forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    thumbUrlsRef.current = {};
    setThumbUrls({});
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listed = await listMobileUploadFiles();
      setFiles(listed);
      clearSelection();
      revokeThumbs();
      const nextThumbs = {};
      await Promise.all(
        listed.map(async (entry) => {
          const name = entry?.name;
          if (!name) return;
          if (isVideoContentType(entry.contentType, name)) return;
          try {
            const blob = await fetchMobileUploadFileBlob(name);
            const url = URL.createObjectURL(blob);
            nextThumbs[name] = url;
          } catch {
            // skip thumb
          }
        })
      );
      thumbUrlsRef.current = nextThumbs;
      setThumbUrls(nextThumbs);
    } catch (err) {
      setFiles([]);
      clearSelection();
      revokeThumbs();
      setError(err?.response?.data?.error || err?.message || 'Failed to list mobile uploads');
    } finally {
      setLoading(false);
    }
  }, [clearSelection, revokeThumbs]);

  useEffect(() => {
    if (!active) return undefined;
    void loadFiles();
    return () => {
      revokeThumbs();
    };
  }, [active, refreshToken, loadFiles, revokeThumbs]);

  const toggleSelect = useCallback(
    (name, { shiftKey = false, metaKey = false } = {}) => {
      setSelectedNames((prev) => {
        const next = new Set(prev);
        const names = files.map((f) => f.name);
        const idx = names.indexOf(name);
        if (shiftKey && selectionAnchorRef.current != null) {
          const anchorIdx = names.indexOf(selectionAnchorRef.current);
          if (anchorIdx >= 0 && idx >= 0) {
            const [a, b] = anchorIdx < idx ? [anchorIdx, idx] : [idx, anchorIdx];
            for (let i = a; i <= b; i += 1) next.add(names[i]);
            return next;
          }
        }
        if (metaKey) {
          if (next.has(name)) next.delete(name);
          else next.add(name);
        } else {
          next.clear();
          next.add(name);
        }
        selectionAnchorRef.current = name;
        return next;
      });
    },
    [files]
  );

  const blobToFile = useCallback(async (entry) => {
    const blob = await fetchMobileUploadFileBlob(entry.name);
    const type = entry.contentType || blob.type || 'application/octet-stream';
    return new File([blob], displayName(entry.name), { type, lastModified: entry.mtimeMs || Date.now() });
  }, []);

  const stageSelected = useCallback(async () => {
    if (disabled || typeof onStageOsFiles !== 'function') return;
    const selected = files.filter((f) => selectedNames.has(f.name));
    if (!selected.length) {
      setError('Select one or more photos first, then add them to the thumbnail tray.');
      return;
    }
    setError('');
    onStageTrayBusyChange?.(true, 'Adding photos to Thumbnail Tray');
    try {
      const staged = [];
      for (const entry of selected) {
        // eslint-disable-next-line no-await-in-loop
        staged.push(await blobToFile(entry));
      }
      if (!staged.length) {
        setError('Could not download selected files.');
        return;
      }
      await onStageOsFiles(staged);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to stage mobile uploads');
    } finally {
      onStageTrayBusyChange?.(false);
    }
  }, [blobToFile, disabled, files, onStageOsFiles, onStageTrayBusyChange, selectedNames]);

  const stageAll = useCallback(async () => {
    if (disabled || typeof onStageOsFiles !== 'function') return;
    if (!files.length) {
      setError('No mobile uploads to add to the thumbnail tray.');
      return;
    }
    setError('');
    onStageTrayBusyChange?.(true, 'Adding photos to Thumbnail Tray');
    try {
      const staged = [];
      for (const entry of files) {
        // eslint-disable-next-line no-await-in-loop
        staged.push(await blobToFile(entry));
      }
      if (!staged.length) {
        setError('Could not download mobile upload files.');
        return;
      }
      await onStageOsFiles(staged);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to stage mobile uploads');
    } finally {
      onStageTrayBusyChange?.(false);
    }
  }, [blobToFile, disabled, files, onStageOsFiles, onStageTrayBusyChange]);

  const removeSelected = useCallback(async () => {
    if (disabled) return;
    const selected = files.filter((f) => selectedNames.has(f.name));
    if (!selected.length) return;
    setError('');
    try {
      for (const entry of selected) {
        // eslint-disable-next-line no-await-in-loop
        await deleteMobileUploadFile(entry.name);
      }
      await loadFiles();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to delete');
    }
  }, [disabled, files, loadFiles, selectedNames]);

  return (
    <Box sx={panelShellSx} aria-label="Mobile Upload folder">
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, mb: 0.5 }}>
        <SliderControlButton
          type="button"
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => void loadFiles()}
          disabled={disabled || loading}
          aria-label="Refresh mobile uploads"
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
          Refresh
        </SliderControlButton>
        <SliderControlButton
          type="button"
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => void removeSelected()}
          disabled={disabled || selectedNames.size < 1}
          aria-label="Delete selected mobile uploads"
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
          Delete selected
        </SliderControlButton>
      </Box>
      <SliderControlButton
        type="button"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        onClick={() => void stageSelected()}
        disabled={disabled || selectedNames.size < 1}
        aria-label="Add selected photos to Thumbnail Tray"
        sx={{ ...trayButtonSx, mb: 0.5 }}
      >
        Add selected to Thumbnail Tray
      </SliderControlButton>
      <SliderControlButton
        type="button"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        onClick={() => void stageAll()}
        disabled={disabled || !files.length}
        aria-label="Add all mobile uploads to Thumbnail Tray"
        sx={{ ...trayButtonSx, mb: 0.5 }}
      >
        Add ALL to Thumbnail Tray
      </SliderControlButton>
      <Box sx={panelScrollSx} role="listbox" aria-multiselectable aria-label="Mobile upload files">
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
        {loading && !files.length ? (
          <Typography component="span" sx={{ display: 'block', fontWeight: 400 }}>
            Loading…
          </Typography>
        ) : null}
        {!loading && !files.length ? (
          <Typography component="span" sx={{ display: 'block', fontWeight: 400 }}>
            Scan Mobile Upload QR — photos appear here
          </Typography>
        ) : null}
        {files.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
            <PhotoAlbumsTrayCountLabel count={files.length} />
          </Box>
        ) : null}
        {files.map((entry) => {
          const selected = selectedNames.has(entry.name);
          const video = isVideoContentType(entry.contentType, entry.name);
          const thumb = thumbUrls[entry.name];
          return (
            <Box
              key={entry.name}
              role="option"
              aria-selected={selected}
              onClick={(e) =>
                toggleSelect(entry.name, { shiftKey: e.shiftKey, metaKey: e.metaKey || e.ctrlKey })
              }
              sx={rowSx(selected)}
            >
              {thumb ? (
                <Box
                  component="img"
                  src={thumb}
                  alt=""
                  sx={{
                    width: 28,
                    height: 28,
                    objectFit: 'cover',
                    borderRadius: 0.5,
                    border: '1px solid #000',
                    flexShrink: 0
                  }}
                />
              ) : video ? (
                <VideocamOutlinedIcon sx={{ fontSize: '1.1rem', color: '#000', flexShrink: 0 }} />
              ) : (
                <ImageOutlinedIcon sx={{ fontSize: '1.1rem', color: '#000', flexShrink: 0 }} />
              )}
              <Typography component="span" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName(entry.name)}
              </Typography>
              <Typography component="span" sx={{ opacity: 0.75, ml: 'auto', flexShrink: 0 }}>
                {formatSize(entry.size)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

PhotoAlbumsMobileUploadFolderPanel.propTypes = {
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  onStageOsFiles: PropTypes.func,
  onStageTrayBusyChange: PropTypes.func,
  refreshToken: PropTypes.number
};
