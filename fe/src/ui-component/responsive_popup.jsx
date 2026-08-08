import PropTypes from 'prop-types';

import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH } from 'config/colorTemplate7PopupLargeDark';

/**
 * Instruction / account popup shell — delegates to ColorTemplate7PopupLargeDark.
 * Legacy props (orange CT2 styling, CT1 selected panel, etc.) are ignored; use CT7 subcomponents in children.
 */
export default function ResponsivePopup({
  open,
  onClose,
  children,
  maxWidth = COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH,
  showCloseButton = true,
  closeButtonAriaLabel = 'Close popup'
}) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      closeOnBackdrop
      showCloseButton={showCloseButton}
      closeButtonAriaLabel={closeButtonAriaLabel}
    >
      <ColorTemplate7PopupLargeDark.Body>{children}</ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

ResponsivePopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  maxWidth: PropTypes.string,
  showCloseButton: PropTypes.bool,
  closeButtonAriaLabel: PropTypes.string
};
