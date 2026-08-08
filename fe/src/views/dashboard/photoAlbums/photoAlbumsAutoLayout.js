/**
 * Auto Layout — plan template pages for thumbnail-tray photos (sequential order,
 * portrait/landscape slot matching, 2–6 photos per page; prefer 3–6).
 */

import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import {
  albumTemplateBlockHeight,
  getPhotoAlbumsPageTemplate,
  PHOTO_ALBUMS_AUTO_LAYOUT_BY_COUNT,
  resolveAlbumTemplateSlots
} from './photoAlbumsPageTemplates';
import { getStagingAttachmentPreview } from './photoAlbumsStagingPreviewCache';
import { isPhotoAlbumsStagingVideoExtension } from 'utils/photoAlbumsFileFormats';

export const AUTO_LAYOUT_MIN_BATCH = 2;
export const AUTO_LAYOUT_MAX_BATCH = 6;
export const AUTO_LAYOUT_PREFERRED_MIN = 3;

/** Photo-only templates eligible for auto layout (by slot count). */
const AUTO_LAYOUT_TEMPLATES_BY_COUNT = {
  1: ['t1'],
  2: ['t2'],
  3: ['t5'],
  4: ['t6'],
  5: ['t7'],
  6: ['t8', 't9']
};

const PREFERRED_BATCH_BONUS = 0.4;
const LANDSCAPE_ASPECT = 1.12;
const PORTRAIT_ASPECT = 0.88;

export function classifyPhotoOrientation(aspect) {
  const a = Number(aspect);
  if (!Number.isFinite(a) || a <= 0) return 'square';
  if (a >= LANDSCAPE_ASPECT) return 'landscape';
  if (a <= PORTRAIT_ASPECT) return 'portrait';
  return 'square';
}

/** Slot aspect (width/height) in page pixels for a % slot on the template block. */
export function slotAspectRatio(slot, pageWidth, pageOrientation = 'portrait') {
  const pw = Math.max(200, Number(pageWidth) || 480);
  const ph = albumTemplateBlockHeight(pw, pageOrientation);
  const sw = Math.max(1, (Number(slot.w) / 100) * pw);
  const sh = Math.max(1, (Number(slot.h) / 100) * ph);
  return sw / sh;
}

export function classifySlotOrientation(slot, pageWidth, pageOrientation = 'portrait') {
  return classifyPhotoOrientation(slotAspectRatio(slot, pageWidth, pageOrientation));
}

function orientationMatchScore(photoOrient, slotOrient) {
  if (photoOrient === slotOrient) return 1;
  if (photoOrient === 'square' || slotOrient === 'square') return 0.72;
  return 0.18;
}

function photoSlotsForTemplate(templateId) {
  const layout = getPhotoAlbumsPageTemplate(templateId);
  if (!layout) return [];
  return resolveAlbumTemplateSlots(layout, null).filter((s) => s.type === 'photo');
}

function scoreTemplateForPhotos(photos, templateId, pageWidth, pageOrientation) {
  const slots = photoSlotsForTemplate(templateId);
  if (!slots.length || photos.length !== slots.length) return -1;
  let score = 0;
  for (let i = 0; i < photos.length; i += 1) {
    score += orientationMatchScore(
      photos[i].orient,
      classifySlotOrientation(slots[i], pageWidth, pageOrientation)
    );
  }
  return score / photos.length;
}

function templateCandidatesForCount(count) {
  const n = Math.round(Number(count) || 0);
  if (n === 1) return AUTO_LAYOUT_TEMPLATES_BY_COUNT[1] || ['t1'];
  if (AUTO_LAYOUT_TEMPLATES_BY_COUNT[n]) return AUTO_LAYOUT_TEMPLATES_BY_COUNT[n];
  const mapped = PHOTO_ALBUMS_AUTO_LAYOUT_BY_COUNT[n];
  return mapped ? [mapped] : [];
}

