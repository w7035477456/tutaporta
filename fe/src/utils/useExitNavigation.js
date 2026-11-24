import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** True when this page was opened by a full-page link from another page on this site. */
function cameFromSameSite() {
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Exit button handler for public info pages (About Us, Terms, Privacy):
 * go back if there is a previous page on this site, otherwise (URL opened directly) go to login.
 * React Router stores the in-app history index in window.history.state.idx; plain <a href> links
 * reload the app and reset it to 0, so the same-site referrer covers those.
 */
export default function useExitNavigation(fallback = '/pages/login') {
  const navigate = useNavigate();
  return useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else if (cameFromSameSite()) {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      // Opened in a new tab from one of our pages (e.g. register consent links): close it to return there.
      window.close();
      setTimeout(() => navigate(fallback, { replace: true }), 300);
    } else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
