import { useRef } from 'react';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { IMAGE_ROTATION_STEP, normalizeImageRotation, parseElementRotation, rotationToHtmlAttributes } from './recordVaultImageRotation';
import { useRotatedImageBox } from './recordVaultImageLayout';

const MIN_IMAGE_WIDTH = 40;
/**
 * Nodes the rotate command turns: plain pictures and inline vault image files
 * (`recordVaultAttachment`, e.g. a scanned letter shown as a real <img>).
 */
const ROTATABLE_NODE_NAMES = new Set(['image', 'recordVaultAttachment']);

/**
 * Interactive node view: renders the image and, when selected in an editable
 * document, shows corner handles the user can drag to resize. The resulting
 * width is written back onto the node's `width` attribute so it survives HTML
 * serialization (autosave / inner-encryption round trips) until changed again.
 *
 * `rotation` (0/90/180/270) is applied as a CSS transform so scanned documents
 * shot sideways can be turned upright, and the angle is persisted on the node.
 * The wrapper box is resized to the turned footprint (see `recordVaultImageLayout`)
 * so the rotated picture stays inside the note column instead of overflowing.
 */
function ResizableImageNodeView({ node, updateAttributes, selected, editor }) {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const { src, alt, title, width, rotation } = node.attrs;
  const editable = editor?.isEditable;
  const angle = normalizeImageRotation(rotation);

  const layout = useRotatedImageBox({
    imageRef: imgRef,
    containerRef,
    rotation: angle,
    preferredWidth: width ? Number(width) : 0
  });
  const { quarterTurn, box, imgWidth } = layout;

  const startResize = (event, corner) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = imgWidth || Number(width) || MIN_IMAGE_WIDTH;
    // Left-side handles grow the image as the pointer moves left.
    const direction = corner === 'left' ? -1 : 1;

    const onMove = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) * direction;
      const next = Math.max(MIN_IMAGE_WIDTH, Math.round(startWidth + delta));
      updateAttributes({ width: next });
    };
    const onUp = () => {
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <NodeViewWrapper
      className={`rv-resizable-image${selected ? ' is-selected' : ''}`}
      data-drag-handle
      data-rotation={angle || undefined}
      ref={containerRef}
    >
      {/* Rotated: a sized frame holds the turned footprint; the <img> is
          centered inside it and rotated, so it never overflows the column. */}
      <span
        className={`rv-resizable-image__frame${quarterTurn ? ' is-turned' : ''}`}
        style={box ? { width: box.width, height: box.height } : undefined}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          title={title || undefined}
          draggable={false}
          style={{
            // Unrotated pictures only get an explicit width when the user set
            // one — otherwise max-width: 100% keeps small images at their
            // natural size instead of upscaling them to the whole column.
            width: quarterTurn ? (imgWidth ? `${imgWidth}px` : undefined) : width ? `${width}px` : undefined,
            ...(angle ? { transform: `rotate(${angle}deg)` } : null)
          }}
        />
      </span>
      {editable && selected ? (
        <>
          <span className="rv-resizable-image__handle rv-resizable-image__handle--tl" onMouseDown={(e) => startResize(e, 'left')} />
          <span className="rv-resizable-image__handle rv-resizable-image__handle--tr" onMouseDown={(e) => startResize(e, 'right')} />
          <span className="rv-resizable-image__handle rv-resizable-image__handle--bl" onMouseDown={(e) => startResize(e, 'left')} />
          <span className="rv-resizable-image__handle rv-resizable-image__handle--br" onMouseDown={(e) => startResize(e, 'right')} />
        </>
      ) : null}
    </NodeViewWrapper>
  );
}

function parseWidthValue(raw) {
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Drag-to-resize image node. Extends the standard TipTap image with a persisted
 * `width` attribute and a React node view exposing resize handles, plus a
 * persisted 0/90/180/270 `rotation` attribute and a `rotateSelectedImages`
 * command used by the note-header rotate button.
 */
export const RecordVaultResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => parseWidthValue(element.getAttribute('width')) || parseWidthValue(element.style?.width),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px; height: auto;`
          };
        }
      },
      rotation: {
        default: 0,
        parseHTML: (element) => parseElementRotation(element),
        renderHTML: (attributes) => rotationToHtmlAttributes(attributes.rotation)
      }
    };
  },

  addCommands() {
    /**
     * Rotate every selected picture — both pasted/inserted `image` nodes and
     * inline vault image files, which hold a scanned page as a real <img>.
     */
    const rotateBy =
      (delta) =>
      ({ tr, state, dispatch }) => {
        const { selection } = state;
        let changed = false;
        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (!ROTATABLE_NODE_NAMES.has(node.type.name)) return true;
          const current = normalizeImageRotation(node.attrs.rotation);
          const next = normalizeImageRotation(current + delta);
          if (next === current) return true;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, rotation: next });
          changed = true;
          return true;
        });
        return changed;
      };

    return {
      /** Turn the selected image(s) clockwise by `delta` degrees (default 90). */
      rotateSelectedImages:
        (delta = IMAGE_ROTATION_STEP) =>
        (props) => {
          const step = Number(delta);
          return rotateBy(Number.isFinite(step) && step ? step : IMAGE_ROTATION_STEP)(props);
        }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  }
});

export default RecordVaultResizableImage;
