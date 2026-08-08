import { useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import bulbFrameImg from 'assets/images/bulbFrame.png';

const SCRIPT_PANEL_BG = '#5B110F';
/** Taller than live-scan banner (0.25) so script fills bulb frame width + height. */
const SELF_INTRO_BANNER_VH_RATIO = 0.38;
const POPUP_VH_REFERENCE = '92vh';
const POPUP_VH_MAX_REFERENCE = 'calc(100vh - 24px)';
const SCRIPT_FONT_SCALE_MIN = 0;
const SCRIPT_FONT_SCALE_MAX = 100;
const SCRIPT_FONT_SCALE_STEP = 5;

const scriptFontScaleBarSx = {
  flexShrink: 0,
  mt: 0.5,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 0.35,
  py: 0.45,
  bgcolor: '#ffd84d',
  border: '2px solid #000000',
  borderRadius: 0.75,
  boxSizing: 'border-box'
};

const scriptFontScaleStepButtonSx = {
  minWidth: 28,
  width: 28,
  height: 28,
  p: 0,
  fontWeight: 900,
  fontSize: '1.2rem',
  lineHeight: 1,
  color: '#000000',
  border: '2px solid #000000',
  borderRadius: 0.5,
  bgcolor: '#ffd84d',
  flexShrink: 0
};

const scriptFontScaleSliderSx = {
  color: '#000000',
  flex: 1,
  mx: 0.15,
  '& .MuiSlider-rail': { opacity: 1, bgcolor: '#000000', height: 3 },
  '& .MuiSlider-track': { bgcolor: '#000000', border: 'none', height: 3 },
  '& .MuiSlider-thumb': {
    width: 20,
    height: 20,
    bgcolor: '#ffd84d',
    border: '2px solid #000000',
    boxShadow: 'none',
    '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: 'none' }
  }
};

const scriptFontScaleLabelSx = {
  minWidth: 38,
  textAlign: 'right',
  fontWeight: 800,
  fontSize: { xs: '0.78rem', sm: '0.85rem' },
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  flexShrink: 0
};

const FAVORITE_HIGHLIGHT_SX = {
  bgcolor: '#ffd84d',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  px: 0.25,
  borderRadius: 0.25,
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone'
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function vwToPx(vwValue, viewportWidth) {
  const match = String(vwValue).match(/^([\d.]+)vw$/);
  if (!match) return null;
  return (parseFloat(match[1]) / 100) * viewportWidth;
}

/** Largest 5% step where script text fits scroll area height (0% = base size). */
export function measureSelfIntroScriptFontScalePercent(scriptText, scrollEl, textEl) {
  const containerHeight = scrollEl?.clientHeight ?? 0;
  if (containerHeight <= 0 || !textEl || !String(scriptText ?? '').trim()) return 0;

  const isSm = window.innerWidth >= 600;
  const viewportWidth = window.innerWidth;
  let best = SCRIPT_FONT_SCALE_MIN;

  for (let scale = SCRIPT_FONT_SCALE_MIN; scale <= SCRIPT_FONT_SCALE_MAX; scale += SCRIPT_FONT_SCALE_STEP) {
    const sizes = getScriptPhraseFontSizeSx(scriptText, scale);
    const fontPx = vwToPx(isSm ? sizes.sm : sizes.xs, viewportWidth);
    if (!fontPx) break;

    textEl.style.fontSize = `${fontPx}px`;
    if (textEl.scrollHeight <= containerHeight) {
      best = scale;
    } else {
      break;
    }
  }

  textEl.style.fontSize = '';
  return best;
}

function getScriptPhraseFontSizeSx(phrase, fontScalePercent = 0) {
  const len = String(phrase ?? '').length;
  let base;
  if (len <= 55) base = { xs: '5.4vw', sm: '2.75vw' };
  else if (len <= 75) base = { xs: '4.8vw', sm: '2.45vw' };
  else if (len <= 110) base = { xs: '4.2vw', sm: '2.15vw' };
  else if (len <= 150) base = { xs: '3.6vw', sm: '1.85vw' };
  else base = { xs: '3.1vw', sm: '1.55vw' };

  const factor = 1 + Math.max(0, Number(fontScalePercent) || 0) / 100;
  const scaleVw = (value) => {
    const match = String(value).match(/^([\d.]+)vw$/);
    if (!match) return value;
    return `${(parseFloat(match[1]) * factor).toFixed(3)}vw`;
  };
  return { xs: scaleVw(base.xs), sm: scaleVw(base.sm) };
}

function buildHighlightPattern(terms) {
  const normalized = (Array.isArray(terms) ? terms : [])
    .map((term) => String(term ?? '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!normalized.length) return null;
  return new RegExp(`(${normalized.map(escapeRegExp).join('|')})`, 'gi');
}

export function renderSelfIntroScriptWithHighlights(text, highlightTerms = []) {
  const source = String(text ?? '');
  const pattern = buildHighlightPattern(highlightTerms);
  if (!pattern) return source;

  const parts = source.split(pattern);
  return parts.map((part, index) => {
    if (!part) return null;
    const isHighlight = highlightTerms.some((term) => String(term).toLowerCase() === part.toLowerCase());
    if (!isHighlight) return part;
    return (
      <Box component="span" key={`${part}-${index}`} sx={FAVORITE_HIGHLIGHT_SX}>
        {part}
      </Box>
    );
  });
}

/** Marquee bulb frame around self-intro script (Task 5 / myStory record popup). */
export default function SelfIntroBulbScriptBanner({
  scriptText,
  highlightTerms = [],
  fontScalePercent = 0,
  onFontScalePercentChange,
  autoFitFontScaleNonce = 0
}) {
  const textScrollRef = useRef(null);
  const textRef = useRef(null);
  const showFontScaleSlider = typeof onFontScalePercentChange === 'function';
  const clampedScale = Math.min(
    SCRIPT_FONT_SCALE_MAX,
    Math.max(SCRIPT_FONT_SCALE_MIN, Math.round(Number(fontScalePercent) || 0))
  );

  const setFontScale = (next) => {
    if (!showFontScaleSlider) return;
    const clamped = Math.min(SCRIPT_FONT_SCALE_MAX, Math.max(SCRIPT_FONT_SCALE_MIN, Math.round(next)));
    onFontScalePercentChange(clamped);
  };

  useLayoutEffect(() => {
    if (!showFontScaleSlider || !autoFitFontScaleNonce) return;
    const scrollEl = textScrollRef.current;
    const textEl = textRef.current;
    if (!scrollEl || !textEl) return;

    const fitted = measureSelfIntroScriptFontScalePercent(scriptText, scrollEl, textEl);
    onFontScalePercentChange(fitted);
  }, [autoFitFontScaleNonce, scriptText, showFontScaleSlider, onFontScalePercentChange]);

  return (
    <Box
      sx={{
        width: '100%',
        height: `min(calc(${SELF_INTRO_BANNER_VH_RATIO} * ${POPUP_VH_REFERENCE}), calc(${SELF_INTRO_BANNER_VH_RATIO} * ${POPUP_VH_MAX_REFERENCE}))`,
        minHeight: { xs: 140, sm: 168 },
        mx: 'auto',
        borderRadius: 1,
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        backgroundImage: `url(${bulbFrameImg})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        p: { xs: '7% 4.5% 6.5%', sm: '6.5% 4% 6%' }
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: SCRIPT_PANEL_BG,
          borderRadius: 0.5,
          overflow: 'hidden',
          px: { xs: 0.75, sm: 1 },
          py: { xs: 0.5, sm: 0.75 }
        }}
      >
        <Box
          ref={textScrollRef}
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            overflow: 'auto',
            boxSizing: 'border-box'
          }}
        >
          <Box
            ref={textRef}
            component="span"
            sx={{
              fontWeight: 700,
              color: '#ffffff !important',
              WebkitTextFillColor: '#ffffff !important',
              textAlign: 'center',
              lineHeight: 1.18,
              fontSize: getScriptPhraseFontSizeSx(scriptText, clampedScale),
              display: 'block',
              width: '100%',
              alignSelf: 'center'
            }}
          >
            {renderSelfIntroScriptWithHighlights(scriptText, highlightTerms)}
          </Box>
        </Box>
        {showFontScaleSlider ? (
          <Box sx={scriptFontScaleBarSx} role="group" aria-label="Teleprompter text size">
            <IconButton
              type="button"
              aria-label="Decrease teleprompter text size"
              onClick={() => setFontScale(clampedScale - SCRIPT_FONT_SCALE_STEP)}
              disabled={clampedScale <= SCRIPT_FONT_SCALE_MIN}
              sx={scriptFontScaleStepButtonSx}
            >
              −
            </IconButton>
            <Slider
              value={clampedScale}
              min={SCRIPT_FONT_SCALE_MIN}
              max={SCRIPT_FONT_SCALE_MAX}
              step={SCRIPT_FONT_SCALE_STEP}
              onChange={(_event, value) => setFontScale(Array.isArray(value) ? value[0] : value)}
              aria-label="Teleprompter text size"
              sx={scriptFontScaleSliderSx}
            />
            <IconButton
              type="button"
              aria-label="Increase teleprompter text size"
              onClick={() => setFontScale(clampedScale + SCRIPT_FONT_SCALE_STEP)}
              disabled={clampedScale >= SCRIPT_FONT_SCALE_MAX}
              sx={scriptFontScaleStepButtonSx}
            >
              +
            </IconButton>
            <Typography component="span" sx={scriptFontScaleLabelSx} aria-hidden>
              {clampedScale}%
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

SelfIntroBulbScriptBanner.propTypes = {
  scriptText: PropTypes.string.isRequired,
  highlightTerms: PropTypes.arrayOf(PropTypes.string),
  fontScalePercent: PropTypes.number,
  onFontScalePercentChange: PropTypes.func,
  /** Increment when popup opens to auto-fit teleprompter text to scroll area height. */
  autoFitFontScaleNonce: PropTypes.number
};
