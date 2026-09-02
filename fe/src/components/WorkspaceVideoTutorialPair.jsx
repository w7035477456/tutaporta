import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import {
  ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS,
  orangeUnSelectedInstructionButtonSx
} from 'config/orangeInstructionButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

/** Fallback when site global video tutorial URL is unset. */
export const DEFAULT_WORKSPACE_VIDEO_TUTORIAL_URL = 'https://youtu.be/dMiwcH027fM';

const tutorialButtonSx = {
  flex: '0 0 auto',
  width: 'auto',
  minWidth: 0,
  px: { xs: 0.75, sm: 1 },
  py: { xs: 0.35, sm: 0.45 },
  whiteSpace: 'nowrap',
  fontWeight: 800
};

/**
 * Header pair from mockup: orange VIDEO TUTORIALS graphic + yellow Tutorial button.
 * - Graphic → floating YouTube theater window
 * - Tutorial → caller opens context / instruction popup
 */
export default function WorkspaceVideoTutorialPair({
  videoTutorialUrl = '',
  onTutorialClick,
  tutorialDisabled = false,
  tutorialAriaLabel = 'Open tutorial',
  tutorialTitle = 'Open tutorial',
  /** Album invite bar: yellow SliderControlButton. Bill Schedule center header: orange instruction button. */
  tutorialVariant = 'yellow',
  iconHeight = { xs: 36, sm: 42 },
  sx
}) {
  const watchTutorialsHref =
    String(videoTutorialUrl || '').trim() || DEFAULT_WORKSPACE_VIDEO_TUTORIAL_URL;

  const tutorialControl =
    tutorialVariant === 'orange' ? (
      <UnSelectedButtonTemplate
        type="button"
        fitLabelWidth
        disabled={tutorialDisabled}
        {...ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS}
        {...guestDemoAllowProps()}
        onClick={(event) => {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          onTutorialClick?.(event);
        }}
        aria-label={tutorialAriaLabel}
        title={tutorialTitle}
        sx={{
          ...orangeUnSelectedInstructionButtonSx({ transformOrigin: 'center center' }),
          whiteSpace: 'nowrap'
        }}
      >
        Tutorial
      </UnSelectedButtonTemplate>
    ) : (
      <SliderControlButton
        type="button"
        variant="yellow"
        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
        disabled={tutorialDisabled}
        onClick={(event) => {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          onTutorialClick?.(event);
        }}
        aria-label={tutorialAriaLabel}
        title={tutorialTitle}
        {...guestDemoAllowProps()}
        sx={tutorialButtonSx}
      >
        Tutorial
      </SliderControlButton>
    );

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        flexShrink: 0,
        ml: 0.5,
        ...sx
      }}
    >
      <PageVideoTutorialsButton
        href={watchTutorialsHref}
        sx={{
          height: iconHeight,
          flexShrink: 0
        }}
      />
      {tutorialControl}
    </Box>
  );
}

WorkspaceVideoTutorialPair.propTypes = {
  videoTutorialUrl: PropTypes.string,
  onTutorialClick: PropTypes.func,
  tutorialDisabled: PropTypes.bool,
  tutorialAriaLabel: PropTypes.string,
  tutorialTitle: PropTypes.string,
  tutorialVariant: PropTypes.oneOf(['yellow', 'orange']),
  iconHeight: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.shape({
      xs: PropTypes.number,
      sm: PropTypes.number
    })
  ]),
  sx: PropTypes.object
};
