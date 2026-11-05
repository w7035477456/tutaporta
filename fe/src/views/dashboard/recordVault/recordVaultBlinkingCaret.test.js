import { describe, expect, it } from 'vitest';
import { shouldShowBlinkingCaret } from './recordVaultBlinkingCaret';

describe('shouldShowBlinkingCaret', () => {
  const base = { empty: true, focused: true, editable: true, composing: false };

  it('draws the caret for a focused, editable, collapsed selection', () => {
    expect(shouldShowBlinkingCaret(base)).toBe(true);
  });

  it('hides it when the editor is not focused', () => {
    expect(shouldShowBlinkingCaret({ ...base, focused: false })).toBe(false);
  });

  it('hides it for a text selection (a range is not a caret)', () => {
    expect(shouldShowBlinkingCaret({ ...base, empty: false })).toBe(false);
  });

  it('hides it in a read-only note', () => {
    expect(shouldShowBlinkingCaret({ ...base, editable: false })).toBe(false);
  });

  it('hides it during IME composition so the browser caret can place candidates', () => {
    expect(shouldShowBlinkingCaret({ ...base, composing: true })).toBe(false);
  });

  it('treats missing flags as hidden', () => {
    expect(shouldShowBlinkingCaret()).toBe(false);
    expect(shouldShowBlinkingCaret({})).toBe(false);
  });
});
