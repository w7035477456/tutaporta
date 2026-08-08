/**
 * Album page layout templates (3×3 picker).
 * Slot geometry is % of a template *block* (width × blockHeight), not the whole
 * endless page — so inserting a template can push existing photos below it.
 *
 * Order matches the Page templates picker (row-major). Blue dashed = text slot.
 */

/**
 * Auto N buttons → template id matching the 3×3 picker layouts.
 * Place the first N tray thumbnails into that template's slots in order.
 */
export const PHOTO_ALBUMS_AUTO_LAYOUT_BY_COUNT = {
  2: 't2',
  3: 't5',
  4: 't6',
  5: 't7',
  6: 't9'
};

const IN = 4;
const G = 3;

export const PHOTO_ALBUMS_PAGE_TEMPLATES = [
  {
    id: 't1',
    name: 'Full page',
    slots: [{ type: 'photo', id: 'p1', x: IN, y: IN, w: 100 - IN * 2, h: 100 - IN * 2 }]
  },
  {
    id: 't2',
    name: '2 Horizontal',
    slots: [
      { type: 'photo', id: 'p1', x: IN, y: IN, w: 100 - IN * 2, h: (100 - IN * 2 - G) / 2 },
      {
        type: 'photo',
        id: 'p2',
        x: IN,
        y: IN + (100 - IN * 2 - G) / 2 + G,
        w: 100 - IN * 2,
        h: (100 - IN * 2 - G) / 2
      }
    ]
  },
  {
    // Top: text | photo ; Bottom: full-width photo
    id: 't3',
    name: 'Top split + bottom',
    slots: (() => {
      const halfH = (100 - IN * 2 - G) / 2;
      const halfW = (100 - IN * 2 - G) / 2;
      return [
        { type: 'text', id: 'tx1', x: IN, y: IN, w: halfW, h: halfH },
        { type: 'photo', id: 'p1', x: IN + halfW + G, y: IN, w: halfW, h: halfH },
        { type: 'photo', id: 'p2', x: IN, y: IN + halfH + G, w: 100 - IN * 2, h: halfH }
      ];
    })()
  },
  {
    // Top: full-width photo ; Bottom: photo | text
    id: 't4',
    name: 'Top + bottom split',
    slots: (() => {
      const halfH = (100 - IN * 2 - G) / 2;
      const halfW = (100 - IN * 2 - G) / 2;
      return [
        { type: 'photo', id: 'p1', x: IN, y: IN, w: 100 - IN * 2, h: halfH },
        { type: 'photo', id: 'p2', x: IN, y: IN + halfH + G, w: halfW, h: halfH },
        { type: 'text', id: 'tx1', x: IN + halfW + G, y: IN + halfH + G, w: halfW, h: halfH }
      ];
    })()
  },
  {
    id: 't5',
    name: '3 Horizontal',
    slots: (() => {
      const rowH = (100 - IN * 2 - G * 2) / 3;
      return [0, 1, 2].map((i) => ({
        type: 'photo',
        id: `p${i + 1}`,
        x: IN,
        y: IN + i * (rowH + G),
        w: 100 - IN * 2,
        h: rowH
      }));
    })()
  },
  {
    id: 't6',
    name: '2×2 Grid',
    slots: (() => {
      const cellW = (100 - IN * 2 - G) / 2;
      const cellH = (100 - IN * 2 - G) / 2;
      return [
        { type: 'photo', id: 'p1', x: IN, y: IN, w: cellW, h: cellH },
        { type: 'photo', id: 'p2', x: IN + cellW + G, y: IN, w: cellW, h: cellH },
        { type: 'photo', id: 'p3', x: IN, y: IN + cellH + G, w: cellW, h: cellH },
        { type: 'photo', id: 'p4', x: IN + cellW + G, y: IN + cellH + G, w: cellW, h: cellH }
      ];
    })()
  },
  {
    // Left: tall + short ; Right: three stacked (5 photo slots)
    id: 't7',
    name: 'Left feature + 3 right',
    slots: (() => {
      const colW = (100 - IN * 2 - G) / 2;
      const leftTallH = ((100 - IN * 2 - G) * 2) / 3;
      const leftShortH = (100 - IN * 2 - G) / 3;
      const rightH = (100 - IN * 2 - G * 2) / 3;
      return [
        { type: 'photo', id: 'p1', x: IN, y: IN, w: colW, h: leftTallH },
        { type: 'photo', id: 'p2', x: IN, y: IN + leftTallH + G, w: colW, h: leftShortH },
        { type: 'photo', id: 'p3', x: IN + colW + G, y: IN, w: colW, h: rightH },
        { type: 'photo', id: 'p4', x: IN + colW + G, y: IN + rightH + G, w: colW, h: rightH },
        {
          type: 'photo',
          id: 'p5',
          x: IN + colW + G,
          y: IN + (rightH + G) * 2,
          w: colW,
          h: rightH
        }
      ];
    })()
  },
  {
    // Left: three stacked (narrower) ; Right: three stacked (wider) — 6 slots
    id: 't8',
    name: '3+3 Columns',
    slots: (() => {
      const leftW = 36;
      const rightW = 100 - IN * 2 - G - leftW;
      const rowH = (100 - IN * 2 - G * 2) / 3;
      const out = [];
      for (let i = 0; i < 3; i += 1) {
        out.push({
          type: 'photo',
          id: `p${i + 1}`,
          x: IN,
          y: IN + i * (rowH + G),
          w: leftW,
          h: rowH
        });
        out.push({
          type: 'photo',
          id: `p${i + 4}`,
          x: IN + leftW + G,
          y: IN + i * (rowH + G),
          w: rightW,
          h: rowH
        });
      }
      return out;
    })()
  },
  {
    id: 't9',
    name: '2×3 Grid',
    slots: (() => {
      const cellW = (100 - IN * 2 - G) / 2;
      const cellH = (100 - IN * 2 - G * 2) / 3;
      const out = [];
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          out.push({
            type: 'photo',
            id: `p${row * 2 + col + 1}`,
            x: IN + col * (cellW + G),
            y: IN + row * (cellH + G),
            w: cellW,
            h: cellH
          });
        }
      }
      return out;
    })()
  }
];

