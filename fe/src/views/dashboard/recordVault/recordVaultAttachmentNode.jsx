import { useCallback, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SliderControlButton from 'ui-component/SliderControlButton';
import BusyHourglass from 'ui-component/BusyHourglass';
import {
  canViewRecordVaultAttachment,
  canNativeOpenRecordVaultAttachment,
  extensionFromRecordVaultAttachment,
  formatRecordVaultFileSize,
  getRecordVaultAttachmentViewKind
} from 'utils/recordVaultFileFormats';
import {
  downloadRecordVaultNoteAttachment,
  openRecordVaultNoteAttachmentNative,
  isRecordVaultNativeOpenUnsupportedError,
  readRecordVaultApiError
} from 'api/recordVaultFe';
import { openRecordVaultAttachmentInNewWindow } from './openRecordVaultAttachmentWindow';

export const RECORD_VAULT_ATTACHMENT_NODE_NAME = 'recordVaultAttachment';

const VIEW_BUTTON_HOURGLASS_SIZE = { xs: '1.1rem', sm: '1.25rem' };
/** Keep launch hourglass visible after the desktop app opens. */
const LAUNCH_BUSY_HOLD_MS = 5000;

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

/**
 * React node view for an inline vault file. Renders the file name / size and the
 * Launch/View + Download + Remove controls. Runtime context (which note the file
 * belongs to, the storage type, the busy flag, and the server-delete handler) is
 * read from the editor's `recordVaultAttachment` storage, which the workspace pane
 * keeps in sync with the open note.
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

  const readContext = useCallback(() => editor?.storage?.[RECORD_VAULT_ATTACHMENT_NODE_NAME] || {}, [editor]);

  const label = String(attachment.file_name || `file.${attachment.file_extension || 'bin'}`);
  const sizeLabel = formatRecordVaultFileSize(attachment.file_size_bytes);
  const ext = extensionFromRecordVaultAttachment(attachment);
  const canView = canViewRecordVaultAttachment(ext);
  const launchesNative = canNativeOpenRecordVaultAttachment(ext);
  const actionLabel = launchesNative ? 'Launch' : 'View';
  const editable = Boolean(editor?.isEditable);

  const handleView = useCallback(async () => {
    const ctx = readContext();
    const noteId = Number(ctx.noteId);
    if (!Number.isFinite(noteId) || noteId < 1) return;
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || ctx.busy || viewingId != null) return;
    setError('');

    const viewKind = getRecordVaultAttachmentViewKind(ext);

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
  }, [readContext, attachmentId, viewingId, launchesNative, ext]);

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

  return (
    <NodeViewWrapper as="div" className="rv-attachment-node" data-drag-handle={editable ? '' : undefined}>
      <Box sx={wrapperSx} contentEditable={false}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 'inherit', wordBreak: 'break-word' }}>{label}</Typography>
          {sizeLabel ? <Typography sx={{ fontSize: '0.85em', opacity: 0.8 }}>{sizeLabel}</Typography> : null}
          {error ? (
            <Typography sx={{ color: 'var(--theme-error-color)', fontWeight: 600, fontSize: '0.85em' }}>{error}</Typography>
          ) : null}
        </Box>
        {canView ? (
          <SliderControlButton
            type="button"
            disabled={isViewing || (viewingId != null && viewingId !== attachmentId)}
            onClick={() => void handleView()}
            aria-label={isViewing ? (launchesNative ? `Launching ${label}` : `Opening ${label}`) : `${actionLabel} ${label}`}
            sx={{
              minWidth: 0,
              px: 1,
              py: 0.35,
              fontSize: '0.85em !important',
              minHeight: '1.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
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
