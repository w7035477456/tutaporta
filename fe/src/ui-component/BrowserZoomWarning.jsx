import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import useBrowserZoomPercent from 'hooks/useBrowserZoomPercent';
import {
  BROWSER_ZOOM_TOLERANCE_PCT,
  getBrowserZoomResetShortcut,
  isBrowserZoomDetectionSupported
} from 'utils/estimateBrowserZoomPercent';

// ================================|| BROWSER ZOOM WARNING (GLOBAL) ||================================ //

/** Non-dismissible modal whenever browser page zoom is not ~100%. Mounted from App.jsx. */
export default function BrowserZoomWarning() {
  const browserZoomPct = useBrowserZoomPercent();
  const blocked =
    isBrowserZoomDetectionSupported() &&
    browserZoomPct != null &&
    Math.abs(browserZoomPct - 100) > BROWSER_ZOOM_TOLERANCE_PCT;

  if (!blocked) return null;

  return (
    <Dialog
      open
      disableEscapeKeyDown
      aria-labelledby="browser-zoom-notice-title"
      aria-describedby="browser-zoom-notice-message"
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.55)' } }
      }}
    >
      <DialogTitle id="browser-zoom-notice-title">Browser zoom must be 100%</DialogTitle>
      <DialogContent>
        <Typography id="browser-zoom-notice-message" component="p" variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {`Your browser zoom is about ${browserZoomPct}%. Press ${getBrowserZoomResetShortcut()} to reset to 100% before continuing.`}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
