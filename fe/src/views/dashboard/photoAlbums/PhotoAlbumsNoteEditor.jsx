import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import 'katex/dist/katex.min.css';
import GreenButton from 'ui-component/GreenButton';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE } from 'config/busyHourglassEnv';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { themedConfirm } from 'utils/themedDialog';

import { buildPhotoAlbumsEditorExtensions } from './photoAlbumsEditorExtensions';
import {
  PHOTO_ALBUMS_ATTACHMENT_NODE_NAME,
  PHOTO_ALBUMS_OPEN_PLACE_TEXT_EVENT,
  detachTextAndEmojiNearPhoto,
  insertCompanionLabelsOnPhoto,
  photoPageRectFromAttrs,
  clearPinnedPhotoEditPos,
  listTextAndEmojiNearPhoto,
  listTextAndEmojiForPhotoPos
} from './photoAlbumsAttachmentNode';
import { evictFramedPhotoInFrameToStaging, evictDuplicateFramedPhotosInSlots } from './photoAlbumsSlotOccupancy';
import {
  PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME,
  newLabelId
} from './photoAlbumsTextLabelNode';
import PhotoAlbumsPlaceTextDialog, { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';
import {
  buildPlaceTextPositionSession,
  commitPlaceTextPositionSession,
  resolvePlaceTextCaption
} from './photoAlbumsPlaceTextPosition';
import {
  albumPageTitleBandHeightPx,
  albumTitleStyleMarkerHtml,
  DEFAULT_ALBUM_TITLE_STYLE,
  formatAlbumPageTitleLines,
  ALBUM_PAGE_COUNT_LINE_STYLE,
  parseAlbumTitleStyleFromHtml,
  stripAlbumTitleStyleMarker
} from './photoAlbumsAlbumTitleStyle';
import { PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX } from './photoAlbumsEmojiPalette';
import { PhotoAlbumsAlbumLayoutContext } from './photoAlbumsAlbumLayoutContext';
import PhotoAlbumsEditorToolbar from './PhotoAlbumsEditorToolbar';
import PhotoAlbumsPageTemplateOverlay from './PhotoAlbumsPageTemplateOverlay';
import PhotoAlbumsTemplatePickerPanel, {
  DRAG_ALBUM_TEMPLATE,
  isAlbumTemplateDrag,
  readAlbumTemplateDragId
} from './PhotoAlbumsTemplatePickerPanel';
import PhotoAlbumsAlbumZoomBar from './PhotoAlbumsAlbumZoomBar';
import PhotoAlbumsPageFilmstrip, { buildAlbumPageFilmstripModels } from './PhotoAlbumsPageFilmstrip';
import PhotoAlbumsPhotoFullscreenOverlay from './PhotoAlbumsPhotoFullscreenOverlay';
import PhotoAlbumsPageFlipOverlay, {
  captureAlbumSpreadPageHalves,
  prefersAlbumPageFlipReducedMotion
} from './PhotoAlbumsPageFlipOverlay';
import PhotoAlbumsContextTutorial from './PhotoAlbumsContextTutorial';
import { findAlbumPagesMatchingSearchTerms } from './photoAlbumsPageSearch';
import PhotoAlbumsPhotoStagingTray, {
  DRAG_STAGED_ATTACHMENT,
  DRAG_STAGED_FLAG,
  isStagedAttachmentDrag,
  readStagedAttachmentDrag
} from './PhotoAlbumsPhotoStagingTray';
import {
  albumSlotToPx,
  albumTemplateBlockHeight,
  createAlbumTemplateInstance,
  findAlbumPhotoSnapAmongInstances,
  getPhotoAlbumsPageTemplate,
  parseAlbumTemplateInstancesFromHtml,
  PHOTO_ALBUMS_AUTO_LAYOUT_BY_COUNT,
  resolveAlbumTemplateSlots,
  serializeAlbumTemplateInstances
} from './photoAlbumsPageTemplates';
import {
  buildFramedPhotoAttrsForSlot,
  planAutoLayoutPages,
  planFillEmptyTemplatePages,
  resolveStagingPhotoAspects
} from './photoAlbumsAutoLayout';
import { getPhotoAlbumsAttachmentViewKind, fileExtensionLower, isPhotoAlbumsStagingVideoExtension } from 'utils/photoAlbumsFileFormats';
import { MY_PHOTO_ALBUMS_VIEW_PATH } from 'constants/myPhotoAlbumsRoute';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { getAlbumBinderWidthRatio, getAlbumSlideshowBinderWidthRatio } from 'config/albumBinderWidthEnv';
import binderMiddleImg from 'assets/images/bindermiddle.png';
import albumCoverImg from 'assets/images/albumcover.png';
import albumCoverBackImg from 'assets/images/albumcoverback.png';
import leftArrowImg from 'assets/images/leftarrow.png';
import rightArrowImg from 'assets/images/rightarrow.png';
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
  DRAG_FILES_EXPLORER,
  DRAG_FILES_EXPLORER_FLAG,
  isFilesExplorerDrag
} from './photoAlbumsFilesExplorerDrag';
import { remapTextLabelAttrsToBand } from './photoAlbumsMoveAlbumPage';
import { mergeStagingItemPreview } from './photoAlbumsStagingPreviewCache';
import { setPhotoAlbumsColumnResizing } from './photoAlbumsColumnResizeGate';
import './photoAlbumsEditor.scss';

const EMPTY_DOC = '<p></p>';
const TEMPLATE_MARKER_RE = /<div\b[^>]*data-rv-album-template\b[^>]*>\s*<\/div>/gi;
const STAGING_MARKER_RE = /<div\b[^>]*data-rv-album-staging\b[^>]*>\s*<\/div>/gi;
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
const TEMPLATE_STACK_GAP = 24;
/** First template top — flush to top of the album page (chrome sits in page padding above). */
const ALBUM_TEMPLATE_MIN_Y = 0;

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
  borderLeft: '1px solid rgba(0,0,0,0.35)',
  borderRight: '1px solid rgba(0,0,0,0.35)',
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

/** Left + right template instances visible in the current spread. */
function activeSpreadPageInstances(orderedPages, pageIndex) {
  const ordered = orderedPages || [];
  if (!ordered.length) return [];
  const leftIdx = albumSpreadLeftPageIndex(pageIndex);
  const pages = [];
  if (ordered[leftIdx]) pages.push(ordered[leftIdx]);
  const rightIdx = leftIdx + 1;
  if (rightIdx < ordered.length && ordered[rightIdx]) pages.push(ordered[rightIdx]);
  return pages;
}

/**
 * Force left|binder|right x/y/w so overlay, snap, and occupancy share one coordinate space.
 * Never trust a bloated saved inst.w (legacy “spread width as page width” data).
 */
function withSpreadPageGeometry(
  instances,
  pageWidth,
  binderWidth = 0,
  orientation = 'portrait'
) {
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  const ordered = sortAlbumPagesByBand(instances || []);
  return ordered.map((inst, pageIndex) => {
    const h =
      inst.h > 40
        ? Math.round(inst.h)
        : albumTemplateBlockHeight(pw, orientation);
    return {
      ...inst,
      x: albumPageXForSpreadColumn(pageIndex, pw, bw),
      y: albumPageTopForSpreadRow(albumSpreadRowForPageIndex(pageIndex), h),
      w: pw,
      h
    };
  });
}

/** Photo slots already occupied on each template instance (by framed photo center). */
function collectOccupiedSlotsByInstanceKey(editor, instances, pageWidth, pageOrientation, binderWidth = 0) {
  const next = {};
  if (!editor) return next;
  const corrected = withSpreadPageGeometry(
    instances,
    pageWidth,
    binderWidth,
    pageOrientation
  );
  for (const inst of corrected) {
    const layout = getPhotoAlbumsPageTemplate(inst.id);
    if (!layout) continue;
    const band = templateBand(inst, pageWidth, pageOrientation);
    const occupied = new Set();
    editor.state.doc.descendants((node) => {
      if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
      const fl = parseOptionalPx(node.attrs.frameLeft);
      const ft = parseOptionalPx(node.attrs.frameTop);
      const fw = parseOptionalPx(node.attrs.frameWidth);
      const fh = parseOptionalPx(node.attrs.frameHeight);
      if (fl == null || ft == null || fw == null || fh == null) return;
      const cx = fl + fw / 2;
      const cy = ft + fh / 2;
      for (const slot of resolveAlbumTemplateSlots(layout, inst.slots)) {
        if (slot.type !== 'photo') continue;
        const rect = albumSlotToPx(slot, band.width, band.height);
        const left = band.left + rect.left;
        const top = band.top + rect.top;
        if (cx >= left && cx <= left + rect.width && cy >= top && cy <= top + rect.height) {
          occupied.add(slot.id);
          break;
        }
      }
    });
    next[inst.key] = occupied;
  }
  return next;
}

