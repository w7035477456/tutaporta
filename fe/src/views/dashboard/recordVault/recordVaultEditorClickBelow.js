import { Extension } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { Plugin } from '@tiptap/pm/state';

const BLOCK_END_NODE_NAMES = new Set(['image', 'recordVaultAttachment', 'horizontalRule']);

/** Bottom edge (viewport Y) of the last rendered block in the editor, or the editor top if empty. */
export function recordVaultEditorContentBottomY(view) {
  const root = view.dom;
  const rootTop = root.getBoundingClientRect().top;
  let bottom = rootTop;
  for (let i = 0; i < root.childElementCount; i += 1) {
    const el = root.children[i];
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

/** Place the text caret in the last text block, adding a trailing paragraph if needed. */
export function focusRecordVaultEditorAtEnd(view) {
  if (!view?.editable) return false;
  const { state } = view;
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return false;

  let tr = state.tr;
  let doc = tr.doc;
  let last = doc.lastChild;

  if (!last?.isTextblock) {
    tr = tr.insert(doc.content.size, paragraph.create());
    doc = tr.doc;
    last = doc.lastChild;
  }

  const endPos = doc.content.size;
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, endPos - 1)), -1));
  view.dispatch(tr);
  view.focus();
  return true;
}

function shouldFocusBelowOnCoords(view, event) {
  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const bottomY = recordVaultEditorContentBottomY(view);
  if (event.clientY > bottomY + 6) return true;

  if (!hit) return event.clientY > bottomY - 4;

  const { state } = view;
  const { pos } = hit;
  const end = state.doc.content.size;
  const last = state.doc.lastChild;
  const lastIsBlockEnd =
    last && (last.isAtom || BLOCK_END_NODE_NAMES.has(last.type.name) || !last.isTextblock);

  if (state.selection instanceof NodeSelection && lastIsBlockEnd) {
    return true;
  }

  if (pos >= end - 2 && lastIsBlockEnd) return true;

  return false;
}

/**
 * Clicks in the blank area under the last block (common after a tall image) should
 * behave like ArrowDown from a selected image: text caret at the end, ready to paste.
 */
export const RecordVaultEditorClickBelow = Extension.create({
  name: 'recordVaultEditorClickBelow',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              if (!view.editable || event.button !== 0) return false;
              if (!shouldFocusBelowOnCoords(view, event)) return false;
              event.preventDefault();
              return focusRecordVaultEditorAtEnd(view);
            }
          }
        }
      })
    ];
  }
});

export default RecordVaultEditorClickBelow;
