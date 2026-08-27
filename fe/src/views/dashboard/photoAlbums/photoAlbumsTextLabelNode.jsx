import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, useEditorState } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import Box from '@mui/material/Box';
import { usePhotoAlbumsAlbumLayout, pointInAnyAlbumBand } from './photoAlbumsAlbumLayoutContext';
import { PHOTO_ALBUMS_ATTACHMENT_NODE_NAME } from './photoAlbumsAttachmentNode';
import Typography from '@mui/material/Typography';

export const PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME = 'photoAlbumsTextLabel';

const MOVE_THRESHOLD_PX = 4;
const ALBUM_EDGE_SCROLL_PX = 56;
const ALBUM_PAGE_PAD_PX = 48;
const DEFAULT_COLOR = '#FFFF00';
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_ROTATION = -12;
const MIN_BOX_W = 48;
const MIN_BOX_H = 28;
const MIN_LABEL_FONT_PX = 10;
const MAX_LABEL_FONT_PX = 400;
const MIN_EMOJI_FONT_PX = 12;
const MAX_EMOJI_FONT_PX = 400;

/** Stickers placed via Emoji button use an emoji font stack — scale glyph with the box. */
function isEmojiStickerLabel(text, fontFamily) {
  if (/Emoji/i.test(String(fontFamily || ''))) return true;
  const t = String(text || '').trim();
  if (!t || /\s/.test(t)) return false;
  // Single emoji / short ZWJ sequence without letters/digits.
  if (/[A-Za-z0-9]/.test(t)) return false;
  return [...t].length <= 8;
}
const BOX_RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const BOX_CURSOR = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize'
};

