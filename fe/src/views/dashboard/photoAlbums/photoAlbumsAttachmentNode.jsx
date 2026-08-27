import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, useEditorState } from '@tiptap/react';
import { NodeSelection, TextSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import SliderControlButton from 'ui-component/SliderControlButton';
import BusyHourglass from 'ui-component/BusyHourglass';
import ColorTemplate6CloseX from 'ui-component/ColorTemplate6CloseX';
import VaultWorkspaceErrorPopup from 'ui-component/VaultWorkspaceErrorPopup';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  canViewPhotoAlbumsAttachment,
  canNativeOpenPhotoAlbumsAttachment,
  extensionFromPhotoAlbumsAttachment,
  formatPhotoAlbumsFileSize,
  getPhotoAlbumsAttachmentViewKind,
  isPhotoAlbumsStagingVideoExtension
} from 'utils/photoAlbumsFileFormats';
import {
  downloadPhotoAlbumsNoteAttachment,
  fetchPhotoAlbumsNoteAttachmentBlob,
  openPhotoAlbumsNoteAttachmentNative,
  isPhotoAlbumsNativeOpenUnsupportedError,
  readPhotoAlbumsApiError
} from 'api/photoAlbumsFe';
import { fetchPhotoAlbumsSharedAlbumAttachmentBlob } from 'api/photoAlbumsInviteFe';
import { openPhotoAlbumsAttachmentInNewWindow } from './openPhotoAlbumsAttachmentWindow';
import {
  pointInAnyAlbumBand,
  usePhotoAlbumsAlbumLayout
} from './photoAlbumsAlbumLayoutContext';
import { getStagingAttachmentPreview } from './photoAlbumsStagingPreviewCache';
import { getAttachmentVariantPreview } from './photoAlbumsAttachmentVariantCache';
import PhotoAlbumsVideoIndicator from './PhotoAlbumsVideoIndicator';
import { findFramedPhotoInFrame } from './photoAlbumsSlotOccupancy';

/** Human-readable “why blank” line for thumb load failures. */
function explainPhotoBlankReason(apiMsg, status) {
  const m = String(apiMsg || '').toLowerCase();
  if (status === 404 || m.includes('not found') || m.includes('missing')) {
    return 'Likely cause: the encrypted file is missing from USB/Cloud, or the attachment record was deleted.';
  }
  if (m.includes('corrupt') || m.includes('decrypt')) {
    return 'Likely cause: decryption failed — the file may be corrupt, or the vault key does not match.';
  }
  if (status === 400 || m.includes('invalid')) {
    return 'Likely cause: invalid note or attachment id on this album page.';
  }
  if (status === 401 || status === 403) {
    return 'Likely cause: the vault session expired or you do not have access.';
  }
  return 'The image bytes could not be loaded, so this slot stays blank.';
}

/** Multi-line detail for VaultWorkspaceErrorPopup when a photo thumb fails. */
function formatPhotoThumbLoadError(
  err,
  { fileName, attachmentId, noteId, sharedAlbumId, storageType } = {}
) {
  const apiMsg = readPhotoAlbumsApiError(err, 'Could not load photo');
  const status = err?.response?.status;
  const lines = [`Why this photo is blank: ${apiMsg}`, ''];
  lines.push(`File: ${fileName || '(unknown)'}`);
  lines.push(
    `Attachment id: ${Number.isFinite(Number(attachmentId)) && Number(attachmentId) > 0 ? attachmentId : '(missing)'}`
  );
  if (Number.isFinite(Number(sharedAlbumId)) && Number(sharedAlbumId) > 0) {
    lines.push(`Shared album id: ${sharedAlbumId}`);
  } else {
    lines.push(
      `Album note id: ${Number.isFinite(Number(noteId)) && Number(noteId) > 0 ? noteId : '(missing)'}`
    );
  }
  if (storageType) lines.push(`Storage: ${storageType}`);
  if (status) lines.push(`HTTP status: ${status}`);
  lines.push('', explainPhotoBlankReason(apiMsg, status));
  return lines.join('\n');
}

export const PHOTO_ALBUMS_ATTACHMENT_NODE_NAME = 'photoAlbumsAttachment';
/** Same name as `PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME` — avoid circular import with that module. */
const PHOTO_ALBUMS_TEXT_LABEL_NODE = 'photoAlbumsTextLabel';

const VIEW_BUTTON_HOURGLASS_SIZE = { xs: '1.1rem', sm: '1.25rem' };
/** Keep launch hourglass visible after the desktop app opens. */
const LAUNCH_BUSY_HOLD_MS = 5000;
const MIN_PHOTO_WIDTH = 80;
const MAX_PHOTO_WIDTH = 1200;
const PHOTO_MOVE_THRESHOLD_PX = 4;
const ALBUM_EDGE_SCROLL_PX = 56;
const ALBUM_PAGE_PAD_PX = 48;

function parseOptionalPx(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function rectsOverlap(a, b, pad = 0) {
  if (!a || !b) return false;
  const p = Math.max(0, Number(pad) || 0);
  return !(
    a.left + a.width + p < b.left ||
    b.left + b.width + p < a.left ||
    a.top + a.height + p < b.top ||
    b.top + b.height + p < a.top
  );
}

/** Photo frame/place box in page coordinates (for clearing nearby text + emoji stickers). */
function photoPageRectFromAttrs(attrs) {
  if (!attrs) return null;
  const frameLeft = parseOptionalPx(attrs.frameLeft);
  const frameTop = parseOptionalPx(attrs.frameTop);
  const frameWidth = parseOptionalPx(attrs.frameWidth);
  const frameHeight = parseOptionalPx(attrs.frameHeight);
  if (frameLeft != null && frameTop != null && frameWidth != null && frameHeight != null) {
    return { left: frameLeft, top: frameTop, width: frameWidth, height: frameHeight };
  }
  const left = parseOptionalPx(attrs.posLeft);
  const top = parseOptionalPx(attrs.posTop);
  const width = parseOptionalPx(attrs.width) || 120;
  const height = parseOptionalPx(attrs.height) || 90;
  if (left == null || top == null) return null;
  return { left, top, width, height };
}

/**
 * Delete floating text + emoji stickers that sit on/near this photo's box.
 * Emoji stickers are text-label nodes with an emoji font family.
 */
function deleteTextAndEmojiNearPhoto(editor, photoRect) {
  const companions = detachTextAndEmojiNearPhoto(editor, photoRect);
  return companions.length > 0;
}

/** List text/emoji labels overlapping a photo box (with relative geometry). */
function labelAssociatesWithPhoto(labelAttrs, photoRect, pad = 24) {
  const left = parseOptionalPx(labelAttrs?.posLeft) ?? 0;
  const top = parseOptionalPx(labelAttrs?.posTop) ?? 0;
  const fontSize = Number(labelAttrs?.fontSize) || 40;
  const width =
    parseOptionalPx(labelAttrs?.boxWidth) || Math.max(24, Math.round(fontSize * 1.2));
  const height =
    parseOptionalPx(labelAttrs?.boxHeight) || Math.max(24, Math.round(fontSize * 1.2));
  const box = { left, top, width, height };
  if (rectsOverlap(photoRect, box, pad)) return true;
  const cx = left + width / 2;
  const cy = top + height / 2;
  const p = Math.max(0, Number(pad) || 0);
  return (
    cx >= photoRect.left - p &&
    cx <= photoRect.left + photoRect.width + p &&
    cy >= photoRect.top - p &&
    cy <= photoRect.top + photoRect.height + p
  );
}

function listTextAndEmojiNearPhoto(state, photoRect, pad = 24, attachmentId = null) {
  if (!state?.doc || !photoRect) return [];
  const pw = Math.max(1, photoRect.width);
  const ph = Math.max(1, photoRect.height);
  const photoAttachmentId = Number(attachmentId);
  const items = [];
  state.doc.descendants((n, pos) => {
    if (n.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE) return;
    const hostId = Number(n.attrs?.hostAttachmentId);
    const matchesHost =
      photoAttachmentId >= 1 && hostId >= 1 && hostId === photoAttachmentId;
    if (!matchesHost && !labelAssociatesWithPhoto(n.attrs, photoRect, pad)) return;
    const left = parseOptionalPx(n.attrs.posLeft) ?? 0;
    const top = parseOptionalPx(n.attrs.posTop) ?? 0;
    const fontSize = Number(n.attrs.fontSize) || 40;
    const width = parseOptionalPx(n.attrs.boxWidth) || Math.max(24, Math.round(fontSize * 1.2));
    const height = parseOptionalPx(n.attrs.boxHeight) || Math.max(24, Math.round(fontSize * 1.2));
    items.push({
      pos,
      size: n.nodeSize,
      attrs: { ...n.attrs },
      relX: (left - photoRect.left) / pw,
      relY: (top - photoRect.top) / ph,
      relBoxW: width / pw,
      relBoxH: height / ph
    });
  });
  return items;
}

/** Labels on a specific photo slot (overlap + hostAttachmentId when set). */
function listTextAndEmojiForPhotoPos(state, photoPos, pad = 24) {
  if (!state?.doc || !Number.isFinite(photoPos)) return [];
  const photoNode = state.doc.nodeAt(photoPos);
  if (!photoNode || photoNode.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE) return [];
  const photoRect = photoPageRectFromAttrs(photoNode.attrs);
  if (!photoRect) return [];
  const attachmentId = Number(photoNode.attrs?.attachmentId);
  return listTextAndEmojiNearPhoto(state, photoRect, pad, attachmentId);
}

/** Remove overlapping labels from the doc; return companion payloads for staging / restore. */
function detachTextAndEmojiNearPhoto(editor, photoRect) {
  if (!editor?.view || !photoRect) return [];
  const items = listTextAndEmojiNearPhoto(editor.state, photoRect);
  if (!items.length) return [];
  let tr = editor.state.tr;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const { pos, size } = items[i];
    tr = tr.delete(pos, pos + size);
  }
  editor.view.dispatch(tr);
  return items.map(({ attrs, relX, relY, relBoxW, relBoxH }) => ({
    attrs,
    relX,
    relY,
    relBoxW,
    relBoxH
  }));
}

/** Reposition overlapping labels onto a new photo/slot rect (same relative placement). */
function moveTextAndEmojiNearPhoto(editor, fromRect, toRect) {
  if (!editor?.view || !fromRect || !toRect) return false;
  const items = listTextAndEmojiNearPhoto(editor.state, fromRect);
  if (!items.length) return false;
  let tr = editor.state.tr;
  tr = applyCompanionLabelMovesToTr(tr, items, toRect);
  editor.view.dispatch(tr);
  return true;
}

/** Apply relative label moves onto `tr` (higher pos first). */
function applyCompanionLabelMovesToTr(tr, companions, toRect) {
  if (!tr || !toRect || !Array.isArray(companions) || !companions.length) return tr;
  const tw = Math.max(1, toRect.width);
  const th = Math.max(1, toRect.height);
  const ordered = [...companions].sort((a, b) => b.pos - a.pos);
  let nextTr = tr;
  for (const item of ordered) {
    const current = nextTr.doc.nodeAt(item.pos);
    if (!current || current.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE) continue;
    const nextAttrs = {
      ...current.attrs,
      posLeft: Math.round(toRect.left + item.relX * tw),
      posTop: Math.round(toRect.top + item.relY * th)
    };
    nextTr = nextTr.setNodeMarkup(item.pos, undefined, nextAttrs);
  }
  return nextTr;
}

