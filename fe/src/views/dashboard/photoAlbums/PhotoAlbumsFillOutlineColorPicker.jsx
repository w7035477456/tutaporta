import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { themedAlert } from 'utils/themedDialog';

/** Quick-pick swatches (matches Add Text Fill/Outline picker mock). */
export const PLACE_TEXT_COLOR_SWATCHES = [
  '#FFFFFF',
  '#BDBDBD',
  '#757575',
  '#000000',
  '#E53935',
  '#FB8C00',
  '#FBE618',
  '#43A047',
  '#1E88E5',
  '#8E24AA',
  '#00ACC1',
  '#8D6E63'
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalizeHex(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (s[0] !== '#') s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  const to = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** RGB 0–255 → HSV { h:0–360, s:0–1, v:0–1 } */
function rgbToHsv(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255
  };
}

function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

const tabLabelSx = {
  color: 'var(--theme-yellow-color) !important',
  WebkitTextFillColor: 'var(--theme-yellow-color) !important',
  fontWeight: 800,
  fontSize: '0.85rem !important',
  fontFamily: MAIN_FONT_FAMILY,
  lineHeight: 1.1
};

/**
 * Fill / Outline color picker — swatches, SV square, hue bar, eyedropper, Hex.
 */
export default function PhotoAlbumsFillOutlineColorPicker({
  fillColor,
  outlineColor,
  onFillChange,
  onOutlineChange
}) {
  const [mode, setMode] = useState('fill'); // 'fill' | 'outline'
  const activeHex = normalizeHex(mode === 'fill' ? fillColor : outlineColor) || '#000000';
  const [hsv, setHsv] = useState(() => hexToHsv(activeHex));
  const [hexDraft, setHexDraft] = useState(activeHex);
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const dragKindRef = useRef(null);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const applyHex = useCallback(
    (hex) => {
      const next = normalizeHex(hex);
      if (!next) return;
      setHexDraft(next);
      const nextHsv = hexToHsv(next);
      setHsv(nextHsv);
      hsvRef.current = nextHsv;
      if (mode === 'fill') onFillChange?.(next);
      else onOutlineChange?.(next);
    },
    [mode, onFillChange, onOutlineChange]
  );

  // Sync when external color / tab changes.
  useEffect(() => {
    const next = normalizeHex(mode === 'fill' ? fillColor : outlineColor) || '#000000';
    setHexDraft(next);
    const nextHsv = hexToHsv(next);
    setHsv(nextHsv);
    hsvRef.current = nextHsv;
  }, [fillColor, outlineColor, mode]);

  const commitHsv = useCallback(
    (nextHsv) => {
      const h = clamp(nextHsv.h, 0, 360);
      const s = clamp(nextHsv.s, 0, 1);
      const v = clamp(nextHsv.v, 0, 1);
      const hex = hsvToHex(h, s, v);
      const normalized = { h, s, v };
      setHsv(normalized);
      hsvRef.current = normalized;
      setHexDraft(hex);
      if (mode === 'fill') onFillChange?.(hex);
      else onOutlineChange?.(hex);
    },
    [mode, onFillChange, onOutlineChange]
  );

  const pointerOnSv = useCallback(
    (clientX, clientY) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const v = clamp(1 - (clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      commitHsv({ ...hsvRef.current, s, v });
    },
    [commitHsv]
  );

  const pointerOnHue = useCallback(
    (clientY) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = clamp(((clientY - rect.top) / Math.max(1, rect.height)) * 360, 0, 360);
      commitHsv({ ...hsvRef.current, h });
    },
    [commitHsv]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (dragKindRef.current === 'sv') pointerOnSv(e.clientX, e.clientY);
      else if (dragKindRef.current === 'hue') pointerOnHue(e.clientY);
    };
    const onUp = () => {
      dragKindRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pointerOnHue, pointerOnSv]);

  const handleEyedropper = async () => {
    if (typeof window.EyeDropper !== 'function') {
      await themedAlert('Eyedropper is not supported in this browser. Use Chrome/Edge, or enter a Hex color.');
      return;
    }
    try {
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      if (result?.sRGBHex) applyHex(result.sRGBHex);
    } catch {
      // User cancelled — ignore.
    }
  };

  const hueColor = hsvToHex(hsv.h, 1, 1);
  const fillNorm = normalizeHex(fillColor) || '#FBE618';
  const outlineNorm = normalizeHex(outlineColor) || '#000000';

  const modeTab = (id, label, swatch) => {
    const selected = mode === id;
    return (
      <Box
        component="button"
        type="button"
        aria-pressed={selected}
        onClick={() => setMode(id)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          m: 0,
          px: 1,
          py: 0.5,
          border: selected ? '3px solid #e53935' : '2px solid #000',
          borderRadius: 0.75,
          bgcolor: selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
          cursor: 'pointer',
          fontFamily: MAIN_FONT_FAMILY
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 22,
            borderRadius: 0.5,
            border: '2px solid #000',
            bgcolor: swatch,
            flex: '0 0 auto'
          }}
        />
        <Typography component="span" sx={tabLabelSx}>
          {label}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 320,
        p: 1,
        bgcolor: 'rgba(255,255,255,0.92)',
        border: '2px solid #000',
        borderRadius: 1,
        boxSizing: 'border-box'
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        {modeTab('fill', 'Fill', fillNorm)}
        {modeTab('outline', 'Outline', outlineNorm)}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 0.5,
          mb: 1
        }}
      >
        {PLACE_TEXT_COLOR_SWATCHES.map((sw) => (
          <Box
            key={sw}
            component="button"
            type="button"
            title={sw}
            aria-label={`Color ${sw}`}
            onClick={() => applyHex(sw)}
            sx={{
              width: '100%',
              aspectRatio: '1',
              m: 0,
              p: 0,
              border:
                normalizeHex(activeHex) === sw ? '3px solid #e53935' : '2px solid #333',
              borderRadius: 0.5,
              bgcolor: sw,
              cursor: 'pointer',
              minHeight: 22
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'stretch', mb: 1 }}>
        <Box
          ref={svRef}
          onPointerDown={(e) => {
            e.preventDefault();
            dragKindRef.current = 'sv';
            pointerOnSv(e.clientX, e.clientY);
          }}
          sx={{
            position: 'relative',
            flex: '1 1 auto',
            minWidth: 0,
            height: 140,
            borderRadius: 0.75,
            border: '2px solid #000',
            cursor: 'crosshair',
            background: `
              linear-gradient(to top, #000, transparent),
              linear-gradient(to right, #fff, ${hueColor})
            `,
            touchAction: 'none'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid #fff',
              boxShadow: '0 0 0 1px #000, 0 1px 3px rgba(0,0,0,0.5)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              bgcolor: activeHex
            }}
          />
        </Box>

        <Box
          ref={hueRef}
          onPointerDown={(e) => {
            e.preventDefault();
            dragKindRef.current = 'hue';
            pointerOnHue(e.clientY);
          }}
          sx={{
            position: 'relative',
            flex: '0 0 18px',
            width: 18,
            borderRadius: 0.75,
            border: '2px solid #000',
            cursor: 'ns-resize',
            background:
              'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            touchAction: 'none'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: `${(hsv.h / 360) * 100}%`,
              width: 22,
              height: 8,
              borderRadius: 0.5,
              border: '2px solid #fff',
              boxShadow: '0 0 0 1px #000',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              bgcolor: hueColor
            }}
          />
        </Box>

        <Box
          component="button"
          type="button"
          title="Pick color from screen"
          aria-label="Eyedropper"
          onClick={() => void handleEyedropper()}
          sx={{
            flex: '0 0 36px',
            width: 36,
            m: 0,
            p: 0,
            border: '2px solid #000',
            borderRadius: 0.75,
            bgcolor: '#eee',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 24 24"
            aria-hidden
            sx={{ width: 22, height: 22, display: 'block' }}
          >
            <path
              fill="#111"
              d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.23-1.21-1.42 1.4 1.23 1.23-8.2 8.2c-.39.39-.39 1.02 0 1.41l2.12 2.12c.39.39 1.02.39 1.41 0l8.2-8.2 1.23 1.23 1.4-1.42-1.21-1.23 3.12-3.12a1 1 0 0 0 0-1.41zM7.41 18.59L5.3 16.47l7.07-7.07 2.12 2.12-7.08 7.07z"
            />
          </Box>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        <Typography
          sx={{
            ...tabLabelSx,
            color: '#111 !important',
            WebkitTextFillColor: '#111 !important',
            mb: 0
          }}
        >
          Hex:
        </Typography>
        <Box
          component="input"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => {
            const next = normalizeHex(hexDraft);
            if (next) applyHex(next);
            else setHexDraft(activeHex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const next = normalizeHex(hexDraft);
              if (next) applyHex(next);
              else setHexDraft(activeHex);
            }
          }}
          aria-label={`${mode === 'fill' ? 'Fill' : 'Outline'} hex color`}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 36,
            px: 1,
            border: '2px solid #1565c0',
            borderRadius: 0.75,
            bgcolor: '#fff',
            color: '#000',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontWeight: 700,
            fontSize: '0.95rem'
          }}
        />
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 0.75,
            border: '2px solid #000',
            bgcolor: activeHex,
            flex: '0 0 auto'
          }}
        />
      </Stack>
    </Box>
  );
}

PhotoAlbumsFillOutlineColorPicker.propTypes = {
  fillColor: PropTypes.string,
  outlineColor: PropTypes.string,
  onFillChange: PropTypes.func,
  onOutlineChange: PropTypes.func
};
