import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import leftArrowImg from 'assets/images/leftarrow.png';
import rightArrowImg from 'assets/images/rightarrow.png';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';
import {
  PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
  PHOTO_ALBUMS_THEME_INVERSE_BORDER_2
} from './photoAlbumsNoteFontTokens';
import { PhotoAlbumsTrayHeading } from './PhotoAlbumsTrayCountLabel';
import PhotoAlbumsThumbnail from './thumbnails/PhotoAlbumsThumbnail';
import { albumPagePhotoIds } from './photoAlbumsPages';

const THUMB_H_PX = 96;
/** Pages per open spread — every photo on the open spread is highlighted. */
const ALBUM_SPREAD_PAGES = 2;
const ACTIVE_BORDER = '4px solid #e53935';
const IDLE_BORDER = '2px solid #333';
const BLUE_TRAY_BG = '#2196F3';

/**
 * Build lightweight page preview models for the filmstrip (the page's photos via `attachmentIds`).
 * `editor` / `pageWidth` are kept in the signature for callers.
 */
export function buildAlbumPageFilmstripModels(editor, pages, pageWidth) {
  const list = Array.isArray(pages) ? pages : [];

  if (!list.length) {
    return [
      {
        key: 'empty-page',
        photos: [],
        attachmentIds: []
      }
    ];
  }

  return list.map((inst) => ({
    key: String(inst.key || 'page'),
    photos: [],
    attachmentIds: albumPagePhotoIds(inst)
  }));
}

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
  onDelete = null,
  /** One album photo per frame (white strip) instead of a whole-page preview. */
  photoFrame = false
}) {
  const landscape = String(orientation).toLowerCase() === 'landscape';
  const thumbRef = useRef(null);
  const height = Math.max(28, Math.round(Number(heightPx) || THUMB_H_PX));
  const canDragPage = Boolean(draggablePage && onPageDragStart);
  const canDelete = typeof onDelete === 'function';
  const photoIds = albumPagePhotoIds(model);

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
      aria-label={photoFrame ? `Photo on page ${pageNumber}` : `Go to page ${pageNumber}`}
      aria-current={active ? 'page' : undefined}
      title={
        canDragPage
          ? `Page ${pageNumber} — drag onto another album to move this page`
          : photoFrame
            ? `Photo on page ${pageNumber}`
            : `Page ${pageNumber}`
      }
      sx={{
        flex: '0 0 auto',
        p: 0,
        m: 0,
        border: active ? ACTIVE_BORDER : IDLE_BORDER,
        borderRadius: 0.75,
        bgcolor: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
        cursor: canDragPage ? 'grab' : 'pointer',
        overflow: 'visible',
        height,
        aspectRatio: photoFrame ? '1 / 1' : landscape ? '12 / 10' : '10 / 12',
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
          bgcolor: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
          borderRadius: 0.75,
          overflow: 'hidden',
          // Let the thumb own HTML5 drag — nested photo boxes must not steal the gesture.
          pointerEvents: 'none',
          display: 'grid',
          // Same layout as the page: 1–3 photos stacked, 4 in a 2×2 grid.
          gridTemplateColumns: photoIds.length === 4 ? '1fr 1fr' : '1fr',
          gridAutoRows: '1fr',
          gap: '3%',
          p: photoFrame ? 0 : '4%',
          boxSizing: 'border-box'
        }}
      >
        {photoIds.map((attachmentId) => (
          <Box key={attachmentId} sx={{ minWidth: 0, minHeight: 0, position: 'relative' }}>
            <PhotoAlbumsThumbnail
              noteId={noteId}
              attachmentId={attachmentId}
              storageType={storageType}
              objectFit={photoFrame ? 'cover' : 'contain'}
            />
          </Box>
        ))}
      </Box>
      {canDelete ? (
        <Box
          component="button"
          type="button"
          className="rv-album-page-thumb__delete"
          aria-label={photoFrame ? `Remove photo from page ${pageNumber}` : `Delete page ${pageNumber}`}
          title={photoFrame ? `Remove photo from page ${pageNumber}` : `Delete page ${pageNumber}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.(pageIndex ?? pageNumber - 1);
          }}
          {...guestDemoBlockProps()}
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
    photos: PropTypes.array,
    attachmentIds: PropTypes.arrayOf(PropTypes.number)
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
  onDelete: PropTypes.func,
  photoFrame: PropTypes.bool
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
  /** (pageKey, attachmentId) => void — remove one photo from its album page (white strip ×). */
  onDeletePhoto = null,
  /** () => void — delete every album page (tray photos are kept). */
  onDeleteAllPages = null,
  /** () => void — Reset Album: wipe every TutaPhotos album on TutaCloud. */
  onResetAlbum = null
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
        model: entry.model || { key: entry.sourceKey || `order-${idx}`, photos: [] },
        pageIndex: idx,
        pageNumber: idx + 1,
        noteId: entry.noteId,
        orientation: entry.orientation || orientation
      }));
    }
    // One frame per album photo, like the green tray; blank pages get no frame.
    return allModels.flatMap((model, idx) =>
      albumPagePhotoIds(model).map((attachmentId) => ({
        model: { key: `${model.key}#${attachmentId}`, photos: [], attachmentIds: [attachmentId] },
        pageKey: model.key,
        attachmentId,
        photoFrame: true,
        pageIndex: idx,
        pageNumber: idx + 1
      }))
    );
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
          active={
            hasOverride
              ? entry.pageIndex === pageIndex
              : Math.floor(entry.pageIndex / ALBUM_SPREAD_PAGES) === Math.floor(pageIndex / ALBUM_SPREAD_PAGES)
          }
          orientation={entry.orientation || orientation}
          noteId={entry.noteId ?? noteId}
          storageType={storageType}
          heightPx={thumbHeight}
          onSelect={() => onGoToPage?.(entry.pageIndex)}
          draggablePage={!hasOverride && draggablePages}
          onPageDragStart={onPageDragStart}
          onPageDragEnd={onPageDragEnd}
          photoFrame={Boolean(entry.photoFrame)}
          onDelete={
            entry.photoFrame
              ? typeof onDeletePhoto === 'function'
                ? () => onDeletePhoto(entry.pageKey, entry.attachmentId)
                : null
              : typeof onDeletePage === 'function'
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
      title="X All — delete all album pages; photos stay in the thumbnail tray"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDeleteAllPages?.();
      }}
      {...guestDemoBlockProps()}
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

  const resetAlbumBtn =
    typeof onResetAlbum === 'function' && !hasOverride ? (
      <SliderControlButton
        type="button"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        aria-label="Reset Album — delete every album, page and photo in TutaPhotos on TutaCloud"
        title="Reset Album — delete every album, page and photo in TutaPhotos on TutaCloud and start with a blank vault"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResetAlbum?.();
        }}
        {...guestDemoBlockProps()}
        sx={{
          flexShrink: 0,
          alignSelf: 'center',
          px: 0.75,
          py: 0.35,
          minWidth: 'auto',
          whiteSpace: 'nowrap',
          fontSize: { xs: '0.72rem', sm: '0.82rem' },
          fontWeight: 800,
          lineHeight: 1.2,
          bgcolor: '#e53935 !important',
          color: '#fff !important',
          WebkitTextFillColor: '#fff !important',
          border: '2px solid #000 !important',
          '@media (hover: hover)': {
            '&:hover:not(.Mui-disabled)': {
              bgcolor: '#c62828 !important',
              color: '#fff !important',
              WebkitTextFillColor: '#fff !important'
            }
          }
        }}
      >
        Reset Album
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
      <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <PhotoAlbumsTrayHeading title="Blue Tray" count={displayEntries.length} />
      </Box>
      {inline ? null : navRow}
      <Box
        sx={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 0.75
        }}
      >
        {resetAlbumBtn}
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
        bgcolor: inline ? BLUE_TRAY_BG : 'var(--theme-yellow-color, #ffd700)',
        border: inline ? PHOTO_ALBUMS_THEME_INVERSE_BORDER_2 : 'none',
        borderBottom: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
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
  onDeletePhoto: PropTypes.func,
  onDeleteAllPages: PropTypes.func,
  onResetAlbum: PropTypes.func
};
