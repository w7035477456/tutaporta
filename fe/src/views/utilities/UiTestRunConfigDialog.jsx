import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { parseUiTestDisplayNumber } from 'utils/uiTestRecording';

export function parseUiTestRunConfig({ durationInput, delayInput }) {
  const durationTrim = String(durationInput ?? '').trim();
  let durationMinutes = null;
  if (durationTrim && durationTrim.toLowerCase() !== 'infinite') {
    const mins = Number(durationTrim);
    if (!Number.isFinite(mins) || mins <= 0) {
      return { error: 'Duration must be Infinite or a positive number of minutes' };
    }
    durationMinutes = Math.trunc(mins);
  }

  const delayTrim = String(delayInput ?? '').trim();
  const delaySec = delayTrim === '' ? 5 : Number(delayTrim);
  if (!Number.isFinite(delaySec) || delaySec <= 0) {
    return { error: 'Delay must be a positive number of seconds' };
  }

  return { durationMinutes, delaySec: Math.trunc(delaySec) };
}

export default function UiTestRunConfigDialog({ open, recording, defaultDelaySec = 5, onClose, onRun }) {
  const [durationInput, setDurationInput] = useState('Infinite');
  const [delayInput, setDelayInput] = useState(String(defaultDelaySec));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDurationInput('Infinite');
    setDelayInput(String(defaultDelaySec > 0 ? defaultDelaySec : 5));
    setError('');
  }, [open, recording?.recordingId, defaultDelaySec]);

  const handleRun = () => {
    const parsed = parseUiTestRunConfig({ durationInput, delayInput });
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    onRun?.({
      durationMinutes: parsed.durationMinutes,
      delaySec: parsed.delaySec
    });
  };

  if (!open || !recording) return null;

  const testNumber = parseUiTestDisplayNumber(recording);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close run settings"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>{recording.name}</ColorTemplate7PopupLargeDark.Title>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <ColorTemplate7PopupLargeDark.SectionLabel>Duration</ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.Input
            value={durationInput}
            onChange={(e) => {
              setError('');
              setDurationInput(e.target.value);
            }}
            inputProps={{ 'aria-label': 'Run duration minutes or Infinite' }}
          />
          <ColorTemplate7PopupLargeDark.BodyText>min</ColorTemplate7PopupLargeDark.BodyText>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <ColorTemplate7PopupLargeDark.SectionLabel>Delay</ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.Input
            value={delayInput}
            onChange={(e) => {
              setError('');
              setDelayInput(e.target.value);
            }}
            inputProps={{ 'aria-label': 'Delay between clicks in seconds', inputMode: 'numeric' }}
          />
          <ColorTemplate7PopupLargeDark.BodyText>sec</ColorTemplate7PopupLargeDark.BodyText>
        </Stack>
        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        <Stack direction="row" justifyContent="center" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={handleRun}>
            Run {testNumber}
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
