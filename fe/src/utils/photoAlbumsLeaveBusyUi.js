/**
 * Site-wide busy state while Exit to Mall / site logout flushes Cloud + USB vaults.
 * MainLayout hosts BusyHourglassOverlay; flushPhotoAlbumsSessionsOnLeave drives updates.
 */

const listeners = new Set();

let leaveBusy = {
  open: false,
  title: 'Saving vault',
  percent: 0,
  label: ''
};

function publish() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  });
}

export function getPhotoAlbumsLeaveBusySnapshot() {
  return leaveBusy;
}

export function subscribePhotoAlbumsLeaveBusy(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginPhotoAlbumsLeaveBusy({ title = 'Saving vault', percent = 1, label = '' } = {}) {
  leaveBusy = {
    open: true,
    title: String(title || 'Saving vault'),
    percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
    label: label ? String(label) : ''
  };
  publish();
}

export function updatePhotoAlbumsLeaveBusy({ percent, label, title } = {}) {
  if (!leaveBusy.open) {
    beginPhotoAlbumsLeaveBusy({ title, percent, label });
    return;
  }
  const nextPercent =
    percent != null && Number.isFinite(Number(percent))
      ? Math.max(leaveBusy.percent, Math.max(0, Math.min(100, Math.round(Number(percent)))))
      : leaveBusy.percent;
  leaveBusy = {
    ...leaveBusy,
    percent: nextPercent >= 100 ? 100 : nextPercent,
    label: label != null && String(label).trim() ? String(label).trim() : leaveBusy.label,
    title: title != null && String(title).trim() ? String(title).trim() : leaveBusy.title
  };
  publish();
}

export function endPhotoAlbumsLeaveBusy() {
  if (!leaveBusy.open && leaveBusy.percent === 0) return;
  leaveBusy = {
    open: false,
    title: 'Saving vault',
    percent: 0,
    label: ''
  };
  publish();
}
