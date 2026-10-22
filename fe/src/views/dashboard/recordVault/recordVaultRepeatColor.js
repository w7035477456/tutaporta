import { Extension } from '@tiptap/core';

/** Ctrl+Shift+R (real Control key on Mac too) re-applies the last toolbar color to the current selection. */
const STORAGE_KEY = 'tutaNotesLastColorAction_v1';
const KINDS = new Set(['text', 'highlight', 'background']);

/** @param {'text' | 'highlight' | 'background'} kind */
export function rememberRecordVaultColor(kind, color) {
  if (!KINDS.has(kind) || !color) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind, color }));
  } catch {
    // ignore quota / private mode
  }
}

function readLastColorAction() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed && KINDS.has(parsed.kind) && parsed.color ? parsed : null;
  } catch {
    return null;
  }
}

export const RecordVaultRepeatColor = Extension.create({
  name: 'recordVaultRepeatColor',

  addKeyboardShortcuts() {
    const repeat = () => {
      const last = readLastColorAction();
      if (!last || this.editor.state.selection.empty) return true;
      const chain = this.editor.chain().focus();
      if (last.kind === 'text') chain.setColor(last.color).run();
      else if (last.kind === 'highlight') chain.setHighlight({ color: last.color }).run();
      else chain.setBackgroundColor(last.color).run();
      return true;
    };
    return { 'Ctrl-Shift-r': repeat, 'Ctrl-Shift-R': repeat };
  }
});
