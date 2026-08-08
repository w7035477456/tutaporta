import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const photoAlbumsSearchHighlightKey = new PluginKey('photoAlbumsSearchHighlight');

function normalizeTerms(terms) {
  if (!Array.isArray(terms)) return [];
  return Array.from(
    new Set(
      terms
        .map((t) => String(t ?? '').trim().toLowerCase())
        .filter((t) => t.length > 0)
    )
  );
}

function clampIndex(index, count) {
  if (count <= 0) return -1;
  const n = Number(index);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(n)));
}

/** Ordered list of every {from,to} range matching any active term. */
function computeMatches(doc, terms) {
  const lowered = normalizeTerms(terms);
  const matches = [];
  if (!lowered.length) return matches;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const lc = node.text.toLowerCase();
    for (const term of lowered) {
      let idx = lc.indexOf(term);
      while (idx !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + term.length });
        idx = lc.indexOf(term, idx + term.length);
      }
    }
  });
  matches.sort((a, b) => a.from - b.from || a.to - b.to);
  return matches;
}

function buildDecorationSet(doc, matches, activeIndex) {
  if (!matches.length) return DecorationSet.empty;
  const decorations = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class:
        i === activeIndex ? 'rv-search-hit rv-search-hit--active' : 'rv-search-hit',
      ...(i === activeIndex ? { 'data-rv-search-active': 'true' } : {})
    })
  );
  return DecorationSet.create(doc, decorations);
}

/**
 * Highlights the active Record Vault search terms inside the note body and
 * tracks a "current" hit so the user can step through matches (up/down). Every
 * match blinks red/yellow/green; the current one gets a distinct, faster blink.
 */
export const PhotoAlbumsSearchHighlight = Extension.create({
  name: 'photoAlbumsSearchHighlight',

  addCommands() {
    return {
      setSearchHighlightTerms:
        (terms) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(
              tr.setMeta(photoAlbumsSearchHighlightKey, {
                type: 'terms',
                terms: normalizeTerms(terms)
              })
            );
          }
          return true;
        },
      setActiveSearchHit:
        (index) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(
              tr.setMeta(photoAlbumsSearchHighlightKey, { type: 'active', index })
            );
          }
          return true;
        }
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: photoAlbumsSearchHighlightKey,
        state: {
          init: () => ({
            terms: [],
            matches: [],
            activeIndex: -1,
            decorations: DecorationSet.empty
          }),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(photoAlbumsSearchHighlightKey);
            if (meta?.type === 'terms') {
              const matches = computeMatches(newState.doc, meta.terms);
              const activeIndex = matches.length ? 0 : -1;
              return {
                terms: meta.terms,
                matches,
                activeIndex,
                decorations: buildDecorationSet(newState.doc, matches, activeIndex)
              };
            }
            if (meta?.type === 'active') {
              const activeIndex = clampIndex(meta.index, value.matches.length);
              return {
                ...value,
                activeIndex,
                decorations: buildDecorationSet(newState.doc, value.matches, activeIndex)
              };
            }
            if (tr.docChanged && value.terms.length) {
              const matches = computeMatches(newState.doc, value.terms);
              const activeIndex = clampIndex(
                value.activeIndex < 0 ? 0 : value.activeIndex,
                matches.length
              );
              return {
                terms: value.terms,
                matches,
                activeIndex,
                decorations: buildDecorationSet(newState.doc, matches, activeIndex)
              };
            }
            return value;
          }
        },
        props: {
          decorations(state) {
            return (
              photoAlbumsSearchHighlightKey.getState(state)?.decorations || DecorationSet.empty
            );
          }
        }
      })
    ];
  }
});

export default PhotoAlbumsSearchHighlight;
