import PropTypes from 'prop-types';
import GreenButton from 'ui-component/GreenButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

export default function EarnTokensButton({ onClick, label = 'Earn Tokens', disabled = false }) {
  return (
    <GreenButton type="button" onClick={onClick} disabled={disabled} {...guestDemoAllowProps()}>
      {label}
    </GreenButton>
  );
}

EarnTokensButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool
};
