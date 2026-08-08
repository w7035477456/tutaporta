import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchAdminPgQueryErrors, resetAdminPgQueryErrors } from 'api/adminPgQueryErrorsFe';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';

const EMPTY_COUNTS = { select: 0, insert: 0, update: 0, delete: 0, other: 0 };

function countLabelSx() {
  return {
    fontWeight: 700,
    fontSize: getDesktopTextFontSizeVw(),
    color: 'var(--theme-primary-color)'
  };
}

export default function UiTestPgErrorCountsBar({ onError, onReset }) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminPgQueryErrors();
      const c = data?.counts ?? {};
      setCounts({
        select: Number(c.select) || 0,
        insert: Number(c.insert) || 0,
        update: Number(c.update) || 0,
        delete: Number(c.delete) || 0,
        other: Number(c.other) || 0
      });
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to load DB error counts');
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReset = async () => {
    setBusy(true);
    onError?.('');
    try {
      const data = await resetAdminPgQueryErrors();
      const c = data?.counts ?? EMPTY_COUNTS;
      setCounts({
        select: Number(c.select) || 0,
        insert: Number(c.insert) || 0,
        update: Number(c.update) || 0,
        delete: Number(c.delete) || 0,
        other: Number(c.other) || 0
      });
      await onReset?.();
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to reset DB error counts');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      data-ui-test-ignore
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: { xs: 1, sm: 2 },
        py: 1,
        px: 0.5,
        mb: 1,
        borderBottom: '1px solid var(--theme-inverse-daynight-color)'
      }}
    >
      {(['select', 'insert', 'update', 'delete', 'other']).map((key) => (
        <Typography key={key} sx={countLabelSx()}>
          {key}: {counts[key]}
        </Typography>
      ))}
      <ColorTemplate9TableData.Button
        type="button"
        size="small"
        disabled={busy}
        onClick={() => void handleReset()}
        sx={{ borderRadius: 999, px: 2, py: 0.5, minHeight: 32, ml: { xs: 0, sm: 1 } }}
      >
        Reset
      </ColorTemplate9TableData.Button>
    </Box>
  );
}
