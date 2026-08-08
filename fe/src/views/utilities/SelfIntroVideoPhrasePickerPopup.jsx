import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import api from 'api/axios';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS, SELF_INTRO_VIDEO_POPUP_TITLE } from 'constants/selfIntroVideoFavoriteFields';
import { buildFilledSelfIntroScriptPhrases } from 'utils/selfIntroVideoPhraseFill';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

const selfIntroPopupActionRowSx = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  pt: 0.5
};

const phraseListSx = {
  maxHeight: { xs: '42vh', sm: '48vh' },
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
  pr: 0.5
};

function miscBioRowsToMap(miscBioRows) {
  const map = {};
  (miscBioRows || []).forEach((row) => {
    if (row?.key) map[row.key] = row.response ?? '';
  });
  for (const { key } of SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS) {
    if (map[key] == null) map[key] = '';
  }
  return map;
}

/** Task 4 — pick one of 20 filled intro scripts (from misc_bio). */
export default function SelfIntroVideoPhrasePickerPopup({ open, onClose, fallbackPhrases = [], onMakeVideo }) {
  const [phrases, setPhrases] = useState(fallbackPhrases);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedId('');
      setLoadError('');
      return;
    }

    setLoading(true);
    setLoadError('');
    let cancelled = false;

    void api
      .get('/api/checkr/bio-review')
      .then(({ data }) => {
        if (cancelled) return;
        const favorites = miscBioRowsToMap(data?.miscBio);
        const currentCity = (data?.briefBio || []).find((row) => row?.key === 'current_city')?.response;
        if (currentCity) favorites.city_state = currentCity;
        setPhrases(buildFilledSelfIntroScriptPhrases(favorites));
      })
      .catch(() => {
        if (!cancelled) {
          setPhrases(Array.isArray(fallbackPhrases) ? fallbackPhrases : []);
          setLoadError('Could not reload favorites from profile. Showing last generated list.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, fallbackPhrases]);

  const selectedPhrase = useMemo(
    () => phrases.find((phrase) => String(phrase.id) === String(selectedId)) ?? null,
    [phrases, selectedId]
  );

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft
      closeButtonAriaLabel="Close self intro script picker"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>{SELF_INTRO_VIDEO_POPUP_TITLE}</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>
          Pick one of 20 self-introduction scripts. Placeholders are filled from your saved misc bio favorites.
        </ColorTemplate7PopupLargeDark.BodyText>

        {loading ? (
          <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>Loading scripts…</ColorTemplate7PopupLargeDark.BodyText>
        ) : null}
        {loadError ? <ColorTemplate7PopupLargeDark.ErrorBar>{loadError}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        <Box sx={phraseListSx} {...guestDemoAllowProps()}>
          <RadioGroup value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {phrases.map((phrase) => (
              <Box
                key={phrase.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  mb: 1.25,
                  pb: 1.25,
                  borderBottom: '1px solid rgba(255,255,255,0.12)'
                }}
              >
                <FormControlLabel
                  value={String(phrase.id)}
                  control={<ColorTemplate7PopupLargeDark.Radio />}
                  label=""
                  sx={{ m: 0, mr: 0.5, alignSelf: 'flex-start' }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <ColorTemplate7PopupLargeDark.BodyText sx={{ fontWeight: 700, mb: 0.5 }}>
                    {phrase.id}. {phrase.title}
                  </ColorTemplate7PopupLargeDark.BodyText>
                  <ColorTemplate7PopupLargeDark.BodyText sx={{ lineHeight: 1.45 }}>{phrase.filledText}</ColorTemplate7PopupLargeDark.BodyText>
                </Box>
              </Box>
            ))}
          </RadioGroup>
        </Box>

        <Box sx={selfIntroPopupActionRowSx} {...guestDemoAllowProps()}>
          <GreenButton
            type="button"
            disabled={!selectedPhrase || loading}
            onClick={() => {
              if (!selectedPhrase) return;
              onMakeVideo?.(selectedPhrase);
            }}
            {...guestDemoAllowProps()}
          >
            Selected, Let&apos;s make video now
          </GreenButton>
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SelfIntroVideoPhrasePickerPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  fallbackPhrases: PropTypes.array,
  onMakeVideo: PropTypes.func.isRequired
};