/** Page aspect units: Portrait 10×12, Landscape 12×10. */
export const ALBUM_PAGE_ASPECT_PORTRAIT_W = 10;
export const ALBUM_PAGE_ASPECT_PORTRAIT_H = 12;
export const ALBUM_PAGE_ASPECT_LANDSCAPE_W = 12;
export const ALBUM_PAGE_ASPECT_LANDSCAPE_H = 10;

/** Pixel height of the template band for a page width + orientation. */
export function albumTemplateBlockHeight(pageWidth, orientation = 'portrait') {
  const pw = Math.max(240, Number(pageWidth) || 480);
  const mode = String(orientation || 'portrait').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
  // Portrait: 10 wide × 12 tall. Landscape: 12 wide × 10 tall.
  const ratio =
    mode === 'landscape'
      ? ALBUM_PAGE_ASPECT_LANDSCAPE_H / ALBUM_PAGE_ASPECT_LANDSCAPE_W
      : ALBUM_PAGE_ASPECT_PORTRAIT_H / ALBUM_PAGE_ASPECT_PORTRAIT_W;
  return Math.max(mode === 'landscape' ? 280 : 360, Math.round(pw * ratio));
}

export function getPhotoAlbumsPageTemplate(templateId) {
  const id = String(templateId || '').trim();
  return PHOTO_ALBUMS_PAGE_TEMPLATES.find((t) => t.id === id) || null;
}

/** Convert a % slot into px rect inside the template block. */
export function albumSlotToPx(slot, pageWidth, pageHeight) {
  const pw = Math.max(1, Number(pageWidth) || 1);
  const ph = Math.max(1, Number(pageHeight) || 1);
  return {
    id: slot.id,
    type: slot.type,
    left: Math.round((Number(slot.x) / 100) * pw),
    top: Math.round((Number(slot.y) / 100) * ph),
    width: Math.round((Number(slot.w) / 100) * pw),
    height: Math.round((Number(slot.h) / 100) * ph)
  };
}

/**
 * Snap a dragged photo into the nearest dotted slot when close enough.
 * Accepts both red photo slots and blue text slots (any dashed frame can "take" a photo).
 * `offsetLeft` / `offsetTop` are the template block's origin on the page.
 * Optional `slots` overrides the template's default slot list (instance edits).
 * Returns { left, top, width, height, slotId } or null.
 */
