import { describe, expect, it } from 'vitest';
import { clampSearchHitIndex, computeSearchMatches, normalizeSearchTerms } from './recordVaultSearchHighlight';

/** Minimal ProseMirror-doc stand-in: only `descendants` over plain text nodes. */
function fakeDoc(texts) {
  const nodes = [];
  let pos = 1;
  for (const text of texts) {
    nodes.push({ node: { isText: true, text }, pos });
    pos += text.length;
  }
  return {
    descendants: (fn) => nodes.forEach(({ node, pos: p }) => fn(node, p))
  };
}

describe('recordVaultSearchHighlight helpers', () => {
  it('normalizes terms (trim, lowercase, de-dupe, drop blanks)', () => {
    expect(normalizeSearchTerms([' Evernote ', 'evernote', '', '   ', 'PPP', null])).toEqual(['evernote', 'ppp']);
    expect(normalizeSearchTerms(undefined)).toEqual([]);
  });

  it('clamps hit indexes into range', () => {
    expect(clampSearchHitIndex(-5, 3)).toBe(0);
    expect(clampSearchHitIndex(9, 3)).toBe(2);
    expect(clampSearchHitIndex(1.4, 3)).toBe(1);
    expect(clampSearchHitIndex('1', 3)).toBe(1);
    expect(clampSearchHitIndex(0, 0)).toBe(-1);
  });

  it('finds every case-insensitive match across text nodes, in document order', () => {
    const doc = fakeDoc(['Evernote backup key', 'and evernote again']);
    const matches = computeSearchMatches(doc, ['evernote']);
    // First node starts at pos 1 (19 chars) → second node starts at pos 20.
    expect(matches).toEqual([
      { from: 1, to: 9 },
      { from: 24, to: 32 }
    ]);
  });

  it('finds repeated hits inside one text node', () => {
    const doc = fakeDoc(['aa aa aa']);
    expect(computeSearchMatches(doc, ['aa'])).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 6 },
      { from: 7, to: 9 }
    ]);
  });

  it('returns no matches for empty terms', () => {
    const doc = fakeDoc(['evernote']);
    expect(computeSearchMatches(doc, [])).toEqual([]);
    expect(computeSearchMatches(doc, ['  '])).toEqual([]);
  });
});
