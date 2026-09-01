import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  fetchPaidRecordAttachmentBlob,
  getPaidRecordAttachmentPreviewKind,
  paidRecordAttachmentUrl
} from 'api/paidRecordFe';

const blobCache = new Map();
const thumbCache = new Map();
const docxHtmlCache = new Map();

function cacheKey(paidRecordId, attachmentId) {
  return `${paidRecordId}:${attachmentId}`;
}

function blobWithMime(blob, mime) {
  if (!mime || blob?.type === mime) return blob;
  return new Blob([blob], { type: mime });
}

async function loadBlob(paidRecordId, attachmentId) {
  const key = cacheKey(paidRecordId, attachmentId);
  if (blobCache.has(key)) return blobCache.get(key);
  const blob = await fetchPaidRecordAttachmentBlob(paidRecordId, attachmentId);
  blobCache.set(key, blob);
  return blob;
}

async function ensurePdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** First PDF page → JPEG data URL for strip thumbnails. */
async function pdfBlobToThumbDataUrl(blob, maxEdge = 176) {
  const pdfjs = await ensurePdfjs();
  const data = await blob.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = maxEdge / Math.max(base.width, base.height || 1);
  const viewport = page.getViewport({ scale: Math.max(0.2, scale) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function docxBlobToHtml(blob) {
  const mammoth = await import('mammoth');
  const arrayBuffer = await blob.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return String(result?.value || '') || '<p>(Empty document)</p>';
}

/**
 * Bills/Receipts attachment preview: images, PDF (iframe / page-1 thumb), DOCX (mammoth HTML).
 * @param {'preview'|'thumb'} mode
 */
export default function BillReceiptAttachmentPreview({
  paidRecordId,
  attachment,
  mode = 'preview',
  fitContainer = false
}) {
  const kind =
    attachment?.previewKind ||
    getPaidRecordAttachmentPreviewKind(attachment?.mimeType, attachment?.originalFileName);
  const attachmentId = attachment?.attachmentId;
  const label = attachment?.originalFileName || 'File';
  const imageUrl =
    kind === 'image' && paidRecordId && attachmentId
      ? paidRecordAttachmentUrl(paidRecordId, attachmentId)
      : '';

  const [objectUrl, setObjectUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [docxHtml, setDocxHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paidRecordId || !attachmentId || !kind || kind === 'image') {
      setObjectUrl('');
      setThumbUrl('');
      setDocxHtml('');
      setLoading(false);
      setError('');
      return undefined;
    }

    let cancelled = false;
    let ownedUrl = null;
    const key = cacheKey(paidRecordId, attachmentId);

    void (async () => {
      setLoading(true);
      setError('');
      try {
        if (kind === 'pdf' && mode === 'thumb') {
          if (thumbCache.has(key)) {
            if (!cancelled) setThumbUrl(thumbCache.get(key));
            return;
          }
          const blob = await loadBlob(paidRecordId, attachmentId);
          if (cancelled) return;
          const dataUrl = await pdfBlobToThumbDataUrl(blob);
          if (cancelled) return;
          thumbCache.set(key, dataUrl);
          setThumbUrl(dataUrl);
          return;
        }

        if (kind === 'pdf' && mode === 'preview') {
          const blob = await loadBlob(paidRecordId, attachmentId);
          if (cancelled) return;
          ownedUrl = URL.createObjectURL(blobWithMime(blob, 'application/pdf'));
          setObjectUrl(ownedUrl);
          return;
        }

        if (kind === 'docx') {
          if (docxHtmlCache.has(key)) {
            if (!cancelled) setDocxHtml(docxHtmlCache.get(key));
            return;
          }
          const blob = await loadBlob(paidRecordId, attachmentId);
          if (cancelled) return;
          const html = await docxBlobToHtml(blob);
          if (cancelled) return;
          docxHtmlCache.set(key, html);
          setDocxHtml(html);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Preview failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [paidRecordId, attachmentId, kind, mode]);

  if (!kind) {
    return (
      <Typography sx={{ fontWeight: 700, textAlign: 'center', px: 1, fontSize: mode === 'thumb' ? '0.65rem' : undefined }}>
        {label}
        {mode === 'preview' ? (
          <>
            <br />
            Preview not available — use Download.
          </>
        ) : null}
      </Typography>
    );
  }

  if (kind === 'image') {
    return (
      <Box
        component="img"
        src={imageUrl}
        alt={label}
        sx={
          mode === 'thumb'
            ? { width: '100%', height: '100%', objectFit: 'cover' }
            : fitContainer
              ? { width: '100%', height: '100%', maxHeight: '100%', objectFit: 'contain' }
              : { maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }
        }
      />
    );
  }

  if (loading && !objectUrl && !thumbUrl && !docxHtml) {
    return (
      <Typography sx={{ fontWeight: 700, opacity: 0.7, fontSize: mode === 'thumb' ? '0.65rem' : undefined }}>
        …
      </Typography>
    );
  }

  if (error && !objectUrl && !thumbUrl && !docxHtml) {
    return (
      <Typography
        sx={{
          fontWeight: 700,
          textAlign: 'center',
          px: 0.5,
          fontSize: mode === 'thumb' ? '0.6rem' : undefined
        }}
      >
        {mode === 'thumb' ? label : (
          <>
            {label}
            <br />
            Preview failed — use Download.
          </>
        )}
      </Typography>
    );
  }

  if (kind === 'pdf' && mode === 'thumb' && thumbUrl) {
    return (
      <Box
        component="img"
        src={thumbUrl}
        alt={label}
        sx={{ width: '100%', height: '100%', objectFit: 'cover', bgcolor: '#fff' }}
      />
    );
  }

  if (kind === 'pdf' && mode === 'preview' && objectUrl) {
    return (
      <Box
        component="iframe"
        title={label}
        src={objectUrl}
        sx={{
          width: '100%',
          height: fitContainer ? '100%' : 360,
          minHeight: fitContainer ? 120 : undefined,
          border: 0,
          display: 'block',
          bgcolor: '#fff'
        }}
      />
    );
  }

  if (kind === 'docx' && docxHtml) {
    if (mode === 'thumb') {
      return (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            bgcolor: '#fff',
            pointerEvents: 'none',
            position: 'relative'
          }}
        >
          <Box
            sx={{
              transform: 'scale(0.2)',
              transformOrigin: 'top left',
              width: 440,
              p: 1,
              color: '#000',
              fontSize: 14,
              lineHeight: 1.35,
              '& p': { m: '0 0 0.5em' },
              '& img': { maxWidth: '100%' }
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        </Box>
      );
    }
    return (
      <Box
        sx={{
          width: '100%',
          height: fitContainer ? '100%' : undefined,
          maxHeight: fitContainer ? '100%' : 360,
          overflow: 'auto',
          bgcolor: '#fff',
          color: '#000',
          p: 1.5,
          textAlign: 'left',
          fontSize: '0.9rem',
          lineHeight: 1.4,
          '& p': { m: '0 0 0.65em' },
          '& img': { maxWidth: '100%' },
          '& table': { borderCollapse: 'collapse', width: '100%' },
          '& td, & th': { border: '1px solid #999', p: 0.5 }
        }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: docxHtml }}
      />
    );
  }

  return (
    <Typography sx={{ fontWeight: 700, textAlign: 'center', px: 1, fontSize: mode === 'thumb' ? '0.65rem' : undefined }}>
      {label}
    </Typography>
  );
}

BillReceiptAttachmentPreview.propTypes = {
  paidRecordId: PropTypes.number,
  attachment: PropTypes.object,
  mode: PropTypes.oneOf(['preview', 'thumb']),
  fitContainer: PropTypes.bool
};
