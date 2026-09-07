import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { fetchUserCustomization, saveUserCustomization } from 'api/userCustomizationFe';
import { BILL_SCHEDULE_INK } from './billScheduleTheme';

const labelSx = {
  m: 0,
  alignItems: 'center',
  '& .MuiFormControlLabel-label': {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: BILL_SCHEDULE_INK,
    WebkitTextFillColor: BILL_SCHEDULE_INK,
    userSelect: 'none'
  }
};

const checkboxSx = {
  color: BILL_SCHEDULE_INK,
  p: 0.5,
  '&.Mui-checked': { color: BILL_SCHEDULE_INK }
};

/**
 * Shared Monthly + Yearly Bill Schedule email prefs.
 * Persists to user_customization.send_tuttanote_overdue / send_tuttanote_1dayahead.
 */
export default function BillScheduleEmailPrefs() {
  const [overdue, setOverdue] = useState(false);
  const [ahead, setAhead] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await fetchUserCustomization();
        if (cancelled) return;
        setOverdue(Boolean(prefs.sendTuttanoteOverdue));
        setAhead(Boolean(prefs.sendTuttanote1dayahead));
      } catch {
        if (!cancelled) {
          setOverdue(false);
          setAhead(false);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (patch, applyLocal) => {
    applyLocal();
    setSaving(true);
    try {
      const prefs = await saveUserCustomization(patch);
      setOverdue(Boolean(prefs.sendTuttanoteOverdue));
      setAhead(Boolean(prefs.sendTuttanote1dayahead));
    } catch {
      try {
        const prefs = await fetchUserCustomization();
        setOverdue(Boolean(prefs.sendTuttanoteOverdue));
        setAhead(Boolean(prefs.sendTuttanote1dayahead));
      } catch {
        // keep optimistic local value
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.5,
        flexShrink: 0,
        width: '100%',
        maxWidth: 920,
        mx: 'auto',
        boxSizing: 'border-box',
        px: { xs: 0, sm: 0.5 }
      }}
    >
      <FormControlLabel
        sx={labelSx}
        disabled={!ready || saving}
        control={
          <Checkbox
            size="small"
            sx={checkboxSx}
            checked={overdue}
            onChange={(e) => {
              const next = e.target.checked;
              void persist({ sendTuttanoteOverdue: next }, () => setOverdue(next));
            }}
          />
        }
        label="Email overdue"
      />
      <FormControlLabel
        sx={labelSx}
        disabled={!ready || saving}
        control={
          <Checkbox
            size="small"
            sx={checkboxSx}
            checked={ahead}
            onChange={(e) => {
              const next = e.target.checked;
              void persist({ sendTuttanote1dayahead: next }, () => setAhead(next));
            }}
          />
        }
        label="Email due 1 day ahead"
      />
    </Box>
  );
}
