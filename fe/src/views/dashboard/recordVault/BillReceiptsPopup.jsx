import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import ProfilePhotoUploadQrPanel, {
  PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE
} from 'components/ProfilePhotoUploadQrPanel';
import dragDropClickUploadImg from 'assets/images/dragDropClickUpload.png';
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
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
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
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
};

const sectionHeaderSx = {
  flexShrink: 0,
  bgcolor: '#000',
  color: '#fff',
  WebkitTextFillColor: '#fff',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: '0.95rem',
  letterSpacing: 0.4,
  textAlign: 'center',
  py: 0.6,
  px: 1,
  borderBottom: '2px solid #000'
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
 * Bills/Receipts popup — four equal quadrants (50/50 × 50/50):
 * Notes | BILLS/RECEIPTS upload+thumbs
 * Preview+Download | Phone QR
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
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [skipToast, setSkipToast] = useState('');
  const [paidRecordId, setPaidRecordId] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOver, setDragOver] = useState(false);

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
  const uploadDisabled = !paidRecordId || busy;

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
              <Typography sx={{ color: '#c62828', fontWeight: 700, mb: 1, flexShrink: 0 }}>{error}</Typography>
            ) : null}
            {loading ? (
              <Typography sx={{ fontWeight: 700 }}>Loading…</Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gridTemplateRows: { xs: 'auto', md: '1fr 1fr' },
                  gap: 1.5,
                  flex: 1,
                  minHeight: { xs: 640, md: 0 },
                  height: { md: '100%' },
                  fontFamily: MAIN_FONT_FAMILY
                }}
              >
                {/* Top-left: Notes */}
                <Box sx={{ ...quadrantSx, ...lightSurfaceTextSx, bgcolor: '#fff' }}>
                  <Box component="div" sx={sectionHeaderSx}>
                    notes
                  </Box>
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
                      minHeight: 0,
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

                {/* Top-right: BILLS/RECEIPTS upload + thumbnails */}
                <Box sx={{ ...quadrantSx, bgcolor: 'var(--theme-secondary-color)' }}>
                  <Box
                    component="div"
                    sx={{
                      ...sectionHeaderSx,
                      bgcolor: 'var(--theme-primary-color)',
                      borderBottomColor: '#000'
                    }}
                  >
                    BILLS/RECEIPTS
                  </Box>
                  <Box
                    className="bill-receipts-upload-drop"
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!uploadDisabled) setDragOver(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!uploadDisabled) setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOver(false);
                      if (uploadDisabled) return;
                      void handleFiles(e.dataTransfer?.files);
                    }}
                    onClick={() => {
                      if (uploadDisabled) return;
                      fileInputRef.current?.click();
                    }}
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: uploadDisabled ? 'default' : 'pointer',
                      bgcolor: dragOver ? 'var(--theme-daynight-color)' : 'transparent',
                      px: 1,
                      py: 1,
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {busy ? (
                      <CircularProgress size={40} sx={{ color: 'var(--theme-primary-color)' }} />
                    ) : (
                      <Box
                        component="img"
                        src={dragDropClickUploadImg}
                        alt="Drag and drop or click to upload bills or receipts"
                        sx={{
                          maxWidth: 'min(100%, 160px)',
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                          userSelect: 'none',
                          transition: 'transform 0.15s ease',
                          '@media (hover: hover)': {
                            '.bill-receipts-upload-drop:hover &': {
                              transform: `scale(${getHoverMagnifyFactor()})`
                            }
                          }
                        }}
                      />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      multiple
                      hidden
                      onChange={(e) => {
                        void handleFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </Box>
                  {attachments.length > 0 ? (
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        overflowX: 'auto',
                        borderTop: '2px solid #000',
                        pt: 1,
                        pb: 1,
                        px: 1,
                        flexShrink: 0,
                        bgcolor: '#fff',
                        ...lightSurfaceTextSx
                      }}
                    >
                      {attachments.map((att) => {
                        const active = att.attachmentId === selectedId;
                        return (
                          <Box
                            key={att.attachmentId}
                            sx={{
                              position: 'relative',
                              width: 64,
                              height: 64,
                              flexShrink: 0,
                              border: active ? '3px solid #2e7d32' : '2px solid #000',
                              borderRadius: 1,
                              overflow: 'hidden',
                              bgcolor: '#ddd',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(att.attachmentId);
                            }}
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
                                  fontSize: '0.6rem',
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
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '1px solid #000',
                                bgcolor: '#e53935',
                                color: '#fff',
                                fontWeight: 900,
                                fontSize: '0.8rem',
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

                {/* Bottom-left: Preview + Download */}
                <Box sx={{ ...quadrantSx, ...lightSurfaceTextSx, bgcolor: '#f5f5f5' }}>
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
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <BillReceiptAttachmentPreview
                          paidRecordId={paidRecordId}
                          attachment={selected}
                          mode="preview"
                          fitContainer
                        />
                      </Box>
                    ) : (
                      <Typography sx={{ color: 'rgba(0, 0, 0, 0.55)', fontWeight: 700 }}>
                        Select a receipt above
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
                </Box>

                {/* Bottom-right: Phone QR */}
                <Box
                  sx={{
                    ...quadrantSx,
                    bgcolor: 'var(--theme-secondary-color)',
                    p: 1,
                    boxSizing: 'border-box'
                  }}
                >
                  <ProfilePhotoUploadQrPanel
                    variant="inline"
                    purpose="bill_receipt"
                    paidRecordId={paidRecordId}
                    disabled={busy || !paidRecordId}
                    messageOverride={PROFILE_PHOTO_UPLOAD_QR_INLINE_MESSAGE}
                    onPhoneUploadComplete={async () => {
                      await reload();
                    }}
                    messageSx={{
                      fontFamily: MAIN_FONT_FAMILY,
                      color: 'var(--theme-primary-color)'
                    }}
                    sx={{
                      flex: 1,
                      width: '100%',
                      minHeight: 0,
                      height: '100%'
                    }}
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
