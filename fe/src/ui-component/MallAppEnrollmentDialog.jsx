import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { useAuth } from 'contexts/AuthContext';
import { isToolsOnlyAdminSession, isImpersonationSession } from 'utils/adminSession';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { fetchUserCustomization, saveUserCustomization } from 'api/userCustomizationFe';
import {
  clearMallAppEnrollmentPending,
  MALL_APP_ENROLLMENT_EVENT,
  peekMallAppEnrollmentPending
} from 'utils/mallAppEnrollment';

const INTRO_TEXT =
  'Currently, TutaMall offers three live production applications: TutaDates, TutaAlbums, and TutaNotes. All applications are free to use, with optional paid VIP features available later.';

const INSTRUCTION_TEXT =
  'By default, you are enrolled in all three services. For example, if you only wish to use TutaNotes or TutaAlbums and do not want a single profile to appear on TutaDates, please uncheck the TutaDates box below:';

const OPTIONS = [
  {
    key: 'tutaDatesEnabled',
    label: 'TutaDates',
    detail: '(Online dating, posting, chat, finding buddies)'
  },
  {
    key: 'tutaNotesEnabled',
    label: 'TutaNotes',
    detail: '(Record keeping, receipts, calendar)'
  },
  {
    key: 'tutaAlbumsEnabled',
    label: 'TutaPhotos',
    detail: '(Organization, slideshows, photo albums)'
  }
];

const ENABLE_HINT_TEXT = 'Please check to enable the application you like to use.';

const bodyTextSx = {
  textAlign: 'left',
  fontWeight: 600,
  lineHeight: 1.45,
  fontSize: { xs: '0.95rem', sm: '1.05rem' }
};

const enableHintSx = {
  textAlign: 'center',
  fontWeight: 800,
  lineHeight: 1.4,
  fontSize: { xs: '1rem', sm: '1.15rem' },
  color: '#ffff00',
  WebkitTextFillColor: '#ffff00',
  textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000',
  mt: 0.5
};

const optionRowSx = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 1,
  width: '100%',
  minWidth: 0,
  cursor: 'pointer',
  userSelect: 'none'
};

const optionTextSx = {
  fontWeight: 800,
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  flex: '1 1 auto',
  minWidth: 0
};

/** Checked = green check (not red X — X looked like the close button and felt “stuck”). */
function EnrollmentCheckedIcon() {
  return (
    <Box
      sx={{
        width: { xs: '5vw', sm: '2vw' },
        height: { xs: '5vw', sm: '2vw' },
        minWidth: 22,
        minHeight: 22,
        maxWidth: 36,
        maxHeight: 36,
        boxSizing: 'border-box',
        bgcolor: '#fff',
        border: '3px solid #c62828',
        borderRadius: 0.5,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2e7d32',
        WebkitTextFillColor: '#2e7d32',
        fontWeight: 900,
        fontSize: '1.1em',
        lineHeight: 1
      }}
    >
      ✓
    </Box>
  );
}

function EnrollmentUncheckedIcon() {
  return (
    <Box
      sx={{
        width: { xs: '5vw', sm: '2vw' },
        height: { xs: '5vw', sm: '2vw' },
        minWidth: 22,
        minHeight: 22,
        maxWidth: 36,
        maxHeight: 36,
        boxSizing: 'border-box',
        bgcolor: '#fff',
        border: '3px solid #c62828',
        borderRadius: 0.5,
        flexShrink: 0
      }}
    />
  );
}

/**
 * After each login: enroll in TutaDates / TutaNotes / TutaAlbums.
 * X closes and leaves the user on /mall. Choices persist on user_customization.
 * When opened after clicking an unchecked mall tile, showEnableHint shows the yellow footer line.
 */
