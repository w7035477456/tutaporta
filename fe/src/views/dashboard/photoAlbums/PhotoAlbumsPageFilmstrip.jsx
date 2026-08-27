import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import { PHOTO_ALBUMS_ATTACHMENT_NODE_NAME } from './photoAlbumsAttachmentNode';
import {
  getPhotoAlbumsPageTemplate,
  resolveAlbumTemplateSlots
} from './photoAlbumsPageTemplates';
import { getPhotoAlbumsAttachmentViewKind } from 'utils/photoAlbumsFileFormats';
import leftArrowImg from 'assets/images/leftarrow.png';
import rightArrowImg from 'assets/images/rightarrow.png';

const THUMB_H_PX = 96;
const ACTIVE_BORDER = '4px solid #e53935';
const IDLE_BORDER = '2px solid #333';

function parseOptionalPx(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function templateBand(inst, pageWidthFallback = 480) {
  const w = inst?.w > 0 ? inst.w : pageWidthFallback;
  const h = inst?.h > 0 ? inst.h : Math.round(w * 1.2);
  return {
    left: inst?.x || 0,
    top: inst?.y || 0,
    width: w,
    height: h
  };
}

function pointInBand(cx, cy, band) {
  return (
    cx >= band.left &&
    cx <= band.left + band.width &&
    cy >= band.top &&
    cy <= band.top + band.height
  );
}

/**
 * Build lightweight page preview models (slot outlines + photo rects) for the filmstrip.
 */
export function buildAlbumPageFilmstripModels(editor, pages, pageWidth) {
  const list = Array.isArray(pages) ? pages : [];
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));

  if (!list.length) {
    return [
      {
        key: 'empty-page',
        slots: [],
        photos: []
      }
    ];
  }

  return list.map((inst) => {
    const band = templateBand(inst, pw);
    const layout = getPhotoAlbumsPageTemplate(inst.id);
    const slots = layout ? resolveAlbumTemplateSlots(layout, inst.slots) : [];
    const photos = [];

    if (editor?.state?.doc) {
      editor.state.doc.descendants((node) => {
        if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
        const attachmentId = Number(node.attrs.attachmentId);
        if (!Number.isFinite(attachmentId) || attachmentId < 1) return;

        const frameLeft = parseOptionalPx(node.attrs.frameLeft);
        const frameTop = parseOptionalPx(node.attrs.frameTop);
        const frameWidth = parseOptionalPx(node.attrs.frameWidth);
        const frameHeight = parseOptionalPx(node.attrs.frameHeight);
        const posLeft = parseOptionalPx(node.attrs.posLeft);
        const posTop = parseOptionalPx(node.attrs.posTop);
        const width = parseOptionalPx(node.attrs.width);
        const height = parseOptionalPx(node.attrs.height);

        const left = frameLeft ?? posLeft;
        const top = frameTop ?? posTop;
        const w = frameWidth ?? width;
        const h = frameHeight ?? height;
        if (left == null || top == null || w == null || h == null) return;

        const cx = left + w / 2;
        const cy = top + h / 2;
        if (!pointInBand(cx, cy, band)) return;

        const ext = String(node.attrs.fileExtension || '');
        const kind = getPhotoAlbumsAttachmentViewKind(ext);
        const isPhoto = kind === 'image';
        const isAlbumVideo = kind === 'video' && ext.replace(/^\./, '').toLowerCase() === 'mp4';
        photos.push({
          attachmentId,
          isPhoto,
          isAlbumVideo,
          isAlbumMedia: isPhoto || isAlbumVideo,
          x: ((left - band.left) / Math.max(1, band.width)) * 100,
          y: ((top - band.top) / Math.max(1, band.height)) * 100,
          w: (w / Math.max(1, band.width)) * 100,
          h: (h / Math.max(1, band.height)) * 100
        });
      });
    }

    return {
      key: String(inst.key || inst.id || 'page'),
      slots,
      photos
    };
  });
}