function buildAutoLayoutPhotoNodes(editor, inst, photos, slots, band, placedIds) {
  const nodes = [];
  const nodeType = editor?.state?.schema?.nodes?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
  if (!nodeType || !inst) return nodes;
  const blockW = band.width;
  const blockHInst = band.height;
  for (let si = 0; si < photos.length && si < slots.length; si += 1) {
    const photo = photos[si];
    const slot = slots[si];
    const rect = albumSlotToPx(slot, blockW, blockHInst);
    const frameAttrs = buildFramedPhotoAttrsForSlot(photo.aspect, rect, band.left, band.top);
    const attachmentId = Number(photo.attachmentId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1) continue;
    nodes.push(
      nodeType.create({
        attachmentId,
        fileName: String(photo.fileName || ''),
        fileExtension: String(photo.fileExtension || ''),
        fileSizeBytes: photo.fileSizeBytes ?? null,
        checksum: photo.checksum ? String(photo.checksum) : null,
        ...frameAttrs
      })
    );
    placedIds.add(attachmentId);
  }
  return nodes;
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
  return row * (h + TEMPLATE_STACK_GAP);
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

/** True when saved template x/y still use the old vertical stack (not spread columns). */
function albumTemplatesNeedSpreadRestack(instances, pageWidth, binderWidth, orientation = 'portrait') {
  const list = instances || [];
  if (!list.length) return false;
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  const h = albumTemplateBlockHeight(pw, orientation);
  // Any template wider than ~1.2 pages was likely saved using spread canvas width as "page" width.
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

/** Page-top Y for template index (one template = one page, stacked vertically). */
function albumPageTopForIndex(pageIndex, pageHeight) {
  return albumPageTopForSpreadRow(albumSpreadRowForPageIndex(pageIndex), pageHeight);
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
 * Flush every template to its own book-page band in the given order
 * (stacked in data only). Input order = page order (left → right / 1 → N).
 * The UI shows one two-page spread at a time in the black shell (flip), not a scroll stack.
 * Remaps snapped photos and text labels when `editor` is set.
 */
function restackTemplatesFlushToPages(
  instances,
  pageWidth,
  orientation,
  editor = null,
  binderWidth = 0
) {
  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bw = Math.max(0, Math.round(Number(binderWidth) || 0));
  const h = albumTemplateBlockHeight(pw, orientation);
  // Preserve caller order — do not re-sort by Y (that put new pages on the left).
  const ordered = [...(instances || [])];
  const pageBands = ordered.map((inst, pageIndex) => {
    const oldBand = templateBand(inst, pw, orientation);
    const spreadRow = albumSpreadRowForPageIndex(pageIndex);
    const replaced = createAlbumTemplateInstance({
      key: inst.key,
      id: inst.id,
      x: albumPageXForSpreadColumn(pageIndex, pw, bw),
      y: albumPageTopForSpreadRow(spreadRow, h),
      w: pw,
      h,
      slots: inst.slots
    });
    return {
      pageIndex,
      oldBand,
      newBand: templateBand(replaced, pw, orientation),
      replaced,
      templateLayoutId: replaced.id,
      slotOverrides: replaced.slots
    };
  });

  if (editor) {
    const { state } = editor;
    let tr = state.tr;
    let changed = false;

    state.doc.descendants((node, pos) => {
      if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
        const fl = parseOptionalPx(node.attrs.frameLeft);
        const ft = parseOptionalPx(node.attrs.frameTop);
        const fw = parseOptionalPx(node.attrs.frameWidth);
        const fh = parseOptionalPx(node.attrs.frameHeight);
        if (fl == null || ft == null || fw == null || fh == null) return;

        const cx = fl + fw / 2;
        const cy = ft + fh / 2;
        const bandIdx = findRestackPageBandIndex(cx, cy, pageBands);
        if (bandIdx < 0) return;

        const { oldBand, newBand, templateLayoutId, slotOverrides } = pageBands[bandIdx];
        const nextAttrs = computeFramedPhotoBandRemapAttrs(
          node,
          oldBand,
          newBand,
          templateLayoutId,
          slotOverrides
        );
        if (!nextAttrs) return;

        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...nextAttrs });
        changed = true;
        return;
      }

      // Text/emoji labels must follow their page band too — otherwise inserting a
      // new Template steals prior-page stickers into the blank page's Y range.
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

function stripAlbumTemplateMarker(html) {
  return String(html || '').replace(TEMPLATE_MARKER_RE, '');
}

function stripAlbumStagingMarker(html) {
  return String(html || '').replace(STAGING_MARKER_RE, '');
}

function stripAlbumMarkers(html) {
  // Drop accidental drag text TipTap inserted when a vault/Finder/staging drop missed a slot.
  const cleaned = stripPhotoAlbumsDragJunkBodyRows(
    String(html || '')
      .replace(/<p[^>]*>\s*pa-staged:\d+\s*<\/p>/gi, '')
      .replace(/(^|>)\s*pa-staged:\d+\s*(<|$)/gi, '$1$2')
  );
  return stripAlbumTitleStyleMarker(stripAlbumStagingMarker(stripAlbumTemplateMarker(cleaned)));
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

function normalizeCompanionLabels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const attrs = c.attrs && typeof c.attrs === 'object' ? { ...c.attrs } : null;
      if (!attrs) return null;
      return {
        attrs,
        relX: Number.isFinite(Number(c.relX)) ? Number(c.relX) : 0.08,
        relY: Number.isFinite(Number(c.relY)) ? Number(c.relY) : 0.08,
        relBoxW: Number.isFinite(Number(c.relBoxW)) ? Number(c.relBoxW) : null,
        relBoxH: Number.isFinite(Number(c.relBoxH)) ? Number(c.relBoxH) : null
      };
    })
    .filter(Boolean);
}

/** Skip emoji stickers — Add Text dropdown lists readable photo/video captions only. */
function isPlaceTextEmojiSticker(attrs) {
  if (/Emoji/i.test(String(attrs?.fontFamily || ''))) return true;
  const t = String(attrs?.text || '').trim();
  if (!t || /\s/.test(t)) return false;
  if (/[A-Za-z0-9]/.test(t)) return false;
  return [...t].length <= 8;
}

/**
 * Plain text labels overlapping the photo at `photoPos` (for Add Text select, ≥2).
 * @returns {{ labelId: string, pos: number, text: string, color: *, outlineColor: *, outlineWidth: *, fontSize: *, fontFamily: *, fontWeight: * }[]}
 */
function collectPlaceTextLabelsNearPhoto(editor, photoPos) {
  if (!editor?.state || !Number.isFinite(photoPos)) return [];
  const node = editor.state.doc.nodeAt(photoPos);
  if (!node || node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return [];
  const rect = photoPageRectFromAttrs(node.attrs);
  if (!rect) return [];
  return listTextAndEmojiForPhotoPos(editor.state, photoPos)
    .filter((item) => !isPlaceTextEmojiSticker(item.attrs))
    .map((item) => ({
      labelId: String(item.attrs?.labelId || ''),
      pos: item.pos,
      text: String(item.attrs?.text || '').trim() || 'Text',
      color: item.attrs?.color,
      outlineColor: item.attrs?.outlineColor,
      outlineWidth: item.attrs?.outlineWidth,
      fontSize: item.attrs?.fontSize,
      fontFamily: item.attrs?.fontFamily,
      fontWeight: item.attrs?.fontWeight
    }));
}

function serializeStagingItems(items) {
  const list = (Array.isArray(items) ? items : [])
    .map((item) => {
      const companionLabels = normalizeCompanionLabels(item.companionLabels);
      return {
        attachmentId: Number(item.attachmentId),
        fileName: String(item.fileName || ''),
        fileExtension: String(item.fileExtension || ''),
        fileSizeBytes: item.fileSizeBytes == null ? null : Number(item.fileSizeBytes),
        checksum: item.checksum ? String(item.checksum) : null,
        ...(companionLabels.length ? { companionLabels } : null)
      };
    })
    .filter((item) => Number.isFinite(item.attachmentId) && item.attachmentId > 0);
  if (!list.length) return '';
  return JSON.stringify(list).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Keep first of each attachment; also drop size+checksum duplicates. */
function dedupeStagingItems(items) {
  const out = [];
  const seenIds = new Set();
  const seenChecksums = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const id = Number(item?.attachmentId);
    if (!Number.isFinite(id) || id < 1) continue;
    if (seenIds.has(id)) continue;
    const size = item.fileSizeBytes == null ? null : Number(item.fileSizeBytes);
    const checksum = item.checksum ? String(item.checksum).toLowerCase() : '';
    if (checksum && Number.isFinite(size)) {
      const key = `${size}:${checksum}`;
      if (seenChecksums.has(key)) continue;
      seenChecksums.add(key);
    }
    seenIds.add(id);
    const companionLabels = normalizeCompanionLabels(item.companionLabels);
    out.push({
      attachmentId: id,
      fileName: String(item.fileName || ''),
      fileExtension: String(item.fileExtension || ''),
      fileSizeBytes: Number.isFinite(size) ? size : null,
      checksum: checksum || null,
      ...(item.localPreviewUrl ? { localPreviewUrl: String(item.localPreviewUrl) } : null),
      ...(companionLabels.length ? { companionLabels } : null)
    });
  }
  return out;
}

function parseStagingItemsFromHtml(html) {
  const raw = String(html || '');
  const match = raw.match(/data-staging-json=["']([^"']*)["']/i);
  if (!match) return [];
  try {
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];
    return dedupeStagingItems(
      parsed.map((item) => ({
        attachmentId: Number(item?.attachmentId ?? item?.attachment_id),
        fileName: String(item?.fileName || item?.file_name || ''),
        fileExtension: String(item?.fileExtension || item?.file_extension || ''),
        fileSizeBytes: item?.fileSizeBytes ?? item?.file_size_bytes ?? null,
        checksum: item?.checksum ?? null,
        companionLabels: item?.companionLabels ?? item?.companion_labels ?? null
      }))
    );
  } catch {
    return [];
  }
}

function withAlbumMarkers(
  html,
  instances,
  stagingItems,
  orientation = 'portrait',
  pageWidthPx = null,
  titleStyle = null
) {
  const body = stripAlbumMarkers(html);
  const parts = [];
  const templateJson = serializeAlbumTemplateInstances(instances);
  const orient =
    String(orientation || '').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
  const pageW = Number(pageWidthPx);
  const pageWAttr =
    Number.isFinite(pageW) && pageW >= 200 ? ` data-album-page-width="${Math.round(pageW)}"` : '';
  if (templateJson) {
    parts.push(
      `<div data-rv-album-template="" data-album-templates="${templateJson}" data-album-orientation="${orient}"${pageWAttr} style="display:none"></div>`
    );
  } else {
    // Persist orientation (+ page width) even with no templates yet.
    parts.push(
      `<div data-rv-album-template="" data-album-orientation="${orient}"${pageWAttr} style="display:none"></div>`
    );
  }
  const stagingJson = serializeStagingItems(stagingItems);
  if (stagingJson) {
    parts.push(
      `<div data-rv-album-staging="" data-staging-json="${stagingJson}" style="display:none"></div>`
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

/** Resolve a tray-drop snap from the DOM slot under the cursor (zoom / binder-safe). */
function snapAlbumPhotoSlotAtClientPoint(clientX, clientY, activeSpread) {
  const list = Array.isArray(activeSpread) ? activeSpread : [];
  if (!list.length) return null;
  const stack =
    typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
  let slotEl = null;
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const hit = el.closest?.('[data-album-slot][data-album-slot-type="photo"]');
    if (hit) {
      slotEl = hit;
      break;
    }
  }
  if (!slotEl) return null;
  const slotId = String(slotEl.getAttribute('data-album-slot') || '').trim();
  if (!slotId) return null;
  const pageKey = String(
    slotEl.closest?.('[data-pa-album-page-key]')?.getAttribute('data-pa-album-page-key') || ''
  ).trim();
  const inst = pageKey
    ? list.find((t) => t.key === pageKey)
    : null;
  if (!inst) return null;
  const layout = getPhotoAlbumsPageTemplate(inst.id);
  if (!layout) return null;
  const slot = resolveAlbumTemplateSlots(layout, inst.slots).find((s) => s.id === slotId);
  if (!slot || slot.type !== 'photo') return null;
  const blockW = inst.w > 0 ? inst.w : 480;
  const blockH = inst.h > 0 ? inst.h : albumTemplateBlockHeight(blockW);
  const rect = albumSlotToPx(slot, blockW, blockH);
  return {
    left: (inst.x || 0) + rect.left,
    top: (inst.y || 0) + rect.top,
    width: rect.width,
    height: rect.height,
    slotId,
    instanceKey: inst.key,
    highlightId: `${inst.key}:${slotId}`
  };
}

/** Contain-fit a photo or video into a template slot frame (full media visible; letterbox OK). */
function coverFitAttrsForSlotRect(slotRect, originX, originY, aspect = 4 / 3) {
  const fw = Math.max(80, Math.round(slotRect.width) || 80);
  const fh = Math.max(40, Math.round(slotRect.height) || 40);
  const left = Math.round(originX + slotRect.left);
  const top = Math.round(originY + slotRect.top);
  const a = Number(aspect) > 0 ? Number(aspect) : 4 / 3;
  let pw = fw;
  let ph = Math.round(pw / a);
  if (ph > fh) {
    ph = fh;
    pw = Math.round(ph * a);
  }
  return {
    posLeft: left,
    posTop: top,
    width: pw,
    height: ph,
    panX: Math.round((fw - pw) / 2),
    panY: Math.round((fh - ph) / 2),
    frameLeft: left,
    frameTop: top,
    frameWidth: fw,
    frameHeight: fh,
    slotFit: 'contain'
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

/** Center of a placed / framed attachment node (page coords). */
function attachmentNodeCenter(node) {
  if (!node || node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return null;
  const fl = parseOptionalPx(node.attrs.frameLeft);
  const ft = parseOptionalPx(node.attrs.frameTop);
  const fw = parseOptionalPx(node.attrs.frameWidth);
  const fh = parseOptionalPx(node.attrs.frameHeight);
  if (fl != null && ft != null && fw != null && fh != null) {
    return { cx: fl + fw / 2, cy: ft + fh / 2 };
  }
  const pl = parseOptionalPx(node.attrs.posLeft);
  const pt = parseOptionalPx(node.attrs.posTop);
  const pwNode = parseOptionalPx(node.attrs.width) || 120;
  const phNode = parseOptionalPx(node.attrs.height) || 90;
  if (pl == null || pt == null) return null;
  return { cx: pl + pwNode / 2, cy: pt + phNode / 2 };
}

function attachmentNodeInBand(node, band) {
  const center = attachmentNodeCenter(node);
  if (!center || !band) return false;
  return pointInBand(center.cx, center.cy, band);
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

/** Return every photo in `band` to the green thumbnail tray (text labels on page are removed). */
function returnPhotosInBandToStagingTray(editor, band) {
  const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
  if (!editor || !band || typeof store?.returnAttachmentToStaging !== 'function') return 0;
  const attrsList = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
    if (!attachmentNodeInBand(node, band)) return;
    attrsList.push(node.attrs);
  });
  let count = 0;
  for (const attrs of attrsList) {
    const attachmentId = Number(attrs.attachmentId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1) continue;
    const returned = store.returnAttachmentToStaging({
      attachmentId,
      fileName: String(attrs.fileName || ''),
      fileExtension: String(attrs.fileExtension || ''),
      fileSizeBytes: attrs.fileSizeBytes ?? null,
      checksum: attrs.checksum ? String(attrs.checksum) : null,
      _photoRect: photoPageRectFromAttrs(attrs)
    });
    if (returned) count += 1;
  }
  removeTextLabelsInBand(editor, band);
  return count;
}

/** Return every photo on the album page to the thumbnail tray. */
function returnAllPagePhotosToStagingTray(editor) {
  const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
  if (!editor || typeof store?.returnAttachmentToStaging !== 'function') return 0;
  const attrsList = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
    attrsList.push(node.attrs);
  });
  let count = 0;
  for (const attrs of attrsList) {
    const attachmentId = Number(attrs.attachmentId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1) continue;
    const returned = store.returnAttachmentToStaging({
      attachmentId,
      fileName: String(attrs.fileName || ''),
      fileExtension: String(attrs.fileExtension || ''),
      fileSizeBytes: attrs.fileSizeBytes ?? null,
      checksum: attrs.checksum ? String(attrs.checksum) : null,
      _photoRect: photoPageRectFromAttrs(attrs)
    });
    if (returned) count += 1;
  }
  return count;
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

/**
 * Remap one framed photo from oldBand → newBand (slot-aware). Returns attr patch or null.
 */
function computeFramedPhotoBandRemapAttrs(node, oldBand, newBand, templateLayoutId, slotOverrides = null) {
  if (!oldBand || !newBand) return null;
  if (oldBand.width < 8 || oldBand.height < 8 || newBand.width < 8 || newBand.height < 8) {
    return null;
  }
  if (albumBandsMatch(oldBand, newBand)) return null;

  const fl = parseOptionalPx(node.attrs.frameLeft);
  const ft = parseOptionalPx(node.attrs.frameTop);
  const fw = parseOptionalPx(node.attrs.frameWidth);
  const fh = parseOptionalPx(node.attrs.frameHeight);
  if (fl == null || ft == null || fw == null || fh == null) return null;

  const cx = fl + fw / 2;
  const cy = ft + fh / 2;
  if (!pointInBand(cx, cy, oldBand)) return null;

  const layout = getPhotoAlbumsPageTemplate(templateLayoutId);
  const slots = layout?.slots?.length ? resolveAlbumTemplateSlots(layout, slotOverrides) : [];

  let newFl;
  let newFt;
  let newFw;
  let newFh;
  let matched = false;

  for (const slot of slots) {
    const oldRect = albumSlotToPx(slot, oldBand.width, oldBand.height);
    const oldLeft = oldBand.left + oldRect.left;
    const oldTop = oldBand.top + oldRect.top;
    if (
      cx >= oldLeft &&
      cx <= oldLeft + oldRect.width &&
      cy >= oldTop &&
      cy <= oldTop + oldRect.height
    ) {
      const newRect = albumSlotToPx(slot, newBand.width, newBand.height);
      newFl = newBand.left + newRect.left;
      newFt = newBand.top + newRect.top;
      newFw = Math.max(40, newRect.width);
      newFh = Math.max(40, newRect.height);
      matched = true;
      break;
    }
  }

  if (!matched) {
    const sx = newBand.width / oldBand.width;
    const sy = newBand.height / oldBand.height;
    newFl = Math.round(newBand.left + (fl - oldBand.left) * sx);
    newFt = Math.round(newBand.top + (ft - oldBand.top) * sy);
    newFw = Math.max(40, Math.round(fw * sx));
    newFh = Math.max(40, Math.round(fh * sy));
  }

  const oldPw = parseOptionalPx(node.attrs.width) || fw;
  const oldPh = parseOptionalPx(node.attrs.height) || fh;
  const oldPanX = parseOptionalPx(node.attrs.panX) ?? 0;
  const oldPanY = parseOptionalPx(node.attrs.panY) ?? 0;
  const sx = newFw / Math.max(1, fw);
  const sy = newFh / Math.max(1, fh);
  const newPw = Math.max(newFw, Math.round(oldPw * sx));
  const newPh = Math.max(newFh, Math.round(oldPh * sy));
  let newPanX = Math.round(oldPanX * sx);
  let newPanY = Math.round(oldPanY * sy);
  if (newPw >= newFw) {
    newPanX = Math.min(0, Math.max(newFw - newPw, newPanX));
  } else {
    newPanX = Math.min(newFw - newPw, Math.max(0, newPanX));
  }
  if (newPh >= newFh) {
    newPanY = Math.min(0, Math.max(newFh - newPh, newPanY));
  } else {
    newPanY = Math.min(newFh - newPh, Math.max(0, newPanY));
  }

  return {
    posLeft: newFl,
    posTop: newFt,
    width: newPw,
    height: newPh,
    panX: newPanX,
    panY: newPanY,
    frameLeft: newFl,
    frameTop: newFt,
    frameWidth: newFw,
    frameHeight: newFh
  };
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

/**
 * Drop slot-window attrs for photos whose frame center sits in `band`
 * (or all framed photos when band is omitted).
 * @deprecated Prefer returnPhotosInBandToStagingTray — callers should send photos to the tray.
 */
function releaseAttachmentsFromTemplateFrames(editor, band = null) {
  if (!editor) return false;
  const { state } = editor;
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
    const frameLeft = parseOptionalPx(node.attrs.frameLeft);
    const frameTop = parseOptionalPx(node.attrs.frameTop);
    const frameWidth = parseOptionalPx(node.attrs.frameWidth);
    const frameHeight = parseOptionalPx(node.attrs.frameHeight);
    if (frameLeft == null || frameTop == null || frameWidth == null || frameHeight == null) {
      return;
    }
    if (band) {
      const cx = frameLeft + frameWidth / 2;
      const cy = frameTop + frameHeight / 2;
      if (!pointInBand(cx, cy, band)) return;
    }
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      posLeft: frameLeft,
      posTop: frameTop,
      width: frameWidth,
      height: frameHeight,
      panX: null,
      panY: null,
      frameLeft: null,
      frameTop: null,
      frameWidth: null,
      frameHeight: null,
      slotFit: null
    });
    changed = true;
  });

  if (changed) editor.view.dispatch(tr);
  return changed;
}

function templateBand(inst, pageWidthFallback = 480, orientation = 'portrait') {
  const w = inst.w > 0 ? inst.w : pageWidthFallback;
  const h = inst.h > 0 ? inst.h : albumTemplateBlockHeight(w, orientation);
  return {
    left: inst.x || 0,
    top: inst.y || 0,
    width: w,
    height: h
  };
}

/**
 * When a template block is moved/resized, keep snapped photos glued to their
 * slots — frames and cover-sized tiles scale with the new slot geometry.
 */
function remapFramedPhotosForTemplateResize(editor, templateLayoutId, oldBand, newBand, slotOverrides = null) {
  if (!editor || !oldBand || !newBand) return false;
  if (oldBand.width < 8 || oldBand.height < 8 || newBand.width < 8 || newBand.height < 8) {
    return false;
  }
  if (albumBandsMatch(oldBand, newBand)) return false;

  const { state } = editor;
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
    const nextAttrs = computeFramedPhotoBandRemapAttrs(
      node,
      oldBand,
      newBand,
      templateLayoutId,
      slotOverrides
    );
    if (!nextAttrs) return;
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...nextAttrs });
    changed = true;
  });

  if (changed) editor.view.dispatch(tr);
  return changed;
}

/**
 * Move/resize one slot's framed photo to a new absolute frame rect (proportional).
 * `oldFrame` / `newFrame`: { left, top, width, height } in page/PM coords.
 */
function remapPhotoForSlotFrameChange(editor, oldFrame, newFrame) {
  if (!editor || !oldFrame || !newFrame) return false;
  const { state } = editor;
  let tr = state.tr;
  let changed = false;
  const oLeft = oldFrame.left;
  const oTop = oldFrame.top;
  const oW = Math.max(1, oldFrame.width);
  const oH = Math.max(1, oldFrame.height);
  const nLeft = Math.round(newFrame.left);
  const nTop = Math.round(newFrame.top);
  const nW = Math.max(40, Math.round(newFrame.width));
  const nH = Math.max(40, Math.round(newFrame.height));

  state.doc.descendants((node, pos) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
    const fl = parseOptionalPx(node.attrs.frameLeft);
    const ft = parseOptionalPx(node.attrs.frameTop);
    const fw = parseOptionalPx(node.attrs.frameWidth);
    const fh = parseOptionalPx(node.attrs.frameHeight);
    if (fl == null || ft == null || fw == null || fh == null) return;
    const cx = fl + fw / 2;
    const cy = ft + fh / 2;
    if (cx < oLeft || cx > oLeft + oW || cy < oTop || cy > oTop + oH) return;

    const sx = nW / oW;
    const sy = nH / oH;
    const oldPw = parseOptionalPx(node.attrs.width) || fw;
    const oldPh = parseOptionalPx(node.attrs.height) || fh;
    const oldPanX = parseOptionalPx(node.attrs.panX) ?? 0;
    const oldPanY = parseOptionalPx(node.attrs.panY) ?? 0;
    const newPw = Math.max(nW, Math.round(oldPw * sx));
    const newPh = Math.max(nH, Math.round(oldPh * sy));
    let newPanX = Math.round(oldPanX * sx);
    let newPanY = Math.round(oldPanY * sy);
    if (newPw >= nW) newPanX = Math.min(0, Math.max(nW - newPw, newPanX));
    else newPanX = Math.min(nW - newPw, Math.max(0, newPanX));
    if (newPh >= nH) newPanY = Math.min(0, Math.max(nH - newPh, newPanY));
    else newPanY = Math.min(nH - newPh, Math.max(0, newPanY));

    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      posLeft: nLeft,
      posTop: nTop,
      width: newPw,
      height: newPh,
      panX: newPanX,
      panY: newPanY,
      frameLeft: nLeft,
      frameTop: nTop,
      frameWidth: nW,
      frameHeight: nH
    });
    changed = true;
  });

  if (changed) editor.view.dispatch(tr);
  return changed;
}

/**
 * Clamp pan inside a fixed slot window.
 * Allow dragging partly out (clipped) — keep a small overlap so the photo does not vanish.
 */
function clampPanInsideFrame(panX, panY, photoW, photoH, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const pw = Math.max(1, photoW);
  const ph = Math.max(1, photoH);
  const minOverlapX = Math.max(24, Math.min(64, Math.round(fw * 0.12)));
  const minOverlapY = Math.max(24, Math.min(64, Math.round(fh * 0.12)));
  const minX = minOverlapX - pw;
  const maxX = fw - minOverlapX;
  const minY = minOverlapY - ph;
  const maxY = fh - minOverlapY;
  return {
    panX: Math.round(Math.min(maxX, Math.max(minX, panX))),
    panY: Math.round(Math.min(maxY, Math.max(minY, panY)))
  };
}

/** Find the framed attachment whose frame center sits inside `frame`. */
function findFramedPhotoInFrame(state, frame) {
  if (!state || !frame) return null;
  const fLeft = frame.left;
  const fTop = frame.top;
  const fW = Math.max(1, frame.width);
  const fH = Math.max(1, frame.height);
  let found = null;
  state.doc.descendants((node, pos) => {
    if (found || node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
    const fl = parseOptionalPx(node.attrs.frameLeft);
    const ft = parseOptionalPx(node.attrs.frameTop);
    const fw = parseOptionalPx(node.attrs.frameWidth);
    const fh = parseOptionalPx(node.attrs.frameHeight);
    if (fl == null || ft == null || fw == null || fh == null) return;
    const cx = fl + fw / 2;
    const cy = ft + fh / 2;
    if (cx < fLeft || cx > fLeft + fW || cy < fTop || cy > fTop + fH) return;
    found = { node, pos, fl, ft, fw, fh };
  });
  return found;
}

/** Write width/height/pan for the photo inside a fixed slot frame (frame* unchanged). */
function setPhotoTransformInsideFrame(editor, frame, next) {
  if (!editor || !frame || !next) return false;
  const hit = findFramedPhotoInFrame(editor.state, frame);
  if (!hit) return false;
  const fw = Math.max(1, hit.fw);
  const fh = Math.max(1, hit.fh);
  const width = Math.max(40, Math.round(next.width ?? parseOptionalPx(hit.node.attrs.width) ?? fw));
  const height = Math.max(40, Math.round(next.height ?? parseOptionalPx(hit.node.attrs.height) ?? fh));
  const pan = clampPanInsideFrame(
    next.panX ?? parseOptionalPx(hit.node.attrs.panX) ?? 0,
    next.panY ?? parseOptionalPx(hit.node.attrs.panY) ?? 0,
    width,
    height,
    fw,
    fh
  );
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, {
    ...hit.node.attrs,
    width,
    height,
    panX: pan.panX,
    panY: pan.panY
  });
  editor.view.dispatch(tr);
  return true;
}

/** Snapshot of photo transform for a slot-handle drag gesture. */
function readPhotoTransformInFrame(editor, frame) {
  const hit = findFramedPhotoInFrame(editor?.state, frame);
  if (!hit) return null;
  const fw = Math.max(1, hit.fw);
  const fh = Math.max(1, hit.fh);
  const width = Math.max(fw, parseOptionalPx(hit.node.attrs.width) || fw);
  const height = Math.max(fh, parseOptionalPx(hit.node.attrs.height) || fh);
  return {
    width,
    height,
    panX: parseOptionalPx(hit.node.attrs.panX) ?? 0,
    panY: parseOptionalPx(hit.node.attrs.panY) ?? 0,
    frameW: fw,
    frameH: fh
  };
}

/**
 * Scale photo inside a fixed frame from an origin snapshot (keeps visual center).
 * Used by slot 8-circle handles and scroll-wheel zoom.
 */
