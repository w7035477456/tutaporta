import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { COLOR_TEMPLATE7_POPUP_TEXT } from 'config/colorTemplate7PopupLargeDark';

const DEBUG_FONT_SIZE = '0.72rem';
const DEBUG_LINE_HEIGHT = 1.45;
const DEBUG_VISIBLE_LINES = 2;

const debugTwoLineHeight = `calc(${DEBUG_FONT_SIZE} * ${DEBUG_LINE_HEIGHT} * ${DEBUG_VISIBLE_LINES})`;

const panelSx = {
  mt: 1,
  p: 1.25,
  borderRadius: 1,
  border: '1px dashed',
  borderColor: 'rgba(255,255,255,0.45)',
  bgcolor: 'rgba(0,0,0,0.25)',
  maxHeight: `calc(${debugTwoLineHeight} + 2.5rem)`,
  overflow: 'auto',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: DEBUG_FONT_SIZE,
  lineHeight: DEBUG_LINE_HEIGHT,
  color: COLOR_TEMPLATE7_POPUP_TEXT
};

const rowSx = {
  mb: 0.75,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: debugTwoLineHeight,
  overflow: 'auto'
};

export default function RekognitionVerifyDebugPanel({ title = 'Debug log', lines = [], snapshot = null }) {
  if (!lines.length && !snapshot) return null;

  return (
    <Box sx={panelSx}>
      <Typography sx={{ fontWeight: 700, mb: 0.75, fontSize: '0.75rem', color: COLOR_TEMPLATE7_POPUP_TEXT }}>
        {title} (remove in production via REKOGNITION_DEBUG_UI=false)
      </Typography>
      {snapshot ? (
        <Box component="pre" sx={{ ...rowSx, m: 0, maxHeight: debugTwoLineHeight, overflow: 'auto' }}>
          {JSON.stringify(snapshot, null, 2)}
        </Box>
      ) : null}
      {lines.map((line, index) => (
        <Box key={`${line.ts}-${index}`} sx={rowSx}>
          [{line.ts}] {line.message}
          {line.detail != null ? `\n${typeof line.detail === 'string' ? line.detail : JSON.stringify(line.detail, null, 2)}` : ''}
        </Box>
      ))}
    </Box>
  );
}

RekognitionVerifyDebugPanel.propTypes = {
  title: PropTypes.string,
  lines: PropTypes.arrayOf(
    PropTypes.shape({
      ts: PropTypes.string,
      message: PropTypes.string,
      detail: PropTypes.any
    })
  ),
  snapshot: PropTypes.object
};