function batchSizeBonus(count) {
  if (count >= AUTO_LAYOUT_PREFERRED_MIN && count <= AUTO_LAYOUT_MAX_BATCH) return PREFERRED_BATCH_BONUS;
  return 0;
}

/**
 * Pick the best template for the next `photos` batch (already sliced).
 * @returns {{ templateId: string, orientation: string, score: number } | null}
 */
export function pickBestAutoLayoutBatch(photos, pageWidth, pageOrientation = 'portrait') {
  const batch = Array.isArray(photos) ? photos : [];
  const count = batch.length;
  if (count < 1) return null;

  let best = null;
  let bestTotal = -Infinity;

  const templateIds =
    count === 1 ? templateCandidatesForCount(1) : templateCandidatesForCount(count);

  for (const templateId of templateIds) {
    const match = scoreTemplateForPhotos(batch, templateId, pageWidth, pageOrientation);
    if (match < 0) continue;
    const total = match + batchSizeBonus(count);
    if (total > bestTotal) {
      bestTotal = total;
      best = { templateId, orientation: pageOrientation, score: match };
    }
  }

  return best;
}

function sumPlanScore(plan, pageWidth, pageOrientation) {
  let total = 0;
  for (const page of plan || []) {
    total += scoreTemplateForPhotos(page.photos, page.templateId, pageWidth, pageOrientation);
  }
  return total;
}

/**
 * Pick the next single page batch from the front of `queue` (mutates queue).
 * @param {{ maxPhotos?: number }} options — cap used when saving photos for the facing page.
 * @returns {{ templateId: string, orientation: string, photos: object[] } | null}
 */
function takeNextAutoLayoutPage(queue, pageWidth, orient, { maxPhotos = Infinity } = {}) {
  if (!queue.length) return null;
  const hardCap = Math.max(1, Math.min(queue.length, Math.round(Number(maxPhotos) || Infinity)));
  if (hardCap === 1 || queue.length === 1) {
    return {
      templateId: 't1',
      orientation: orient,
      photos: [queue.shift()]
    };
  }

  const maxTry = Math.min(hardCap, queue.length, AUTO_LAYOUT_MAX_BATCH);
  let picked = null;
  let pickedCount = 0;

  for (let count = maxTry; count >= AUTO_LAYOUT_MIN_BATCH; count -= 1) {
    const slice = queue.slice(0, count);
    const choice = pickBestAutoLayoutBatch(slice, pageWidth, orient);
    if (!choice) continue;
    const total = choice.score + batchSizeBonus(count);
    if (!picked || total > picked.total || (total === picked.total && count > pickedCount)) {
      picked = { ...choice, total };
      pickedCount = count;
    }
  }

  if (!picked) {
    return {
      templateId: 't1',
      orientation: orient,
      photos: [queue.shift()]
    };
  }

  return {
    templateId: picked.templateId,
    orientation: orient,
    photos: queue.splice(0, pickedCount)
  };
}

/**
 * Build a multi-page auto layout plan from staged photos (tray order preserved).
 * Pages are planned in open-book spreads: left template + right template, then the next spread.
 * When a spread needs 2 pages, left is capped so the right page still gets photos.
 * When `tryBothPageOrientations` is true (empty album), picks portrait vs landscape for the whole run.
 * @param {{
 *   tryBothPageOrientations?: boolean,
 *   maxPages?: number,
 *   maxSpreads?: number,
 *   firstSpreadPageCount?: number
 * }} options
 *   firstSpreadPageCount: 1 = only finish an odd (right) page first; 2 = full left+right (default).
 * @returns {{ plan: Array<{ templateId: string, orientation: string, photos: object[] }>, pageOrientation: string }}
 */
