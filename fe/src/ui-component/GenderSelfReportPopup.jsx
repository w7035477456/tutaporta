import PropTypes from 'prop-types';
import { useState } from 'react';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';

import api from 'api/axios';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';

/**
 * Mandatory gender self-report before demo-buddy seeding.
 * Saves singles.gender_self_report ('M'|'F') then seeds.
 */
export default function GenderSelfReportPopup({ open, onCompleted }) {
  const [choice, setChoice] = useState(''); // 'male' | 'female'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (choice !== 'male' && choice !== 'female') {
      setError('Please select Male or Female.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/api/singles/gender-self-report', {
        gender: choice === 'male' ? 'M' : 'F'
      });
      onCompleted?.({
        gender_self_report: data?.gender_self_report === 'M' || data?.gender_self_report === 'F' ? data.gender_self_report : choice === 'male' ? 'M' : 'F',
        seeded_demo_buddies_boolean: Boolean(data?.seeded_demo_buddies_boolean),
        seed: data?.seed ?? null
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save gender.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={() => {}}
      showCloseButton={false}
      closeOnBackdrop={false}
      bodyTextAlignLeft
      centeredLeadLines={1}
    >
      <ColorTemplate16PopupCenterWide.Title>What Gender are you?</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={2}>
        <RadioGroup
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setError('');
          }}
        >
          <FormControlLabel
            value="male"
            control={<ColorTemplate7PopupLargeDark.Radio />}
            label={<ColorTemplate16PopupCenterWide.BodyText sx={{ mb: 0 }}>Male</ColorTemplate16PopupCenterWide.BodyText>}
          />
          <FormControlLabel
            value="female"
            control={<ColorTemplate7PopupLargeDark.Radio />}
            label={<ColorTemplate16PopupCenterWide.BodyText sx={{ mb: 0 }}>Female</ColorTemplate16PopupCenterWide.BodyText>}
          />
        </RadioGroup>
        {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}
        <Stack direction="row" justifyContent="center" sx={{ pt: 1 }}>
          <ColorTemplate16PopupCenterWide.ActionButton onClick={handleContinue} disabled={submitting}>
            {submitting ? 'Saving…' : 'Continue'}
          </ColorTemplate16PopupCenterWide.ActionButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

GenderSelfReportPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onCompleted: PropTypes.func
};
