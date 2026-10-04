import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import {
  deleteMobileUploadFile,
  fetchMobileUploadFileBlob,
  listMobileUploadFiles
} from 'api/photoAlbumsMobileUploadFolderFe';
import { getScanForPhoneUploadMs } from 'config/phoneUploadScanEnv';
import {
  MOBILE_UPLOAD_HOVER_TOOLTIP,
  mobileUploadHoverTooltipSlotProps
} from 'config/mobileUploadHoverTooltip';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import {
  MOBILE_UPLOAD_PRODUCT_TUTANOTES,
  requireMobileUploadProduct
} from 'constants/mobileUploadProduct';

/** HTML5 drag payload: file name under UPLOAD_FOLDER. */
export const RV_MOBILE_UPLOAD_DRAG_MIME = 'application/x-rv-mobile-upload';
/** HTML5 drag payload: JSON array of file names (multi-select drag). */
export const RV_MOBILE_UPLOAD_DRAG_LIST_MIME = 'application/x-rv-mobile-upload-list';

export function isRecordVaultMobileUploadDrag(dataTransfer) {
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes(RV_MOBILE_UPLOAD_DRAG_MIME);
}

export function readRecordVaultMobileUploadDragFileName(dataTransfer) {
  const raw = String(dataTransfer?.getData?.(RV_MOBILE_UPLOAD_DRAG_MIME) || '').trim();
  return raw || '';
}

/** All dragged mobile-upload names (multi-select), falling back to the single name. */
export function readRecordVaultMobileUploadDragFileNames(dataTransfer) {
  try {
    const parsed = JSON.parse(dataTransfer?.getData?.(RV_MOBILE_UPLOAD_DRAG_LIST_MIME) || '[]');
    if (Array.isArray(parsed)) {
      const names = parsed.map((n) => String(n || '').trim()).filter(Boolean);
      if (names.length) return names;
    }
  } catch {
    // fall back to single name
  }
  const single = readRecordVaultMobileUploadDragFileName(dataTransfer);
  return single ? [single] : [];
}

function stripMobileUploadNamePrefix(name) {
  const raw = String(name || '');
  return (
    raw.replace(/^\d+_(?:tutaphoto|tutanotes|tutadates)_/, '').replace(/^\d+_/, '') || raw
  );
}

/** Build a File from a staged mobile-upload name (for vault attach). */
export async function materializeRecordVaultMobileUploadFile(fileName, product) {
  const name = String(fileName || '').trim();
  if (!name) throw new Error('Missing mobile upload file name');
  const blob = await fetchMobileUploadFileBlob(name, product);
  const display = stripMobileUploadNamePrefix(name);
  const type = blob.type || 'application/octet-stream';
  return new File([blob], display, { type, lastModified: Date.now() });
}

function isVideoContentType(contentType, name) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.startsWith('video/')) return true;
  const lower = String(name || '').toLowerCase();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.avi')
  );
}

function displayName(name) {
  return stripMobileUploadNamePrefix(name);
}