export function planAutoLayoutPages(
  stagedPhotosWithAspect,
  pageWidth,
  defaultOrientation = 'portrait',
  {
    tryBothPageOrientations = false,
    maxPages = Infinity,
    maxSpreads = Infinity,
    firstSpreadPageCount = 2
  } = {}
) {
  const pageLimit = Math.max(1, Math.round(Number(maxPages) || Infinity));
  const spreadLimit = Number.isFinite(maxSpreads)
    ? Math.max(0, Math.round(Number(maxSpreads)))
    : Infinity;
  const firstCount = firstSpreadPageCount === 1 ? 1 : 2;

  const buildForOrient = (orient) => {
    const queue = [...(Array.isArray(stagedPhotosWithAspect) ? stagedPhotosWithAspect : [])];
    const pages = [];
    let spreads = 0;

    while (queue.length > 0 && pages.length < pageLimit && spreads < spreadLimit) {
      const pagesThisSpread = spreads === 0 ? firstCount : 2;
      if (pagesThisSpread >= 2 && queue.length >= 2) {
        // Keep photos for the facing page — do not dump the whole tray onto the left.
        const reserveForRight = 1;
        const leftCap = Math.min(
          AUTO_LAYOUT_MAX_BATCH,
          Math.max(1, queue.length - reserveForRight),
          Math.max(AUTO_LAYOUT_MIN_BATCH, Math.ceil(queue.length / 2))
        );
        const left = takeNextAutoLayoutPage(queue, pageWidth, orient, { maxPhotos: leftCap });
        if (left) pages.push(left);
        if (queue.length > 0 && pages.length < pageLimit) {
          const right = takeNextAutoLayoutPage(queue, pageWidth, orient);
          if (right) pages.push(right);
        }
      } else {
        for (let i = 0; i < pagesThisSpread && queue.length > 0 && pages.length < pageLimit; i += 1) {
          const next = takeNextAutoLayoutPage(queue, pageWidth, orient);
          if (!next) break;
          pages.push(next);
        }
      }
      spreads += 1;
    }

    return pages;
  };

  const mode =
    String(defaultOrientation || 'portrait').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';

  if (!tryBothPageOrientations) {
    return { plan: buildForOrient(mode), pageOrientation: mode };
  }

  const portraitPlan = buildForOrient('portrait');
  const landscapePlan = buildForOrient('landscape');
  const portraitScore = sumPlanScore(portraitPlan, pageWidth, 'portrait');
  const landscapeScore = sumPlanScore(landscapePlan, pageWidth, 'landscape');

  if (landscapeScore > portraitScore + 0.08) {
    return { plan: landscapePlan, pageOrientation: 'landscape' };
  }
  return { plan: portraitPlan, pageOrientation: 'portrait' };
}

/**
 * Fill empty photo slots on existing template pages before appending new pages.
 * Tray order preserved; slots filled left-to-right on each page.
 * @returns {{ fills: Array<{ inst: object, photos: object[], slots: object[] }>, remainingPhotos: object[] }}
 */
export function planFillEmptyTemplatePages(
  instances,
  photosWithAspect,
  occupiedByKey,
  { maxPages = Infinity, startIndex = 0 } = {}
) {
  const pages = Array.isArray(instances) ? instances : [];
  const queue = [...(Array.isArray(photosWithAspect) ? photosWithAspect : [])];
  const fills = [];
  const pageLimit = Number.isFinite(maxPages) ? Math.max(0, Math.round(maxPages)) : Infinity;
  const start = Math.max(0, Math.round(Number(startIndex) || 0));

  for (let i = start; i < pages.length && queue.length > 0; i += 1) {
    if (fills.length >= pageLimit) break;
    const inst = pages[i];
    const layout = getPhotoAlbumsPageTemplate(inst.id);
    if (!layout) continue;
    const photoSlots = resolveAlbumTemplateSlots(layout, inst.slots).filter((s) => s.type === 'photo');
    const occupied = occupiedByKey?.[inst.key];
    const occupiedSet =
      occupied instanceof Set ? occupied : new Set(Array.isArray(occupied) ? occupied : []);
    const emptySlots = photoSlots.filter((s) => !occupiedSet.has(s.id));
    if (!emptySlots.length) continue;

    const take = Math.min(emptySlots.length, queue.length);
    fills.push({
      inst,
      photos: queue.splice(0, take),
      slots: emptySlots.slice(0, take)
    });
  }

  return { fills, remainingPhotos: queue };
}