export default function MallAppEnrollmentDialog({
  open: openProp,
  onClose,
  onEnrollmentChange,
  showEnableHint = false
} = {}) {
  const { user } = useAuth();
  const controlled = openProp !== undefined;
  const [sessionOpen, setSessionOpen] = useState(false);
  const [dates, setDates] = useState(true);
  const [notes, setNotes] = useState(true);
  const [albums, setAlbums] = useState(true);
  const [ready, setReady] = useState(false);

  const open = controlled ? Boolean(openProp) : sessionOpen;

  const skipUser =
    !user || isToolsOnlyAdminSession(user) || isImpersonationSession(user);

  const tryOpenFromSession = useCallback(() => {
    if (skipUser) return;
    if (!peekMallAppEnrollmentPending()) return;
    setSessionOpen(true);
  }, [skipUser]);

  useEffect(() => {
    if (controlled) return undefined;
    tryOpenFromSession();
    if (typeof window === 'undefined') return undefined;
    const onRequest = () => tryOpenFromSession();
    window.addEventListener(MALL_APP_ENROLLMENT_EVENT, onRequest);
    return () => window.removeEventListener(MALL_APP_ENROLLMENT_EVENT, onRequest);
  }, [controlled, tryOpenFromSession]);

  useEffect(() => {
    if (!open || skipUser) return undefined;
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        const prefs = await fetchUserCustomization();
        if (cancelled) return;
        setDates(prefs.tutaDatesEnabled !== false);
        setNotes(prefs.tutaNotesEnabled !== false);
        setAlbums(prefs.tutaAlbumsEnabled !== false);
      } catch {
        if (!cancelled) {
          setDates(true);
          setNotes(true);
          setAlbums(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, skipUser]);

  const values = {
    tutaDatesEnabled: dates,
    tutaNotesEnabled: notes,
    tutaAlbumsEnabled: albums
  };

  const setValue = useCallback((key, checked) => {
    if (key === 'tutaDatesEnabled') setDates(Boolean(checked));
    else if (key === 'tutaNotesEnabled') setNotes(Boolean(checked));
    else if (key === 'tutaAlbumsEnabled') setAlbums(Boolean(checked));
  }, []);

  const persist = useCallback(
    async (patch) => {
      // Always keep the values we just wrote — PUT responses can omit/mis-map false
      // and `x !== false` would snap the box back to checked while DB is unchecked.
      const applyPatchLocally = () => {
        if (Object.prototype.hasOwnProperty.call(patch, 'tutaDatesEnabled')) {
          setDates(Boolean(patch.tutaDatesEnabled));
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'tutaNotesEnabled')) {
          setNotes(Boolean(patch.tutaNotesEnabled));
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'tutaAlbumsEnabled')) {
          setAlbums(Boolean(patch.tutaAlbumsEnabled));
        }
      };
      applyPatchLocally();
      try {
        const prefs = await saveUserCustomization(patch);
        applyPatchLocally();
        const merged = {
          ...prefs,
          tutaDatesEnabled: Object.prototype.hasOwnProperty.call(patch, 'tutaDatesEnabled')
            ? Boolean(patch.tutaDatesEnabled)
            : prefs.tutaDatesEnabled !== false,
          tutaNotesEnabled: Object.prototype.hasOwnProperty.call(patch, 'tutaNotesEnabled')
            ? Boolean(patch.tutaNotesEnabled)
            : prefs.tutaNotesEnabled !== false,
          tutaAlbumsEnabled: Object.prototype.hasOwnProperty.call(patch, 'tutaAlbumsEnabled')
            ? Boolean(patch.tutaAlbumsEnabled)
            : prefs.tutaAlbumsEnabled !== false
        };
        onEnrollmentChange?.(merged);
        return merged;
      } catch {
        applyPatchLocally();
        onEnrollmentChange?.({
          tutaDatesEnabled: Object.prototype.hasOwnProperty.call(patch, 'tutaDatesEnabled')
            ? Boolean(patch.tutaDatesEnabled)
            : dates,
          tutaNotesEnabled: Object.prototype.hasOwnProperty.call(patch, 'tutaNotesEnabled')
            ? Boolean(patch.tutaNotesEnabled)
            : notes,
          tutaAlbumsEnabled: Object.prototype.hasOwnProperty.call(patch, 'tutaAlbumsEnabled')
            ? Boolean(patch.tutaAlbumsEnabled)
            : albums
        });
        return null;
      }
    },
    [albums, dates, notes, onEnrollmentChange]
  );

  const handleToggle = useCallback(
    (key, checked) => {
      const next = Boolean(checked);
      setValue(key, next);
      void persist({ [key]: next });
    },
    [persist, setValue]
  );

  const handleClose = useCallback(() => {
    clearMallAppEnrollmentPending();
    if (!controlled) setSessionOpen(false);
    onClose?.();
    void persist({
      tutaDatesEnabled: dates,
      tutaNotesEnabled: notes,
      tutaAlbumsEnabled: albums
    });
  }, [albums, controlled, dates, notes, onClose, persist]);

  if (skipUser) return null;

  return (
    <ColorTemplate7PopupLargeDark
      open={open && ready}
      onClose={handleClose}
      closeOnBackdrop={false}
      closeButtonAriaLabel="Close mall app enrollment"
      maxWidth="min(98vw, 920px)"
      centerInWindow
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2} {...guestDemoAllowProps()}>
        <Typography sx={bodyTextSx}>{INTRO_TEXT}</Typography>
        <Typography sx={bodyTextSx}>{INSTRUCTION_TEXT}</Typography>
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%' }}
          {...guestDemoAllowProps()}
        >
          {OPTIONS.map((opt) => {
            const checked = Boolean(values[opt.key]);
            return (
              <Box
                key={opt.key}
                role="checkbox"
                aria-checked={checked}
                aria-label={opt.label}
                tabIndex={0}
                sx={optionRowSx}
                {...guestDemoAllowProps()}
                onClick={() => handleToggle(opt.key, !checked)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleToggle(opt.key, !checked);
                  }
                }}
              >
                {/* Visual only — row click is the single toggle (no label+input double-fire). */}
                <ColorTemplate7PopupLargeDark.Checkbox
                  checked={checked}
                  tabIndex={-1}
                  icon={<EnrollmentUncheckedIcon />}
                  checkedIcon={<EnrollmentCheckedIcon />}
                  inputProps={{ 'aria-hidden': true, readOnly: true, tabIndex: -1 }}
                  onChange={() => {}}
                  sx={{ pointerEvents: 'none' }}
                />
                <Typography component="span" sx={optionTextSx}>
                  {opt.label} {opt.detail}
                </Typography>
              </Box>
            );
          })}
        </Box>
        {showEnableHint ? <Typography sx={enableHintSx}>{ENABLE_HINT_TEXT}</Typography> : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
