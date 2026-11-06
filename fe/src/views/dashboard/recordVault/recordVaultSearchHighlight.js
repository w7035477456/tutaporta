import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const recordVaultSearchHighlightKey = new PluginKey('recordVaultSearchHighlight');

/**
 * Two independent highlight channels share this one plugin:
 *
 * - `global` — the vault-wide search (Found bar / sidebar blinking chips).
 * - `note`   — the compact Search box inside the note header, which only looks
 *              at the note currently open in the editor ("current page").
 *
 * Each channel keeps its own terms / matches / active hit, so running an
 * in-note search never disturbs the vault-wide highlights and vice versa.
 */
export const SEARCH_CHANNEL_GLOBAL = 'global';
export const SEARCH_CHANNEL_NOTE = 'note';

export const NOTE_SEARCH_HIT_CLASS = 'rv-note-search-hit';
export const NOTE_SEARCH_ACTIVE_CLASS = 'rv-note-search-hit--active';
export const NOTE_SEARCH_ACTIVE_ATTR = 'data-rv-note-search-active';

const CHANNEL_STYLE = {
  [SEARCH_CHANNEL_GLOBAL]: {
    baseClass: 'rv-search-hit',
    activeClass: 'rv-search-hit--active',
    activeAttr: 'data-rv-search-active'
  },
  [SEARCH_CHANNEL_NOTE]: {
    baseClass: NOTE_SEARCH_HIT_CLASS,
    activeClass: NOTE_SEARCH_ACTIVE_CLASS,
    activeAttr: NOTE_SEARCH_ACTIVE_ATTR
  }
};

/** Lowercased, de-duplicated, trimmed search terms (blank terms dropped). */
export function normalizeSearchTerms(terms) {
  if (!Array.isArray(terms)) return [];
  return Array.from(
    new Set(
      terms
        .map((t) =>
          String(t ?? '')
            .trim()
            .toLowerCase()
        )
        .filter((t) => t.length > 0)
    )
  );
}

export function clampSearchHitIndex(index, count) {
  if (count <= 0) return -1;
  const n = Number(index);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(n)));
}

/** Ordered list of every {from,to} range matching any active term. */
export function computeSearchMatches(doc, terms) {
  const lowered = normalizeSearchTerms(terms);
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

function channelStyle(channel) {
  return CHANNEL_STYLE[channel] || CHANNEL_STYLE[SEARCH_CHANNEL_GLOBAL];
}

function buildChannelDecorations(matches, activeIndex, channel) {
  if (!matches.length) return [];
  const { baseClass, activeClass, activeAttr } = channelStyle(channel);
  return matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === activeIndex ? `${baseClass} ${activeClass}` : baseClass,
      ...(i === activeIndex ? { [activeAttr]: 'true' } : {})
    })
  );
}

function emptyChannel() {
  return { terms: [], matches: [], activeIndex: -1, decorations: [] };
}

function rebuildChannel(doc, channel, { terms, activeIndex } = {}) {
  const nextTerms = terms ?? channel.terms;
  const matches = computeSearchMatches(doc, nextTerms);
  const rawIndex = activeIndex ?? channel.activeIndex;
  const nextIndex = matches.length ? clampSearchHitIndex(rawIndex < 0 ? 0 : rawIndex, matches.length) : -1;
  return {
    terms: nextTerms,
    matches,
    activeIndex: nextIndex,
    decorations: buildChannelDecorations(matches, nextIndex, channel.key)
  };
}

function combineDecorations(doc, channels) {
  const all = [];
  for (const key of Object.keys(channels)) {
    const ch = channels[key];
    if (ch?.decorations?.length) all.push(...ch.decorations);
  }
  return all.length ? DecorationSet.create(doc, all) : DecorationSet.empty;
}

/** Match count from plugin state (do not query DOM — decorations paint after dispatch). */
export function getSearchChannelMatchCount(state, channel = SEARCH_CHANNEL_GLOBAL) {
  const pluginState = recordVaultSearchHighlightKey.getState(state);
  const ch = pluginState?.channels?.[channel];
  return ch?.matches?.length ?? 0;
}

function channelHitSelectors(channel) {
  if (channel === SEARCH_CHANNEL_NOTE) {
    return {
      activeSelector: `[${NOTE_SEARCH_ACTIVE_ATTR}="true"]`,
      hitSelector: `.${NOTE_SEARCH_HIT_CLASS}`
    };
  }
  return {
    activeSelector: '[data-rv-search-active="true"]',
    hitSelector: '.rv-search-hit'
  };
}

/**
 * Scroll the active search hit into view — same behavior for Search All (global)
 * and Search Here (note). Uses doc positions + the editor scroll pane so CSS
 * zoom on the note body does not break scrollIntoView on decoration spans.
 */