export function findAlbumPhotoSnapTarget({
  template,
  pageWidth,
  pageHeight,
  offsetLeft = 0,
  offsetTop = 0,
  left,
  top,
  photoWidth,
  photoHeight,
  thresholdPx = 96,
  slots: slotsOverride = null
}) {
  if (!template && !slotsOverride) return null;
  // Any dashed template frame can receive a photo (photo + text slots).
  const source = Array.isArray(slotsOverride)
    ? slotsOverride
    : resolveAlbumTemplateSlots(template, null);
  const slots = (source || []).filter((s) => s.type === 'photo' || s.type === 'text');
  if (!slots.length) return null;

  const originX = Number(offsetLeft) || 0;
  const originY = Number(offsetTop) || 0;
  const pw = Math.max(1, Number(photoWidth) || 1);
  const ph = Math.max(1, Number(photoHeight) || 1);
  // Use the drag pointer / tile center, but clamp contribution of huge cover sizes
  // so an already-large photo still snaps when dropped over a slot.
  const probeW = Math.min(pw, 280);
  const probeH = Math.min(ph, 280);
  const cx = left + probeW / 2;
  const cy = top + probeH / 2;

  let best = null;
  let bestScore = Infinity;

  for (const slot of slots) {
    const rect = albumSlotToPx(slot, pageWidth, pageHeight);
    const slotLeft = originX + rect.left;
    const slotTop = originY + rect.top;
    const slotRight = slotLeft + rect.width;
    const slotBottom = slotTop + rect.height;
    const sx = slotLeft + rect.width / 2;
    const sy = slotTop + rect.height / 2;
    const dist = Math.hypot(cx - sx, cy - sy);

    // Strong take: center of the dragged photo is inside the dotted frame.
    const centerInside =
      cx >= slotLeft && cx <= slotRight && cy >= slotTop && cy <= slotBottom;
    // Soft take: near the frame (scaled by slot size so large frames are easier to hit).
    const reach = Math.max(thresholdPx, Math.min(rect.width, rect.height) * 0.45);

    if (!centerInside && dist > reach) continue;

    // Prefer an enclosing slot, then the closest center.
    const score = centerInside ? dist * 0.25 : dist;
    if (score < bestScore) {
      bestScore = score;
      best = rect;
    }
  }

  if (!best) return null;

  return {
    left: originX + best.left,
    top: originY + best.top,
    width: Math.max(80, best.width),
    height: best.height,
    slotId: best.id
  };
}

export function parseAlbumTemplateIdFromHtml(html) {
  const raw = String(html || '');
  const match = raw.match(/data-rv-album-template[^>]*data-template-id=["']([^"']+)["']/i)
    || raw.match(/data-template-id=["']([^"']+)["'][^>]*data-rv-album-template/i);
  return match ? String(match[1]).trim() : '';
}

