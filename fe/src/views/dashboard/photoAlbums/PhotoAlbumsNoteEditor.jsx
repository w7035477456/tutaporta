import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import 'katex/dist/katex.min.css';
import GreenButton from 'ui-component/GreenButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { themedConfirm } from 'utils/themedDialog';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';

import { buildPhotoAlbumsEditorExtensions } from './photoAlbumsEditorExtensions';
import {
  PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME,
  newLabelId
} from './photoAlbumsTextLabelNode';
import PhotoAlbumsPlaceTextDialog, { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';
import {
  albumPageTitleBandHeightPx,
  albumTitleStyleMarkerHtml,
  DEFAULT_ALBUM_TITLE_STYLE,
  formatAlbumPageTitleLines,
  ALBUM_PAGE_COUNT_LINE_SCALE,
  ALBUM_PAGE_COUNT_LINE_STYLE,
  parseAlbumTitleStyleFromHtml,
  stripAlbumTitleStyleMarker
} from './photoAlbumsAlbumTitleStyle';
import { PhotoAlbumsAlbumLayoutContext } from './photoAlbumsAlbumLayoutContext';
import PhotoAlbumsEditorToolbar from './PhotoAlbumsEditorToolbar';
import PhotoAlbumsAlbumZoomBar from './PhotoAlbumsAlbumZoomBar';
import PhotoAlbumsPageFilmstrip, { buildAlbumPageFilmstripModels } from './PhotoAlbumsPageFilmstrip';
import PhotoAlbumsPageFlipOverlay, {
  captureAlbumSpreadPageHalves,
  prefersAlbumPageFlipReducedMotion
} from './PhotoAlbumsPageFlipOverlay';
import PhotoAlbumsContextTutorial from './PhotoAlbumsContextTutorial';
import { findAlbumPagesMatchingSearchTerms } from './photoAlbumsPageSearch';
import PhotoAlbumsThumbnailTray from './thumbnails/PhotoAlbumsThumbnailTray';
import {
  buildPhotoAlbumsTrayItems,
  excludePlacedTrayItems,
  photoAlbumsTrayItemDisplayName
} from './thumbnails/photoAlbumsTrayItems';
import {
  albumPageBlockHeight,
  createAlbumPageInstance,
  normalizeAlbumPageAttachmentId,
  parseAlbumPageInstancesFromHtml,
  serializeAlbumPageInstances
} from './photoAlbumsPages';
import { MY_PHOTO_ALBUMS_VIEW_PATH } from 'constants/myPhotoAlbumsRoute';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { getAlbumBinderWidthRatio, getAlbumSlideshowBinderWidthRatio } from 'config/albumBinderWidthEnv';
import binderMiddleImg from 'assets/images/bindermiddle.png';
import albumCoverImg from 'assets/images/albumcover.png';
import albumCoverBackImg from 'assets/images/albumcoverback.png';
import leftArrowImg from 'assets/images/leftarrow.png';
import rightArrowImg from 'assets/images/rightarrow.png';
import { VAULT_WORKSPACE_FOCUS_VIEW_BG } from 'config/vaultWorkspaceFocusView';
import { storePhotoAlbumsPresentation } from './photoAlbumsPresentationSession';
import { useSlideShowMusicPlayback } from 'hooks/useSlideShowMusicPlayback';
import SlideShowMusicControls from './SlideShowMusicControls';
import { runPhotoAlbumsTrafficWaitIfNeeded } from 'utils/photoAlbumsTrafficWaitGate';
import { getPhotoAlbumsOverageThrottleActive } from 'utils/photoAlbumsOverageThrottleUi';
import {
  isPhotoAlbumsDragJunkPlain,
  stripPhotoAlbumsDragJunkBodyRows
} from 'utils/photoAlbumsRichText';
import { DRAG_ALBUM_PAGE } from './photoAlbumsAlbumPageDrag';
import { DRAG_CROSS_PANE } from './photoAlbumsCrossPaneDrag';
import {
  DRAG_PAGE_PHOTO,
  DRAG_TRAY_PHOTO,
  PHOTO_DROP_TARGET_BG as ALBUM_PHOTO_DROP_TARGET_BG,
  isPagePhotoDrag,
  isTrayPhotoDrag,
  readPagePhotoDragPageKey,
  readTrayPhotoDragAttachmentId,
  startPagePhotoDrag
} from './photoAlbumsPagePhotoDrag';
import PhotoAlbumsThumbnail from './thumbnails/PhotoAlbumsThumbnail';
import { photoAlbumsPagePhotoCache, photoAlbumsThumbnailCache } from './thumbnails/photoAlbumsThumbnailStore';
import PhotoAlbumsVideoIndicator from './PhotoAlbumsVideoIndicator';
import {
  DRAG_FILES_EXPLORER,
  DRAG_FILES_EXPLORER_FLAG,
  isFilesExplorerDrag
} from './photoAlbumsFilesExplorerDrag';
import { remapTextLabelAttrsToBand } from './photoAlbumsMoveAlbumPage';
import { setPhotoAlbumsColumnResizing } from './photoAlbumsColumnResizeGate';
import { stripLegacyAlbumPhotoMarkup } from './photoAlbumsLegacyPhotoMarkup';
import { openPhotoAlbumsAttachmentInNewWindow } from './openPhotoAlbumsAttachmentWindow';
import { themedAlert } from 'utils/themedDialog';
import './photoAlbumsEditor.scss';

const EMPTY_DOC = '<p></p>';
const ALBUM_PAGE_MARKER_RE = /<div\b[^>]*data-rv-album-template\b[^>]*>\s*<\/div>/gi;
/** Match workspace pane drag MIME types (avoid circular import of WorkspacePane). */
const DRAG_NOTEBOOK = 'application/x-record-vault-notebook-id';
const DRAG_NOTE = 'application/x-record-vault-note-id';
const DRAG_NOTE_IDS = 'application/x-record-vault-note-ids';
const DRAG_SHORTCUT = 'application/x-record-vault-shortcut-id';
const DEFAULT_ALBUM_ZOOM = 95;
/** Visible theme-primary gutter around the fitted binder/page (auto-zoom). */
const ALBUM_AUTO_ZOOM_BORDER_PX = 8;
/** Full Slide — default seconds per album page. User can pick 4, 8, or 12. */
const ALBUM_FULL_SLIDE_SEC_DEFAULT = 4;
const ALBUM_FULL_SLIDE_SEC_CHOICES = [4, 8, 12];
/** CSS 3D page-turn duration (spread / cover leaf). */
const ALBUM_PAGE_FLIP_MS = 700;
/** Full screen — top/bottom inset so Prev/Next strips sit in the black margin, not on photos. */
const ALBUM_FS_NAV_PAD_PX = 56;
/** Page-edge leaves this much black beside the page (fallback if no padding). */
const ALBUM_PAGE_EDGE_GAP_FROM_SCROLLBAR_PX = 24;
const PAGE_RESIZE_HANDLE_WIDTH = 30;
const ALBUM_PAGE_STACK_GAP = 24;
/** Black edge on both spread pages, empty or not; inset so it never shifts page geometry. */
const ALBUM_PAGE_BORDER_SHADOW = 'inset 0 0 0 2px #000';

const THUMB_ROW_STAGING_PERCENT_LS = 'photoAlbumsThumbRowStagingPercent_v1';
const THUMB_ROW_RESIZE_HANDLE_PX = 30;
const THUMB_ROW_MIN_PANE_PX = 160;
const THUMB_ROW_DEFAULT_STAGING_PERCENT = 50;
const THUMB_ROW_RESIZE_BAR_RED = '#e53935';

const thumbRowResizeHandleSx = {
  flex: `0 0 ${THUMB_ROW_RESIZE_HANDLE_PX}px`,
  width: THUMB_ROW_RESIZE_HANDLE_PX,
  cursor: 'col-resize',
  touchAction: 'none',
  alignSelf: 'stretch',
  bgcolor: 'var(--theme-daynight-color)',
  position: 'relative',
  zIndex: 90,
  borderLeft: '1px solid var(--theme-inverse-daynight-color)',
  borderRight: '1px solid var(--theme-inverse-daynight-color)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '12%',
    bottom: '12%',
    left: '50%',
    width: 0,
    borderLeft: '6px dashed var(--theme-yellow-color)',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
    transition: 'border-left-color 120ms ease'
  },
  '&:hover::before, &.is-dragging::before': {
    borderLeftColor: THUMB_ROW_RESIZE_BAR_RED
  }
};

function loadThumbRowStagingPercent() {
  try {
    const n = Number(localStorage.getItem(THUMB_ROW_STAGING_PERCENT_LS));
    if (Number.isFinite(n) && n >= 15 && n <= 85) return n;
  } catch {
    // ignore
  }
  return THUMB_ROW_DEFAULT_STAGING_PERCENT;
}

function writeThumbRowStagingPercent(percent) {
  try {
    localStorage.setItem(THUMB_ROW_STAGING_PERCENT_LS, String(Math.round(percent)));
  } catch {
    // ignore
  }
}

function ThumbRowResizeHandle({ onMouseDown, label = 'Resize thumbnail tray and page previews' }) {
  const [dragging, setDragging] = useState(false);
  const handleMouseDown = (event) => {
    setDragging(true);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mouseup', onUp);
    onMouseDown?.(event);
  };
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      className={dragging ? 'is-dragging' : undefined}
      onMouseDown={handleMouseDown}
      sx={thumbRowResizeHandleSx}
    />
  );
}

ThumbRowResizeHandle.propTypes = {
  onMouseDown: PropTypes.func,
  label: PropTypes.string
};

/** Recolor blue arrow PNGs to theme yellow on hover. */
const ALBUM_ARROW_YELLOW_FILTER =
  'brightness(0) saturate(100%) invert(83%) sepia(62%) saturate(1200%) hue-rotate(359deg) brightness(1.05) contrast(1.05)';

/** Pages visible side-by-side in the album shell (open book spread). */
const ALBUM_SPREAD_PAGE_COUNT = 2;

function albumSpreadRowForPageIndex(pageIndex) {
  return Math.floor(Math.max(0, Number(pageIndex) || 0) / ALBUM_SPREAD_PAGE_COUNT);
}

function albumSpreadLeftPageIndex(pageIndex) {
  return albumSpreadRowForPageIndex(pageIndex) * ALBUM_SPREAD_PAGE_COUNT;
}

function albumPageXForSpreadColumn(pageIndex, pageWidth, binderWidth) {
  const col = Math.max(0, Number(pageIndex) || 0) % ALBUM_SPREAD_PAGE_COUNT;
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  return col === 0 ? 0 : pw + bw;
}

/** Page-top Y for a spread row (each row holds up to two facing pages). */
function albumPageTopForSpreadRow(spreadRow, pageHeight) {
  const row = Math.max(0, Math.round(Number(spreadRow) || 0));
  const h = Math.max(1, Math.round(Number(pageHeight) || 1));
  return row * (h + ALBUM_PAGE_STACK_GAP);
}

function albumSpreadCanvasWidth(pageWidth, binderWidth) {
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  return pw * ALBUM_SPREAD_PAGE_COUNT + bw;
}

/** One page column — not the full ProseMirror spread width. */
function albumSinglePageWidth(pageSizeWidth, canvasWidthPx, binderWidthPx = 0) {
  if (canvasWidthPx >= 200) return Math.round(canvasWidthPx);
  const pmW = Math.round(Number(pageSizeWidth) || 0);
  const bw = Math.max(0, Math.round(Number(binderWidthPx) || 0));
  if (pmW >= 200) {
    const derived = Math.round((pmW - bw) / ALBUM_SPREAD_PAGE_COUNT);
    if (derived >= 200) return derived;
  }
  return 480;
}

/** True when saved page x/y still use the old vertical stack (not spread columns). */
function albumPagesNeedSpreadRestack(instances, pageWidth, binderWidth, orientation = 'portrait') {
  const list = instances || [];
  if (!list.length) return false;
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  const h = albumPageBlockHeight(pw, orientation);
  // Any page wider than ~1.2 pages was likely saved using spread canvas width as "page" width.
  const maxOkW = Math.round(pw * 1.2);
  return list.some((inst, pageIndex) => {
    const expectedX = albumPageXForSpreadColumn(pageIndex, pw, bw);
    const expectedY = albumPageTopForSpreadRow(albumSpreadRowForPageIndex(pageIndex), h);
    const x = Math.round(Number(inst.x) || 0);
    const y = Math.round(Number(inst.y) || 0);
    const w = Math.round(Number(inst.w) || 0);
    if (w > maxOkW) return true;
    if (Math.abs(x - expectedX) > 4 || Math.abs(y - expectedY) > 4) return true;
    if (w > 0 && Math.abs(w - pw) > 8) return true;
    return false;
  });
}

/** Page order for the book: top-to-bottom Y, then X (legacy), then array order. */
function sortAlbumPagesByBand(instances) {
  return [...(instances || [])].sort((a, b) => {
    const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (dy !== 0) return dy;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });
}

/**
 * Flush every page to its own book-page band in the given order
 * (stacked in data only). Input order = page order (left → right / 1 → N).
 * The UI shows one two-page spread at a time in the black shell (flip), not a scroll stack.
 * Remaps snapped photos and text labels when `editor` is set.
 */
function restackAlbumPagesFlush(
  instances,
  pageWidth,
  orientation,
  editor = null,
  binderWidth = 0
) {
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  const h = albumPageBlockHeight(pw, orientation);
  // Preserve caller order — do not re-sort by Y (that put new pages on the left).
  const ordered = [...(instances || [])];
  const pageBands = ordered.map((inst, pageIndex) => {
    const oldBand = albumPageBand(inst, pw, orientation);
    const spreadRow = albumSpreadRowForPageIndex(pageIndex);
    const replaced = createAlbumPageInstance({
      key: inst.key,
      x: albumPageXForSpreadColumn(pageIndex, pw, bw),
      y: albumPageTopForSpreadRow(spreadRow, h),
      w: pw,
      h,
      attachmentId: inst.attachmentId
    });
    return {
      pageIndex,
      oldBand,
      newBand: albumPageBand(replaced, pw, orientation),
      replaced
    };
  });

  if (editor) {
    const { state } = editor;
    let tr = state.tr;
    let changed = false;

    state.doc.descendants((node, pos) => {
      // Text/emoji labels must follow their page band too — otherwise inserting a
      // new page steals prior-page stickers into the blank page's Y range.
      if (node.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) return;
      const pl = parseOptionalPx(node.attrs.posLeft);
      const pt = parseOptionalPx(node.attrs.posTop);
      if (pl == null || pt == null) return;
      const bw = Math.max(1, parseOptionalPx(node.attrs.boxWidth) || 40);
      const bh = Math.max(1, parseOptionalPx(node.attrs.boxHeight) || 40);
      const cx = pl + bw / 2;
      const cy = pt + bh / 2;
      const bandIdx = findRestackPageBandIndex(cx, cy, pageBands);
      if (bandIdx < 0) return;

      const { oldBand, newBand } = pageBands[bandIdx];
      if (albumBandsMatch(oldBand, newBand)) return;
      const remapped = remapTextLabelAttrsToBand(node.attrs, oldBand, newBand);
      if (
        remapped.posLeft === node.attrs.posLeft &&
        remapped.posTop === node.attrs.posTop &&
        remapped.boxWidth === node.attrs.boxWidth &&
        remapped.boxHeight === node.attrs.boxHeight
      ) {
        return;
      }
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...remapped });
      changed = true;
    });

    if (changed) editor.view.dispatch(tr);
  }

  return pageBands.map((entry) => entry.replaced);
}

function stripAlbumPageMarker(html) {
  return String(html || '').replace(ALBUM_PAGE_MARKER_RE, '');
}

function stripAlbumMarkers(html) {
  // Drop accidental drag text TipTap inserted when a vault/Finder/staging drop missed the page.
  const cleaned = stripPhotoAlbumsDragJunkBodyRows(
    String(html || '')
      .replace(/<p[^>]*>\s*pa-staged:\d+\s*<\/p>/gi, '')
      .replace(/(^|>)\s*pa-staged:\d+\s*(<|$)/gi, '$1$2')
  );
  return stripAlbumTitleStyleMarker(stripLegacyAlbumPhotoMarkup(stripAlbumPageMarker(cleaned)));
}

/** Remove live TipTap paragraphs that are only leftover drag junk (pa-staged / .html names). */
function purgeAlbumDragJunkFromEditor(editor) {
  if (!editor?.state?.doc) return false;
  const ranges = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return;
    if (!isPhotoAlbumsDragJunkPlain(String(node.textContent || '').trim())) return;
    ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  if (!ranges.length) return false;
  let tr = editor.state.tr;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    tr = tr.delete(ranges[i].from, ranges[i].to);
  }
  editor.view.dispatch(tr);
  return true;
}

function withAlbumMarkers(
  html,
  instances,
  orientation = 'portrait',
  pageWidthPx = null,
  titleStyle = null
) {
  const body = stripAlbumMarkers(html);
  const parts = [];
  const pagesJson = serializeAlbumPageInstances(instances);
  const orient =
    String(orientation || '').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
  const pageW = Number(pageWidthPx);
  const pageWAttr =
    Number.isFinite(pageW) && pageW >= 200 ? ` data-album-page-width="${Math.round(pageW)}"` : '';
  if (pagesJson) {
    parts.push(
      `<div data-rv-album-template="" data-album-templates="${pagesJson}" data-album-orientation="${orient}"${pageWAttr} style="display:none"></div>`
    );
  } else {
    // Persist orientation (+ page width) even with no pages yet.
    parts.push(
      `<div data-rv-album-template="" data-album-orientation="${orient}"${pageWAttr} style="display:none"></div>`
    );
  }
  parts.push(albumTitleStyleMarkerHtml(titleStyle || DEFAULT_ALBUM_TITLE_STYLE));
  return `${parts.join('')}${body || EMPTY_DOC}`;
}

