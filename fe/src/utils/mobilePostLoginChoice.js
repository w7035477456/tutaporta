/** sessionStorage — show mobile post-login destination chooser once after sign-in. */
export const MOBILE_POST_LOGIN_CHOOSER_KEY = 'mobilePostLoginChooserPending';

/** window event — reopen Mobile upload chooser while already logged in (mall tile taps). */
export const MOBILE_POST_LOGIN_CHOOSER_EVENT = 'mobile-post-login-chooser';

/** sessionStorage — after choosing Upload → TutaNotes, open direct upload on /myNote. */
export const MOBILE_TUTANOTES_UPLOAD_KEY = 'mobileTutaNotesUploadPending';

export const MOBILE_TUTAPHOTO_UPLOAD_KEY = 'mobileTutaPhotoUploadPending';
export const MOBILE_TUTADATES_UPLOAD_KEY = 'mobileTutaDatesUploadPending';

export function markMobilePostLoginChooserPending() {
  try {
    sessionStorage.setItem(MOBILE_POST_LOGIN_CHOOSER_KEY, '1');
  } catch {
    // ignore
  }
}

/** Mark pending and notify MainLayout dialog (login + mall tile redirects). */
export function requestMobilePostLoginChooser() {
  markMobilePostLoginChooserPending();
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(MOBILE_POST_LOGIN_CHOOSER_EVENT));
  } catch {
    // ignore
  }
}

export function consumeMobilePostLoginChooserPending() {
  try {
    const v = sessionStorage.getItem(MOBILE_POST_LOGIN_CHOOSER_KEY);
    if (v === '1') {
      sessionStorage.removeItem(MOBILE_POST_LOGIN_CHOOSER_KEY);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function peekMobilePostLoginChooserPending() {
  try {
    return sessionStorage.getItem(MOBILE_POST_LOGIN_CHOOSER_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearMobilePostLoginChooserPending() {
  try {
    sessionStorage.removeItem(MOBILE_POST_LOGIN_CHOOSER_KEY);
  } catch {
    // ignore
  }
}

export function markMobileTutaNotesUploadPending() {
  try {
    sessionStorage.setItem(MOBILE_TUTANOTES_UPLOAD_KEY, '1');
  } catch {
    // ignore
  }
}

export function peekMobileTutaNotesUploadPending() {
  try {
    return sessionStorage.getItem(MOBILE_TUTANOTES_UPLOAD_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeMobileTutaNotesUploadPending() {
  try {
    const v = sessionStorage.getItem(MOBILE_TUTANOTES_UPLOAD_KEY);
    if (v === '1') {
      sessionStorage.removeItem(MOBILE_TUTANOTES_UPLOAD_KEY);
      markMobileTutaNotesUploadSession();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Active mobile TutaNotes upload UI (compact: popup + thumbnail grid only). */
export const MOBILE_TUTANOTES_UPLOAD_SESSION_KEY = 'mobileTutaNotesUploadSession';

export function markMobileTutaNotesUploadSession() {
  try {
    sessionStorage.setItem(MOBILE_TUTANOTES_UPLOAD_SESSION_KEY, '1');
    window.dispatchEvent(new CustomEvent('vsingles-mobile-tutanotes-upload-session'));
  } catch {
    // ignore
  }
}

export function peekMobileTutaNotesUploadSession() {
  try {
    return sessionStorage.getItem(MOBILE_TUTANOTES_UPLOAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearMobileTutaNotesUploadSession() {
  try {
    sessionStorage.removeItem(MOBILE_TUTANOTES_UPLOAD_SESSION_KEY);
    window.dispatchEvent(new CustomEvent('vsingles-mobile-tutanotes-upload-session'));
  } catch {
    // ignore
  }
}

export function markMobileTutaPhotoUploadPending() {
  try {
    sessionStorage.setItem(MOBILE_TUTAPHOTO_UPLOAD_KEY, '1');
  } catch {
    // ignore
  }
}

export function peekMobileTutaPhotoUploadPending() {
  try {
    return sessionStorage.getItem(MOBILE_TUTAPHOTO_UPLOAD_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeMobileTutaPhotoUploadPending() {
  try {
    const v = sessionStorage.getItem(MOBILE_TUTAPHOTO_UPLOAD_KEY);
    if (v === '1') {
      sessionStorage.removeItem(MOBILE_TUTAPHOTO_UPLOAD_KEY);
      markMobileTutaPhotoUploadSession();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Active mobile TutaPhoto upload UI (compact: popup + thumbnail grid only). */
export const MOBILE_TUTAPHOTO_UPLOAD_SESSION_KEY = 'mobileTutaPhotoUploadSession';

export function markMobileTutaPhotoUploadSession() {
  try {
    sessionStorage.setItem(MOBILE_TUTAPHOTO_UPLOAD_SESSION_KEY, '1');
    window.dispatchEvent(new CustomEvent('vsingles-mobile-tutaphoto-upload-session'));
  } catch {
    // ignore
  }
}

export function peekMobileTutaPhotoUploadSession() {
  try {
    return sessionStorage.getItem(MOBILE_TUTAPHOTO_UPLOAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearMobileTutaPhotoUploadSession() {
  try {
    sessionStorage.removeItem(MOBILE_TUTAPHOTO_UPLOAD_SESSION_KEY);
    window.dispatchEvent(new CustomEvent('vsingles-mobile-tutaphoto-upload-session'));
  } catch {
    // ignore
  }
}

export function markMobileTutaDatesUploadPending() {
  try {
    sessionStorage.setItem(MOBILE_TUTADATES_UPLOAD_KEY, '1');
  } catch {
    // ignore
  }
}

export function peekMobileTutaDatesUploadPending() {
  try {
    return sessionStorage.getItem(MOBILE_TUTADATES_UPLOAD_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeMobileTutaDatesUploadPending() {
  try {
    const v = sessionStorage.getItem(MOBILE_TUTADATES_UPLOAD_KEY);
    if (v === '1') {
      sessionStorage.removeItem(MOBILE_TUTADATES_UPLOAD_KEY);
      markMobileTutaDatesUploadSession();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Active mobile TutaDates upload UI (compact: popup + thumbnail grid only). */
export const MOBILE_TUTADATES_UPLOAD_SESSION_KEY = 'mobileTutaDatesUploadSession';

export function markMobileTutaDatesUploadSession() {
  try {
    sessionStorage.setItem(MOBILE_TUTADATES_UPLOAD_SESSION_KEY, '1');
    window.dispatchEvent(new CustomEvent('vsingles-mobile-tutadates-upload-session'));
  } catch {
    // ignore
  }
}

export function peekMobileTutaDatesUploadSession() {
  try {
    return sessionStorage.getItem(MOBILE_TUTADATES_UPLOAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearMobileTutaDatesUploadSession() {
  try {
    sessionStorage.removeItem(MOBILE_TUTADATES_UPLOAD_SESSION_KEY);
    window.dispatchEvent(new CustomEvent('vsingles-mobile-tutadates-upload-session'));
  } catch {
    // ignore
  }
}