/** Place staged companion labels onto a photo/slot rect. */
function insertCompanionLabelsOnPhoto(editor, companions, photoRect) {
  if (!editor || !photoRect || !Array.isArray(companions) || !companions.length) return;
  const tw = Math.max(1, photoRect.width);
  const th = Math.max(1, photoRect.height);
  const nodes = companions
    .map((c) => {
      const attrs = c?.attrs && typeof c.attrs === 'object' ? { ...c.attrs } : null;
      if (!attrs) return null;
      const relX = Number.isFinite(Number(c.relX)) ? Number(c.relX) : 0.08;
      const relY = Number.isFinite(Number(c.relY)) ? Number(c.relY) : 0.08;
      attrs.posLeft = Math.round(photoRect.left + relX * tw);
      attrs.posTop = Math.round(photoRect.top + relY * th);
      // Fresh id so two drops of the same staged photo do not collide.
      attrs.labelId = `lbl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      return { type: PHOTO_ALBUMS_TEXT_LABEL_NODE, attrs };
    })
    .filter(Boolean);
  if (!nodes.length) return;
  const pos = editor.state.doc.content.size;
  editor.chain().insertContentAt(pos, nodes).run();
}

/** Natural photo aspect (width/height). Falls back to current box or 4:3. */
function photoAspectRatio(imgEl, boxW, boxH) {
  const nw = imgEl?.naturalWidth;
  const nh = imgEl?.naturalHeight;
  if (nw > 0 && nh > 0) return nw / nh;
  if (boxW > 0 && boxH > 0) return boxW / boxH;
  return 4 / 3;
}

/** Cover-fit size: photo fully covers the slot window (may extend past edges). */
function coverSizeForFrame(aspect, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  let w = fw;
  let h = w / aspect;
  if (h < fh) {
    h = fh;
    w = h * aspect;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** Contain-fit size: entire photo inside the slot (letterbox / pillarbox, keep proportion). */
function containSizeForFrame(aspect, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  let w = fw;
  let h = w / aspect;
  if (h > fh) {
    h = fh;
    w = h * aspect;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

function normalizeSlotFit(raw) {
  return raw === 'contain' ? 'contain' : 'cover';
}

function fitSizeForFrame(aspect, frameW, frameH, mode) {
  return normalizeSlotFit(mode) === 'contain'
    ? containSizeForFrame(aspect, frameW, frameH)
    : coverSizeForFrame(aspect, frameW, frameH);
}

/**
 * Clamp pan inside a slot window.
 * Allow dragging the photo partly (or mostly) out of the frame — clipped overflow is OK.
 * Keep only a small overlap so the photo does not vanish completely.
 */
function clampPhotoPan(panX, panY, photoW, photoH, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const pw = Math.max(1, photoW);
  const ph = Math.max(1, photoH);
  const minOverlapX = Math.max(24, Math.min(64, Math.round(fw * 0.12)));
  const minOverlapY = Math.max(24, Math.min(64, Math.round(fh * 0.12)));
  // Photo may slide out until only minOverlap remains visible in the window.
  const minX = minOverlapX - pw;
  const maxX = fw - minOverlapX;
  const minY = minOverlapY - ph;
  const maxY = fh - minOverlapY;
  return {
    panX: Math.round(Math.min(maxX, Math.max(minX, panX))),
    panY: Math.round(Math.min(maxY, Math.max(minY, panY)))
  };
}

function centeredPan(photoW, photoH, frameW, frameH) {
  return clampPhotoPan(
    (frameW - photoW) / 2,
    (frameH - photoH) / 2,
    photoW,
    photoH,
    frameW,
    frameH
  );
}

/** Fit a photo (by aspect) into a slot window — used when snapping or swapping slots. */
function framedAttrsForSlot(aspect, frameLeft, frameTop, frameWidth, frameHeight, slotFit = 'contain') {
  const fit = fitSizeForFrame(aspect, frameWidth, frameHeight, slotFit);
  const pan = centeredPan(fit.width, fit.height, frameWidth, frameHeight);
  return {
    posLeft: frameLeft,
    posTop: frameTop,
    width: fit.width,
    height: fit.height,
    panX: pan.panX,
    panY: pan.panY,
    frameLeft,
    frameTop,
    frameWidth,
    frameHeight,
    slotFit: normalizeSlotFit(slotFit)
  };
}

function aspectFromAttachmentNode(node, fallbackAspect = 4 / 3) {
  const w = parseOptionalPx(node?.attrs?.width);
  const h = parseOptionalPx(node?.attrs?.height);
  if (w > 0 && h > 0) return w / h;
  return fallbackAspect > 0 ? fallbackAspect : 4 / 3;
}

/** Grow album canvas height for content below the fold.
 *  Never changes page/PM width — the page-edge bar is user-drag only (no auto sync from slots/photos). */
function expandAlbumCanvas(pm, left, top, width, height) {
  if (!pm) return;
  void left;
  void width;
  const needH = Math.max(
    Math.round(pm.clientHeight || 0),
    Math.round(window.innerHeight * 0.55),
    Math.round(top + height + ALBUM_PAGE_PAD_PX)
  );
  const curH = parseInt(pm.style.minHeight, 10) || 0;
  if (needH > curH) pm.style.minHeight = `${needH}px`;
}

/** Keep the drag target in view while moving toward an edge. */
function autoScrollAlbumDuringDrag(scrollHost, clientX, clientY) {
  if (!scrollHost) return { dx: 0, dy: 0 };
  const rect = scrollHost.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (clientX > rect.right - ALBUM_EDGE_SCROLL_PX) {
    dx = Math.min(48, Math.round(clientX - (rect.right - ALBUM_EDGE_SCROLL_PX) + 12));
  } else if (clientX < rect.left + ALBUM_EDGE_SCROLL_PX) {
    dx = -Math.min(48, Math.round(rect.left + ALBUM_EDGE_SCROLL_PX - clientX + 12));
  }
  if (clientY > rect.bottom - ALBUM_EDGE_SCROLL_PX) {
    dy = Math.min(48, Math.round(clientY - (rect.bottom - ALBUM_EDGE_SCROLL_PX) + 12));
  } else if (clientY < rect.top + ALBUM_EDGE_SCROLL_PX) {
    dy = -Math.min(48, Math.round(rect.top + ALBUM_EDGE_SCROLL_PX - clientY + 12));
  }
  if (dx) scrollHost.scrollLeft += dx;
  if (dy) scrollHost.scrollTop += dy;
  return { dx, dy };
}

/** CSS zoom on the album scaler (0–1+). Client deltas must be divided by this. */
function readAlbumZoomScale(pm) {
  const scaler = pm?.closest?.('.rv-editor__album-zoom-scaler');
  if (!scaler) return 1;
  const raw = scaler.style?.zoom || getComputedStyle(scaler).zoom || '1';
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0.01 ? n : 1;
}

/**
 * Yellow thumbnail row (staging alley + page filmstrip) is the return-to-alley drop zone.
 * Photos live inside the zoomed scroll area, so hit-test by rect — not only
 * elementFromPoint (zoom bar / overlays often sit under the cursor).
 */
function isPointerOverStagingReturnZone(clientX, clientY) {
  const thumbRow = document.querySelector('[data-rv-album-thumb-row]');
  const tray = document.querySelector('[data-rv-album-staging-tray]');
  const hitEl = thumbRow || tray;
  if (!hitEl) return false;
  const tr = hitEl.getBoundingClientRect();
  const zoomBar = document.querySelector('.rv-editor__album-zoom-bar');
  const zr = zoomBar?.getBoundingClientRect?.();
  const left = tr.left;
  const right = tr.right;
  const top = tr.top - 8;
  // Include a little slack below the yellow bar so drops near the bottom edge still count.
  const bottom = zr && zr.top > tr.bottom - 2 ? Math.max(tr.bottom + 8, zr.top) : tr.bottom + 12;
  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

function setStagingReturnHover(active) {
  const thumbRow = document.querySelector('[data-rv-album-thumb-row]');
  const tray = document.querySelector('[data-rv-album-staging-tray]');
  if (thumbRow) {
    if (active) thumbRow.setAttribute('data-rv-staging-return-hover', '1');
    else thumbRow.removeAttribute('data-rv-staging-return-hover');
  }
  if (tray) {
    if (active) tray.setAttribute('data-rv-staging-return-hover', '1');
    else tray.removeAttribute('data-rv-staging-return-hover');
  }
}

/** Floating thumbnail that follows the cursor up to the staging alley. */
function createPagePhotoDragGhost(imgEl, width, height) {
  const ghost = document.createElement('div');
  ghost.setAttribute('data-rv-page-photo-ghost', '');
  ghost.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'z-index:2147483000',
    'pointer-events:none',
    'box-sizing:border-box',
    `width:${Math.max(48, Math.min(160, Math.round(width || 96)))}px`,
    `height:${Math.max(48, Math.min(120, Math.round(height || 72)))}px`,
    'border:2px solid #1976d2',
    'border-radius:6px',
    'overflow:hidden',
    'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
    'opacity:0.92',
    'background:#fff'
  ].join(';');
  if (imgEl?.src) {
    const img = document.createElement('img');
    img.src = imgEl.src;
    img.alt = '';
    img.draggable = false;
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
    ghost.appendChild(img);
  }
  document.body.appendChild(ghost);
  return ghost;
}

function movePagePhotoDragGhost(ghost, clientX, clientY) {
  if (!ghost) return;
  const w = ghost.offsetWidth || 96;
  const h = ghost.offsetHeight || 72;
  ghost.style.transform = `translate(${Math.round(clientX - w / 2)}px, ${Math.round(clientY - h / 2)}px)`;
}

function removePagePhotoDragGhost(ghost) {
  ghost?.remove?.();
}

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

const photoTileSx = {
  position: 'relative',
  width: '100%',
  borderRadius: '6px',
  overflow: 'visible',
  bgcolor: '#fff',
  border: '1px solid rgba(0,0,0,0.12)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  lineHeight: 0,
  '& img': {
    borderRadius: '6px'
  }
};

const photoWindowSx = {
  position: 'relative',
  width: '100%'
};

/** Compact filename chip — top-right of photo, left of the return X. */
const photoFileNamePlateSx = {
  px: 0.75,
  py: 0.35,
  bgcolor: '#000000',
  color: '#ffeb3b',
  fontSize: '0.62rem',
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: { xs: 100, sm: 160, md: 220 },
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
  pointerEvents: 'none',
  userSelect: 'none',
  flex: '1 1 auto',
  minWidth: 0
};

const photoTopRightChromeSx = {
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 0.5,
  maxWidth: 'calc(100% - 8px)',
  pointerEvents: 'none'
};

/** Hover action chips — fill each cell of the action row (wrap when narrow). */
const photoSlotActionBtnSx = {
  flex: '1 1 0',
  width: 'auto',
  minWidth: 0,
  maxWidth: '100%',
  px: { xs: 0.4, sm: 0.65 },
  py: { xs: 0.65, sm: 0.8 },
  fontSize: { xs: '0.72rem !important', sm: '0.85rem !important' },
  fontWeight: 800,
  minHeight: { xs: '2.2rem', sm: '2.5rem' },
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '@media (hover: hover)': {
    '&:hover:not(:disabled)': {
      bgcolor: '#ffffff !important',
      color: '#000000 !important',
      WebkitTextFillColor: '#000000 !important',
      filter: 'none'
    }
  }
};

/** Pan mode — yellow blink on Pan button + chrome frames. */
const panModeYellowBlinkSx = {
  '@keyframes rvPhotoPanModeYellowBlink': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.42 }
  },
  animation: 'rvPhotoPanModeYellowBlink 1.05s ease-in-out infinite'
};

/** Blink border color only — keeps button row readable. */
const panModeFrameBlinkSx = {
  '@keyframes rvPhotoPanModeFrameBlink': {
    '0%, 100%': { borderColor: '#FFEB3B' },
    '50%': { borderColor: '#000000' }
  },
  animation: 'rvPhotoPanModeFrameBlink 1.05s ease-in-out infinite'
};

const panModeInstructionBannerSx = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  zIndex: 6,
  px: 0.6,
  py: 0.45,
  boxSizing: 'border-box',
  bgcolor: '#FFEB3B',
  color: '#000000',
  border: '3px solid #000000',
  pointerEvents: 'none',
  userSelect: 'none',
  textAlign: 'center',
  fontWeight: 800,
  fontFamily: 'Algerian, fantasy',
  fontSize: { xs: '0.68rem', sm: '0.78rem' },
  lineHeight: 1.25
};

const PAN_MODE_INSTRUCTION =
  'Toggle Pan&Zoom button to Enter Pan&Zoom mode, Click&Drag to Pan, Use yellow slider to Zoom';

/** Yellow zoom slider chrome — active only in Pan mode. */
const SLOT_ZOOM_CHROME_BG = '#FBDF1B';
const SLOT_ZOOM_CHROME_FG = '#000000';
/** Greyed-out chrome when not in Pan mode. */
const SLOT_ZOOM_CHROME_BG_DISABLED = '#9e9e9e';
const SLOT_ZOOM_CHROME_FG_DISABLED = '#616161';
const SLOT_ZOOM_PCT_MIN = 0;
const SLOT_ZOOM_PCT_MAX = 100;
/** Max photo width as multiple of cover width at 100%. */
const SLOT_ZOOM_MAX_COVER_MULT = 4;

const slotZoomSliderRowSx = (active) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 0.6,
  bgcolor: active ? SLOT_ZOOM_CHROME_BG : SLOT_ZOOM_CHROME_BG_DISABLED,
  px: 0.75,
  py: 0.4,
  boxSizing: 'border-box',
  pointerEvents: 'auto',
  borderTop: '2px solid #000000',
  opacity: active ? 1 : 0.85,
  cursor: active ? 'default' : 'not-allowed'
});

const slotZoomSliderSx = (active) => ({
  flex: 1,
  mx: 0.35,
  color: active ? SLOT_ZOOM_CHROME_FG : SLOT_ZOOM_CHROME_FG_DISABLED,
  '& .MuiSlider-thumb': {
    width: 18,
    height: 14,
    borderRadius: '2px',
    bgcolor: active ? '#000000' : '#757575',
    border: `1px solid ${active ? '#000000' : '#616161'}`,
    '&:hover, &.Mui-focusVisible': active
      ? { boxShadow: '0 0 0 4px rgba(0,0,0,0.12)' }
      : { boxShadow: 'none' }
  },
  '& .MuiSlider-track': {
    bgcolor: active ? '#000000' : '#757575',
    border: 'none',
    height: 3
  },
  '& .MuiSlider-rail': {
    bgcolor: active ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.18)',
    height: 3
  },
  '&.Mui-disabled': {
    color: SLOT_ZOOM_CHROME_FG_DISABLED,
    opacity: 1
  }
});

const slotZoomPctLabelSx = (active) => ({
  minWidth: 36,
  textAlign: 'center',
  fontWeight: 900,
  color: active ? '#c62828' : '#757575',
  WebkitTextFillColor: active ? '#c62828' : '#757575',
  flexShrink: 0,
  fontSize: '0.78rem',
  lineHeight: 1.2,
  fontFamily: 'Algerian, fantasy'
});

/** Map framed photo width vs cover → 0…100% (0 = cover fill, 100 = max zoom). */
function framedZoomPercentFromWidth(photoW, aspect, frameW, frameH) {
  const cover = coverSizeForFrame(aspect, frameW, frameH);
  if (!(cover.width > 0) || !(photoW > 0)) return 0;
  const minW = cover.width;
  const maxW = Math.round(cover.width * SLOT_ZOOM_MAX_COVER_MULT);
  if (maxW <= minW) return 0;
  const pct = Math.round(((photoW - minW) / (maxW - minW)) * 100);
  return Math.min(SLOT_ZOOM_PCT_MAX, Math.max(SLOT_ZOOM_PCT_MIN, pct));
}

function framedWidthFromZoomPercent(pct, aspect, frameW, frameH) {
  const cover = coverSizeForFrame(aspect, frameW, frameH);
  const minW = Math.max(MIN_PHOTO_WIDTH, cover.width);
  const maxW = Math.round(cover.width * SLOT_ZOOM_MAX_COVER_MULT);
  const t = Math.min(SLOT_ZOOM_PCT_MAX, Math.max(SLOT_ZOOM_PCT_MIN, Number(pct) || 0)) / 100;
  return Math.round(minW + t * (maxW - minW));
}

/**
 * Place a framed photo into a new slot while keeping the same zoom % and the
 * same subject under the frame center (scaled pan). Used for slot swap / move.
 */
function transferFramedPanZoomToSlot({
  aspect,
  photoW,
  photoH,
  panX,
  panY,
  slotFit,
  rotationDeg,
  fromFrameW,
  fromFrameH,
  toFrameLeft,
  toFrameTop,
  toFrameW,
  toFrameH
}) {
  const a = aspect > 0 ? aspect : 4 / 3;
  const fromW = Math.max(1, Number(fromFrameW) || 1);
  const fromH = Math.max(1, Number(fromFrameH) || 1);
  const toW = Math.max(1, Number(toFrameW) || 1);
  const toH = Math.max(1, Number(toFrameH) || 1);
  const coverFrom = coverSizeForFrame(a, fromW, fromH);
  const srcW = Math.max(1, Number(photoW) || coverFrom.width);
  const srcH = Math.max(1, Number(photoH) || Math.round(srcW / a));
  const srcPanX = Number.isFinite(Number(panX)) ? Number(panX) : (fromW - srcW) / 2;
  const srcPanY = Number.isFinite(Number(panY)) ? Number(panY) : (fromH - srcH) / 2;

  const pct = framedZoomPercentFromWidth(srcW, a, fromW, fromH);
  const nextW = framedWidthFromZoomPercent(pct, a, toW, toH);
  const nextH = Math.max(1, Math.round(nextW / a));

  // Keep the photo point that was under the old frame center under the new center.
  const focusX = srcW > 0 ? (fromW / 2 - srcPanX) / srcW : 0.5;
  const focusY = srcH > 0 ? (fromH / 2 - srcPanY) / srcH : 0.5;
  const pan = clampPhotoPan(
    toW / 2 - focusX * nextW,
    toH / 2 - focusY * nextH,
    nextW,
    nextH,
    toW,
    toH
  );

  const rotN = Number(rotationDeg);
  const rot = Number.isFinite(rotN)
    ? ((Math.round(rotN / 90) * 90) % 360 + 360) % 360
    : 0;

  return {
    posLeft: toFrameLeft,
    posTop: toFrameTop,
    width: nextW,
    height: nextH,
    panX: pan.panX,
    panY: pan.panY,
    frameLeft: toFrameLeft,
    frameTop: toFrameTop,
    frameWidth: toFrameW,
    frameHeight: toFrameH,
    slotFit: normalizeSlotFit(slotFit) || 'cover',
    rotationDeg: rot
  };
}

/**
 * React node view for an inline vault file. Image attachments render as album
 * collage tiles (drag to place anywhere, bottom-right resize, hover actions).
 * Other files keep the yellow bar. Runtime context is read from editor storage.
 */
function PhotoAlbumsAttachmentNodeView({ node, editor, deleteNode, updateAttributes, selected, getPos }) {
  const attachmentId = Number(node?.attrs?.attachmentId);
  const displayWidth = (() => {
    const n = Number(node?.attrs?.width);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  })();
  const displayHeight = (() => {
    const n = Number(node?.attrs?.height);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  })();
  const frameLeft = parseOptionalPx(node?.attrs?.frameLeft);
  const frameTop = parseOptionalPx(node?.attrs?.frameTop);
  const frameWidth = parseOptionalPx(node?.attrs?.frameWidth);
  const frameHeight = parseOptionalPx(node?.attrs?.frameHeight);
  const panX = parseOptionalPx(node?.attrs?.panX) ?? 0;
  const panY = parseOptionalPx(node?.attrs?.panY) ?? 0;
  const slotFit = normalizeSlotFit(node?.attrs?.slotFit);
  const rotationDeg = (() => {
    const n = Number(node?.attrs?.rotationDeg);
    if (!Number.isFinite(n)) return 0;
    return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
  })();
  const placedLeft = parseOptionalPx(node?.attrs?.posLeft);
  const placedTop = parseOptionalPx(node?.attrs?.posTop);
  const inFrame = frameWidth != null && frameHeight != null && frameLeft != null && frameTop != null;
  const { openPhotoFullscreen, activePageBand, activePageBands } =
    usePhotoAlbumsAlbumLayout();
  const layoutLockVersion = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.layoutLockVersion ?? 0
  });
  const attachmentCtxVersion = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.attachmentCtxVersion ?? 0
  });
  const attachmentNoteId = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const id = Number(ed?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.noteId);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
  });

  /**
   * Book flip: hide photos that belong to other spreads (not the open left+right pages).
   * Free-placed photos use their center; framed use frame center.
   */
  const onActiveBookPage = useMemo(() => {
    const bandsFromCtx = Array.isArray(activePageBands) ? activePageBands : [];
    const bandsFromStore = Array.isArray(
      editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.activePageBands
    )
      ? editor.storage[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME].activePageBands
      : [];
    const bands = bandsFromCtx.length
      ? bandsFromCtx
      : bandsFromStore.length
        ? bandsFromStore
        : null;
    // Legacy fallback: single left band only (would hide right-page drops).
    const legacyBand =
      activePageBand || editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.activePageBand;
    const left = inFrame ? frameLeft : placedLeft;
    const top = inFrame ? frameTop : placedTop;
    const w = inFrame ? frameWidth : displayWidth;
    const h = inFrame ? frameHeight : displayHeight;
    if (left == null || top == null) return true;
    const cx = left + Math.max(1, Number(w) || 40) / 2;
    const cy = top + Math.max(1, Number(h) || 40) / 2;
    if (bands?.length) return pointInAnyAlbumBand(cx, cy, bands);
    if (!legacyBand || !(legacyBand.height > 0)) return true;
    return (
      cx >= legacyBand.left &&
      cx <= legacyBand.left + legacyBand.width &&
      cy >= legacyBand.top &&
      cy <= legacyBand.top + legacyBand.height
    );
  }, [
    activePageBands,
    activePageBand,
    editor,
    layoutLockVersion,
    inFrame,
    frameLeft,
    frameTop,
    frameWidth,
    frameHeight,
    placedLeft,
    placedTop,
    displayWidth,
    displayHeight
  ]);

  /**
   * Load all album page photos (no Path A lazy unload). Display uses *_1000px.jpg;
   * full att_N.jpg only in Edit Photo popup / slideshow.
   */
  const shouldLoadPhotoBlob = true;
  const attachment = {
    attachment_id: attachmentId,
    file_name: node?.attrs?.fileName || '',
    file_extension: node?.attrs?.fileExtension || '',
    file_size_bytes: node?.attrs?.fileSizeBytes ?? null
  };

  const tileRef = useRef(null);
  const albumVideoRef = useRef(null);
  const viewModeOpenTimerRef = useRef(null);
  /** Blank tab opened sync under click gesture — filled after double-click cancel window. */
  const pendingPreviewWinRef = useRef(null);
  const [viewingId, setViewingId] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [removing, setRemoving] = useState(false);
  /** /myStory-style pan mode — drag moves photo inside the slot; 4-way arrows show. */
  const [panEnabled, setPanEnabled] = useState(false);
  const [error, setError] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [thumbLoading, setThumbLoading] = useState(false);
  /** Set when photo blob fetch / decode fails — click blank slot to show details. */
  const [thumbLoadError, setThumbLoadError] = useState('');
  const [photoErrorPopupOpen, setPhotoErrorPopupOpen] = useState(false);
  /** Survives layout-lock bumps so Auto Layout / page-fit does not cancel a finished vault load. */
  const vaultThumbReadyRef = useRef(false);
  const vaultThumbAttachmentIdRef = useRef(null);
  const thumbUrlRef = useRef('');
  thumbUrlRef.current = thumbUrl;
  /** Live gesture state: free place, or pan/scale inside a slot window. */
  const [dragPos, setDragPos] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  /** Hover/selected filename — inline top-right next to return X. */
  const [nameHover, setNameHover] = useState(false);
  const readContext = useCallback(() => editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME] || {}, [editor]);

  const commitAttrs = useCallback(
    (attrs) => {
      const pos = typeof getPos === 'function' ? getPos() : null;
      if (editor && typeof pos === 'number' && Number.isFinite(pos)) {
        const ok = editor
          .chain()
          .command(({ tr, dispatch }) => {
            const current = tr.doc.nodeAt(pos);
            if (!current || current.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) return false;
            tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs });
            if (dispatch) dispatch(tr);
            return true;
          })
          .run();
        if (ok) return;
      }
      updateAttributes?.(attrs);
    },
    [editor, getPos, updateAttributes]
  );

  const label = String(attachment.file_name || `file.${attachment.file_extension || 'bin'}`);
  const sizeLabel = formatPhotoAlbumsFileSize(attachment.file_size_bytes);
  const ext = extensionFromPhotoAlbumsAttachment(attachment);
  const viewKind =
    getPhotoAlbumsAttachmentViewKind(ext) ||
    getPhotoAlbumsAttachmentViewKind(attachment.file_name) ||
    getPhotoAlbumsAttachmentViewKind(attachment.file_extension);
  const isPhoto = viewKind === 'image';
  const isAlbumVideo = viewKind === 'video' && isPhotoAlbumsStagingVideoExtension(ext);
  const isAlbumSlotMedia = isPhoto || isAlbumVideo;

  const canView = canViewPhotoAlbumsAttachment(ext) || isAlbumSlotMedia;
  const launchesNative = canNativeOpenPhotoAlbumsAttachment(ext);
  const actionLabel = launchesNative ? 'Launch' : 'View';
  const editable = Boolean(editor?.isEditable);
  const pinnedPhotoEditPos = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const store = ed?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      void (store?.contextTutorialTick ?? 0);
      return store?.pinnedPhotoEditPos ?? null;
    }
  });
  let selfPos = null;
  try {
    selfPos = typeof getPos === 'function' ? getPos() : null;
  } catch {
    selfPos = null;
  }
  /** TipTap selection OR pinned after Place Text — drives red border / Text / Reset chrome. */
  const editActive = Boolean(
    selected || (Number.isFinite(selfPos) && selfPos === pinnedPhotoEditPos)
  );
  const photoViewModeActive = isAlbumSlotMedia && (!editable || !editActive);
  const collageSize = Number.isFinite(attachmentId) ? attachmentId % 3 : 0;

  useEffect(
    () => () => {
      if (viewModeOpenTimerRef.current) {
        window.clearTimeout(viewModeOpenTimerRef.current);
        viewModeOpenTimerRef.current = null;
      }
      const pending = pendingPreviewWinRef.current;
      pendingPreviewWinRef.current = null;
      if (pending && !pending.closed) {
        try {
          pending.close();
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const livePanX = dragPos?.panX ?? panX;
  const livePanY = dragPos?.panY ?? panY;
  const livePhotoW = dragPos?.width ?? displayWidth;
  const livePhotoH = dragPos?.height ?? displayHeight;
  const liveLeft = dragPos?.left ?? (inFrame ? frameLeft : placedLeft);
  const liveTop = dragPos?.top ?? (inFrame ? frameTop : placedTop);
  const showAsPlaced = (liveLeft != null && liveTop != null) || isMoving || inFrame;

  /** Mouse wheel scrolls the album page — zoom only via the yellow slider (not wheel). */
  // (Previously wheel zoomed the selected photo and blocked page scroll.)

  /** Select this photo node (solid red border) — via double-click Add Text. */
  const selectThisPhoto = useCallback(() => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null || !editor?.view) return;
    const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (store) {
      store.pinnedPhotoEditPos = pos;
      store.contextTutorialTick = (store.contextTutorialTick || 0) + 1;
    }
    const { state, dispatch } = editor.view;
    dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
  }, [editor, getPos]);

  /**
   * Framed + Pan&Zoom on: drag pans inside the slot.
   * Framed + Pan&Zoom off: drag relocates — tray return, slot swap, or cancel
   * (release elsewhere restores original position / pan / zoom).
   * Framed photos also relocate in View/Create (no Edit Photo) after a short
   * drag threshold so plain click / double-click edit popup still work.
   * Free-placed + selected: drag moves the photo.
   * Edit chrome (Text / Reset / Pan Zoom) opens via double-click Edit Photo popup.
   */
  const startPhotoMove = useCallback(
    (event) => {
      if (!editable || event.button !== 0) return;
      if (event.target?.closest?.('.rv-photo-tile__actions')) return;
      if (event.target?.closest?.('.rv-attachment-photo__return-x, .rv-attachment-photo__top-chrome')) return;
      if (event.target?.closest?.('.rv-album-video-indicator')) return;
      if (event.target?.closest?.('.rv-photo-tile__zoom-bar')) return;
      if (event.target?.closest?.('button')) return;

      // Slot rearrange without Edit Photo; free-place / pan still need selection.
      const framedRelocateWithoutEdit = Boolean(inFrame && !panEnabled);
      if (!editActive && !framedRelocateWithoutEdit) return;

      // Unselected framed: defer preventDefault until drag passes threshold
      // so double-click → Edit Photo popup still fires.
      const deferRelocateUi = !editActive;
      if (!deferRelocateUi) {
        event.preventDefault();
        event.stopPropagation();
      }

      const tile = tileRef.current;
      const wrapper = tile?.closest?.('.rv-attachment-photo') || tile?.parentElement;
      const pm = wrapper?.closest?.('.ProseMirror');
      if (!wrapper || !pm) return;
      const scrollHost =
        pm.closest('.rv-editor__album-zoom-scroll') ||
        pm.closest('.rv-editor__body') ||
        pm.parentElement ||
        pm;
      const imgEl = tile?.querySelector?.('img');
      const startX = event.clientX;
      const startY = event.clientY;
      const ctx0 = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME] || {};
      // Still sitting in a *current* slot window? (stale frame* attrs after
      // template delete/replace must free-move / snap into a new template.)
      let frameAnchored = false;
      if (inFrame && ctx0.hasAlbumTemplate && frameLeft != null && frameTop != null) {
        const probe = ctx0.findPhotoSnap?.({
          left: frameLeft,
          top: frameTop,
          width: Math.max(40, Math.min(frameWidth || 80, 120)),
          height: Math.max(40, Math.min(frameHeight || 80, 120))
        });
        frameAnchored =
          Boolean(probe) &&
          Math.abs((probe.left || 0) - frameLeft) <= 6 &&
          Math.abs((probe.top || 0) - frameTop) <= 6;
      }
      // Pan&Zoom → pan inside (Edit Photo + toggle only). Otherwise relocate.
      const panInside = Boolean(editActive && inFrame && panEnabled);
      const relocate = !panInside;

      // Home slot before relocate — used to swap the other photo back here.
      const homeFrame =
        inFrame &&
        frameLeft != null &&
        frameTop != null &&
        frameWidth != null &&
        frameHeight != null
          ? {
              left: frameLeft,
              top: frameTop,
              width: frameWidth,
              height: frameHeight
            }
          : null;
      // Only restore/cancel to the old slot when frame attrs still match a live template slot.
      const restoreFrame = frameAnchored ? homeFrame : null;

      /** Cancel relocate — put the photo back exactly as it was (pan/zoom untouched). */
      const restoreHomePlacement = () => {
        if (restoreFrame) {
          wrapper.classList.add('rv-attachment-photo--framed', 'rv-attachment-photo--placed');
          wrapper.style.left = `${restoreFrame.left}px`;
          wrapper.style.top = `${restoreFrame.top}px`;
          wrapper.style.width = `${restoreFrame.width}px`;
          wrapper.style.height = `${restoreFrame.height}px`;
          wrapper.style.maxWidth = 'none';
        } else if (placedLeft != null && placedTop != null) {
          wrapper.classList.add('rv-attachment-photo--placed');
          wrapper.classList.remove('rv-attachment-photo--framed');
          wrapper.style.left = `${placedLeft}px`;
          wrapper.style.top = `${placedTop}px`;
          if (displayWidth) wrapper.style.width = `${displayWidth}px`;
          if (displayHeight) wrapper.style.height = `${displayHeight}px`;
        }
        wrapper.style.opacity = '';
        wrapper.style.zIndex = '2';
        setDragPos(null);
        setIsMoving(false);
      };

      // ---- Pan inside the dotted slot window ----
      if (!relocate && inFrame) {
        const zoomScale = readAlbumZoomScale(pm);
        const photoW = livePhotoW || coverSizeForFrame(photoAspectRatio(imgEl, frameWidth, frameHeight), frameWidth, frameHeight).width;
        const photoH = livePhotoH || Math.round(photoW / photoAspectRatio(imgEl, frameWidth, frameHeight));
        const originPanX = livePanX;
        const originPanY = livePanY;
        let moved = false;
        let latest = { panX: originPanX, panY: originPanY, width: photoW, height: photoH };

        setIsMoving(true);
        setDragPos({
          left: frameLeft,
          top: frameTop,
          width: photoW,
          height: photoH,
          panX: originPanX,
          panY: originPanY,
          mode: 'frame'
        });

        const onMove = (moveEvent) => {
          const dx = (moveEvent.clientX - startX) / zoomScale;
          const dy = (moveEvent.clientY - startY) / zoomScale;
          if (
            !moved &&
            Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < PHOTO_MOVE_THRESHOLD_PX
          ) {
            return;
          }
          moved = true;
          const next = clampPhotoPan(
            originPanX + dx,
            originPanY + dy,
            photoW,
            photoH,
            frameWidth,
            frameHeight
          );
          latest = { ...latest, ...next };
          setDragPos({
            left: frameLeft,
            top: frameTop,
            width: photoW,
            height: photoH,
            panX: next.panX,
            panY: next.panY,
            mode: 'frame'
          });
        };
        const onUp = () => {
          document.body.style.removeProperty('user-select');
          document.body.style.removeProperty('cursor');
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          if (moved) {
            commitAttrs({ panX: latest.panX, panY: latest.panY });
          }
          setDragPos(null);
          setIsMoving(false);
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return;
      }

      // ---- Free place / snap into a slot / return to staging tray ----
      const zoomScale = readAlbumZoomScale(pm);
      const pmRect = pm.getBoundingClientRect();
      const tileRect = wrapper.getBoundingClientRect();
      const originLeft =
        inFrame && frameLeft != null
          ? frameLeft
          : placedLeft != null
            ? placedLeft
            : Math.max(0, Math.round((tileRect.left - pmRect.left) / zoomScale));
      const originTop =
        inFrame && frameTop != null
          ? frameTop
          : placedTop != null
            ? placedTop
            : Math.max(0, Math.round((tileRect.top - pmRect.top) / zoomScale));
      // Drag a compact preview size (not cover-bleed) so the ghost is easy to aim at the tray.
      const rawW = livePhotoW || displayWidth || Math.round(tileRect.width / zoomScale) || 180;
      const rawH = livePhotoH || displayHeight || Math.round(tileRect.height / zoomScale) || 120;
      const aspect = photoAspectRatio(imgEl, rawW, rawH);
      const startWidth = Math.min(220, rawW);
      const startHeight = Math.min(160, rawH || Math.round(startWidth / aspect) || 120);
      const scrollLeft0 = scrollHost.scrollLeft || 0;
      const scrollTop0 = scrollHost.scrollTop || 0;
      let moved = false;
      let latest = {
        left: originLeft,
        top: originTop,
        width: startWidth,
        height: startHeight,
        panX: 0,
        panY: 0,
        frame: null
      };
      let lastClientX = startX;
      let lastClientY = startY;
      let overReturnZone = false;
      let ghost = null;
      let relocateUiLive = false;

      const beginRelocateUi = () => {
        if (relocateUiLive) return;
        relocateUiLive = true;
        ghost = createPagePhotoDragGhost(imgEl, startWidth, startHeight);
        movePagePhotoDragGhost(ghost, lastClientX, lastClientY);
        wrapper.classList.add('rv-attachment-photo--placed', 'is-moving');
        wrapper.classList.remove('rv-attachment-photo--framed');
        wrapper.style.left = `${originLeft}px`;
        wrapper.style.top = `${originTop}px`;
        wrapper.style.width = `${startWidth}px`;
        wrapper.style.height = `${startHeight}px`;
        wrapper.style.maxWidth = 'none';
        wrapper.style.zIndex = '30';
        wrapper.style.opacity = '0.35';
        expandAlbumCanvas(pm, originLeft, originTop, startWidth, startHeight);
        setIsMoving(true);
        setNameHover(false);
        setDragPos(latest);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      };

      if (!deferRelocateUi) beginRelocateUi();

      const applyFreeBox = (box) => {
        wrapper.style.left = `${box.left}px`;
        wrapper.style.top = `${box.top}px`;
        if (box.frame) {
          wrapper.style.width = `${box.frame.frameWidth}px`;
          wrapper.style.height = `${box.frame.frameHeight}px`;
          wrapper.classList.add('rv-attachment-photo--framed');
        } else {
          wrapper.style.width = `${box.width}px`;
          wrapper.style.height = `${box.height}px`;
          wrapper.classList.remove('rv-attachment-photo--framed');
        }
      };

      const onMove = (moveEvent) => {
        lastClientX = moveEvent.clientX;
        lastClientY = moveEvent.clientY;
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (!moved && dist < PHOTO_MOVE_THRESHOLD_PX) {
          return;
        }
        if (deferRelocateUi && !relocateUiLive) {
          beginRelocateUi();
        }
        if (!relocateUiLive) return;
        movePagePhotoDragGhost(ghost, lastClientX, lastClientY);
        autoScrollAlbumDuringDrag(scrollHost, moveEvent.clientX, moveEvent.clientY);
        const scrollDx = (scrollHost.scrollLeft || 0) - scrollLeft0;
        const scrollDy = (scrollHost.scrollTop || 0) - scrollTop0;
        const dx = (moveEvent.clientX - startX) / zoomScale + scrollDx;
        const dy = (moveEvent.clientY - startY) / zoomScale + scrollDy;
        moved = true;
        let nextLeft = Math.max(0, Math.round(originLeft + dx));
        let nextTop = Math.max(0, Math.round(originTop + dy));
        overReturnZone = isPointerOverStagingReturnZone(lastClientX, lastClientY);
        setStagingReturnHover(overReturnZone);
        const ctx = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME] || {};
        // While aiming at the tray, do not snap back into a slot.
        const snap = overReturnZone
          ? null
          : ctx.findPhotoSnap?.({
              left: nextLeft,
              top: nextTop,
              width: startWidth,
              height: startHeight
            });
        if (snap) {
          const fit = fitSizeForFrame(aspect, snap.width, snap.height, 'contain');
          const pan = centeredPan(fit.width, fit.height, snap.width, snap.height);
          latest = {
            left: snap.left,
            top: snap.top,
            width: fit.width,
            height: fit.height,
            panX: pan.panX,
            panY: pan.panY,
            slotFit: 'contain',
            frame: {
              frameLeft: snap.left,
              frameTop: snap.top,
              frameWidth: snap.width,
              frameHeight: snap.height
            }
          };
        } else {
          latest = {
            left: nextLeft,
            top: nextTop,
            width: startWidth,
            height: startHeight,
            panX: 0,
            panY: 0,
            frame: null
          };
          ctx.clearPhotoSnapHighlight?.();
        }
        applyFreeBox(latest);
        expandAlbumCanvas(
          pm,
          latest.left,
          latest.top,
          latest.frame?.frameWidth || latest.width,
          latest.frame?.frameHeight || latest.height
        );
        setDragPos(latest);
      };

      const onUp = () => {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        removePagePhotoDragGhost(ghost);
        setStagingReturnHover(false);
        // No drag past threshold — leave / restore photo; keep dblclick available.
        if (!moved) {
          if (relocateUiLive) {
            wrapper.classList.remove('is-moving');
            wrapper.style.zIndex = '2';
            wrapper.style.opacity = '';
            restoreHomePlacement();
          }
          setDragPos(null);
          setIsMoving(false);
          return;
        }
        wrapper.classList.remove('is-moving');
        wrapper.style.zIndex = '2';
        wrapper.style.opacity = '';
        const ctx = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME] || {};
        ctx.clearPhotoSnapHighlight?.();

        overReturnZone = isPointerOverStagingReturnZone(lastClientX, lastClientY);
        // Drop onto the yellow thumbnail row → same as Reset (text/emoji stay with the photo).
        if (overReturnZone && moved) {
          const returned = ctx.returnAttachmentToStaging?.({
            attachmentId: node?.attrs?.attachmentId,
            fileName: node?.attrs?.fileName,
            fileExtension: node?.attrs?.fileExtension,
            fileSizeBytes: node?.attrs?.fileSizeBytes,
            checksum: node?.attrs?.checksum,
            _photoRect: photoPageRectFromAttrs(node?.attrs)
          });
          if (!returned) {
            const photoRect = photoPageRectFromAttrs(node?.attrs);
            const companionLabels = photoRect ? detachTextAndEmojiNearPhoto(editor, photoRect) : [];
            ctx.pushStagingPhoto?.({
              attachmentId: node?.attrs?.attachmentId,
              fileName: node?.attrs?.fileName,
              fileExtension: node?.attrs?.fileExtension,
              fileSizeBytes: node?.attrs?.fileSizeBytes,
              checksum: node?.attrs?.checksum,
              companionLabels
            });
            deleteNode?.();
          }
          setDragPos(null);
          setIsMoving(false);
          return;
        }

        // Prefer the slot already snapped during drag. Re-query using the *start*
        // tile size (not cover size) so the photo center is not shifted off-slot.
        let final = latest;
        if (!final.frame) {
          const snap = ctx.findPhotoSnap?.({
            left: final.left,
            top: final.top,
            width: startWidth,
            height: startHeight
          });
          if (snap) {
            const fit = fitSizeForFrame(aspect, snap.width, snap.height, 'contain');
            const pan = centeredPan(fit.width, fit.height, snap.width, snap.height);
            final = {
              left: snap.left,
              top: snap.top,
              width: fit.width,
              height: fit.height,
              panX: pan.panX,
              panY: pan.panY,
              slotFit: 'contain',
              frame: {
                frameLeft: snap.left,
                frameTop: snap.top,
                frameWidth: snap.width,
                frameHeight: snap.height
              }
            };
          }
        }
        latest = final;
        applyFreeBox(final);

        if (final.frame) {
          const f = final.frame;
          const nextFit = final.slotFit === 'cover' ? 'cover' : 'contain';
          const selfPos = typeof getPos === 'function' ? getPos() : null;
          const targetFrame = {
            left: f.frameLeft,
            top: f.frameTop,
            width: f.frameWidth,
            height: f.frameHeight
          };
          const sameHome =
            homeFrame &&
            Math.abs(homeFrame.left - targetFrame.left) <= 6 &&
            Math.abs(homeFrame.top - targetFrame.top) <= 6 &&
            Math.abs(homeFrame.width - targetFrame.width) <= 6 &&
            Math.abs(homeFrame.height - targetFrame.height) <= 6;

          // Dropped back on the same slot (or never left) — restore pan/zoom unchanged.
          if (sameHome) {
            restoreHomePlacement();
            return;
          }

          const other =
            homeFrame && typeof selfPos === 'number'
              ? findFramedPhotoInFrame(editor?.state, targetFrame, selfPos)
              : null;

          if (other && homeFrame && typeof selfPos === 'number' && editor?.view) {
            const myAspect = photoAspectRatio(imgEl, livePhotoW || displayWidth, livePhotoH || displayHeight);
            const otherAspect = aspectFromAttachmentNode(other.node, myAspect);
            // Preserve each photo’s pan & zoom % into the other slot (not a fresh contain/cover).
            const myAttrs = transferFramedPanZoomToSlot({
              aspect: myAspect,
              photoW: livePhotoW || displayWidth || node?.attrs?.width,
              photoH: livePhotoH || displayHeight || node?.attrs?.height,
              panX: livePanX,
              panY: livePanY,
              slotFit: node?.attrs?.slotFit,
              rotationDeg: node?.attrs?.rotationDeg,
              fromFrameW: homeFrame.width,
              fromFrameH: homeFrame.height,
              toFrameLeft: targetFrame.left,
              toFrameTop: targetFrame.top,
              toFrameW: targetFrame.width,
              toFrameH: targetFrame.height
            });
            const otherAttrs = transferFramedPanZoomToSlot({
              aspect: otherAspect,
              photoW: other.node.attrs.width,
              photoH: other.node.attrs.height,
              panX: other.node.attrs.panX,
              panY: other.node.attrs.panY,
              slotFit: other.node.attrs.slotFit,
              rotationDeg: other.node.attrs.rotationDeg,
              fromFrameW: other.fw,
              fromFrameH: other.fh,
              toFrameLeft: homeFrame.left,
              toFrameTop: homeFrame.top,
              toFrameW: homeFrame.width,
              toFrameH: homeFrame.height
            });
            const { state, dispatch } = editor.view;
            // Text/emoji on each photo move with that photo to the other slot.
            const myLabels = listTextAndEmojiNearPhoto(state, homeFrame);
            const myLabelPos = new Set(myLabels.map((l) => l.pos));
            const otherLabels = listTextAndEmojiNearPhoto(state, targetFrame).filter(
              (l) => !myLabelPos.has(l.pos)
            );
            let tr = state.tr;
            // Higher pos first so earlier positions stay valid.
            const updates =
              other.pos > selfPos
                ? [
                    [other.pos, otherAttrs],
                    [selfPos, myAttrs]
                  ]
                : [
                    [selfPos, myAttrs],
                    [other.pos, otherAttrs]
                  ];
            for (const [pos, attrs] of updates) {
              const current = tr.doc.nodeAt(pos);
              if (!current || current.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) continue;
              tr = tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs });
            }
            tr = applyCompanionLabelMovesToTr(tr, myLabels, targetFrame);
            tr = applyCompanionLabelMovesToTr(tr, otherLabels, homeFrame);
            dispatch(tr);
            expandAlbumCanvas(pm, f.frameLeft, f.frameTop, f.frameWidth, f.frameHeight);
            setDragPos({
              left: f.frameLeft,
              top: f.frameTop,
              width: myAttrs.width,
              height: myAttrs.height,
              panX: myAttrs.panX,
              panY: myAttrs.panY,
              frame: f,
              mode: 'frame'
            });
            setIsMoving(false);
          } else if (homeFrame) {
            // Empty other slot — keep this photo’s pan & zoom; text/emoji come along.
            const myAspect = photoAspectRatio(imgEl, livePhotoW || displayWidth, livePhotoH || displayHeight);
            const movedAttrs = transferFramedPanZoomToSlot({
              aspect: myAspect,
              photoW: livePhotoW || displayWidth || node?.attrs?.width,
              photoH: livePhotoH || displayHeight || node?.attrs?.height,
              panX: livePanX,
              panY: livePanY,
              slotFit: node?.attrs?.slotFit,
              rotationDeg: node?.attrs?.rotationDeg,
              fromFrameW: homeFrame.width,
              fromFrameH: homeFrame.height,
              toFrameLeft: targetFrame.left,
              toFrameTop: targetFrame.top,
              toFrameW: targetFrame.width,
              toFrameH: targetFrame.height
            });
            const myLabels = editor?.state
              ? listTextAndEmojiNearPhoto(editor.state, homeFrame)
              : [];
            if (editor?.view && typeof selfPos === 'number') {
              let tr = editor.state.tr;
              const current = tr.doc.nodeAt(selfPos);
              if (current?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
                tr = tr.setNodeMarkup(selfPos, undefined, { ...current.attrs, ...movedAttrs });
              }
              tr = applyCompanionLabelMovesToTr(tr, myLabels, targetFrame);
              editor.view.dispatch(tr);
            } else {
              commitAttrs(movedAttrs);
              if (myLabels.length && editor?.view) {
                let tr = editor.state.tr;
                tr = applyCompanionLabelMovesToTr(tr, myLabels, targetFrame);
                editor.view.dispatch(tr);
              }
            }
            expandAlbumCanvas(pm, f.frameLeft, f.frameTop, f.frameWidth, f.frameHeight);
            setDragPos({
              left: f.frameLeft,
              top: f.frameTop,
              width: movedAttrs.width,
              height: movedAttrs.height,
              panX: movedAttrs.panX,
              panY: movedAttrs.panY,
              frame: f,
              mode: 'frame'
            });
            setIsMoving(false);
          } else {
            if (!homeFrame && typeof selfPos === 'number') {
              const occupant = findFramedPhotoInFrame(editor?.state, targetFrame, selfPos);
              if (occupant) {
                ctx.returnAttachmentToStaging?.({
                  attachmentId: occupant.node.attrs.attachmentId,
                  fileName: occupant.node.attrs.fileName,
                  fileExtension: occupant.node.attrs.fileExtension,
                  fileSizeBytes: occupant.node.attrs.fileSizeBytes,
                  checksum: occupant.node.attrs.checksum,
                  _photoRect: {
                    left: occupant.fl,
                    top: occupant.ft,
                    width: occupant.fw,
                    height: occupant.fh
                  }
                });
              }
            }
            commitAttrs({
              posLeft: f.frameLeft,
              posTop: f.frameTop,
              width: final.width,
              height: final.height,
              panX: final.panX,
              panY: final.panY,
              frameLeft: f.frameLeft,
              frameTop: f.frameTop,
              frameWidth: f.frameWidth,
              frameHeight: f.frameHeight,
              slotFit: nextFit
            });
            expandAlbumCanvas(pm, f.frameLeft, f.frameTop, f.frameWidth, f.frameHeight);
            setDragPos({
              left: f.frameLeft,
              top: f.frameTop,
              width: final.width,
              height: final.height,
              panX: final.panX,
              panY: final.panY,
              frame: f,
              mode: 'frame'
            });
            setIsMoving(false);
          }
        } else if (restoreFrame) {
          // Dragged off slots / not onto tray — cancel; keep original pan & zoom.
          restoreHomePlacement();
        } else {
          commitAttrs({
            posLeft: final.left,
            posTop: final.top,
            width: final.width,
            height: final.height,
            panX: null,
            panY: null,
            frameLeft: null,
            frameTop: null,
            frameWidth: null,
            frameHeight: null,
            slotFit: null
          });
          expandAlbumCanvas(pm, final.left, final.top, final.width, final.height);
          setDragPos(null);
          setIsMoving(false);
        }
        ctx.clearPhotoSnapHighlight?.();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [
      editable,
      editActive,
      inFrame,
      frameLeft,
      frameTop,
      frameWidth,
      frameHeight,
      livePhotoW,
      livePhotoH,
      livePanX,
      livePanY,
      placedLeft,
      placedTop,
      displayWidth,
      displayHeight,
      commitAttrs,
      editor,
      getPos,
      deleteNode,
      node?.attrs?.attachmentId,
      node?.attrs?.fileName,
      node?.attrs?.fileExtension,
      node?.attrs?.fileSizeBytes,
      node?.attrs?.checksum,
      node?.attrs?.slotFit,
      panEnabled
    ]
  );

  // Clear transient dragPos after free-place / frame attrs catch up.
  // Clearing a snapped frame preview too early sizes the tile to cover-width
  // without the clipping window (photo "blows up" on mouseup).
  useEffect(() => {
    if (!dragPos) return undefined;
    if (dragPos.mode === 'frame' || dragPos.frame) {
      const fw = dragPos.frame?.frameWidth;
      const fh = dragPos.frame?.frameHeight;
      if (
        inFrame &&
        frameWidth === fw &&
        frameHeight === fh &&
        displayWidth === dragPos.width &&
        displayHeight === dragPos.height
      ) {
        setDragPos(null);
      }
      return undefined;
    }
    if (placedLeft === dragPos.left && placedTop === dragPos.top) {
      setDragPos(null);
    }
    return undefined;
  }, [
    dragPos,
    placedLeft,
    placedTop,
    inFrame,
    frameWidth,
    frameHeight,
    displayWidth,
    displayHeight
  ]);

  // Ensure saved placements past the viewport still expand the scrollable page.
  useEffect(() => {
    if (!isPhoto || placedLeft == null || placedTop == null) return undefined;
    const tile = tileRef.current;
    const pm = tile?.closest?.('.ProseMirror');
    if (!pm) return undefined;
    const w = displayWidth || tile?.offsetWidth || 220;
    const h = tile?.offsetHeight || 160;
    expandAlbumCanvas(pm, placedLeft, placedTop, w, h);
    return undefined;
  }, [isPhoto, placedLeft, placedTop, displayWidth, thumbUrl]);

  useEffect(() => {
    if (!isAlbumSlotMedia || !editor) return undefined;
    // Path A: skip blob fetch for pages outside active ±1 window.
    if (!shouldLoadPhotoBlob) {
      const prev = String(thumbUrlRef.current || '');
      if (prev.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          // ignore
        }
      }
      setThumbUrl('');
      setThumbLoading(false);
      setThumbLoadError('');
      vaultThumbReadyRef.current = false;
      vaultThumbAttachmentIdRef.current = null;
      thumbUrlRef.current = '';
      return undefined;
    }
    if (
      vaultThumbAttachmentIdRef.current != null &&
      vaultThumbAttachmentIdRef.current !== attachmentId
    ) {
      const prev = String(thumbUrlRef.current || '');
      if (prev.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          // ignore
        }
      }
      vaultThumbReadyRef.current = false;
      vaultThumbAttachmentIdRef.current = null;
      thumbUrlRef.current = '';
    }

    // Vault blob already decoded for this attachment — ignore fit / band churn.
    if (
      vaultThumbReadyRef.current &&
      vaultThumbAttachmentIdRef.current === attachmentId &&
      String(thumbUrlRef.current || '').trim()
    ) {
      setThumbLoading(false);
      return undefined;
    }

    let cancelled = false;
    let ownedObjectUrl = '';
    let attempts = 0;
    let retryTimer = null;

    const clearRetry = () => {
      if (retryTimer != null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const detailCtx = (ctx = {}) => ({
      fileName: label,
      attachmentId,
      noteId: Number(ctx.noteId),
      sharedAlbumId: Number(ctx.sharedAlbumId),
      storageType: ctx.storageType
    });

    const tryLoad = async () => {
      if (cancelled) return;
      const ctx = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME] || {};
      const sharedAlbumId = Number(ctx.sharedAlbumId);
      const noteId = Number(ctx.noteId);
      if (
        (!Number.isFinite(sharedAlbumId) || sharedAlbumId < 1) &&
        (!Number.isFinite(noteId) || noteId < 1)
      ) {
        if (attempts++ < 40) {
          retryTimer = setTimeout(() => {
            void tryLoad();
          }, 100);
        } else {
          if (!cancelled) {
            setThumbLoading(false);
            setThumbUrl('');
            setThumbLoadError(
              formatPhotoThumbLoadError(
                { message: 'Album note id was not ready — cannot load photo' },
                detailCtx(ctx)
              )
            );
          }
        }
        return;
      }
      if (!Number.isFinite(attachmentId) || attachmentId < 1) {
        if (!cancelled) {
          setThumbLoading(false);
          setThumbUrl('');
          setThumbLoadError(
            formatPhotoThumbLoadError(
              { message: 'Invalid or missing attachment id on this photo slot' },
              detailCtx(ctx)
            )
          );
        }
        return;
      }

      // Prefetched *_1000px or tray cache while vault blob fetch runs.
      const displayCached = String(
        getAttachmentVariantPreview(noteId, attachmentId, 'display') || ''
      ).trim();
      const stagedPreview = String(
        displayCached || getStagingAttachmentPreview(attachmentId) || ''
      ).trim();
      if (stagedPreview && !cancelled) {
        setThumbUrl(stagedPreview);
        thumbUrlRef.current = stagedPreview;
        setThumbLoadError('');
        setThumbLoading(false);
        if (displayCached) {
          vaultThumbReadyRef.current = true;
          vaultThumbAttachmentIdRef.current = attachmentId;
          return;
        }
      } else if (!cancelled) {
        setThumbLoading(true);
      }

      try {
        const blob =
          Number.isFinite(sharedAlbumId) && sharedAlbumId > 0
            ? await fetchPhotoAlbumsSharedAlbumAttachmentBlob(sharedAlbumId, attachmentId, {
                inline: true,
                variant: isAlbumVideo ? 'full' : 'display'
              })
            : await fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, {
                inline: true,
                storageType: ctx.storageType,
                variant: isAlbumVideo ? 'full' : 'display'
              });
        if (cancelled) return;
        if (!blob) {
          if (!stagedPreview) {
            setThumbUrl('');
            vaultThumbReadyRef.current = false;
            vaultThumbAttachmentIdRef.current = null;
            setThumbLoadError(
              formatPhotoThumbLoadError(
                { message: 'Attachment returned no image data' },
                detailCtx(ctx)
              )
            );
          }
          return;
        }
        if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
        ownedObjectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setThumbUrl(ownedObjectUrl);
          thumbUrlRef.current = ownedObjectUrl;
          vaultThumbReadyRef.current = true;
          vaultThumbAttachmentIdRef.current = attachmentId;
          setThumbLoadError('');
        }
      } catch (err) {
        if (!cancelled && !stagedPreview) {
          setThumbUrl('');
          vaultThumbReadyRef.current = false;
          vaultThumbAttachmentIdRef.current = null;
          setThumbLoadError(formatPhotoThumbLoadError(err, detailCtx(ctx)));
        }
      } finally {
        if (!cancelled) setThumbLoading(false);
      }
    };

    setThumbLoadError('');
    if (!String(thumbUrlRef.current || '').trim()) setThumbLoading(true);
    void tryLoad();

    return () => {
      cancelled = true;
      clearRetry();
      // Keep decoded vault thumbs across effect re-runs (fit/layout churn). Revoke only
      // when Path A unloads the page (shouldLoadPhotoBlob false) via the early branch.
      if (
        ownedObjectUrl &&
        !(vaultThumbReadyRef.current && vaultThumbAttachmentIdRef.current === attachmentId)
      ) {
        URL.revokeObjectURL(ownedObjectUrl);
      }
    };
  }, [
    isAlbumSlotMedia,
    isAlbumVideo,
    attachmentId,
    editor,
    attachmentCtxVersion,
    attachmentNoteId,
    shouldLoadPhotoBlob,
    label
  ]);

  const handleView = useCallback(async () => {
    const ctx = readContext();
    const noteId = Number(ctx.noteId);
    if (!Number.isFinite(noteId) || noteId < 1) return;
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || ctx.busy || viewingId != null) return;
    setError('');

    // Photos: in-app full page view (trim + theme chrome). Other files keep window/native.
    if (isPhoto && typeof openPhotoFullscreen === 'function') {
      openPhotoFullscreen({ attachmentId, slideshow: false });
      return;
    }

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
        await openPhotoAlbumsNoteAttachmentNative(noteId, attachmentId);
        await new Promise((resolve) => setTimeout(resolve, LAUNCH_BUSY_HOLD_MS));
        return;
      } catch (err) {
        if (!isPhotoAlbumsNativeOpenUnsupportedError(err)) {
          setError(readPhotoAlbumsApiError(err, 'Could not open in desktop app'));
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
      await openPhotoAlbumsAttachmentInNewWindow({
        noteId,
        attachment,
        storageType: ctx.storageType,
        win: previewWin
      });
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Could not open file in a new window'));
    } finally {
      setViewingId(null);
      setViewerLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readContext, attachmentId, viewingId, launchesNative, ext, viewKind, isPhoto, openPhotoFullscreen]);

  const openPhotoInNewTab = useCallback(async (existingWin = null) => {
    const ctx = readContext();
    const noteId = Number(ctx.noteId);
    if (!Number.isFinite(noteId) || noteId < 1) return;
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || ctx.busy || viewingId != null) {
      if (existingWin && !existingWin.closed) {
        try {
          existingWin.close();
        } catch {
          // ignore
        }
      }
      return;
    }
    setError('');

    // Must open under the user gesture (no setTimeout). Callers may pass a pre-opened win.
    const previewWin =
      existingWin && !existingWin.closed ? existingWin : window.open('', '_blank');
    if (!previewWin) {
      setError('Pop-up blocked — allow pop-ups to view photos in a new tab');
      return;
    }

    setViewingId(attachmentId);
    setViewerLoading(true);
    try {
      await openPhotoAlbumsAttachmentInNewWindow({
        noteId,
        attachment,
        storageType: ctx.storageType,
        win: previewWin
      });
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Could not open photo in a new tab'));
      try {
        if (!previewWin.closed) previewWin.close();
      } catch {
        // ignore
      }
    } finally {
      setViewingId(null);
      setViewerLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readContext, attachmentId, viewingId, attachment]);

  const cancelScheduledPhotoViewInNewTab = useCallback(() => {
    if (viewModeOpenTimerRef.current) {
      window.clearTimeout(viewModeOpenTimerRef.current);
      viewModeOpenTimerRef.current = null;
    }
    const pending = pendingPreviewWinRef.current;
    pendingPreviewWinRef.current = null;
    if (pending && !pending.closed) {
      try {
        pending.close();
      } catch {
        // ignore
      }
    }
  }, []);

  const openPhotoEditPopup = useCallback(() => {
    if (!editable) {
      cancelScheduledPhotoViewInNewTab();
      void openPhotoInNewTab();
      return;
    }
    cancelScheduledPhotoViewInNewTab();
    selectThisPhoto();
    // Double-click opens Add Text (Pan Zoom / Rotate / Full / Zoom live there).
    const openPlaceText = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.openPlaceText;
    if (typeof openPlaceText !== 'function') return;
    const baseLeft = inFrame ? frameLeft : placedLeft;
    const baseTop = inFrame ? frameTop : placedTop;
    const posLeft =
      Number.isFinite(baseLeft) && Number.isFinite(frameWidth)
        ? Math.round(baseLeft + Math.max(8, frameWidth * 0.08))
        : Number.isFinite(baseLeft)
          ? Math.round(baseLeft + 12)
          : undefined;
    const posTop =
      Number.isFinite(baseTop) && Number.isFinite(frameHeight)
        ? Math.round(baseTop + Math.max(8, frameHeight * 0.08))
        : Number.isFinite(baseTop)
          ? Math.round(baseTop + 12)
          : undefined;
    openPlaceText(
      Number.isFinite(posLeft) && Number.isFinite(posTop) ? { posLeft, posTop } : null
    );
  }, [
    editable,
    cancelScheduledPhotoViewInNewTab,
    openPhotoInNewTab,
    selectThisPhoto,
    editor,
    inFrame,
    frameLeft,
    frameTop,
    placedLeft,
    placedTop,
    frameWidth,
    frameHeight
  ]);

  const schedulePhotoViewInNewTab = useCallback(
    (event) => {
      if (!photoViewModeActive || isAlbumVideo) return;
      if (thumbLoadError && !thumbLoading) return;
      if (event.target?.closest?.('.rv-photo-tile__actions, .rv-photo-tile__choice-menu, .rv-attachment-photo__return-x, .rv-attachment-photo__top-chrome, button')) {
        return;
      }
      if (event.target?.closest?.('.rv-album-video-indicator')) return;
      cancelScheduledPhotoViewInNewTab();
      // Open immediately while the click is still a trusted gesture — browsers block
      // window.open() after setTimeout (that was causing “Pop-up blocked”).
      const previewWin = window.open('', '_blank');
      if (!previewWin) {
        setError('Pop-up blocked — allow pop-ups to view photos in a new tab');
        return;
      }
      pendingPreviewWinRef.current = previewWin;
      viewModeOpenTimerRef.current = window.setTimeout(() => {
        viewModeOpenTimerRef.current = null;
        const win = pendingPreviewWinRef.current;
        pendingPreviewWinRef.current = null;
        void openPhotoInNewTab(win);
      }, 280);
    },
    [
      photoViewModeActive,
      isAlbumVideo,
      thumbLoadError,
      thumbLoading,
      cancelScheduledPhotoViewInNewTab,
      openPhotoInNewTab
    ]
  );

  const playAlbumVideoInViewMode = useCallback(() => {
    const el = albumVideoRef.current;
    if (!el) {
      void openPhotoInNewTab();
      return;
    }
    el.controls = true;
    if (el.paused) {
      // Keep a gesture-backed tab ready if autoplay/play is blocked (async catch loses gesture).
      const fallbackWin = window.open('', '_blank');
      void el.play().then(
        () => {
          if (fallbackWin && !fallbackWin.closed) {
            try {
              fallbackWin.close();
            } catch {
              // ignore
            }
          }
        },
        () => {
          void openPhotoInNewTab(fallbackWin);
        }
      );
    } else {
      el.pause();
    }
  }, [openPhotoInNewTab]);

  const openMediaInNewTabFromIndicator = useCallback(
    (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      cancelScheduledPhotoViewInNewTab();
      void openPhotoInNewTab();
    },
    [cancelScheduledPhotoViewInNewTab, openPhotoInNewTab]
  );

  const handleAlbumVideoViewClick = useCallback(
    (event) => {
      if (!photoViewModeActive || !isAlbumVideo) return;
      if (event.target?.closest?.('.rv-photo-tile__actions, .rv-attachment-photo__return-x, .rv-attachment-photo__top-chrome, button')) return;
      event.preventDefault();
      event.stopPropagation();
      cancelScheduledPhotoViewInNewTab();
      playAlbumVideoInViewMode();
    },
    [photoViewModeActive, isAlbumVideo, cancelScheduledPhotoViewInNewTab, playAlbumVideoInViewMode]
  );

  /** Native video “fullscreen / expand” control → open playback in a new browser tab (edit mode only). */
  useEffect(() => {
    if (photoViewModeActive || !isAlbumVideo || !thumbUrl) return undefined;
    const el = albumVideoRef.current;
    if (!el) return undefined;

    const openInNewTab = () => {
      // Stay in the same turn as the fullscreen click so window.open is not blocked.
      void openPhotoInNewTab();
    };

    const rejectFs = () => {
      openInNewTab();
      return Promise.reject(new DOMException('Fullscreen diverted to a new tab', 'AbortError'));
    };

    const origRequestFullscreen = el.requestFullscreen?.bind(el);
    const origWebkitRequestFullscreen = el.webkitRequestFullscreen?.bind(el);
    const origWebkitEnterFullscreen = el.webkitEnterFullscreen?.bind(el);
    const origMozRequestFullScreen = el.mozRequestFullScreen?.bind(el);

    if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen = rejectFs;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen = rejectFs;
    }
    if (typeof el.mozRequestFullScreen === 'function') {
      el.mozRequestFullScreen = rejectFs;
    }
    // Safari iOS uses webkitEnterFullscreen on HTMLVideoElement.
    if (typeof el.webkitEnterFullscreen === 'function') {
      el.webkitEnterFullscreen = () => {
        openInNewTab();
      };
    }

    const divertIfEntered = () => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        null;
      if (fsEl !== el) return;
      const exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen;
      try {
        exit?.call(document);
      } catch {
        // ignore
      }
      openInNewTab();
    };

    document.addEventListener('fullscreenchange', divertIfEntered);
    document.addEventListener('webkitfullscreenchange', divertIfEntered);
    el.addEventListener('webkitbeginfullscreen', openInNewTab);

    return () => {
      document.removeEventListener('fullscreenchange', divertIfEntered);
      document.removeEventListener('webkitfullscreenchange', divertIfEntered);
      el.removeEventListener('webkitbeginfullscreen', openInNewTab);
      if (origRequestFullscreen) el.requestFullscreen = origRequestFullscreen;
      if (origWebkitRequestFullscreen) el.webkitRequestFullscreen = origWebkitRequestFullscreen;
      if (origMozRequestFullScreen) el.mozRequestFullScreen = origMozRequestFullScreen;
      if (origWebkitEnterFullscreen) el.webkitEnterFullscreen = origWebkitEnterFullscreen;
    };
  }, [photoViewModeActive, isAlbumVideo, thumbUrl, openPhotoInNewTab]);

  const handleDownload = useCallback(async () => {
    const ctx = readContext();
    const noteId = Number(ctx.noteId);
    if (!Number.isFinite(noteId) || noteId < 1) return;
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || downloading) return;
    setError('');
    setDownloading(true);
    try {
      await downloadPhotoAlbumsNoteAttachment(noteId, attachmentId, label, {
        storageType: ctx.storageType
      });
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Download failed'));
    } finally {
      setDownloading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readContext, attachmentId, downloading, label]);

  const handleRemove = useCallback(async () => {
    const ctx = readContext();
    if (removing || ctx.busy) return;
    setError('');

    // Photos on the page: return to thumbnail alley (cloud/USB storage kept) — not a permanent delete.
    // Text/emoji on the photo stay attached to the thumbnail and come back when re-placed.
    if (isAlbumSlotMedia) {
      const returned = ctx.returnAttachmentToStaging?.({
        attachmentId,
        fileName: node?.attrs?.fileName,
        fileExtension: node?.attrs?.fileExtension,
        fileSizeBytes: node?.attrs?.fileSizeBytes,
        checksum: node?.attrs?.checksum,
        companionLabels: undefined,
        _photoRect: photoPageRectFromAttrs(node?.attrs)
      });
      if (!returned) {
        const photoRect = photoPageRectFromAttrs(node?.attrs);
        const companionLabels = photoRect ? detachTextAndEmojiNearPhoto(editor, photoRect) : [];
        ctx.pushStagingPhoto?.({
          attachmentId,
          fileName: node?.attrs?.fileName,
          fileExtension: node?.attrs?.fileExtension,
          fileSizeBytes: node?.attrs?.fileSizeBytes,
          checksum: node?.attrs?.checksum,
          companionLabels
        });
        deleteNode();
      }
      setPanEnabled(false);
      return;
    }

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
      setError(readPhotoAlbumsApiError(err, 'Failed to remove vault file'));
    } finally {
      setRemoving(false);
    }
  }, [readContext, removing, attachmentId, deleteNode, isAlbumSlotMedia, node?.attrs, editor, label]);

  /** Full = contain (entire photo visible); Zoom = cover (fill slot, may clip). */
  const applySlotFit = useCallback(
    (mode) => {
      if (!editable || !inFrame || frameWidth == null || frameHeight == null) return;
      const nextFit = normalizeSlotFit(mode);
      const tile = tileRef.current;
      const imgEl = tile?.querySelector?.('img');
      const aspect = photoAspectRatio(
        imgEl,
        livePhotoW || displayWidth || frameWidth,
        livePhotoH || displayHeight || frameHeight
      );
      const fit = fitSizeForFrame(aspect, frameWidth, frameHeight, nextFit);
      const pan = centeredPan(fit.width, fit.height, frameWidth, frameHeight);
      commitAttrs({
        posLeft: frameLeft,
        posTop: frameTop,
        width: fit.width,
        height: fit.height,
        panX: pan.panX,
        panY: pan.panY,
        frameLeft,
        frameTop,
        frameWidth,
        frameHeight,
        slotFit: nextFit
      });
    },
    [
      editable,
      inFrame,
      frameLeft,
      frameTop,
      frameWidth,
      frameHeight,
      livePhotoW,
      livePhotoH,
      displayWidth,
      displayHeight,
      commitAttrs
    ]
  );

  /** Slider zoom 0…100% — 0 = cover fill, 100 = max zoom. */
  const applyFramedZoomPercent = useCallback(
    (pct) => {
      if (!editable || !inFrame || frameWidth == null || frameHeight == null) return;
      const tile = tileRef.current;
      const imgEl = tile?.querySelector?.('img');
      const aspect = photoAspectRatio(
        imgEl,
        livePhotoW || displayWidth || frameWidth,
        livePhotoH || displayHeight || frameHeight
      );
      const nextW = framedWidthFromZoomPercent(pct, aspect, frameWidth, frameHeight);
      const nextH = Math.round(nextW / aspect);
      const cx = frameWidth / 2;
      const cy = frameHeight / 2;
      const startW = Math.max(1, livePhotoW || nextW);
      const startH = Math.max(1, livePhotoH || nextH);
      const relX = (cx - livePanX) / startW;
      const relY = (cy - livePanY) / startH;
      const nextPan = clampPhotoPan(
        cx - relX * nextW,
        cy - relY * nextH,
        nextW,
        nextH,
        frameWidth,
        frameHeight
      );
      commitAttrs({
        width: nextW,
        height: nextH,
        panX: nextPan.panX,
        panY: nextPan.panY,
        slotFit: 'cover'
      });
    },
    [
      editable,
      inFrame,
      frameWidth,
      frameHeight,
      livePhotoW,
      livePhotoH,
      livePanX,
      livePanY,
      displayWidth,
      displayHeight,
      commitAttrs
    ]
  );

  useEffect(() => {
    if (!editActive) {
      setPanEnabled(false);
      return;
    }
    // Add Text Pan Zoom toggle writes dialogPanZoom onto the pinned photo.
    const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (!store || typeof store.dialogPanZoom !== 'boolean') return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (store.pinnedPhotoEditPos !== pos) return;
    setPanEnabled(Boolean(store.dialogPanZoom));
  }, [editActive, editor, getPos, pinnedPhotoEditPos]);

  /** Publish Pan&Zoom ON/OFF so the floating context tutorial can switch copy. */
  useEffect(() => {
    const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
    if (!store || !editor?.view) return;
    const next = Boolean(editActive && panEnabled);
    if (store.selectedPhotoPanZoom === next) return;
    store.selectedPhotoPanZoom = next;
    store.contextTutorialTick = (Number(store.contextTutorialTick) || 0) + 1;
    try {
      editor.view.dispatch(editor.state.tr.setMeta('paContextTutorial', store.contextTutorialTick));
    } catch {
      // view may be unmounted
    }
  }, [editor, editActive, panEnabled]);

  const framedZoomPct = useMemo(() => {
    if (!inFrame || frameWidth == null || frameHeight == null) return 0;
    const tile = tileRef.current;
    const imgEl = tile?.querySelector?.('img');
    const aspect = photoAspectRatio(
      imgEl,
      livePhotoW || displayWidth || frameWidth,
      livePhotoH || displayHeight || frameHeight
    );
    return framedZoomPercentFromWidth(
      livePhotoW || displayWidth || frameWidth,
      aspect,
      frameWidth,
      frameHeight
    );
  }, [
    inFrame,
    frameWidth,
    frameHeight,
    livePhotoW,
    livePhotoH,
    displayWidth,
    displayHeight,
    thumbUrl
  ]);

  const isViewing = viewingId === attachmentId && viewerLoading;

  const pressedOutlineSx = {
    outline: '2px solid #fff',
    outlineOffset: 1
  };

  const openPlaceTextNearThisMedia = useCallback(() => {
    const openPlaceText = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.openPlaceText;
    if (typeof openPlaceText !== 'function') return;
    const baseLeft = inFrame ? frameLeft : placedLeft;
    const baseTop = inFrame ? frameTop : placedTop;
    const posLeft =
      Number.isFinite(baseLeft) && Number.isFinite(frameWidth)
        ? Math.round(baseLeft + Math.max(8, frameWidth * 0.08))
        : Number.isFinite(baseLeft)
          ? Math.round(baseLeft + 12)
          : undefined;
    const posTop =
      Number.isFinite(baseTop) && Number.isFinite(frameHeight)
        ? Math.round(baseTop + Math.max(8, frameHeight * 0.08))
        : Number.isFinite(baseTop)
          ? Math.round(baseTop + 12)
          : undefined;
    openPlaceText(
      Number.isFinite(posLeft) && Number.isFinite(posTop) ? { posLeft, posTop } : null
    );
  }, [editor, inFrame, frameLeft, frameTop, placedLeft, placedTop, frameWidth, frameHeight]);

  const resetMediaActionBtn = editable ? (
    <SliderControlButton
      type="button"
      disabled={removing}
      onClick={() => void handleRemove()}
      title={
        isAlbumSlotMedia
          ? 'Reset — return to the thumbnail alley (not deleted from storage)'
          : 'Remove file'
      }
      aria-label={isAlbumSlotMedia ? `Reset ${label}` : `Remove ${label}`}
      sx={
        isAlbumSlotMedia
          ? photoSlotActionBtnSx
          : {
              ...photoSlotActionBtnSx,
              bgcolor: 'var(--theme-error-color) !important',
              color: '#fff !important',
              WebkitTextFillColor: '#fff !important'
            }
      }
    >
      {removing ? (isAlbumSlotMedia ? 'Resetting…' : 'Removing…') : isAlbumSlotMedia ? 'Reset' : 'Remove'}
    </SliderControlButton>
  ) : null;

  /** Video edit mode: Reset only (Add Text opens via double-click). Photos keep chrome in Add Text. */
  const actionButtons = isAlbumVideo && editable ? (
    <>
      {resetMediaActionBtn}
    </>
  ) : (
    <>
      {isPhoto && editable && inFrame ? (
        <SliderControlButton
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPanEnabled((v) => !v);
          }}
          title="Toggle Pan & Zoom mode — drag to pan; use the yellow slider to zoom"
          aria-label={`Pan Zoom ${label}`}
          aria-pressed={panEnabled}
          sx={{
            ...photoSlotActionBtnSx,
            whiteSpace: 'normal',
            lineHeight: 1.05,
            minWidth: { xs: '2.6rem', sm: '3rem' },
            px: { xs: 0.4, sm: 0.55 },
            ...(panEnabled
              ? {
                  bgcolor: '#FFEB3B !important',
                  color: '#000000 !important',
                  WebkitTextFillColor: '#000000 !important',
                  border: '3px solid #000000 !important',
                  ...panModeYellowBlinkSx,
                  '@media (hover: hover)': {
                    '&:hover:not(:disabled)': {
                      bgcolor: '#FFEB3B !important',
                      color: '#000000 !important',
                      WebkitTextFillColor: '#000000 !important'
                    }
                  }
                }
              : null)
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1.05,
              whiteSpace: 'normal',
              textAlign: 'center'
            }}
          >
            <Box component="span">Pan</Box>
            <Box component="span">Zoom</Box>
          </Box>
        </SliderControlButton>
      ) : null}
      {isPhoto && editable && inFrame ? (
        <SliderControlButton
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            commitAttrs({ rotationDeg: (rotationDeg + 90) % 360 });
          }}
          title="Rotate photo 90° clockwise"
          aria-label={`Rotate ${label} 90 degrees`}
          sx={photoSlotActionBtnSx}
        >
          Rotate
        </SliderControlButton>
      ) : null}
      {editable && inFrame && isPhoto ? (
        <>
          <SliderControlButton
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applySlotFit('contain');
            }}
            title="Show the full original photo inside the slot (may leave white edges)"
            aria-label={`Full fit ${label}`}
            aria-pressed={slotFit === 'contain'}
            sx={{
              ...photoSlotActionBtnSx,
              ...(slotFit === 'contain' ? pressedOutlineSx : null)
            }}
          >
            Full
          </SliderControlButton>
          <SliderControlButton
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applySlotFit('cover');
            }}
            title="Zoom so the photo fills the slot (covers white edges; may clip)"
            aria-label={`Zoom fill ${label}`}
            aria-pressed={slotFit === 'cover'}
            sx={{
              ...photoSlotActionBtnSx,
              ...(slotFit === 'cover' ? pressedOutlineSx : null)
            }}
          >
            Zoom
          </SliderControlButton>
        </>
      ) : null}
      {canView && !isAlbumSlotMedia ? (
        <SliderControlButton
          type="button"
          disabled={isViewing || (viewingId != null && viewingId !== attachmentId)}
          onClick={() => void handleView()}
          aria-label={
            isViewing
              ? launchesNative
                ? `Launching ${label}`
                : `Opening ${label}`
              : `${actionLabel} ${label}`
          }
          sx={photoSlotActionBtnSx}
        >
          {isViewing ? (
            <BusyHourglass fontSize={VIEW_BUTTON_HOURGLASS_SIZE} sx={{ filter: 'none', WebkitFilter: 'none' }} />
          ) : (
            actionLabel
          )}
        </SliderControlButton>
      ) : null}
      {isPhoto || !isAlbumSlotMedia ? resetMediaActionBtn : null}
      {!isAlbumSlotMedia ? (
        <SliderControlButton
          type="button"
          disabled={downloading}
          onClick={() => void handleDownload()}
          sx={photoSlotActionBtnSx}
        >
          {downloading ? 'Downloading…' : 'Download'}
        </SliderControlButton>
      ) : null}
    </>
  );

  if (isAlbumSlotMedia) {
    const framed = inFrame || dragPos?.mode === 'frame' || Boolean(dragPos?.frame);
    const liveFrameW = dragPos?.frame?.frameWidth ?? frameWidth;
    const liveFrameH = dragPos?.frame?.frameHeight ?? frameHeight;
    const photoW = livePhotoW || (framed && liveFrameW ? liveFrameW : null);
    const photoH = livePhotoH || (framed && liveFrameH ? liveFrameH : null);
    const sizedClass = displayWidth || showAsPlaced || framed ? ' rv-attachment-photo--sized' : '';
    const sizeClass = displayWidth || showAsPlaced || framed ? '' : ` rv-attachment-photo--size-${collageSize}`;
    const placedClass = showAsPlaced || framed ? ' rv-attachment-photo--placed' : '';
    const framedClass = framed ? ' rv-attachment-photo--framed' : '';
    const movingClass = isMoving ? ' is-moving' : '';
    const placeStyle = {};
    if (framed && liveFrameW && liveFrameH) {
      // Slot window size is fixed — never follow the zoomed photo width/height.
      placeStyle.width = `${liveFrameW}px`;
      placeStyle.height = `${liveFrameH}px`;
      placeStyle.maxWidth = 'none';
      placeStyle.maxHeight = 'none';
      // Clip the image in .rv-photo-window; keep wrapper visible for top-right filename chrome.
      placeStyle.overflow = 'visible';
    } else if (displayWidth) {
      placeStyle.width = `${displayWidth}px`;
      placeStyle.maxWidth = showAsPlaced ? 'none' : '100%';
      if (photoH) placeStyle.height = `${photoH}px`;
    } else if (showAsPlaced) {
      placeStyle.width = '220px';
      placeStyle.maxWidth = 'none';
    }
    if ((showAsPlaced || framed) && liveLeft != null && liveTop != null) {
      placeStyle.left = `${liveLeft}px`;
      placeStyle.top = `${liveTop}px`;
    }
    if (!onActiveBookPage) {
      placeStyle.display = 'none';
      placeStyle.pointerEvents = 'none';
      placeStyle.visibility = 'hidden';
    }

    const showFileName =
      isAlbumSlotMedia && onActiveBookPage && !isMoving && (nameHover || editActive);
    const showTopRightChrome = showFileName || editable;

    return (
      <NodeViewWrapper
        as="div"
        className={`rv-attachment-node rv-attachment-photo${sizeClass}${sizedClass}${placedClass}${framedClass}${movingClass}${
          editActive ? ' is-selected' : ''
        }${editActive && panEnabled ? ' is-pan-zoom' : ''}`}
        style={Object.keys(placeStyle).length ? placeStyle : undefined}
        draggable={false}
        onDragStart={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseEnter={() => setNameHover(true)}
        onMouseLeave={() => setNameHover(false)}
      >
          <Box
          className="rv-photo-window"
            sx={{
              ...photoWindowSx,
              height: framed ? '100%' : 'auto',
              overflow: framed ? 'hidden' : 'visible',
              borderRadius: framed ? 0 : '6px',
              bgcolor: framed ? '#fff' : undefined,
              // Clip zoomed/panned photo to the fixed slot — never grow with the image.
              ...(framed
                ? {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    zIndex: 1
                  }
                : null)
            }}
            contentEditable={false}
          >
          <Box
            ref={tileRef}
            className="rv-photo-tile"
            sx={{
              ...photoTileSx,
              ...(framed
                ? {
                    position: 'absolute',
                    left: livePanX,
                    top: livePanY,
                    width: photoW || '100%',
                    height: photoH || '100%',
                    overflow: 'hidden',
                    boxShadow: 'none',
                    border: 'none',
                    borderRadius: 0,
                    transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
                    transformOrigin: 'center center'
                  }
                : rotationDeg
                  ? {
                      transform: `rotate(${rotationDeg}deg)`,
                      transformOrigin: 'center center'
                    }
                  : null)
            }}
            onMouseDown={editable ? startPhotoMove : undefined}
            onDragStart={(event) => {
              // Block native browser image drag (huge translucent ghost) always.
              // Relocate/pan uses custom mouse handlers only when selected (edit mode).
              event.preventDefault();
              event.stopPropagation();
            }}
            draggable={false}
            onDoubleClick={(event) => {
              cancelScheduledPhotoViewInNewTab();
              if (event.target?.closest?.('.rv-photo-tile__actions')) return;
              if (event.target?.closest?.('.rv-attachment-photo__return-x, .rv-attachment-photo__top-chrome')) return;
              if (event.target?.closest?.('.rv-attachment-photo__top-chrome')) return;
              if (event.target?.closest?.('.rv-album-video-indicator')) return;
              if (event.target?.closest?.('button')) return;
              event.preventDefault();
              event.stopPropagation();
              openPhotoEditPopup();
            }}
              title={
                editable
                  ? editActive
                    ? isAlbumVideo
                      ? 'Selected · Text and Reset · drag to another slot to swap · drag to thumbnails to return'
                      : framed
                        ? panEnabled
                          ? 'Pan Zoom mode — drag to move the photo inside the slot · use yellow slider to zoom'
                          : 'Selected · drag to another slot to swap · drag to thumbnails to return · double-click to edit'
                        : 'Selected · drag to move · double-click to edit'
                    : 'Double-click to edit photo'
                  : 'Double-click to view full screen'
            }
          >
            {showTopRightChrome ? (
              <Box className="rv-attachment-photo__top-chrome" sx={photoTopRightChromeSx}>
                {showFileName ? (
                  <Typography
                    component="span"
                    className="rv-attachment-photo__name"
                    aria-hidden="true"
                    sx={photoFileNamePlateSx}
                  >
                    {label}
                  </Typography>
                ) : null}
                {editable ? (
                  <ColorTemplate6CloseX
                    className="rv-attachment-photo__return-x"
                    aria-label={`Return ${label} to thumbnail alley`}
                    title="Return photo to thumbnail alley (not deleted from storage)"
                    onClose={(event) => {
                      event?.preventDefault?.();
                      event?.stopPropagation?.();
                      void handleRemove();
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    positionSx={{
                      position: 'static',
                      top: 'auto',
                      right: 'auto',
                      zIndex: 'auto'
                    }}
                    sx={{
                      pointerEvents: 'auto',
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      minHeight: 28,
                      fontSize: '1rem'
                    }}
                  />
                ) : null}
              </Box>
            ) : null}
            {isAlbumVideo ? (
              <PhotoAlbumsVideoIndicator
                size={
                  framed && photoW
                    ? Math.min(32, Math.max(18, Math.round(photoW * 0.14)))
                    : 28
                }
                sx={{ top: 4, left: 4, zIndex: 30 }}
                onClick={
                  editable && editActive && !photoViewModeActive
                    ? openMediaInNewTabFromIndicator
                    : undefined
                }
                title={
                  editable && editActive && !photoViewModeActive
                    ? 'Open video full screen in a new tab'
                    : 'Video'
                }
              />
            ) : null}
            {thumbUrl && isAlbumVideo ? (
              <Box
                component="video"
                ref={albumVideoRef}
                src={thumbUrl}
                playsInline
                preload="metadata"
                draggable={false}
                onDragStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onLoadedMetadata={(event) => {
                  if (!inFrame || frameWidth == null || frameHeight == null) return;
                  if (node?.attrs?.slotFit !== 'contain') return;
                  const vid = event.currentTarget;
                  if (!(vid.videoWidth > 0 && vid.videoHeight > 0)) return;
                  const aspect = vid.videoWidth / vid.videoHeight;
                  const fit = containSizeForFrame(aspect, frameWidth, frameHeight);
                  const pan = centeredPan(fit.width, fit.height, frameWidth, frameHeight);
                  const curW = displayWidth || 0;
                  const curH = displayHeight || 0;
                  if (Math.abs(fit.width - curW) <= 2 && Math.abs(fit.height - curH) <= 2) return;
                  commitAttrs({
                    width: fit.width,
                    height: fit.height,
                    panX: pan.panX,
                    panY: pan.panY,
                    slotFit: 'contain'
                  });
                }}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: framed ? '100%' : 'auto',
                  maxWidth: framed ? 'none' : '100%',
                  objectFit: framed ? 'fill' : 'contain',
                  objectPosition: 'center center',
                  verticalAlign: 'top',
                  WebkitUserDrag: 'none',
                  userSelect: 'none',
                  cursor: editable && (editActive || framed) ? (isMoving ? 'grabbing' : 'grab') : 'default',
                  bgcolor: '#000',
                  borderRadius: framed ? 0 : '6px',
                  pointerEvents: 'auto'
                }}
              />
            ) : thumbUrl ? (
              <Box
                component="img"
                src={thumbUrl}
                alt={label}
                draggable={false}
                onDragStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onError={() => {
                  const ctx = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME] || {};
                  setThumbUrl('');
                  setThumbLoadError(
                    formatPhotoThumbLoadError(
                      { message: 'Browser could not display the image data (decode failed)' },
                      {
                        fileName: label,
                        attachmentId,
                        noteId: Number(ctx.noteId),
                        sharedAlbumId: Number(ctx.sharedAlbumId),
                        storageType: ctx.storageType
                      }
                    )
                  );
                }}
                onLoad={(event) => {
                  if (!inFrame || frameWidth == null || frameHeight == null) return;
                  if (node?.attrs?.slotFit !== 'contain') return;
                  const img = event.currentTarget;
                  if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) return;
                  const aspect = img.naturalWidth / img.naturalHeight;
                  const fit = containSizeForFrame(aspect, frameWidth, frameHeight);
                  const pan = centeredPan(fit.width, fit.height, frameWidth, frameHeight);
                  const curW = displayWidth || 0;
                  const curH = displayHeight || 0;
                  if (Math.abs(fit.width - curW) <= 2 && Math.abs(fit.height - curH) <= 2) return;
                  commitAttrs({
                    width: fit.width,
                    height: fit.height,
                    panX: pan.panX,
                    panY: pan.panY,
                    slotFit: 'contain'
                  });
                }}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: framed ? '100%' : 'auto',
                  maxWidth: framed ? 'none' : '100%',
                  objectFit: framed ? 'fill' : 'contain',
                  objectPosition: 'center center',
                  verticalAlign: 'top',
                  WebkitUserDrag: 'none',
                  userSelect: 'none',
                  cursor: editable
                    ? editActive
                      ? isMoving
                        ? 'grabbing'
                        : 'grab'
                      : framed
                        ? isMoving
                          ? 'grabbing'
                          : 'grab'
                        : 'default'
                    : 'default',
                  bgcolor: '#fff',
                  borderRadius: framed ? 0 : '6px',
                  pointerEvents: 'auto'
                }}
              />
            ) : (
              <Box
                role={thumbLoadError && !thumbLoading ? 'button' : undefined}
                tabIndex={thumbLoadError && !thumbLoading ? 0 : undefined}
                aria-label={
                  thumbLoadError && !thumbLoading
                    ? `Photo failed to load: ${label}. Click for error details.`
                    : undefined
                }
                title={
                  thumbLoadError && !thumbLoading
                    ? 'Photo is blank — click for error details'
                    : undefined
                }
                data-photo-load-failed={thumbLoadError && !thumbLoading ? '1' : undefined}
                onClick={(event) => {
                  if (!thumbLoadError || thumbLoading) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setPhotoErrorPopupOpen(true);
                }}
                onKeyDown={(event) => {
                  if (!thumbLoadError || thumbLoading) return;
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  event.stopPropagation();
                  setPhotoErrorPopupOpen(true);
                }}
                onMouseDown={(event) => {
                  // Keep click-for-details from starting relocate drag.
                  if (thumbLoadError && !thumbLoading) event.stopPropagation();
                }}
                sx={{
                  minHeight: framed ? '100%' : 120,
                  height: framed ? '100%' : 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 2,
                  boxSizing: 'border-box',
                  border:
                    thumbLoadError && !thumbLoading
                      ? '2px dashed var(--theme-error-color, #c62828)'
                      : '2px dashed transparent',
                  bgcolor:
                    thumbLoadError && !thumbLoading ? 'rgba(198, 40, 40, 0.06)' : 'transparent',
                  cursor: thumbLoadError && !thumbLoading
                    ? 'pointer'
                    : editable && editActive
                      ? 'grab'
                      : 'default'
                }}
              >
                {thumbLoading ? (
                  <BusyHourglass fontSize={{ xs: '1.4rem', sm: '1.6rem' }} />
                ) : (
                  <>
                    <Typography
                      sx={{
                        color: thumbLoadError ? 'var(--theme-error-color, #c62828)' : '#555',
                        fontSize: '0.85rem',
                        textAlign: 'center',
                        fontWeight: thumbLoadError ? 700 : 400
                      }}
                    >
                      {label}
                    </Typography>
                    {thumbLoadError ? (
                      <Typography
                        sx={{
                          color: 'var(--theme-error-color, #c62828)',
                          fontSize: '0.72rem',
                          textAlign: 'center',
                          fontWeight: 700
                        }}
                      >
                        Blank photo — click for error details
                      </Typography>
                    ) : null}
                  </>
                )}
              </Box>
            )}
          </Box>
          {editable && framed && editActive && panEnabled ? (
            <Box
              className="rv-photo-slot-pan-instruction"
              aria-hidden
              sx={{
                ...panModeInstructionBannerSx,
                ...panModeYellowBlinkSx
              }}
            >
              {PAN_MODE_INSTRUCTION}
            </Box>
          ) : null}
          {editActive && editable && framed && panEnabled ? (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                pointerEvents: 'none',
                px: 1
              }}
            >
              <Typography
                component="div"
                sx={{
                  fontFamily: 'Algerian, fantasy',
                  fontWeight: 900,
                  fontSize: { xs: '1.05rem', sm: '1.35rem' },
                  lineHeight: 1.15,
                  color: '#FFEB3B',
                  WebkitTextFillColor: '#FFEB3B',
                  WebkitTextStroke: '1.5px #000000',
                  paintOrder: 'stroke fill',
                  textShadow: '0 1px 0 #000, 0 0 3px #000',
                  textAlign: 'center',
                  ...panModeYellowBlinkSx
                }}
              >
                Pan & Zoom Mode
              </Typography>
              <Box
                component="svg"
                viewBox="0 0 100 100"
                sx={{ width: { xs: 64, sm: 88 }, height: 'auto', opacity: 0.95 }}
              >
                <g fill="#FFEB3B" stroke="#000000" strokeWidth={2}>
                  <path d="M 50 6 L 64 30 L 36 30 Z" />
                  <path d="M 50 94 L 36 70 L 64 70 Z" />
                  <path d="M 6 50 L 30 36 L 30 64 Z" />
                  <path d="M 94 50 L 70 36 L 70 64 Z" />
                </g>
              </Box>
            </Box>
          ) : null}
          <Box
            className="rv-photo-tile__actions"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              zIndex: 5,
              display: 'none'
            }}
          />
          {/* Edit controls live in Add Text (double-click). */}
          {false ? (
          <Box
            className="rv-photo-tile__actions"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              boxSizing: 'border-box',
              bgcolor: panEnabled ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.55)',
              border: panEnabled ? '3px solid #FFEB3B' : '3px solid transparent',
              ...(panEnabled ? panModeFrameBlinkSx : null),
              opacity: editActive ? 1 : 0,
              pointerEvents: editActive ? 'auto' : 'none',
              transition: 'opacity 0.15s ease, border-color 0.15s ease'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'stretch',
                justifyContent: 'stretch',
                gap: 0.4,
                px: 0.4,
                py: 0.45
              }}
            >
              {actionButtons}
            </Box>
            {framed && !isAlbumVideo ? (
              <Box
                className="rv-photo-tile__zoom-bar"
                title={
                  panEnabled
                    ? 'Zoom photo in slot (Pan mode)'
                    : 'Zoom slider active only in Pan mode — toggle Pan first'
                }
                sx={slotZoomSliderRowSx(panEnabled)}
              >
                <Typography component="span" sx={slotZoomPctLabelSx(panEnabled)}>
                  0%
                </Typography>
                <Slider
                  size="small"
                  disabled={!panEnabled}
                  value={framedZoomPct}
                  min={SLOT_ZOOM_PCT_MIN}
                  max={SLOT_ZOOM_PCT_MAX}
                  step={1}
                  onChange={(_, v) => {
                    if (!panEnabled) return;
                    applyFramedZoomPercent(v);
                  }}
                  aria-label={
                    panEnabled
                      ? 'Zoom photo in slot'
                      : 'Zoom disabled — enable Pan mode first'
                  }
                  valueLabelDisplay={panEnabled ? 'auto' : 'off'}
                  valueLabelFormat={(v) => `${v}%`}
                  sx={slotZoomSliderSx(panEnabled)}
                />
                <Typography component="span" sx={slotZoomPctLabelSx(panEnabled)}>
                  100%
                </Typography>
              </Box>
            ) : null}
          </Box>
          ) : null}
          {error ? (
            <Typography
              sx={{
                position: 'absolute',
                top: 6,
                left: 6,
                right: 6,
                zIndex: 6,
                bgcolor: 'rgba(255,255,255,0.92)',
                color: 'var(--theme-error-color)',
                fontWeight: 600,
                fontSize: '0.75rem',
                p: 0.5,
                borderRadius: 1
              }}
            >
              {error}
            </Typography>
          ) : null}
        </Box>
        {sizeLabel && !framed ? (
          <Typography
            component="span"
            sx={{
              display: 'block',
              mt: 0.35,
              fontSize: '0.72rem',
              color: '#666',
              lineHeight: 1.2,
              wordBreak: 'break-word'
            }}
          >
            {label} · {sizeLabel}
          </Typography>
        ) : null}
        {typeof document !== 'undefined' && thumbLoadError
          ? createPortal(
              <VaultWorkspaceErrorPopup
                error={photoErrorPopupOpen ? thumbLoadError : ''}
                onClose={() => setPhotoErrorPopupOpen(false)}
                title="Photo is blank — error details"
                closeButtonAriaLabel="Close photo error details"
              />,
              document.body
            )
          : null}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="rv-attachment-node">
      <Box sx={wrapperSx} contentEditable={false}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 'inherit', wordBreak: 'break-word' }}>{label}</Typography>
          {sizeLabel ? <Typography sx={{ fontSize: '0.85em', opacity: 0.8 }}>{sizeLabel}</Typography> : null}
          {error ? (
            <Typography sx={{ color: 'var(--theme-error-color)', fontWeight: 600, fontSize: '0.85em' }}>{error}</Typography>
          ) : null}
        </Box>
        {actionButtons}
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
export const PhotoAlbumsAttachmentNode = Node.create({
  name: PHOTO_ALBUMS_ATTACHMENT_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  // Disable ProseMirror HTML5 node-drag — it fights freeform photo placement and
  // was snapping tiles back after mouseup. Photos move via custom handlers.
  draggable: false,

  addStorage() {
    return {
      noteId: null,
      sharedAlbumId: null,
      storageType: 'usb',
      busy: false,
      onServerDelete: null,
      /** Opens Add Text dialog; optional { posLeft, posTop } anchors near a photo. */
      openPlaceText: null,
      /** Places emoji sticker immediately at clientX/clientY (picker click). */
      openPlaceEmoji: null,
      attachmentCtxVersion: 0,
      /** Selected photo has Pan&Zoom mode ON (yellow border). */
      selectedPhotoPanZoom: false,
      /**
       * Doc position of the photo kept in red-border edit chrome even when TipTap
       * selection moves to a text label (e.g. after Place Text OK). Cleared when
       * the user clicks outside the photo.
       */
      pinnedPhotoEditPos: null,
      /** Add Text dialog open — hide on-album labels on the pinned photo (preview owns them). */
      placeTextDialogOpen: false,
      /** Visible open-spread page bands (left + right). */
      activePageBands: [],
      /** @deprecated Prefer activePageBands. */
      activePageBand: null,
      photoLoadBands: [],
      layoutLockVersion: 0,
      /** Bumps when selectedPhotoPanZoom / pinnedPhotoEditPos changes (context tutorial). */
      contextTutorialTick: 0
    };
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
      },
      checksum: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-checksum') || null,
        renderHTML: (attrs) => attrToData(attrs.checksum, 'data-checksum')
      },
      /** Display width in px for photo tiles; null = collage default sizing. */
      width: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-width') || el.getAttribute('width')),
        renderHTML: (attrs) => attrToData(attrs.width, 'data-width')
      },
      /** Explicit frame height (px) — used with cover crop when snapped to a template slot. */
      height: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-height') || el.getAttribute('height')),
        renderHTML: (attrs) => attrToData(attrs.height, 'data-height')
      },
      /** Freeform album placement (px from ProseMirror top-left). */
      posLeft: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-pos-left')),
        renderHTML: (attrs) => attrToData(attrs.posLeft, 'data-pos-left')
      },
      posTop: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-pos-top')),
        renderHTML: (attrs) => attrToData(attrs.posTop, 'data-pos-top')
      },
      /** Snapped template slot bounds — resize stays inside and never spills past this frame. */
      frameLeft: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-frame-left')),
        renderHTML: (attrs) => attrToData(attrs.frameLeft, 'data-frame-left')
      },
      frameTop: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-frame-top')),
        renderHTML: (attrs) => attrToData(attrs.frameTop, 'data-frame-top')
      },
      frameWidth: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-frame-width')),
        renderHTML: (attrs) => attrToData(attrs.frameWidth, 'data-frame-width')
      },
      frameHeight: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-frame-height')),
        renderHTML: (attrs) => attrToData(attrs.frameHeight, 'data-frame-height')
      },
      /** Photo offset inside the slot window (pan). */
      panX: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-pan-x')),
        renderHTML: (attrs) => attrToData(attrs.panX, 'data-pan-x')
      },
      panY: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-pan-y')),
        renderHTML: (attrs) => attrToData(attrs.panY, 'data-pan-y')
      },
      /** Slot fit mode: contain (Full) or cover (Zoom). */
      slotFit: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-slot-fit');
          return raw === 'contain' || raw === 'cover' ? raw : null;
        },
        renderHTML: (attrs) => attrToData(attrs.slotFit, 'data-slot-fit')
      },
      /** Photo rotation in the slot (degrees, multiples of 90). */
      rotationDeg: {
        default: 0,
        parseHTML: (el) => {
          const n = Number(el.getAttribute('data-rotation'));
          if (!Number.isFinite(n)) return 0;
          return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
        },
        renderHTML: (attrs) => {
          const n = Number(attrs.rotationDeg);
          if (!Number.isFinite(n) || n === 0) return {};
          return attrToData(((Math.round(n / 90) * 90) % 360 + 360) % 360, 'data-rotation');
        }
      }
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-rv-attachment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-rv-attachment': '' })];
  },

  /** Block TipTap single-click NodeSelection — edit mode is via double-click Edit Photo popup. */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('photoAlbumsAttachmentClickGate'),
        props: {
          handleClickOn: (_view, _pos, node) => node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME
        }
      })
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PhotoAlbumsAttachmentNodeView);
  }
});

/** Keep red-border edit chrome on a photo while TipTap selection is elsewhere (e.g. text). */
export function setPinnedPhotoEditPos(editor, pos) {
  const store = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
  if (!store) return;
  const next = Number.isFinite(pos) ? pos : null;
  if (store.pinnedPhotoEditPos === next) return;
  store.pinnedPhotoEditPos = next;
  store.contextTutorialTick = (store.contextTutorialTick || 0) + 1;
}

export function clearPinnedPhotoEditPos(editor) {
  setPinnedPhotoEditPos(editor, null);
}

export { photoPageRectFromAttrs, detachTextAndEmojiNearPhoto, insertCompanionLabelsOnPhoto, listTextAndEmojiNearPhoto, listTextAndEmojiForPhotoPos };
export default PhotoAlbumsAttachmentNode;