function scalePhotoInsideFrameFromOrigin(editor, frame, origin, factor) {
  if (!editor || !frame || !origin || !(factor > 0)) return false;
  const fw = Math.max(1, origin.frameW || frame.width);
  const fh = Math.max(1, origin.frameH || frame.height);
  const oldPw = Math.max(1, origin.width);
  const oldPh = Math.max(1, origin.height);
  const aspect = oldPw / Math.max(1, oldPh);
  const minW = Math.max(40, Math.round(fw * 0.35));
  const maxW = Math.round(fw * 4);
  let newPw = Math.min(maxW, Math.max(minW, Math.round(oldPw * factor)));
  let newPh = Math.round(newPw / aspect);
  if (newPh < Math.round(fh * 0.35)) {
    newPh = Math.max(40, Math.round(fh * 0.35));
    newPw = Math.round(newPh * aspect);
  }
  const oldPanX = origin.panX ?? 0;
  const oldPanY = origin.panY ?? 0;
  const visCx = fw / 2 - oldPanX;
  const visCy = fh / 2 - oldPanY;
  const relX = visCx / Math.max(1, oldPw);
  const relY = visCy / Math.max(1, oldPh);
  const newPanX = fw / 2 - relX * newPw;
  const newPanY = fh / 2 - relY * newPh;
  return setPhotoTransformInsideFrame(editor, frame, {
    width: newPw,
    height: newPh,
    panX: newPanX,
    panY: newPanY
  });
}

/** Scroll-wheel zoom of the photo inside a slot frame (clipped by frame bounds). */
function zoomPhotoInsideFrame(editor, frame, factor) {
  const origin = readPhotoTransformInFrame(editor, frame);
  if (!origin) return false;
  return scalePhotoInsideFrameFromOrigin(editor, frame, origin, factor);
}

function lowestTemplateBottom(instances) {
  let bottom = 0;
  for (const inst of instances || []) {
    const band = templateBand(inst);
    bottom = Math.max(bottom, band.top + band.height);
  }
  return bottom;
}

/**
 * Move every album photo fully below the template band so dashed slots never
 * cover existing photos. Updates both free-place pos* and snapped frame* attrs.
 */
function pushAttachmentsBelowTemplateBand(editor, bandTopPx, bandHeightPx) {
  if (!editor) return false;
  const bandTop = Math.max(0, Math.round(bandTopPx) || 0);
  const bandBottom = bandTop + Math.max(0, Math.round(bandHeightPx) || 0);
  if (!bandBottom) return false;

  const { state, view } = editor;
  const pm = view.dom;
  const pmRect = pm.getBoundingClientRect();
  const gap = 16;
  const items = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;

    const frameLeft = parseOptionalPx(node.attrs.frameLeft);
    const frameTop = parseOptionalPx(node.attrs.frameTop);
    const frameWidth = parseOptionalPx(node.attrs.frameWidth);
    const frameHeight = parseOptionalPx(node.attrs.frameHeight);
    const inFrame =
      frameLeft != null && frameTop != null && frameWidth != null && frameHeight != null;

    let left = inFrame ? frameLeft : parseOptionalPx(node.attrs.posLeft);
    let top = inFrame ? frameTop : parseOptionalPx(node.attrs.posTop);
    let height =
      (inFrame ? frameHeight : parseOptionalPx(node.attrs.height)) ||
      parseOptionalPx(node.attrs.height) ||
      null;

    if (left == null || top == null || height == null) {
      const dom = view.nodeDOM(pos);
      const el = dom?.nodeType === 1 ? dom : null;
      if (el) {
        const r = el.getBoundingClientRect();
        // Guard CSS zoom:0 / collapsed layout — ignore tiny rects.
        if (r.width >= 8 && r.height >= 8) {
          if (left == null) left = Math.max(0, Math.round(r.left - pmRect.left));
          if (top == null) top = Math.max(0, Math.round(r.top - pmRect.top));
          if (height == null) height = Math.max(40, Math.round(r.height));
        }
      }
    }

    left = left ?? 0;
    top = top ?? 0;
    height = height ?? 160;

    items.push({
      pos,
      node,
      left,
      top,
      height,
      inFrame,
      frameWidth,
      frameHeight: inFrame ? frameHeight : null
    });
  });

  if (!items.length) return false;

  items.sort((a, b) => a.top - b.top || a.left - b.left);

  let tr = state.tr;
  let changed = false;
  let nextY = bandBottom + gap;

  for (const item of items) {
    // Photos entirely above the template stay put.
    if (item.top + item.height <= bandTop) continue;

    let newTop = item.top;
    // Anything that intersects the band or sits above the running floor is pushed down.
    if (newTop < nextY) {
      newTop = nextY;
    }
    nextY = newTop + item.height + gap;

    if (newTop === item.top && item.inFrame === false) {
      const prevLeft = parseOptionalPx(item.node.attrs.posLeft);
      const prevTop = parseOptionalPx(item.node.attrs.posTop);
      if (prevLeft === item.left && prevTop === item.top) continue;
    }
    if (
      item.inFrame &&
      newTop === item.top &&
      parseOptionalPx(item.node.attrs.frameTop) === item.top &&
      parseOptionalPx(item.node.attrs.posTop) === item.top
    ) {
      continue;
    }

    const attrs = {
      ...item.node.attrs,
      posLeft: item.left,
      posTop: newTop
    };
    if (item.inFrame) {
      attrs.frameLeft = item.left;
      attrs.frameTop = newTop;
      attrs.frameWidth = item.frameWidth;
      attrs.frameHeight = item.frameHeight;
    }
    tr = tr.setNodeMarkup(item.pos, undefined, attrs);
    changed = true;
  }

  if (changed) view.dispatch(tr);
  return changed;
}

/** Ensure the ProseMirror canvas is tall enough for the template band + content. */
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
 * Right edge of templates + placed photos (layout px).
 * Do NOT floor to the current page/client width — that made "reduce" a no-op
 * after enlarge (originWidth stayed at the enlarged canvas size).
 */
