import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import {
  deleteMobileUploadFile,
  fetchMobileUploadFileBlob,
  listMobileUploadFiles
} from 'api/photoAlbumsMobileUploadFolderFe';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';

/** HTML5 drag payload: file name under UPLOAD_FOLDER. */
export const RV_MOBILE_UPLOAD_DRAG_MIME = 'application/x-rv-mobile-upload';

export function isRecordVaultMobileUploadDrag(dataTransfer) {
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes(RV_MOBILE_UPLOAD_DRAG_MIME);
}

export function readRecordVaultMobileUploadDragFileName(dataTransfer) {
  const raw = String(dataTransfer?.getData?.(RV_MOBILE_UPLOAD_DRAG_MIME) || '').trim();
  return raw || '';
}

/** Build a File from a staged mobile-upload name (for vault attach). */
export async function materializeRecordVaultMobileUploadFile(fileName) {
  const name = String(fileName || '').trim();
  if (!name) throw new Error('Missing mobile upload file name');
  const blob = await fetchMobileUploadFileBlob(name);
  const display = name.replace(/^\d+_/, '') || name;
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
  const raw = String(name || '');
  return raw.replace(/^\d+_/, '') || raw;
}

/**
 * Full-width strip under the TutaNotes menu: Mobile Upload thumbnails from
 * UPLOAD_FOLDER. Drag a thumb onto the open note to attach it.
 */
export default function RecordVaultMobileUploadTray({
  active = true,
  disabled = false,
  refreshToken = 0,
  onError
}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [thumbUrls, setThumbUrls] = useState(() => ({}));
  const thumbUrlsRef = useRef({});

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
    try {
      const listed = await listMobileUploadFiles();
      setFiles(listed);
      revokeThumbs();
      const nextThumbs = {};
      await Promise.all(
        listed.map(async (entry) => {
          const name = entry?.name;
          if (!name) return;
          if (isVideoContentType(entry.contentType, name)) return;
          try {
            const blob = await fetchMobileUploadFileBlob(name);
            nextThumbs[name] = URL.createObjectURL(blob);
          } catch {
            // skip thumb
          }
        })
      );
      thumbUrlsRef.current = nextThumbs;
      setThumbUrls(nextThumbs);
    } catch (err) {
      setFiles([]);
      revokeThumbs();
      onError?.(err?.response?.data?.error || err?.message || 'Failed to list mobile uploads');
    } finally {
      setLoading(false);
    }
  }, [onError, revokeThumbs]);

  useEffect(() => {
    if (!active) return undefined;
    void loadFiles();
    return () => {
      revokeThumbs();
    };
  }, [active, refreshToken, loadFiles, revokeThumbs]);

  const handleRemove = useCallback(
    async (fileName, event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (disabled) return;
      try {
        await deleteMobileUploadFile(fileName);
        await loadFiles();
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to delete mobile upload');
      }
    },
    [disabled, loadFiles, onError]
  );

  return (
    <Box
      data-rv-mobile-upload-tray=""
      aria-label="Mobile Upload thumbnails"
      sx={{
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
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          alignSelf: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          border: '3px solid #000',
          borderRadius: 0.5,
          bgcolor: '#ffeb3b',
          px: 1,
          py: 0.5,
          boxSizing: 'border-box'
        }}
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
          Mobile Upload:
        </Typography>
      </Box>

      <Box
        sx={{
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
        }}
      >
        {loading && !files.length ? (
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#333' }}>
            Loading…
          </Typography>
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
            Scan Mobile Upload QR — photos appear here. Drag a thumbnail onto a note.
          </Typography>
        ) : null}
        {files.map((entry) => {
          const name = entry.name;
          const video = isVideoContentType(entry.contentType, name);
          const thumb = thumbUrls[name];
          return (
            <Box
              key={name}
              role="listitem"
              draggable={!disabled}
              title={`${displayName(name)} — drag onto a note`}
              onDragStart={(e) => {
                if (disabled) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData(RV_MOBILE_UPLOAD_DRAG_MIME, name);
                e.dataTransfer.setData('text/plain', displayName(name));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              sx={{
                position: 'relative',
                flex: '0 0 auto',
                width: 72,
                height: 72,
                border: '2px solid #000',
                borderRadius: 0.75,
                bgcolor: '#fff',
                overflow: 'hidden',
                cursor: disabled ? 'default' : 'grab',
                userSelect: 'none',
                '&:active': { cursor: disabled ? 'default' : 'grabbing' }
              }}
            >
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
                  {video ? (
                    <VideocamOutlinedIcon sx={{ color: '#333' }} />
                  ) : (
                    <ImageOutlinedIcon sx={{ color: '#333' }} />
                  )}
                </Box>
              )}
              <Box
                component="button"
                type="button"
                aria-label={`Remove ${displayName(name)}`}
                {...guestDemoBlockProps()}
                onClick={(e) => void handleRemove(name, e)}
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
        })}
      </Box>
    </Box>
  );
}

RecordVaultMobileUploadTray.propTypes = {
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  refreshToken: PropTypes.number,
  onError: PropTypes.func
};