function FilmstripPhoto({ attachmentId, noteId, storageType, isVideo = false }) {
  const hostRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [url, setUrl] = useState('');
  const objectUrlRef = useRef('');

  // Path A: only fetch filmstrip thumbs that scroll into view (stateless blob GETs).
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const root = el.closest('.rv-album-page-filmstrip__scroll');
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) setInView(true);
      },
      {
        root: root instanceof Element ? root : null,
        rootMargin: '120px',
        threshold: 0.01
      }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const nid = Number(noteId);
    const aid = Number(attachmentId);
    if (!inView || !Number.isFinite(aid) || aid < 1 || !Number.isFinite(nid) || nid < 1) {
      if (!inView) {
        setUrl('');
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = '';
        }
      }
      return undefined;
    }
    (async () => {
      try {
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, aid, {
          inline: true,
          storageType,
          variant: 'thumb'
        });
        if (cancelled || !blob) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const next = URL.createObjectURL(blob);
        objectUrlRef.current = next;
        setUrl(next);
      } catch {
        if (!cancelled) setUrl('');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [inView, attachmentId, noteId, storageType]);

  return (
    <Box
      ref={hostRef}
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: url ? 'transparent' : '#cfd8dc'
      }}
    >
      {url ? (
        isVideo ? (
          <Box
            component="video"
            src={url}
            muted
            playsInline
            preload="metadata"
            draggable={false}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none',
              bgcolor: '#000'
            }}
          />
        ) : (
          <Box
            component="img"
            src={url}
            alt=""
            draggable={false}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none'
            }}
          />
        )
      ) : null}
    </Box>
  );
}

FilmstripPhoto.propTypes = {
  attachmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  isVideo: PropTypes.bool
};

