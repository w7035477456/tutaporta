/**
 * Bill Icon tray glyphs that Font Awesome Free has no single icon for (mortgage, home insurance,
 * car smog check, utility / internet bill). Each one is a Font Awesome base icon plus a badge icon,
 * with a transparent gap cut around the badge so it reads on any background color.
 */
import {
  faBolt,
  faCalendarDays,
  faCar,
  faCheck,
  faCirclePlus,
  faCloud,
  faCreditCard,
  faDesktop,
  faDollarSign,
  faFileInvoice,
  faFileInvoiceDollar,
  faGem,
  faHouse,
  faShieldHalved,
  faSquareCheck,
  faWifi
} from '@fortawesome/free-solid-svg-icons';

const VIEW_W = 640;
const VIEW_H = 512;

const BILL_COMPOSITE_ICONS = {
  mortgage: {
    base: faHouse,
    baseBox: { x: 0, y: 0, w: 512, h: 512 },
    badge: faDollarSign,
    badgeBox: { x: 408, y: 192, w: 232, h: 320 }
  },
  'home-insurance': {
    base: faHouse,
    baseBox: { x: 0, y: 0, w: 512, h: 512 },
    badge: faShieldHalved,
    badgeBox: { x: 352, y: 216, w: 288, h: 296 }
  },
  'car-smog-check': {
    draw: (maskId) => drawCarSmogCheck(maskId)
  },
  anniversary: {
    draw: (maskId) => drawAnniversaryRings(maskId)
  },
  'online-bill': {
    draw: (maskId) => drawOnlineBill(maskId)
  },
  'annual-health-checkup': {
    base: faCalendarDays,
    baseBox: { x: 24, y: 0, w: 448, h: 512 },
    badge: faCirclePlus,
    badgeBox: { x: 368, y: 240, w: 272, h: 272 }
  },
  'tax-bill': {
    draw: (maskId) => drawTaxBill(maskId)
  },
  'car-safety-inspection': {
    base: faCar,
    baseBox: { x: 0, y: 0, w: 512, h: 512 },
    badge: faSquareCheck,
    badgeBox: { x: 384, y: 224, w: 256, h: 288 }
  },
  'utility-bill': {
    base: faFileInvoiceDollar,
    baseBox: { x: 40, y: 0, w: 384, h: 512 },
    badge: faBolt,
    badgeBox: { x: 384, y: 176, w: 256, h: 336 }
  },
  'internet-bill': {
    base: faFileInvoice,
    baseBox: { x: 40, y: 0, w: 384, h: 512 },
    badge: faWifi,
    badgeBox: { x: 320, y: 232, w: 320, h: 280 }
  }
};

/** Gap (viewBox units) between the badge and the base icon. */
const BADGE_GAP = 36;

function fitIcon(definition, box) {
  const [w, h, , , pathData] = definition.icon;
  const scale = Math.min(box.w / w, box.h / h);
  const tx = box.x + (box.w - w * scale) / 2;
  const ty = box.y + (box.h - h * scale) / 2;
  return {
    path: Array.isArray(pathData) ? pathData.join(' ') : pathData,
    transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})`,
    scale
  };
}

export function isBillCompositeIconName(iconName) {
  return Object.prototype.hasOwnProperty.call(BILL_COMPOSITE_ICONS, String(iconName ?? ''));
}

/**
 * Inline SVG markup (fill = currentColor). `idSuffix` keeps mask ids unique per rendered copy.
 * @returns {string} '' when the name is not a composite bill icon
 */
export function billCompositeIconSvgMarkup(iconName, idSuffix = '') {
  const spec = BILL_COMPOSITE_ICONS[String(iconName ?? '')];
  if (!spec) return '';
  const maskId = `bill-icon-gap-${iconName}-${String(idSuffix).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="100%" height="100%" ` +
    'fill="currentColor" aria-hidden="true" focusable="false">' +
    (spec.draw ? spec.draw(maskId) : drawBaseWithBadge(spec, maskId)) +
    '</svg>'
  );
}

function maskOpen(maskId) {
  return (
    `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${VIEW_W}" height="${VIEW_H}">` +
    `<rect width="${VIEW_W}" height="${VIEW_H}" fill="#fff"/>`
  );
}

function drawBaseWithBadge(spec, maskId) {
  const base = fitIcon(spec.base, spec.baseBox);
  const badge = fitIcon(spec.badge, spec.badgeBox);
  const gapStroke = ((BADGE_GAP * 2) / badge.scale).toFixed(2);
  return (
    maskOpen(maskId) +
    `<path d="${badge.path}" transform="${badge.transform}" fill="#000" stroke="#000" ` +
    `stroke-width="${gapStroke}" stroke-linejoin="round"/>` +
    '</mask></defs>' +
    `<g mask="url(#${maskId})"><path d="${base.path}" transform="${base.transform}"/></g>` +
    `<path d="${badge.path}" transform="${badge.transform}"/>`
  );
}

function maskWith(maskId, cutouts) {
  return `${maskOpen(maskId)}${cutouts}</mask></defs>`;
}

