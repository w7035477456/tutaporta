/**
 * Open the TutaPhotoAlbums Data Plans dialog from anywhere (e.g. traffic-wait VIP link).
 * UsageBar registers the opener while mounted.
 */

let openDataPlan = null;
let dataPlanDialogOpen = false;

/**
 * @param {() => void} opener
 * @returns {() => void} unregister
 */
export function registerPhotoAlbumsDataPlanOpener(opener) {
  openDataPlan = typeof opener === 'function' ? opener : null;
  return () => {
    if (openDataPlan === opener) openDataPlan = null;
  };
}

/** @returns {boolean} true if an opener handled the request */
export function requestOpenPhotoAlbumsDataPlan() {
  if (typeof openDataPlan !== 'function') return false;
  try {
    openDataPlan();
    return true;
  } catch {
    return false;
  }
}

export function setPhotoAlbumsDataPlanDialogOpen(open) {
  dataPlanDialogOpen = Boolean(open);
}

export function isPhotoAlbumsDataPlanDialogOpen() {
  return dataPlanDialogOpen;
}
