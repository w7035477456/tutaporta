import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { saveCheckrBioReviewDraft } from 'api/checkrBioReviewFe';
import {
  SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS,
  SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS,
  SELF_INTRO_VIDEO_POPUP_TITLE
} from 'constants/selfIntroVideoFavoriteFields';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import {
  buildFilledSelfIntroScriptPhrases,
  validateSelfIntroFavoriteForm
} from 'utils/selfIntroVideoPhraseFill';
import { buildSelfIntroMiscBioDraft } from 'utils/selfIntroVideoMiscBioSave';

const selfIntroPopupActionRowSx = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 1.5,
  width: '100%',
  pt: 0.5
};

function buildInitialFavorites(initialValues = {}) {
  const draft = {};
  for (const { key } of [...SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS, ...SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS]) {
    draft[key] = String(initialValues[key] ?? '').trim();
  }
  return draft;
}

/** Task 3 — favorites form; save to misc_bio and generate filled intro scripts. */
export default function SelfIntroVideoFavoritesPopup({ open, onClose, initialValues = {}, onGenerated, onSaved }) {
  const [favorites, setFavorites] = useState(() => buildInitialFavorites(initialValues));
  const [formError, setFormError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFavorites(buildInitialFavorites(initialValues));
    setFormError('');
    setSaveMessage('');
    setSaving(false);
  }, [open, initialValues]);

  const handleFieldChange = useCallback((key, value) => {
    setFavorites((prev) => ({ ...prev, [key]: value }));
    setFormError('');
    setSaveMessage('');
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFormError('');
    setSaveMessage('');
    try {
      const draft = buildSelfIntroMiscBioDraft(favorites);
      await saveCheckrBioReviewDraft(draft);
      setSaveMessage('Saved to your bio favorites.');
      onSaved?.({ favorites });
    } catch (err) {
      setFormError(sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Failed to save favorites.'));
    } finally {
      setSaving(false);
    }
  }, [favorites, onSaved]);

  const handleGenerate = useCallback(() => {
    const validation = validateSelfIntroFavoriteForm(favorites);
    if (!validation.ok) {
      setFormError(`Please fill in: ${validation.missingLabels.join(', ')}`);
      return;
    }
    const phrases = buildFilledSelfIntroScriptPhrases(favorites);
    onGenerated?.({ favorites, phrases });
  }, [favorites, onGenerated]);

  const fieldRows = useMemo(() => SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS, []);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft
      closeButtonAriaLabel="Close self intro favorites form"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>{SELF_INTRO_VIDEO_POPUP_TITLE}</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>
          Tell us a bit about what you love! We&apos;ll craft 20 unique self-introductions based on your answers so you can pick one
          to make the self intro video.
        </ColorTemplate7PopupLargeDark.BodyText>

        <ColorTemplate7PopupLargeDark.FormRows>
          {fieldRows.map((field) => (
            <ColorTemplate7PopupLargeDark.FormRow key={field.key} label={field.label}>
              <ColorTemplate7PopupLargeDark.Input
                formRow
                fullWidth
                size="small"
                value={favorites[field.key] ?? ''}
                onChange={(event) => handleFieldChange(field.key, event.target.value)}
              />
            </ColorTemplate7PopupLargeDark.FormRow>
          ))}
        </ColorTemplate7PopupLargeDark.FormRows>

        {formError ? <ColorTemplate7PopupLargeDark.ErrorBar>{formError}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        {saveMessage ? (
          <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', color: '#2e7d32', fontWeight: 700 }}>
            {saveMessage}
          </ColorTemplate7PopupLargeDark.BodyText>
        ) : null}

        <Box sx={selfIntroPopupActionRowSx}>
          <GreenButton type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </GreenButton>
          <GreenButton type="button" onClick={handleGenerate} disabled={saving}>
            Generate self intro text
          </GreenButton>
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SelfIntroVideoFavoritesPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialValues: PropTypes.object,
  onGenerated: PropTypes.func,
  onSaved: PropTypes.func
};
