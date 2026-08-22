import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import 'katex/dist/katex.min.css';

import { buildRecordVaultEditorExtensions } from './recordVaultEditorExtensions';
import { RECORD_VAULT_ATTACHMENT_NODE_NAME } from './recordVaultAttachmentNode';
import {
  buildRecordVaultPasteHtml,
  plainTextToHtml,
  recordVaultPasteSignature,
  shouldHandleRecordVaultPaste
} from './recordVaultPasteFromClipboard';
import RecordVaultEditorToolbar from './RecordVaultEditorToolbar';
import './recordVaultEditor.scss';

const EMPTY_DOC = '<p></p>';

/** Scroll the currently active (bold-blinking) search hit into the middle of view. */
function scrollActiveHitIntoView(editor) {
  const dom = editor?.view?.dom;
  const active =
    dom?.querySelector('[data-rv-search-active="true"]') || dom?.querySelector('.rv-search-hit');
  if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * From-scratch TipTap editor for the Record Vault note content area, wired with
 * the full set of FREE TipTap extensions (no paid Collaboration/AI/Comments/etc.).
 *
 * Content is controlled imperatively by the parent (RecordVaultWorkspacePane) so it
 * can load the decrypted note body, swap notes, and read the HTML back for saving /
 * inner PIN encryption. `onChange` fires only on genuine user edits (debounced
 * autosave lives in the parent); programmatic `setContent` never emits an update.
 */
const RecordVaultNoteEditor = forwardRef(function RecordVaultNoteEditor(
  {
    initialContent = EMPTY_DOC,
    editable = true,
    onChange,
    onReady,
    onContentHeightChange,
    header = null
  },
  ref
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onContentHeightRef = useRef(onContentHeightChange);
  onContentHeightRef.current = onContentHeightChange;
  const editorRef = useRef(null);
  /** Blocks TipTap default + duplicate paste events from inserting the same clipboard twice. */
  const pasteInFlightRef = useRef(false);
  const lastPasteAtRef = useRef(0);
  const lastPasteSigRef = useRef('');
  const lastInsertedSigRef = useRef('');

  const editor = useEditor({
    extensions: buildRecordVaultEditorExtensions(),
    content: initialContent || EMPTY_DOC,
    editable,
    immediatelyRender: false,
    editorProps: {
      /**
       * Apple Notes / Word / LibreOffice / browser Select-All → Copy → Paste.
       * Same path on Mac and Ubuntu. Takes over when the clipboard has HTML,
       * multi-line plain text, or image files; otherwise TipTap's default runs.
       *
       * Must return true synchronously and never let ProseMirror's default slice
       * insert — otherwise we get double paste (PM slice + our insertContent).
       */
      handlePaste: (_view, event) => {
        const cd = event?.clipboardData;
        const current = editorRef.current;
        if (!cd || !current || !current.isEditable) return false;
        if (!shouldHandleRecordVaultPaste(cd)) return false;

        // One Ctrl-V can fire paste twice on Mac Safari/Chrome; ignore repeats of the same payload.
        const now = Date.now();
        const sig = recordVaultPasteSignature(cd);
        if (
          pasteInFlightRef.current ||
          (now - lastPasteAtRef.current < 2500 && lastPasteSigRef.current === sig)
        ) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }

        pasteInFlightRef.current = true;
        lastPasteAtRef.current = now;
        lastPasteSigRef.current = sig;
        event.preventDefault();
        event.stopPropagation();

        void buildRecordVaultPasteHtml(cd)
          .then((html) => {
            const ed = editorRef.current;
            if (!ed) return;
            if (lastInsertedSigRef.current === sig) return;
            if (html) {
              lastInsertedSigRef.current = sig;
              ed.chain().focus().insertContent(html).run();
              return;
            }
            const plain = String(cd.getData('text/plain') || '');
            if (plain) {
              lastInsertedSigRef.current = sig;
              ed.chain().focus().insertContent(plainTextToHtml(plain)).run();
            }
          })
          .catch((err) => {
            console.error('[RecordVault paste] failed:', err?.message || err);
            const ed = editorRef.current;
            const plain = String(cd.getData('text/plain') || '');
            if (plain && ed && lastInsertedSigRef.current !== sig) {
              lastInsertedSigRef.current = sig;
              ed.chain().focus().insertContent(plainTextToHtml(plain)).run();
            }
          })
          .finally(() => {
            pasteInFlightRef.current = false;
            lastPasteAtRef.current = Date.now();
          });
        return true;
      }
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current?.(e.getHTML());
    }
  });

  editorRef.current = editor;

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // Signal the parent once the TipTap instance exists so it can hydrate content
  // via the imperative ref (which is set during commit, before this effect runs).
  useEffect(() => {
    if (editor) onReadyRef.current?.();
  }, [editor]);

  // Report the editor's natural height (chrome + full text content) so the parent
  // can size the pane to hug short notes and cap tall ones. Invariant to the
  // pane's own height (uses scrollHeight), so it won't feedback-loop.
  useEffect(() => {
    if (!editor) return undefined;
    const pmEl = editor.view.dom;
    const report = () => {
      const body = pmEl.parentElement;
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

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => editor?.getHTML() ?? '',
      /** Serialize the current note body to Markdown (tiptap-markdown). */
      getMarkdown: () => editor?.storage.markdown?.getMarkdown() ?? '',
      isEmpty: () => editor?.isEmpty ?? true,
      focus: () => editor?.commands.focus(),
      /** Replace the whole document without triggering the autosave onChange. */
      setContent: (html, nextEditable) => {
        if (!editor) return;
        editor.commands.setContent(html || EMPTY_DOC, { emitUpdate: false });
        if (typeof nextEditable === 'boolean') editor.setEditable(nextEditable);
      },
      /**
       * Import a Markdown string as the whole document. tiptap-markdown parses
       * the string on setContent when the Markdown extension is present. Does not
       * trigger the autosave onChange (caller decides when to persist).
       */
      setMarkdown: (markdown, nextEditable) => {
        if (!editor) return;
        editor.commands.setContent(markdown ?? '', { emitUpdate: false });
        if (typeof nextEditable === 'boolean') editor.setEditable(nextEditable);
      },
      /**
       * Keep the inline-attachment node view in sync with the open note: which
       * note the files belong to, the storage type, the busy flag, and the
       * server-side delete handler. Node views read this from editor storage.
       */
      setAttachmentContext: (ctx) => {
        if (!editor) return;
        const store = editor.storage?.[RECORD_VAULT_ATTACHMENT_NODE_NAME];
        if (store) Object.assign(store, ctx || {});
      },
      /** Attachment ids currently embedded in the note body (as strings). */
      getAttachmentIds: () => {
        if (!editor) return [];
        const ids = [];
        editor.state.doc.descendants((n) => {
          if (n.type.name === RECORD_VAULT_ATTACHMENT_NODE_NAME && n.attrs.attachmentId != null) {
            ids.push(String(n.attrs.attachmentId));
          }
        });
        return ids;
      },
      /**
       * Insert a vault file node at the drop coordinates (falls back to the end of
       * the document when the point can't be resolved). Emits an update so the
       * parent autosave persists the new body.
       */
      insertAttachmentAtCoords: (attrs, coords) => {
        if (!editor) return;
        let pos = null;
        if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
          const resolved = editor.view.posAtCoords({ left: coords.x, top: coords.y });
          if (resolved) pos = resolved.pos;
        }
        if (pos == null) pos = editor.state.doc.content.size;
        editor
          .chain()
          .focus()
          .insertContentAt(pos, { type: RECORD_VAULT_ATTACHMENT_NODE_NAME, attrs })
          .run();
      },
      /** Insert a phone/album photo (data URL) at the cursor; emits update for autosave. */
      insertImage: (src) => {
        if (!editor || !src) return;
        editor
          .chain()
          .focus()
          .insertContent({ type: 'image', attrs: { src } })
          .run();
      },
      /** Append vault file nodes to the end of the body (used to backfill legacy files). */
      appendAttachments: (attrsList) => {
        if (!editor || !Array.isArray(attrsList) || !attrsList.length) return;
        const content = attrsList.map((attrs) => ({
          type: RECORD_VAULT_ATTACHMENT_NODE_NAME,
          attrs
        }));
        editor
          .chain()
          .insertContentAt(editor.state.doc.content.size, content)
          .run();
      },
      /**
       * Highlight the active search terms, focus the first hit, and return the
       * total number of matches so the caller can wire up hit navigation.
       */
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
      /** Number of highlighted search matches currently in the note body. */
      getSearchHitCount: () =>
        editor?.view?.dom.querySelectorAll('.rv-search-hit').length ?? 0,
      /** Make the given match index the "current" hit and scroll it into view. */
      setActiveSearchHit: (index) => {
        if (!editor) return;
        editor.commands.setActiveSearchHit(index);
        requestAnimationFrame(() => scrollActiveHitIntoView(editor));
      }
    }),
    [editor]
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

  return (
    <Box className="rv-editor">
      <RecordVaultEditorToolbar editor={editor} />

      {editor ? (
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
        </BubbleMenu>
      ) : null}

      {header}

      <Box className="rv-editor__body">
        <EditorContent editor={editor} />
      </Box>

      <Box className="rv-editor__footer">
        <span>{counts.words} words</span>
        <span>{counts.characters} characters</span>
      </Box>
    </Box>
  );
});

RecordVaultNoteEditor.propTypes = {
  initialContent: PropTypes.string,
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  onReady: PropTypes.func,
  onContentHeightChange: PropTypes.func,
  header: PropTypes.node
};

export default RecordVaultNoteEditor;
