import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import MyStoryUploadQrPair from 'components/MyStoryUploadQrPair';
import { PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE } from 'components/ProfilePhotoUploadQrPanel';
import {
  deletePaidRecordAttachment,
  ensurePaidRecord,
  fetchPaidRecord,
  paidRecordAttachmentDownloadUrl,
  savePaidRecordNotes,
  uploadPaidRecordAttachment
} from 'api/paidRecordFe';
import { recordVaultPopupCloseSx } from './recordVaultPopupCloseSx';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import BillReceiptAttachmentPreview from './BillReceiptAttachmentPreview';

const SKIP_DUPLICATE_MESSAGE = 'Skipping upload duplicate file';
const SKIP_DUPLICATE_TOAST_MS = 3000;

const BILL_RECEIPTS_POPUP_HEIGHT = '88vh';

const billReceiptsPopupShellSx = {
  height: BILL_RECEIPTS_POPUP_HEIGHT,
  maxHeight: BILL_RECEIPTS_POPUP_HEIGHT,
  minHeight: BILL_RECEIPTS_POPUP_HEIGHT,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const quadrantSx = {
  border: '2px solid #000',
  borderRadius: 1,
  overflow: 'hidden',
  minWidth: 0,
  minHeight: 0
};

const lightSurfaceTextSx = {
  color: '#000',
  WebkitTextFillColor: '#000',
  '& .MuiTypography-root': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important'
  }
};

/**
 * Bills/Receipts popup (ColorTemplate16PopupCenterWide): notes+preview | MyStory upload+QR.
 */
