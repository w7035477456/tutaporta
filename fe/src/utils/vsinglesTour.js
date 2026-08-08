import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';

export const VSINGLES_TOUR_START_EVENT = 'vsingles-tour-start';
export const VSINGLES_TOUR_STEP_EVENT = 'vsingles-tour-step';
export const VSINGLES_TOUR_END_EVENT = 'vsingles-tour-end';
export const VSINGLES_TOUR_PAUSE_MEDIA_EVENT = 'vsingles-tour-pause-media';

export const VSINGLES_LANDING_PATH = '/vsingles';

export const TOUR_STEP_THEME = 0;
export const TOUR_STEP_ALL_SINGLES = 1;
export const TOUR_STEP_MY_PICKS = 2;
export const TOUR_STEP_PICKS_BRIEF_BIO = 3;
export const TOUR_STEP_VETTED_FRIENDS_SMS = 4;
export const TOUR_TOTAL_STEPS = 7;

let tourOpen = false;
let tourStep = null;
let pendingTourOnVsinglesLanding = false;

export function isTourOpen() {
  return tourOpen;
}

export function getTourStep() {
  return tourStep;
}

/** Dating / vsingles routes where the sidebar tour button is shown. */
export function isVsinglesTourRoute(pathname) {
  return (
    pathname === '/vsingles' ||
    pathname.startsWith('/vsingles/') ||
    pathname.startsWith('/dashboard') ||
    pathname === '/verifyself' ||
    pathname === SELF_REPORT_BIOGRAPHY_PATH ||
    pathname === '/allSingles' ||
    pathname === '/myPicks' ||
    pathname === '/interestedSingles' ||
    pathname === RECEIVED_BIO_REQUESTS_PATH ||
    pathname === '/vettedFriends' ||
    pathname === '/request-ive-sent' ||
    pathname === '/send-flower' ||
    pathname.startsWith('/vettedFriends/') ||
    pathname.startsWith('/request-ive-sent/') ||
    pathname.startsWith('/request-')
  );
}

function pauseVsinglesLandingMedia() {
  window.dispatchEvent(new CustomEvent(VSINGLES_TOUR_PAUSE_MEDIA_EVENT));
}

export function startVsinglesTour() {
  if (typeof window === 'undefined') return;
  tourOpen = true;
  tourStep = TOUR_STEP_THEME;
  pauseVsinglesLandingMedia();
  window.dispatchEvent(new CustomEvent(VSINGLES_TOUR_START_EVENT, { detail: { step: TOUR_STEP_THEME } }));
}

/**
 * From sidebar tour button: go to /vsingles first when needed, then start theme step.
 * @param {string} pathname
 * @param {(path: string) => void} navigate
 */
export function startVsinglesTourFromSidebar(pathname, navigate) {
  if (typeof window === 'undefined') return;
  if (pathname !== VSINGLES_LANDING_PATH) {
    endVsinglesTour();
    pendingTourOnVsinglesLanding = true;
    navigate(VSINGLES_LANDING_PATH);
    return;
  }
  startVsinglesTour();
}

/** Call on VsinglesLanding mount after navigating from another page. */
export function consumePendingVsinglesTourStart() {
  if (!pendingTourOnVsinglesLanding) return false;
  pendingTourOnVsinglesLanding = false;
  startVsinglesTour();
  return true;
}

export function goToTourStep(step) {
  if (typeof window === 'undefined') return;
  tourOpen = true;
  tourStep = step;
  window.dispatchEvent(new CustomEvent(VSINGLES_TOUR_STEP_EVENT, { detail: { step } }));
}

export function endVsinglesTour() {
  if (typeof window === 'undefined') return;
  tourOpen = false;
  tourStep = null;
  window.dispatchEvent(new CustomEvent(VSINGLES_TOUR_END_EVENT));
}
