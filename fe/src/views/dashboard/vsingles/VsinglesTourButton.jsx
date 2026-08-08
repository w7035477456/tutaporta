import PropTypes from 'prop-types';
import { useLocation, useNavigate } from 'react-router-dom';

import { handlerDrawerOpen } from 'api/menu';
import {
  ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS,
  orangeUnSelectedInstructionButtonSx
} from 'config/orangeInstructionButton';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { startVsinglesTourFromSidebar } from 'utils/vsinglesTour';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

export default function VsinglesTourButton({ compact = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <UnSelectedButtonTemplate
      type="button"
      fullWidth={!compact}
      fitLabelWidth={compact}
      {...ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS}
      {...guestDemoAllowProps()}
      onClick={(e) => {
        e.stopPropagation();
        handlerDrawerOpen(true);
        startVsinglesTourFromSidebar(pathname, navigate);
      }}
      aria-label="New here? Click for step by step tour"
      sx={{
        ...orangeUnSelectedInstructionButtonSx({ transformOrigin: 'center center' }),
        ...(compact
          ? { lineHeight: 1.15, whiteSpace: 'normal', textAlign: 'center' }
          : { whiteSpace: 'nowrap' })
      }}
    >
      {compact ? (
        <>
          Tour
          <br />
          💕
        </>
      ) : (
        'New here? Click for step by step tour! 💕'
      )}
    </UnSelectedButtonTemplate>
  );
}

VsinglesTourButton.propTypes = {
  compact: PropTypes.bool
};
