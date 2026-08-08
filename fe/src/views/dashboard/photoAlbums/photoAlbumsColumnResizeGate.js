/**
 * Shared gate so album page auto-fit does not thrash while a column
 * splitter is being dragged (that fight caused blink/jiggle).
 */
let columnResizing = false;

export function isPhotoAlbumsColumnResizing() {
  return columnResizing;
}

export function setPhotoAlbumsColumnResizing(next) {
  const on = Boolean(next);
  if (columnResizing === on) return;
  columnResizing = on;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pa-col-resize', { detail: { resizing: on } }));
  }
}
