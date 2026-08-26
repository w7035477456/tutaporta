import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import ProfilePhotoUploadQrPanel, {
  PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE
} from 'components/ProfilePhotoUploadQrPanel';
import {
  deletePaidRecordAttachment,
  ensurePaidRecord,
  fetchPaidRecord,
  paidRecordAttachmentDownloadUrl,
  paidRecordAttachmentUrl,
  savePaidRecordNotes,
  uploadPaidRecordAttachment
} from 'api/paidRecordFe';
import { recordVaultPopupCloseSx } from './recordVaultPopupCloseSx';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

const DROP_BG = 'rgba(74, 144, 217, 0.35)';

/**
 * Bills/Receipts popup: preview | upload+QR+notes | thumbnail strip.
 */
export default function BillReceiptsPopup({
  open,
  onClose,
  onChanged,
  ensurePayload,
  storageType = 'onedrive'
}) {
  const fileInputRef = useRef(null);
  const notesTimerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paidRecordId, setPaidRecordId] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const applyPayload = useCallback((data, { mergeAttachments = false } = {}) => {
    if (!data) return;
    if (data.paidRecordId != null) setPaidRecordId(Number(data.paidRecordId) || null);
    if (data.notesText != null) setNotesText(String(data.notesText || ''));
    if (Array.isArray(data.attachments)) {
      const list = data.attachments;
      setAttachments(list);
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.attachmentId === prev)) return prev;
        return list[0]?.attachmentId ?? null;
      });
    } else if (!mergeAttachments) {
      // notes-only responses omit attachments — keep gallery as-is
    }
  }, []);

  const reload = useCallback(async () => {
    if (!paidRecordId) return;
    const data = await fetchPaidRecord(paidRecordId);
    applyPayload(data);
    onChanged?.(data);
  }, [applyPayload, onChanged, paidRecordId]);

  useEffect(() => {
    if (!open || !ensurePayload) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPaidRecordId(null);
    setAttachments([]);
    setNotesText('');
    setSelectedId(null);
    void (async () => {
      try {
        const data = await ensurePaidRecord(ensurePayload, { storageType });
        if (cancelled) return;
        applyPayload(data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Unable to open bill receipts');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ensurePayload, storageType, applyPayload]);

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) window.clearTimeout(notesTimerRef.current);
    };
  }, []);

  const persistNotes = useCallback(
    (value) => {
      if (!paidRecordId) return;
      if (notesTimerRef.current) window.clearTimeout(notesTimerRef.current);
      notesTimerRef.current = window.setTimeout(async () => {
        try {
          const data = await savePaidRecordNotes(paidRecordId, value);
          applyPayload(data);
          onChanged?.(data);
        } catch (err) {
          setError(err?.response?.data?.error || err?.message || 'Failed to save notes');
        }
      }, 450);
    },
    [applyPayload, onChanged, paidRecordId]
  );

  const handleFiles = async (fileList) => {
    if (!paidRecordId || !fileList?.length) return;
    setBusy(true);
    setError('');
    try {
      let last = null;
      const skipNotes = [];
      for (const file of Array.from(fileList)) {
        // Client fast-path: same byte size → SHA-256 → skip if already in this popup.
        const sizeMatches = attachments.filter(
          (a) => Number(a.byteSize) > 0 && Number(a.byteSize) === Number(file.size)
        );
        if (sizeMatches.length) {
          let digest = '';
          try {
            const buf = await file.arrayBuffer();
            const hash = await crypto.subtle.digest('SHA-256', buf);
            digest = Array.from(new Uint8Array(hash))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
          } catch {
            digest = '';
          }
          const dup = digest
            ? sizeMatches.find((a) => a.checksum && String(a.checksum).toLowerCase() === digest)
            : null;
          if (dup) {
            skipNotes.push('Skipping upload duplicate file');
            continue;
          }
        }
        // eslint-disable-next-line no-await-in-loop
        last = await uploadPaidRecordAttachment(paidRecordId, file);
        if (last?.skipped) {
          skipNotes.push(last.skipMessage || 'Skipping upload duplicate file');
        }
      }
      if (last) {
        applyPayload(last);
        onChanged?.(last);
        if (last.uploadedAttachmentId && !last.skipped) setSelectedId(last.uploadedAttachmentId);
      }
      if (skipNotes.length) {
        setError(skipNotes[0]);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!paidRecordId) return;
    setBusy(true);
    setError('');
    try {
      const data = await deletePaidRecordAttachment(paidRecordId, attachmentId);
      applyPayload(data);
      onChanged?.(data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const selected = attachments.find((a) => a.attachmentId === selectedId) || null;
  const previewUrl =
    selected && paidRecordId
      ? paidRecordAttachmentUrl(paidRecordId, selected.attachmentId)
      : null;

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close bills receipts"
      maxWidth="min(96vw, 1100px)"
      centerInWindow
      closeButtonSx={recordVaultPopupCloseSx}
    >
      <ColorTemplate7PopupLargeDark.Title>Bills / Receipts</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body spacing={1.25}>
        <Box
          onDragEnter={(e) => {
            if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDrop={(e) => {
            // Keep OS file drops inside this popup — never bubble to vault note attach.
            if (e.dataTransfer?.files?.length) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
        {error ? (
          <Typography sx={{ color: '#c62828', fontWeight: 700, mb: 1 }}>{error}</Typography>
        ) : null}
        {loading ? (
          <Typography sx={{ fontWeight: 700 }}>Loading…</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
              gap: 1.5,
              minHeight: { md: 420 },
              fontFamily: MAIN_FONT_FAMILY
            }}
          >
            {/* Left: large preview */}
            <Box
              sx={{
                border: '2px solid #000',
                borderRadius: 1,
                bgcolor: '#f5f5f5',
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-start' }}>
                <ColorTemplate13DisableGreenButton
                  type="button"
                  disabled={!selected || !paidRecordId}
                  onClick={() => {
                    if (!selected || !paidRecordId) return;
                    window.open(
                      paidRecordAttachmentDownloadUrl(paidRecordId, selected.attachmentId),
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                >
                  Download
                </ColorTemplate13DisableGreenButton>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                  minHeight: 0
                }}
              >
                {previewUrl && selected?.previewable ? (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt={selected.originalFileName || 'Receipt'}
                    sx={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }}
                  />
                ) : previewUrl ? (
                  <Typography sx={{ fontWeight: 700, textAlign: 'center', px: 2 }}>
                    {selected?.originalFileName || 'File'}
                    <br />
                    Preview not available — use Download.
                  </Typography>
                ) : (
                  <Typography sx={{ opacity: 0.55, fontWeight: 700 }}>
                    Select a receipt below
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Right: upload + QR + notes */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
              <Box
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleFiles(e.dataTransfer?.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: '2px dashed #000',
                  borderRadius: 1,
                  bgcolor: dragOver ? DROP_BG : 'rgba(74, 144, 217, 0.22)',
                  minHeight: 88,
                  cursor: busy || !paidRecordId ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2,
                  textAlign: 'center'
                }}
              >
                <Typography sx={{ fontWeight: 800 }}>
                  BILLS/RECEIPTS
                  <br />
                  <Box component="span" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    Click or drag &amp; drop to upload
                  </Box>
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
                  gap: 1,
                  alignItems: 'stretch'
                }}
              >
                <Box
                  sx={{
                    border: '2px solid #000',
                    borderRadius: 1,
                    p: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    bgcolor: '#fff'
                  }}
                >
                  {paidRecordId ? (
                    <ProfilePhotoUploadQrPanel
                      variant="inline"
                      purpose="bill_receipt"
                      paidRecordId={paidRecordId}
                      disabled={busy}
                      qrSize={148}
                      messageOverride={PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE}
                      onPhoneUploadComplete={async () => {
                        await reload();
                      }}
                      sx={{ maxWidth: 180 }}
                      messageSx={{ color: '#000', WebkitTextFillColor: '#000' }}
                    />
                  ) : null}
                </Box>
                <TextField
                  multiline
                  minRows={6}
                  fullWidth
                  value={notesText}
                  disabled={!paidRecordId || busy}
                  placeholder="Enter text notes here"
                  onChange={(e) => {
                    const v = e.target.value;
                    setNotesText(v);
                    persistNotes(v);
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#fff',
                      border: '2px solid #000',
                      borderRadius: 1,
                      fontFamily: MAIN_FONT_FAMILY,
                      fontWeight: 700
                    },
                    '& textarea': {
                      textAlign: 'center'
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}

        {/* Bottom thumbnails */}
        {!loading && attachments.length > 0 ? (
          <Box
            sx={{
              mt: 1.5,
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 0.5,
              borderTop: '2px solid #000',
              pt: 1
            }}
          >
            {attachments.map((att) => {
              const active = att.attachmentId === selectedId;
              const url = paidRecordId
                ? paidRecordAttachmentUrl(paidRecordId, att.attachmentId)
                : '';
              return (
                <Box
                  key={att.attachmentId}
                  sx={{
                    position: 'relative',
                    width: 88,
                    height: 88,
                    flexShrink: 0,
                    border: active ? '3px solid #2e7d32' : '2px solid #000',
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: '#ddd',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedId(att.attachmentId)}
                >
                  {att.previewable ? (
                    <Box
                      component="img"
                      src={url}
                      alt={att.originalFileName}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Typography
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        p: 0.5,
                        wordBreak: 'break-all'
                      }}
                    >
                      {att.originalFileName}
                    </Typography>
                  )}
                  <Box
                    component="button"
                    type="button"
                    aria-label="Remove attachment"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDelete(att.attachmentId);
                    }}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '1px solid #000',
                      bgcolor: '#e53935',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: '0.85rem',
                      lineHeight: 1,
                      cursor: 'pointer',
                      p: 0
                    }}
                  >
                    ×
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : null}
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

BillReceiptsPopup.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onChanged: PropTypes.func,
  ensurePayload: PropTypes.object,
  storageType: PropTypes.oneOf(['onedrive', 'usb'])
};