export function PageThumb({
  model,
  pageNumber,
  pageIndex,
  active,
  orientation,
  noteId,
  storageType,
  onSelect,
  heightPx = THUMB_H_PX,
  draggablePage = false,
  onPageDragStart,
  onPageDragEnd,
  /** When set, shows a red × to delete this page (album or ForOrder queue). */
  onDelete = null
}) {
  const landscape = String(orientation).toLowerCase() === 'landscape';
  const thumbRef = useRef(null);
  const height = Math.max(28, Math.round(Number(heightPx) || THUMB_H_PX));
  const canDragPage = Boolean(draggablePage && onPageDragStart);
  const canDelete = typeof onDelete === 'function';

  useEffect(() => {
    if (!active || !thumbRef.current) return;
    thumbRef.current.scrollIntoView({
      behavior: 'smooth',
      inline: 'nearest',
      block: 'nearest'
    });
  }, [active]);

  return (
    <Box
      ref={thumbRef}
      component="div"
      role="button"
      tabIndex={0}
      draggable={canDragPage}
      onMouseDown={(e) => {
        // Allow HTML5 drag to start; only suppress default when not dragging pages.
        if (!canDragPage) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
      onDragStart={(e) => {
        if (!canDragPage) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        onPageDragStart?.(e, {
          pageIndex: pageIndex ?? pageNumber - 1,
          pageNumber,
          modelKey: model?.key
        });
      }}
      onDragEnd={(e) => {
        onPageDragEnd?.(e);
      }}
      onClick={onSelect}
      aria-label={`Go to page ${pageNumber}`}
      aria-current={active ? 'page' : undefined}
      title={
        canDragPage
          ? `Page ${pageNumber} — drag onto another album to move this page`
          : `Page ${pageNumber}`
      }
      sx={{
        flex: '0 0 auto',
        p: 0,
        m: 0,
        border: active ? ACTIVE_BORDER : IDLE_BORDER,
        borderRadius: 0.75,
        bgcolor: '#fff',
        cursor: canDragPage ? 'grab' : 'pointer',
        overflow: 'visible',
        height,
        aspectRatio: landscape ? '12 / 10' : '10 / 12',
        boxShadow: active ? '0 0 0 2px rgba(229,57,53,0.35)' : '0 1px 3px rgba(0,0,0,0.25)',
        position: 'relative',
        lineHeight: 0,
        userSelect: 'none',
        WebkitUserDrag: canDragPage ? 'element' : 'none',
        '&:active': canDragPage ? { cursor: 'grabbing' } : null,
        '&:focus-visible': {
          outline: '2px solid #1565c0',
          outlineOffset: 2
        }
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: '#f5f5f5',
          borderRadius: 0.75,
          overflow: 'hidden',
          // Let the thumb own HTML5 drag — nested photo boxes must not steal the gesture.
          pointerEvents: 'none'
        }}
      >
        {(model.slots || []).map((slot) => (
          <Box
            key={slot.id}
            sx={{
              position: 'absolute',
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: `${slot.w}%`,
              height: `${slot.h}%`,
              border: slot.type === 'text' ? '1px dashed #90caf9' : '1px solid #bdbdbd',
              bgcolor: slot.type === 'text' ? 'rgba(144,202,249,0.15)' : '#eee',
              boxSizing: 'border-box'
            }}
          />
        ))}
        {(model.photos || []).map((photo) => (
          <Box
            key={`photo-${photo.attachmentId}-${Math.round(photo.x)}-${Math.round(photo.y)}`}
            sx={{
              position: 'absolute',
              left: `${photo.x}%`,
              top: `${photo.y}%`,
              width: `${Math.max(4, photo.w)}%`,
              height: `${Math.max(4, photo.h)}%`,
              overflow: 'hidden',
              bgcolor: '#90a4ae'
            }}
          >
            {photo.isAlbumMedia ? (
              <FilmstripPhoto
                attachmentId={photo.attachmentId}
                noteId={noteId}
                storageType={storageType}
                isVideo={Boolean(photo.isAlbumVideo)}
              />
            ) : null}
          </Box>
        ))}
      </Box>
      {canDelete ? (
        <Box
          component="button"
          type="button"
          className="rv-album-page-thumb__delete"
          aria-label={`Delete page ${pageNumber}`}
          title={`Delete page ${pageNumber}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.(pageIndex ?? pageNumber - 1);
          }}
          sx={{
            position: 'absolute',
            top: -6,
            right: -6,
            zIndex: 4,
            width: 20,
            height: 20,
            minWidth: 20,
            p: 0,
            m: 0,
            border: '2px solid #fff',
            borderRadius: '50%',
            bgcolor: '#c62828',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            lineHeight: '16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
            pointerEvents: 'auto',
            '&:hover': { bgcolor: '#b71c1c' }
          }}
        >
          ×
        </Box>
      ) : null}
    </Box>
  );
}

PageThumb.propTypes = {
  model: PropTypes.shape({
    key: PropTypes.string,
    slots: PropTypes.array,
    photos: PropTypes.array
  }).isRequired,
  pageNumber: PropTypes.number.isRequired,
  pageIndex: PropTypes.number,
  active: PropTypes.bool,
  orientation: PropTypes.string,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  heightPx: PropTypes.number,
  draggablePage: PropTypes.bool,
  onPageDragStart: PropTypes.func,
  onPageDragEnd: PropTypes.func,
  onDelete: PropTypes.func
};

/**
 * Page arrows + Page X of Y + clickable page thumbs.
 * - default: full-width yellow strip
 * - inline: beside the photo staging tray
 * - overlay: compact chrome on the album page
 */
export default function PhotoAlbumsPageFilmstrip({
  pages,
  pageIndex,
  pageCount,
  pageWidth,
  orientation = 'portrait',
  noteId,
  storageType,
  editor,
  canGoPrev = false,
  canGoNext = false,
  onGoToPage,
  inline = false,
  overlay = false,
  draggablePages = false,
  onPageDragStart,
  onPageDragEnd,
  /** When set, filmstrip shows these cross-note order entries instead of current-note pages. */
  overrideEntries = null,
  /** (pageIndex, entry?) => void — delete album page or ForOrder queue entry. */
  onDeletePage = null,
  /** () => void — delete every album page (photos return to tray). */
  onDeleteAllPages = null
}) {
  const [docTick, setDocTick] = useState(0);
  const hasOverride = Array.isArray(overrideEntries) && overrideEntries.length > 0;

  useEffect(() => {
    if (!editor || hasOverride) return undefined;
    const bump = () => setDocTick((n) => n + 1);
    editor.on('update', bump);
    return () => editor.off('update', bump);
  }, [editor, hasOverride]);

  const allModels = useMemo(
    () => (hasOverride ? [] : buildAlbumPageFilmstripModels(editor, pages, pageWidth)),
    // docTick refreshes photo placement when the editor changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, pages, pageWidth, docTick, hasOverride]
  );

  const displayEntries = useMemo(() => {
    if (hasOverride) {
      return overrideEntries.map((entry, idx) => ({
        model: entry.model || { key: entry.sourceKey || `order-${idx}`, slots: [], photos: [] },
        pageIndex: idx,
        pageNumber: idx + 1,
        noteId: entry.noteId,
        orientation: entry.orientation || orientation
      }));
    }
    return allModels.map((model, idx) => ({ model, pageIndex: idx, pageNumber: idx + 1 }));
  }, [hasOverride, overrideEntries, allModels, orientation]);

  const effectivePageCount = hasOverride ? displayEntries.length : pageCount;
  const labelText = `Page ${Math.min(pageIndex + 1, Math.max(1, effectivePageCount))} of ${Math.max(1, effectivePageCount)}`;

  const goPrev = () => {
    onGoToPage?.(pageIndex - 1);
  };

  const goNext = () => {
    onGoToPage?.(pageIndex + 1);
  };

  const prevEnabled = canGoPrev;
  const nextEnabled = canGoNext;
  const thumbHeight = overlay ? 52 : THUMB_H_PX;

  const arrowSx = overlay
    ? {
        width: { xs: 22, sm: 26 },
        height: 'auto',
        display: 'block'
      }
    : {
        width: { xs: 32, sm: 40 },
        height: 'auto',
        display: 'block'
      };

  const navRow = (
    <Box
      sx={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 0.25, sm: overlay ? 0.4 : 0.6 }
      }}
    >
      <Box
        component="button"
        type="button"
        aria-label="Previous album page"
        title="Previous page"
        disabled={!prevEnabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={goPrev}
        sx={{
          border: 'none',
          bgcolor: 'transparent',
          p: 0,
          m: 0,
          cursor: prevEnabled ? 'pointer' : 'default',
          opacity: prevEnabled ? 1 : 0.35,
          lineHeight: 0,
          display: 'inline-flex',
          '&:disabled': { opacity: 0.35, cursor: 'default' }
        }}
      >
        <Box component="img" src={leftArrowImg} alt="" draggable={false} sx={arrowSx} />
      </Box>
      <Box
        component="span"
        sx={{
          fontWeight: 800,
          fontSize: overlay
            ? { xs: '0.65rem', sm: '0.75rem' }
            : { xs: '0.72rem', sm: '0.85rem' },
          color: '#111',
          WebkitTextFillColor: '#111',
          whiteSpace: 'nowrap',
          minWidth: '7ch',
          textAlign: 'center',
          userSelect: 'none'
        }}
      >
        {labelText}
      </Box>
      <Box
        component="button"
        type="button"
        aria-label="Next album page"
        title="Next page"
        disabled={!nextEnabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={goNext}
        sx={{
          border: 'none',
          bgcolor: 'transparent',
          p: 0,
          m: 0,
          cursor: nextEnabled ? 'pointer' : 'default',
          opacity: nextEnabled ? 1 : 0.35,
          lineHeight: 0,
          display: 'inline-flex',
          '&:disabled': { opacity: 0.35, cursor: 'default' }
        }}
      >
        <Box component="img" src={rightArrowImg} alt="" draggable={false} sx={arrowSx} />
      </Box>
    </Box>
  );

  const thumbsRow = (
    <Box
      className="rv-album-page-filmstrip__scroll"
      sx={{
        flex: overlay ? '1 1 auto' : '1 1 auto',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        gap: overlay ? 0.5 : 0.75,
        overflowX: 'scroll',
        overflowY: 'hidden',
        px: 0.25,
        pt: overlay ? 0 : 0.25,
        pb: 0,
        scrollbarGutter: overlay ? 'auto' : 'stable',
        flexWrap: 'nowrap',
        maxWidth: overlay ? { xs: 160, sm: 220, md: 280 } : 'none'
      }}
    >
      {displayEntries.map((entry) => (
        <PageThumb
          key={`page-${entry.pageIndex}-${entry.model.key}-${entry.noteId ?? noteId ?? ''}`}
          model={entry.model}
          pageNumber={entry.pageNumber}
          pageIndex={entry.pageIndex}
          active={entry.pageIndex === pageIndex}
          orientation={entry.orientation || orientation}
          noteId={entry.noteId ?? noteId}
          storageType={storageType}
          heightPx={thumbHeight}
          onSelect={() => onGoToPage?.(entry.pageIndex)}
          draggablePage={!hasOverride && draggablePages}
          onPageDragStart={onPageDragStart}
          onPageDragEnd={onPageDragEnd}
          onDelete={
            typeof onDeletePage === 'function'
              ? (idx) => onDeletePage(idx, entry)
              : null
          }
        />
      ))}
    </Box>
  );

  const canDeleteAllPages =
    typeof onDeleteAllPages === 'function' && !hasOverride && displayEntries.length > 0;

  const deleteAllPagesBtn = canDeleteAllPages ? (
    <SliderControlButton
      type="button"
      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
      aria-label="X All — delete all album pages"
      title="X All — delete all album pages; photos return to the thumbnail tray"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDeleteAllPages?.();
      }}
      sx={{
        flexShrink: 0,
        alignSelf: 'center',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.35,
        minWidth: 'auto',
        fontSize: { xs: '0.72rem', sm: '0.82rem' },
        fontWeight: 800,
        lineHeight: 1.2,
        bgcolor: 'var(--theme-secondary-color) !important',
        color: '#000 !important',
        WebkitTextFillColor: '#000 !important',
        border: '4px solid #000 !important',
        '@media (hover: hover)': {
          '&:hover:not(.Mui-disabled)': {
            bgcolor: 'var(--theme-secondary-color) !important',
            color: '#000 !important',
            WebkitTextFillColor: '#000 !important'
          }
        }
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 18,
          height: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#000',
          color: '#e53935',
          WebkitTextFillColor: '#e53935',
          border: '1px solid #fff',
          borderRadius: '2px',
          fontSize: '0.7rem',
          fontWeight: 900,
          lineHeight: 1,
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        ×
      </Box>
      All
    </SliderControlButton>
  ) : null;

  const headerRow = (
    <Box
      sx={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 0.75,
        px: 0.25,
        minHeight: 28
      }}
    >
      <Box sx={{ flex: '1 1 0', minWidth: 0 }} />
      {navRow}
      <Box
        sx={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}
      >
        {deleteAllPagesBtn}
      </Box>
    </Box>
  );

  if (overlay) {
    return (
      <Box
        className="rv-album-page-filmstrip rv-album-page-filmstrip--overlay"
        sx={{
          flex: '0 1 auto',
          minWidth: 0,
          maxWidth: '100%',
          display: 'inline-flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 0.5,
          boxSizing: 'border-box',
          px: 0.6,
          py: 0.35,
          bgcolor: 'rgba(255,255,255,0.92)',
          border: '2px solid #000',
          borderRadius: '6px',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          pointerEvents: 'auto'
        }}
      >
        {navRow}
        {thumbsRow}
        {deleteAllPagesBtn}
      </Box>
    );
  }

  return (
    <Box
      className="rv-album-page-filmstrip"
      sx={{
        flex: inline ? '1 1 auto' : '0 0 auto',
        width: inline ? '100%' : '100%',
        minWidth: 0,
        maxWidth: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0.35,
        boxSizing: 'border-box',
        px: { xs: 0.5, sm: 0.75 },
        pt: 0.5,
        pb: 0,
        minHeight: inline ? 120 : undefined,
        bgcolor: inline ? 'var(--theme-daynight-color)' : 'var(--theme-yellow-color, #ffd700)',
        border: inline ? '2px solid #000' : 'none',
        borderBottom: '2px solid #000',
        overflow: 'hidden'
      }}
    >
      {headerRow}
      {thumbsRow}
    </Box>
  );
}

PhotoAlbumsPageFilmstrip.propTypes = {
  pages: PropTypes.array,
  pageIndex: PropTypes.number,
  pageCount: PropTypes.number,
  pageWidth: PropTypes.number,
  orientation: PropTypes.string,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  editor: PropTypes.object,
  canGoPrev: PropTypes.bool,
  canGoNext: PropTypes.bool,
  onGoToPage: PropTypes.func,
  inline: PropTypes.bool,
  overlay: PropTypes.bool,
  draggablePages: PropTypes.bool,
  onPageDragStart: PropTypes.func,
  onPageDragEnd: PropTypes.func,
  overrideEntries: PropTypes.arrayOf(
    PropTypes.shape({
      model: PropTypes.object,
      noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      orientation: PropTypes.string,
      sourceKey: PropTypes.string
    })
  ),
  onDeletePage: PropTypes.func,
  onDeleteAllPages: PropTypes.func
};