function parseAlbumOrientationFromHtml(html) {
  const match = String(html || '').match(/data-album-orientation=["'](portrait|landscape)["']/i);
  if (!match) return 'portrait';
  return String(match[1]).toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
}

function parseAlbumPageWidthFromHtml(html) {
  const match = String(html || '').match(/data-album-page-width=["'](\d+)["']/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 200 ? Math.round(n) : 0;
}

function parseOptionalPx(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function pointInBand(cx, cy, band) {
  return (
    cx >= band.left &&
    cx <= band.left + band.width &&
    cy >= band.top &&
    cy <= band.top + band.height
  );
}

function removeTextLabelsInBand(editor, band) {
  if (!editor || !band) return false;
  const positions = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) return;
    const pl = parseOptionalPx(node.attrs.posLeft);
    const pt = parseOptionalPx(node.attrs.posTop);
    if (pl == null || pt == null) return;
    if (!pointInBand(pl, pt, band)) return;
    positions.push({ pos, size: node.nodeSize });
  });
  if (!positions.length) return false;
  let tr = editor.state.tr;
  for (let i = positions.length - 1; i >= 0; i -= 1) {
    const { pos, size } = positions[i];
    tr = tr.delete(pos, pos + size);
  }
  editor.view.dispatch(tr);
  return true;
}

function albumBandsMatch(a, b) {
  return (
    a &&
    b &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

/** When old page bands overlap (insert-before-restack), prefer the later page in book order. */
function findRestackPageBandIndex(cx, cy, pageBands) {
  let bestIdx = -1;
  let bestPageIndex = -1;
  for (let i = 0; i < pageBands.length; i++) {
    const entry = pageBands[i];
    if (!pointInBand(cx, cy, entry.oldBand)) continue;
    if (entry.pageIndex >= bestPageIndex) {
      bestPageIndex = entry.pageIndex;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function albumPageBand(inst, pageWidthFallback = 480, orientation = 'portrait') {
  const w = inst.w > 0 ? inst.w : pageWidthFallback;
  const h = inst.h > 0 ? inst.h : albumPageBlockHeight(w, orientation);
  return {
    left: inst.x || 0,
    top: inst.y || 0,
    width: w,
    height: h
  };
}

function lowestAlbumPageBottom(instances) {
  let bottom = 0;
  for (const inst of instances || []) {
    const band = albumPageBand(inst);
    bottom = Math.max(bottom, band.top + band.height);
  }
  return bottom;
}

/** Ensure the ProseMirror canvas is tall enough for the page band + content. */
function ensureAlbumCanvasMinHeight(editor, minHeight, { allowShrink = false } = {}) {
  const pm = editor?.view?.dom;
  if (!pm || !(minHeight > 0)) return;
  const need = Math.round(minHeight);
  const current = parseInt(pm.style.minHeight || '0', 10) || 0;
  if (allowShrink || need > current) pm.style.minHeight = `${need}px`;
}

/** Binder column as fraction of one page — from fe/.env ALBUM_BINDER_WIDTH_PCT. */
const ALBUM_BINDER_WIDTH_RATIO = getAlbumBinderWidthRatio();
/** Album SlideShow: 2/3 of the original (edit) one-page binder. */
const ALBUM_SLIDESHOW_BINDER_WIDTH_RATIO = getAlbumSlideshowBinderWidthRatio();

/** Layout width (px at zoom=100%) for binder + page inside the zoom scroll content box. */
function albumLayoutTargetFromViewport(zoomScrollEl, zoomPercent = DEFAULT_ALBUM_ZOOM) {
  let pane = 0;
  const scroll = zoomScrollEl;
  if (scroll && typeof scroll.clientWidth === 'number') {
    pane = scroll.clientWidth;
  }
  if (!(pane > 120)) {
    const editorRoot = scroll?.closest?.('.rv-editor');
    pane = editorRoot?.clientWidth || 0;
  }
  if (!(pane > 120)) {
    pane = typeof window !== 'undefined' ? window.innerWidth : 1200;
  }

  let padLeft = 0;
  let padRight = ALBUM_PAGE_EDGE_GAP_FROM_SCROLLBAR_PX;
  if (scroll && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const cs = window.getComputedStyle(scroll);
    padLeft = parseFloat(cs.paddingLeft) || 0;
    padRight = parseFloat(cs.paddingRight) || ALBUM_PAGE_EDGE_GAP_FROM_SCROLLBAR_PX;
  }

  const contentPane = Math.max(120, pane - padLeft - padRight);
  const zoomScale = Math.max(0.01, (Number(zoomPercent) || DEFAULT_ALBUM_ZOOM) / 100);
  return contentPane / zoomScale;
}

function albumBinderWidthFromLayout(layoutTargetPx, { slideshow = false } = {}) {
  // Spread shell ≈ 2×page + binder. Apply % to one page column.
  const onePageApprox = Math.max(1, Math.max(1, layoutTargetPx) / ALBUM_SPREAD_PAGE_COUNT);
  const ratio = slideshow ? ALBUM_SLIDESHOW_BINDER_WIDTH_RATIO : ALBUM_BINDER_WIDTH_RATIO;
  return Math.max(6, Math.round(onePageApprox * ratio));
}

/** Binder + page layout for the current zoom scroll pane. */
function resolveAlbumViewportLayout(zoomScrollEl, zoomPercent = DEFAULT_ALBUM_ZOOM, options = {}) {
  const layoutTarget = albumLayoutTargetFromViewport(zoomScrollEl, zoomPercent);
  const binderWidthPx = albumBinderWidthFromLayout(layoutTarget, options);
  const pageWidthPx = Math.max(
    200,
    Math.round((layoutTarget - binderWidthPx - PAGE_RESIZE_HANDLE_WIDTH) / ALBUM_SPREAD_PAGE_COUNT)
  );
  return { layoutTarget, binderWidthPx, pageWidthPx };
}

/**
 * Zoom % so the current book page (binder + page) fits entirely in the shell.
 * Shell padding (ALBUM_AUTO_ZOOM_BORDER_PX) is the visible theme-primary border.
 * No vertical scrolling — pages flip with arrows only.
 * `allowUpscale`: Full screen / Full Slide may zoom past 100% to fill the window.
 */
function computeAlbumPageFitZoom(
  zoomScrollEl,
  pageLayoutWidthPx,
  pageLayoutHeightPx,
  { allowUpscale = false } = {}
) {
  if (!zoomScrollEl) return DEFAULT_ALBUM_ZOOM;
  const layoutW = Math.max(1, Math.round(Number(pageLayoutWidthPx) || 0));
  const layoutH = Math.max(1, Math.round(Number(pageLayoutHeightPx) || 0));
  if (!(layoutW > 1) || !(layoutH > 1)) return DEFAULT_ALBUM_ZOOM;

  let padX = 0;
  let padY = 0;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const cs = window.getComputedStyle(zoomScrollEl);
    padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  }
  // Fallback if padding not applied yet — keep a 5–10px primary gutter.
  if (padX < 2) padX = ALBUM_AUTO_ZOOM_BORDER_PX * 2;
  if (padY < 2) padY = ALBUM_AUTO_ZOOM_BORDER_PX * 2;
  // Shrink a hair more so rounding / title chrome never eats the primary margin.
  const safety = 2;
  const availW = Math.max(80, (zoomScrollEl.clientWidth || 0) - padX - safety);
  const availH = Math.max(80, (zoomScrollEl.clientHeight || 0) - padY - safety);
  const zoomW = (availW / layoutW) * 100;
  const zoomH = (availH / layoutH) * 100;
  const cap = allowUpscale ? 500 : 100;
  const next = Math.floor(Math.min(zoomW, zoomH, cap));
  return Math.max(8, Math.min(cap, Number.isFinite(next) ? next : DEFAULT_ALBUM_ZOOM));
}

/** Pin album scroll so binder/page are flush top-left of the zoom pane. */
function flushAlbumScrollOrigin(zoomScrollEl) {
  if (!zoomScrollEl) return;
  zoomScrollEl.scrollTop = 0;
  zoomScrollEl.scrollLeft = 0;
}

/**
 * Keep the album zoom-pane scroll where the user left it (e.g. after dropping
 * a photo near the bottom — TipTap/ProseMirror focus otherwise jumps to top).
 */
function withPreservedAlbumZoomScroll(zoomScrollEl, run) {
  const el = zoomScrollEl;
  const top = el?.scrollTop ?? 0;
  const left = el?.scrollLeft ?? 0;
  const restore = () => {
    if (!el) return;
    el.scrollTop = top;
    el.scrollLeft = left;
  };
  let result;
  try {
    result = typeof run === 'function' ? run() : undefined;
  } finally {
    restore();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
      });
    }
  }
  return result;
}

/**
 * Page content width so binder + page fit the black shell content box.
 * `zoomPercent` inflates layout so CSS zoom still paints the edge on target.
 */
function albumPageWidthFromViewport(zoomScrollEl, zoomPercent = DEFAULT_ALBUM_ZOOM) {
  return resolveAlbumViewportLayout(zoomScrollEl, zoomPercent).pageWidthPx;
}

function applyAlbumBinderWidthToDom(zoomScrollEl, binderWidthPx, pageWidthPx = 0) {
  const body = zoomScrollEl?.querySelector?.('.rv-editor__body--album');
  const binder = zoomScrollEl?.querySelector?.('.rv-editor__binder--spread-center');
  if (!(binderWidthPx > 0)) return;
  const w = `${Math.round(binderWidthPx)}px`;
  if (body) body.style.setProperty('--rv-album-binder-width', w);
  if (binder) binder.style.setProperty('--rv-album-binder-width', w);
  if (pageWidthPx > 0) {
    const left = `${Math.round(pageWidthPx)}px`;
    if (body) body.style.setProperty('--rv-album-binder-left', left);
    if (binder) binder.style.setProperty('--rv-album-binder-left', left);
  }
}

/** Set album page/canvas width — `pageWidth` is one page; ProseMirror spans the full spread. */
function setAlbumCanvasWidth(editor, pageWidth, binderWidthPx = 0) {
  const pm = editor?.view?.dom;
  if (!pm || !(pageWidth > 0)) return 0;
  const pw = Math.max(200, Math.round(pageWidth));
  const spreadW = albumSpreadCanvasWidth(pw, binderWidthPx);
  pm.style.minWidth = `${spreadW}px`;
  pm.style.width = `${spreadW}px`;
  pm.style.maxWidth = `${spreadW}px`;
  const page = pm.closest('.rv-editor__page');
  if (page) {
    const pageW = spreadW + PAGE_RESIZE_HANDLE_WIDTH;
    page.style.minWidth = `${pageW}px`;
    page.style.width = `${pageW}px`;
    page.style.maxWidth = `${pageW}px`;
    page.setAttribute('data-pa-page-width-locked', '1');
  }
  return pw;
}

/**
 * Right edge of pages + placed photos (layout px).
 * Do NOT floor to the current page/client width — that made "reduce" a no-op
 * after enlarge (originWidth stayed at the enlarged canvas size).
 */
function measureAlbumContentWidth(editor, instances, emptyFallback = 480) {
  let maxR = 0;
  for (const inst of instances || []) {
    const band = albumPageBand(inst, emptyFallback);
    maxR = Math.max(maxR, band.left + band.width);
  }
  if (editor) {
    editor.state.doc.descendants((node) => {
      if (node.type.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
        const pl = parseOptionalPx(node.attrs.posLeft);
        if (pl != null) maxR = Math.max(maxR, pl + 200);
      }
    });
  }
  if (maxR < 40) return Math.max(200, emptyFallback || 480);
  return maxR;
}

/** Current white-page content width (excludes the sticky resize handle strip). */
function readAlbumPageContentWidth(pageEl, pageSizeWidth, editor, instances) {
  const handle = PAGE_RESIZE_HANDLE_WIDTH;
  const fromPage = pageEl
    ? Math.max(0, (pageEl.clientWidth || pageEl.offsetWidth || 0) - handle)
    : 0;
  const fromPm = editor?.view?.dom?.clientWidth || 0;
  const fromSize = Number(pageSizeWidth) || 0;
  const fromContent = measureAlbumContentWidth(
    editor,
    instances,
    fromSize || fromPm || fromPage || 480
  );
  // Prefer the visible page edge (what the user is dragging), not only content bounds.
  return Math.max(200, fromPage || fromPm || fromSize || fromContent);
}

function scalePxAttr(raw, scale, min = null) {
  const n = parseOptionalPx(raw);
  if (n == null) return raw;
  const next = Math.round(n * scale);
  if (min != null) return Math.max(min, next);
  return next;
}

function scaleAlbumPageInstance(inst, scale) {
  const w0 = inst.w > 0 ? inst.w : 480;
  const h0 = inst.h > 0 ? inst.h : albumPageBlockHeight(w0, 'portrait');
  return {
    ...inst,
    x: Math.max(0, Math.round((inst.x || 0) * scale)),
    y: Math.max(0, Math.round((inst.y || 0) * scale)),
    w: Math.max(160, Math.round(w0 * scale)),
    h: Math.max(120, Math.round(h0 * scale))
  };
}

function scaleTextLabelAttrs(attrs, scale) {
  const fontSize = Number(attrs.fontSize);
  return {
    ...attrs,
    posLeft: scalePxAttr(attrs.posLeft, scale),
    posTop: scalePxAttr(attrs.posTop, scale),
    fontSize: Number.isFinite(fontSize)
      ? Math.max(10, Math.round(fontSize * scale))
      : attrs.fontSize
  };
}

/**
 * Apply a uniform page scale from origin snapshots (avoids live-drag drift).
 * Returns the next pages list.
 */
function applyAlbumPageScaleFromOrigin(editor, originPages, scale, originTextLabelsById = null) {
  const nextPages = (originPages || []).map((inst) => scaleAlbumPageInstance(inst, scale));
  if (editor && originTextLabelsById?.size) {
    const { state } = editor;
    let tr = state.tr;
    let changed = false;
    state.doc.descendants((node, pos) => {
      if (node.type.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
        const id = String(node.attrs.labelId || '');
        const origin = originTextLabelsById?.get(id);
        if (!origin) return;
        const nextAttrs = scaleTextLabelAttrs(origin, scale);
        tr = tr.setNodeMarkup(pos, undefined, nextAttrs);
        changed = true;
      }
    });
    if (changed) editor.view.dispatch(tr);
  }
  return nextPages;
}

const PAGE_RESIZE_BAR_YELLOW = 'var(--theme-yellow-color, #ffe600)';
const PAGE_RESIZE_BAR_RED = '#e53935';

/**
 * Album page actions — fixed label size, content-width buttons on one row.
 * Overflow scrolls horizontally (no font auto-fit — that ResizeObserver loop jiggled the bar).
 */
const albumBarButtonSx = {
  flex: '0 0 auto',
  flexGrow: 0,
  flexShrink: 0,
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: 'none',
  px: { xs: 0.75, sm: 1 },
  py: { xs: 0.45, sm: 0.55 },
  fontWeight: 800,
  whiteSpace: 'nowrap',
  fontSize: '0.85rem !important',
  '&.MuiButton-root': { fontSize: '0.85rem !important' },
  '&.MuiButton-sizeSmall': { fontSize: '0.85rem !important' },
  '& .MuiButton-label': { fontSize: '0.85rem !important', whiteSpace: 'nowrap' }
};

/** Scroll the currently active (bold-blinking) search hit into the middle of view. */
function scrollActiveHitIntoView(editor) {
  const dom = editor?.view?.dom;
  const active =
    dom?.querySelector('[data-rv-search-active="true"]') || dom?.querySelector('.rv-search-hit');
  if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * TipTap editor for Photo Albums pages — binder canvas, album pages, text labels.
 * Photos live in the thumbnail tray (vault attachments); they are not placed on pages.
 */
const PhotoAlbumsNoteEditor = forwardRef(function PhotoAlbumsNoteEditor(
    {
    initialContent = EMPTY_DOC,
    editable = true,
    onChange,
    onReady,
    onContentHeightChange,
    header = null,
    noteId = null,
    sharedAlbumId = null,
    storageType = null,
    /** Vault attachment rows for this album (source of truth for the thumbnail tray). */
    trayAttachments = null,
    onStageOsFiles = null,
    onRemoveStagedAttachment = null,
    onRemoveAllStagedAttachments = null,
    onAlbumFullscreenChange = null,
    /** Zoom icon — album-only view (workspace chrome hidden, not true fullscreen). */
    albumFocusView = false,
    onAlbumFocusViewChange = null,
    /** New-tab viewer: start in fullscreen chrome-off mode and fit the whole page. */
    presentationMode = false,
    presentationFullSlide = false,
    presentationPageIndex = 0,
    albumTitle = '',
    onAlbumTitleChange = null,
    /** Active vault search terms — matching pages report up to the Found bar. */
    searchTerms = null,
    /** ({ matchIndexes, pageIndex, models, orientation, noteId, storageType, onGoToPage } | null) => void */
    onSearchMatchPagesChange = null,
    /** Filmstrip page drag → another album (workspace handles drop). */
    onAlbumPageDragStart = null,
    onAlbumPageDragEnd = null,
    /** Queue the current album page into sidebar For Order. */
    onOrderPrint = null,
    /** Reset Album — wipe every TutaPhotos album on TutaCloud (workspace confirms + calls BE). */
    onResetAlbum = null,
    /** Exclusive ForOrder mode: filmstrip shows queued order pages. */
    orderAlbumActive = false,
    orderFilmstripEntries = null,
    orderFilmstripIndex = 0,
    onOrderFilmstripSelect = null,
    /** Remove a ForOrder filmstrip entry by display index. */
    onOrderFilmstripDelete = null
  },
  ref
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onContentHeightRef = useRef(onContentHeightChange);
  onContentHeightRef.current = onContentHeightChange;

  const [albumPages, setAlbumPages] = useState(() => parseAlbumPageInstancesFromHtml(initialContent));
  const trayItems = useMemo(() => buildPhotoAlbumsTrayItems(trayAttachments), [trayAttachments]);
  /** Page photos whose attachment left the tray are hidden; null when the tray list is not loaded (Full screen tab). */
  const trayAttachmentIds = useMemo(
    () => (Array.isArray(trayAttachments) ? new Set(trayItems.map((item) => item.attachmentId)) : null),
    [trayAttachments, trayItems]
  );
  /** Tray shows only photos not on any album page; taking one off a page brings it back. */
  const trayAttachmentIdsRef = useRef(trayAttachmentIds);
  trayAttachmentIdsRef.current = trayAttachmentIds;
  /**
   * Photo a page actually shows, or null. A page whose photo was deleted from the album
   * still stores the old id; it renders blank, so drops must treat it as blank too.
   */
  const shownAlbumPagePhotoId = useCallback((page) => {
    const id = page?.attachmentId;
    if (id == null) return null;
    const ids = trayAttachmentIdsRef.current;
    return ids && !ids.has(id) ? null : id;
  }, []);
  const unplacedTrayItems = useMemo(() => excludePlacedTrayItems(trayItems, albumPages), [trayItems, albumPages]);
  const [albumTitleStyle, setAlbumTitleStyle] = useState(() =>
    parseAlbumTitleStyleFromHtml(initialContent)
  );
  const [contextTutorialOpenKey] = useState(0);
  const [albumZoom, setAlbumZoom] = useState(DEFAULT_ALBUM_ZOOM);
  const [albumFullscreen, setAlbumFullscreen] = useState(() => Boolean(presentationMode));
  /** Full Slide: fullscreen + auto-advance album pages on a loop. */
  const [albumFullSlide, setAlbumFullSlide] = useState(() =>
    Boolean(presentationMode && presentationFullSlide)
  );
  const [fullSlideSec, setFullSlideSec] = useState(ALBUM_FULL_SLIDE_SEC_DEFAULT);
  const [fullSlideCountdown, setFullSlideCountdown] = useState(ALBUM_FULL_SLIDE_SEC_DEFAULT);
  const [fullSlideLoop, setFullSlideLoop] = useState(true);
  const [fullSlideAutoPlay, setFullSlideAutoPlay] = useState(true);
  const fullSlideSecRef = useRef(fullSlideSec);
  fullSlideSecRef.current = fullSlideSec;
  const fullSlideLoopRef = useRef(fullSlideLoop);
  fullSlideLoopRef.current = fullSlideLoop;

  useSlideShowMusicPlayback(Boolean(albumFullscreen && albumFullSlide));

  // Page geometry uses ProseMirror box (same coords as free-placed photos).
  const [pageSize, setPageSize] = useState({ width: 0, height: 0, offsetLeft: 0, offsetTop: 0 });
  /** Persisted page content width — survives React re-renders that would wipe DOM style.width. */
  const [albumCanvasWidthPx, setAlbumCanvasWidthPx] = useState(() => {
    const fromMarker = parseAlbumPageWidthFromHtml(initialContent);
    if (fromMarker > 0) return fromMarker;
    const list = parseAlbumPageInstancesFromHtml(initialContent);
    const w = Number(list?.[0]?.w) || 0;
    return w >= 200 ? Math.round(w) : 0;
  });
  const albumCanvasWidthPxRef = useRef(0);
  albumCanvasWidthPxRef.current = albumCanvasWidthPx;
  const [albumBinderWidthPx, setAlbumBinderWidthPx] = useState(0);
  const albumBinderWidthPxRef = useRef(0);
  albumBinderWidthPxRef.current = albumBinderWidthPx;
  /** Skip pane ResizeObserver auto-fit while a note is hydrating (preserve saved width). */
  const suppressAutoFitUntilRef = useRef(0);
  /**
   * AUTO-ZOOM: re-fit on window / swim-lane / menu resize while true.
   * Manual Zoom slider turns this off until Portrait / Landscape / Resize Page.
   */
  const albumAutoZoomRef = useRef(true);
  /** Page aspect: portrait (taller) or landscape (wider). */
  const [pageOrientation, setPageOrientation] = useState(() =>
    parseAlbumOrientationFromHtml(initialContent)
  );
  const pageOrientationRef = useRef(pageOrientation);
  pageOrientationRef.current = pageOrientation;
  /** 0-based index into album pages sorted by page order. */
  const [albumPageIndex, setAlbumPageIndex] = useState(() =>
    Math.max(0, Math.round(Number(presentationPageIndex) || 0))
  );
  const albumPageIndexRef = useRef(albumPageIndex);
  albumPageIndexRef.current = albumPageIndex;
  /**
   * Closed cover until yellow right opens the book; yellow right past the last
   * spread shows the back cover (`albumcoverback.png`). Values: 'front' | 'none' | 'back'.
   */
  const [albumCoverFace, setAlbumCoverFace] = useState('front');
  const albumCoverFaceRef = useRef(albumCoverFace);
  albumCoverFaceRef.current = albumCoverFace;
  const albumOnClosedCover = albumCoverFace === 'front' || albumCoverFace === 'back';
  const goToAlbumPageRef = useRef(null);
  const albumPagesRef = useRef(albumPages);
  albumPagesRef.current = albumPages;
  const albumTitleStyleRef = useRef(albumTitleStyle);
  albumTitleStyleRef.current = albumTitleStyle;
  const pageRef = useRef(null);
  const pageScaleRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const zoomScrollRef = useRef(null);
  /** null | { direction, frontSrc, backSrc, binderLeftPx, pageWidthPx, fullWidth } */
  const [pageFlip, setPageFlip] = useState(null);
  /** True from flip start (incl. capture) until overlay onDone — keeps nav disabled. */
  const [pageFlipBusyUi, setPageFlipBusyUi] = useState(false);
  const pageFlipBusyRef = useRef(false);
  const pageFlipApplyRef = useRef(null);
  const runAlbumPageFlipThenRef = useRef(null);
  const [pageResizeDragging, setPageResizeDragging] = useState(false);
  const [placeTextOpen, setPlaceTextOpen] = useState(false);
  const [placeTextSeed, setPlaceTextSeed] = useState('');
  const [placeTextStyle, setPlaceTextStyle] = useState(null);
  /** Double-clicked page photo shown in Add Text: ids + its frame in page px. */
  const [placeTextPhoto, setPlaceTextPhoto] = useState(null);
  const placeTextPhotoRef = useRef(null);
  placeTextPhotoRef.current = placeTextPhoto;
  const placeTextSelectionRef = useRef({ from: 0, to: 0, empty: true });
  /** When set, Add Text OK updates this label instead of inserting a new one. */
  const placeTextEditingLabelIdRef = useRef(null);
  const placeTextEditingPosRef = useRef(null);
  /** When true, Add Text OK updates album-wide page title style (all pages). */
  const placeTextAlbumTitleModeRef = useRef(false);
  /** Optional page coords for a new label. */
  const placeTextPagePosRef = useRef(null);
  /** Pixel box of ProseMirror inside pageScaleRef — page overlays use this origin. */
  const [pmLayerBox, setPmLayerBox] = useState({ left: 0, top: 0, width: 0, height: 0 });


  const handleAlbumZoomChange = useCallback((next) => {
    // User override — stop AUTO-ZOOM until Portrait / Landscape / Resize Page.
    albumAutoZoomRef.current = false;
    setAlbumZoom(next);
  }, []);

  /** When data remaining ≤ 0, wait out the traffic popup then run the action. */
  const runAfterTrafficWait = useCallback((fn) => {
    void (async () => {
      await runPhotoAlbumsTrafficWaitIfNeeded();
      fn?.();
    })();
  }, []);

  const emitHtml = useCallback((rawHtml) => {
    onChangeRef.current?.(
      withAlbumMarkers(
        rawHtml,
        albumPagesRef.current,
        pageOrientationRef.current,
        albumCanvasWidthPxRef.current,
        albumTitleStyleRef.current
      )
    );
  }, []);

  const onAlbumFullscreenChangeRef = useRef(onAlbumFullscreenChange);
  onAlbumFullscreenChangeRef.current = onAlbumFullscreenChange;
  const onAlbumFocusViewChangeRef = useRef(onAlbumFocusViewChange);
  onAlbumFocusViewChangeRef.current = onAlbumFocusViewChange;

  const albumEditorChromeHidden = albumFullscreen || albumFocusView;
  const albumZoomBarHidden = albumFullscreen;

  /** View-only while Full screen — no chrome / no edits. */
  const effectiveEditable = editable && !albumFullscreen;

  const editor = useEditor({
    extensions: buildPhotoAlbumsEditorExtensions(),
    content: stripAlbumMarkers(initialContent) || EMPTY_DOC,
    editable: effectiveEditable,
    immediatelyRender: false,
    editorProps: {
      // Album zoom-pane owns scrolling — do not jump after insert/focus/drop.
      handleScrollToSelection: () => true,
      // Kill native browser drag of text labels (huge translucent ghost).
      handleDOMEvents: {
        dragstart: (_view, event) => {
          const t = event?.target;
          if (!(t instanceof Element)) return false;
          if (t.closest('.rv-text-label')) {
            event.preventDefault();
            return true;
          }
          return false;
        }
      },
      // Vault / Finder / staging drags are handled by the page shell.
      // Block TipTap from inserting drag text (e.g. "Set 1-Album 1.html", "pa-staged:N").
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const dt = event?.dataTransfer;
        if (!dt) return false;
        if (isFilesExplorerDrag(dt)) {
          return true;
        }
        const types = dt.types ? Array.from(dt.types) : [];
        if (
          types.includes('Files') ||
          types.includes('DownloadURL') ||
          types.includes(DRAG_NOTE) ||
          types.includes(DRAG_NOTE_IDS) ||
          types.includes(DRAG_NOTEBOOK) ||
          types.includes(DRAG_SHORTCUT) ||
          types.includes(DRAG_ALBUM_PAGE) ||
          types.includes(DRAG_CROSS_PANE) ||
          types.includes(DRAG_TRAY_PHOTO) ||
          types.includes(DRAG_PAGE_PHOTO) ||
          types.includes(DRAG_FILES_EXPLORER) ||
          types.includes(DRAG_FILES_EXPLORER_FLAG)
        ) {
          return true;
        }
        const plain = String(dt.getData?.('text/plain') || '').trim();
        if (isPhotoAlbumsDragJunkPlain(plain)) return true;
        return false;
      },
      handlePaste: (_view, event) => {
        const plain = String(event?.clipboardData?.getData?.('text/plain') || '').trim();
        if (isPhotoAlbumsDragJunkPlain(plain)) {
          event.preventDefault();
          return true;
        }
        return false;
      }
    },
    onUpdate: ({ editor: e }) => {
      emitHtml(e.getHTML());
    }
  });

  const applyAlbumCanvasWidth = useCallback(
    (width, binderWidthPx = albumBinderWidthPxRef.current) => {
      const need = setAlbumCanvasWidth(editor, width, binderWidthPx);
      if (need > 0) setAlbumCanvasWidthPx(need);
      return need;
    },
    [editor]
  );

  const syncAlbumBinderFromViewport = useCallback((scrollEl, zoomPercent = 100, options = {}) => {
    const layout = resolveAlbumViewportLayout(scrollEl, zoomPercent, options);
    const { binderWidthPx } = layout;
    setAlbumBinderWidthPx(binderWidthPx);
    albumBinderWidthPxRef.current = binderWidthPx;
    const pw =
      albumCanvasWidthPxRef.current >= 200
        ? albumCanvasWidthPxRef.current
        : layout.pageWidthPx;
    applyAlbumBinderWidthToDom(scrollEl, binderWidthPx, pw);
    return binderWidthPx;
  }, []);

  /**
   * Enter / Reset Page / Resize Page: size page to the black shell, then zoom so
   * the entire binder + page is visible (no vertical scroll).
   * Presentation / Full screen: keep saved page geometry; zoom (incl. >100%) to fill
   * the window — no extra canvas height (that left a binder “yellow” strip below the page).
   */
  const fitAlbumPageFlushToViewport = useCallback(() => {
    if (!editor) return 0;
    const slideshowBinder = Boolean(albumFullscreen && albumFullSlide);

    if (presentationMode || albumFullscreen) {
      const applyPresentationFit = () => {
        const scrollEl = zoomScrollRef.current;
        flushAlbumScrollOrigin(scrollEl);
        const fromPages = Math.round(Number(albumPagesRef.current?.[0]?.w) || 0);
        const pages = sortAlbumPagesByBand(albumPagesRef.current || []);
        const activePage = pages[albumPageIndexRef.current] || pages[0] || null;
        const pw =
          (albumCanvasWidthPxRef.current >= 200 ? albumCanvasWidthPxRef.current : 0) ||
          (fromPages >= 200 ? fromPages : 0) ||
          (activePage?.w >= 200 ? Math.round(activePage.w) : 0) ||
          albumPageWidthFromViewport(scrollEl, 100) ||
          480;
        const binderW = syncAlbumBinderFromViewport(scrollEl, 100, { slideshow: slideshowBinder });
        applyAlbumCanvasWidth(pw, binderW);
        const orient = pageOrientationRef.current;
        const blockH =
          activePage?.h > 40
            ? Math.round(activePage.h)
            : albumPageBlockHeight(pw, orient);
        // Exact one-page height — do not add the edit-mode +240 gutter.
        ensureAlbumCanvasMinHeight(editor, blockH, { allowShrink: true });
        // No page-edge resize handle in view mode.
        const layoutW =
          albumSpreadCanvasWidth(pw, binderW) +
          (albumFullscreen ? 0 : PAGE_RESIZE_HANDLE_WIDTH);
        setAlbumZoom(
          computeAlbumPageFitZoom(scrollEl, layoutW, Math.max(blockH, 200), {
            allowUpscale: true
          })
        );
        flushAlbumScrollOrigin(scrollEl);
        return pw;
      };
      let pw = applyPresentationFit();
      requestAnimationFrame(() => {
        pw = applyPresentationFit();
        requestAnimationFrame(() => {
          pw = applyPresentationFit();
        });
      });
      return pw;
    }

    const applyFit = () => {
      const scrollEl = zoomScrollRef.current;
      flushAlbumScrollOrigin(scrollEl);
      // Size layout as if zoom were 100%, then scale zoom down to fit height + width.
      const { layoutTarget, binderWidthPx, pageWidthPx } = resolveAlbumViewportLayout(scrollEl, 100);
      albumBinderWidthPxRef.current = binderWidthPx;
      setAlbumBinderWidthPx(binderWidthPx);
      const pw = pageWidthPx;
      applyAlbumBinderWidthToDom(scrollEl, binderWidthPx, pw);
      applyAlbumCanvasWidth(pw, binderWidthPx);
      const orient = pageOrientationRef.current;
      const current = albumPagesRef.current || [];
      const blockH = albumPageBlockHeight(pw, orient);
      // Shell height includes the album title footer band — omit it and top/bottom
      // primary margin disappears (page paints taller than the fit assumed).
      const titleBand = String(albumTitle || '').trim()
        ? albumPageTitleBandHeightPx(albumTitleStyleRef.current)
        : 0;
      const viewH = Math.max(blockH, 200) + titleBand;
      if (current.length) {
        const next = restackAlbumPagesFlush(
          sortAlbumPagesByBand(current),
          pw,
          orient,
          editor,
          binderWidthPx
        );
        const geometryUnchanged =
          next.length === current.length &&
          next.every((inst, i) => {
            const prev = current[i];
            return (
              prev &&
              inst.key === prev.key &&
              inst.id === prev.id &&
              Math.round(Number(inst.x) || 0) === Math.round(Number(prev.x) || 0) &&
              Math.round(Number(inst.y) || 0) === Math.round(Number(prev.y) || 0) &&
              Math.round(Number(inst.w) || 0) === Math.round(Number(prev.w) || 0) &&
              Math.round(Number(inst.h) || 0) === Math.round(Number(prev.h) || 0)
            );
          });
        albumPagesRef.current = next;
        if (!geometryUnchanged) {
          setAlbumPages(next);
          emitHtml(editor.getHTML());
        }
        // Shell shows one book page — do not grow canvas for stacked page bands.
        ensureAlbumCanvasMinHeight(editor, viewH, { allowShrink: true });
      } else {
        ensureAlbumCanvasMinHeight(editor, viewH, { allowShrink: true });
      }
      const layoutW =
        albumSpreadCanvasWidth(pw, binderWidthPx) +
        (albumFullscreen ? 0 : PAGE_RESIZE_HANDLE_WIDTH);
      // Must match `.rv-editor__body--album` / page height (content + title band).
      const layoutH = Math.max(viewH, 200);
      const fitZoom = computeAlbumPageFitZoom(scrollEl, layoutW, layoutH);
      setAlbumZoom(fitZoom);
      flushAlbumScrollOrigin(scrollEl);
      return pw;
    };
    let pw = applyFit();
    requestAnimationFrame(() => {
      pw = applyFit();
      requestAnimationFrame(() => {
        pw = applyFit();
      });
    });
    return pw;
  }, [
    editor,
    applyAlbumCanvasWidth,
    emitHtml,
    presentationMode,
    albumFullscreen,
    albumFullSlide,
    syncAlbumBinderFromViewport,
    albumTitle
  ]);

  const fitAlbumPageFlushToViewportRef = useRef(fitAlbumPageFlushToViewport);
  fitAlbumPageFlushToViewportRef.current = fitAlbumPageFlushToViewport;

  /**
   * Portrait (10×12) / Landscape (12×10) — every page in this album
   * switches aspect together (restacked flush); page w×h changes.
   */
  const applyPageOrientation = useCallback(
    (nextOrientation) => {
      if (!editor) return;
      // Re-enable AUTO-ZOOM (same as Resize Page).
      albumAutoZoomRef.current = true;
      const mode =
        String(nextOrientation || '').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
      setPageOrientation(mode);
      pageOrientationRef.current = mode;

      const pw =
        albumCanvasWidthPx > 0
          ? albumCanvasWidthPx
          : albumPageWidthFromViewport(zoomScrollRef.current) || pageSize.width || 480;
      applyAlbumCanvasWidth(pw);
      const nextBlockH = albumPageBlockHeight(pw, mode);
      const current = albumPagesRef.current || [];

      if (!current.length) {
        ensureAlbumCanvasMinHeight(editor, nextBlockH, { allowShrink: true });
        requestAnimationFrame(() => {
          emitHtml(editor.getHTML());
          fitAlbumPageFlushToViewportRef.current?.();
        });
        return;
      }

      const next = restackAlbumPagesFlush(
        sortAlbumPagesByBand(current),
        pw,
        mode,
        editor,
        albumBinderWidthPxRef.current
      );
      albumPagesRef.current = next;
      setAlbumPages(next);
      ensureAlbumCanvasMinHeight(editor, nextBlockH, { allowShrink: true });
      requestAnimationFrame(() => {
        emitHtml(editor.getHTML());
        fitAlbumPageFlushToViewportRef.current?.();
      });
    },
    [editor, albumCanvasWidthPx, pageSize.width, applyAlbumCanvasWidth, emitHtml]
  );

  // Re-apply after React/MUI style reconciliation so the edge does not jump on mouseup.
  // ProseMirror must span both pages + binder — omitting binder width clips the right page.
  useLayoutEffect(() => {
    if (!(albumCanvasWidthPx > 0) || !editor) return;
    albumBinderWidthPxRef.current = albumBinderWidthPx;
    setAlbumCanvasWidth(editor, albumCanvasWidthPx, albumBinderWidthPx);
  }, [albumCanvasWidthPx, albumBinderWidthPx, editor, albumPages, pageResizeDragging]);

  useLayoutEffect(() => {
    if (!(albumBinderWidthPx > 0)) return;
    applyAlbumBinderWidthToDom(
      zoomScrollRef.current,
      albumBinderWidthPx,
      albumCanvasWidthPx
    );
  }, [albumBinderWidthPx, albumCanvasWidthPx]);

  /** Migrate legacy / bloated page geometry into left|binder|right columns. Always remaps photos. */
  useLayoutEffect(() => {
    if (!editor) return;
    const current = albumPagesRef.current || [];
    if (!current.length) return;
    const pw = albumSinglePageWidth(
      pageSize.width,
      albumCanvasWidthPxRef.current,
      albumBinderWidthPxRef.current
    );
    let bw = albumBinderWidthPxRef.current;
    if (!(bw > 0)) {
      bw = resolveAlbumViewportLayout(zoomScrollRef.current, 100).binderWidthPx;
      albumBinderWidthPxRef.current = bw;
      setAlbumBinderWidthPx(bw);
    }
    const orient = pageOrientationRef.current;
    if (!albumPagesNeedSpreadRestack(current, pw, bw, orient)) return;
    const next = restackAlbumPagesFlush(
      sortAlbumPagesByBand(current),
      pw,
      orient,
      editor,
      bw
    );
    albumPagesRef.current = next;
    setAlbumPages(next);
    if (bw > 0) albumBinderWidthPxRef.current = bw;
    setAlbumCanvasWidth(editor, pw, bw);
    setAlbumCanvasWidthPx(pw);
    requestAnimationFrame(() => emitHtml(editor.getHTML()));
  }, [editor, noteId, albumBinderWidthPx, albumCanvasWidthPx, emitHtml, pageSize.width]);

  /**
   * Entering album / switching note / presentation: fit entire page in the black shell.
   */
  useLayoutEffect(() => {
    if (!editor) return undefined;
    // New album/note — turn AUTO-ZOOM back on and fit.
    albumAutoZoomRef.current = true;
    // Block pane auto-fit briefly so this fit wins over menu/window RO churn.
    suppressAutoFitUntilRef.current = Date.now() + 400;
    fitAlbumPageFlushToViewport();
    const timer = window.setTimeout(() => fitAlbumPageFlushToViewport(), 120);
    const timer2 = window.setTimeout(() => fitAlbumPageFlushToViewport(), 400);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timer2);
    };
  }, [editor, noteId, fitAlbumPageFlushToViewport]);

  /** Clear leftover drag junk TipTap inserted from vault / Finder / staging drops. */
  useEffect(() => {
    if (!editor) return;
    if (purgeAlbumDragJunkFromEditor(editor)) {
      emitHtml(editor.getHTML());
    }
  }, [editor, noteId, emitHtml]);

  /** Full screen / SlideShow page flip — re-fit if page band or binder mode differs. */
  useEffect(() => {
    if (!editor || !(presentationMode || albumFullscreen)) return;
    const t = window.setTimeout(() => fitAlbumPageFlushToViewportRef.current?.(), 50);
    return () => window.clearTimeout(t);
  }, [editor, albumPageIndex, presentationMode, albumFullscreen, albumFullSlide, albumCoverFace]);

  /** Opening a different album always starts on the closed front cover. */
  useEffect(() => {
    setAlbumCoverFace('front');
  }, [noteId]);

  /**
   * Yellow + grey-dash page edge (matches column splitters; dash turns red on hover/drag).
   * Drag resizes the page; pages + photos scale together.
   * Live preview uses CSS transform (slider-smooth); geometry is baked on mouseup.
   */
  const startPageContentResize = useCallback(
    (event) => {
      if (!effectiveEditable || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const pageEl = pageRef.current;
      const scaleEl = pageScaleRef.current;
      if (!pageEl || !scaleEl || !editor) return;

      const zoomScale = Math.max(0.01, (Number(albumZoom) || 100) / 100);
      const startX = event.clientX;
      const originPages = (albumPagesRef.current || []).map((inst) => ({ ...inst }));
      const originTextLabelsById = new Map();
      editor.state.doc.descendants((node) => {
        if (node.type.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
          const id = String(node.attrs.labelId || '');
          if (!id) return;
          originTextLabelsById.set(id, { ...node.attrs });
        }
      });
      const originWidth = readAlbumPageContentWidth(
        pageEl,
        pageSize.width || albumCanvasWidthPx,
        editor,
        originPages
      );
      const originHeight = Math.max(
        scaleEl.offsetHeight || 0,
        pageEl.offsetHeight || 0,
        lowestAlbumPageBottom(originPages) + 240
      );

      let latestScale = 1;
      let latestWidth = originWidth;
      let raf = 0;
      let pendingScale = null;

      setPageResizeDragging(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      const paintPreview = (scale, width) => {
        scaleEl.style.transformOrigin = '0 0';
        scaleEl.style.transform = scale === 1 ? '' : `scale(${scale})`;
        const pageW = Math.round(width) + PAGE_RESIZE_HANDLE_WIDTH;
        pageEl.style.width = `${pageW}px`;
        pageEl.style.minWidth = `${pageW}px`;
        pageEl.style.maxWidth = `${pageW}px`;
        pageEl.style.height = `${Math.round(originHeight * scale)}px`;
        pageEl.style.minHeight = pageEl.style.height;
      };

      const flush = () => {
        raf = 0;
        if (pendingScale == null) return;
        const scale = pendingScale;
        pendingScale = null;
        latestScale = scale;
        latestWidth = Math.max(200, Math.round(originWidth * scale));
        paintPreview(scale, latestWidth);
      };

      const onMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / zoomScale;
        const nextW = Math.max(200, Math.round(originWidth + dx));
        pendingScale = nextW / Math.max(1, originWidth);
        if (!raf) raf = requestAnimationFrame(flush);
      };

      const onUp = () => {
        cancelAnimationFrame(raf);
        if (pendingScale != null) {
          latestScale = pendingScale;
          latestWidth = Math.max(200, Math.round(originWidth * latestScale));
          pendingScale = null;
        }
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');

        scaleEl.style.transform = '';
        scaleEl.style.transformOrigin = '';
        pageEl.style.removeProperty('height');
        pageEl.style.removeProperty('min-height');

        // Commit width to React state BEFORE re-render flags so MUI cannot wipe it.
        applyAlbumCanvasWidth(latestWidth);

        if (Math.abs(latestScale - 1) < 0.0001) {
          setPageResizeDragging(false);
          return;
        }

        const next = applyAlbumPageScaleFromOrigin(
          editor,
          originPages,
          latestScale,
          originTextLabelsById
        );
        albumPagesRef.current = next;
        setAlbumPages(next);
        const bottom = lowestAlbumPageBottom(next);
        if (bottom > 0) ensureAlbumCanvasMinHeight(editor, bottom, { allowShrink: true });
        setPageResizeDragging(false);
        requestAnimationFrame(() => {
          applyAlbumCanvasWidth(latestWidth);
          emitHtml(editor.getHTML());
        });
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [
      effectiveEditable,
      albumZoom,
      editor,
      pageSize.width,
      albumCanvasWidthPx,
      applyAlbumCanvasWidth,
      emitHtml
    ]
  );

  useEffect(() => {
    if (editor && editor.isEditable !== effectiveEditable) editor.setEditable(effectiveEditable);
  }, [editor, effectiveEditable]);

  useEffect(() => {
    if (editor) onReadyRef.current?.();
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    const pmEl = editor.view.dom;
    const report = () => {
      const body = pmEl.closest('.rv-editor__body') || pmEl.parentElement;
      const root = body?.closest('.rv-editor');
      if (!root || !body) return;
      const chrome = Math.max(0, root.clientHeight - body.clientHeight);
      onContentHeightRef.current?.(Math.round(chrome + pmEl.scrollHeight));
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(pmEl);
    editor.on('update', report);
    return () => {
      observer.disconnect();
      editor.off('update', report);
    };
  }, [editor]);

  // Align overlay layer to ProseMirror so yellow/red 9-dots share photo coordinates.
  useEffect(() => {
    const root = pageScaleRef.current;
    const pm = editor?.view?.dom;
    if (!root || !pm) return undefined;

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const pmRect = pm.getBoundingClientRect();
      const scale =
        rootRect.width > 0 && root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
      const left = Math.round((pmRect.left - rootRect.left) / (scale || 1));
      const top = Math.round((pmRect.top - rootRect.top) / (scale || 1));
      const width = Math.round(pmRect.width / (scale || 1));
      const height = Math.max(
        Math.round(pmRect.height / (scale || 1)),
        Math.round(pm.scrollHeight)
      );
      setPmLayerBox((prev) =>
        prev.left === left &&
        prev.top === top &&
        prev.width === width &&
        prev.height === height
          ? prev
          : { left, top, width, height }
      );
      setPageSize({
        // Always one page column — never ProseMirror’s full spread width.
        width:
          albumCanvasWidthPxRef.current >= 200
            ? albumCanvasWidthPxRef.current
            : Math.max(
                200,
                Math.round(
                  ((Math.round(pm.clientWidth) || width) - (albumBinderWidthPxRef.current || 0)) /
                    ALBUM_SPREAD_PAGE_COUNT
                )
              ),
        height: Math.max(Math.round(pm.clientHeight), Math.round(pm.scrollHeight)),
        offsetLeft: 0,
        offsetTop: 0
      });
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    observer.observe(pm);
    editor.on('update', measure);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      editor.off('update', measure);
      window.removeEventListener('resize', measure);
    };
  }, [editor, albumPages, albumZoom]);

  const persistAlbumPages = useCallback(
    (nextList) => {
      const list = Array.isArray(nextList) ? nextList : [];
      albumPagesRef.current = list;
      setAlbumPages(list);
      if (editor) requestAnimationFrame(() => emitHtml(editor.getHTML()));
    },
    [editor, emitHtml]
  );

  /**
   * Open Add Text styling popup. Uses selected text as the seed when present.
   * Optional `pagePos` places the new label at those page coords.
   */
  const handlePlaceFloatingText = useCallback((pagePos = null) => {
    if (!editor || !effectiveEditable) return;
    const { state } = editor;
    const { from, to, empty } = state.selection;
    const isNodeSelection = state.selection instanceof NodeSelection;
    // Atom selection must not be deleted on OK — only plain text.
    const replaceableText = !empty && !isNodeSelection;
    const text = replaceableText
      ? state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim()
      : '';
    placeTextSelectionRef.current = {
      from,
      to,
      empty: !replaceableText || !text,
      replaceableText: Boolean(replaceableText && text)
    };
    placeTextEditingLabelIdRef.current = null;
    placeTextEditingPosRef.current = null;
    placeTextAlbumTitleModeRef.current = false;
    const left = Number(pagePos?.posLeft);
    const top = Number(pagePos?.posTop);
    placeTextPagePosRef.current =
      Number.isFinite(left) && Number.isFinite(top)
        ? { posLeft: Math.max(0, Math.round(left)), posTop: Math.max(0, Math.round(top)) }
        : null;
    setPlaceTextStyle(null);
    setPlaceTextSeed(text);
    setPlaceTextOpen(true);
  }, [editor, effectiveEditable]);

  /** Double-click an existing label — reopen Add Text with its full style. */
  const handleEditExistingTextLabel = useCallback(
    (payload) => {
      if (!editor || !effectiveEditable || !payload) return;
      placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
      placeTextEditingLabelIdRef.current = payload.labelId || null;
      placeTextEditingPosRef.current = Number.isFinite(payload.pos) ? payload.pos : null;
      placeTextAlbumTitleModeRef.current = false;
      placeTextPagePosRef.current = null;
      setPlaceTextSeed(String(payload.text || '').trim());
      const editStyle = {
        text: String(payload.text || '').trim(),
        color: payload.color,
        outlineColor: payload.outlineColor,
        outlineWidth: payload.outlineWidth,
        fontSize: payload.fontSize,
        fontFamily: payload.fontFamily,
        fontWeight: payload.fontWeight
      };
      setPlaceTextStyle(editStyle);
      setPlaceTextOpen(true);
    },
    [editor, effectiveEditable]
  );

  /** Double-click album page title — style applies to every page. */
  const handleEditAlbumPageTitle = useCallback(() => {
    if (!editable) return;
    placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
    placeTextEditingLabelIdRef.current = null;
    placeTextEditingPosRef.current = null;
    placeTextAlbumTitleModeRef.current = true;
    placeTextPagePosRef.current = null;
    setPlaceTextSeed(String(albumTitle || '').trim());
    setPlaceTextStyle({ ...albumTitleStyleRef.current });
    setPlaceTextOpen(true);
  }, [editable, albumTitle]);

  /** Close Add Text → drop any node selection left behind. */
  const exitPlaceTextToNormalAlbum = useCallback(() => {
    if (!editor) return;
    requestAnimationFrame(() => {
      try {
        const { state, dispatch } = editor.view;
        if (state.selection instanceof NodeSelection) {
          dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)));
        }
      } catch {
        // ignore
      }
    });
  }, [editor]);

  const handlePlaceTextConfirm = useCallback(
    (style) => {
      if (!editor || !editable) return;
      setPlaceTextOpen(false);
      setPlaceTextPhoto(null);

      if (placeTextAlbumTitleModeRef.current) {
        placeTextAlbumTitleModeRef.current = false;
        const nextStyle = {
          color: style?.color || DEFAULT_ALBUM_TITLE_STYLE.color,
          outlineColor: style?.outlineColor || DEFAULT_ALBUM_TITLE_STYLE.outlineColor,
          outlineWidth:
            style?.outlineWidth != null
              ? style.outlineWidth
              : DEFAULT_ALBUM_TITLE_STYLE.outlineWidth,
          fontSize: style?.fontSize || DEFAULT_ALBUM_TITLE_STYLE.fontSize,
          fontFamily: style?.fontFamily || DEFAULT_ALBUM_TITLE_STYLE.fontFamily,
          fontWeight: style?.fontWeight || DEFAULT_ALBUM_TITLE_STYLE.fontWeight
        };
        albumTitleStyleRef.current = nextStyle;
        setAlbumTitleStyle(nextStyle);
        const nextTitle = String(style?.text || '').trim();
        if (nextTitle && nextTitle !== String(albumTitle || '').trim()) {
          onAlbumTitleChange?.(nextTitle);
        }
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
        setPlaceTextStyle(null);
        setPlaceTextSeed('');
        exitPlaceTextToNormalAlbum();
        return;
      }

      const editingLabelId = placeTextEditingLabelIdRef.current;
      const editingPos = placeTextEditingPosRef.current;
      placeTextEditingLabelIdRef.current = null;
      placeTextEditingPosRef.current = null;

      placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
      setPlaceTextStyle(null);
      setPlaceTextSeed('');

      const applyStyleAttrs = (baseAttrs) => ({
        ...baseAttrs,
        text: String(style?.text || '').trim() || baseAttrs.text || 'Text',
        color: style?.color || baseAttrs.color || PLACE_TEXT_DEFAULTS.color,
        outlineColor:
          style?.outlineColor || baseAttrs.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
        outlineWidth:
          style?.outlineWidth != null
            ? style.outlineWidth
            : baseAttrs.outlineWidth ?? PLACE_TEXT_DEFAULTS.outlineWidth,
        fontSize: style?.fontSize || baseAttrs.fontSize || PLACE_TEXT_DEFAULTS.fontSize,
        fontFamily: style?.fontFamily || baseAttrs.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
        fontWeight: style?.fontWeight || baseAttrs.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight
      });

      if (editingLabelId || editingPos != null) {
        const { state } = editor;
        let foundPos = null;
        let foundNode = null;
        if (editingPos != null) {
          const at = state.doc.nodeAt(editingPos);
          if (at?.type?.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
            foundPos = editingPos;
            foundNode = at;
          }
        }
        if (!foundNode && editingLabelId) {
          state.doc.descendants((node, pos) => {
            if (foundNode) return false;
            if (node.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) return;
            if (String(node.attrs.labelId || '') !== String(editingLabelId)) return;
            foundPos = pos;
            foundNode = node;
            return false;
          });
        }
        if (foundNode != null && foundPos != null) {
          editor.view.dispatch(
            state.tr.setNodeMarkup(foundPos, undefined, applyStyleAttrs(foundNode.attrs))
          );
          requestAnimationFrame(() => emitHtml(editor.getHTML()));
        }
        exitPlaceTextToNormalAlbum();
        return;
      }

      const scroll = zoomScrollRef.current;
      const pm = editor.view?.dom;
      let posLeft = 80;
      let posTop = 120;
      const photo = placeTextPhotoRef.current;
      const fx = Number(style?.photoAnchor?.fx);
      const fy = Number(style?.photoAnchor?.fy);
      const anchored =
        photo && Number.isFinite(fx) && Number.isFinite(fy)
          ? {
              posLeft: Math.round(photo.frameLeft + fx * photo.frameWidth),
              posTop: Math.round(photo.frameTop + fy * photo.frameHeight)
            }
          : placeTextPagePosRef.current;
      placeTextPagePosRef.current = null;
      if (anchored) {
        posLeft = anchored.posLeft;
        posTop = anchored.posTop;
      } else if (scroll && pm) {
        const zoomScale = Math.max(0.01, (Number(albumZoom) || 100) / 100);
        const sRect = scroll.getBoundingClientRect();
        const pRect = pm.getBoundingClientRect();
        const cx = sRect.left + sRect.width * 0.45;
        const cy = sRect.top + sRect.height * 0.35;
        posLeft = Math.max(0, Math.round((cx - pRect.left) / zoomScale));
        posTop = Math.max(0, Math.round((cy - pRect.top) / zoomScale));
      }

      const attrs = {
        labelId: newLabelId(),
        text: String(style?.text || '').trim() || 'Text',
        color: style?.color || PLACE_TEXT_DEFAULTS.color,
        outlineColor: style?.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
        outlineWidth:
          style?.outlineWidth != null ? style.outlineWidth : PLACE_TEXT_DEFAULTS.outlineWidth,
        fontSize: style?.fontSize || PLACE_TEXT_DEFAULTS.fontSize,
        fontFamily: style?.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
        fontWeight: style?.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight,
        rotationDeg: PLACE_TEXT_DEFAULTS.rotationDeg,
        posLeft,
        posTop
      };

      const sel = placeTextSelectionRef.current || { empty: true, replaceableText: false };
      // Only replace when the user had highlighted plain text — never delete a photo node.
      if (
        sel.replaceableText &&
        !sel.empty &&
        Number.isFinite(sel.from) &&
        Number.isFinite(sel.to) &&
        sel.to > sel.from
      ) {
        editor
          .chain()
          .focus(null, { scrollIntoView: false })
          .deleteRange({ from: sel.from, to: sel.to })
          .insertContent({ type: PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME, attrs })
          .run();
      } else {
        // TipTap replace-selected-node behavior: insertContent() would wipe a selected
        // photo. Always append at end; label placement uses posLeft/posTop attrs.
        const { state, view } = editor;
        if (state.selection instanceof NodeSelection) {
          const near = Math.min(state.doc.content.size, state.selection.to);
          view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(near))));
        }
        const insertAt = editor.state.doc.content.size;
        editor
          .chain()
          .focus(null, { scrollIntoView: false })
          .insertContentAt(insertAt, { type: PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME, attrs })
          .run();
      }
      requestAnimationFrame(() => emitHtml(editor.getHTML()));
      exitPlaceTextToNormalAlbum();
    },
    [editor, editable, albumZoom, emitHtml, albumTitle, onAlbumTitleChange, exitPlaceTextToNormalAlbum]
  );

  useEffect(() => {
    if (!editor) return undefined;
    const store = editor.storage?.[PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME];
    if (!store) return undefined;
    store.onRequestPlaceTextEdit = handleEditExistingTextLabel;
    return () => {
      if (store.onRequestPlaceTextEdit === handleEditExistingTextLabel) {
        store.onRequestPlaceTextEdit = null;
      }
    };
  }, [editor, handleEditExistingTextLabel]);

  /** Clear page text/pages; zoom 95%; flush + stretch to edge. Tray photos are untouched. */
  const handleResetPage = useCallback(() => {
    if (!editor) return;

    setPageOrientation('portrait');
    pageOrientationRef.current = 'portrait';
    setAlbumPageIndex(0);

    // Clear remaining text / empty the page body.
    editor.commands.setContent(EMPTY_DOC, { emitUpdate: false });

    albumPagesRef.current = [];
    setAlbumPages([]);
    persistAlbumPages([]);
    albumAutoZoomRef.current = true;
    fitAlbumPageFlushToViewport();
    requestAnimationFrame(() => emitHtml(editor.getHTML()));
  }, [editor, persistAlbumPages, emitHtml, fitAlbumPageFlushToViewport]);

  /** Fit entire album page into the shell (AUTO-ZOOM on) — no scrollbars. */
  const handleResizePage = useCallback(() => {
    if (!editor) return;
    albumAutoZoomRef.current = true;
    fitAlbumPageFlushToViewport();
  }, [editor, fitAlbumPageFlushToViewport]);

  /**
   * AUTO-ZOOM: menu shrink/expand, swim-lane drag, or browser resize.
   * Skipped while hydrating, page-edge dragging, or after a manual Zoom override.
   */
  useEffect(() => {
    if (!editor) return undefined;
    const el = zoomScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    let lastW = el.clientWidth;
    let lastH = el.clientHeight;
    let timer = 0;
    const scheduleFit = () => {
      if (!albumAutoZoomRef.current) return;
      if (pageResizeDragging) return;
      if (Date.now() < suppressAutoFitUntilRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!albumAutoZoomRef.current) return;
        if (pageResizeDragging) return;
        if (Date.now() < suppressAutoFitUntilRef.current) return;
        fitAlbumPageFlushToViewportRef.current?.();
      }, 180);
    };

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Ignore tiny noise that caused rapid re-fit jiggle.
      if (Math.abs(w - lastW) < 12 && Math.abs(h - lastH) < 12) return;
      lastW = w;
      lastH = h;
      scheduleFit();
    });
    ro.observe(el);

    const onWinResize = () => scheduleFit();
    window.addEventListener('resize', onWinResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.clearTimeout(timer);
    };
  }, [editor, pageResizeDragging, noteId]);

  const exitAlbumFullscreen = useCallback(() => {
    if (presentationMode) {
      try {
        window.close();
      } catch {
        // Popup may already be closed.
      }
      return;
    }
    setAlbumFullscreen(false);
    setAlbumFullSlide(false);
    onAlbumFullscreenChangeRef.current?.(false);
    requestAnimationFrame(() => fitAlbumPageFlushToViewportRef.current?.());
  }, [presentationMode]);

  const toggleAlbumFocusView = useCallback(() => {
    if (presentationMode || albumFullscreen) return;
    const next = !albumFocusView;
    onAlbumFocusViewChangeRef.current?.(next);
    requestAnimationFrame(() => {
      fitAlbumPageFlushToViewportRef.current?.();
      flushAlbumScrollOrigin(zoomScrollRef.current);
    });
  }, [albumFocusView, albumFullscreen, presentationMode]);

  /**
   * Full screen / Full Slide: open a new tab that shows the entire album page
   * (auto-fit zoom). Falls back to an in-app overlay if the popup is blocked.
   */
  const enterAlbumFullscreen = useCallback(
    (opts = {}) => {
      if (!editor) return;

      const current = albumPagesRef.current || [];
      if (!current.length) {
        const pw = albumPageWidthFromViewport(zoomScrollRef.current);
        applyAlbumCanvasWidth(pw);
        syncAlbumBinderFromViewport(zoomScrollRef.current);
        const orient = pageOrientationRef.current;
        const nextBlockH = albumPageBlockHeight(pw, orient);
        const working = createAlbumPageInstance({
          x: 0,
          y: 0,
          w: pw,
          h: nextBlockH
        });
        albumPagesRef.current = [working];
        setAlbumPages([working]);
        ensureAlbumCanvasMinHeight(editor, nextBlockH, { allowShrink: true });
        emitHtml(editor.getHTML());
      }

      const html = withAlbumMarkers(
        editor.getHTML(),
        albumPagesRef.current,
        pageOrientationRef.current,
        albumCanvasWidthPxRef.current,
        albumTitleStyleRef.current
      );
      const storageKey = storePhotoAlbumsPresentation({
        html,
        noteId: noteId != null && Number(noteId) > 0 ? Number(noteId) : null,
        storageType: storageType || null,
        pageIndex: albumPageIndexRef.current,
        fullSlide: Boolean(opts?.fullSlide),
        albumTitle: String(albumTitle || '').trim(),
        overageThrottled: getPhotoAlbumsOverageThrottleActive()
      });

      if (storageKey) {
        const url = `${MY_PHOTO_ALBUMS_VIEW_PATH}?k=${encodeURIComponent(storageKey)}`;
        const win = window.open(url, '_blank');
        if (win) return;
      }

      // Popup blocked or storage failed — in-app overlay fallback.
      onAlbumFocusViewChangeRef.current?.(false);
      setAlbumFullSlide(Boolean(opts?.fullSlide));
      setAlbumFullscreen(true);
      if (opts?.fullSlide) setAlbumCoverFace('front');
      onAlbumFullscreenChangeRef.current?.(true);
      requestAnimationFrame(() => {
        fitAlbumPageFlushToViewportRef.current?.();
        flushAlbumScrollOrigin(zoomScrollRef.current);
      });
    },
    [
      editor,
      emitHtml,
      applyAlbumCanvasWidth,
      syncAlbumBinderFromViewport,
      noteId,
      storageType,
      albumTitle
    ]
  );

  const enterAlbumFullSlide = useCallback(() => {
    enterAlbumFullscreen({ fullSlide: true });
  }, [enterAlbumFullscreen]);
  useEffect(() => {
    if (!albumFullscreen && !albumFocusView) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (albumFullscreen) exitAlbumFullscreen();
        else if (albumFocusView) onAlbumFocusViewChangeRef.current?.(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [albumFullscreen, albumFocusView, exitAlbumFullscreen]);

  useEffect(() => {
    requestAnimationFrame(() => {
      fitAlbumPageFlushToViewportRef.current?.();
      flushAlbumScrollOrigin(zoomScrollRef.current);
    });
  }, [albumFocusView]);

  /** Remove one album page (and text labels in its band), then restack remaining pages. */
  const removeAlbumPageAt = useCallback(
    (pageIndex) => {
      if (!editor) return false;
      const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
      if (!ordered.length) return false;
      const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
      const target = ordered[idx];
      if (!target) return false;
      const pw = Math.max(
        200,
        Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
      );
      const orient = pageOrientationRef.current;
      const band = albumPageBand(target, pw, orient);
      removeTextLabelsInBand(editor, band);
      const remaining = ordered.filter((_, i) => i !== idx);
      const nextList = restackAlbumPagesFlush(
        remaining,
        pw,
        orient,
        editor,
        albumBinderWidthPxRef.current
      );
      albumPagesRef.current = nextList;
      setAlbumPages(nextList);
      setAlbumPageIndex((prev) => {
        if (!nextList.length) return 0;
        if (prev > idx) return Math.max(0, prev - 1);
        if (prev === idx) return Math.min(prev, nextList.length - 1);
        return prev;
      });
      requestAnimationFrame(() => emitHtml(editor.getHTML()));
      return true;
    },
    [editor, emitHtml, pageSize.width]
  );

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () =>
        withAlbumMarkers(
          editor?.getHTML() ?? '',
          albumPagesRef.current,
          pageOrientationRef.current,
          albumCanvasWidthPxRef.current,
          albumTitleStyleRef.current
        ),
      getMarkdown: () => editor?.storage.markdown?.getMarkdown() ?? '',
      isEmpty: () => editor?.isEmpty ?? true,
      focus: () => editor?.commands.focus(),
      setContent: (html, nextEditable) => {
        if (!editor) return;
        suppressAutoFitUntilRef.current = Date.now() + 400;
        const list = parseAlbumPageInstancesFromHtml(html);
        const orient = parseAlbumOrientationFromHtml(html);
        const titleStyle = parseAlbumTitleStyleFromHtml(html);
        albumPagesRef.current = list;
        pageOrientationRef.current = orient;
        albumTitleStyleRef.current = titleStyle;
        setAlbumPages(list);
        setPageOrientation(orient);
        setAlbumTitleStyle(titleStyle);
        editor.commands.setContent(stripAlbumMarkers(html) || EMPTY_DOC, { emitUpdate: false });
        if (purgeAlbumDragJunkFromEditor(editor)) {
          requestAnimationFrame(() => emitHtml(editor.getHTML()));
        }
        const bottom = lowestAlbumPageBottom(list);
        if (bottom > 0) ensureAlbumCanvasMinHeight(editor, bottom, { allowShrink: true });
        // Stretch + flush after hydrate (same as enter / Resize Page) so saved width
        // cannot leave the binder inset with a black gap.
        requestAnimationFrame(() => fitAlbumPageFlushToViewportRef.current?.());
        if (typeof nextEditable === 'boolean') editor.setEditable(nextEditable);
      },
      setMarkdown: (markdown, nextEditable) => {
        if (!editor) return;
        editor.commands.setContent(markdown ?? '', { emitUpdate: false });
        if (typeof nextEditable === 'boolean') editor.setEditable(nextEditable);
      },
      insertImage: (src) => {
        if (!editor || !src) return;
        withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
          editor.chain().focus(null, { scrollIntoView: false }).insertContent({ type: 'image', attrs: { src } }).run();
        });
      },
      applySearchHighlight: (terms) => {
        if (!editor) return 0;
        editor.commands.setSearchHighlightTerms(Array.isArray(terms) ? terms : []);
        const count = editor.view?.dom.querySelectorAll('.rv-search-hit').length ?? 0;
        if (count > 0) {
          editor.commands.setActiveSearchHit(0);
          requestAnimationFrame(() => scrollActiveHitIntoView(editor));
        }
        return count;
      },
      getSearchHitCount: () => editor?.view?.dom.querySelectorAll('.rv-search-hit').length ?? 0,
      setActiveSearchHit: (index) => {
        if (!editor) return;
        editor.commands.setActiveSearchHit(index);
        requestAnimationFrame(() => scrollActiveHitIntoView(editor));
      },
      /** Same as Resize Page — zoom 95%, flush top-left, stretch page-edge to dashed target. */
      resizePage: () => handleResizePage(),
      /**
       * Snapshot one album page (page + labels in that band) without removing it.
       * Used when dragging a filmstrip thumb onto another album.
       */
      getAlbumPageIndex: () => albumPageIndexRef.current || 0,
      getAlbumPageCount: () => sortAlbumPagesByBand(albumPagesRef.current || []).length,
      goToAlbumPage: (pageIndex, opts) => goToAlbumPageRef.current?.(pageIndex, opts),
      getFilmstripModelForPage: (pageIndex) => {
        if (!editor) return null;
        const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
        if (!ordered.length) return null;
        const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
        const pw = Math.max(
          200,
          Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
        );
        const models = buildAlbumPageFilmstripModels(editor, ordered, pw);
        const pageKey = ordered[idx]?.key != null ? String(ordered[idx].key) : null;
        return {
          model: models[idx] || { key: pageKey || `page-${idx}`, photos: [] },
          orientation: pageOrientationRef.current || 'portrait',
          pageWidth: pw,
          pageIndex: idx,
          pageKey
        };
      },
      /** Prefer stable page key so ForOrder survives page reorder. */
      goToAlbumPageByKey: (pageKey, opts) => {
        const key = String(pageKey || '').trim();
        if (!key) return false;
        const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
        const idx = ordered.findIndex((t) => String(t?.key) === key);
        if (idx < 0) return false;
        goToAlbumPageRef.current?.(idx, opts);
        return true;
      },
      snapshotAlbumPage: (pageIndex) => {
        if (!editor) return null;
        const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
        if (!ordered.length) return null;
        const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
        const page = ordered[idx];
        if (!page) return null;
        const pw = Math.max(
          200,
          Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
        );
        const orient = pageOrientationRef.current;
        const band = albumPageBand(page, pw, orient);
        const textLabels = [];
        editor.state.doc.descendants((node) => {
          if (node.type.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
            const pl = parseOptionalPx(node.attrs.posLeft);
            const pt = parseOptionalPx(node.attrs.posTop);
            if (pl == null || pt == null) return;
            if (!pointInBand(pl, pt, band)) return;
            textLabels.push({ ...node.attrs });
          }
        });
        return {
          page: { ...page },
          photos: [],
          textLabels,
          orientation: orient,
          pageWidth: pw,
          pageIndex: idx,
          attachmentIds: []
        };
      },
      removeAlbumPage: (pageIndex) => removeAlbumPageAt(pageIndex)
    }),
    [editor, emitHtml, handleResizePage, pageSize.width, removeAlbumPageAt]
  );

  const thumbRowRef = useRef(null);
  const thumbStagingPaneRef = useRef(null);
  const [thumbStagingPercent, setThumbStagingPercent] = useState(() => loadThumbRowStagingPercent());
  const thumbStagingPercentRef = useRef(thumbStagingPercent);
  thumbStagingPercentRef.current = thumbStagingPercent;

  const handleStagingTrayOsFiles = useCallback(
    (files) => {
      void (async () => {
        await runPhotoAlbumsTrafficWaitIfNeeded();
        onStageOsFiles?.(files);
      })();
    },
    [onStageOsFiles]
  );

  const handleRemoveTrayItem = useCallback(
    (attachmentId) => {
      const id = Number(attachmentId);
      if (Number.isFinite(id) && id > 0) onRemoveStagedAttachment?.(id);
    },
    [onRemoveStagedAttachment]
  );

  const handleRemoveAllTrayItems = useCallback(async () => {
    const ids = unplacedTrayItems.map((item) => item.attachmentId);
    if (!ids.length) return;
    const n = ids.length;
    if (
      !(await themedConfirm(
        `Remove all ${n} photo${n === 1 ? '' : 's'} from the thumbnail tray? This also deletes them from the album.`
      ))
    ) {
      return;
    }
    onRemoveAllStagedAttachments?.(ids);
  }, [unplacedTrayItems, onRemoveAllStagedAttachments]);

  const startThumbRowResize = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const row = thumbRowRef.current;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const rowWidth = Math.max(1, rect.width - THUMB_ROW_RESIZE_HANDLE_PX);
    const startX = event.clientX;
    const startPercent = thumbStagingPercentRef.current;

    setPhotoAlbumsColumnResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const paintPercent = (percent) => {
      const pane = thumbStagingPaneRef.current;
      if (pane) pane.style.flexBasis = `${percent}%`;
    };

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const deltaPct = (delta / rowWidth) * 100;
      let next = startPercent + deltaPct;
      const minPct = (THUMB_ROW_MIN_PANE_PX / rowWidth) * 100;
      const maxPct = 100 - minPct;
      next = Math.max(minPct, Math.min(maxPct, next));
      paintPercent(next);
    };

    const onUp = (upEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      setPhotoAlbumsColumnResizing(false);

      const delta = upEvent.clientX - startX;
      const deltaPct = (delta / rowWidth) * 100;
      let next = startPercent + deltaPct;
      const minPct = (THUMB_ROW_MIN_PANE_PX / rowWidth) * 100;
      const maxPct = 100 - minPct;
      next = Math.max(minPct, Math.min(maxPct, next));
      setThumbStagingPercent(next);
      writeThumbRowStagingPercent(next);
      paintPercent(next);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  /** Filmstrip × — delete this album page (or remove from ForOrder queue). */
  const handleDeleteFilmstripPage = useCallback(
    async (pageIndex, entry) => {
      if (!editable) return;
      if (orderAlbumActive) {
        onOrderFilmstripDelete?.(pageIndex, entry);
        return;
      }
      if (!editor) return;
      const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
      if (!ordered.length) return;
      const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
      const pageLabel = `page ${idx + 1}`;
      if (
        !(await themedConfirm(
          `Delete ${pageLabel} from this album?\n\nPhotos stay in the thumbnail tray.`
        ))
      ) {
        return;
      }
      const target = ordered[idx];
      if (!target) return;
      const pw = Math.max(
        200,
        Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
      );
      const orient = pageOrientationRef.current;
      const band = albumPageBand(target, pw, orient);
      removeTextLabelsInBand(editor, band);
      const remaining = ordered.filter((_, i) => i !== idx);
      const nextList = restackAlbumPagesFlush(
        remaining,
        pw,
        orient,
        editor,
        albumBinderWidthPxRef.current
      );
      albumPagesRef.current = nextList;
      setAlbumPages(nextList);
      setAlbumPageIndex((prev) => {
        if (!nextList.length) return 0;
        let next = prev;
        if (prev > idx) next = Math.max(0, prev - 1);
        else if (prev === idx) next = Math.min(prev, nextList.length - 1);
        return albumSpreadLeftPageIndex(next);
      });
      requestAnimationFrame(() => emitHtml(editor.getHTML()));
    },
    [
      editable,
      orderAlbumActive,
      onOrderFilmstripDelete,
      editor,
      pageSize.width,
      emitHtml
    ]
  );

  /** Filmstrip × All — delete every album page; photos stay in the thumbnail tray. */
  const handleDeleteAllAlbumPages = useCallback(async () => {
    if (!editable || orderAlbumActive) return;
    if (!editor) return;
    const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
    if (!ordered.length) return;
    const n = ordered.length;
    if (
      !(await themedConfirm(
        `Delete all ${n} album page${n === 1 ? '' : 's'}?\n\nPhotos stay in the thumbnail tray.`
      ))
    ) {
      return;
    }
    const pw = Math.max(
      200,
      Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
    );
    const orient = pageOrientationRef.current;
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      removeTextLabelsInBand(editor, albumPageBand(ordered[i], pw, orient));
    }
    albumPagesRef.current = [];
    setAlbumPages([]);
    persistAlbumPages([]);
    setAlbumPageIndex(0);
    requestAnimationFrame(() => emitHtml(editor.getHTML()));
  }, [editable, orderAlbumActive, editor, pageSize.width, persistAlbumPages, emitHtml]);

  /** Set page photos by page key (`null` takes the photo off the page). */
  const setAlbumPagePhotos = useCallback(
    (photoByPageKey) => {
      const next = (albumPagesRef.current || []).map((page) =>
        Object.prototype.hasOwnProperty.call(photoByPageKey, page.key)
          ? { ...page, attachmentId: normalizeAlbumPageAttachmentId(photoByPageKey[page.key]) }
          : page
      );
      persistAlbumPages(next);
    },
    [persistAlbumPages]
  );

  /**
   * New pages at `insertAt` (book order), one per entry of `attachmentIds` (null = blank page),
   * then show the spread holding the first one.
   * `clearPageKey`: page whose photo moved here (left blank).
   */
  const insertAlbumPagesAt = useCallback(
    (insertAt, attachmentIds, { clearPageKey = '' } = {}) => {
      if (!editor || !attachmentIds.length) return;
      const pw = albumPageWidthFromViewport(zoomScrollRef.current);
      applyAlbumCanvasWidth(pw);
      syncAlbumBinderFromViewport(zoomScrollRef.current);
      const orient = pageOrientationRef.current;
      const bw = albumBinderWidthPxRef.current;
      const blockH = albumPageBlockHeight(pw, orient);
      const ordered = sortAlbumPagesByBand(albumPagesRef.current || []).map((page) =>
        clearPageKey && page.key === clearPageKey ? { ...page, attachmentId: null } : page
      );
      const at = Math.max(0, Math.min(ordered.length, Math.round(Number(insertAt) || 0)));
      // Start on the band of the page it pushes right, so restack keeps that page's labels with it.
      const added = attachmentIds.map((attachmentId, i) =>
        createAlbumPageInstance({
          x: albumPageXForSpreadColumn(at + i, pw, bw),
          y: albumPageTopForSpreadRow(albumSpreadRowForPageIndex(at + i), blockH),
          w: pw,
          h: blockH,
          attachmentId
        })
      );
      const nextList = restackAlbumPagesFlush(
        [...ordered.slice(0, at), ...added, ...ordered.slice(at)],
        pw,
        orient,
        editor,
        bw
      );
      albumPagesRef.current = nextList;
      setAlbumPages(nextList);
      const spreadLeft = albumSpreadLeftPageIndex(at);
      setAlbumPageIndex(spreadLeft);
      albumPageIndexRef.current = spreadLeft;
      setAlbumCoverFace('none');
      const titleBand = String(albumTitle || '').trim()
        ? albumPageTitleBandHeightPx(albumTitleStyleRef.current)
        : 0;
      ensureAlbumCanvasMinHeight(editor, blockH + titleBand, { allowShrink: true });
      albumAutoZoomRef.current = true;
      requestAnimationFrame(() => {
        emitHtml(editor.getHTML());
        flushAlbumScrollOrigin(zoomScrollRef.current);
        fitAlbumPageFlushToViewportRef.current?.();
      });
    },
    [editor, emitHtml, applyAlbumCanvasWidth, syncAlbumBinderFromViewport, albumTitle]
  );

  const insertAlbumPageWithPhoto = useCallback(
    (insertAt, attachmentId, opts) => insertAlbumPagesAt(insertAt, [attachmentId], opts),
    [insertAlbumPagesAt]
  );

  /** Page of the open spread a photo drag is over, painted red until release: 'left' | 'right' | null. */
  const [albumPhotoDragSide, setAlbumPhotoDragSide] = useState(null);

  const albumPhotoDropSide = useCallback((event) => {
    const rect = pageScaleRef.current?.getBoundingClientRect?.();
    return rect && rect.width > 0 && event.clientX >= rect.left + rect.width / 2 ? 'right' : 'left';
  }, []);

  // A drag cancelled with Esc or dropped elsewhere never fires dragleave/drop here.
  useEffect(() => {
    if (!albumPhotoDragSide) return undefined;
    const clear = () => setAlbumPhotoDragSide(null);
    window.addEventListener('dragend', clear, true);
    window.addEventListener('drop', clear, true);
    return () => {
      window.removeEventListener('dragend', clear, true);
      window.removeEventListener('drop', clear, true);
    };
  }, [albumPhotoDragSide]);

  /**
   * Tray photo or page photo dropped on the open spread (left / right page by pointer X).
   * Tray photo: fills a blank page; on a page with a photo it adds a new page right after;
   * on the empty right side it adds a page. Page photo: swaps with the target page
   * (moves onto a blank one); on the empty right side it moves to a new page.
   * @returns {boolean} true when the drop was a page-photo drag
   */
  const handleAlbumPhotoDrop = useCallback(
    (event) => {
      const dt = event.dataTransfer;
      const trayDrag = isTrayPhotoDrag(dt);
      const pageDrag = isPagePhotoDrag(dt);
      if (!trayDrag && !pageDrag) return false;
      event.preventDefault();
      event.stopPropagation();
      setAlbumPhotoDragSide(null);
      if (!effectiveEditable) return true;

      const attachmentId = trayDrag ? readTrayPhotoDragAttachmentId(dt) : null;
      const sourceKey = pageDrag ? readPagePhotoDragPageKey(dt) : '';
      const onRight = albumPhotoDropSide(event) === 'right';

      void (async () => {
        await runPhotoAlbumsTrafficWaitIfNeeded();
        const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
        const leftIdx = ordered.length ? albumSpreadLeftPageIndex(albumPageIndexRef.current || 0) : 0;
        const targetIdx = onRight && ordered.length ? leftIdx + 1 : leftIdx;
        const target = targetIdx < ordered.length ? ordered[targetIdx] : null;
        const targetPhotoId = target ? shownAlbumPagePhotoId(target) : null;
        setAlbumCoverFace('none');
        if (import.meta.env.DEV) {
          console.info('[albumPhotoDrop]', {
            kind: trayDrag ? 'tray' : 'page',
            attachmentId,
            sourceKey,
            spreadLeft: leftIdx,
            targetIdx,
            targetKey: target?.key || null,
            targetStoredPhoto: target?.attachmentId ?? null,
            targetShownPhoto: targetPhotoId,
            pageCount: ordered.length
          });
        }

        if (trayDrag) {
          if (!attachmentId) return;
          if (!target) insertAlbumPageWithPhoto(ordered.length, attachmentId);
          else if (targetPhotoId == null) setAlbumPagePhotos({ [target.key]: attachmentId });
          else insertAlbumPageWithPhoto(targetIdx + 1, attachmentId);
          return;
        }

        const source = ordered.find((page) => page.key === sourceKey);
        const sourcePhotoId = source ? shownAlbumPagePhotoId(source) : null;
        if (sourcePhotoId == null) return;
        if (!target) {
          insertAlbumPageWithPhoto(ordered.length, sourcePhotoId, { clearPageKey: source.key });
          return;
        }
        if (target.key === source.key) return;
        setAlbumPagePhotos({
          [target.key]: sourcePhotoId,
          [source.key]: targetPhotoId
        });
      })();
      return true;
    },
    [effectiveEditable, insertAlbumPageWithPhoto, setAlbumPagePhotos, albumPhotoDropSide, shownAlbumPagePhotoId]
  );

  /**
   * Double-click a page photo. Edit mode: open Add Text with the new label placed just
   * inside the photo's top-left corner. View-only: open the photo full size in a new tab.
   */
  const handlePagePhotoDoubleClick = useCallback(
    (attachmentId, frame) => {
      if (effectiveEditable) {
        handlePlaceFloatingText({
          posLeft: Math.round(frame.left + Math.max(8, frame.width * 0.08)),
          posTop: Math.round(frame.top + Math.max(8, frame.height * 0.08))
        });
        setPlaceTextPhoto({
          noteId,
          attachmentId,
          storageType,
          frameLeft: frame.left,
          frameTop: frame.top,
          frameWidth: frame.width,
          frameHeight: frame.height
        });
        return;
      }
      // Must open under the user gesture or the pop-up blocker eats it.
      const win = window.open('', '_blank');
      if (!win) {
        void themedAlert('Pop-up blocked — allow pop-ups to view photos in a new tab');
        return;
      }
      const item = trayItems.find((t) => t.attachmentId === attachmentId);
      void openPhotoAlbumsAttachmentInNewWindow({
        noteId,
        attachment: {
          attachment_id: attachmentId,
          file_name: item?.fileName || '',
          file_extension: item?.fileExtension || 'jpg'
        },
        storageType,
        win
      }).catch((err) => console.warn('[handlePagePhotoDoubleClick]', err?.message || err));
    },
    [effectiveEditable, handlePlaceFloatingText, trayItems, noteId, storageType]
  );

  /** Page photo dropped on the thumbnail tray, or its × clicked: take it off the page. */
  /** Photo dragged back to the tray: drop its page too (an album keeps at least one spread). */
  const handleRemovePagePhoto = useCallback(
    (pageKey) => {
      if (!effectiveEditable || !pageKey) return;
      const ordered = sortAlbumPagesByBand(albumPagesRef.current || []);
      const idx = ordered.findIndex((page) => page.key === pageKey);
      if (idx < 0) return;
      if (ordered.length <= ALBUM_SPREAD_PAGE_COUNT || !removeAlbumPageAt(idx)) {
        setAlbumPagePhotos({ [pageKey]: null });
        return;
      }
      const spreadLeft = albumSpreadLeftPageIndex(
        Math.min(albumPageIndexRef.current, Math.max(0, ordered.length - 2))
      );
      albumPageIndexRef.current = spreadLeft;
      setAlbumPageIndex(spreadLeft);
    },
    [effectiveEditable, setAlbumPagePhotos, removeAlbumPageAt]
  );

  const handlePageDrop = useCallback(
    (event) => {
      if (handleAlbumPhotoDrop(event)) return;
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      if (!types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!editable) return;

      const files = Array.from(event.dataTransfer?.files || []);

      void (async () => {
        await runPhotoAlbumsTrafficWaitIfNeeded();
        if (files.length) onStageOsFiles?.(files);
      })();
    },
    [editable, onStageOsFiles, handleAlbumPhotoDrop]
  );

  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            characters: e.storage.characterCount?.characters() ?? 0,
            words: e.storage.characterCount?.words() ?? 0
          }
        : { characters: 0, words: 0 }
  });

  /** Album pages in book order. */
  const albumPagesSorted = useMemo(() => sortAlbumPagesByBand(albumPages), [albumPages]);
  const filmstripAlbumPages = useMemo(
    () =>
      trayAttachmentIds
        ? albumPagesSorted.map((page) =>
            page.attachmentId != null && !trayAttachmentIds.has(page.attachmentId)
              ? { ...page, attachmentId: null }
              : page
          )
        : albumPagesSorted,
    [albumPagesSorted, trayAttachmentIds]
  );

  /** Top-left workspace mode badge. */
  const albumWorkspaceModeLabel = albumPagesSorted.length > 0 ? 'Album View Mode' : 'Album Create Mode';

  const albumPageCount = Math.max(1, albumPagesSorted.length);

  /** Refresh ForOrder thumbs from the open note so filmstrip matches the page on screen. */
  const [orderDocTick, setOrderDocTick] = useState(0);
  useEffect(() => {
    if (!editor || !orderAlbumActive) return undefined;
    const bump = () => setOrderDocTick((n) => n + 1);
    editor.on('update', bump);
    return () => editor.off('update', bump);
  }, [editor, orderAlbumActive]);

  const effectiveOrderFilmstripEntries = useMemo(() => {
    if (!orderAlbumActive || !Array.isArray(orderFilmstripEntries) || !orderFilmstripEntries.length) {
      return orderFilmstripEntries;
    }
    if (!editor || !noteId) return orderFilmstripEntries;
    const pw = Math.max(
      200,
      Math.round(Number(pageSize.width) || Number(albumCanvasWidthPx) || 480)
    );
    const liveModels = buildAlbumPageFilmstripModels(editor, albumPagesSorted, pw);
    return orderFilmstripEntries.map((entry) => {
      if (Number(entry.noteId) !== Number(noteId)) return entry;
      let idx = Math.max(0, Math.round(Number(entry.pageIndex) || 0));
      if (entry.pageKey) {
        const byKey = albumPagesSorted.findIndex((t) => String(t?.key) === String(entry.pageKey));
        if (byKey >= 0) idx = byKey;
      }
      if (idx >= liveModels.length) return entry;
      const live = liveModels[idx];
      if (!live) return entry;
      return {
        ...entry,
        pageIndex: idx,
        model: live,
        orientation: pageOrientation || entry.orientation
      };
    });
    // orderDocTick: re-snapshot when photos move on the open album page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderAlbumActive,
    orderFilmstripEntries,
    editor,
    noteId,
    albumPagesSorted,
    pageSize.width,
    albumCanvasWidthPx,
    pageOrientation,
    orderDocTick
  ]);

  const orderFilmstripActive =
    orderAlbumActive &&
    Array.isArray(effectiveOrderFilmstripEntries) &&
    effectiveOrderFilmstripEntries.length > 0;

  const normalizedSearchTerms = useMemo(() => {
    if (!Array.isArray(searchTerms)) return [];
    return searchTerms.map((t) => String(t ?? '').trim()).filter(Boolean);
  }, [searchTerms]);
  const searchActive = normalizedSearchTerms.length > 0;

  const [searchDocTick, setSearchDocTick] = useState(0);
  useEffect(() => {
    if (!editor || !searchActive) return undefined;
    const bump = () => setSearchDocTick((n) => n + 1);
    editor.on('update', bump);
    return () => editor.off('update', bump);
  }, [editor, searchActive]);

  const searchMatchPageIndexes = useMemo(() => {
    if (!searchActive || !editor) return [];
    return findAlbumPagesMatchingSearchTerms(
      editor,
      albumPagesSorted,
      pageSize.width || albumCanvasWidthPx || 480,
      normalizedSearchTerms
    );
    // searchDocTick: recompute when labels/photos move or text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchActive,
    editor,
    albumPagesSorted,
    pageSize.width,
    albumCanvasWidthPx,
    normalizedSearchTerms,
    searchDocTick
  ]);

  /** Active spread — left + right pages shown together in the black shell. */
  const albumSpreadLeftIndex = albumSpreadLeftPageIndex(albumPageIndex);
  const albumSpreadRightIndex = albumSpreadLeftIndex + 1;
  const leftAlbumPage = albumPagesSorted[albumSpreadLeftIndex] || albumPagesSorted[0] || null;
  const rightAlbumPage =
    albumSpreadRightIndex < albumPagesSorted.length ? albumPagesSorted[albumSpreadRightIndex] : null;
  const spreadPageWidthPx = albumSinglePageWidth(
    pageSize.width,
    albumCanvasWidthPx,
    albumBinderWidthPx
  );
  const activeAlbumPageBand = useMemo(() => {
    if (!leftAlbumPage) {
      const orient = pageOrientationRef.current || 'portrait';
      return {
        left: 0,
        top: 0,
        width: spreadPageWidthPx,
        height: albumPageBlockHeight(spreadPageWidthPx, orient)
      };
    }
    const idx = albumPagesSorted.findIndex((p) => p.key === leftAlbumPage.key);
    const pw = spreadPageWidthPx;
    const bw = albumBinderWidthPx;
    const orient = pageOrientationRef.current || 'portrait';
    const h =
      leftAlbumPage.h > 40
        ? Math.round(leftAlbumPage.h)
        : albumPageBlockHeight(pw, orient);
    return {
      left: albumPageXForSpreadColumn(Math.max(0, idx), pw, bw),
      top: albumPageTopForSpreadRow(albumSpreadRowForPageIndex(Math.max(0, idx)), h),
      width: pw,
      height: h
    };
  }, [leftAlbumPage, albumPagesSorted, spreadPageWidthPx, albumBinderWidthPx]);
  const activeRightAlbumPageBand = useMemo(() => {
    if (!rightAlbumPage) return null;
    const idx = albumPagesSorted.findIndex((p) => p.key === rightAlbumPage.key);
    const pw = spreadPageWidthPx;
    const bw = albumBinderWidthPx;
    const orient = pageOrientationRef.current || 'portrait';
    const h =
      rightAlbumPage.h > 40
        ? Math.round(rightAlbumPage.h)
        : albumPageBlockHeight(pw, orient);
    return {
      left: albumPageXForSpreadColumn(Math.max(0, idx), pw, bw),
      top: albumPageTopForSpreadRow(albumSpreadRowForPageIndex(Math.max(0, idx)), h),
      width: pw,
      height: h
    };
  }, [rightAlbumPage, albumPagesSorted, spreadPageWidthPx, albumBinderWidthPx]);
  /** Left + right of the open spread — photos on either page stay visible. */
  const activeSpreadPageBands = useMemo(() => {
    const bands = [];
    if (activeAlbumPageBand) bands.push(activeAlbumPageBand);
    if (activeRightAlbumPageBand) bands.push(activeRightAlbumPageBand);
    return bands;
  }, [activeAlbumPageBand, activeRightAlbumPageBand]);
  /** All album pages — load every *_1000px photo when the album opens (no Path A lazy unload). */
  const photoLoadBands = useMemo(() => {
    const pw = spreadPageWidthPx;
    const bw = albumBinderWidthPx;
    const pages = albumPagesSorted;
    if (!pages.length) return activeAlbumPageBand ? [activeAlbumPageBand] : [];
    const bands = [];
    const orient = pageOrientationRef.current || 'portrait';
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx += 1) {
      const row = albumSpreadRowForPageIndex(pageIdx);
      const inst = pages[pageIdx];
      const h =
        inst.h > 40 ? Math.round(inst.h) : albumPageBlockHeight(pw, orient);
      bands.push({
        left: albumPageXForSpreadColumn(pageIdx, pw, bw),
        top: albumPageTopForSpreadRow(row, h),
        width: pw,
        height: h
      });
    }
    return bands;
  }, [
    albumPagesSorted,
    spreadPageWidthPx,
    albumBinderWidthPx,
    activeAlbumPageBand
  ]);
  const albumPageShiftY = Math.max(
    0,
    Math.round(Number(activeAlbumPageBand.top) || 0)
  );
  const albumPageContentHeight = Math.max(
    200,
    Math.round(Number(activeAlbumPageBand.height) || 200)
  );
  const albumTitlePlain = String(albumTitle || '').trim();
  const albumPageTitleBandPx = albumTitlePlain
    ? albumPageTitleBandHeightPx(albumTitleStyle)
    : 0;
  const albumPageTitleLines = albumTitlePlain
    ? formatAlbumPageTitleLines(albumTitlePlain, albumSpreadLeftIndex, albumPageCount)
    : null;
  const albumSpreadRightTitleLines =
    albumTitlePlain && rightAlbumPage
      ? formatAlbumPageTitleLines(albumTitlePlain, albumSpreadRightIndex, albumPageCount)
      : null;
  const albumPageViewHeight = albumPageContentHeight + albumPageTitleBandPx;
  const albumSpreadContentWidthPx = albumSpreadCanvasWidth(spreadPageWidthPx, albumBinderWidthPx);
  const albumSpreadShellWidthPx =
    spreadPageWidthPx > 0
      ? albumSpreadContentWidthPx + (albumFullscreen ? 0 : PAGE_RESIZE_HANDLE_WIDTH)
      : 0;
  const albumSpreadColumnOffsetPx =
    spreadPageWidthPx > 0 ? spreadPageWidthPx + albumBinderWidthPx : 0;

  /** Book-flip shell: ProseMirror may stack spreads internally; shell stays one spread tall. */
  useEffect(() => {
    if (!editor || presentationMode || albumFullscreen) return;
    ensureAlbumCanvasMinHeight(editor, albumPageViewHeight, { allowShrink: true });
  }, [editor, albumPageViewHeight, albumPageIndex, presentationMode, albumFullscreen, albumTitleStyle]);

  useEffect(() => {
    setAlbumPageIndex((idx) => {
      if (!albumPagesSorted.length) return 0;
      const clamped = Math.min(Math.max(0, idx), albumPagesSorted.length - 1);
      return albumSpreadLeftPageIndex(clamped);
    });
  }, [albumPagesSorted.length]);

  /**
   * Flip to another page like a physical book — same black shell, different page on top.
   * Do NOT scroll-stack pages on top of each other.
   * Clears photo Album Edit Mode so selection does not stick to an off-page node.
   * `skipTrafficGate`: Full Slide auto-advance (not a user click).
   */
  const goToAlbumPage = useCallback(
    (nextIndex, { skipTrafficGate = false } = {}) => {
      if (!albumPagesSorted.length) {
        setAlbumCoverFace('none');
        return;
      }
      const apply = () => {
        setAlbumCoverFace('none');
        const raw = Math.max(0, Math.min(albumPagesSorted.length - 1, nextIndex));
        const clamped = albumSpreadLeftPageIndex(raw);
        setAlbumPageIndex(clamped);
        albumPageIndexRef.current = clamped;
        flushAlbumScrollOrigin(zoomScrollRef.current);
        requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
      };
      if (skipTrafficGate) {
        apply();
        return;
      }
      void (async () => {
        await runPhotoAlbumsTrafficWaitIfNeeded();
        apply();
      })();
    },
    [albumPagesSorted]
  );
  goToAlbumPageRef.current = goToAlbumPage;

  /**
   * Capture + CSS 3D page turn, then apply destination at animation midpoint.
   * Falls back to instant navigate on busy / reduced-motion / unexpected errors.
   * Paper-colored sheet still animates when capture returns null.
   */
  const runAlbumPageFlipThen = useCallback(
    async (
      applyFn,
      direction,
      {
        skipTrafficGate = false,
        frontSrc: forcedFrontSrc = null,
        backSrc: forcedBackSrc = null,
        fullWidth = false,
        skipCapture = false
      } = {}
    ) => {
      if (typeof applyFn !== 'function') return;
      if (pageFlipBusyRef.current) return;

      const finishInstant = async () => {
        if (!skipTrafficGate) await runPhotoAlbumsTrafficWaitIfNeeded();
        applyFn();
      };

      if (prefersAlbumPageFlipReducedMotion()) {
        await finishInstant();
        return;
      }

      pageFlipBusyRef.current = true;
      setPageFlipBusyUi(true);
      try {
        if (!skipTrafficGate) await runPhotoAlbumsTrafficWaitIfNeeded();

        const spreadEl = pageRef.current;
        const pw = Math.max(
          1,
          Math.round(
            albumSinglePageWidth(
              pageSize.width,
              albumCanvasWidthPx,
              albumBinderWidthPxRef.current || 0
            )
          )
        );
        const bw = Math.max(0, Math.round(albumBinderWidthPxRef.current || 0));
        const binderLeftForRightPage = pw + bw;

        let frontSrc = forcedFrontSrc;
        let backSrc = forcedBackSrc;
        if (!skipCapture && frontSrc == null && spreadEl && !fullWidth) {
          const halves = await captureAlbumSpreadPageHalves(spreadEl, {
            pageWidthPx: pw,
            binderWidthPx: bw
          });
          if (direction === 'next') frontSrc = halves?.rightDataUrl || null;
          else if (direction === 'prev') frontSrc = halves?.leftDataUrl || null;
        }

        pageFlipApplyRef.current = applyFn;
        setPageFlip({
          direction: direction === 'cover-open' ? 'cover-open' : direction === 'prev' ? 'prev' : 'next',
          frontSrc: frontSrc || null,
          backSrc: backSrc || null,
          binderLeftPx: fullWidth || direction === 'cover-open' ? 0 : binderLeftForRightPage,
          pageWidthPx: fullWidth || direction === 'cover-open' ? Math.max(pw * 2 + bw, pw) : pw,
          fullWidth: Boolean(fullWidth || direction === 'cover-open'),
          durationMs: ALBUM_PAGE_FLIP_MS
        });
      } catch {
        pageFlipBusyRef.current = false;
        setPageFlipBusyUi(false);
        pageFlipApplyRef.current = null;
        applyFn();
      }
    },
    [pageSize.width, albumCanvasWidthPx]
  );
  runAlbumPageFlipThenRef.current = runAlbumPageFlipThen;

  const handlePageFlipMidpoint = useCallback(() => {
    const fn = pageFlipApplyRef.current;
    pageFlipApplyRef.current = null;
    try {
      fn?.();
    } catch {
      /* ignore apply errors during flip */
    }
  }, []);

  const handlePageFlipDone = useCallback(() => {
    setPageFlip(null);
    pageFlipBusyRef.current = false;
    setPageFlipBusyUi(false);
    pageFlipApplyRef.current = null;
  }, []);

  const openAlbumFromCover = useCallback(
    ({ skipTrafficGate = false } = {}) => {
      const apply = () => {
        setAlbumCoverFace('none');
        setAlbumPageIndex(0);
        albumPageIndexRef.current = 0;
        flushAlbumScrollOrigin(zoomScrollRef.current);
        requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
      };
      void runAlbumPageFlipThen(apply, 'cover-open', {
        skipTrafficGate,
        frontSrc: albumCoverImg,
        fullWidth: true,
        skipCapture: true
      });
    },
    [runAlbumPageFlipThen]
  );

  const returnAlbumToCover = useCallback(
    ({ skipTrafficGate = false } = {}) => {
      const apply = () => {
        setAlbumCoverFace('front');
        setAlbumPageIndex(0);
        albumPageIndexRef.current = 0;
        flushAlbumScrollOrigin(zoomScrollRef.current);
        requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
      };
      void runAlbumPageFlipThen(apply, 'prev', { skipTrafficGate });
    },
    [runAlbumPageFlipThen]
  );

  const showAlbumBackCover = useCallback(
    ({ skipTrafficGate = false } = {}) => {
      const apply = () => {
        setAlbumCoverFace('back');
        flushAlbumScrollOrigin(zoomScrollRef.current);
        requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
      };
      void runAlbumPageFlipThen(apply, 'next', { skipTrafficGate });
    },
    [runAlbumPageFlipThen]
  );

  const openAlbumFromBackCover = useCallback(
    ({ skipTrafficGate = false } = {}) => {
      const pageCount = Math.max(1, albumPagesSorted.length);
      const lastSpreadLeft =
        pageCount <= 1
          ? 0
          : pageCount % 2 === 0
            ? pageCount - 2
            : pageCount - 1;
      const apply = () => {
        setAlbumCoverFace('none');
        setAlbumPageIndex(lastSpreadLeft);
        albumPageIndexRef.current = lastSpreadLeft;
        flushAlbumScrollOrigin(zoomScrollRef.current);
        requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
      };
      void runAlbumPageFlipThen(apply, 'prev', {
        skipTrafficGate,
        frontSrc: albumCoverBackImg,
        fullWidth: true,
        skipCapture: true
      });
    },
    [albumPagesSorted.length, runAlbumPageFlipThen]
  );

  // When search finds pages, jump to the first match if the current spread is not a hit.
  useEffect(() => {
    if (!searchActive || !searchMatchPageIndexes.length) return;
    const spreadLeft = albumSpreadLeftPageIndex(albumPageIndex);
    const onCurrentSpread = searchMatchPageIndexes.some(
      (idx) => idx === spreadLeft || idx === spreadLeft + 1
    );
    if (onCurrentSpread) return;
    goToAlbumPage(searchMatchPageIndexes[0], { skipTrafficGate: true });
    // Only when search terms / hit list change — not on every page flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchActive, searchMatchPageIndexes.join(',')]);

  const onSearchMatchPagesChangeRef = useRef(onSearchMatchPagesChange);
  onSearchMatchPagesChangeRef.current = onSearchMatchPagesChange;

  // Report matching page previews to the workspace Found strip.
  useEffect(() => {
    const report = onSearchMatchPagesChangeRef.current;
    if (typeof report !== 'function') return undefined;
    if (!searchActive || !editor) {
      report(null);
      return undefined;
    }
    const pageWidth = pageSize.width || albumCanvasWidthPx || 480;
    const models = buildAlbumPageFilmstripModels(editor, albumPagesSorted, pageWidth);
    report({
      matchIndexes: searchMatchPageIndexes,
      pageIndex: albumPageIndex,
      models,
      orientation: pageOrientation,
      noteId,
      storageType,
      onGoToPage: goToAlbumPage
    });
    return undefined;
  }, [
    searchActive,
    editor,
    albumPagesSorted,
    pageSize.width,
    albumCanvasWidthPx,
    searchMatchPageIndexes,
    albumPageIndex,
    pageOrientation,
    noteId,
    storageType,
    goToAlbumPage,
    searchDocTick
  ]);

  useEffect(() => {
    return () => {
      onSearchMatchPagesChangeRef.current?.(null);
    };
  }, []);

  /** Full Slide — countdown per page; at 0 flip to next page (or stop in Once mode). */
  useEffect(() => {
    if (!albumFullscreen || !albumFullSlide) return undefined;
    setFullSlideCountdown(fullSlideSec);
    if (fullSlideLoop) setFullSlideAutoPlay(true);
    return undefined;
  }, [albumFullscreen, albumFullSlide, albumPageIndex, albumCoverFace, fullSlideSec, fullSlideLoop]);

  useEffect(() => {
    if (!albumFullscreen || !albumFullSlide || !fullSlideAutoPlay) return undefined;
    const pageCount = Math.max(1, albumPagesSorted.length);
    const lastSpreadLeft =
      pageCount <= 1
        ? 0
        : pageCount % 2 === 0
          ? pageCount - 2
          : pageCount - 1;
    const tick = window.setInterval(() => {
      setFullSlideCountdown((prev) => {
        if (prev > 1) return prev - 1;
        if (pageFlipBusyRef.current) return fullSlideSecRef.current;
        const face = albumCoverFaceRef.current;
        const flip = runAlbumPageFlipThenRef.current;
        if (face === 'front') {
          if (typeof flip === 'function') {
            void flip(
              () => {
                setAlbumCoverFace('none');
                setAlbumPageIndex(0);
                albumPageIndexRef.current = 0;
                flushAlbumScrollOrigin(zoomScrollRef.current);
                requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
              },
              'cover-open',
              {
                skipTrafficGate: true,
                frontSrc: albumCoverImg,
                fullWidth: true,
                skipCapture: true
              }
            );
          } else {
            setAlbumCoverFace('none');
            setAlbumPageIndex(0);
            albumPageIndexRef.current = 0;
            flushAlbumScrollOrigin(zoomScrollRef.current);
            requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
          }
          return fullSlideSecRef.current;
        }
        if (face === 'back') {
          if (!fullSlideLoopRef.current) {
            setFullSlideAutoPlay(false);
            return 0;
          }
          if (typeof flip === 'function') {
            void flip(
              () => {
                setAlbumCoverFace('front');
                setAlbumPageIndex(0);
                albumPageIndexRef.current = 0;
                flushAlbumScrollOrigin(zoomScrollRef.current);
                requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
              },
              'cover-open',
              {
                skipTrafficGate: true,
                frontSrc: albumCoverBackImg,
                fullWidth: true,
                skipCapture: true
              }
            );
          } else {
            setAlbumCoverFace('front');
            setAlbumPageIndex(0);
            albumPageIndexRef.current = 0;
            flushAlbumScrollOrigin(zoomScrollRef.current);
            requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
          }
          return fullSlideSecRef.current;
        }
        let stoppedOnce = false;
        const current = albumSpreadLeftPageIndex(Math.max(0, albumPageIndexRef.current));
        if (current >= lastSpreadLeft) {
          if (typeof flip === 'function') {
            void flip(
              () => {
                setAlbumCoverFace('back');
                flushAlbumScrollOrigin(zoomScrollRef.current);
                requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
              },
              'next',
              { skipTrafficGate: true }
            );
          } else {
            setAlbumCoverFace('back');
            flushAlbumScrollOrigin(zoomScrollRef.current);
            requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
          }
          if (!fullSlideLoopRef.current) {
            stoppedOnce = false;
          }
        } else {
          const target = current + ALBUM_SPREAD_PAGE_COUNT;
          if (typeof flip === 'function') {
            void flip(
              () => {
                setAlbumPageIndex(target);
                albumPageIndexRef.current = target;
                flushAlbumScrollOrigin(zoomScrollRef.current);
                requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
              },
              'next',
              { skipTrafficGate: true }
            );
          } else {
            setAlbumPageIndex(target);
            albumPageIndexRef.current = target;
            flushAlbumScrollOrigin(zoomScrollRef.current);
            requestAnimationFrame(() => flushAlbumScrollOrigin(zoomScrollRef.current));
          }
        }
        if (stoppedOnce) {
          setFullSlideAutoPlay(false);
          return 0;
        }
        return fullSlideSecRef.current;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [albumFullscreen, albumFullSlide, albumPagesSorted.length, fullSlideAutoPlay]);

  const albumLastSpreadLeftIndex = (() => {
    const pageCount = Math.max(1, albumPagesSorted.length);
    if (pageCount <= 1) return 0;
    return pageCount % 2 === 0 ? pageCount - 2 : pageCount - 1;
  })();
  const albumOnLastSpread = albumSpreadLeftIndex >= albumLastSpreadLeftIndex;

  const canGoPrevAlbumPage = albumCoverFace !== 'front' && !pageFlip && !pageFlipBusyUi;
  const canGoNextAlbumPage = albumCoverFace !== 'back' && !pageFlip && !pageFlipBusyUi;
  const albumPageNavLabel = (() => {
    if (albumCoverFace === 'front') return 'Cover';
    if (albumCoverFace === 'back') return 'Back cover';
    if (rightAlbumPage) {
      return `Page ${albumSpreadLeftIndex + 1}-${albumSpreadRightIndex + 1} of ${albumPageCount}`;
    }
    return `Page ${albumSpreadLeftIndex + 1} of ${albumPageCount}`;
  })();

  const handleAlbumNavPrev = useCallback(() => {
    if (pageFlipBusyRef.current) return;
    if (albumCoverFace === 'front') return;
    if (albumCoverFace === 'back') {
      openAlbumFromBackCover();
      return;
    }
    if (albumSpreadLeftIndex <= 0) {
      returnAlbumToCover();
      return;
    }
    const target = albumSpreadLeftIndex - ALBUM_SPREAD_PAGE_COUNT;
    void runAlbumPageFlipThen(
      () => goToAlbumPage(target, { skipTrafficGate: true }),
      'prev'
    );
  }, [
    albumCoverFace,
    albumSpreadLeftIndex,
    returnAlbumToCover,
    openAlbumFromBackCover,
    goToAlbumPage,
    runAlbumPageFlipThen
  ]);

  const handleAlbumNavNext = useCallback(() => {
    if (pageFlipBusyRef.current) return;
    if (albumCoverFace === 'front') {
      openAlbumFromCover();
      return;
    }
    if (albumCoverFace === 'back') return;
    if (albumOnLastSpread) {
      // Editing: Next past the last page adds two blank pages; viewing shows the back cover.
      if (effectiveEditable && !albumFullscreen && !orderAlbumActive) {
        void runAlbumPageFlipThen(() => {
          const count = (albumPagesRef.current || []).length;
          insertAlbumPagesAt(count, Array(ALBUM_SPREAD_PAGE_COUNT).fill(null));
        }, 'next');
        return;
      }
      showAlbumBackCover();
      return;
    }
    const target = albumSpreadLeftIndex + ALBUM_SPREAD_PAGE_COUNT;
    void runAlbumPageFlipThen(
      () => goToAlbumPage(target, { skipTrafficGate: true }),
      'next'
    );
  }, [
    albumCoverFace,
    albumOnLastSpread,
    albumSpreadLeftIndex,
    openAlbumFromCover,
    showAlbumBackCover,
    goToAlbumPage,
    runAlbumPageFlipThen,
    effectiveEditable,
    albumFullscreen,
    orderAlbumActive,
    insertAlbumPagesAt
  ]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const t = event.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (pageFlipBusyRef.current) return;
      event.preventDefault();
      if (event.key === 'ArrowRight') handleAlbumNavNext();
      else handleAlbumNavPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAlbumNavNext, handleAlbumNavPrev]);

  const albumPageNavStrip = (variant = 'toolbar') => {
    const isFs = variant === 'fullscreen';
    const arrowSx = {
      width: isFs ? { xs: 48, sm: 56 } : { xs: 36, sm: 44 },
      height: 'auto',
      display: 'block'
    };
    const labelColor = isFs ? '#fff' : '#111';
    const navArrowBtnSx = (enabled) => ({
      border: 'none',
      bgcolor: 'transparent',
      p: 0,
      m: 0,
      cursor: enabled ? 'pointer' : 'default',
      opacity: enabled ? 1 : 0.35,
      lineHeight: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      '&:disabled': { opacity: 0.35, cursor: 'default' },
      '@media (hover: hover)': enabled
        ? {
            '&:hover img': {
              transform: `scale(${getHoverMagnifyFactor()})`,
              filter: ALBUM_ARROW_YELLOW_FILTER
            }
          }
        : null,
      '& img': {
        transition: 'transform 0.15s ease, filter 0.15s ease',
        transformOrigin: 'center center'
      }
    });
    return (
      <Box
        className="rv-album-page-nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.75, sm: 1.25 },
          ...(variant === 'toolbar'
            ? { ml: 'auto', flex: '0 0 auto', pl: 1, pr: 0.5, alignSelf: 'center' }
            : null),
          ...(isFs
            ? {
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.35)'
              }
            : null)
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label="Previous album page"
          title={
            albumCoverFace === 'back'
              ? 'Return to last pages'
              : albumSpreadLeftIndex <= 0
                ? 'Back to album cover'
                : 'Previous page — flip like a book'
          }
          disabled={!canGoPrevAlbumPage}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAlbumNavPrev}
          sx={navArrowBtnSx(canGoPrevAlbumPage)}
        >
          <Box component="img" src={leftArrowImg} alt="" draggable={false} sx={arrowSx} />
        </Box>
        <Box
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: isFs ? { xs: '1rem', sm: '1.15rem' } : { xs: '0.85rem', sm: '1rem' },
            color: labelColor,
            WebkitTextFillColor: labelColor,
            whiteSpace: 'nowrap',
            minWidth: '7.5ch',
            textAlign: 'center',
            userSelect: 'none'
          }}
        >
          {albumPageNavLabel}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Next album page"
          title={
            albumCoverFace === 'front'
              ? 'Open album'
              : albumCoverFace === 'back'
                ? 'Back cover'
                : albumOnLastSpread
                  ? 'Back cover'
                  : 'Next page — flip like a book'
          }
          disabled={!canGoNextAlbumPage}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAlbumNavNext}
          sx={navArrowBtnSx(canGoNextAlbumPage)}
        >
          <Box component="img" src={rightArrowImg} alt="" draggable={false} sx={arrowSx} />
        </Box>
      </Box>
    );
  };

  const albumPageSideArrow = (dir, placement = 'fixed') => {
    const isPrev = dir === 'prev';
    const enabled = isPrev ? canGoPrevAlbumPage : canGoNextAlbumPage;
    const embedded = placement === 'embedded';
    const magnify = getHoverMagnifyFactor();
    return (
      <Box
        component="button"
        type="button"
          aria-label={
            isPrev
              ? albumCoverFace === 'back'
                ? 'Return to last album pages'
                : 'Previous album page'
              : albumCoverFace === 'front'
                ? 'Open album'
                : albumOnLastSpread
                  ? 'Show back cover'
                  : 'Next album page'
          }
          title={
            isPrev
              ? albumCoverFace === 'back'
                ? 'Return to last pages'
                : albumSpreadLeftIndex <= 0
                  ? 'Back to album cover'
                  : 'Previous page'
              : albumCoverFace === 'front'
                ? 'Open album'
                : albumOnLastSpread
                  ? 'Show back cover'
                  : 'Next page'
          }
          disabled={!enabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={isPrev ? handleAlbumNavPrev : handleAlbumNavNext}
          sx={{
            position: embedded ? 'absolute' : 'fixed',
            top: '50%',
            transform: 'translateY(-50%)',
            ...(isPrev ? { left: { xs: 8, sm: 16 } } : { right: { xs: 8, sm: 16 } }),
            // Above album pages / page overlay (~45) / selected photos (~50–90);
            // below the album action bar (~200).
            zIndex: embedded ? 120 : 14010,
            border: 'none',
            bgcolor: 'rgba(0,0,0,0.45)',
            borderRadius: '50%',
            p: 0.75,
            m: 0,
            cursor: enabled ? 'pointer' : 'default',
            opacity: enabled ? 1 : 0.35,
            lineHeight: 0,
            display:
              albumCoverFace === 'front'
                ? isPrev
                  ? 'none'
                  : 'inline-flex'
                : albumCoverFace === 'back'
                  ? isPrev
                    ? 'inline-flex'
                    : 'none'
                  : albumPagesSorted.length >= 1
                    ? 'inline-flex'
                    : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            transition: 'background-color 0.15s ease, transform 0.15s ease',
            '&:disabled': { opacity: 0.35, cursor: 'default' },
            '@media (hover: hover)': enabled
              ? {
                  '&:hover:not(:disabled)': {
                    bgcolor: 'rgba(0,0,0,0.65)',
                    transform: `translateY(-50%) scale(${magnify})`,
                    '& img': {
                      filter: ALBUM_ARROW_YELLOW_FILTER
                    }
                  }
                }
              : null,
            // Always tint next/prev yellow so they read as the page-flip affordance.
            '& img': {
              transition: 'filter 0.15s ease',
              filter: enabled ? ALBUM_ARROW_YELLOW_FILTER : 'none'
            }
          }}
        >
        <Box
          component="img"
          src={isPrev ? leftArrowImg : rightArrowImg}
          alt=""
          draggable={false}
          sx={{
            width: embedded ? { xs: 36, sm: 48 } : { xs: 44, sm: 56 },
            height: 'auto',
            display: 'block'
          }}
        />
      </Box>
    );
  };

  const albumLayoutContextValue = useMemo(
    () => ({
      activePageBand: activeAlbumPageBand,
      activePageBands: activeSpreadPageBands,
      photoLoadBands
    }),
    [activeAlbumPageBand, activeSpreadPageBands, photoLoadBands]
  );

  const fullSlideAlbumTitle = String(albumTitle || '').trim() || 'Album';

  return (
    <PhotoAlbumsAlbumLayoutContext.Provider value={albumLayoutContextValue}>
    <Box
      className={albumFullscreen ? 'rv-editor rv-editor--album-fullscreen' : 'rv-editor'}
      sx={
        albumFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 14000,
              width: '100vw',
              height: '100vh',
              maxHeight: '100vh',
              bgcolor: '#1a1a1a',
              display: 'flex',
              flexDirection: 'column'
            }
          : undefined
      }
    >
      {albumFullscreen ? (
        <>
          {albumFullSlide ? (
            <Box
              sx={{
                position: 'fixed',
                top: 12,
                left: 12,
                zIndex: 14010,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexWrap: 'wrap',
                maxWidth: 'min(48vw, 360px)'
              }}
            >
              <Box
                sx={{
                  minWidth: 44,
                  px: 1.25,
                  py: 0.35,
                  borderRadius: 1,
                  bgcolor: 'rgba(0,0,0,0.55)',
                  border: '2px solid #000',
                  color: 'var(--theme-yellow-color, #ffeb3b)',
                  WebkitTextFillColor: 'var(--theme-yellow-color, #ffeb3b)',
                  fontWeight: 900,
                  fontSize: '1.75rem',
                  lineHeight: 1.1,
                  textAlign: 'center',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
                aria-live="polite"
                aria-label={`Slide countdown ${fullSlideCountdown} seconds`}
              >
                {fullSlideCountdown}
              </Box>
              {[
                {
                  key: 'once',
                  label: 'Once',
                  loop: false,
                  title: 'Slide show runs once — stops after the last page',
                  ariaLabel: 'Once — slide show runs one time through the album'
                },
                {
                  key: 'loop',
                  label: 'Loop',
                  loop: true,
                  title: 'Slide show loops forever',
                  ariaLabel: 'Loop — slide show repeats from page 1'
                }
              ].map((mode) => {
                const selected = fullSlideLoop === mode.loop;
                return (
                  <GreenButton
                    key={mode.key}
                    type="button"
                    aria-label={mode.ariaLabel}
                    aria-pressed={selected}
                    title={mode.title}
                    onClick={() => {
                      setFullSlideLoop(mode.loop);
                      if (mode.loop) setFullSlideAutoPlay(true);
                    }}
                    sx={{
                      minWidth: 0,
                      px: 1.25,
                      py: 0.5,
                      fontSize: '0.9rem !important',
                      fontWeight: 800,
                      ...(selected
                        ? {
                            bgcolor: '#ffffff !important',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important',
                            border: '2px solid #000000 !important'
                          }
                        : null)
                    }}
                  >
                    {mode.label}
                  </GreenButton>
                );
              })}
            </Box>
          ) : null}
          <Box
            sx={{
              position: 'fixed',
              top: 12,
              right: 12,
              zIndex: 14010,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              maxWidth: 'min(96vw, 520px)'
            }}
          >
          {albumFullSlide ? (
            <>
              {ALBUM_FULL_SLIDE_SEC_CHOICES.map((sec) => {
                const selected = fullSlideSec === sec;
                return (
                  <GreenButton
                    key={`full-slide-sec-${sec}`}
                    type="button"
                    aria-label={`${sec} seconds per slide`}
                    aria-pressed={selected}
                    title={`Pause ${sec} seconds on each album page`}
                    onClick={() => setFullSlideSec(sec)}
                    sx={{
                      minWidth: 0,
                      width: 40,
                      px: 0,
                      py: 0.5,
                      fontSize: '0.95rem !important',
                      fontWeight: 800,
                      ...(selected
                        ? {
                            bgcolor: '#ffffff !important',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important',
                            border: '2px solid #000000 !important'
                          }
                        : null)
                    }}
                  >
                    {sec}
                  </GreenButton>
                );
              })}
            </>
          ) : null}
          <GreenButton
            type="button"
            onClick={exitAlbumFullscreen}
            aria-label={presentationMode ? 'Close album view' : 'Exit full screen'}
            title={presentationMode ? 'Close this tab (Esc)' : 'Exit full screen (Esc)'}
            sx={{
              minWidth: 0,
              px: 2,
              py: 0.75,
              fontSize: '0.95rem !important',
              fontWeight: 800
            }}
          >
            {presentationMode ? 'Close' : 'Exit full screen'}
          </GreenButton>
        </Box>
        </>
      ) : null}
      {albumFullscreen ? (
        <>
          <Box
            sx={{
              position: 'fixed',
              // Sit in the black top margin — not over the album photos.
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 14010,
              pointerEvents: 'auto'
            }}
          >
            {albumPageNavStrip('fullscreen')}
          </Box>
          {albumFullSlide ? (
            <Box
              component="h1"
              sx={{
                position: 'fixed',
                top: { xs: 52, sm: 56 },
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 14008,
                m: 0,
                px: 2,
                maxWidth: 'min(92vw, 720px)',
                color: 'var(--theme-yellow-color, #ffeb3b)',
                WebkitTextFillColor: 'var(--theme-yellow-color, #ffeb3b)',
                fontFamily: MAIN_FONT_FAMILY,
                fontWeight: 800,
                fontSize: { xs: '1.05rem', sm: '1.35rem' },
                lineHeight: 1.25,
                textAlign: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
                textShadow: '0 1px 3px rgba(0,0,0,0.85)'
              }}
            >
              {`Slide show Album ${fullSlideAlbumTitle}, enjoy`}
            </Box>
          ) : null}
          <Box
            sx={{
              position: 'fixed',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 14010,
              pointerEvents: 'auto'
            }}
          >
            {albumPageNavStrip('fullscreen')}
          </Box>
          {albumPageSideArrow('prev')}
          {albumPageSideArrow('next')}
          {albumFullSlide ? <SlideShowMusicControls /> : null}
        </>
      ) : null}
      <PhotoAlbumsPlaceTextDialog
        open={placeTextOpen}
        initialText={placeTextSeed}
        initialStyle={placeTextStyle}
        photo={placeTextPhoto}
        onClose={() => {
          setPlaceTextPhoto(null);
          placeTextEditingLabelIdRef.current = null;
          placeTextEditingPosRef.current = null;
          placeTextAlbumTitleModeRef.current = false;
          placeTextPagePosRef.current = null;
          placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
          setPlaceTextStyle(null);
          setPlaceTextOpen(false);
          exitPlaceTextToNormalAlbum();
        }}
        onConfirm={handlePlaceTextConfirm}
      />
      {!albumEditorChromeHidden ? header : null}
      {!albumEditorChromeHidden ? <PhotoAlbumsEditorToolbar editor={editor} /> : null}

      {editor && effectiveEditable ? (
        <BubbleMenu editor={editor} className="rv-bubble">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}>
            <b>B</b>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <i>I</i>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <u>U</u>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            ✎
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handlePlaceFloatingText}
            title="Place selection as draggable/rotatable text on the page"
          >
            Place
          </button>
        </BubbleMenu>
      ) : null}

      {/* Keep this stacking context above the album zoom-scroll (incl. native scrollbars + page-edge bar).
          Fixed label size + horizontal scroll — no font auto-fit (avoids scrollbar/font jiggle). */}
      {editable && !albumEditorChromeHidden ? (
        <Box
          className="rv-editor__album-bar"
          sx={{
            position: 'relative',
            zIndex: 200,
            isolation: 'isolate',
            flex: '0 0 auto',
            display: 'flex',
            flexWrap: 'nowrap',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            gap: 1,
            width: '100%',
            boxSizing: 'border-box',
            px: 0.5,
            py: 0.35,
            borderBottom: '1px solid var(--theme-daynight-color)',
            bgcolor: 'var(--theme-daynight-color)',
            overflowX: 'auto',
            overflowY: 'hidden',
            minWidth: 0,
            // Stable scrollbar gutter so showing/hiding the bar does not resize the row.
            scrollbarGutter: 'stable'
          }}
        >
          <Box
            data-pa-album-bar-left=""
            sx={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'stretch',
              gap: 0.35,
              flex: '0 1 auto',
              minWidth: 0
            }}
          >
            {[
              {
                key: 'reset',
                label: 'Reset Page',
                demoBlock: true,
                onClick: handleResetPage,
                ariaLabel:
                  'Reset page — clear pages and text, zoom 95%, flush top-left, stretch to page edge',
                title:
                  'Clear pages and text (tray photos are kept), zoom 95%, flush binder top-left, stretch right edge to the dashed page edge'
              },
              {
                key: 'resize',
                label: 'Resize Page',
                demoBlock: true,
                onClick: handleResizePage,
                ariaLabel: 'Resize page — turn AUTO-ZOOM on and fit the album page in the shell',
                title:
                  'Turn AUTO-ZOOM back on and fit the whole binder and page (theme-primary border, no scrollbars)'
              },
              {
                key: 'portrait',
                label: 'Portrait',
                demoBlock: true,
                onClick: () => applyPageOrientation('portrait'),
                ariaLabel: 'Portrait — page proportion 10 wide by 12 tall',
                title: 'Portrait — page proportion 10 width × 12 height',
                pressed: pageOrientation === 'portrait'
              },
              {
                key: 'landscape',
                label: 'Landscape',
                demoBlock: true,
                onClick: () => applyPageOrientation('landscape'),
                ariaLabel: 'Landscape — page proportion 12 wide by 10 tall',
                title: 'Landscape — page proportion 12 width × 10 height',
                pressed: pageOrientation === 'landscape'
              },
              {
                key: 'fullscreen',
                label: 'Full screen',
                demoBlock: true,
                onClick: () => enterAlbumFullscreen(),
                ariaLabel: 'Full screen — open album in a new tab with the whole page visible',
                title: 'Open a new tab showing the entire album page. Esc or Close to leave.'
              }
            ].map((btn) => (
              <GreenButton
                key={btn.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runAfterTrafficWait(() => btn.onClick?.())}
                disabled={Boolean(btn.disabled)}
                aria-label={btn.ariaLabel}
                aria-pressed={btn.pressed != null ? Boolean(btn.pressed) : undefined}
                title={btn.title}
                {...(btn.demoBlock ? guestDemoBlockProps() : null)}
                sx={{
                  ...albumBarButtonSx,
                  ...(btn.pressed
                    ? {
                        bgcolor: '#ffffff !important',
                        color: '#000000 !important',
                        WebkitTextFillColor: '#000000 !important',
                        border: '1px solid #000000 !important',
                        boxShadow: 'none',
                        '@media (hover: hover)': {
                          '&:hover:not(.Mui-disabled)': {
                            bgcolor: '#ffffff !important',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important',
                            border: '1px solid #000000 !important',
                            transform: 'scale(1)'
                          }
                        }
                      }
                    : null)
                }}
              >
                {btn.label}
              </GreenButton>
            ))}
          </Box>
          <Box
            data-pa-album-bar-right=""
            sx={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'stretch',
              gap: 0.35,
              flex: '0 0 auto',
              ml: 'auto'
            }}
          >
            {[
              {
                key: 'orderPrint',
                label: 'Order Print',
                demoBlock: true,
                onClick: () => onOrderPrint?.(),
                disabled: typeof onOrderPrint !== 'function',
                ariaLabel: 'Order Print — add this album page to For Order',
                title: 'Add this album page to For Order (sidebar) for printing later'
              },
              {
                key: 'fullslide',
                label: 'Album SlideShow',
                onClick: enterAlbumFullSlide,
                ariaLabel: `Album SlideShow — new tab, default ${ALBUM_FULL_SLIDE_SEC_DEFAULT} seconds per page (4, 8, or 12 in viewer)`,
                title: `Open a new tab as Album SlideShow — default ${ALBUM_FULL_SLIDE_SEC_DEFAULT}s per page; choose Once or Loop and 4 / 8 / 12 in the viewer`
              }
            ].map((btn) => (
              <GreenButton
                key={btn.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runAfterTrafficWait(() => btn.onClick?.())}
                disabled={Boolean(btn.disabled)}
                aria-label={btn.ariaLabel}
                aria-pressed={btn.pressed != null ? Boolean(btn.pressed) : undefined}
                title={btn.title}
                {...(btn.demoBlock ? guestDemoBlockProps() : null)}
                sx={albumBarButtonSx}
              >
                {btn.label}
              </GreenButton>
            ))}
          </Box>
        </Box>
      ) : null}

      {editable && !albumEditorChromeHidden ? (
        <Box
          ref={thumbRowRef}
          className="rv-album-thumb-row"
          data-rv-album-thumb-row=""
          sx={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            width: '100%',
            minWidth: 0,
            gap: 0,
            px: 0.75,
            py: 0.75,
            boxSizing: 'border-box',
            bgcolor: 'var(--theme-daynight-color)',
            borderBottom: '2px solid var(--theme-inverse-daynight-color)',
            /* Above album zoom pane (zIndex 1) so hover filename plates are fully visible. */
            position: 'relative',
            zIndex: 80,
            overflow: 'visible',
          }}
        >
          <Box
            ref={thumbStagingPaneRef}
            sx={{
              flex: `0 0 ${thumbStagingPercent}%`,
              minWidth: THUMB_ROW_MIN_PANE_PX,
              maxWidth: `calc(100% - ${THUMB_ROW_MIN_PANE_PX + THUMB_ROW_RESIZE_HANDLE_PX}px)`,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'visible'
            }}
          >
            <PhotoAlbumsThumbnailTray
              items={unplacedTrayItems}
              noteId={noteId}
              storageType={storageType}
              editable={effectiveEditable}
              onOsFiles={handleStagingTrayOsFiles}
              onRemove={handleRemoveTrayItem}
              onRemoveAll={handleRemoveAllTrayItems}
              onPagePhotoReturn={handleRemovePagePhoto}
            />
          </Box>
          <ThumbRowResizeHandle onMouseDown={startThumbRowResize} />
          <Box
            sx={{
              flex: '1 1 0',
              minWidth: THUMB_ROW_MIN_PANE_PX,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <PhotoAlbumsPageFilmstrip
              inline
              stagingCount={unplacedTrayItems.length}
              pages={filmstripAlbumPages}
              pageIndex={orderFilmstripActive ? orderFilmstripIndex : albumPageIndex}
              pageCount={
                orderFilmstripActive ? effectiveOrderFilmstripEntries.length : albumPageCount
              }
              pageWidth={pageSize.width || albumCanvasWidthPx || 480}
              orientation={pageOrientation}
              noteId={noteId}
              storageType={storageType}
              editor={editor}
              canGoPrev={
                orderFilmstripActive ? orderFilmstripIndex > 0 : canGoPrevAlbumPage
              }
              canGoNext={
                orderFilmstripActive
                  ? orderFilmstripIndex < effectiveOrderFilmstripEntries.length - 1
                  : canGoNextAlbumPage
              }
              onGoToPage={
                orderFilmstripActive
                  ? (idx) => onOrderFilmstripSelect?.(idx)
                  : goToAlbumPage
              }
              draggablePages={Boolean(
                editable && !sharedAlbumId && onAlbumPageDragStart && !orderAlbumActive
              )}
              onPageDragStart={onAlbumPageDragStart}
              onPageDragEnd={onAlbumPageDragEnd}
              overrideEntries={orderFilmstripActive ? effectiveOrderFilmstripEntries : null}
              onDeletePage={
                editable && !sharedAlbumId
                  ? (idx, entry) => handleDeleteFilmstripPage(idx, entry)
                  : null
              }
              onDeleteAllPages={
                editable && !sharedAlbumId && !orderAlbumActive
                  ? () => {
                      void handleDeleteAllAlbumPages();
                    }
                  : null
              }
              onResetAlbum={
                effectiveEditable && !sharedAlbumId && typeof onResetAlbum === 'function'
                  ? () => runAfterTrafficWait(() => onResetAlbum())
                  : null
              }
            />
          </Box>
        </Box>
      ) : null}

      {!albumZoomBarHidden ? (
        <PhotoAlbumsAlbumZoomBar
          value={albumZoom}
          onChange={handleAlbumZoomChange}
          focusViewActive={albumFocusView}
          onFocusViewToggle={toggleAlbumFocusView}
          showFocusToggle={!presentationMode}
        />
      ) : null}

      <Box
        ref={zoomScrollRef}
        className="rv-editor__album-zoom-scroll"
        onDragOver={(e) => {
          if (isTrayPhotoDrag(e.dataTransfer) || isPagePhotoDrag(e.dataTransfer)) {
            if (!effectiveEditable) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = isPagePhotoDrag(e.dataTransfer) ? 'move' : 'copy';
            const side = albumPhotoDropSide(e);
            setAlbumPhotoDragSide((prev) => (prev === side ? prev : side));
            return;
          }
          const files = Array.from(e.dataTransfer?.types || []).includes('Files');
          if (!files) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          setAlbumPhotoDragSide(null);
        }}
        onDrop={handlePageDrop}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          // Book pages flip left/right — no stacked-page scrollbar.
          overflow: 'hidden',
          position: 'relative',
          // Below the album action bar (zIndex 200).
          zIndex: 1,
          ...(albumFullscreen
            ? {
                // Daynight margins for top/bottom page-nav strips — keep them off the photos.
                pt: `${ALBUM_FS_NAV_PAD_PX}px`,
                pb: `${ALBUM_FS_NAV_PAD_PX}px`,
                px: '8px',
                bgcolor: 'var(--theme-daynight-color)'
              }
            : {
                bgcolor: albumFocusView ? VAULT_WORKSPACE_FOCUS_VIEW_BG : 'var(--theme-daynight-color)'
              })
        }}
      >
        {!albumEditorChromeHidden && !presentationMode ? (
          <Box
            component="span"
            data-pa-album-mode-badge=""
            aria-live="polite"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 40,
              px: 1,
              py: 0.35,
              borderRadius: 0.5,
              border: '2px solid #000',
              bgcolor: 'var(--theme-secondary-color)',
              color: '#000',
              WebkitTextFillColor: '#000',
              fontWeight: 800,
              fontSize: { xs: '0.78rem', sm: '0.9rem' },
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}
          >
            {albumWorkspaceModeLabel}
          </Box>
        ) : null}
        {!albumFullscreen ? (
          <>
            {albumPageSideArrow('prev', 'embedded')}
            {albumPageSideArrow('next', 'embedded')}
          </>
        ) : null}
        <Box
          className="rv-editor__album-zoom-scaler"
          sx={{
            // CSS zoom grows layout + paint; fit zoom keeps the whole page in the shell.
            // 0% collapses; 100% is full size; Full screen may go above 100%.
            zoom: Math.max(0, albumZoom) / 100,
            minHeight: 0,
            minWidth: 0,
            height: 'auto',
            width: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto'
          }}
        >
          <Box
            className="rv-editor__body rv-editor__body--album"
            sx={{
              position: 'relative',
              // Two-page spread in the black shell — portrait or landscape.
              flex: '0 0 auto',
              minHeight: `${albumPageViewHeight}px`,
              height: `${albumPageViewHeight}px`,
              maxHeight: `${albumPageViewHeight}px`,
              ...(albumSpreadShellWidthPx > 0
                ? {
                    width: `${albumSpreadShellWidthPx}px`,
                    minWidth: `${albumSpreadShellWidthPx}px`,
                    maxWidth: `${albumSpreadShellWidthPx}px`
                  }
                : { width: 'max-content' }),
              overflow: 'hidden',
              // Letterbox around the album page (Task 3) — theme daylight.
              bgcolor: 'var(--theme-daynight-color)'
            }}
            >
            <Box
              ref={pageRef}
              className="rv-editor__page rv-editor__page--spread"
              sx={{
                position: 'relative',
                boxSizing: 'border-box',
                height: `${albumPageViewHeight}px`,
                minHeight: `${albumPageViewHeight}px`,
                maxHeight: `${albumPageViewHeight}px`,
                overflow: 'hidden',
                bgcolor: 'var(--theme-daynight-color)',
                ...(albumSpreadShellWidthPx > 0
                  ? {
                      width: `${albumSpreadShellWidthPx}px`,
                      minWidth: `${albumSpreadShellWidthPx}px`,
                      maxWidth: `${albumSpreadShellWidthPx}px`
                    }
                  : null)
              }}
            >
              {/* Paper left / right */}
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: `${spreadPageWidthPx}px`,
                  height: '100%',
                  bgcolor:
                    albumPhotoDragSide === 'left' ? ALBUM_PHOTO_DROP_TARGET_BG : 'var(--theme-daynight-color)',
                  boxShadow: ALBUM_PAGE_BORDER_SHADOW,
                  zIndex: 1,
                  pointerEvents: 'none'
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: `${albumSpreadColumnOffsetPx}px`,
                  top: 0,
                  width: `${spreadPageWidthPx}px`,
                  height: '100%',
                  bgcolor:
                    albumPhotoDragSide === 'right' ? ALBUM_PHOTO_DROP_TARGET_BG : 'var(--theme-daynight-color)',
                  boxShadow: ALBUM_PAGE_BORDER_SHADOW,
                  zIndex: 1,
                  pointerEvents: 'none'
                }}
              />

              {/* Photos + overlays share ProseMirror spread coordinates */}
              <Box
                ref={pageScaleRef}
                className="rv-editor__page-scale"
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width:
                    albumSpreadContentWidthPx > 0
                      ? `${albumSpreadContentWidthPx}px`
                      : '100%',
                  height: `${albumPageViewHeight}px`,
                  zIndex: 2,
                  transform: albumPageShiftY ? `translateY(-${albumPageShiftY}px)` : 'none',
                  transformOrigin: 'top left',
                  willChange: albumPageShiftY ? 'transform' : 'auto',
                  overflow: 'visible'
                }}
              >
                <EditorContent editor={editor} />
                <Box
                  ref={overlayLayerRef}
                  className="rv-editor__album-overlay-layer"
                  sx={{
                    position: 'absolute',
                    left: pmLayerBox.left,
                    top: pmLayerBox.top,
                    width: Math.max(1, albumSpreadContentWidthPx || pmLayerBox.width),
                    height: Math.max(1, pmLayerBox.height),
                    pointerEvents: 'none',
                    zIndex: 45,
                    overflow: 'visible'
                  }}
                >
                  {[
                    { key: 'left', band: activeAlbumPageBand, page: leftAlbumPage },
                    { key: 'right', band: activeRightAlbumPageBand, page: rightAlbumPage }
                  ].map(({ key, band, page }) => {
                    const attachmentId = page?.attachmentId;
                    if (!band || !attachmentId) return null;
                    if (trayAttachmentIds && !trayAttachmentIds.has(attachmentId)) return null;
                    const inset = Math.round(Math.min(band.width, band.height) * 0.04);
                    const pageTrayItem = trayItems.find((t) => t.attachmentId === attachmentId) || null;
                    const pageIsVideo = Boolean(pageTrayItem?.isVideo);
                    const frame = {
                      left: Math.round(Number(band.left) || 0) + inset,
                      top: Math.round(Number(band.top) || 0) + inset,
                      width: Math.max(1, Math.round(Number(band.width) || 0) - inset * 2),
                      height: Math.max(1, Math.round(Number(band.height) || 0) - inset * 2)
                    };
                    return (
                      <Box
                        key={`photo-${key}`}
                        className="rv-album-page-photo"
                        data-pa-page-photo-key={page.key}
                        draggable={effectiveEditable}
                        onDragStart={(e) => {
                          if (!effectiveEditable) {
                            e.preventDefault();
                            return;
                          }
                          e.stopPropagation();
                          startPagePhotoDrag(e.dataTransfer, page.key);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          if (e.target?.closest?.('button')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          handlePagePhotoDoubleClick(attachmentId, frame);
                        }}
                        title={
                          effectiveEditable
                            ? 'Double-click to add text · drag to the thumbnail tray to take it off this page, or onto the other page to swap'
                            : 'Double-click to view full size'
                        }
                        sx={{
                          position: 'absolute',
                          left: frame.left,
                          top: frame.top,
                          width: frame.width,
                          height: frame.height,
                          zIndex: 10,
                          pointerEvents: 'auto',
                          cursor: effectiveEditable ? 'grab' : 'default',
                          '&:active': effectiveEditable ? { cursor: 'grabbing' } : null,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <PhotoAlbumsThumbnail
                          noteId={noteId}
                          attachmentId={attachmentId}
                          storageType={storageType}
                          label={photoAlbumsTrayItemDisplayName(pageTrayItem || { attachmentId })}
                          cache={pageIsVideo ? photoAlbumsThumbnailCache : photoAlbumsPagePhotoCache}
                          fallbackCache={pageIsVideo ? null : photoAlbumsThumbnailCache}
                          objectFit="contain"
                        />
                        {pageIsVideo ? <PhotoAlbumsVideoIndicator size={36} sx={{ top: 8, left: 8, zIndex: 3 }} /> : null}
                        {effectiveEditable ? (
                          <Box
                            component="button"
                            type="button"
                            aria-label="Take this photo off the page"
                            title="Take this photo off the page (it stays in the thumbnail tray)"
                            {...guestDemoBlockProps()}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              runAfterTrafficWait(() => handleRemovePagePhoto(page.key));
                            }}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 40,
                              height: 40,
                              p: 0,
                              border: '2px solid #fff',
                              borderRadius: '4px',
                              bgcolor: '#000',
                              color: '#e53935',
                              fontSize: '1.5rem',
                              fontWeight: 900,
                              lineHeight: 1,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              '&:hover': { bgcolor: '#111', color: '#ff1744' }
                            }}
                          >
                            ×
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })}
                  {[
                    {
                      key: 'left',
                      lines: albumPageTitleLines,
                      band: activeAlbumPageBand,
                      page: leftAlbumPage
                    },
                    {
                      key: 'right',
                      lines: albumSpreadRightTitleLines,
                      band: activeRightAlbumPageBand,
                      page: rightAlbumPage
                    }
                  ].map(({ key, lines, band, page }) =>
                    lines && band && page ? (
                      <Box
                        key={key}
                        className="rv-album-page-title-band"
                        component="div"
                        role={effectiveEditable ? 'button' : undefined}
                        tabIndex={effectiveEditable ? 0 : undefined}
                        aria-label={lines.ariaLabel}
                        title={
                          effectiveEditable
                            ? 'Double-click to change album title font, size, and style (applies to all pages)'
                            : undefined
                        }
                        onMouseDown={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => {
                          if (!effectiveEditable) return;
                          event.preventDefault();
                          event.stopPropagation();
                          handleEditAlbumPageTitle();
                        }}
                        onKeyDown={(event) => {
                          if (!effectiveEditable) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleEditAlbumPageTitle();
                          }
                        }}
                        sx={{
                          position: 'absolute',
                          left: Math.round(Number(band.left) || 0),
                          top: Math.round((Number(band.top) || 0) + albumPageContentHeight),
                          width: Math.max(1, Math.round(Number(band.width) || 0)),
                          height: albumPageTitleBandPx,
                          zIndex: 88,
                          pointerEvents: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          boxSizing: 'border-box',
                          px: 1.25,
                          pb: 0.75,
                          cursor: effectiveEditable ? 'pointer' : 'default',
                          userSelect: 'none',
                          color: albumTitleStyle?.color || DEFAULT_ALBUM_TITLE_STYLE.color,
                          WebkitTextFillColor:
                            albumTitleStyle?.color || DEFAULT_ALBUM_TITLE_STYLE.color,
                          fontFamily:
                            albumTitleStyle?.fontFamily || DEFAULT_ALBUM_TITLE_STYLE.fontFamily,
                          fontWeight:
                            albumTitleStyle?.fontWeight || DEFAULT_ALBUM_TITLE_STYLE.fontWeight,
                          fontSize: `${Math.max(
                            10,
                            Math.round(
                              Number(albumTitleStyle?.fontSize) || DEFAULT_ALBUM_TITLE_STYLE.fontSize
                            )
                          )}px`,
                          WebkitTextStroke:
                            (Number(albumTitleStyle?.outlineWidth) ||
                              DEFAULT_ALBUM_TITLE_STYLE.outlineWidth) > 0
                              ? `${
                                  albumTitleStyle?.outlineWidth ??
                                  DEFAULT_ALBUM_TITLE_STYLE.outlineWidth
                                }px ${
                                  albumTitleStyle?.outlineColor ||
                                  DEFAULT_ALBUM_TITLE_STYLE.outlineColor
                                }`
                              : '0 transparent',
                          paintOrder: 'stroke fill',
                          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                          textAlign: 'center',
                          lineHeight: 1.2,
                          wordBreak: 'break-word'
                        }}
                      >
                        <Box component="span" sx={{ display: 'block', width: '100%' }}>
                          {lines.titleLine}
                        </Box>
                        <Box
                          component="span"
                          className="rv-album-page-count-line"
                          sx={{
                            display: 'block',
                            width: '100%',
                            fontFamily: ALBUM_PAGE_COUNT_LINE_STYLE.fontFamily,
                            color: ALBUM_PAGE_COUNT_LINE_STYLE.color,
                            WebkitTextFillColor: ALBUM_PAGE_COUNT_LINE_STYLE.WebkitTextFillColor,
                            WebkitTextStroke: ALBUM_PAGE_COUNT_LINE_STYLE.WebkitTextStroke,
                            paintOrder: ALBUM_PAGE_COUNT_LINE_STYLE.paintOrder,
                            fontWeight: ALBUM_PAGE_COUNT_LINE_STYLE.fontWeight,
                            textShadow: 'none',
                            fontSize: `${Math.max(
                              20,
                              Math.round(
                                (Number(albumTitleStyle?.fontSize) ||
                                  DEFAULT_ALBUM_TITLE_STYLE.fontSize) * ALBUM_PAGE_COUNT_LINE_SCALE
                              )
                            )}px`
                          }}
                        >
                          {lines.pageLine}
                        </Box>
                      </Box>
                    ) : null
                  )}
                </Box>
              </Box>

              {/* Center binder over the seam */}
              {albumBinderWidthPx > 0 && !albumOnClosedCover ? (
                <Box
                  className="rv-editor__binder rv-editor__binder--spread-center"
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: `${spreadPageWidthPx}px`,
                    top: 0,
                    width: `${albumBinderWidthPx}px`,
                    height: '100%',
                    zIndex: 6,
                    pointerEvents: 'none',
                    backgroundImage: `url(${binderMiddleImg})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center top',
                    backgroundSize: '100% 100%'
                  }}
                />
              ) : null}

              {albumOnClosedCover ? (
                <Box
                  className={
                    albumCoverFace === 'back'
                      ? 'rv-editor__album-cover rv-editor__album-cover--back'
                      : 'rv-editor__album-cover'
                  }
                  role="img"
                  aria-label={
                    albumCoverFace === 'back'
                      ? 'Album back cover — click the yellow arrow to return to pages'
                      : 'Album cover — click the yellow arrow to open'
                  }
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'var(--theme-daynight-color)',
                    pointerEvents: 'auto',
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    component="img"
                    src={albumCoverFace === 'back' ? albumCoverBackImg : albumCoverImg}
                    alt=""
                    draggable={false}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      display: 'block',
                      userSelect: 'none',
                      pointerEvents: 'none'
                    }}
                  />
                </Box>
              ) : null}

              <PhotoAlbumsPageFlipOverlay
                open={Boolean(pageFlip)}
                direction={pageFlip?.direction || 'next'}
                frontSrc={pageFlip?.frontSrc || null}
                backSrc={pageFlip?.backSrc || null}
                durationMs={pageFlip?.durationMs || ALBUM_PAGE_FLIP_MS}
                binderLeftPx={pageFlip?.binderLeftPx || 0}
                pageWidthPx={pageFlip?.pageWidthPx || 0}
                fullWidth={Boolean(pageFlip?.fullWidth)}
                onMidpoint={handlePageFlipMidpoint}
                onDone={handlePageFlipDone}
              />

              {effectiveEditable && !albumOnClosedCover ? (
                <Box
                  className={
                    pageResizeDragging
                      ? 'rv-album-page-resize-e is-dragging'
                      : 'rv-album-page-resize-e'
                  }
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize album page"
                  title="Drag to resize the page — pages and photos scale together"
                  onMouseDown={startPageContentResize}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: PAGE_RESIZE_HANDLE_WIDTH,
                    minHeight: '100%',
                    zIndex: 70,
                    cursor: 'col-resize',
                    touchAction: 'none',
                    pointerEvents: 'auto',
                    boxSizing: 'border-box',
                    bgcolor: 'var(--theme-primary-color)',
                    borderLeft: '1px solid rgba(0,0,0,0.35)',
                    borderRight: '1px solid rgba(0,0,0,0.35)',
                    '&:hover': {
                      bgcolor: 'var(--theme-primary-color)'
                    },
                    '&.is-dragging': {
                      bgcolor: 'var(--theme-primary-color)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '12%',
                      bottom: '12%',
                      left: '50%',
                      width: 0,
                      borderLeft: `6px dashed ${PAGE_RESIZE_BAR_YELLOW}`,
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                      transition: 'border-left-color 120ms ease'
                    },
                    '&:hover::before, &.is-dragging::before': {
                      borderLeftColor: PAGE_RESIZE_BAR_RED
                    }
                  }}
                />
              ) : null}
            </Box>
          </Box>
        </Box>
      </Box>

      {!albumEditorChromeHidden ? (
        <Box className="rv-editor__footer">
          <span>{counts.words} words</span>
          <span>{counts.characters} characters</span>
          <span title="Album page zoom">{albumZoom}% album</span>
        </Box>
      ) : null}

      <PhotoAlbumsContextTutorial
        active={Boolean(effectiveEditable && !presentationMode && !albumEditorChromeHidden)}
        photoEditActive={false}
        panZoomActive={false}
        hasPageContext={Boolean(albumPages?.length)}
        hasAlbumPhotos={trayItems.length > 0}
        openRequestKey={contextTutorialOpenKey}
      />
    </Box>
    </PhotoAlbumsAlbumLayoutContext.Provider>
  );
});

PhotoAlbumsNoteEditor.propTypes = {
  initialContent: PropTypes.string,
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  onReady: PropTypes.func,
  onContentHeightChange: PropTypes.func,
  header: PropTypes.node,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sharedAlbumId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  trayAttachments: PropTypes.array,
  onStageOsFiles: PropTypes.func,
  onRemoveStagedAttachment: PropTypes.func,
  onRemoveAllStagedAttachments: PropTypes.func,
  onAlbumFullscreenChange: PropTypes.func,
  albumFocusView: PropTypes.bool,
  onAlbumFocusViewChange: PropTypes.func,
  presentationMode: PropTypes.bool,
  presentationFullSlide: PropTypes.bool,
  presentationPageIndex: PropTypes.number,
  albumTitle: PropTypes.string,
  onAlbumTitleChange: PropTypes.func,
  searchTerms: PropTypes.arrayOf(PropTypes.string),
  onSearchMatchPagesChange: PropTypes.func,
  onAlbumPageDragStart: PropTypes.func,
  onAlbumPageDragEnd: PropTypes.func,
  onOrderPrint: PropTypes.func,
  onResetAlbum: PropTypes.func,
  orderAlbumActive: PropTypes.bool,
  orderFilmstripEntries: PropTypes.array,
  orderFilmstripIndex: PropTypes.number,
  onOrderFilmstripSelect: PropTypes.func,
  onOrderFilmstripDelete: PropTypes.func
};

export default PhotoAlbumsNoteEditor;