/** Rear of a car (big back wheel, exhaust pipe) with a smoke puff rising behind it. */
function drawCarSmogCheck(maskId) {
  const bodyMask = `${maskId}-body`;
  const wheelMask = `${maskId}-wheel`;
  const cloudMask = `${maskId}-cloud`;
  const cloud = fitIcon(faCloud, { x: 372, y: -56, w: 268, h: 330 });
  const cloudGap = ((BADGE_GAP * 2) / cloud.scale).toFixed(2);
  const body =
    'M0 96C128 88 232 112 300 176L384 244C420 272 432 300 432 332V392C432 412 418 424 398 424H0Z';
  const rearWindow = 'M0 128C96 124 176 140 236 188L250 200H0Z';
  return (
    maskWith(
      bodyMask,
      `<path d="${rearWindow}" fill="#000"/>` +
        '<rect x="346" y="268" width="62" height="36" rx="14" fill="#000"/>' +
        '<circle cx="196" cy="404" r="128" fill="#000"/>' +
        `<path d="${cloud.path}" transform="${cloud.transform}" fill="#000" stroke="#000" ` +
        `stroke-width="${cloudGap}" stroke-linejoin="round"/>`
    ) +
    maskWith(wheelMask, '<circle cx="196" cy="404" r="46" fill="#000"/>') +
    maskWith(
      cloudMask,
      `<g transform="${cloud.transform}" fill="#000">` +
        '<rect x="168" y="236" width="256" height="52" rx="26"/>' +
        '<rect x="232" y="324" width="192" height="52" rx="26"/>' +
        '</g>'
    ) +
    `<path d="${body}" mask="url(#${bodyMask})"/>` +
    `<circle cx="196" cy="404" r="102" mask="url(#${wheelMask})"/>` +
    '<circle cx="196" cy="404" r="20"/>' +
    '<rect x="380" y="438" width="92" height="28" rx="14"/>' +
    `<g mask="url(#${cloudMask})"><path d="${cloud.path}" transform="${cloud.transform}"/></g>`
  );
}

/** Two interlocked wedding rings (left over at the bottom, right over at the top) with a gem on top. */
function drawAnniversaryRings(maskId) {
  const leftMask = `${maskId}-left`;
  const rightMask = `${maskId}-right`;
  const ring = { r: 156, band: 60, gapBand: 108, cy: 320, leftCx: 238, rightCx: 402 };
  const gem = fitIcon(faGem, { x: 158, y: 0, w: 160, h: 116 });
  const gemGap = (32 / gem.scale).toFixed(2);
  const cutRing = (cx) =>
    `<circle cx="${cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="#000" stroke-width="${ring.gapBand}"/>`;
  const drawRing = (cx, mask) =>
    `<circle cx="${cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="currentColor" ` +
    `stroke-width="${ring.band}" mask="url(#${mask})"/>`;
  return (
    maskWith(
      leftMask,
      cutRing(ring.rightCx) +
        `<rect x="0" y="${ring.cy - 28}" width="${VIEW_W}" height="${VIEW_H}" fill="#fff"/>` +
        `<path d="${gem.path}" transform="${gem.transform}" fill="#000" stroke="#000" stroke-width="${gemGap}"/>`
    ) +
    maskWith(
      rightMask,
      cutRing(ring.leftCx) + `<rect x="0" y="0" width="${VIEW_W}" height="${ring.cy - 28}" fill="#fff"/>`
    ) +
    drawRing(ring.leftCx, leftMask) +
    drawRing(ring.rightCx, rightMask) +
    `<path d="${gem.path}" transform="${gem.transform}"/>`
  );
}

/** Desktop monitor with a check mark on the screen and a credit card in front (pay a bill online). */
function drawOnlineBill(maskId) {
  const monitor = fitIcon(faDesktop, { x: 0, y: 0, w: 512, h: 512 });
  const check = fitIcon(faCheck, { x: 80, y: 76, w: 236, h: 196 });
  const card = fitIcon(faCreditCard, { x: 328, y: 232, w: 312, h: 280 });
  const cardGap = ((BADGE_GAP * 2) / card.scale).toFixed(2);
  return (
    maskWith(
      maskId,
      `<path d="${card.path}" transform="${card.transform}" fill="#000" stroke="#000" ` +
        `stroke-width="${cardGap}" stroke-linejoin="round"/>`
    ) +
    `<g mask="url(#${maskId})"><path d="${monitor.path}" transform="${monitor.transform}"/>` +
    `<path d="${check.path}" transform="${check.transform}"/></g>` +
    `<path d="${card.path}" transform="${card.transform}"/>`
  );
}

/** Tax form ("TAX" header + text lines cut out) with a $ coin over its lower-left corner. */
function drawTaxBill(maskId) {
  const docMask = `${maskId}-doc`;
  const coinMask = `${maskId}-coin`;
  const coin = { cx: 192, cy: 368, r: 140 };
  const dollar = fitIcon(faDollarSign, { x: coin.cx - 70, y: coin.cy - 96, w: 140, h: 192 });
  const lines = [212, 276, 340, 404]
    .map((y) => `<rect x="256" y="${y}" width="232" height="32" rx="16" fill="#000"/>`)
    .join('');
  return (
    maskWith(
      docMask,
      '<text x="384" y="150" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" ' +
        'font-weight="900" font-size="132" letter-spacing="-4" fill="#000">TAX</text>' +
        lines +
        `<circle cx="${coin.cx}" cy="${coin.cy}" r="${coin.r + BADGE_GAP}" fill="#000"/>`
    ) +
    maskWith(coinMask, `<path d="${dollar.path}" transform="${dollar.transform}" fill="#000"/>`) +
    `<rect x="224" y="0" width="320" height="512" rx="36" mask="url(#${docMask})"/>` +
    `<circle cx="${coin.cx}" cy="${coin.cy}" r="${coin.r}" mask="url(#${coinMask})"/>`
  );
}
