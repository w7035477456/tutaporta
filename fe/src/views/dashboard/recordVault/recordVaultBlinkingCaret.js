import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const recordVaultBlinkingCaretKey = new PluginKey('recordVaultBlinkingCaret');

/** Class on the decoration widget that draws the custom caret. */
export const BLINKING_CARET_CLASS = 'rv-caret';
/** Mirrored onto the ProseMirror DOM while an IME / dead-key composition runs. */
export const COMPOSING_CLASS = 'rv-composing';
/**
 * Marks the editor DOM once the caret plugin is live. The stylesheet only hides
 * the native caret under this class, so if the plugin ever fails to mount the
 * user still has a working (if thin) browser caret instead of none at all.
 */
export const CUSTOM_CARET_ACTIVE_CLASS = 'rv-custom-caret';

/**
 * The browser caret is always 1px and cannot be widened, so the note body hides
 * the native one and this plugin draws a thick blinking bar as a widget
 * decoration instead.
 *
 * Draw it only for a collapsed selection in a focused, editable editor — and
 * never during IME composition, where the browser needs its own caret to
 * position candidate popups.
 */
export function shouldShowBlinkingCaret({ empty, focused, editable, composing } = {}) {
  return Boolean(empty && focused && editable && !composing);
}

function buildCaretDom() {
  const dom = document.createElement('span');
  dom.className = BLINKING_CARET_CLASS;
  dom.setAttribute('aria-hidden', 'true');
  return dom;
}

function buildCaret(state) {
  // A widget outside the document's range throws, so clamp defensively — the
  // empty-document case can leave `head` beyond `content.size`.
  const pos = Math.max(0, Math.min(state.selection.head, state.doc.content.size));
  return DecorationSet.create(state.doc, [
    Decoration.widget(pos, buildCaretDom, {
      // Stable key so the same DOM node is reused across decoration rebuilds —
      // otherwise the blink animation restarts on every keystroke.
      key: BLINKING_CARET_CLASS,
      side: -1
    })
  ]);
}

/**
 * Thick blinking caret for the Record Vault note editor.
 *
 * A decoration rather than a CSS `caret-color` rule, because the native caret
 * has a fixed 1px width and cannot host an animation. Focus is tracked in plugin
 * state: focus/blur are DOM events that do not change the document, so without
 * recording them the decorations would never be recomputed when the editor
 * gains or loses focus.
 */
export const RecordVaultBlinkingCaret = Extension.create({
  name: 'recordVaultBlinkingCaret',

  addProseMirrorPlugins() {
    const editor = this.editor;

    const setFocused = (view, focused) => {
      if (recordVaultBlinkingCaretKey.getState(view.state)?.focused === focused) return;
      view.dispatch(view.state.tr.setMeta(recordVaultBlinkingCaretKey, { focused }));
    };

    /** Composition state lives on the view, not the document — mirror it to CSS. */
    const setComposing = (view, composing) => {
      view.dom.classList.toggle(COMPOSING_CLASS, composing);
    };

    return [
      new Plugin({
        key: recordVaultBlinkingCaretKey,

        state: {
          init: () => ({ focused: false }),
          apply(tr, value) {
            const meta = tr.getMeta(recordVaultBlinkingCaretKey);
            if (meta && typeof meta.focused === 'boolean') return { focused: meta.focused };
            return value;
          }
        },

        props: {
          handleDOMEvents: {
            focus: (view) => {
              setFocused(view, true);
              return false;
            },
            blur: (view) => {
              setFocused(view, false);
              return false;
            },
            compositionstart: (view) => {
              setComposing(view, true);
              return false;
            },
            compositionend: (view) => {
              setComposing(view, false);
              return false;
            }
          },

          decorations(state) {
            // Focus comes only from plugin state. Reading `view.hasFocus()` here
            // would make the decoration depend on view state that is not part of
            // the transaction, so a stale caret could survive a blur.
            const show = shouldShowBlinkingCaret({
              empty: state.selection.empty,
              focused: Boolean(recordVaultBlinkingCaretKey.getState(state)?.focused),
              editable: editor.isEditable,
              composing: editor.view?.composing ?? false
            });
            return show ? buildCaret(state) : DecorationSet.empty;
          }
        },

        /**
         * Advertise that this plugin is live so the stylesheet knows it may hide
         * the native caret and draw its own, and seed the focus state for the
         * autofocus case where no focus event ever reaches the handler.
         */
        view(editorView) {
          editorView.dom.classList.add(CUSTOM_CARET_ACTIVE_CLASS);
          if (editorView.hasFocus()) setFocused(editorView, true);
          return {
            destroy() {
              editorView.dom.classList.remove(CUSTOM_CARET_ACTIVE_CLASS);
            }
          };
        }
      })
    ];
  }
});

export default RecordVaultBlinkingCaret;