function parseOptionalPx(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseOptionalNum(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Grow album canvas height only — page-edge bar width is never auto-synced. */
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

function autoScrollAlbumDuringDrag(scrollHost, clientX, clientY) {
  if (!scrollHost) return;
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
}

function readAlbumZoomScale(pm) {
  const scaler = pm?.closest?.('.rv-editor__album-zoom-scaler');
  if (!scaler) return 1;
  const raw = scaler.style?.zoom || getComputedStyle(scaler).zoom || '1';
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0.01 ? n : 1;
}

function newLabelId() {
  return `tl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function attrToData(value, key) {
  return value == null || value === '' ? {} : { [key]: String(value) };
}

function PhotoAlbumsTextLabelNodeView({ node, editor, deleteNode, updateAttributes, selected, getPos }) {
  const text = String(node?.attrs?.text || 'Text');
  const color = String(node?.attrs?.color || DEFAULT_COLOR);
  const outlineColor = String(node?.attrs?.outlineColor || '#000000');
  const outlineWidth = Math.max(0, Number(node?.attrs?.outlineWidth));
  const strokeW = Number.isFinite(outlineWidth) ? outlineWidth : 1.25;
  const fontSize = Math.max(10, Math.round(Number(node?.attrs?.fontSize) || DEFAULT_FONT_SIZE));
  const fontFamily = String(node?.attrs?.fontFamily || 'Algerian, fantasy');
  const fontWeight = Number(node?.attrs?.fontWeight) || 700;
  const rotationDeg = Number(node?.attrs?.rotationDeg);
  const rot = Number.isFinite(rotationDeg) ? rotationDeg : DEFAULT_ROTATION;
  const posLeft = parseOptionalPx(node?.attrs?.posLeft) ?? 40;
  const posTop = parseOptionalPx(node?.attrs?.posTop) ?? 40;
  const boxWidth = parseOptionalPx(node?.attrs?.boxWidth);
  const boxHeight = parseOptionalPx(node?.attrs?.boxHeight);

  const rootRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [dragPos, setDragPos] = useState(null);
  const [liveRot, setLiveRot] = useState(null);
  const [liveBox, setLiveBox] = useState(null);
  const [liveFontSize, setLiveFontSize] = useState(null);
  const { activePageBand, activePageBands } = usePhotoAlbumsAlbumLayout();
  const layoutLockVersion = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME]?.layoutLockVersion ?? 0
  });
  const labelBoxW = Math.max(1, Number(boxWidth) || 40);
  const labelBoxH = Math.max(1, Number(boxHeight) || 40);
  const attachmentStore = editor?.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
  const pageBands = (() => {
    const fromCtx = Array.isArray(activePageBands) ? activePageBands : [];
    if (fromCtx.length) return fromCtx;
    const fromStore = Array.isArray(attachmentStore?.activePageBands)
      ? attachmentStore.activePageBands
      : [];
    if (fromStore.length) return fromStore;
    const legacy = activePageBand || attachmentStore?.activePageBand || null;
    return legacy ? [legacy] : [];
  })();

  const labelCenterInBands = useCallback(
    (bands) => {
      const cx = posLeft + labelBoxW / 2;
      const cy = posTop + labelBoxH / 2;
      return pointInAnyAlbumBand(cx, cy, bands);
    },
    [posLeft, posTop, labelBoxW, labelBoxH]
  );

  const canEditLayout = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed?.isEditable) return false;
      const store = ed.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
      void (store?.contextTutorialTick ?? 0);
      if (store?.pinnedPhotoEditPos != null) return true;
      const { selection } = ed.state;
      return (
        selection instanceof NodeSelection &&
        selection.node?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME
      );
    }
  });
  const onActiveBookPage = useMemo(() => {
    const bandsFromCtx = Array.isArray(pageBands) ? pageBands : [];
    const bandsFromStore = Array.isArray(attachmentStore?.activePageBands)
      ? attachmentStore.activePageBands
      : [];
    const bands = bandsFromCtx.length
      ? bandsFromCtx
      : bandsFromStore.length
        ? bandsFromStore
        : null;
    const legacyBand = activePageBand || attachmentStore?.activePageBand || null;
    if (!bands?.length && !legacyBand) return true;
    if (bands?.length) return labelCenterInBands(bands);
    if (!(legacyBand.height > 0)) return true;
    const cx = posLeft + labelBoxW / 2;
    const cy = posTop + labelBoxH / 2;
    return (
      cx >= legacyBand.left &&
      cx <= legacyBand.left + legacyBand.width &&
      cy >= legacyBand.top &&
      cy <= legacyBand.top + legacyBand.height
    );
  }, [
    pageBands,
    layoutLockVersion,
    labelCenterInBands,
    attachmentStore,
    activePageBand,
    posLeft,
    posTop,
    labelBoxW,
    labelBoxH
  ]);

  const liveLeft = dragPos?.left ?? posLeft;
  const liveTop = dragPos?.top ?? posTop;
  const liveRotation = liveRot != null ? liveRot : rot;
  const liveBoxW = liveBox?.w ?? boxWidth;
  const liveBoxH = liveBox?.h ?? boxHeight;
  const hasBox = liveBoxW != null && liveBoxH != null;
  const displayFontSize = liveFontSize != null ? liveFontSize : fontSize;
  const emojiSticker = isEmojiStickerLabel(text, fontFamily);

  const commitAttrs = useCallback(
    (attrs) => {
      const pos = typeof getPos === 'function' ? getPos() : null;
      if (editor && typeof pos === 'number' && Number.isFinite(pos)) {
        const ok = editor
          .chain()
          .command(({ tr, dispatch }) => {
            const current = tr.doc.nodeAt(pos);
            if (!current || current.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) return false;
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

  useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  useEffect(() => {
    const pm = rootRef.current?.closest?.('.ProseMirror');
    if (!pm) return;
    expandAlbumCanvas(pm, liveLeft, liveTop, liveBoxW || 220, liveBoxH || 80);
  }, [liveLeft, liveTop, liveBoxW, liveBoxH]);

  const finishEdit = useCallback(() => {
    const next = String(draft || '').trim() || 'Text';
    setEditing(false);
    if (next !== text) commitAttrs({ text: next });
  }, [draft, text, commitAttrs]);

  const startBoxResize = useCallback(
    (handle) => (event) => {
      if (!canEditLayout || event.button !== 0 || editing) return;
      event.preventDefault();
      event.stopPropagation();

      const wrapper = rootRef.current;
      const pm = wrapper?.closest?.('.ProseMirror');
      if (!wrapper || !pm) return;
      const zoomScale = readAlbumZoomScale(pm);
      const measured = wrapper.getBoundingClientRect();
      const originW = Math.max(
        MIN_BOX_W,
        boxWidth ?? Math.round(measured.width / zoomScale)
      );
      const originH = Math.max(
        MIN_BOX_H,
        boxHeight ?? Math.round(measured.height / zoomScale)
      );
      const originFont = fontSize;
      const scaleGlyph = isEmojiStickerLabel(text, fontFamily);
      const minFont = scaleGlyph ? MIN_EMOJI_FONT_PX : MIN_LABEL_FONT_PX;
      const maxFont = scaleGlyph ? MAX_EMOJI_FONT_PX : MAX_LABEL_FONT_PX;
      // Corners → scale text size. Side midpoints → reshape box only (word wrap).
      const cornerScale = handle.length === 2;
      const startX = event.clientX;
      const startY = event.clientY;
      let latest = {
        w: originW,
        h: originH,
        left: posLeft,
        top: posTop,
        fontSize: originFont
      };

      const onMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / zoomScale;
        const dy = (moveEvent.clientY - startY) / zoomScale;
        let w = originW;
        let h = originH;
        let left = posLeft;
        let top = posTop;
        if (handle.includes('e')) w = originW + dx;
        if (handle.includes('w')) {
          w = originW - dx;
          left = posLeft + dx;
        }
        if (handle.includes('s')) h = originH + dy;
        if (handle.includes('n')) {
          h = originH - dy;
          top = posTop + dy;
        }
        if (handle === 'n' || handle === 's') {
          left = posLeft;
          w = originW;
        }
        if (handle === 'e' || handle === 'w') {
          top = posTop;
          h = originH;
        }

        let nextFont = originFont;
        if (cornerScale || scaleGlyph) {
          // Corner drag (or emoji): uniform scale — bigger box → bigger text.
          let scale = 1;
          if (handle === 'e' || handle === 'w') scale = w / originW;
          else if (handle === 'n' || handle === 's') scale = h / originH;
          else {
            const sx = w / originW;
            const sy = h / originH;
            scale = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
          }
          const minScale = Math.max(MIN_BOX_W / originW, MIN_BOX_H / originH, minFont / originFont);
          const maxScale = Math.min(maxFont / originFont, 12);
          scale = Math.min(maxScale, Math.max(minScale, scale));
          w = Math.max(MIN_BOX_W, Math.round(originW * scale));
          h = Math.max(MIN_BOX_H, Math.round(originH * scale));
          nextFont = Math.max(minFont, Math.min(maxFont, Math.round(originFont * scale)));
        } else {
          // Side drag: change box only so text can wrap — keep font size.
          w = Math.max(MIN_BOX_W, Math.round(w));
          h = Math.max(MIN_BOX_H, Math.round(h));
        }

        if (handle.includes('w')) left = posLeft + originW - w;
        if (handle.includes('n')) top = posTop + originH - h;
        left = Math.max(0, Math.round(left));
        top = Math.max(0, Math.round(top));
        latest = { w, h, left, top, fontSize: nextFont };
        setLiveBox({ w, h });
        if (cornerScale || scaleGlyph) setLiveFontSize(nextFont);
        else setLiveFontSize(null);
        setDragPos({ left, top });
        expandAlbumCanvas(pm, left, top, w, h);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        const attrs = {
          boxWidth: latest.w,
          boxHeight: latest.h,
          posLeft: latest.left,
          posTop: latest.top
        };
        if ((cornerScale || scaleGlyph) && latest.fontSize != null) {
          attrs.fontSize = latest.fontSize;
        }
        commitAttrs(attrs);
        setLiveBox(null);
        setLiveFontSize(null);
        setDragPos(null);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = BOX_CURSOR[handle] || 'nwse-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [
      canEditLayout,
      editing,
      boxWidth,
      boxHeight,
      posLeft,
      posTop,
      fontSize,
      fontFamily,
      text,
      commitAttrs
    ]
  );

  const startMove = useCallback(
    (event) => {
      if (!canEditLayout || event.button !== 0 || editing) return;
      if (event.target?.closest?.('.rv-text-label__rotate')) return;
      if (event.target?.closest?.('.rv-text-label__delete')) return;
      if (event.target?.closest?.('.rv-text-label__resize')) return;
      if (event.target?.closest?.('textarea, input')) return;

      event.preventDefault();
      event.stopPropagation();

      const wrapper = rootRef.current;
      const pm = wrapper?.closest?.('.ProseMirror');
      if (!wrapper || !pm) return;
      const scrollHost =
        pm.closest('.rv-editor__album-zoom-scroll') ||
        pm.closest('.rv-editor__body') ||
        pm.parentElement ||
        pm;
      const zoomScale = readAlbumZoomScale(pm);
      const startX = event.clientX;
      const startY = event.clientY;
      const originLeft = posLeft;
      const originTop = posTop;
      const scrollLeft0 = scrollHost.scrollLeft || 0;
      const scrollTop0 = scrollHost.scrollTop || 0;
      let moved = false;
      let latest = { left: originLeft, top: originTop };
      const boxW = liveBoxW || 220;
      const boxH = liveBoxH || 80;

      const onMove = (moveEvent) => {
        autoScrollAlbumDuringDrag(scrollHost, moveEvent.clientX, moveEvent.clientY);
        const scrollDx = (scrollHost.scrollLeft || 0) - scrollLeft0;
        const scrollDy = (scrollHost.scrollTop || 0) - scrollTop0;
        const dx = (moveEvent.clientX - startX) / zoomScale + scrollDx;
        const dy = (moveEvent.clientY - startY) / zoomScale + scrollDy;
        if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < MOVE_THRESHOLD_PX) {
          return;
        }
        moved = true;
        latest = {
          left: Math.max(0, Math.round(originLeft + dx)),
          top: Math.max(0, Math.round(originTop + dy))
        };
        setDragPos(latest);
        expandAlbumCanvas(pm, latest.left, latest.top, boxW, boxH);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        if (moved) {
          commitAttrs({ posLeft: latest.left, posTop: latest.top });
        }
        setDragPos(null);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [canEditLayout, editing, posLeft, posTop, liveBoxW, liveBoxH, commitAttrs]
  );

  const startRotate = useCallback(
    (event) => {
      if (!canEditLayout || event.button !== 0 || editing) return;
      event.preventDefault();
      event.stopPropagation();

      const wrapper = rootRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
      const originRot = rot;
      let latest = originRot;

      const onMove = (moveEvent) => {
        const angle = Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx);
        const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
        latest = Math.round(originRot + deltaDeg);
        setLiveRot(latest);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        commitAttrs({ rotationDeg: latest });
        setLiveRot(null);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [canEditLayout, editing, rot, commitAttrs]
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`rv-text-label${canEditLayout ? ' is-selected' : ''}${
        editing ? ' is-editing' : ''
      }`}
      style={{
        left: `${liveLeft}px`,
        top: `${liveTop}px`,
        transform: `rotate(${liveRotation}deg)`,
        ...(onActiveBookPage
          ? null
          : { display: 'none', visibility: 'hidden', pointerEvents: 'none' })
      }}
    >
      <Box
        ref={rootRef}
        className="rv-text-label__body"
        contentEditable={false}
        onMouseDown={canEditLayout ? startMove : undefined}
        onDoubleClick={(e) => {
          if (!canEditLayout) return;
          e.preventDefault();
          e.stopPropagation();
          const requestEdit =
            editor?.storage?.[PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME]?.onRequestPlaceTextEdit;
          if (typeof requestEdit === 'function') {
            let pos = null;
            try {
              pos = typeof getPos === 'function' ? getPos() : null;
            } catch {
              pos = null;
            }
            requestEdit({
              labelId: node?.attrs?.labelId || null,
              pos: Number.isFinite(pos) ? pos : null,
              text,
              color,
              outlineColor,
              outlineWidth: strokeW,
              fontSize,
              fontFamily,
              fontWeight
            });
            return;
          }
          setEditing(true);
        }}
        title={
          canEditLayout
            ? 'Drag to place · corners scale text size · sides reshape box for wrap · double-click to edit style · rotate knob'
            : undefined
        }
        sx={{
          position: 'relative',
          display: hasBox ? 'block' : 'inline-block',
          width: hasBox ? liveBoxW : 'auto',
          height: hasBox ? liveBoxH : 'auto',
          minWidth: hasBox ? MIN_BOX_W : undefined,
          minHeight: hasBox ? MIN_BOX_H : undefined,
          maxWidth: hasBox ? 'none' : 420,
          boxSizing: 'border-box',
          px: 0.75,
          py: 0.35,
          cursor: canEditLayout ? (editing ? 'text' : 'grab') : 'default',
          userSelect: editing ? 'text' : 'none',
          outline: canEditLayout ? '2px dashed #2f6fed' : 'none',
          outlineOffset: 4,
          borderRadius: 1,
          bgcolor: canEditLayout ? 'rgba(255,255,255,0.12)' : 'transparent',
          // Never clip rotate/resize handles (they sit outside the box edges).
          overflow: 'visible'
        }}
      >
        {/* Clip long text inside the box; handles stay on the outer (overflow:visible) shell. */}
        <Box
          className="rv-text-label__clip"
          sx={{
            width: '100%',
            height: hasBox ? '100%' : 'auto',
            overflow: hasBox ? 'hidden' : 'visible',
            boxSizing: 'border-box'
          }}
        >
        {editing ? (
          <Box
            component="textarea"
            value={draft}
            autoFocus
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(text);
                setEditing(false);
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishEdit();
              }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              display: 'block',
              width: '100%',
              height: hasBox ? '100%' : 'auto',
              minWidth: 120,
              minHeight: hasBox ? '100%' : 48,
              resize: hasBox ? 'none' : 'both',
              border: '1px solid #2f6fed',
              borderRadius: 1,
              p: 0.5,
              fontSize: `${displayFontSize}px`,
              fontFamily,
              fontWeight,
              color,
              WebkitTextStroke: strokeW > 0 ? `${strokeW}px ${outlineColor}` : '0 transparent',
              paintOrder: 'stroke fill',
              lineHeight: 1.15,
              bgcolor: 'rgba(0,0,0,0.35)',
              boxSizing: 'border-box'
            }}
          />
        ) : (
          <Typography
            component="span"
            sx={{
              display: hasBox ? (emojiSticker ? 'flex' : 'block') : 'inline-block',
              alignItems: emojiSticker ? 'center' : undefined,
              justifyContent: emojiSticker ? 'center' : undefined,
              width: hasBox ? '100%' : 'auto',
              height: hasBox ? '100%' : 'auto',
              fontSize: `${displayFontSize}px`,
              fontFamily,
              fontWeight,
              color,
              WebkitTextFillColor: color,
              WebkitTextStroke: strokeW > 0 ? `${strokeW}px ${outlineColor}` : '0 transparent',
              paintOrder: 'stroke fill',
              lineHeight: emojiSticker ? 1 : 1.15,
              whiteSpace: emojiSticker ? 'nowrap' : 'pre-wrap',
              wordBreak: emojiSticker ? 'normal' : 'break-word',
              overflowWrap: emojiSticker ? 'normal' : 'anywhere',
              textShadow: strokeW > 0 ? `0 1px 0 ${outlineColor}` : 'none'
            }}
          >
            {text}
          </Typography>
        )}
        </Box>

        {canEditLayout && !editing ? (
          <>
            {BOX_RESIZE_HANDLES.map((handle) => {
              const pos = {};
              if (handle.includes('n')) pos.top = -6;
              if (handle.includes('s')) pos.bottom = -6;
              if (handle.includes('w')) pos.left = -6;
              if (handle.includes('e')) pos.right = -6;
              if (handle === 'n' || handle === 's') {
                pos.left = '50%';
                pos.marginLeft = '-6px';
              }
              if (handle === 'e' || handle === 'w') {
                pos.top = '50%';
                pos.marginTop = '-6px';
              }
              return (
                <Box
                  key={handle}
                  className={`rv-text-label__resize rv-text-label__resize--${handle}`}
                  role="slider"
                  aria-label={`Resize text box (${handle})`}
                  title={
                    emojiSticker
                      ? 'Drag to enlarge or shrink the emoji'
                      : handle.length === 2
                        ? 'Drag corner to make the text bigger or smaller'
                        : 'Drag side to widen/tall the box (word wrap) — font size stays the same'
                  }
                  onMouseDown={startBoxResize(handle)}
                  sx={{
                    position: 'absolute',
                    width: 12,
                    height: 12,
                    ...pos,
                    borderRadius: '2px',
                    bgcolor: '#2f6fed',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                    cursor: BOX_CURSOR[handle] || 'nwse-resize',
                    zIndex: 4,
                    opacity: 1,
                    '&:hover': { opacity: 1, transform: 'scale(1.15)' }
                  }}
                />
              );
            })}
            <Box
              className="rv-text-label__rotate"
              role="slider"
              aria-label="Rotate text"
              title="Drag to rotate"
              onMouseDown={startRotate}
              sx={{
                position: 'absolute',
                left: '50%',
                top: -34,
                width: 16,
                height: 16,
                ml: '-8px',
                borderRadius: '50%',
                bgcolor: '#2f6fed',
                border: '2px solid #fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                cursor: 'grab',
                zIndex: 6,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: '50%',
                  top: 16,
                  width: 2,
                  height: 14,
                  ml: '-1px',
                  bgcolor: '#2f6fed'
                }
              }}
            />
            <Box
              className="rv-text-label__delete"
              component="button"
              type="button"
              aria-label="Delete text label"
              title="Delete"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteNode?.();
              }}
              sx={{
                position: 'absolute',
                right: -10,
                top: -10,
                width: 20,
                height: 20,
                p: 0,
                border: 'none',
                borderRadius: '50%',
                bgcolor: '#c62828',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: '20px',
                cursor: 'pointer',
                zIndex: 5,
                opacity: 1,
                '&:hover': { opacity: 1 }
              }}
            >
              ×
            </Box>
          </>
        ) : null}
      </Box>
    </NodeViewWrapper>
  );
}

/**
 * Free-placed album text label — drag anywhere; corner handles scale font size;
 * side handles reshape the box for word wrap. Rotate via the knob.
 */
export const PhotoAlbumsTextLabelNode = Node.create({
  name: PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      labelId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label-id') || null,
        renderHTML: (attrs) => attrToData(attrs.labelId, 'data-label-id')
      },
      text: {
        default: 'Text',
        parseHTML: (el) => el.getAttribute('data-text') || el.textContent || 'Text',
        renderHTML: (attrs) => attrToData(attrs.text, 'data-text')
      },
      color: {
        default: DEFAULT_COLOR,
        parseHTML: (el) => el.getAttribute('data-color') || DEFAULT_COLOR,
        renderHTML: (attrs) => attrToData(attrs.color, 'data-color')
      },
      outlineColor: {
        default: '#000000',
        parseHTML: (el) => el.getAttribute('data-outline-color') || '#000000',
        renderHTML: (attrs) => attrToData(attrs.outlineColor, 'data-outline-color')
      },
      outlineWidth: {
        default: 1.25,
        parseHTML: (el) => parseOptionalNum(el.getAttribute('data-outline-width')) ?? 1.25,
        renderHTML: (attrs) => attrToData(attrs.outlineWidth, 'data-outline-width')
      },
      fontSize: {
        default: DEFAULT_FONT_SIZE,
        parseHTML: (el) => parseOptionalNum(el.getAttribute('data-font-size')) ?? DEFAULT_FONT_SIZE,
        renderHTML: (attrs) => attrToData(attrs.fontSize, 'data-font-size')
      },
      fontFamily: {
        default: 'Algerian, fantasy',
        parseHTML: (el) => el.getAttribute('data-font-family') || 'Algerian, fantasy',
        renderHTML: (attrs) => attrToData(attrs.fontFamily, 'data-font-family')
      },
      fontWeight: {
        default: 700,
        parseHTML: (el) => parseOptionalNum(el.getAttribute('data-font-weight')) ?? 700,
        renderHTML: (attrs) => attrToData(attrs.fontWeight, 'data-font-weight')
      },
      rotationDeg: {
        default: DEFAULT_ROTATION,
        parseHTML: (el) => parseOptionalNum(el.getAttribute('data-rotation')) ?? DEFAULT_ROTATION,
        renderHTML: (attrs) => attrToData(attrs.rotationDeg, 'data-rotation')
      },
      posLeft: {
        default: 40,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-pos-left')) ?? 40,
        renderHTML: (attrs) => attrToData(attrs.posLeft, 'data-pos-left')
      },
      posTop: {
        default: 40,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-pos-top')) ?? 40,
        renderHTML: (attrs) => attrToData(attrs.posTop, 'data-pos-top')
      },
      boxWidth: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-box-width')),
        renderHTML: (attrs) => attrToData(attrs.boxWidth, 'data-box-width')
      },
      boxHeight: {
        default: null,
        parseHTML: (el) => parseOptionalPx(el.getAttribute('data-box-height')),
        renderHTML: (attrs) => attrToData(attrs.boxHeight, 'data-box-height')
      }
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-rv-text-label]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-rv-text-label': '',
        class: 'rv-text-label'
      }),
      String(HTMLAttributes['data-text'] || 'Text')
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PhotoAlbumsTextLabelNodeView);
  },

  addStorage() {
    return {
      /** (payload: { labelId, pos, text, color, outlineColor, outlineWidth, fontSize, fontFamily, fontWeight }) => void */
      onRequestPlaceTextEdit: null
    };
  },

  addCommands() {
    return {
      insertPhotoAlbumsTextLabel:
        (attrs = {}) =>
        ({ chain, state }) => {
          const text = String(attrs.text || '').trim() || 'Text';
          const content = {
            type: this.name,
            attrs: {
              labelId: attrs.labelId || newLabelId(),
              text,
              color: attrs.color || DEFAULT_COLOR,
              outlineColor: attrs.outlineColor || '#000000',
              outlineWidth:
                attrs.outlineWidth != null && Number.isFinite(Number(attrs.outlineWidth))
                  ? Number(attrs.outlineWidth)
                  : 1.25,
              fontSize: attrs.fontSize || DEFAULT_FONT_SIZE,
              fontFamily: attrs.fontFamily || 'Algerian, fantasy',
              fontWeight: attrs.fontWeight || 700,
              rotationDeg:
                attrs.rotationDeg != null && Number.isFinite(Number(attrs.rotationDeg))
                  ? Number(attrs.rotationDeg)
                  : DEFAULT_ROTATION,
              posLeft: attrs.posLeft != null ? Math.round(attrs.posLeft) : 80,
              posTop: attrs.posTop != null ? Math.round(attrs.posTop) : 120,
              boxWidth:
                attrs.boxWidth != null && Number.isFinite(Number(attrs.boxWidth))
                  ? Math.round(attrs.boxWidth)
                  : null,
              boxHeight:
                attrs.boxHeight != null && Number.isFinite(Number(attrs.boxHeight))
                  ? Math.round(attrs.boxHeight)
                  : null
            }
          };
          // Always append — never replace a selected photo/attachment NodeSelection.
          return chain().insertContentAt(state.doc.content.size, content).run();
        }
    };
  }
});

export { newLabelId, DEFAULT_COLOR as PHOTO_ALBUMS_TEXT_LABEL_DEFAULT_COLOR };