function loadVideoAspectFromUrl(url) {
  return new Promise((resolve) => {
    const src = String(url || '').trim();
    if (!src) {
      resolve(null);
      return;
    }
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      if (vid.videoWidth > 0 && vid.videoHeight > 0) {
        resolve(vid.videoWidth / vid.videoHeight);
      } else {
        resolve(null);
      }
      vid.removeAttribute('src');
      vid.load();
    };
    vid.onerror = () => resolve(null);
    vid.src = src;
  });
}

function loadImageAspectFromUrl(url) {
  return new Promise((resolve) => {
    const src = String(url || '').trim();
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img.naturalWidth / img.naturalHeight);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Resolve natural aspect (width/height) for each staging-tray item.
 */
export async function resolveStagingPhotoAspects(stagedItems, { noteId, storageType } = {}) {
  const list = Array.isArray(stagedItems) ? stagedItems : [];
  const out = [];

  for (const item of list) {
    let aspect = null;
    const isVideo = isPhotoAlbumsStagingVideoExtension(item?.fileExtension);
    const previewUrl = String(item?.localPreviewUrl || getStagingAttachmentPreview(item?.attachmentId) || '');
    if (previewUrl) {
      aspect = isVideo
        ? await loadVideoAspectFromUrl(previewUrl)
        : await loadImageAspectFromUrl(previewUrl);
    }

    const nid = Number(noteId);
    const attachmentId = Number(item?.attachmentId);
    if (!aspect && Number.isFinite(nid) && nid > 0 && Number.isFinite(attachmentId) && attachmentId > 0) {
      try {
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
          inline: true,
          storageType
        });
        if (blob && blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          aspect = isVideo
            ? await loadVideoAspectFromUrl(objUrl)
            : await loadImageAspectFromUrl(objUrl);
          URL.revokeObjectURL(objUrl);
        }
      } catch {
        // keep fallback aspect
      }
    }

    const safeAspect =
      Number.isFinite(aspect) && aspect > 0 ? aspect : isVideo ? 16 / 9 : 4 / 3;
    out.push({
      ...item,
      aspect: safeAspect,
      orient: classifyPhotoOrientation(safeAspect)
    });
  }

  return out;
}

function clampPan(panX, panY, photoW, photoH, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const pw = Math.max(1, photoW);
  const ph = Math.max(1, photoH);
  const minOverlapX = Math.max(24, Math.min(64, Math.round(fw * 0.12)));
  const minOverlapY = Math.max(24, Math.min(64, Math.round(fh * 0.12)));
  return {
    panX: Math.round(Math.min(fw - minOverlapX, Math.max(minOverlapX - pw, panX))),
    panY: Math.round(Math.min(fh - minOverlapY, Math.max(minOverlapY - ph, panY)))
  };
}

/** Contain-fit framed attrs for placing a photo into a template slot (page coords). */
export function buildFramedPhotoAttrsForSlot(aspect, slotRect, originLeft, originTop) {
  const fw = Math.max(80, Math.round(slotRect.width) || 80);
  const fh = Math.max(40, Math.round(slotRect.height) || 40);
  const left = Math.round(originLeft + (slotRect.left || 0));
  const top = Math.round(originTop + (slotRect.top || 0));
  const a = Number(aspect) > 0 ? Number(aspect) : 4 / 3;

  let pw = fw;
  let ph = Math.round(pw / a);
  if (ph > fh) {
    ph = fh;
    pw = Math.round(ph * a);
  }

  const pan = clampPan(
    Math.round((fw - pw) / 2),
    Math.round((fh - ph) / 2),
    pw,
    ph,
    fw,
    fh
  );

  return {
    posLeft: left,
    posTop: top,
    width: pw,
    height: ph,
    panX: pan.panX,
    panY: pan.panY,
    frameLeft: left,
    frameTop: top,
    frameWidth: fw,
    frameHeight: fh,
    slotFit: 'contain'
  };
}