export default function BillReceiptsPopup({
  open,
  onClose,
  onChanged,
  ensurePayload,
  storageType = 'onedrive'
}) {
  const notesTimerRef = useRef(null);
  const skipToastTimerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [skipToast, setSkipToast] = useState('');
  const [paidRecordId, setPaidRecordId] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const showSkipDuplicateToast = useCallback((message = SKIP_DUPLICATE_MESSAGE) => {
    const text = String(message || SKIP_DUPLICATE_MESSAGE).trim() || SKIP_DUPLICATE_MESSAGE;
    setSkipToast(text);
    if (skipToastTimerRef.current) window.clearTimeout(skipToastTimerRef.current);
    skipToastTimerRef.current = window.setTimeout(() => {
      skipToastTimerRef.current = null;
      setSkipToast('');
    }, SKIP_DUPLICATE_TOAST_MS);
  }, []);

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
      if (skipToastTimerRef.current) window.clearTimeout(skipToastTimerRef.current);
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

  const flushNotesNow = useCallback(async () => {
    if (notesTimerRef.current) {
      window.clearTimeout(notesTimerRef.current);
      notesTimerRef.current = null;
    }
    if (!paidRecordId) return;
    try {
      const data = await savePaidRecordNotes(paidRecordId, notesText);
      applyPayload(data);
      onChanged?.(data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save notes');
    }
  }, [applyPayload, notesText, onChanged, paidRecordId]);

  const handleClose = useCallback(async () => {
    await flushNotesNow();
    onClose?.();
  }, [flushNotesNow, onClose]);

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
            skipNotes.push(SKIP_DUPLICATE_MESSAGE);
            continue;
          }
        }
        // eslint-disable-next-line no-await-in-loop
        last = await uploadPaidRecordAttachment(paidRecordId, file);
        if (last?.skipped) {
          skipNotes.push(last.skipMessage || SKIP_DUPLICATE_MESSAGE);
        }
      }
      if (last) {
        applyPayload(last);
        onChanged?.(last);
        if (last.uploadedAttachmentId && !last.skipped) setSelectedId(last.uploadedAttachmentId);
      }
      if (skipNotes.length) {
        showSkipDuplicateToast(skipNotes[0]);
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

  return (
    <>
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={() => void handleClose()}
      closeOnBackdrop
      closeButtonAriaLabel="Close bills receipts"
      closeButtonSx={recordVaultPopupCloseSx}
      resizable
      defaultResizeHeight={BILL_RECEIPTS_POPUP_HEIGHT}
      maxResizeHeight={BILL_RECEIPTS_POPUP_HEIGHT}
      panelShellSx={billReceiptsPopupShellSx}
      contentSx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <ColorTemplate16PopupCenterWide.Title>Bills / Receipts</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body
        spacing={1.25}
        sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <Box
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
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
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 1.5,
              flex: 1,
              minHeight: { xs: 480, md: 0 },
              fontFamily: MAIN_FONT_FAMILY
            }}
          >
            {/* Left: notes + preview/download/thumbnails */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                minHeight: { xs: 'auto', md: 0 },
                minWidth: 0
              }}
            >
              <Box
                sx={{
                  ...quadrantSx,
                  ...lightSurfaceTextSx,
                  bgcolor: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: { xs: '0 0 auto', md: '1 1 0' },
                  minHeight: { xs: 140, md: 0 }
                }}
              >
                <TextField
                  multiline
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
                    flex: 1,
                    display: 'flex',
                    '& .MuiOutlinedInput-root': {
                      height: '100%',
                      alignItems: 'stretch',
                      bgcolor: '#fff',
                      border: 'none',
                      borderRadius: 0,
                      fontFamily: MAIN_FONT_FAMILY,
                      fontWeight: 700,
                      color: '#000',
                      WebkitTextFillColor: '#000'
                    },
                    '& fieldset': { border: 'none' },
                    '& textarea': {
                      height: '100% !important',
                      overflow: 'auto !important',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      color: '#000 !important',
                      WebkitTextFillColor: '#000 !important'
                    },
                    '& textarea::placeholder': {
                      color: 'rgba(0, 0, 0, 0.45)',
                      opacity: 1
                    }
                  }}
                />
              </Box>

              <Box
                sx={{
                  ...quadrantSx,
                  ...lightSurfaceTextSx,
                  bgcolor: '#f5f5f5',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: { xs: '0 0 auto', md: '1 1 0' },
                  minHeight: { xs: 280, md: 0 }
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1,
                    minHeight: 0,
                    overflow: 'hidden'
                  }}
                >
                  {selected && paidRecordId ? (
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BillReceiptAttachmentPreview
                        paidRecordId={paidRecordId}
                        attachment={selected}
                        mode="preview"
                        fitContainer
                      />
                    </Box>
                  ) : (
                    <Typography sx={{ color: 'rgba(0, 0, 0, 0.55)', fontWeight: 700 }}>
                      Select a receipt below
                    </Typography>
                  )}
                </Box>
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
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
                {attachments.length > 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      overflowX: 'auto',
                      pb: 0.5,
                      borderTop: '2px solid #000',
                      pt: 1,
                      px: 1,
                      flexShrink: 0
                    }}
                  >
                    {attachments.map((att) => {
                      const active = att.attachmentId === selectedId;
                      return (
                        <Box
                          key={att.attachmentId}
                          sx={{
                            position: 'relative',
                            width: 72,
                            height: 72,
                            flexShrink: 0,
                            border: active ? '3px solid #2e7d32' : '2px solid #000',
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: '#ddd',
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedId(att.attachmentId)}
                        >
                          {att.previewable || att.previewKind ? (
                            <BillReceiptAttachmentPreview
                              paidRecordId={paidRecordId}
                              attachment={att}
                              mode="thumb"
                            />
                          ) : (
                            <Typography
                              sx={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                p: 0.5,
                                wordBreak: 'break-all',
                                color: '#000 !important',
                                WebkitTextFillColor: '#000 !important'
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
            </Box>

            {/* Right: My Album & Posts upload + phone QR (borrowed from /myStory) */}
            <Box
              sx={{
                minHeight: { xs: 'auto', md: 0 },
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'stretch'
              }}
            >
              <MyStoryUploadQrPair
                onFiles={(fileList) => void handleFiles(fileList)}
                uploading={busy}
                disabled={!paidRecordId}
                accept="image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                purpose="bill_receipt"
                paidRecordId={paidRecordId}
                qrMessageOverride={PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE}
                onPhoneUploadComplete={async () => {
                  await reload();
                }}
                sx={{ flex: 1, minHeight: { md: 0 } }}
              />
            </Box>
          </Box>
        )}

        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(skipToast)}
        onClose={() => {
          if (skipToastTimerRef.current) {
            window.clearTimeout(skipToastTimerRef.current);
            skipToastTimerRef.current = null;
          }
          setSkipToast('');
        }}
        closeOnBackdrop
        showCloseButton={false}
        closeButtonAriaLabel="Close skip duplicate notice"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>Bills / Receipts</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>{skipToast}</ColorTemplate16PopupCenterWide.BodyText>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}

BillReceiptsPopup.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onChanged: PropTypes.func,
  ensurePayload: PropTypes.object,
  storageType: PropTypes.oneOf(['onedrive', 'usb'])
};
