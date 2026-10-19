import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { getPageVideoTutorialUrl } from 'config/pageVideoTutorialEnv';
import {
  ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS,
  orangeUnSelectedInstructionButtonSx
} from 'config/orangeInstructionButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { openYoutubeTutorialWindow } from 'utils/openYoutubeTutorialWindow';

const videoTutorialLabel = (
  <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
    <span>Video</span>
    <span>Tutorial</span>
  </Box>
);

/**
 * Orange two-row "Video Tutorial" button (same look as "Text Tutorial") — opens the per-page
 * ENV URL (or an explicit `href`) in a theater-style popup (full-window player).
 */
export default function PageVideoTutorialsButton({ pageKey, href: hrefProp, sx }) {
  const hrefFromEnv = pageKey ? getPageVideoTutorialUrl(pageKey) : '';
  const href = String(hrefProp ?? '').trim() || hrefFromEnv;
  const disabled = !href;

  return (
    <UnSelectedButtonTemplate
      type="button"
      fitLabelWidth
      disabled={disabled}
      {...ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS}
      {...guestDemoAllowProps()}
      onClick={(event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!href) return;
        openYoutubeTutorialWindow(href);
      }}
      aria-label="Watch video tutorial"
      title="Video tutorial"
      sx={{
        ...orangeUnSelectedInstructionButtonSx({ transformOrigin: 'center center' }),
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...sx
      }}
    >
      {videoTutorialLabel}
    </UnSelectedButtonTemplate>
  );
}

PageVideoTutorialsButton.propTypes = {
  pageKey: PropTypes.oneOf([
    'topRight',
    'allSingles',
    'picksPosts',
    'acquaintBuddies',
    'myAlbum',
    'mySelfReportBio',
    'receivedBioRequest',
    'profileRecords'
  ]),
  /** Explicit YouTube (or other) URL — used when set; otherwise `pageKey` ENV URL. */
  href: PropTypes.string,
  sx: PropTypes.object
};