export function scrollSearchHitIntoView(editor, channel = SEARCH_CHANNEL_GLOBAL) {
  if (!editor?.view) return false;
  const pluginState = recordVaultSearchHighlightKey.getState(editor.state);
  const ch = pluginState?.channels?.[channel];
  if (!ch?.matches?.length || ch.activeIndex < 0) return false;
  const match = ch.matches[ch.activeIndex];
  if (!match) return false;

  const paintThenScroll = () => {
    const view = editor.view;
    if (!view?.dom?.isConnected) return false;

    let coords;
    try {
      coords = view.coordsAtPos(match.from);
    } catch {
      coords = null;
    }

    try {
      editor.commands.focus(undefined, { scrollIntoView: false });
    } catch {
      view.focus();
    }

    const lineMid = coords ? (coords.top + coords.bottom) / 2 : null;
    const body = view.dom.closest('.rv-editor__body');
    if (lineMid != null && body instanceof HTMLElement) {
      const bodyRect = body.getBoundingClientRect();
      const targetScrollTop = body.scrollTop + (lineMid - bodyRect.top) - body.clientHeight * 0.35;
      body.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
    }

    const { activeSelector, hitSelector } = channelHitSelectors(channel);
    const hitEl = view.dom.querySelector(activeSelector) || view.dom.querySelector(hitSelector);
    if (hitEl instanceof HTMLElement) {
      hitEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    if (lineMid != null && typeof window !== 'undefined') {
      const margin = Math.min(160, window.innerHeight * 0.22);
      if (lineMid < margin) {
        window.scrollBy({ top: lineMid - margin, behavior: 'smooth' });
      } else if (lineMid > window.innerHeight - margin) {
        window.scrollBy({ top: lineMid - (window.innerHeight - margin), behavior: 'smooth' });
      }
    }

    return true;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(paintThenScroll);
  });
  return true;
}

/**
 * Highlights the active Record Vault search terms inside the note body and
 * tracks a "current" hit so the user can step through matches (up/down). Every
 * match blinks yellow with the current one blinking red — the vault-wide search
 * and the in-note search bar use the same treatment on separate channels.
 */
export const RecordVaultSearchHighlight = Extension.create({
  name: 'recordVaultSearchHighlight',

  addCommands() {
    const setTerms =
      (channel) =>
      (terms) =>
      ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(
            tr.setMeta(recordVaultSearchHighlightKey, {
              type: 'terms',
              channel,
              terms: normalizeSearchTerms(terms)
            })
          );
        }
        return true;
      };

    const setActive =
      (channel) =>
      (index) =>
      ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(recordVaultSearchHighlightKey, { type: 'active', channel, index }));
        }
        return true;
      };

    const clear =
      (channel) =>
      () =>
      ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(recordVaultSearchHighlightKey, { type: 'terms', channel, terms: [] }));
        }
        return true;
      };

    return {
      /** Vault-wide search highlights (Found bar). */
      setSearchHighlightTerms: setTerms(SEARCH_CHANNEL_GLOBAL),
      setActiveSearchHit: setActive(SEARCH_CHANNEL_GLOBAL),
      clearSearchHighlight: clear(SEARCH_CHANNEL_GLOBAL),
      /** In-note ("current page only") search highlights. */
      setNoteSearchHighlightTerms: setTerms(SEARCH_CHANNEL_NOTE),
      setActiveNoteSearchHit: setActive(SEARCH_CHANNEL_NOTE),
      clearNoteSearchHighlight: clear(SEARCH_CHANNEL_NOTE)
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: recordVaultSearchHighlightKey,
        state: {
          init: () => ({
            channels: {
              [SEARCH_CHANNEL_GLOBAL]: { ...emptyChannel(), key: SEARCH_CHANNEL_GLOBAL },
              [SEARCH_CHANNEL_NOTE]: { ...emptyChannel(), key: SEARCH_CHANNEL_NOTE }
            },
            decorations: DecorationSet.empty
          }),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(recordVaultSearchHighlightKey);
            if (!meta && !tr.docChanged) return value;

            const key = meta?.channel === SEARCH_CHANNEL_NOTE ? SEARCH_CHANNEL_NOTE : SEARCH_CHANNEL_GLOBAL;
            const current = value.channels[key] || { ...emptyChannel(), key };
            const channels = { ...value.channels };

            if (meta?.type === 'terms') {
              channels[key] = rebuildChannel(newState.doc, current, { terms: meta.terms, activeIndex: 0 });
            } else if (meta?.type === 'active') {
              channels[key] = rebuildChannel(newState.doc, current, { activeIndex: meta.index });
            } else if (tr.docChanged) {
              // Live edits can add or remove matches — re-scan every active channel.
              for (const chKey of Object.keys(channels)) {
                const ch = channels[chKey];
                if (!ch?.terms?.length) continue;
                channels[chKey] = rebuildChannel(newState.doc, ch);
              }
            } else {
              return value;
            }

            return { channels, decorations: combineDecorations(newState.doc, channels) };
          }
        },
        props: {
          decorations(state) {
            return recordVaultSearchHighlightKey.getState(state)?.decorations || DecorationSet.empty;
          }
        }
      })
    ];
  }
});

export default RecordVaultSearchHighlight;