function parseTemplatePxAttr(html, attr) {
  const raw = String(html || '');
  const re = new RegExp(`${attr}=["'](\\d+)["']`, 'i');
  const match = raw.match(re);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function parseAlbumTemplateBlockHeightFromHtml(html) {
  return parseTemplatePxAttr(html, 'data-template-h');
}

export function parseAlbumTemplateBlockWidthFromHtml(html) {
  return parseTemplatePxAttr(html, 'data-template-w');
}

export function parseAlbumTemplateOffsetXFromHtml(html) {
  const raw = String(html || '');
  const match = raw.match(/data-template-x=["'](\d+)["']/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export function parseAlbumTemplateOffsetYFromHtml(html) {
  const raw = String(html || '');
  const match = raw.match(/data-template-y=["'](\d+)["']/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** @typedef {{ x: number, y: number, w: number, h: number }} AlbumSlotOverride */
/** @typedef {{ key: string, id: string, x: number, y: number, w: number, h: number, slots?: Record<string, AlbumSlotOverride>|null }} AlbumTemplateInstance */

function clampSlotPct(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** Normalize optional per-slot % overrides keyed by slot id. */
export function normalizeAlbumSlotOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [id, val] of Object.entries(raw)) {
    const key = String(id || '').trim();
    if (!key || !val || typeof val !== 'object') continue;
    const x = clampSlotPct(val.x, 0, 99);
    const y = clampSlotPct(val.y, 0, 99);
    const w = clampSlotPct(val.w, 4, 100 - x);
    const h = clampSlotPct(val.h, 4, 100 - y);
    out[key] = { x, y, w, h };
  }
  return Object.keys(out).length ? out : null;
}

/** Merge template slot defs with instance overrides (percent geometry). */
export function resolveAlbumTemplateSlots(template, overrides) {
  const base = template?.slots || [];
  const map = normalizeAlbumSlotOverrides(overrides);
  if (!map) return base.map((s) => ({ ...s }));
  return base.map((slot) => {
    const o = map[slot.id];
    if (!o) return { ...slot };
    return { ...slot, x: o.x, y: o.y, w: o.w, h: o.h };
  });
}

export function createAlbumTemplateInstance({
  id,
  x = 0,
  y = 0,
  w = 0,
  h = 0,
  key = '',
  slots = null
}) {
  return {
    key: String(key || `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    id: String(id || '').trim(),
    x: Math.max(0, Math.round(Number(x) || 0)),
    y: Math.max(0, Math.round(Number(y) || 0)),
    w: Math.max(0, Math.round(Number(w) || 0)),
    h: Math.max(0, Math.round(Number(h) || 0)),
    slots: normalizeAlbumSlotOverrides(slots)
  };
}

/**
 * Read one or many template instances from saved HTML.
 * Supports legacy single-template attrs and `data-album-templates` JSON.
 * @returns {AlbumTemplateInstance[]}
 */
export function parseAlbumTemplateInstancesFromHtml(html) {
  const raw = String(html || '');
  const jsonMatch = raw.match(/data-album-templates=["']([^"']*)["']/i);
  if (jsonMatch) {
    try {
      const decoded = jsonMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            createAlbumTemplateInstance({
              key: item?.key,
              id: item?.id,
              x: item?.x,
              y: item?.y,
              w: item?.w,
              h: item?.h,
              slots: item?.slots
            })
          )
          .filter((t) => t.id);
      }
    } catch {
      // fall through to legacy
    }
  }

  const id = parseAlbumTemplateIdFromHtml(raw);
  if (!id) return [];
  return [
    createAlbumTemplateInstance({
      id,
      x: parseAlbumTemplateOffsetXFromHtml(raw),
      y: parseAlbumTemplateOffsetYFromHtml(raw),
      w: parseAlbumTemplateBlockWidthFromHtml(raw),
      h: parseAlbumTemplateBlockHeightFromHtml(raw)
    })
  ];
}

/** Serialize template instances for the hidden marker attribute. */
export function serializeAlbumTemplateInstances(instances) {
  const list = (Array.isArray(instances) ? instances : [])
    .map((item) =>
      createAlbumTemplateInstance({
        key: item?.key,
        id: item?.id,
        x: item?.x,
        y: item?.y,
        w: item?.w,
        h: item?.h,
        slots: item?.slots
      })
    )
    .filter((t) => t.id);
  if (!list.length) return '';
  return JSON.stringify(
    list.map((t) => {
      const row = {
        key: t.key,
        id: t.id,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h
      };
      if (t.slots) row.slots = t.slots;
      return row;
    })
  ).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Best snap among several template instances.
 * Callers should pass only the visible page instance(s).
 * Returns snap rect plus `instanceKey` / `highlightId`.
 */
export function findAlbumPhotoSnapAmongInstances({
  instances,
  left,
  top,
  photoWidth,
  photoHeight,
  thresholdPx = 96
}) {
  const list = Array.isArray(instances) ? instances : [];
  let best = null;
  let bestScore = Infinity;

  for (const inst of list) {
    const template = getPhotoAlbumsPageTemplate(inst.id);
    if (!template) continue;
    const blockW = inst.w > 0 ? inst.w : 480;
    const blockH = inst.h > 0 ? inst.h : albumTemplateBlockHeight(blockW);
    const slots = resolveAlbumTemplateSlots(template, inst.slots);
    const snap = findAlbumPhotoSnapTarget({
      template,
      pageWidth: blockW,
      pageHeight: blockH,
      offsetLeft: inst.x || 0,
      offsetTop: inst.y || 0,
      left,
      top,
      photoWidth,
      photoHeight,
      thresholdPx,
      slots
    });
    if (!snap) continue;
    const cx = left + Math.min(Number(photoWidth) || 1, 280) / 2;
    const cy = top + Math.min(Number(photoHeight) || 1, 280) / 2;
    const score = Math.hypot(cx - (snap.left + snap.width / 2), cy - (snap.top + snap.height / 2));
    if (score < bestScore) {
      bestScore = score;
      best = {
        ...snap,
        instanceKey: inst.key,
        highlightId: `${inst.key}:${snap.slotId}`
      };
    }
  }

  return best;
}
