/** sessionStorage — show mobile post-login destination chooser once after sign-in. */
export const MOBILE_POST_LOGIN_CHOOSER_KEY = 'mobilePostLoginChooserPending';

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
      return true;
    }
  } catch {
    // ignore
  }
  return false;
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
      return true;
    }
  } catch {
    // ignore
  }
  return false;
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
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
