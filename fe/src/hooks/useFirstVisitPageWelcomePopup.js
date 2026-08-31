import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUserCustomization, saveUserCustomization } from 'api/userCustomizationFe';

/**
 * One-time welcome popup per page. Shows when the user_customization flag is null;
 * marks true in DB as soon as the popup opens.
 */
export default function useFirstVisitPageWelcomePopup(prefKey, { enabled = true, userSinglesId = null } = {}) {
  const [open, setOpen] = useState(false);
  const markedRef = useRef(false);

  useEffect(() => {
    if (!enabled || userSinglesId == null) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await fetchUserCustomization();
        if (cancelled) return;
        if (prefs?.[prefKey] == null) {
          setOpen(true);
        }
      } catch (err) {
        console.warn('[useFirstVisitPageWelcomePopup] load failed', prefKey, err?.message ?? err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, prefKey, userSinglesId]);

  useEffect(() => {
    if (!open || markedRef.current) return;
    markedRef.current = true;
    void saveUserCustomization({ [prefKey]: true }).catch((err) => {
      console.warn('[useFirstVisitPageWelcomePopup] save failed', prefKey, err?.message ?? err);
    });
  }, [open, prefKey]);

  const onClose = useCallback(() => {
    setOpen(false);
  }, []);

  return { open, onClose };
}
