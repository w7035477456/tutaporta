import PropTypes from 'prop-types';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import './HelpMeShineButton.css';

export default function HelpMeShineButton({ onClick }) {
  return (
    <button type="button" className="help-me-shine-button" onClick={onClick} {...guestDemoAllowProps()}>
      <span className="help-me-shine-button__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z" />
        </svg>
      </span>
      <span className="help-me-shine-button__text">
        Make Me Sound Amazing ✨<span className="help-me-shine-button__sub">Tap a few words, we&apos;ll write your intro</span>
      </span>
    </button>
  );
}

HelpMeShineButton.propTypes = {
  onClick: PropTypes.func.isRequired
};
