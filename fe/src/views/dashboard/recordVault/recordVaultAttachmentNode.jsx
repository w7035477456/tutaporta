import { useCallback, useEffect, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SliderControlButton from 'ui-component/SliderControlButton';
import BusyHourglass from 'ui-component/BusyHourglass';
import {
  canViewRecordVaultAttachment,
  canInlinePreviewRecordVaultAttachment,
  canInlineVideoPreviewRecordVaultAttachment,
  canInlineTextPreviewRecordVaultAttachment,
  canNativeOpenRecordVaultAttachment,
  extensionFromRecordVaultAttachment,
  formatRecordVaultFileSize,
  getRecordVaultAttachmentViewKind
} from 'utils/recordVaultFileFormats';
import { captureVideoPreviewFrame } from 'utils/captureVideoPreviewFrame';
import {
  downloadRecordVaultNoteAttachment,
  fetchRecordVaultNoteAttachmentBlob,
  openRecordVaultNoteAttachmentNative,
  isRecordVaultNativeOpenUnsupportedError,
  readRecordVaultApiError
} from 'api/recordVaultFe';
import { trimSolidImageBorder } from 'utils/trimSolidImageBorder';
import { openRecordVaultAttachmentInNewWindow } from './openRecordVaultAttachmentWindow';

export const RECORD_VAULT_ATTACHMENT_NODE_NAME = 'recordVaultAttachment';

const VIEW_BUTTON_HOURGLASS_SIZE = { xs: '1.1rem', sm: '1.25rem' };
/** Keep launch hourglass visible after the desktop app opens. */
const LAUNCH_BUSY_HOLD_MS = 5000;
const INLINE_PREVIEW_NOTE_ID_RETRIES = 40;
const INLINE_PREVIEW_NOTE_ID_RETRY_MS = 100;
const INLINE_PDF_HEIGHT = { xs: '55vh', sm: '70vh' };
/** Cap huge text files so the note stays responsive. */
const INLINE_TEXT_PREVIEW_MAX_CHARS = 200_000;

const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  png: 'image/png'
};

const VIDEO_MIME_BY_EXT = {
  mp4: 'video/mp4',
  mov: 'video/quicktime'
};

const wrapperSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexWrap: 'wrap',
  p: 0.75,
  my: 0.5,
  borderRadius: 1,
  bgcolor: 'var(--theme-yellow-color)',
  color: '#000',
  border: '1px solid var(--theme-primary-color)',
  '& .MuiTypography-root': {
    color: '#000',
    WebkitTextFillColor: '#000'
  }
};

const inlineShellSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75,
  my: 0.5,
  p: 0.75,
  borderRadius: 1,
  bgcolor: 'var(--theme-yellow-color)',
  color: '#000',
  border: '1px solid var(--theme-primary-color)',
  '& .MuiTypography-root': {
    color: '#000',
    WebkitTextFillColor: '#000'
  }
};

const toolbarSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexWrap: 'wrap'
};

