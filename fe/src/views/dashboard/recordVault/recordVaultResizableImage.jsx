import { useCallback, useRef } from 'react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

const MIN_IMAGE_WIDTH = 40;

/**
 * Interactive node view: renders the image and, when selected in an editable
 * document, shows corner handles the user can drag to resize. The resulting
 * width is written back onto the node's `width` attribute so it survives HTML
 * serialization (autosave / inner-encryption round trips) until changed again.
 */
function ResizableImageNodeView({ node, updateAttributes, selected, editor }) {
  const imgRef = useRef(null);
  const { src, alt, title, width } = node.attrs;
  const editable = editor?.isEditable;

  const startResize = useCallback(
    (event, corner) => {
      event.preventDefault();
      event.stopPropagation();
      const img = imgRef.current;
      const startX = event.clientX;
      const startWidth = img
        ? Math.round(img.getBoundingClientRect().width)
        : Number(width) || MIN_IMAGE_WIDTH;
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
    },
    [updateAttributes, width]
  );

  return (
    <NodeViewWrapper
      className={`rv-resizable-image${selected ? ' is-selected' : ''}`}
      data-drag-handle
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        title={title || undefined}
        draggable={false}
        style={{ width: width ? `${width}px` : undefined }}
      />
      {editable && selected ? (
        <>
          <span
            className="rv-resizable-image__handle rv-resizable-image__handle--tl"
            onMouseDown={(e) => startResize(e, 'left')}
          />
          <span
            className="rv-resizable-image__handle rv-resizable-image__handle--tr"
            onMouseDown={(e) => startResize(e, 'right')}
          />
          <span
            className="rv-resizable-image__handle rv-resizable-image__handle--bl"
            onMouseDown={(e) => startResize(e, 'left')}
          />
          <span
            className="rv-resizable-image__handle rv-resizable-image__handle--br"
            onMouseDown={(e) => startResize(e, 'right')}
          />
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
 * `width` attribute and a React node view exposing resize handles.
 */
export const RecordVaultResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) =>
          parseWidthValue(element.getAttribute('width')) ||
          parseWidthValue(element.style?.width),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px; height: auto;`
          };
        }
      }
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  }
});

export default RecordVaultResizableImage;
