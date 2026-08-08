import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { buildAutoLogoutPresets, isAutoLogoutPresetMinutes } from 'constants/customLogoutDuration';
import { fetchCustomLogoutDuration, saveCustomLogoutDuration } from 'api/settingsCustomLogoutFe';

const CUSTOM_RADIO_VALUE = 'custom';

function ProfilesRecordsAutoLogout({ pageTextColor, textFontSx }) {
  const [minutes, setMinutes] = useState(60);
  const [presets, setPresets] = useState(() => buildAutoLogoutPresets(15));
  const [presetMinutes, setPresetMinutes] = useState([15, 60, 480, 1440]);
  const [adminCustomAllowed, setAdminCustomAllowed] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedRadio = useMemo(() => {
    if (isAutoLogoutPresetMinutes(minutes, presetMinutes)) return String(minutes);
    if (adminCustomAllowed) return CUSTOM_RADIO_VALUE;
    return '';
  }, [minutes, adminCustomAllowed, presetMinutes]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const result = await fetchCustomLogoutDuration();
        if (cancelled) return;
        setMinutes(result.minutes);
        setPresets(result.presets);
        setPresetMinutes(result.presetMinutes);
        setAdminCustomAllowed(result.adminCustomAllowed);
        if (!isAutoLogoutPresetMinutes(result.minutes, result.presetMinutes)) {
          setCustomDraft(String(result.minutes));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Failed to load auto logout setting');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistMinutes = useCallback(async (nextMinutes) => {
    const n = Math.trunc(Number(nextMinutes));
    if (!Number.isFinite(n) || n < 1) return;
    try {
      setSaving(true);
      setError('');
      const saved = await saveCustomLogoutDuration(n);
      setMinutes(saved);
      if (!isAutoLogoutPresetMinutes(saved, presetMinutes)) {
        setCustomDraft(String(saved));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vsingles-session-config-reload'));
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save auto logout setting');
    } finally {
      setSaving(false);
    }
  }, [presetMinutes]);

  const handleRadioChange = (event) => {
    const value = event.target.value;
    if (value === CUSTOM_RADIO_VALUE) {
      const draft = Math.trunc(Number(customDraft));
      if (Number.isFinite(draft) && draft >= 1) {
        void persistMinutes(draft);
      }
      return;
    }
    void persistMinutes(Number(value));
  };

  const commitCustomDraft = () => {
    const n = Math.trunc(Number(String(customDraft).trim()));
    if (!Number.isFinite(n) || n < 1) {
      setError('Enter a positive number of minutes');
      return;
    }
    void persistMinutes(n);
  };

  const radioSx = {
    color: pageTextColor,
    '&.Mui-checked': { color: pageTextColor }
  };

  const labelSx = {
    ...textFontSx,
    color: pageTextColor
  };

  return (
    <>
      <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
        Auto logout after (min):
      </Typography>
      <Box sx={{ justifySelf: { sm: 'start' }, width: '100%', maxWidth: { sm: 480 } }}>
        {loading ? (
          <Typography sx={{ ...textFontSx, color: pageTextColor }}>Loading…</Typography>
        ) : (
          <RadioGroup row value={selectedRadio} onChange={handleRadioChange} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {presets.map((preset) => (
              <FormControlLabel
                key={preset.minutes}
                value={String(preset.minutes)}
                disabled={saving}
                control={<Radio size="small" sx={radioSx} />}
                label={preset.label}
                sx={{ '& .MuiFormControlLabel-label': labelSx, mr: 1.5 }}
              />
            ))}
            {adminCustomAllowed ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <FormControlLabel
                  value={CUSTOM_RADIO_VALUE}
                  disabled={saving}
                  control={<Radio size="small" sx={radioSx} />}
                  label=""
                  sx={{ mr: 0 }}
                />
                <TextField
                  size="small"
                  value={customDraft}
                  disabled={saving}
                  onChange={(e) => setCustomDraft(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={commitCustomDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitCustomDraft();
                    }
                  }}
                  inputProps={{ inputMode: 'numeric', 'aria-label': 'Custom auto logout minutes' }}
                  sx={{
                    width: 'calc(72px + 2ch)',
                    '& .MuiInputBase-input': { ...textFontSx, color: pageTextColor, py: 0.75 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: pageTextColor }
                  }}
                />
                <Typography component="span" sx={{ ...textFontSx, color: pageTextColor, whiteSpace: 'nowrap' }}>
                  Min
                </Typography>
              </Box>
            ) : null}
          </RadioGroup>
        )}
        {error ? (
          <Typography sx={{ ...textFontSx, color: '#ffb4b4', mt: 0.5 }} role="alert">
            {error}
          </Typography>
        ) : null}
      </Box>
    </>
  );
}

ProfilesRecordsAutoLogout.propTypes = {
  pageTextColor: PropTypes.string.isRequired,
  textFontSx: PropTypes.object
};

export default ProfilesRecordsAutoLogout;