const actionBtnSx = {
  minWidth: 0,
  px: 1,
  py: 0.35,
  fontSize: '0.85em !important',
  minHeight: '1.75rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

function blobWithMime(blob, mime) {
  if (!mime || blob?.type === mime) return blob;
  return new Blob([blob], { type: mime });
}

/**
 * React node view for an inline vault file. PDF / jpg / jpeg / gif / bmp / png /
 * mp4 / mov / txt (and other text types) render on the note page (videos show a
 * visible frame); other types keep the yellow bar with Launch/View + Download +
 * Remove. Runtime context is read from editor storage.
 */
function RecordVaultAttachmentNodeView({ node, editor, deleteNode }) {
  const attachmentId = Number(node?.attrs?.attachmentId);
  const attachment = {
    attachment_id: attachmentId,
    file_name: node?.attrs?.fileName || '',
    file_extension: node?.attrs?.fileExtension || '',
    file_size_bytes: node?.attrs?.fileSizeBytes ?? null
  };

  const [viewingId, setViewingId] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [videoFrameUrl, setVideoFrameUrl] = useState('');
  const [previewText, setPreviewText] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const readContext = useCallback(() => editor?.storage?.[RECORD_VAULT_ATTACHMENT_NODE_NAME] || {}, [editor]);

  const label = String(attachment.file_name || `file.${attachment.file_extension || 'bin'}`);
  const sizeLabel = formatRecordVaultFileSize(attachment.file_size_bytes);
  const ext = extensionFromRecordVaultAttachment(attachment);
  const viewKind = getRecordVaultAttachmentViewKind(ext);
  const showInlinePreview = canInlinePreviewRecordVaultAttachment(ext);
  const showInlineVideoFrame = canInlineVideoPreviewRecordVaultAttachment(ext);
  const showInlineText = canInlineTextPreviewRecordVaultAttachment(ext);
  const canView = canViewRecordVaultAttachment(ext);
  const launchesNative = canNativeOpenRecordVaultAttachment(ext);
  const actionLabel = launchesNative ? 'Launch' : 'View';
  const editable = Boolean(editor?.isEditable);

  useEffect(() => {
    if (!showInlinePreview) return undefined;
    let cancelled = false;
    let ownedObjectUrl = null;
    let ownedFrameUrl = null;
    let attempts = 0;
    let retryTimer = null;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const load = async () => {
      const ctx = readContext();
      const noteId = Number(ctx.noteId);
      if (!Number.isFinite(noteId) || noteId < 1) {
        if (attempts++ < INLINE_PREVIEW_NOTE_ID_RETRIES) {
          retryTimer = setTimeout(() => {
            void load();
          }, INLINE_PREVIEW_NOTE_ID_RETRY_MS);
        } else if (!cancelled) {
          setPreviewLoading(false);
          setPreviewError('Note was not ready — cannot load preview');
        }
        return;
      }
      if (!Number.isFinite(attachmentId) || attachmentId < 1) {
        if (!cancelled) {
          setPreviewLoading(false);
          setPreviewError('Invalid attachment id');
        }
        return;
      }

      if (!cancelled) {
        setPreviewLoading(true);
        setPreviewError('');
        setVideoFrameUrl('');
        setPreviewText(null);
      }

      try {
        const blob = await fetchRecordVaultNoteAttachmentBlob(noteId, attachmentId, {
          inline: true,
          storageType: ctx.storageType
        });
        if (cancelled) return;
        if (!blob) {
          setPreviewUrl('');
          setVideoFrameUrl('');
          setPreviewText(null);
          setPreviewError('Attachment returned no data');
          return;
        }

        if (showInlineText) {
          let text = await blob.text();
          if (cancelled) return;
          if (text.length > INLINE_TEXT_PREVIEW_MAX_CHARS) {
            text = `${text.slice(0, INLINE_TEXT_PREVIEW_MAX_CHARS)}\n\n… [truncated — open View for full file]`;
          }
          setPreviewUrl('');
          setVideoFrameUrl('');
          setPreviewText(text);
          setPreviewError('');
          return;
        }

        let previewBlob = blob;
        if (viewKind === 'pdf') {
          previewBlob = blobWithMime(blob, 'application/pdf');
        } else if (viewKind === 'image') {
          const mime = IMAGE_MIME_BY_EXT[ext] || blob.type || 'image/*';
          const typed = blobWithMime(blob, mime);
          try {
            previewBlob = blobWithMime(await trimSolidImageBorder(typed), mime);
          } catch {
            previewBlob = typed;
          }
        } else if (showInlineVideoFrame) {
          previewBlob = blobWithMime(blob, VIDEO_MIME_BY_EXT[ext] || blob.type || 'video/mp4');
        }

        if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
        ownedObjectUrl = URL.createObjectURL(previewBlob);

        if (showInlineVideoFrame) {
          const frameUrl = await captureVideoPreviewFrame(ownedObjectUrl);
          // Frame JPEG is enough for the still — drop the full video blob from memory.
          if (ownedObjectUrl) {
            URL.revokeObjectURL(ownedObjectUrl);
            ownedObjectUrl = null;
          }
          if (cancelled) {
            if (frameUrl) URL.revokeObjectURL(frameUrl);
            return;
          }
          if (ownedFrameUrl) URL.revokeObjectURL(ownedFrameUrl);
          ownedFrameUrl = frameUrl;
          if (!frameUrl) {
            setPreviewUrl('');
            setVideoFrameUrl('');
            setPreviewText(null);
            setPreviewError('Could not find a visible video frame — use View');
            return;
          }
          setPreviewUrl('');
          setVideoFrameUrl(frameUrl);
          setPreviewText(null);
          setPreviewError('');
          return;
        }

        if (!cancelled) {
          setPreviewUrl(ownedObjectUrl);
          setVideoFrameUrl('');
          setPreviewText(null);
          setPreviewError('');
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewUrl('');
          setVideoFrameUrl('');
          setPreviewText(null);
          setPreviewError(readRecordVaultApiError(err, 'Could not load preview'));
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    setPreviewLoading(true);
    void load();

    return () => {
      cancelled = true;
      clearRetry();
      if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
      if (ownedFrameUrl) URL.revokeObjectURL(ownedFrameUrl);
    };
  }, [showInlinePreview, showInlineVideoFrame, showInlineText, attachmentId, editor, readContext, viewKind, ext]);

  const handleView = useCallback(async () => {
    const ctx = readContext();
    const noteId = Number(ctx.noteId);
    if (!Number.isFinite(noteId) || noteId < 1) return;
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || ctx.busy || viewingId != null) return;
    setError('');

    // Open the preview window synchronously on click (before any await) so blockers allow it.
    let previewWin = null;
    if (!launchesNative) {
      previewWin = window.open('', '_blank');
      if (!previewWin) {
        setError('Pop-up blocked — allow pop-ups to view files in a new window');
        return;
      }
    }

    if (launchesNative) {
      setViewingId(attachmentId);
      setViewerLoading(true);
      try {
        await openRecordVaultNoteAttachmentNative(noteId, attachmentId);
        await new Promise((resolve) => setTimeout(resolve, LAUNCH_BUSY_HOLD_MS));
        return;
      } catch (err) {
        if (!isRecordVaultNativeOpenUnsupportedError(err)) {
          setError(readRecordVaultApiError(err, 'Could not open in desktop app'));
          if (viewKind === 'legacy-office') return;
        }
        previewWin = window.open('', '_blank');
        if (!previewWin) {
          setError('Pop-up blocked — allow pop-ups to view files in a new window');
          return;
        }
      } finally {
        setViewingId(null);
        setViewerLoading(false);
      }
    }

    setViewingId(attachmentId);
    setViewerLoading(true);
    try {
      await openRecordVaultAttachmentInNewWindow({
        noteId,
        attachment,
        storageType: ctx.storageType,
        win: previewWin
      });
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Could not open file in a new window'));
    } finally {
      setViewingId(null);
      setViewerLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readContext, attachmentId, viewingId, launchesNative, ext, viewKind]);

  const handleDownload = useCallback(async () => {
    const ctx = readContext();
    const noteId = Number(ctx.noteId);
    if (!Number.isFinite(noteId) || noteId < 1) return;
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || downloading) return;
    setError('');
    setDownloading(true);
    try {
      await downloadRecordVaultNoteAttachment(noteId, attachmentId, label, {
        storageType: ctx.storageType
      });
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Download failed'));
    } finally {
      setDownloading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readContext, attachmentId, downloading, label]);

  const handleRemove = useCallback(async () => {
    const ctx = readContext();
    if (removing || ctx.busy) return;
    setError('');
    setRemoving(true);
    try {
      const onServerDelete = ctx.onServerDelete;
      const ok = onServerDelete ? await onServerDelete(attachmentId) : true;
      if (ok) {
        deleteNode();
      } else {
        setError('Failed to remove vault file');
      }
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to remove vault file'));
    } finally {
      setRemoving(false);
    }
  }, [readContext, removing, attachmentId, deleteNode]);

  const isViewing = viewingId === attachmentId && viewerLoading;

  const toolbar = (
    <Box sx={showInlinePreview ? toolbarSx : { display: 'contents' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 'inherit', wordBreak: 'break-word' }}>{label}</Typography>
        {sizeLabel ? <Typography sx={{ fontSize: '0.85em', opacity: 0.8 }}>{sizeLabel}</Typography> : null}
        {error ? (
          <Typography sx={{ color: 'var(--theme-error-color)', fontWeight: 600, fontSize: '0.85em' }}>{error}</Typography>
        ) : null}
        {showInlinePreview && previewError ? (
          <Typography sx={{ color: 'var(--theme-error-color)', fontWeight: 600, fontSize: '0.85em' }}>
            {previewError}
          </Typography>
        ) : null}
      </Box>
      {canView ? (
        <SliderControlButton
          type="button"
          disabled={isViewing || (viewingId != null && viewingId !== attachmentId)}
          onClick={() => void handleView()}
          aria-label={isViewing ? (launchesNative ? `Launching ${label}` : `Opening ${label}`) : `${actionLabel} ${label}`}
          sx={actionBtnSx}
        >
          {isViewing ? (
            <BusyHourglass fontSize={VIEW_BUTTON_HOURGLASS_SIZE} sx={{ filter: 'none', WebkitFilter: 'none' }} />
          ) : (
            actionLabel
          )}
        </SliderControlButton>
      ) : null}
      <SliderControlButton
        type="button"
        disabled={downloading}
        onClick={() => void handleDownload()}
        sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.85em !important' }}
      >
        {downloading ? 'Downloading…' : 'Download'}
      </SliderControlButton>
      {editable ? (
        <SliderControlButton
          type="button"
          disabled={removing}
          onClick={() => void handleRemove()}
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.35,
            fontSize: '0.85em !important',
            bgcolor: 'var(--theme-error-color) !important',
            color: '#fff !important',
            WebkitTextFillColor: '#fff !important'
          }}
        >
          {removing ? 'Removing…' : 'Remove'}
        </SliderControlButton>
      ) : null}
    </Box>
  );

  if (showInlinePreview) {
    return (
      <NodeViewWrapper as="div" className="rv-attachment-node" data-drag-handle={editable ? '' : undefined}>
        <Box sx={inlineShellSx} contentEditable={false}>
          {toolbar}
          <Box
            sx={{
              width: '100%',
              borderRadius: 1,
              overflow: showInlineText ? 'auto' : 'hidden',
              bgcolor: showInlineText ? '#fff' : '#111',
              border: '1px solid var(--theme-primary-color)',
              minHeight: viewKind === 'pdf' ? INLINE_PDF_HEIGHT : '8rem',
              maxHeight: showInlineText ? { xs: '40vh', sm: '50vh' } : undefined,
              display: 'flex',
              alignItems: showInlineText ? 'stretch' : 'center',
              justifyContent: showInlineText ? 'flex-start' : 'center'
            }}
          >
            {previewLoading && !previewUrl && !videoFrameUrl && previewText == null ? (
              <BusyHourglass fontSize={{ xs: '1.5rem', sm: '1.75rem' }} sx={{ filter: 'none', WebkitFilter: 'none' }} />
            ) : null}
            {!previewLoading && previewError && !previewUrl && !videoFrameUrl && previewText == null ? (
              <Typography sx={{ color: showInlineText ? '#000' : '#fff', p: 2, textAlign: 'center', fontSize: '0.9em' }}>
                Preview unavailable — use View or Download
              </Typography>
            ) : null}
            {previewUrl && viewKind === 'pdf' ? (
              <Box
                component="iframe"
                title={label}
                src={previewUrl}
                sx={{
                  width: '100%',
                  height: INLINE_PDF_HEIGHT,
                  border: 0,
                  display: 'block',
                  bgcolor: '#fff'
                }}
              />
            ) : null}
            {previewUrl && viewKind === 'image' ? (
              <Box
                component="img"
                src={previewUrl}
                alt={label}
                sx={{
                  width: '100%',
                  maxHeight: { xs: '55vh', sm: '70vh' },
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: 'block',
                  bgcolor: '#111'
                }}
              />
            ) : null}
            {showInlineVideoFrame && videoFrameUrl ? (
              <Box
                component="img"
                src={videoFrameUrl}
                alt={`${label} preview frame`}
                sx={{
                  width: '100%',
                  maxHeight: { xs: '40vh', sm: '50vh' },
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: 'block',
                  bgcolor: '#000'
                }}
              />
            ) : null}
            {showInlineText && previewText != null ? (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.9em',
                  lineHeight: 1.45,
                  color: '#111',
                  bgcolor: '#fff'
                }}
              >
                {previewText === '' ? ' ' : previewText}
              </Box>
            ) : null}
          </Box>
        </Box>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="rv-attachment-node" data-drag-handle={editable ? '' : undefined}>
      <Box sx={wrapperSx} contentEditable={false}>
        {toolbar}
      </Box>
    </NodeViewWrapper>
  );
}

function attrToData(value, key) {
  return value == null || value === '' ? {} : { [key]: String(value) };
}

/**
 * Block-level atom node that embeds a vault file reference (by attachment id)
 * directly in the note body, so dropped files appear inline where they are
 * dropped instead of in a separate list. The file bytes still live server-side
 * keyed by the attachment id; only lightweight metadata is serialized here.
 */
export const RecordVaultAttachmentNode = Node.create({
  name: RECORD_VAULT_ATTACHMENT_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addStorage() {
    return { noteId: null, storageType: 'usb', busy: false, onServerDelete: null };
  },

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-attachment-id'),
        renderHTML: (attrs) => attrToData(attrs.attachmentId, 'data-attachment-id')
      },
      fileName: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-file-name') || '',
        renderHTML: (attrs) => attrToData(attrs.fileName, 'data-file-name')
      },
      fileExtension: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-file-extension') || '',
        renderHTML: (attrs) => attrToData(attrs.fileExtension, 'data-file-extension')
      },
      fileSizeBytes: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-file-size');
          const n = raw == null ? NaN : Number(raw);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => attrToData(attrs.fileSizeBytes, 'data-file-size')
      }
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-rv-attachment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-rv-attachment': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RecordVaultAttachmentNodeView);
  }
});

export default RecordVaultAttachmentNode;