function ThumbTile({
  entry,
  thumb,
  disabled,
  onRemove,
  selectable = false,
  selected = false,
  onToggleSelect,
  getDragNames,
  onDragDone
}) {
  const name = entry.name;
  const video = isVideoContentType(entry.contentType, name);
  return (
    <Box
      role="listitem"
      aria-selected={selectable ? selected : undefined}
      draggable={!disabled}
      title={
        selectable
          ? `${displayName(name)} — click to select, drag onto a note or the Thumbnail Tray`
          : `${displayName(name)} — drag onto a note`
      }
      onClick={() => {
        if (selectable && !disabled) onToggleSelect?.(name);
      }}
      onDragStart={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        const names = getDragNames ? getDragNames(name) : [name];
        e.dataTransfer.setData(RV_MOBILE_UPLOAD_DRAG_MIME, names[0] || name);
        e.dataTransfer.setData(RV_MOBILE_UPLOAD_DRAG_LIST_MIME, JSON.stringify(names));
        e.dataTransfer.setData('text/plain', names.map(displayName).join('\n'));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={(e) => {
        if (e.dataTransfer?.dropEffect && e.dataTransfer.dropEffect !== 'none') onDragDone?.();
      }}
      sx={{
        position: 'relative',
        flex: '0 0 auto',
        width: 72,
        height: 72,
        border: selected ? '4px solid #1565c0' : '2px solid #000',
        borderRadius: 0.75,
        bgcolor: '#fff',
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: selected ? '0 0 0 2px #fff, 0 0 8px 2px rgba(21, 101, 192, 0.8)' : 'none',
        cursor: disabled ? 'default' : selectable ? 'pointer' : 'grab',
        userSelect: 'none',
        '&:active': { cursor: disabled ? 'default' : 'grabbing' }
      }}
    >
      {selected ? (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 2,
            left: 2,
            zIndex: 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            bgcolor: '#1565c0',
            color: '#fff',
            border: '1px solid #fff',
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          ✓
        </Box>
      ) : null}
      {thumb ? (
        <Box
          component="img"
          src={thumb}
          alt={displayName(name)}
          draggable={false}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#eee'
          }}
        >
          {video ? <VideocamOutlinedIcon sx={{ color: '#333' }} /> : <ImageOutlinedIcon sx={{ color: '#333' }} />}
        </Box>
      )}
      <Box
        component="button"
        type="button"
        aria-label={`Remove ${displayName(name)}`}
        {...guestDemoBlockProps()}
        onClick={(e) => onRemove(name, e)}
        disabled={disabled}
        sx={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 18,
          height: 18,
          p: 0,
          m: 0,
          border: '1px solid #000',
          borderRadius: '50%',
          bgcolor: '#e53935',
          color: '#fff',
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </Box>
    </Box>
  );
}

ThumbTile.propTypes = {
  entry: PropTypes.shape({
    name: PropTypes.string.isRequired,
    contentType: PropTypes.string
  }).isRequired,
  thumb: PropTypes.string,
  disabled: PropTypes.bool,
  onRemove: PropTypes.func.isRequired,
  selectable: PropTypes.bool,
  selected: PropTypes.bool,
  onToggleSelect: PropTypes.func,
  getDragNames: PropTypes.func,
  onDragDone: PropTypes.func
};

/**
 * Product-scoped mobile-upload thumbnails (UPLOAD_FOLDER).
 * Desktop: strip under menu. Mobile upload session: grid under the popup.
 * `plain` — white background, no frame, no label.
 */
