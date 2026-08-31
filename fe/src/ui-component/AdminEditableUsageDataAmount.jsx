import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useAuth } from 'contexts/AuthContext';
import { isImpersonationSession } from 'utils/adminSession';
import api from 'api/axios';

/** Format MB as mb/gb — GB display is 1 decimal (e.g. 9.8gb, 10.0gb). */
export function formatUsageDataAmount(mb, { precisionGb = 1, precisionMb = 1 } = {}) {
  const value = Number(mb);
  if (!Number.isFinite(value)) return '0mb';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1024) {
    const gb = abs / 1024;
    return `${sign}${gb.toFixed(precisionGb)}gb`;
  }
  const mbText = abs.toFixed(precisionMb);
  return `${sign}${mbText}mb`;
}

/**
 * Parse admin-typed amount to integer MB.
 * Accepts "50gb", "19.7 GB", "20213mb", or a bare number (treated as MB).
 */
export function parseUsageDataAmountToMb(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/,/g, '');
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(gb|g|mb|m)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = String(m[2] || '').toLowerCase();
  if (unit === 'gb' || unit === 'g') return Math.round(n * 1024);
  if (unit === 'mb' || unit === 'm') return Math.round(n);
  return Math.round(n);
}

/**
 * Double-click to edit (admin impersonation only). Enter saves; Escape cancels.
 * field: 'remain' | 'bought'
 */
export default function AdminEditableUsageDataAmount({
  field,
  valueMb,
  onSaved,
  sx = null
}) {
  const { user } = useAuth();
  const canEdit = isImpersonationSession(user);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const skipBlurCancelRef = useRef(false);

  const label = formatUsageDataAmount(valueMb);

  useEffect(() => {
    if (!editing) return undefined;
    const t = window.setTimeout(() => {
      inputRef.current?.focus?.();
      inputRef.current?.select?.();
    }, 0);
    return () => window.clearTimeout(t);
  }, [editing]);

  if (!canEdit) {
    return (
      <Box component="span" sx={sx}>
        {label}
      </Box>
    );
  }

  const beginEdit = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setError('');
    // Extra GB digits in the editor so a no-op save does not round stored MB.
    setDraft(formatUsageDataAmount(valueMb, { precisionGb: 6 }));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
    setError('');
  };

  const saveEdit = async () => {
    if (saving) return;
    const nextMb = parseUsageDataAmountToMb(draft);
    if (nextMb == null) {
      setError('Use e.g. 50gb or 51200mb');
      return;
    }
    if (field === 'bought' && nextMb < 0) {
      setError('Bought cannot be negative');
      return;
    }
    const current = Math.round(Number(valueMb) || 0);
    if (nextMb === current) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body =
        field === 'bought'
          ? { refill_bought_mb: nextMb }
          : { refill_remain_mb: nextMb };
      const { data } = await api.put('/api/admin/vault/refill-quota', body);
      setEditing(false);
      setDraft('');
      await onSaved?.(data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          verticalAlign: 'baseline',
          ...sx
        }}
      >
        <Box
          component="input"
          ref={inputRef}
          type="text"
          value={draft}
          disabled={saving}
          aria-label={field === 'bought' ? 'Edit purchased data' : 'Edit remaining data'}
          title="Enter to save · Esc to cancel"
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              skipBlurCancelRef.current = true;
              void saveEdit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              skipBlurCancelRef.current = true;
              cancelEdit();
            }
          }}
          onBlur={() => {
            if (skipBlurCancelRef.current) {
              skipBlurCancelRef.current = false;
              return;
            }
            if (!saving) cancelEdit();
          }}
          sx={{
            width: `${Math.max(4.5, String(draft).length + 1.5)}ch`,
            minWidth: '4.5ch',
            px: 0.4,
            py: 0.1,
            m: 0,
            border: '1px solid #fff',
            borderRadius: 0.5,
            bgcolor: '#111',
            color: 'var(--theme-yellow-color)',
            WebkitTextFillColor: 'var(--theme-yellow-color)',
            font: 'inherit',
            fontWeight: 800,
            outline: 'none'
          }}
        />
        {error ? (
          <Box component="span" sx={{ color: '#ff8a80', fontSize: '0.75em', fontWeight: 700 }}>
            {error}
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      component="span"
      onDoubleClick={beginEdit}
      title="Admin: double-click to edit · Enter to save"
      sx={{
        cursor: 'text',
        borderBottom: '1px dashed rgba(255,255,0,0.55)',
        ...sx
      }}
    >
      {label}
    </Box>
  );
}

AdminEditableUsageDataAmount.propTypes = {
  field: PropTypes.oneOf(['remain', 'bought']).isRequired,
  valueMb: PropTypes.number,
  onSaved: PropTypes.func,
  sx: PropTypes.object
};