function measureAlbumContentWidth(editor, instances, emptyFallback = 480) {
  let maxR = 0;
  for (const inst of instances || []) {
    const band = templateBand(inst, emptyFallback);
    maxR = Math.max(maxR, band.left + band.width);
  }
  if (editor) {
    editor.state.doc.descendants((node) => {
      if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
        const fl = parseOptionalPx(node.attrs.frameLeft);
        const fw = parseOptionalPx(node.attrs.frameWidth);
        const pl = parseOptionalPx(node.attrs.posLeft);
        const pw = parseOptionalPx(node.attrs.width);
        if (fl != null && fw != null) maxR = Math.max(maxR, fl + fw);
        else if (pl != null && pw != null) maxR = Math.max(maxR, pl + pw);
        return;
      }
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

function scaleTemplateInstance(inst, scale) {
  const w0 = inst.w > 0 ? inst.w : 480;
  const h0 = inst.h > 0 ? inst.h : albumTemplateBlockHeight(w0, 'portrait');
  return {
    ...inst,
    x: Math.max(0, Math.round((inst.x || 0) * scale)),
    y: Math.max(0, Math.round((inst.y || 0) * scale)),
    w: Math.max(160, Math.round(w0 * scale)),
    h: Math.max(120, Math.round(h0 * scale))
  };
}

function scaleAttachmentAttrs(attrs, scale) {
  return {
    ...attrs,
    posLeft: scalePxAttr(attrs.posLeft, scale),
    posTop: scalePxAttr(attrs.posTop, scale),
    width: scalePxAttr(attrs.width, scale, 40),
    height: scalePxAttr(attrs.height, scale, 40),
    panX: scalePxAttr(attrs.panX, scale),
    panY: scalePxAttr(attrs.panY, scale),
    frameLeft: scalePxAttr(attrs.frameLeft, scale),
    frameTop: scalePxAttr(attrs.frameTop, scale),
    frameWidth: scalePxAttr(attrs.frameWidth, scale, 40),
    frameHeight: scalePxAttr(attrs.frameHeight, scale, 40)
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
 * Returns the next templates list.
 */
function applyAlbumPageScaleFromOrigin(
  editor,
  originTemplates,
  originPhotosById,
  scale,
  originTextLabelsById = null
) {
  const nextTemplates = (originTemplates || []).map((inst) => scaleTemplateInstance(inst, scale));
  if (editor && (originPhotosById?.size || originTextLabelsById?.size)) {
    const { state } = editor;
    let tr = state.tr;
    let changed = false;
    state.doc.descendants((node, pos) => {
      if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
        const id = Number(node.attrs.attachmentId);
        const origin = originPhotosById?.get(id);
        if (!origin) return;
        const nextAttrs = scaleAttachmentAttrs(origin, scale);
        tr = tr.setNodeMarkup(pos, undefined, nextAttrs);
        changed = true;
        return;
      }
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
  return nextTemplates;
}

const PAGE_RESIZE_BAR_YELLOW = 'var(--theme-yellow-color, #ffe600)';
const PAGE_RESIZE_BAR_RED = '#e53935';

/**
 * Album page actions — fixed label size, content-width buttons on one row.
 * Overflow scrolls horizontally (no font auto-fit — that ResizeObserver loop jiggled the bar).
 */
const albumTemplateBarButtonSx = {
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
 * TipTap editor for Photo Albums pages — binder canvas, template layouts, and
 * free-placed photos that can snap into template slots.
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
    onStageOsFiles = null,
    onRemoveStagedAttachment = null,
    onRemoveAllStagedAttachments = null,
    onAlbumFullscreenChange = null,
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

  const [templates, setTemplates] = useState(() => parseAlbumTemplateInstancesFromHtml(initialContent));
  const [stagedPhotos, setStagedPhotos] = useState(() => parseStagingItemsFromHtml(initialContent));
  const [albumTitleStyle, setAlbumTitleStyle] = useState(() =>
    parseAlbumTitleStyleFromHtml(initialContent)
  );
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  /** Auto Layout / Auto Layout 1 — hourglass + % + stats. */
  const [autoLayoutProgress, setAutoLayoutProgress] = useState(null);
  /** Guide popup: drop photo with no template, or return a page photo to the tray. */
  const [needTemplateGuideOpen, setNeedTemplateGuideOpen] = useState(false);
  const [contextTutorialOpenKey, setContextTutorialOpenKey] = useState(0);
  const templatePickerAnchorRef = useRef(null);
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

  // Slot geometry uses ProseMirror box (same coords as free-placed photos).
  const [pageSize, setPageSize] = useState({ width: 0, height: 0, offsetLeft: 0, offsetTop: 0 });
  /** Persisted page content width — survives React re-renders that would wipe DOM style.width. */
  const [albumCanvasWidthPx, setAlbumCanvasWidthPx] = useState(() => {
    const fromMarker = parseAlbumPageWidthFromHtml(initialContent);
    if (fromMarker > 0) return fromMarker;
    const list = parseAlbumTemplateInstancesFromHtml(initialContent);
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
  /** Page + template aspect: portrait (taller) or landscape (wider). */
  const [pageOrientation, setPageOrientation] = useState(() =>
    parseAlbumOrientationFromHtml(initialContent)
  );
  const pageOrientationRef = useRef(pageOrientation);
  pageOrientationRef.current = pageOrientation;
  /** 0-based index into template instances sorted by page order (each template = one page). */
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
  const [highlightSlotId, setHighlightSlotId] = useState('');
  const [highlightInstanceKey, setHighlightInstanceKey] = useState('');
  const [occupiedByInstance, setOccupiedByInstance] = useState(() => ({}));
  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  /** Active blue-dot photo pan/scale gesture (origin snapshot until mouseup). */
  const slotPhotoGestureRef = useRef(null);
  const stagedPhotosRef = useRef(stagedPhotos);
  stagedPhotosRef.current = stagedPhotos;
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
  /** Photo/video preview session for split Add Text dialog (top-half live preview). */
  const [placeTextMediaSession, setPlaceTextMediaSession] = useState(null);
  const [placeTextSeed, setPlaceTextSeed] = useState('');
  const [placeTextStyle, setPlaceTextStyle] = useState(null);
  /** When ≥2 labels on the photo, Add Text shows a select of existing captions. */
  const [placeTextExistingLabels, setPlaceTextExistingLabels] = useState([]);
  /** Pre-select an existing label in that dropdown (double-click edit). */
  const [placeTextInitialExistingId, setPlaceTextInitialExistingId] = useState(null);
  const placeTextSelectionRef = useRef({ from: 0, to: 0, empty: true });
  /** Avoid TDZ — attachment store may sync before handlePlaceFloatingText is declared. */
  const handlePlaceFloatingTextRef = useRef(null);
  /** When set, Add Text OK updates this label instead of inserting a new one. */
  const placeTextEditingLabelIdRef = useRef(null);
  const placeTextEditingPosRef = useRef(null);
  /** When true, Add Text OK updates album-wide page title style (all pages). */
  const placeTextAlbumTitleModeRef = useRef(false);
  /** Optional page coords when Add Text is opened from a selected photo. */
  const placeTextPagePosRef = useRef(null);
  /** Doc pos of the photo that opened Place Text — keep red border after OK. */
  const placeTextPhotoPosRef = useRef(null);
  /** Place emoji sticker immediately at client coords (from picker click). */
  const placeEmojiAtClientPointRef = useRef(null);
  /** Pixel box of ProseMirror inside pageScaleRef — yellow/red dots use this origin. */
  const [pmLayerBox, setPmLayerBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [photoViewer, setPhotoViewer] = useState(null);


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
        templatesRef.current,
        stagedPhotosRef.current,
        pageOrientationRef.current,
        albumCanvasWidthPxRef.current,
        albumTitleStyleRef.current
      )
    );
  }, []);

  const onAlbumFullscreenChangeRef = useRef(onAlbumFullscreenChange);
  onAlbumFullscreenChangeRef.current = onAlbumFullscreenChange;

  /** View-only while Full screen — no chrome / no edits. */
  const effectiveEditable = editable && !albumFullscreen;

  const syncPhotoAlbumsAttachmentStore = useCallback(
    (ed) => {
      if (!ed) return;
      const store = ed.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      if (!store) return;
      const id = Number(noteId);
      store.noteId = Number.isFinite(id) && id > 0 ? id : null;
      const sharedId = Number(sharedAlbumId);
      store.sharedAlbumId = Number.isFinite(sharedId) && sharedId > 0 ? sharedId : null;
      if (storageType) store.storageType = storageType;
      store.openPlaceText = (pagePos) => handlePlaceFloatingTextRef.current?.(pagePos);
      store.openPlaceEmoji = (em, clientX, clientY) =>
        placeEmojiAtClientPointRef.current?.(em, clientX, clientY);
      store.attachmentCtxVersion = (Number(store.attachmentCtxVersion) || 0) + 1;
      try {
        ed.view.dispatch(ed.state.tr.setMeta('paAttachmentCtx', store.attachmentCtxVersion));
      } catch {
        // editor may be unmounting
      }
    },
    [noteId, sharedAlbumId, storageType]
  );

  const editor = useEditor({
    extensions: buildPhotoAlbumsEditorExtensions(),
    content: stripAlbumMarkers(initialContent) || EMPTY_DOC,
    editable: effectiveEditable,
    immediatelyRender: false,
    editorProps: {
      // Album zoom-pane owns scrolling — do not jump after insert/focus/drop.
      handleScrollToSelection: () => true,
      // Photos enter edit mode only via double-click (node view). Block TipTap’s
      // default single-click NodeSelection on album photo atoms.
      handleClickOn: (_view, _pos, node) => {
        if (node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return true;
        return false;
      },
      // Kill native browser drag of page photos (huge translucent ghost) —
      // relocate/pan is custom and only when the photo is in edit mode.
      handleDOMEvents: {
        dragstart: (_view, event) => {
          const t = event?.target;
          if (!(t instanceof Element)) return false;
          if (
            t.closest(
              '.rv-attachment-photo, .rv-photo-tile, .rv-photo-window, .rv-text-label'
            )
          ) {
            event.preventDefault();
            return true;
          }
          return false;
        }
      },
      // Vault / Finder / staging / template drags are handled by the page shell.
      // Block TipTap from inserting drag text (e.g. "Set 1-Album 1.html", "pa-staged:N").
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const dt = event?.dataTransfer;
        if (!dt) return false;
        if (isStagedAttachmentDrag(dt) || isAlbumTemplateDrag(dt) || isFilesExplorerDrag(dt)) {
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
          types.includes(DRAG_STAGED_ATTACHMENT) ||
          types.includes(DRAG_STAGED_FLAG) ||
          types.includes(DRAG_ALBUM_TEMPLATE) ||
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
    },
    onCreate: ({ editor: ed }) => {
      syncPhotoAlbumsAttachmentStore(ed);
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
        const fromTemplates = Math.round(Number(templatesRef.current?.[0]?.w) || 0);
        const pages = sortAlbumPagesByBand(templatesRef.current || []);
        const activePage = pages[albumPageIndexRef.current] || pages[0] || null;
        const pw =
          (albumCanvasWidthPxRef.current >= 200 ? albumCanvasWidthPxRef.current : 0) ||
          (fromTemplates >= 200 ? fromTemplates : 0) ||
          (activePage?.w >= 200 ? Math.round(activePage.w) : 0) ||
          albumPageWidthFromViewport(scrollEl, 100) ||
          480;
        const binderW = syncAlbumBinderFromViewport(scrollEl, 100, { slideshow: slideshowBinder });
        applyAlbumCanvasWidth(pw, binderW);
        const orient = pageOrientationRef.current;
        const blockH =
          activePage?.h > 40
            ? Math.round(activePage.h)
            : albumTemplateBlockHeight(pw, orient);
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
      const current = templatesRef.current || [];
      const blockH = albumTemplateBlockHeight(pw, orient);
      // Shell height includes the album title footer band — omit it and top/bottom
      // primary margin disappears (page paints taller than the fit assumed).
      const titleBand = String(albumTitle || '').trim()
        ? albumPageTitleBandHeightPx(albumTitleStyleRef.current)
        : 0;
      const viewH = Math.max(blockH, 200) + titleBand;
      if (current.length) {
        const next = restackTemplatesFlushToPages(
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
        templatesRef.current = next;
        if (!geometryUnchanged) {
          setTemplates(next);
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
   * Portrait (10×12) / Landscape (12×10) — every template page in this album
   * switches aspect together (restacked flush). Slot % layouts stay the same; block w×h changes.
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
      const nextBlockH = albumTemplateBlockHeight(pw, mode);
      const current = templatesRef.current || [];

      if (!current.length) {
        ensureAlbumCanvasMinHeight(editor, nextBlockH, { allowShrink: true });
        requestAnimationFrame(() => {
          emitHtml(editor.getHTML());
          fitAlbumPageFlushToViewportRef.current?.();
        });
        return;
      }

      const next = restackTemplatesFlushToPages(
        sortAlbumPagesByBand(current),
        pw,
        mode,
        editor,
        albumBinderWidthPxRef.current
      );
      templatesRef.current = next;
      setTemplates(next);
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
  }, [albumCanvasWidthPx, albumBinderWidthPx, editor, templates, pageResizeDragging]);

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
    const current = templatesRef.current || [];
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
    if (!albumTemplatesNeedSpreadRestack(current, pw, bw, orient)) return;
    const next = restackTemplatesFlushToPages(
      sortAlbumPagesByBand(current),
      pw,
      orient,
      editor,
      bw
    );
    templatesRef.current = next;
    setTemplates(next);
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
   * Drag resizes the page; templates + photos scale together.
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
      const originTemplates = (templatesRef.current || []).map((inst) => ({ ...inst }));
      const originPhotosById = new Map();
      const originTextLabelsById = new Map();
      editor.state.doc.descendants((node) => {
        if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
          const id = Number(node.attrs.attachmentId);
          if (!Number.isFinite(id) || id < 1) return;
          originPhotosById.set(id, { ...node.attrs });
          return;
        }
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
        originTemplates
      );
      const originHeight = Math.max(
        scaleEl.offsetHeight || 0,
        pageEl.offsetHeight || 0,
        lowestTemplateBottom(originTemplates) + 240
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
          originTemplates,
          originPhotosById,
          latestScale,
          originTextLabelsById
        );
        templatesRef.current = next;
        setTemplates(next);
        const bottom = lowestTemplateBottom(next);
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
    syncPhotoAlbumsAttachmentStore(editor);
  }, [editor, syncPhotoAlbumsAttachmentStore]);

  useEffect(() => {
    if (!editor) return undefined;
    const onOpenPlaceTextFromPhoto = (event) => {
      const pagePos = event?.detail?.pagePos ?? null;
      handlePlaceFloatingTextRef.current?.(pagePos);
    };
    window.addEventListener(PHOTO_ALBUMS_OPEN_PLACE_TEXT_EVENT, onOpenPlaceTextFromPhoto);
    return () => {
      window.removeEventListener(PHOTO_ALBUMS_OPEN_PLACE_TEXT_EVENT, onOpenPlaceTextFromPhoto);
    };
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
  }, [editor, templates, albumZoom]);

  // Snap helper — only the visible spread pages can receive tray / relocate snaps.
  // Geometry MUST match the overlay (spread columns), not stale/bloated saved x/w.
  useEffect(() => {
    if (!editor) return undefined;
    const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (!store) return undefined;
    const activePageInstances = () => {
      const pw =
        albumCanvasWidthPxRef.current >= 200 ? albumCanvasWidthPxRef.current : 480;
      const bw = albumBinderWidthPxRef.current || 0;
      const orient = pageOrientationRef.current || 'portrait';
      const corrected = withSpreadPageGeometry(
        templatesRef.current || [],
        pw,
        bw,
        orient
      );
      return activeSpreadPageInstances(corrected, albumPageIndexRef.current || 0);
    };
    store.findPhotoSnap = ({ left, top, width, height }) => {
      const snap = findAlbumPhotoSnapAmongInstances({
        instances: activePageInstances(),
        left,
        top,
        photoWidth: width,
        photoHeight: height
      });
      setHighlightInstanceKey(snap?.instanceKey || '');
      setHighlightSlotId(snap?.slotId || '');
      return snap;
    };
    store.hasAlbumTemplate = (templatesRef.current || []).some((t) =>
      Boolean(getPhotoAlbumsPageTemplate(t.id))
    );
    store.canDropStagedPhoto = () =>
      activePageInstances().some((t) => Boolean(getPhotoAlbumsPageTemplate(t.id)));
    store.returnAttachmentToStaging = (attrs) => {
      const attachmentId = Number(attrs?.attachmentId);
      if (!Number.isFinite(attachmentId) || attachmentId < 1 || !editor) return false;
      let photoRect = attrs?._photoRect || null;
      if (!photoRect) {
        editor.state.doc.descendants((node) => {
          if (photoRect) return false;
          if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
          if (Number(node.attrs.attachmentId) !== attachmentId) return;
          photoRect = photoPageRectFromAttrs(node.attrs);
          return false;
        });
      }
      // Text/emoji on the photo travel with it into the thumbnail alley.
      const companionLabels = photoRect ? detachTextAndEmojiNearPhoto(editor, photoRect) : [];
      let removed = false;
      let tr = editor.state.tr;
      editor.state.doc.descendants((node, pos) => {
        if (removed) return false;
        if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
        if (Number(node.attrs.attachmentId) !== attachmentId) return;
        tr = tr.delete(pos, pos + node.nodeSize);
        removed = true;
        return false;
      });
      if (removed) editor.view.dispatch(tr);
      const nextItem = {
        attachmentId,
        fileName: String(attrs?.fileName || ''),
        fileExtension: String(attrs?.fileExtension || ''),
        fileSizeBytes: attrs?.fileSizeBytes ?? null,
        checksum: attrs?.checksum ? String(attrs.checksum) : null,
        ...(companionLabels.length ? { companionLabels } : null)
      };
      const prev = stagedPhotosRef.current || [];
      const next = dedupeStagingItems([...prev, nextItem]);
      stagedPhotosRef.current = next;
      setStagedPhotos(next);
      requestAnimationFrame(() => emitHtml(editor.getHTML()));
      return true;
    };
    /** Add to thumbnail tray without removing a doc node (fallback when node delete is handled elsewhere). */
    store.pushStagingPhoto = (attrs) => {
      const attachmentId = Number(attrs?.attachmentId);
      if (!Number.isFinite(attachmentId) || attachmentId < 1) return false;
      const nextItem = {
        attachmentId,
        fileName: String(attrs?.fileName || ''),
        fileExtension: String(attrs?.fileExtension || ''),
        fileSizeBytes: attrs?.fileSizeBytes ?? null,
        checksum: attrs?.checksum ? String(attrs.checksum) : null,
        ...(Array.isArray(attrs?.companionLabels) && attrs.companionLabels.length
          ? { companionLabels: attrs.companionLabels }
          : null)
      };
      const prev = stagedPhotosRef.current || [];
      const next = dedupeStagingItems([...prev, nextItem]);
      stagedPhotosRef.current = next;
      setStagedPhotos(next);
      if (editor) requestAnimationFrame(() => emitHtml(editor.getHTML()));
      return true;
    };
    store.clearPhotoSnapHighlight = () => {
      setHighlightInstanceKey('');
      setHighlightSlotId('');
    };
    return () => {
      store.findPhotoSnap = null;
      store.hasAlbumTemplate = false;
      store.canDropStagedPhoto = null;
      store.returnAttachmentToStaging = null;
      store.clearPhotoSnapHighlight = null;
    };
  }, [editor, templates, pageSize.width, albumCanvasWidthPx, albumBinderWidthPx, pageOrientation]);

  // Empty slots stay grab-able; occupied ones click through so snapped photos stay interactive.
  // Use spread-column geometry so left-page photos never mark right-page slots occupied.
  useEffect(() => {
    if (!editor) {
      setOccupiedByInstance({});
      return undefined;
    }
    const refresh = () => {
      const pw =
        albumCanvasWidthPxRef.current >= 200 ? albumCanvasWidthPxRef.current : 480;
      const bw = albumBinderWidthPxRef.current || 0;
      const orient = pageOrientationRef.current || 'portrait';
      const corrected = withSpreadPageGeometry(
        templatesRef.current || [],
        pw,
        bw,
        orient
      );
      const next = {};
      for (const inst of corrected) {
        const layout = getPhotoAlbumsPageTemplate(inst.id);
        if (!layout) continue;
        const band = templateBand(inst, pw, orient);
        const occupied = new Set();
        editor.state.doc.descendants((node) => {
          if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
          const fl = parseOptionalPx(node.attrs.frameLeft);
          const ft = parseOptionalPx(node.attrs.frameTop);
          const fw = parseOptionalPx(node.attrs.frameWidth);
          const fh = parseOptionalPx(node.attrs.frameHeight);
          if (fl == null || ft == null || fw == null || fh == null) return;
          const cx = fl + fw / 2;
          const cy = ft + fh / 2;
          for (const slot of resolveAlbumTemplateSlots(layout, inst.slots)) {
            if (slot.type !== 'photo') continue;
            const rect = albumSlotToPx(slot, band.width, band.height);
            const left = band.left + rect.left;
            const top = band.top + rect.top;
            if (cx >= left && cx <= left + rect.width && cy >= top && cy <= top + rect.height) {
              occupied.add(slot.id);
              break;
            }
          }
        });
        next[inst.key] = occupied;
      }
      setOccupiedByInstance(next);
    };
    refresh();
    editor.on('update', refresh);
    return () => editor.off('update', refresh);
  }, [editor, templates, pageSize.width, albumCanvasWidthPx, albumBinderWidthPx, pageOrientation]);

  // One framed photo per slot — evict stacked duplicates (shows as red drop bands).
  useEffect(() => {
    if (!editor) return undefined;
    let timer = null;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        evictDuplicateFramedPhotosInSlots(editor);
      }, 0);
    };
    run();
    editor.on('update', run);
    return () => {
      editor.off('update', run);
      if (timer) clearTimeout(timer);
    };
  }, [editor]);

  const persistTemplates = useCallback(
    (nextList) => {
      const list = Array.isArray(nextList) ? nextList : [];
      templatesRef.current = list;
      setTemplates(list);
      if (editor) requestAnimationFrame(() => emitHtml(editor.getHTML()));
    },
    [editor, emitHtml]
  );

  const handleTemplateMoveResize = useCallback(
    (instanceKey, geom, { live } = {}) => {
      const prev = (templatesRef.current || []).find((inst) => inst.key === instanceKey);
      if (!prev) return;
      const oldBand = templateBand(prev, pageSize.width || 480);
      // Overlay layer is aligned to ProseMirror — geom x/y are PM-local (band origin).
      const x = Math.max(0, Math.round(geom?.x ?? 0));
      const y = Math.max(0, Math.round(geom?.y ?? 0));
      const w = Math.max(160, Math.round(geom?.w || 0));
      const h = Math.max(120, Math.round(geom?.h || 0));
      const nextInst = { ...prev, x, y, w, h };
      const newBand = templateBand(nextInst, pageSize.width || 480);
      const next = (templatesRef.current || []).map((inst) =>
        inst.key === instanceKey ? nextInst : inst
      );
      templatesRef.current = next;
      setTemplates(next);
      if (editor) {
        remapFramedPhotosForTemplateResize(editor, prev.id, oldBand, newBand, prev.slots);
        if (!live) {
          ensureAlbumCanvasMinHeight(editor, newBand.top + newBand.height, { allowShrink: true });
          requestAnimationFrame(() => emitHtml(editor.getHTML()));
        }
      }
    },
    [editor, emitHtml, pageSize.width]
  );

  /** Per-slot move/resize (% overrides) — empty/text slots only; occupied photos use photo pan/scale. */
  const handleSlotGeometryChange = useCallback(
    (instanceKey, slotId, nextPct, { live } = {}) => {
      const prev = (templatesRef.current || []).find((inst) => inst.key === instanceKey);
      if (!prev || !slotId) return;
      const layout = getPhotoAlbumsPageTemplate(prev.id);
      if (!layout) return;
      const band = templateBand(prev, pageSize.width || 480);
      const resolved = resolveAlbumTemplateSlots(layout, prev.slots);
      const before = resolved.find((s) => s.id === slotId);
      if (!before) return;
      const oldRect = albumSlotToPx(before, band.width, band.height);
      const oldFrame = {
        left: band.left + oldRect.left,
        top: band.top + oldRect.top,
        width: oldRect.width,
        height: oldRect.height
      };
      const nextInst = {
        ...prev,
        slots: {
          ...(prev.slots || {}),
          [slotId]: {
            x: nextPct.x,
            y: nextPct.y,
            w: nextPct.w,
            h: nextPct.h
          }
        }
      };
      const next = (templatesRef.current || []).map((inst) =>
        inst.key === instanceKey ? nextInst : inst
      );
      templatesRef.current = next;
      setTemplates(next);

      const afterSlot = {
        ...before,
        x: nextPct.x,
        y: nextPct.y,
        w: nextPct.w,
        h: nextPct.h
      };
      const newRect = albumSlotToPx(afterSlot, band.width, band.height);
      const newFrame = {
        left: band.left + newRect.left,
        top: band.top + newRect.top,
        width: newRect.width,
        height: newRect.height
      };
      if (editor) {
        remapPhotoForSlotFrameChange(editor, oldFrame, newFrame);
        if (!live) requestAnimationFrame(() => emitHtml(editor.getHTML()));
      }
    },
    [editor, emitHtml, pageSize.width]
  );

  /** Scroll-wheel zoom of the photo inside a template slot (selected photo only). */
  const handleSlotPhotoZoom = useCallback(
    (instanceKey, slotId, deltaY) => {
      if (!editor || !slotId) return;
      const prev = (templatesRef.current || []).find((inst) => inst.key === instanceKey);
      if (!prev) return;
      const layout = getPhotoAlbumsPageTemplate(prev.id);
      if (!layout) return;
      const band = templateBand(prev, pageSize.width || 480);
      const slot = resolveAlbumTemplateSlots(layout, prev.slots).find((s) => s.id === slotId);
      if (!slot) return;
      const rect = albumSlotToPx(slot, band.width, band.height);
      const frame = {
        left: band.left + rect.left,
        top: band.top + rect.top,
        width: rect.width,
        height: rect.height
      };
      const hit = findFramedPhotoInFrame(editor.state, frame);
      if (!hit) return;
      const { selection } = editor.state;
      if (!(selection instanceof NodeSelection) || selection.from !== hit.pos) return;
      const factor = deltaY < 0 ? 1.08 : 1 / 1.08;
      if (zoomPhotoInsideFrame(editor, frame, factor)) {
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
      }
    },
    [editor, emitHtml, pageSize.width]
  );

  /** Resolve absolute page frame for a slot on a template instance. */
  const resolveSlotFrame = useCallback(
    (instanceKey, slotId) => {
      const prev = (templatesRef.current || []).find((inst) => inst.key === instanceKey);
      if (!prev || !slotId) return null;
      const layout = getPhotoAlbumsPageTemplate(prev.id);
      if (!layout) return null;
      const band = templateBand(prev, pageSize.width || 480);
      const slot = resolveAlbumTemplateSlots(layout, prev.slots).find((s) => s.id === slotId);
      if (!slot) return null;
      const rect = albumSlotToPx(slot, band.width, band.height);
      return {
        left: band.left + rect.left,
        top: band.top + rect.top,
        width: rect.width,
        height: rect.height
      };
    },
    [pageSize.width]
  );

  /** True when the TipTap-selected photo node occupies this slot. */
  const isSlotPhotoSelectedForInstance = useCallback(
    (instanceKey, slotId) => {
      if (!editor || !slotId) return false;
      const { selection } = editor.state;
      if (!(selection instanceof NodeSelection)) return false;
      const node = selection.node;
      if (node?.type?.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return false;
      const frame = resolveSlotFrame(instanceKey, slotId);
      if (!frame) return false;
      const fLeft = frame.left;
      const fTop = frame.top;
      const fW = Math.max(1, frame.width);
      const fH = Math.max(1, frame.height);
      const centerInSlot = (cx, cy) =>
        cx >= fLeft && cx <= fLeft + fW && cy >= fTop && cy <= fTop + fH;

      // Prefer the selected node's own frame / place — works for every image
      // format (png/svg/webp/…) even when another framed node overlaps the slot.
      const fl = parseOptionalPx(node.attrs.frameLeft);
      const ft = parseOptionalPx(node.attrs.frameTop);
      const fw = parseOptionalPx(node.attrs.frameWidth);
      const fh = parseOptionalPx(node.attrs.frameHeight);
      if (fl != null && ft != null && fw != null && fh != null) {
        if (centerInSlot(fl + fw / 2, ft + fh / 2)) return true;
      }
      const pl = parseOptionalPx(node.attrs.posLeft);
      const pt = parseOptionalPx(node.attrs.posTop);
      if (pl != null && pt != null) {
        const pw = parseOptionalPx(node.attrs.width) || 120;
        const ph = parseOptionalPx(node.attrs.height) || 90;
        if (centerInSlot(pl + pw / 2, pt + ph / 2)) return true;
      }
      const hit = findFramedPhotoInFrame(editor.state, frame);
      return Boolean(hit && hit.pos === selection.from);
    },
    [editor, resolveSlotFrame]
  );

  /**
   * Blue slot 9-dots → pan/scale the photo inside a fixed slot window (not the slot).
   * `dx`/`dy` are page-coord deltas from gesture start; origin is captured once per drag.
   */
  const handleSlotPhotoPan = useCallback(
    (instanceKey, slotId, dx, dy, { live } = {}) => {
      if (!editor || !slotId) return;
      const frame = resolveSlotFrame(instanceKey, slotId);
      if (!frame) return;
      const gesture = slotPhotoGestureRef.current;
      if (!gesture || gesture.kind !== 'pan' || gesture.slotId !== slotId || gesture.instanceKey !== instanceKey) {
        const origin = readPhotoTransformInFrame(editor, frame);
        if (!origin) return;
        slotPhotoGestureRef.current = { kind: 'pan', instanceKey, slotId, origin };
      }
      const { origin } = slotPhotoGestureRef.current;
      setPhotoTransformInsideFrame(editor, frame, {
        width: origin.width,
        height: origin.height,
        panX: origin.panX + dx,
        panY: origin.panY + dy
      });
      if (!live) {
        slotPhotoGestureRef.current = null;
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
      }
    },
    [editor, emitHtml, resolveSlotFrame]
  );

  const handleSlotPhotoScale = useCallback(
    (instanceKey, slotId, factor, { live } = {}) => {
      if (!editor || !slotId || !(factor > 0)) return;
      const frame = resolveSlotFrame(instanceKey, slotId);
      if (!frame) return;
      const gesture = slotPhotoGestureRef.current;
      if (
        !gesture ||
        gesture.kind !== 'scale' ||
        gesture.slotId !== slotId ||
        gesture.instanceKey !== instanceKey
      ) {
        const origin = readPhotoTransformInFrame(editor, frame);
        if (!origin) return;
        slotPhotoGestureRef.current = { kind: 'scale', instanceKey, slotId, origin };
      }
      const { origin } = slotPhotoGestureRef.current;
      scalePhotoInsideFrameFromOrigin(editor, frame, origin, factor);
      if (!live) {
        slotPhotoGestureRef.current = null;
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
      }
    },
    [editor, emitHtml, resolveSlotFrame]
  );

  const handleDeleteTemplate = useCallback(
    (instanceKey) => {
      const target = (templatesRef.current || []).find((t) => t.key === instanceKey);
      if (editor && target) {
        const pw = Math.max(
          200,
          Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
        );
        const band = templateBand(target, pw, pageOrientationRef.current);
        returnPhotosInBandToStagingTray(editor, band);
      }
      setHighlightSlotId('');
      setHighlightInstanceKey('');
      const next = (templatesRef.current || []).filter((t) => t.key !== instanceKey);
      persistTemplates(next);
    },
    [editor, persistTemplates, pageSize.width]
  );

  /**
   * Open Add Text styling popup. Uses selected text as the seed when present.
   * Optional `pagePos` places the new label near a selected photo.
   * Never treat a selected photo/attachment node as “text to replace”.
   */
  const handlePlaceFloatingText = useCallback((pagePos = null) => {
    if (!editor || !effectiveEditable) return;
    const { state } = editor;
    const { from, to, empty } = state.selection;
    const isNodeSelection = state.selection instanceof NodeSelection;
    // Photo / attachment / atom selection must not be deleted on OK — only plain text.
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
    // Remember which photo is in edit mode so OK can restore the red border.
    if (
      isNodeSelection &&
      state.selection.node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME
    ) {
      placeTextPhotoPosRef.current = from;
    } else {
      const pinned = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.pinnedPhotoEditPos;
      placeTextPhotoPosRef.current = Number.isFinite(pinned) ? pinned : null;
    }
    const left = Number(pagePos?.posLeft);
    const top = Number(pagePos?.posTop);
    placeTextPagePosRef.current =
      Number.isFinite(left) && Number.isFinite(top)
        ? { posLeft: Math.max(0, Math.round(left)), posTop: Math.max(0, Math.round(top)) }
        : null;
    const photoPos = placeTextPhotoPosRef.current;
    const nearLabels = collectPlaceTextLabelsNearPhoto(editor, photoPos);
    const nearOverlays = Number.isFinite(photoPos)
      ? listTextAndEmojiForPhotoPos(editor.state, photoPos)
      : [];
    const overlayCount = nearOverlays.length;
    const seedText = resolvePlaceTextCaption({
      explicitText: text,
      existingOverlayCount: overlayCount,
      editing: false
    });
    setPlaceTextExistingLabels(nearLabels.length >= 2 ? nearLabels : []);
    setPlaceTextInitialExistingId(null);
    setPlaceTextStyle(null);
    setPlaceTextSeed(text);
    setPlaceTextMediaSession(
      Number.isFinite(photoPos)
        ? buildPlaceTextPositionSession(
            editor,
            photoPos,
            { ...PLACE_TEXT_DEFAULTS, text: seedText },
            { existingOverlayCount: overlayCount }
          )
        : null
    );
    const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (store) {
      store.placeTextDialogOpen = Number.isFinite(photoPos);
      if (Number.isFinite(photoPos)) {
        store.contextTutorialTick = (Number(store.contextTutorialTick) || 0) + 1;
        try {
          editor.view.dispatch(
            editor.state.tr.setMeta('paContextTutorial', store.contextTutorialTick)
          );
        } catch {
          // ignore
        }
      }
    }
    setPlaceTextOpen(true);
  }, [editor, effectiveEditable]);
  handlePlaceFloatingTextRef.current = handlePlaceFloatingText;

  const handlePlaceTextPhotoChromeChange = useCallback(
    (patch) => {
      if (!editor || !patch || typeof patch !== 'object') return;
      const pos = placeTextPhotoPosRef.current;
      if (!Number.isFinite(pos)) return;
      const { panZoom, ...attrs } = patch;
      if (Object.keys(attrs).length) {
        editor
          .chain()
          .command(({ tr, dispatch }) => {
            const node = tr.doc.nodeAt(pos);
            if (!node || node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return false;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
            if (dispatch) dispatch(tr);
            return true;
          })
          .run();
        setPlaceTextMediaSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...attrs };
          if ('width' in attrs) next.photoW = attrs.width;
          if ('height' in attrs) next.photoH = attrs.height;
          if ('panX' in attrs) next.panX = attrs.panX;
          if ('panY' in attrs) next.panY = attrs.panY;
          return next;
        });
      }
      if (typeof panZoom === 'boolean') {
        const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
        if (store) {
          store.dialogPanZoom = panZoom;
          store.pinnedPhotoEditPos = pos;
          store.contextTutorialTick = (store.contextTutorialTick || 0) + 1;
        }
      }
    },
    [editor]
  );

  const placeEmojiAtClientPoint = useCallback(
    (emoji, clientX, clientY) => {
      if (!editor || !editable) return;
      const em = String(emoji || '').trim();
      if (!em) return;
      const zoomScale = Math.max(0.01, (Number(albumZoom) || 100) / 100);
      const size = PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX;
      withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
        try {
          const pm = editor.view.dom;
          const rect = pm.getBoundingClientRect();
          const posLeft = Math.max(
            0,
            Math.round((clientX - rect.left) / zoomScale + (pm.scrollLeft || 0) - size / 2)
          );
          const posTop = Math.max(
            0,
            Math.round((clientY - rect.top) / zoomScale + (pm.scrollTop || 0) - size / 2)
          );
          const attrs = {
            labelId: newLabelId(),
            text: em,
            color: '#000000',
            outlineColor: '#000000',
            outlineWidth: 0,
            fontSize: size,
            fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
            fontWeight: 400,
            rotationDeg: 0,
            posLeft,
            posTop,
            boxWidth: size + 12,
            boxHeight: size + 12
          };
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
          requestAnimationFrame(() => emitHtml(editor.getHTML()));
        } catch {
          // ignore placement errors
        }
      });
    },
    [editor, editable, albumZoom, emitHtml]
  );
  placeEmojiAtClientPointRef.current = placeEmojiAtClientPoint;

  /** Double-click an existing label — reopen Add Text with its full style. */
  const handleEditExistingTextLabel = useCallback(
    (payload) => {
      if (!editor || !editable || !payload) return;
      placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
      placeTextEditingLabelIdRef.current = payload.labelId || null;
      placeTextEditingPosRef.current = Number.isFinite(payload.pos) ? payload.pos : null;
      placeTextAlbumTitleModeRef.current = false;
      placeTextPagePosRef.current = null;
      const { selection } = editor.state;
      if (
        selection instanceof NodeSelection &&
        selection.node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME
      ) {
        placeTextPhotoPosRef.current = selection.from;
      } else {
        const pinned = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.pinnedPhotoEditPos;
        placeTextPhotoPosRef.current = Number.isFinite(pinned) ? pinned : null;
      }
      const nearLabels = collectPlaceTextLabelsNearPhoto(editor, placeTextPhotoPosRef.current);
      const photoPos = placeTextPhotoPosRef.current;
      const nearOverlays = Number.isFinite(photoPos)
        ? listTextAndEmojiForPhotoPos(editor.state, photoPos)
        : [];
      const overlayCount = nearOverlays.length;
      setPlaceTextExistingLabels(nearLabels.length >= 2 ? nearLabels : []);
      setPlaceTextInitialExistingId(payload.labelId || null);
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
      setPlaceTextMediaSession(
        Number.isFinite(photoPos)
          ? buildPlaceTextPositionSession(editor, photoPos, editStyle, {
              editLabelId: payload.labelId || null,
              editPos: Number.isFinite(payload.pos) ? payload.pos : null,
              existingOverlayCount: overlayCount
            })
          : null
      );
      const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      if (store && Number.isFinite(photoPos)) {
        store.placeTextDialogOpen = true;
        store.contextTutorialTick = (Number(store.contextTutorialTick) || 0) + 1;
        try {
          editor.view.dispatch(
            editor.state.tr.setMeta('paContextTutorial', store.contextTutorialTick)
          );
        } catch {
          // ignore
        }
      }
      setPlaceTextOpen(true);
    },
    [editor, editable]
  );

  /** Double-click album page title — style applies to every page. */
  const handleEditAlbumPageTitle = useCallback(() => {
    if (!editable) return;
    placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
    placeTextEditingLabelIdRef.current = null;
    placeTextEditingPosRef.current = null;
    placeTextAlbumTitleModeRef.current = true;
    placeTextPagePosRef.current = null;
    setPlaceTextExistingLabels([]);
    setPlaceTextInitialExistingId(null);
    setPlaceTextSeed(String(albumTitle || '').trim());
    setPlaceTextStyle({ ...albumTitleStyleRef.current });
    setPlaceTextMediaSession(null);
    setPlaceTextOpen(true);
  }, [editable, albumTitle]);

  /** Close Add Text → normal album (no yellow/red photo edit chrome). */
  const exitPlaceTextToNormalAlbum = useCallback(() => {
    if (!editor) return;
    const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (store) {
      store.dialogPanZoom = false;
      store.selectedPhotoPanZoom = false;
      store.placeTextDialogOpen = false;
      store.contextTutorialTick = (Number(store.contextTutorialTick) || 0) + 1;
    }
    clearPinnedPhotoEditPos(editor);
    requestAnimationFrame(() => {
      try {
        const { state, dispatch } = editor.view;
        if (state.selection instanceof NodeSelection) {
          dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)));
        } else {
          // Force node views to re-read pin/pan state after clear.
          dispatch(state.tr.setMeta('paContextTutorial', store?.contextTutorialTick || 0));
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
      setPlaceTextExistingLabels([]);
      setPlaceTextInitialExistingId(null);

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
        placeTextPhotoPosRef.current = null;
        exitPlaceTextToNormalAlbum();
        return;
      }

      // Dropdown may retarget which existing label to update (or clear for new text).
      const editingLabelId =
        style && Object.prototype.hasOwnProperty.call(style, 'editLabelId')
          ? style.editLabelId || null
          : placeTextEditingLabelIdRef.current;
      const editingPos =
        style && Object.prototype.hasOwnProperty.call(style, 'editPos')
          ? Number.isFinite(style.editPos)
            ? style.editPos
            : null
          : placeTextEditingPosRef.current;
      placeTextEditingLabelIdRef.current = null;
      placeTextEditingPosRef.current = null;

      placeTextPhotoPosRef.current = null;
      placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
      setPlaceTextStyle(null);
      setPlaceTextSeed('');
      setPlaceTextMediaSession(null);

      if (style?.placeTextSession) {
        commitPlaceTextPositionSession(editor, style.placeTextSession);
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
        exitPlaceTextToNormalAlbum();
        return;
      }

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
      const anchored = placeTextPagePosRef.current;
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

  /** Clear page text/photos/templates → staging tray; zoom 95%; flush + stretch to edge. */
  const handleResetPage = useCallback(() => {
    if (!editor) return;

    setPageOrientation('portrait');
    pageOrientationRef.current = 'portrait';
    setAlbumPageIndex(0);

    returnAllPagePhotosToStagingTray(editor);

    // Clear remaining text / empty the page body.
    editor.commands.setContent(EMPTY_DOC, { emitUpdate: false });

    setHighlightSlotId('');
    setHighlightInstanceKey('');
    setOccupiedByInstance({});
    setTemplatePickerOpen(false);
    templatesRef.current = [];
    setTemplates([]);
    persistTemplates([]);
    albumAutoZoomRef.current = true;
    fitAlbumPageFlushToViewport();
    requestAnimationFrame(() => emitHtml(editor.getHTML()));
  }, [editor, persistTemplates, emitHtml, fitAlbumPageFlushToViewport]);

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

  /**
   * Exit photo edit / Pan&Zoom (clear NodeSelection):
   * — single-click white page / non-photo album chrome
   * — single-click a *different* photo (not the one currently in edit mode)
   * Clicking the current photo keeps edit mode (drag / pan / zoom).
   */
  useEffect(() => {
    if (!editor || !effectiveEditable) return undefined;
    const onPointerDown = (event) => {
      if (event.button != null && event.button !== 0) return;
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (
        t.closest(
          [
            '.rv-photo-tile__actions',
            '.rv-attachment-photo__return-x',
            '.rv-photo-tile__zoom-bar',
            '.rv-text-label',
            '.MuiDialog-root',
            '.MuiMenu-root',
            '.MuiPopover-root',
            'button',
            'a',
            'input',
            'textarea',
            'select'
          ].join(',')
        )
      ) {
        return;
      }
      const { state, view } = editor;
      const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      const pinnedPos = store?.pinnedPhotoEditPos;
      const hasPinned = pinnedPos != null;
      const hasTipTapPhoto =
        state.selection instanceof NodeSelection &&
        state.selection.node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME;
      if (!hasPinned && !hasTipTapPhoto) return;

      const photoEl = t.closest('.rv-attachment-photo, .rv-photo-tile, .rv-photo-window');
      if (photoEl) {
        let selectedDom = null;
        const focusPos = hasTipTapPhoto ? state.selection.from : pinnedPos;
        try {
          if (Number.isFinite(focusPos)) selectedDom = view.nodeDOM(focusPos);
        } catch {
          selectedDom = null;
        }
        const onSelected =
          selectedDom instanceof Element &&
          (selectedDom === photoEl ||
            selectedDom.contains(photoEl) ||
            photoEl.contains(selectedDom) ||
            selectedDom.contains(t));
        // Current photo: keep edit mode for relocate / pan / place text.
        if (onSelected) return;
        // Another photo: exit edit / Pan&Zoom back to View mode.
        clearPinnedPhotoEditPos(editor);
        view.dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)));
        return;
      }

      if (!t.closest('.rv-editor__album-zoom-scroll, .rv-editor__body--album')) return;
      clearPinnedPhotoEditPos(editor);
      view.dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)));
    };
    window.addEventListener('mousedown', onPointerDown, true);
    return () => window.removeEventListener('mousedown', onPointerDown, true);
  }, [editor, effectiveEditable]);

  const handleSelectTemplate = useCallback(
    (nextId) => {
      setTemplatePickerOpen(false);
      if (!nextId || !editor) return;

      // New template = new page to the RIGHT of the current page (higher page #).
      const pw = albumPageWidthFromViewport(zoomScrollRef.current);
      applyAlbumCanvasWidth(pw);
      syncAlbumBinderFromViewport(zoomScrollRef.current);
      const orient = pageOrientationRef.current;
      const nextBlockH = albumTemplateBlockHeight(pw, orient);
      const current = templatesRef.current || [];
      const ordered = sortAlbumPagesByBand(current);

      const insertAt = ordered.length === 0 ? 0 : Math.min(ordered.length, albumPageIndex + 1);
      const added = createAlbumTemplateInstance({
        id: nextId,
        x: 0,
        y: albumPageTopForIndex(insertAt, nextBlockH),
        w: pw,
        h: nextBlockH
      });
      const nextOrdered = [...ordered.slice(0, insertAt), added, ...ordered.slice(insertAt)];
      const nextList = restackTemplatesFlushToPages(
        nextOrdered,
        pw,
        orient,
        editor,
        albumBinderWidthPxRef.current
      );

      templatesRef.current = nextList;
      setTemplates(nextList);
      setAlbumPageIndex(albumSpreadLeftPageIndex(insertAt));
      const titleBand = String(albumTitle || '').trim()
        ? albumPageTitleBandHeightPx(albumTitleStyleRef.current)
        : 0;
      ensureAlbumCanvasMinHeight(editor, nextBlockH + titleBand, { allowShrink: true });
      // Template creates a page — turn AUTO-ZOOM on and fit with primary margin.
      albumAutoZoomRef.current = true;
      requestAnimationFrame(() => {
        emitHtml(editor.getHTML());
        flushAlbumScrollOrigin(zoomScrollRef.current);
        fitAlbumPageFlushToViewportRef.current?.();
        requestAnimationFrame(() => fitAlbumPageFlushToViewportRef.current?.());
      });
    },
    [
      editor,
      emitHtml,
      applyAlbumCanvasWidth,
      albumPageIndex,
      syncAlbumBinderFromViewport,
      albumTitle
    ]
  );

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
    setTemplatePickerOpen(false);
    onAlbumFullscreenChangeRef.current?.(false);
    requestAnimationFrame(() => fitAlbumPageFlushToViewportRef.current?.());
  }, [presentationMode]);

  /**
   * Full screen / Full Slide: open a new tab that shows the entire album page
   * (auto-fit zoom). Falls back to an in-app overlay if the popup is blocked.
   */
  const enterAlbumFullscreen = useCallback(
    (opts = {}) => {
      if (!editor) return;
      setTemplatePickerOpen(false);

      const current = templatesRef.current || [];
      if (!current.length) {
        let photoCount = 0;
        editor.state.doc.descendants((node) => {
          if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) photoCount += 1;
        });
        const autoId =
          photoCount >= 2 && photoCount <= 5 ? PHOTO_ALBUMS_AUTO_LAYOUT_BY_COUNT[photoCount] : null;
        const templateId = autoId || 't1';
        const layout = getPhotoAlbumsPageTemplate(templateId);
        if (layout) {
          const pw = albumPageWidthFromViewport(zoomScrollRef.current);
          applyAlbumCanvasWidth(pw);
          syncAlbumBinderFromViewport(zoomScrollRef.current);
          const orient = pageOrientationRef.current;
          const nextBlockH = albumTemplateBlockHeight(pw, orient);
          const working = createAlbumTemplateInstance({
            id: templateId,
            x: 0,
            y: 0,
            w: pw,
            h: nextBlockH
          });
          templatesRef.current = [working];
          setTemplates([working]);
          ensureAlbumCanvasMinHeight(editor, nextBlockH, { allowShrink: true });
          emitHtml(editor.getHTML());
        }
      }

      const html = withAlbumMarkers(
        editor.getHTML(),
        templatesRef.current,
        stagedPhotosRef.current,
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
      setAlbumFullSlide(Boolean(opts?.fullSlide));
      setAlbumFullscreen(true);
      if (opts?.fullSlide) setAlbumCoverFace('front');
      onAlbumFullscreenChangeRef.current?.(true);
      requestAnimationFrame(() => {
        fitAlbumPageFlushToViewportRef.current?.();
        flushAlbumScrollOrigin(zoomScrollRef.current);
      });
    },
    [editor, emitHtml, applyAlbumCanvasWidth, noteId, storageType, albumTitle]
  );

  const enterAlbumFullSlide = useCallback(() => {
    enterAlbumFullscreen({ fullSlide: true });
  }, [enterAlbumFullscreen]);
  useEffect(() => {
    if (!albumFullscreen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitAlbumFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [albumFullscreen, exitAlbumFullscreen]);

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () =>
        withAlbumMarkers(
          editor?.getHTML() ?? '',
          templatesRef.current,
          stagedPhotosRef.current,
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
        const list = parseAlbumTemplateInstancesFromHtml(html);
        const staged = parseStagingItemsFromHtml(html);
        const orient = parseAlbumOrientationFromHtml(html);
        const titleStyle = parseAlbumTitleStyleFromHtml(html);
        templatesRef.current = list;
        stagedPhotosRef.current = staged;
        pageOrientationRef.current = orient;
        albumTitleStyleRef.current = titleStyle;
        setTemplates(list);
        setStagedPhotos(staged);
        setPageOrientation(orient);
        setAlbumTitleStyle(titleStyle);
        editor.commands.setContent(stripAlbumMarkers(html) || EMPTY_DOC, { emitUpdate: false });
        if (purgeAlbumDragJunkFromEditor(editor)) {
          requestAnimationFrame(() => emitHtml(editor.getHTML()));
        }
        const bottom = lowestTemplateBottom(list);
        if (bottom > 0) ensureAlbumCanvasMinHeight(editor, bottom, { allowShrink: true });
        // Stretch + flush after hydrate (same as enter / Resize Page) so saved width
        // cannot leave the binder inset with a black gap.
        requestAnimationFrame(() => fitAlbumPageFlushToViewportRef.current?.());
        if (typeof nextEditable === 'boolean') editor.setEditable(nextEditable);
      },
      /**
       * Rebuild alley from vault attachments (size+checksum dedupe).
       * Drops staging entries whose attachment was purged; keeps page-placed photos out of alley.
       * Also removes inline page nodes whose attachments were hard-deleted as duplicates.
       */
      syncStagingAlleyFromAttachments: (attachments) => {
        if (!editor) return;
        const liveById = new Map();
        for (const a of Array.isArray(attachments) ? attachments : []) {
          const id = Number(a?.attachment_id ?? a?.attachmentId);
          if (!Number.isFinite(id) || id < 1) continue;
          liveById.set(id, {
            attachmentId: id,
            fileName: String(a?.file_name ?? a?.fileName ?? ''),
            fileExtension: String(a?.file_extension ?? a?.fileExtension ?? ''),
            fileSizeBytes: a?.file_size_bytes ?? a?.fileSizeBytes ?? null,
            checksum: a?.checksum ? String(a.checksum) : null
          });
        }

        // Drop page tiles whose vault rows were purged as duplicates.
        const deadPositions = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
          const id = Number(node.attrs.attachmentId);
          if (!Number.isFinite(id) || id < 1) return;
          if (!liveById.has(id)) deadPositions.push({ pos, size: node.nodeSize });
        });
        if (deadPositions.length) {
          let tr = editor.state.tr;
          for (let i = deadPositions.length - 1; i >= 0; i -= 1) {
            const { pos, size } = deadPositions[i];
            tr = tr.delete(pos, pos + size);
          }
          editor.view.dispatch(tr);
        }

        const onPage = new Set();
        editor.state.doc.descendants((node) => {
          if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
          const id = Number(node.attrs.attachmentId);
          if (Number.isFinite(id) && id > 0) onPage.add(id);
        });

        const fromMarker = (stagedPhotosRef.current || [])
          .map((item) => {
            const live = liveById.get(Number(item.attachmentId));
            if (!live) return mergeStagingItemPreview(item);
            return mergeStagingItemPreview({
              ...live,
              fileName: item.fileName || live.fileName,
              fileExtension: item.fileExtension || live.fileExtension,
              fileSizeBytes: item.fileSizeBytes ?? live.fileSizeBytes,
              checksum: item.checksum || live.checksum,
              ...(item.localPreviewUrl ? { localPreviewUrl: String(item.localPreviewUrl) } : null)
            });
          })
          .filter((item) => item && Number.isFinite(Number(item.attachmentId)));

        const extras = [];
        for (const [id, live] of liveById) {
          if (onPage.has(id)) continue;
          if (fromMarker.some((m) => Number(m.attachmentId) === id)) continue;
          extras.push(mergeStagingItemPreview(live));
        }

        const next = dedupeStagingItems(
          [...fromMarker, ...extras].filter((item) => !onPage.has(Number(item.attachmentId)))
        ).map((item) => mergeStagingItemPreview(item));
        stagedPhotosRef.current = next;
        setStagedPhotos(next);
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
      },
      getStagedAttachmentIds: () =>
        (stagedPhotosRef.current || []).map((item) => String(item.attachmentId)),
      addStagedAttachment: (attrs) => {
        const attachmentId = Number(attrs?.attachmentId);
        if (!Number.isFinite(attachmentId) || attachmentId < 1) return;
        const nextItem = {
          attachmentId,
          fileName: String(attrs?.fileName || ''),
          fileExtension: String(attrs?.fileExtension || ''),
          fileSizeBytes: attrs?.fileSizeBytes ?? null,
          checksum: attrs?.checksum ? String(attrs.checksum) : null,
          ...(attrs?.localPreviewUrl ? { localPreviewUrl: String(attrs.localPreviewUrl) } : null)
        };
        const prev = stagedPhotosRef.current || [];
        // Preserve local preview when dedupe keeps an existing id.
        const next = dedupeStagingItems([...prev, nextItem]).map((item) => {
          if (Number(item.attachmentId) !== attachmentId) return mergeStagingItemPreview(item);
          return mergeStagingItemPreview({
            ...item,
            ...(nextItem.localPreviewUrl ? { localPreviewUrl: nextItem.localPreviewUrl } : null)
          });
        });
        stagedPhotosRef.current = next;
        setStagedPhotos(next);
        if (editor) requestAnimationFrame(() => emitHtml(editor.getHTML()));
      },
      removeStagedAttachment: (attachmentId) => {
        const id = Number(attachmentId);
        const next = (stagedPhotosRef.current || []).filter((item) => Number(item.attachmentId) !== id);
        stagedPhotosRef.current = next;
        setStagedPhotos(next);
        if (editor) requestAnimationFrame(() => emitHtml(editor.getHTML()));
      },
      returnAttachmentToStaging: (attrs) => {
        const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
        if (typeof store?.returnAttachmentToStaging === 'function') {
          return store.returnAttachmentToStaging(attrs);
        }
        return false;
      },
      setMarkdown: (markdown, nextEditable) => {
        if (!editor) return;
        editor.commands.setContent(markdown ?? '', { emitUpdate: false });
        if (typeof nextEditable === 'boolean') editor.setEditable(nextEditable);
      },
      setAttachmentContext: (ctx) => {
        if (!editor) return;
        const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
        if (!store) return;
        Object.assign(store, ctx || {});
        store.attachmentCtxVersion = (Number(store.attachmentCtxVersion) || 0) + 1;
        try {
          editor.view.dispatch(editor.state.tr.setMeta('paAttachmentCtx', store.attachmentCtxVersion));
        } catch {
          // ignore
        }
      },
      getAttachmentIds: () => {
        if (!editor) return [];
        const ids = [];
        editor.state.doc.descendants((n) => {
          if (n.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME && n.attrs.attachmentId != null) {
            ids.push(String(n.attrs.attachmentId));
          }
        });
        return ids;
      },
      insertAttachmentAtCoords: (attrs, coords) => {
        if (!editor) return;
        let pos = null;
        const nextAttrs = { ...(attrs || {}) };
        if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
          const resolved = editor.view.posAtCoords({ left: coords.x, top: coords.y });
          if (resolved) pos = resolved.pos;
          try {
            const pm = editor.view.dom;
            const rect = pm.getBoundingClientRect();
            let left = Math.max(0, Math.round(coords.x - rect.left + pm.scrollLeft));
            let top = Math.max(0, Math.round(coords.y - rect.top + pm.scrollTop));
            const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
            const snap = store?.findPhotoSnap?.({
              left,
              top,
              width: Number(nextAttrs.width) || 220,
              height: Number(nextAttrs.height) || 160
            });
          if (snap) {
            const targetFrame = {
              left: snap.left,
              top: snap.top,
              width: snap.width,
              height: snap.height
            };
            evictFramedPhotoInFrameToStaging(editor, targetFrame);
            Object.assign(
              nextAttrs,
              coverFitAttrsForSlotRect(
                { left: 0, top: 0, width: snap.width, height: snap.height },
                snap.left,
                snap.top,
                isPhotoAlbumsStagingVideoExtension(nextAttrs?.fileExtension) ? 16 / 9 : 4 / 3
              )
            );
          } else {
            nextAttrs.posLeft = left;
            nextAttrs.posTop = top;
          }
          store?.clearPhotoSnapHighlight?.();
          } catch {
            // keep flow placement
          }
        }
        if (pos == null) pos = editor.state.doc.content.size;
        withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
          editor
            .chain()
            .focus(null, { scrollIntoView: false })
            .insertContentAt(pos, { type: PHOTO_ALBUMS_ATTACHMENT_NODE_NAME, attrs: nextAttrs })
            .run();
          // Drop / place must not auto-select the new photo (double-click selects).
          requestAnimationFrame(() => {
            withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
              if (!editor?.view) return;
              const { state, view } = editor;
              if (!(state.selection instanceof NodeSelection)) return;
              if (state.selection.node?.type?.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
              const near = Math.min(state.doc.content.size, state.selection.to);
              view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(near))));
            });
          });
        });
      },
      insertImage: (src) => {
        if (!editor || !src) return;
        withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
          editor.chain().focus(null, { scrollIntoView: false }).insertContent({ type: 'image', attrs: { src } }).run();
        });
      },
      appendAttachments: (attrsList) => {
        if (!editor || !Array.isArray(attrsList) || !attrsList.length) return;
        const content = attrsList.map((attrs) => ({
          type: PHOTO_ALBUMS_ATTACHMENT_NODE_NAME,
          attrs
        }));
        withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
          editor.chain().insertContentAt(editor.state.doc.content.size, content).run();
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
       * Snapshot one album page (template + photos/labels in that band) without removing it.
       * Used when dragging a filmstrip thumb onto another album.
       */
      getAlbumPageIndex: () => albumPageIndexRef.current || 0,
      getAlbumPageCount: () => sortAlbumPagesByBand(templatesRef.current || []).length,
      goToAlbumPage: (pageIndex, opts) => goToAlbumPageRef.current?.(pageIndex, opts),
      getFilmstripModelForPage: (pageIndex) => {
        if (!editor) return null;
        const ordered = sortAlbumPagesByBand(templatesRef.current || []);
        if (!ordered.length) return null;
        const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
        const pw = Math.max(
          200,
          Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
        );
        const models = buildAlbumPageFilmstripModels(editor, ordered, pw);
        const pageKey = ordered[idx]?.key != null ? String(ordered[idx].key) : null;
        return {
          model: models[idx] || { key: pageKey || `page-${idx}`, slots: [], photos: [] },
          orientation: pageOrientationRef.current || 'portrait',
          pageWidth: pw,
          pageIndex: idx,
          pageKey
        };
      },
      /** Prefer stable template key so ForOrder survives page reorder. */
      goToAlbumPageByKey: (pageKey, opts) => {
        const key = String(pageKey || '').trim();
        if (!key) return false;
        const ordered = sortAlbumPagesByBand(templatesRef.current || []);
        const idx = ordered.findIndex((t) => String(t?.key) === key);
        if (idx < 0) return false;
        goToAlbumPageRef.current?.(idx, opts);
        return true;
      },
      snapshotAlbumPage: (pageIndex) => {
        if (!editor) return null;
        const ordered = sortAlbumPagesByBand(templatesRef.current || []);
        if (!ordered.length) return null;
        const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
        const template = ordered[idx];
        if (!template) return null;
        const pw = Math.max(
          200,
          Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
        );
        const orient = pageOrientationRef.current;
        const band = templateBand(template, pw, orient);
        const photos = [];
        const textLabels = [];
        editor.state.doc.descendants((node) => {
          if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
            const fl = parseOptionalPx(node.attrs.frameLeft);
            const ft = parseOptionalPx(node.attrs.frameTop);
            const fw = parseOptionalPx(node.attrs.frameWidth);
            const fh = parseOptionalPx(node.attrs.frameHeight);
            let cx;
            let cy;
            if (fl != null && ft != null && fw != null && fh != null) {
              cx = fl + fw / 2;
              cy = ft + fh / 2;
            } else {
              const pl = parseOptionalPx(node.attrs.posLeft);
              const pt = parseOptionalPx(node.attrs.posTop);
              const pwNode = parseOptionalPx(node.attrs.width) || 120;
              const phNode = parseOptionalPx(node.attrs.height) || 90;
              if (pl == null || pt == null) return;
              cx = pl + pwNode / 2;
              cy = pt + phNode / 2;
            }
            if (!pointInBand(cx, cy, band)) return;
            const attachmentId = Number(node.attrs.attachmentId);
            if (!Number.isFinite(attachmentId) || attachmentId < 1) return;
            photos.push({ ...node.attrs, attachmentId });
            return;
          }
          if (node.type.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
            const pl = parseOptionalPx(node.attrs.posLeft);
            const pt = parseOptionalPx(node.attrs.posTop);
            if (pl == null || pt == null) return;
            if (!pointInBand(pl, pt, band)) return;
            textLabels.push({ ...node.attrs });
          }
        });
        return {
          template: { ...template },
          photos,
          textLabels,
          orientation: orient,
          pageWidth: pw,
          pageIndex: idx,
          attachmentIds: photos.map((p) => Number(p.attachmentId)).filter((id) => id >= 1)
        };
      },
      /** Remove one album page (template + nodes in band), then restack remaining pages. */
      removeAlbumPage: (pageIndex) => {
        if (!editor) return false;
        const ordered = sortAlbumPagesByBand(templatesRef.current || []);
        if (!ordered.length) return false;
        const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
        const target = ordered[idx];
        if (!target) return false;
        const pw = Math.max(
          200,
          Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
        );
        const orient = pageOrientationRef.current;
        const band = templateBand(target, pw, orient);
        returnPhotosInBandToStagingTray(editor, band);
        const remaining = ordered.filter((_, i) => i !== idx);
        const nextList = restackTemplatesFlushToPages(
          remaining,
          pw,
          orient,
          editor,
          albumBinderWidthPxRef.current
        );
        templatesRef.current = nextList;
        setTemplates(nextList);
        setHighlightSlotId('');
        setHighlightInstanceKey('');
        setAlbumPageIndex((prev) => {
          if (!nextList.length) return 0;
          if (prev > idx) return Math.max(0, prev - 1);
          if (prev === idx) return Math.min(prev, nextList.length - 1);
          return prev;
        });
        requestAnimationFrame(() => emitHtml(editor.getHTML()));
        return true;
      }
    }),
    [editor, emitHtml, applyAlbumCanvasWidth, handleResizePage, pageSize.width]
  );


  const [stagingDragActive, setStagingDragActive] = useState(false);
  const stagingDragActiveRef = useRef(false);
  stagingDragActiveRef.current = stagingDragActive;
  const thumbRowRef = useRef(null);
  const thumbStagingPaneRef = useRef(null);
  const [thumbStagingPercent, setThumbStagingPercent] = useState(() => loadThumbRowStagingPercent());
  const thumbStagingPercentRef = useRef(thumbStagingPercent);
  thumbStagingPercentRef.current = thumbStagingPercent;

  useEffect(() => {
    const onStart = (event) => {
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      if (
        types.includes(DRAG_STAGED_ATTACHMENT) ||
        types.includes(DRAG_STAGED_FLAG)
      ) {
        stagingDragActiveRef.current = true;
        setStagingDragActive(true);
      }
    };
    const clearStrayDropCursors = () => {
      document
        .querySelectorAll('.rv-dropcursor, .ProseMirror-dropcursor, .prosemirror-dropcursor-widget')
        .forEach((el) => el.remove());
    };
    const onEnd = () => {
      stagingDragActiveRef.current = false;
      setStagingDragActive(false);
      clearStrayDropCursors();
    };
    // Bubble phase so the thumb can setData first.
    window.addEventListener('dragstart', onStart, false);
    window.addEventListener('dragend', onEnd, true);
    window.addEventListener('drop', onEnd, true);
    return () => {
      window.removeEventListener('dragstart', onStart, false);
      window.removeEventListener('dragend', onEnd, true);
      window.removeEventListener('drop', onEnd, true);
    };
  }, []);

  const persistStagedPhotos = useCallback(
    (nextList) => {
      const list = dedupeStagingItems(Array.isArray(nextList) ? nextList : []);
      stagedPhotosRef.current = list;
      setStagedPhotos(list);
      if (editor) requestAnimationFrame(() => emitHtml(editor.getHTML()));
    },
    [editor, emitHtml]
  );

  /**
   * Auto Layout — always works in two-page spreads:
   *   left template + right template, then fill both with tray photos.
   * `maxSpreads: 1` (Auto Layout 1) = one open book only; omit/Infinity = all tray photos.
   */
  const handleAutoLayout = useCallback(
    async ({ maxSpreads = Infinity } = {}) => {
      if (!editor || !effectiveEditable) return;
      const tray = stagedPhotosRef.current || [];
      if (!tray.length) return;

      const oneSpreadOnly = Number.isFinite(maxSpreads) && maxSpreads <= 1;
      const modeLabel = oneSpreadOnly ? 'Auto Layout 1' : 'Auto Layout';
      const trayTotal = tray.length;
      const report = (percent, lines) => {
        setAutoLayoutProgress({
          percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
          label: [modeLabel, ...(Array.isArray(lines) ? lines : [String(lines || '')])]
            .filter(Boolean)
            .join('\n')
        });
      };

      setTemplatePickerOpen(false);
      report(1, [`Tray photos: ${trayTotal}`, 'Starting…']);
      // Let the hourglass paint before heavy work.
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      try {
        const binderW =
          syncAlbumBinderFromViewport(zoomScrollRef.current) || albumBinderWidthPxRef.current || 0;
        const pw = albumPageWidthFromViewport(zoomScrollRef.current);
        applyAlbumCanvasWidth(pw, binderW);
        albumBinderWidthPxRef.current = binderW;

        report(3, [`Tray photos: ${trayTotal}`, 'Measuring photo sizes…']);
        const photosWithAspect = await resolveStagingPhotoAspects(tray, {
          noteId,
          storageType,
          onProgress: ({ index, total }) => {
            const pct = 3 + Math.round((index / Math.max(1, total)) * 62);
            report(pct, [
              `Measuring photo ${index} of ${total}`,
              `Tray photos: ${trayTotal}`
            ]);
          }
        });
        const orientStart = pageOrientationRef.current;

        report(68, [
          `Measured ${photosWithAspect.length} of ${trayTotal}`,
          'Planning page templates…'
        ]);

        // Restack existing pages into left|right columns BEFORE fill/plan so occupancy
        // and placement never confuse left-page photos with right-page slots.
        let current = sortAlbumPagesByBand(templatesRef.current || []);
        if (current.length) {
          current = restackTemplatesFlushToPages(
            current,
            pw,
            orientStart,
            editor,
            binderW
          );
          templatesRef.current = current;
          setTemplates(current);
        }

        const occupiedByKey = collectOccupiedSlotsByInstanceKey(
          editor,
          current,
          pw,
          orientStart,
          binderW
        );

        const spreadLeft = albumSpreadLeftPageIndex(albumPageIndexRef.current || 0);
        const fillStart = oneSpreadOnly ? spreadLeft : 0;
        const fillLimit = oneSpreadOnly ? ALBUM_SPREAD_PAGE_COUNT : Infinity;

        const { fills, remainingPhotos } = planFillEmptyTemplatePages(
          current,
          photosWithAspect,
          occupiedByKey,
          { maxPages: fillLimit, startIndex: fillStart }
        );

        const pagesOnCurrentSpread = oneSpreadOnly
          ? Math.min(ALBUM_SPREAD_PAGE_COUNT, Math.max(0, current.length - spreadLeft))
          : 0;
        const albumEndsOnLeftOnly = current.length % ALBUM_SPREAD_PAGE_COUNT === 1;
        const pagesNeededOnSpread = oneSpreadOnly
          ? Math.max(0, ALBUM_SPREAD_PAGE_COUNT - pagesOnCurrentSpread)
          : 0;
        const firstSpreadPageCount = oneSpreadOnly
          ? pagesNeededOnSpread
          : albumEndsOnLeftOnly
            ? 1
            : 2;
        const appendSpreads = oneSpreadOnly
          ? pagesNeededOnSpread > 0
            ? 1
            : 0
          : maxSpreads;

        const tryBothPageOrientations = current.length === 0 && fills.length === 0;
        const { plan, pageOrientation: plannedOrient } = planAutoLayoutPages(
          remainingPhotos,
          pw,
          orientStart,
          {
            tryBothPageOrientations,
            maxSpreads: appendSpreads,
            firstSpreadPageCount: firstSpreadPageCount === 1 ? 1 : 2
          }
        );

        if (!fills.length && !plan.length) {
          report(100, ['Nothing to place — tray unchanged']);
          return;
        }

        const fillPhotoCount = fills.reduce(
          (n, f) => n + (Array.isArray(f.photos) ? f.photos.length : 0),
          0
        );
        const planPhotoCount = plan.reduce(
          (n, p) => n + (Array.isArray(p.photos) ? p.photos.length : 0),
          0
        );
        const placeTotal = fillPhotoCount + planPhotoCount;
        const newPageCount = plan.length;

        report(78, [
          `Placing ${placeTotal} photo${placeTotal === 1 ? '' : 's'}`,
          `Fill existing pages: ${fillPhotoCount}`,
          `New pages: ${newPageCount} (${planPhotoCount} photos)`,
          `Tray remaining after: ${Math.max(0, trayTotal - placeTotal)}`
        ]);

        if (plannedOrient !== pageOrientationRef.current) {
          pageOrientationRef.current = plannedOrient;
          setPageOrientation(plannedOrient);
        }

        const orient = pageOrientationRef.current;
        const blockH = albumTemplateBlockHeight(pw, orient);
        const newInstances = plan.map((page) =>
          createAlbumTemplateInstance({
            id: page.templateId,
            x: 0,
            y: 0,
            w: pw,
            h: blockH
          })
        );

        const nextOrdered = [...current, ...newInstances];
        const nextList = restackTemplatesFlushToPages(
          nextOrdered,
          pw,
          orient,
          editor,
          binderW
        );
        // Guarantee every page has spread-column x/y/w (matches on-screen overlays).
        const placedList = withSpreadPageGeometry(nextList, pw, binderW, orient);
        const placedIds = new Set();

        report(88, [
          `Inserting ${placeTotal} photo${placeTotal === 1 ? '' : 's'} onto album…`,
          `Pages in album: ${placedList.length}`
        ]);

        withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
          let tr = editor.state.tr;
          let insertPos = editor.state.doc.content.size;
          const nodes = [];

          for (const fill of fills) {
            const inst =
              placedList.find((t) => t.key === fill.inst.key) || fill.inst;
            const band = templateBand(inst, pw, orient);
            nodes.push(
              ...buildAutoLayoutPhotoNodes(editor, inst, fill.photos, fill.slots, band, placedIds)
            );
          }

          for (let pi = 0; pi < plan.length; pi += 1) {
            const pagePlan = plan[pi];
            const inst = placedList[current.length + pi];
            if (!inst) continue;
            const layout = getPhotoAlbumsPageTemplate(inst.id);
            if (!layout) continue;
            const photoSlots = resolveAlbumTemplateSlots(layout, inst.slots).filter(
              (s) => s.type === 'photo'
            );
            const band = templateBand(inst, pw, orient);
            nodes.push(
              ...buildAutoLayoutPhotoNodes(
                editor,
                inst,
                pagePlan.photos,
                photoSlots,
                band,
                placedIds
              )
            );
          }

          if (nodes.length) {
            for (const node of nodes) {
              tr = tr.insert(insertPos, node);
              insertPos += node.nodeSize;
            }
            editor.view.dispatch(tr);
          }
        });

        templatesRef.current = placedList;
        setTemplates(placedList);
        setAlbumCanvasWidth(editor, pw, binderW);

        if (oneSpreadOnly) {
          setAlbumPageIndex(spreadLeft);
        } else if (current.length < placedList.length) {
          setAlbumPageIndex(albumSpreadLeftPageIndex(current.length));
        } else if (fills.length) {
          setAlbumPageIndex(albumSpreadLeftPageIndex(fillStart));
        }

        const nextStaged = (stagedPhotosRef.current || []).filter(
          (item) => !placedIds.has(Number(item.attachmentId))
        );
        persistStagedPhotos(nextStaged);

        const titleBand = String(albumTitle || '').trim()
          ? albumPageTitleBandHeightPx(albumTitleStyleRef.current)
          : 0;
        ensureAlbumCanvasMinHeight(editor, lowestTemplateBottom(placedList) + titleBand, {
          allowShrink: true
        });
        albumAutoZoomRef.current = true;

        report(96, [
          `Placed ${placedIds.size} photo${placedIds.size === 1 ? '' : 's'}`,
          `Album pages: ${placedList.length}`,
          `Still in tray: ${nextStaged.length}`,
          'Fitting page to viewport…'
        ]);

        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            emitHtml(editor.getHTML());
            evictDuplicateFramedPhotosInSlots(editor);
            fitAlbumPageFlushToViewportRef.current?.();
            requestAnimationFrame(() => {
              fitAlbumPageFlushToViewportRef.current?.();
              resolve();
            });
          });
        });

        report(100, [
          `Done — placed ${placedIds.size} of ${trayTotal}`,
          `Album pages: ${placedList.length}`,
          `Remaining in tray: ${nextStaged.length}`
        ]);
      } finally {
        window.setTimeout(() => setAutoLayoutProgress(null), 350);
      }
    },
    [
      editor,
      effectiveEditable,
      noteId,
      storageType,
      applyAlbumCanvasWidth,
      syncAlbumBinderFromViewport,
      persistStagedPhotos,
      emitHtml,
      albumTitle
    ]
  );

  const placeStagedAttachmentAtClientPoint = useCallback(
    (attrs, clientX, clientY) => {
      if (!editor) return;
      const attachmentId = Number(attrs?.attachmentId);
      if (!Number.isFinite(attachmentId) || attachmentId < 1) return;
      // Tray drops need a visible-page template slot (no template → blocked).
      const pw =
        albumCanvasWidthPxRef.current >= 200 ? albumCanvasWidthPxRef.current : 480;
      const bw = albumBinderWidthPxRef.current || 0;
      // Right-page drops need the full spread canvas — never clip at one page width.
      setAlbumCanvasWidth(editor, pw, bw);
      const activeOrdered = withSpreadPageGeometry(
        templatesRef.current || [],
        pw,
        bw,
        pageOrientationRef.current || 'portrait'
      );
      const activeSpread = activeSpreadPageInstances(
        activeOrdered,
        albumPageIndexRef.current || 0
      );
      const hasAnyTemplate = (templatesRef.current || []).some((t) =>
        Boolean(getPhotoAlbumsPageTemplate(t.id))
      );
      const canDrop = activeSpread.some((t) => Boolean(getPhotoAlbumsPageTemplate(t.id)));
      if (!canDrop) {
        if (!hasAnyTemplate) setNeedTemplateGuideOpen(true);
        return;
      }
      const zoomScale = Math.max(0.01, (Number(albumZoom) || 100) / 100);
      withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
        try {
          const pm = editor.view.dom;
          // Prefer page-scale box (same transform space as template overlays / absolute photos).
          const originEl = pageScaleRef.current || pm;
          const rect = originEl.getBoundingClientRect();
          let left = Math.max(
            0,
            Math.round((clientX - rect.left) / zoomScale + (pm.scrollLeft || 0))
          );
          let top = Math.max(
            0,
            Math.round((clientY - rect.top) / zoomScale + (pm.scrollTop || 0))
          );
          // Book flip uses translateY on the page-scale — add the active spread's Y shift.
          const spreadPages = activeSpread;
          if (spreadPages[0]) {
            top += Math.max(0, Math.round(Number(spreadPages[0].y) || 0));
          }
          const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
          // Snap against spread-corrected instances (left x=0, right x=page+binder).
          const snap =
            findAlbumPhotoSnapAmongInstances({
              instances: activeSpread,
              left,
              top,
              photoWidth: 220,
              photoHeight: 160
            }) ||
            snapAlbumPhotoSlotAtClientPoint(clientX, clientY, activeSpread);
          if (!snap) {
            store?.clearPhotoSnapHighlight?.();
            return;
          }
          const snapInst = activeSpread.find((t) => t.key === snap.instanceKey);
          if (!snapInst) {
            store?.clearPhotoSnapHighlight?.();
            return;
          }
          evictFramedPhotoInFrameToStaging(editor, {
            left: snap.left,
            top: snap.top,
            width: snap.width,
            height: snap.height
          });
          const nextAttrs = {
            attachmentId,
            fileName: String(attrs?.fileName || ''),
            fileExtension: String(attrs?.fileExtension || ''),
            fileSizeBytes: attrs?.fileSizeBytes ?? null,
            ...coverFitAttrsForSlotRect(
              { left: 0, top: 0, width: snap.width, height: snap.height },
              snap.left,
              snap.top,
              isPhotoAlbumsStagingVideoExtension(attrs?.fileExtension) ? 16 / 9 : 4 / 3
            )
          };
          store?.clearPhotoSnapHighlight?.();

          let pos = null;
          const resolved = editor.view.posAtCoords({ left: clientX, top: clientY });
          if (resolved) pos = resolved.pos;
          if (pos == null) pos = editor.state.doc.content.size;
          editor
            .chain()
            .focus(null, { scrollIntoView: false })
            .insertContentAt(pos, { type: PHOTO_ALBUMS_ATTACHMENT_NODE_NAME, attrs: nextAttrs })
            .run();
          // Restore text/emoji that traveled with this photo in the thumbnail alley.
          const stagedItem = (stagedPhotosRef.current || []).find(
            (item) => Number(item.attachmentId) === attachmentId
          );
          const companions = normalizeCompanionLabels(stagedItem?.companionLabels);
          if (companions.length) {
            insertCompanionLabelsOnPhoto(editor, companions, {
              left: snap.left,
              top: snap.top,
              width: snap.width,
              height: snap.height
            });
          }
          // Drop places the photo only — do not enter selected / blinking mode.
          // User must double-click the photo (or slot) to select.
          requestAnimationFrame(() => {
            withPreservedAlbumZoomScroll(zoomScrollRef.current, () => {
              if (!editor?.view) return;
              const { state, view } = editor;
              if (!(state.selection instanceof NodeSelection)) return;
              if (state.selection.node?.type?.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
              const near = Math.min(state.doc.content.size, state.selection.to);
              view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(near))));
            });
          });
          const next = (stagedPhotosRef.current || []).filter(
            (item) => Number(item.attachmentId) !== attachmentId
          );
          persistStagedPhotos(next);
          requestAnimationFrame(() => {
            setAlbumCanvasWidth(editor, pw, bw);
            evictDuplicateFramedPhotosInSlots(editor);
          });
        } catch {
          // ignore placement errors
        }
      });
    },
    [editor, persistStagedPhotos, albumZoom]
  );

  const handleStagingTrayOsFiles = useCallback(
    (files) => {
      void (async () => {
        await runPhotoAlbumsTrafficWaitIfNeeded();
        onStageOsFiles?.(files);
      })();
    },
    [onStageOsFiles]
  );

  const handleRemoveStaged = useCallback(
    (attachmentId) => {
      const id = Number(attachmentId);
      const next = (stagedPhotosRef.current || []).filter((item) => Number(item.attachmentId) !== id);
      persistStagedPhotos(next);
      onRemoveStagedAttachment?.(id);
    },
    [persistStagedPhotos, onRemoveStagedAttachment]
  );

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
      const ordered = sortAlbumPagesByBand(templatesRef.current || []);
      if (!ordered.length) return;
      const idx = Math.max(0, Math.min(ordered.length - 1, Math.round(Number(pageIndex) || 0)));
      const pageLabel = `page ${idx + 1}`;
      if (
        !(await themedConfirm(
          `Delete ${pageLabel} from this album?\n\nPhotos on that page return to the thumbnail tray.`
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
      const band = templateBand(target, pw, orient);
      returnPhotosInBandToStagingTray(editor, band);
      const remaining = ordered.filter((_, i) => i !== idx);
      const nextList = restackTemplatesFlushToPages(
        remaining,
        pw,
        orient,
        editor,
        albumBinderWidthPxRef.current
      );
      templatesRef.current = nextList;
      setTemplates(nextList);
      setHighlightSlotId('');
      setHighlightInstanceKey('');
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

  /** Filmstrip × All — delete every album page; photos return to the thumbnail tray. */
  const handleDeleteAllAlbumPages = useCallback(async () => {
    if (!editable || orderAlbumActive) return;
    if (!editor) return;
    const ordered = sortAlbumPagesByBand(templatesRef.current || []);
    if (!ordered.length) return;
    const n = ordered.length;
    if (
      !(await themedConfirm(
        `Delete all ${n} album page${n === 1 ? '' : 's'}?\n\nPhotos on those pages return to the thumbnail tray.`
      ))
    ) {
      return;
    }
    const pw = Math.max(
      200,
      Math.round(Number(pageSize.width) || Number(albumCanvasWidthPxRef.current) || 480)
    );
    const orient = pageOrientationRef.current;
    // Last → first so band returns stay correct as pages/nodes are cleared.
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      const band = templateBand(ordered[i], pw, orient);
      returnPhotosInBandToStagingTray(editor, band);
    }
    templatesRef.current = [];
    setTemplates([]);
    persistTemplates([]);
    setHighlightSlotId('');
    setHighlightInstanceKey('');
    setOccupiedByInstance({});
    setAlbumPageIndex(0);
    requestAnimationFrame(() => emitHtml(editor.getHTML()));
  }, [editable, orderAlbumActive, editor, pageSize.width, persistTemplates, emitHtml]);

  const handleRemoveAllStaged = useCallback(async () => {
    const list = stagedPhotosRef.current || [];
    if (!list.length) return;
    const n = list.length;
    if (
      !(await themedConfirm(
        `Remove all ${n} photo${n === 1 ? '' : 's'} from the thumbnail tray? This also deletes them from the album.`
      ))
    ) {
      return;
    }
    const ids = list
      .map((item) => Number(item.attachmentId))
      .filter((id) => Number.isFinite(id) && id > 0);
    persistStagedPhotos([]);
    onRemoveAllStagedAttachments?.(ids);
  }, [persistStagedPhotos, onRemoveAllStagedAttachments]);

  const handlePageDrop = useCallback(
    (event) => {
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      const stagedDrag =
        isStagedAttachmentDrag(event.dataTransfer) || stagingDragActiveRef.current;
      const templateDrag = isAlbumTemplateDrag(event.dataTransfer);
      if (!stagedDrag && !templateDrag && !types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!editable) return;

      const clientX = event.clientX;
      const clientY = event.clientY;
      const files = Array.from(event.dataTransfer?.files || []);
      const templateId = templateDrag ? readAlbumTemplateDragId(event.dataTransfer) : null;
      const stagedMeta = stagedDrag
        ? readStagedAttachmentDrag(event.dataTransfer, stagedPhotosRef.current)
        : null;

      void (async () => {
        await runPhotoAlbumsTrafficWaitIfNeeded();
        if (templateId) {
          handleSelectTemplate(templateId);
          return;
        }
        if (stagedMeta) {
          placeStagedAttachmentAtClientPoint(stagedMeta, clientX, clientY);
          stagingDragActiveRef.current = false;
          setStagingDragActive(false);
          return;
        }
        if (files.length) onStageOsFiles?.(files);
      })();
    },
    [editable, onStageOsFiles, placeStagedAttachmentAtClientPoint, handleSelectTemplate]
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

  /** Bumps when TipTap photo selection / pin changes so slot chrome can blink the fixed frame. */
  const selectedPhotoPos = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const store = e.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      void (store?.contextTutorialTick ?? 0);
      if (store?.pinnedPhotoEditPos != null) return store.pinnedPhotoEditPos;
      const { selection } = e.state;
      if (!(selection instanceof NodeSelection)) return null;
      if (selection.node?.type?.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return null;
      return selection.from;
    }
  });
  const photoEditActive = selectedPhotoPos != null;
  const photoPanZoomActive = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return false;
      const store = e.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      // Depend on tick so Pan&Zoom toggles re-render without selection changes.
      void (store?.contextTutorialTick ?? 0);
      const { selection } = e.state;
      if (!(selection instanceof NodeSelection)) return false;
      if (selection.node?.type?.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return false;
      return Boolean(store?.selectedPhotoPanZoom);
    }
  });
  const albumPhotoCount = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return 0;
      let n = 0;
      e.state.doc.descendants((node) => {
        if (node.type.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) n += 1;
      });
      return n;
    }
  });
  /** Top-left workspace mode badge (Create / View / Edit / Pan). */
  const albumWorkspaceModeLabel = (() => {
    if (photoEditActive) return photoPanZoomActive ? 'Album Pan Mode' : 'Album Edit Mode';
    // ≥1 photo on the album → View; otherwise Create (even with empty template).
    if (albumPhotoCount > 0) return 'Album View Mode';
    return 'Album Create Mode';
  })();

  const collectPagePhotos = useCallback(() => {
    if (!editor) return [];
    const out = [];
    const seen = new Set();
    editor.state.doc.descendants((node) => {
      if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
      const attachmentId = Number(node.attrs.attachmentId);
      if (!Number.isFinite(attachmentId) || attachmentId < 1 || seen.has(attachmentId)) return;
      const fileExtension = String(node.attrs.fileExtension || '').trim();
      const fileName = String(node.attrs.fileName || '').trim();
      const kind =
        getPhotoAlbumsAttachmentViewKind(fileExtension) ||
        getPhotoAlbumsAttachmentViewKind(fileName);
      if (kind !== 'image') return;
      seen.add(attachmentId);
      out.push({
        attachmentId,
        fileName,
        fileExtension: fileExtension || fileExtensionLower({ name: fileName })
      });
    });
    return out;
  }, [editor]);

  const openPhotoFullscreen = useCallback(
    ({ attachmentId, slideshow = false } = {}) => {
      const photos = collectPagePhotos();
      if (!photos.length) return;
      setPhotoViewer({
        photos,
        startAttachmentId: attachmentId ?? photos[0].attachmentId,
        slideshow: Boolean(slideshow)
      });
    },
    [collectPagePhotos]
  );

  const handleSlideShow = useCallback(() => {
    openPhotoFullscreen({ slideshow: true });
  }, [openPhotoFullscreen]);

  /** Each template instance is one album page (book order). */
  const albumPagesSorted = useMemo(() => sortAlbumPagesByBand(templates), [templates]);

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
  const activeSpreadPages = useMemo(() => {
    const pages = [];
    if (leftAlbumPage) pages.push(leftAlbumPage);
    if (rightAlbumPage) pages.push(rightAlbumPage);
    return pages;
  }, [leftAlbumPage, rightAlbumPage]);
  const activeAlbumPage = leftAlbumPage;
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
        height: albumTemplateBlockHeight(spreadPageWidthPx, orient)
      };
    }
    const idx = albumPagesSorted.findIndex((p) => p.key === leftAlbumPage.key);
    const pw = spreadPageWidthPx;
    const bw = albumBinderWidthPx;
    const orient = pageOrientationRef.current || 'portrait';
    const h =
      leftAlbumPage.h > 40
        ? Math.round(leftAlbumPage.h)
        : albumTemplateBlockHeight(pw, orient);
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
        : albumTemplateBlockHeight(pw, orient);
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
        inst.h > 40 ? Math.round(inst.h) : albumTemplateBlockHeight(pw, orient);
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

  /** Force spread shell coords — never trust bloated saved inst.w (old spread-as-page bug). */
  const spreadBandForInstance = (inst, pageIndexHint = -1) => {
    if (!inst) return null;
    const ordered = albumPagesSorted;
    const idx =
      pageIndexHint >= 0
        ? pageIndexHint
        : Math.max(
            0,
            ordered.findIndex((p) => p.key === inst.key)
          );
    const pw = spreadPageWidthPx;
    const bw = albumBinderWidthPx;
    const orient = pageOrientationRef.current || 'portrait';
    const h =
      inst.h > 40 ? Math.round(inst.h) : albumTemplateBlockHeight(pw, orient);
    return {
      left: albumPageXForSpreadColumn(idx, pw, bw),
      top: albumPageTopForSpreadRow(albumSpreadRowForPageIndex(idx), h),
      width: pw,
      height: h
    };
  };

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
        if (editor?.view) {
          const { state, view } = editor;
          if (
            state.selection instanceof NodeSelection &&
            state.selection.node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME
          ) {
            view.dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)));
          }
        }
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
    [albumPagesSorted, editor]
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
        if (editor?.view) {
          const { state, view } = editor;
          if (
            state.selection instanceof NodeSelection &&
            state.selection.node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME
          ) {
            view.dispatch(state.tr.setSelection(TextSelection.atStart(state.doc)));
          }
        }
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
    [albumPagesSorted.length, editor, runAlbumPageFlipThen]
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
    runAlbumPageFlipThen
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
            // Above album pages / template overlay (~45) / selected photos (~50–90);
            // below Page-templates picker (~200).
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
      photoLoadBands,
      openPhotoFullscreen
    }),
    [openPhotoFullscreen, activeAlbumPageBand, activeSpreadPageBands, photoLoadBands]
  );

  // Keep TipTap node views in sync when the active book page / load bands change.
  // Only bump layoutLockVersion when geometry actually changes — Auto Layout + page-fit
  // used to recreate band object identities every rAF and cancel in-flight photo loads.
  useEffect(() => {
    if (!editor) return;
    const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (!store) return;
    const nextActive = albumLayoutContextValue.activePageBands;
    const nextLoad = albumLayoutContextValue.photoLoadBands;
    const nextKey = JSON.stringify({
      active: nextActive,
      load: nextLoad,
      legacy: albumLayoutContextValue.activePageBand
    });
    store.activePageBand = albumLayoutContextValue.activePageBand;
    store.activePageBands = nextActive;
    store.photoLoadBands = nextLoad;
    if (store._albumLayoutBandsKey === nextKey) return;
    store._albumLayoutBandsKey = nextKey;
    store.layoutLockVersion = (Number(store.layoutLockVersion) || 0) + 1;
    try {
      editor.view.dispatch(editor.state.tr.setMeta('paLayoutLock', store.layoutLockVersion));
    } catch {
      // editor may be unmounting
    }
  }, [editor, albumLayoutContextValue]);

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
        existingLabels={placeTextExistingLabels}
        initialExistingId={placeTextInitialExistingId}
        mediaSession={placeTextMediaSession}
        noteId={noteId}
        storageType={storageType}
        onPhotoChromeChange={handlePlaceTextPhotoChromeChange}
        onClose={() => {
          placeTextEditingLabelIdRef.current = null;
          placeTextEditingPosRef.current = null;
          placeTextAlbumTitleModeRef.current = false;
          placeTextPagePosRef.current = null;
          placeTextPhotoPosRef.current = null;
          placeTextSelectionRef.current = { from: 0, to: 0, empty: true, replaceableText: false };
          setPlaceTextExistingLabels([]);
          setPlaceTextInitialExistingId(null);
          setPlaceTextStyle(null);
          setPlaceTextMediaSession(null);
          setPlaceTextOpen(false);
          exitPlaceTextToNormalAlbum();
        }}
        onConfirm={handlePlaceTextConfirm}
      />
      {!albumFullscreen ? header : null}
      {!albumFullscreen ? <PhotoAlbumsEditorToolbar editor={editor} /> : null}

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

      {/* Template control sits above the binder (not on the page) so the 3×3 picker is never clipped.
          Keep this stacking context above the album zoom-scroll (incl. native scrollbars + page-edge bar).
          Fixed label size + horizontal scroll — no font auto-fit (avoids scrollbar/font jiggle). */}
      {editable && !albumFullscreen ? (
        <Box
          className="rv-editor__template-bar"
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
            <GreenButton
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                runAfterTrafficWait(() => {
                  void handleAutoLayout();
                });
              }}
              disabled={!stagedPhotos.length || Boolean(autoLayoutProgress)}
              aria-label="Auto Layout — create left+right page templates as spreads and fill both from the tray"
              title="Places tray photos onto the album in two-page spreads: left template + right template, then the next spread, until the tray is empty."
              sx={albumTemplateBarButtonSx}
            >
              Auto Layout
            </GreenButton>
            <GreenButton
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                runAfterTrafficWait(() => {
                  void handleAutoLayout({ maxSpreads: 1 });
                });
              }}
              disabled={!stagedPhotos.length || Boolean(autoLayoutProgress)}
              aria-label="Auto Layout 1 — create/fill one two-page spread (left + right templates) and stop"
              title="Creates or fills one open book only: left page template + right page template, filled from the tray. Remaining photos stay in the tray."
              sx={albumTemplateBarButtonSx}
            >
              Auto Layout 1
            </GreenButton>
            <Box
              ref={templatePickerAnchorRef}
              data-pa-album-bar-btn-wrap=""
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'stretch',
                flex: '0 0 auto'
              }}
            >
              <GreenButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  runAfterTrafficWait(() => {
                    setTemplatePickerOpen((open) => !open);
                  })
                }
                aria-expanded={templatePickerOpen}
                aria-haspopup="dialog"
                aria-label="Choose page template"
                sx={albumTemplateBarButtonSx}
              >
                Template
              </GreenButton>
              <PhotoAlbumsTemplatePickerPanel
                open={templatePickerOpen}
                anchorEl={templatePickerAnchorRef.current}
                selectedTemplateId={
                  activeAlbumPage?.id || templates[templates.length - 1]?.id || ''
                }
                orientation={pageOrientation}
                onSelect={(id) => runAfterTrafficWait(() => handleSelectTemplate(id))}
                onClose={() => {
                  setTemplatePickerOpen(false);
                }}
              />
            </Box>
            <ColorTemplate16PopupCenterWide
              open={needTemplateGuideOpen}
              onClose={() => setNeedTemplateGuideOpen(false)}
              closeOnBackdrop
              bodyTextAlignLeft={false}
              centeredLeadLines={0}
              overlaySx={{ zIndex: 21000 }}
              closeButtonAriaLabel="Close album layout guide"
            >
              <ColorTemplate16PopupCenterWide.Title>Add photos to your album</ColorTemplate16PopupCenterWide.Title>
              <ColorTemplate16PopupCenterWide.Body spacing={1.25} sx={{ textAlign: 'left' }}>
                <Box component="ol" sx={{ m: 0, pl: 2.75, fontWeight: 700, lineHeight: 1.5 }}>
                  <Box component="li" sx={{ mb: 1 }}>
                    <strong>Choose a Layout:</strong> Click the Template button in the top-left corner and select your
                    layout so photos fit the page for printing.
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <strong>Add Photos:</strong> Drag photos into the layout slots.
                    <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5, fontWeight: 700 }}>
                      <Box component="li">
                        To change photos: with Pan&Zoom off, drag a photo back to the thumbnail alley, or onto another
                        slot to swap (text and emoji on the photo move with it). Click the red{' '}
                        <Box component="span" sx={{ color: 'var(--theme-error-color)' }}>
                          X
                        </Box>{' '}
                        or Reset to return it (not deleted from cloud/USB storage). Release elsewhere to cancel — pan
                        and zoom stay the same.
                      </Box>
                    </Box>
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <strong>Edit &amp; Adjust:</strong> Double-click any photo to open Add Text — add captions,
                    emoji, and use Pan Zoom / Rotate / Full / Zoom. With Pan&Zoom off on the page, drag to swap
                    slots or return to the thumbnail alley.
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <strong>Add Story &amp; Context:</strong> In Add Text (double-click), type details like who,
                    where, when, and the story behind the photo.
                  </Box>
                </Box>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.45, mt: 0.5 }}>
                  Note: All text you add will be searchable across all your album sets later!
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 0.5 }}>
                  <GreenButton
                    type="button"
                    onClick={() => {
                      setNeedTemplateGuideOpen(false);
                      setTemplatePickerOpen(true);
                    }}
                  >
                    Open Template
                  </GreenButton>
                </Box>
              </ColorTemplate16PopupCenterWide.Body>
            </ColorTemplate16PopupCenterWide>
            {[
              {
                key: 'reset',
                label: 'Reset Page',
                onClick: handleResetPage,
                ariaLabel:
                  'Reset page — clear content, return photos to tray, zoom 95%, flush top-left, stretch to page edge',
                title:
                  'Clear page, return photos to the thumbnail alley, zoom 95%, flush binder top-left, stretch right edge to the dashed page edge'
              },
              {
                key: 'resize',
                label: 'Resize Page',
                onClick: handleResizePage,
                ariaLabel: 'Resize page — turn AUTO-ZOOM on and fit the album page in the shell',
                title:
                  'Turn AUTO-ZOOM back on and fit the whole binder and page (theme-primary border, no scrollbars)'
              },
              {
                key: 'portrait',
                label: 'Portrait',
                onClick: () => applyPageOrientation('portrait'),
                ariaLabel: 'Portrait — page proportion 10 wide by 12 tall',
                title: 'Portrait — page proportion 10 width × 12 height',
                pressed: pageOrientation === 'portrait'
              },
              {
                key: 'landscape',
                label: 'Landscape',
                onClick: () => applyPageOrientation('landscape'),
                ariaLabel: 'Landscape — page proportion 12 wide by 10 tall',
                title: 'Landscape — page proportion 12 width × 10 height',
                pressed: pageOrientation === 'landscape'
              },
              {
                key: 'fullscreen',
                label: 'Full screen',
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
                sx={{
                  ...albumTemplateBarButtonSx,
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
                onClick: () => onOrderPrint?.(),
                disabled: typeof onOrderPrint !== 'function',
                ariaLabel: 'Order Print — add this album page to For Order',
                title: 'Add this album page to For Order (sidebar) for printing later'
              },
              {
                key: 'slideshow',
                label: 'Photo SlideShow',
                onClick: handleSlideShow,
                disabled: !collectPagePhotos().length,
                ariaLabel: 'Photo SlideShow — full page photos, advances every 5 seconds',
                title: 'Photo SlideShow of page photos — advances every 5 seconds'
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
                sx={albumTemplateBarButtonSx}
              >
                {btn.label}
              </GreenButton>
            ))}
          </Box>
        </Box>
      ) : null}

      {editable && !albumFullscreen ? (
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
            borderBottom: '2px solid var(--theme-daynight-color)',
            /* Above album zoom pane (zIndex 1) so hover filename plates are fully visible. */
            position: 'relative',
            zIndex: 80,
            overflow: 'visible',
            transition: 'outline-color 0.12s ease, box-shadow 0.12s ease',
            '&[data-rv-staging-return-hover="1"]': {
              outline: '3px dashed #c62828',
              outlineOffset: -3,
              boxShadow: 'inset 0 0 0 4px rgba(198,40,40,0.22)'
            }
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
            <PhotoAlbumsPhotoStagingTray
              inline
              items={stagedPhotos}
              noteId={noteId}
              storageType={storageType}
              editable={effectiveEditable}
              onOsFiles={handleStagingTrayOsFiles}
              onRemove={handleRemoveStaged}
              onRemoveAll={handleRemoveAllStaged}
              onReturnFromPage={(attachmentId) => {
                runAfterTrafficWait(() => {
                // Attachment node handles return; tray drop of page mime is backup.
                const nodeAttrs = {};
                editor?.state.doc.descendants((node) => {
                  if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return;
                  if (Number(node.attrs.attachmentId) === Number(attachmentId)) {
                    Object.assign(nodeAttrs, node.attrs);
                  }
                });
                if (nodeAttrs.attachmentId != null) {
                  const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
                  store?.returnAttachmentToStaging?.({
                    attachmentId: nodeAttrs.attachmentId,
                    fileName: nodeAttrs.fileName,
                    fileExtension: nodeAttrs.fileExtension,
                    fileSizeBytes: nodeAttrs.fileSizeBytes,
                    checksum: nodeAttrs.checksum,
                    _photoRect: photoPageRectFromAttrs(nodeAttrs)
                  });
                }
                });
              }}
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
              stagingCount={stagedPhotos.length}
              pages={albumPagesSorted}
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
            />
          </Box>
        </Box>
      ) : null}

      {!albumFullscreen ? (
        <PhotoAlbumsAlbumZoomBar value={albumZoom} onChange={handleAlbumZoomChange} />
      ) : null}

      <Box
        ref={zoomScrollRef}
        className="rv-editor__album-zoom-scroll"
        onDragOver={(e) => {
          const staged = isStagedAttachmentDrag(e.dataTransfer);
          const templateDrag = isAlbumTemplateDrag(e.dataTransfer);
          const files = Array.from(e.dataTransfer?.types || []).includes('Files');
          if (!staged && !templateDrag && !files) return;
          e.preventDefault();
          if (staged) {
            const ordered = sortAlbumPagesByBand(templatesRef.current || []);
            const activeSpread = activeSpreadPageInstances(
              ordered,
              albumPageIndexRef.current || 0
            );
            const canDrop = activeSpread.some((t) => Boolean(getPhotoAlbumsPageTemplate(t.id)));
            e.dataTransfer.dropEffect = canDrop ? 'copy' : 'none';
            return;
          }
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handlePageDrop}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          // Book pages flip left/right — no stacked-page scrollbar.
          overflow: 'hidden',
          position: 'relative',
          // Below template bar / Page templates picker (zIndex 200) so page-edge bar stays under the popup.
          zIndex: 1,
          ...(albumFullscreen
            ? {
                // Black margins for top/bottom page-nav strips — keep them off the photos.
                pt: `${ALBUM_FS_NAV_PAD_PX}px`,
                pb: `${ALBUM_FS_NAV_PAD_PX}px`,
                px: '8px',
                bgcolor: '#000000'
              }
            : null)
        }}
      >
        {!albumFullscreen && !presentationMode ? (
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
              bgcolor: 'var(--theme-primary-color)'
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
                bgcolor: 'var(--theme-primary-color)',
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
                  bgcolor: 'var(--theme-daynight-color)',
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
                  bgcolor: 'var(--theme-daynight-color)',
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
                  {activeSpreadPages.map((inst) => {
                    const band = spreadBandForInstance(inst);
                    if (!band) return null;
                    return (
                      <PhotoAlbumsPageTemplateOverlay
                        key={inst.key}
                        templateId={inst.id}
                        pageWidth={band.width}
                        pageHeight={band.height}
                        offsetLeft={band.left}
                        offsetTop={band.top}
                        slotOverrides={inst.slots || null}
                        highlightSlotId={
                          highlightInstanceKey === inst.key ? highlightSlotId : ''
                        }
                        occupiedSlotIds={occupiedByInstance[inst.key] || null}
                        editable={effectiveEditable}
                        stagingDragActive={stagingDragActive}
                        dragScale={Math.max(0.01, albumZoom / 100)}
                        pageKey={inst.key}
                        onMoveResize={(geom, opts) =>
                          handleTemplateMoveResize(inst.key, geom, opts)
                        }
                        onSlotGeometryChange={(slotId, pct, opts) =>
                          handleSlotGeometryChange(inst.key, slotId, pct, opts)
                        }
                        onSlotPhotoZoom={(slotId, deltaY) =>
                          handleSlotPhotoZoom(inst.key, slotId, deltaY)
                        }
                        isSlotPhotoSelected={(slotId) =>
                          isSlotPhotoSelectedForInstance(inst.key, slotId)
                        }
                        onSlotPhotoPan={(slotId, dx, dy, opts) =>
                          handleSlotPhotoPan(inst.key, slotId, dx, dy, opts)
                        }
                        onSlotPhotoScale={(slotId, factor, opts) =>
                          handleSlotPhotoScale(inst.key, slotId, factor, opts)
                        }
                        onDelete={() => runAfterTrafficWait(() => handleDeleteTemplate(inst.key))}
                        onStagedPhotoDrop={handlePageDrop}
                      />
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
                            fontSize: `${Math.max(
                              10,
                              Math.round(
                                Number(albumTitleStyle?.fontSize) ||
                                  DEFAULT_ALBUM_TITLE_STYLE.fontSize
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
                    bgcolor: '#000',
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
                  title="Drag to resize the page — templates and photos scale together"
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

      {!albumFullscreen ? (
        <Box className="rv-editor__footer">
          <span>{counts.words} words</span>
          <span>{counts.characters} characters</span>
          <span title="Album page zoom">{albumZoom}% album</span>
        </Box>
      ) : null}

      <PhotoAlbumsPhotoFullscreenOverlay
        open={Boolean(photoViewer)}
        photos={photoViewer?.photos || []}
        startAttachmentId={photoViewer?.startAttachmentId ?? null}
        slideshow={Boolean(photoViewer?.slideshow)}
        noteId={noteId}
        sharedAlbumId={sharedAlbumId}
        storageType={storageType}
        onClose={() => setPhotoViewer(null)}
      />
      <BusyHourglassOverlay
        open={Boolean(autoLayoutProgress)}
        label="Auto Layout"
        progressPercent={autoLayoutProgress?.percent ?? null}
        progressLabel={autoLayoutProgress?.label || ''}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <PhotoAlbumsContextTutorial
        active={Boolean(effectiveEditable && !presentationMode && !albumFullscreen)}
        photoEditActive={photoEditActive}
        panZoomActive={Boolean(photoPanZoomActive)}
        hasPageContext={Boolean(templates?.length)}
        hasAlbumPhotos={albumPhotoCount > 0}
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
  onStageOsFiles: PropTypes.func,
  onRemoveStagedAttachment: PropTypes.func,
  onRemoveAllStagedAttachments: PropTypes.func,
  onAlbumFullscreenChange: PropTypes.func,
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
  orderAlbumActive: PropTypes.bool,
  orderFilmstripEntries: PropTypes.array,
  orderFilmstripIndex: PropTypes.number,
  onOrderFilmstripSelect: PropTypes.func,
  onOrderFilmstripDelete: PropTypes.func
};

export default PhotoAlbumsNoteEditor;