export default function RecordVaultMobileUploadTray({
  product = MOBILE_UPLOAD_PRODUCT_TUTANOTES,
  active = true,
  disabled = false,
  refreshToken = 0,
  pollIntervalMs = 0,
  titleLabel = 'Mobile Upload:',
  layout = 'horizontal',
  plain = false,
  selectable = false,
  emptyHint,
  onError
}) {
  const stagingProduct = requireMobileUploadProduct(product);
  const [files, setFiles] = useState([]);
  const [selectedNames, setSelectedNames] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [thumbUrls, setThumbUrls] = useState(() => ({}));
  const thumbUrlsRef = useRef({});
  const filesRef = useRef([]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
    const hadFiles =
      filesRef.current.length > 0 || Object.keys(thumbUrlsRef.current || {}).length > 0;
    // Only show "Loading…" on the first empty pass — avoid blanking thumbs every poll.
    if (!hadFiles) setLoading(true);
    try {
      const listed = await listMobileUploadFiles(stagingProduct);
      const prevNames = filesRef.current.map((e) => e?.name).join('\0');
      const nextNames = listed.map((e) => e?.name).join('\0');
      const sameList = prevNames === nextNames;
      const nameSet = new Set(listed.map((e) => e?.name).filter(Boolean));

      filesRef.current = listed;
      if (!sameList) setFiles(listed);

      // Unchanged folder + thumbs already cached → skip blob work (stops poll blink).
      if (
        sameList &&
        listed.every(
          (e) =>
            !e?.name ||
            thumbUrlsRef.current[e.name] ||
            isVideoContentType(e.contentType, e.name)
        )
      ) {
        return;
      }

      const prev = { ...thumbUrlsRef.current };
      let fetchedNewThumb = false;
      let removedThumb = false;

      // Drop thumbs for files that left the folder (revoke only those).
      Object.keys(prev).forEach((name) => {
        if (!nameSet.has(name)) {
          removedThumb = true;
          try {
            URL.revokeObjectURL(prev[name]);
          } catch {
            // ignore
          }
          delete prev[name];
        }
      });

      // Fetch blobs only for new image files — keep existing object URLs so tiles do not blink.
      await Promise.all(
        listed.map(async (entry) => {
          const name = entry?.name;
          if (!name || prev[name]) return;
          if (isVideoContentType(entry.contentType, name)) return;
          try {
            const blob = await fetchMobileUploadFileBlob(name, stagingProduct);
            prev[name] = URL.createObjectURL(blob);
            fetchedNewThumb = true;
          } catch {
            // skip thumb
          }
        })
      );

      thumbUrlsRef.current = prev;
      if (!sameList || fetchedNewThumb || removedThumb) {
        setThumbUrls({ ...prev });
      }
    } catch (err) {
      // Keep existing thumbs on transient poll errors — clearing them caused the blink.
      onErrorRef.current?.(
        err?.response?.data?.error || err?.message || 'Failed to list mobile uploads'
      );
    } finally {
      setLoading(false);
    }
  }, [stagingProduct]);

  useEffect(() => {
    if (!active) return undefined;
    void loadFiles();
    return undefined;
  }, [active, refreshToken, loadFiles]);

  useEffect(() => {
    if (active) return undefined;
    revokeThumbs();
    filesRef.current = [];
    setFiles([]);
    return undefined;
  }, [active, revokeThumbs]);

  useEffect(() => () => revokeThumbs(), [revokeThumbs]);

  useEffect(() => {
    if (!active) return undefined;
    const ms = pollIntervalMs > 0 ? pollIntervalMs : getScanForPhoneUploadMs();
    const id = window.setInterval(() => {
      void loadFiles();
    }, ms);
    return () => window.clearInterval(id);
  }, [active, pollIntervalMs, loadFiles]);

  const handleRemove = useCallback(
    async (fileName, event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (disabled) return;
      try {
        await deleteMobileUploadFile(fileName, stagingProduct);
        await loadFiles();
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to delete mobile upload');
      }
    },
    [disabled, loadFiles, onError, stagingProduct]
  );

  useEffect(() => {
    setSelectedNames((prev) => {
      if (!prev.size) return prev;
      const present = new Set(files.map((e) => e?.name).filter(Boolean));
      const next = new Set([...prev].filter((n) => present.has(n)));
      return next.size === prev.size ? prev : next;
    });
  }, [files]);

  const toggleSelect = useCallback((fileName) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  }, []);

  const allSelected = files.length > 0 && files.every((e) => selectedNames.has(e.name));

  const toggleSelectAll = useCallback(() => {
    setSelectedNames(allSelected ? new Set() : new Set(files.map((e) => e.name)));
  }, [allSelected, files]);

  const clearSelection = useCallback(() => setSelectedNames(new Set()), []);

  /** Dragging a selected tile carries every selected tile (tray order); otherwise just that one. */
  const getDragNames = useCallback(
    (fileName) => {
      if (!selectedNames.has(fileName)) return [fileName];
      return files.map((e) => e.name).filter((n) => selectedNames.has(n));
    },
    [files, selectedNames]
  );

  const isGrid = layout === 'grid';
  const shellSx = isGrid
    ? {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: plain ? 0 : 1,
        px: plain ? 0.5 : 1.5,
        py: plain ? 0.5 : 1.25,
        bgcolor: plain ? '#ffffff' : '#fff59d',
        border: plain ? 'none' : '3px dashed #c62828',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }
    : {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        gap: 1,
        minHeight: 88,
        px: 1,
        py: 0.75,
        bgcolor: '#fff59d',
        borderBottom: '2px solid #000',
        boxSizing: 'border-box',
        overflow: 'hidden'
      };

  const thumbsArea = (
    <Box
      sx={
        isGrid
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexWrap: 'wrap',
              alignContent: 'flex-start',
              gap: 1,
              overflowY: 'auto',
              p: 0.5
            }
          : {
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              py: 0.25,
              scrollbarWidth: 'thin'
            }
      }
    >
      {loading && !files.length ? (
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#333' }}>Loading…</Typography>
      ) : null}
      {!loading && !files.length ? (
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: { xs: '0.75rem', sm: '0.85rem' },
            color: '#555',
            WebkitTextFillColor: '#555'
          }}
        >
          {emptyHint ||
            (isGrid
              ? 'Take a photo or choose from gallery — thumbnails appear here.'
              : 'Scan Mobile Upload QR — photos appear here. Drag a thumbnail onto a note.')}
        </Typography>
      ) : null}
      {files.map((entry) => (
        <ThumbTile
          key={entry.name}
          entry={entry}
          thumb={thumbUrls[entry.name]}
          disabled={disabled}
          onRemove={handleRemove}
          selectable={selectable}
          selected={selectable && selectedNames.has(entry.name)}
          onToggleSelect={toggleSelect}
          getDragNames={selectable ? getDragNames : undefined}
          onDragDone={selectable ? clearSelection : undefined}
        />
      ))}
    </Box>
  );

  return (
    <Box data-rv-mobile-upload-tray="" aria-label="Mobile Upload thumbnails" sx={shellSx}>
      {plain ? null : (
        <Tooltip
          title={MOBILE_UPLOAD_HOVER_TOOLTIP}
          arrow
          placement="top"
          enterDelay={200}
          slotProps={mobileUploadHoverTooltipSlotProps()}
        >
          <Box
            sx={
              isGrid
                ? {
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    border: '3px solid #000',
                    borderRadius: 0.5,
                    bgcolor: '#ffeb3b',
                    px: 1,
                    py: 0.5,
                    cursor: 'help'
                  }
                : {
                    flexShrink: 0,
                    alignSelf: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '3px solid #000',
                    borderRadius: 0.5,
                    bgcolor: '#ffeb3b',
                    px: 1,
                    py: 0.5,
                    boxSizing: 'border-box',
                    cursor: 'help'
                  }
            }
          >
            <Typography
              component="span"
              sx={{
                fontFamily: MAIN_FONT_FAMILY,
                fontWeight: 800,
                fontSize: { xs: '0.85rem', sm: '1rem' },
                lineHeight: 1.15,
                color: '#000',
                WebkitTextFillColor: '#000',
                whiteSpace: 'nowrap'
              }}
            >
              {titleLabel}
            </Typography>
          </Box>
        </Tooltip>
      )}
      {selectable ? (
        <ColorTemplate13DisableGreenButton
          type="button"
          disabled={disabled || !files.length}
          aria-label={allSelected ? 'Unselect all mobile upload thumbnails' : 'Select all mobile upload thumbnails'}
          title={
            allSelected
              ? 'Unselect all thumbnails'
              : 'Select all thumbnails, then drag any selected one onto the Thumbnail Tray'
          }
          onClick={toggleSelectAll}
          sx={{ flexShrink: 0, alignSelf: 'center', whiteSpace: 'nowrap' }}
        >
          {allSelected ? 'Unselect All' : 'Select All'}
        </ColorTemplate13DisableGreenButton>
      ) : null}
      {thumbsArea}
    </Box>
  );
}

RecordVaultMobileUploadTray.propTypes = {
  product: PropTypes.oneOf(['tutaphoto', 'tutanotes', 'tutadates']),
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  refreshToken: PropTypes.number,
  pollIntervalMs: PropTypes.number,
  titleLabel: PropTypes.string,
  layout: PropTypes.oneOf(['horizontal', 'grid']),
  plain: PropTypes.bool,
  selectable: PropTypes.bool,
  emptyHint: PropTypes.string,
  onError: PropTypes.func
};
