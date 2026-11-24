import PropTypes from 'prop-types';
import IconButton from '@mui/material/IconButton';
import SvgIcon from '@mui/material/SvgIcon';

/** Closed eye with lashes — shown while the password is hidden (dots). */
export function ClosedEyeLashesIcon(props) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path
        d="M2.5 9.5 Q12 18 21.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="4.6" y1="11.6" x2="3" y2="14" />
        <line x1="7.6" y1="13.4" x2="6.6" y2="16.3" />
        <line x1="12" y1="14.3" x2="12" y2="17.4" />
        <line x1="16.4" y1="13.4" x2="17.4" y2="16.3" />
        <line x1="19.4" y1="11.6" x2="21" y2="14" />
      </g>
    </SvgIcon>
  );
}

/** Open eye with lashes — shown while the password is visible (plain text). */
export function OpenEyeLashesIcon(props) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path
        d="M2 14 Q12 4 22 14 Q12 22 2 14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="5.5" y1="9.6" x2="4.2" y2="7.4" />
        <line x1="9" y1="7.7" x2="8.4" y2="5.2" />
        <line x1="12" y1="7.1" x2="12" y2="4.5" />
        <line x1="15" y1="7.7" x2="15.6" y2="5.2" />
        <line x1="18.5" y1="9.6" x2="19.8" y2="7.4" />
      </g>
    </SvgIcon>
  );
}

/**
 * Eye button for password inputs: closed eye = hidden, open eye = visible.
 * Click toggles; mousedown is swallowed so the input keeps focus/caret.
 */
export default function PasswordVisibilityToggle({ visible, onToggle, disabled = false, sx, edge = 'end' }) {
  return (
    <IconButton
      type="button"
      aria-label={visible ? 'Hide password' : 'Show password'}
      title={visible ? 'Hide password' : 'Show password'}
      onClick={onToggle}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      edge={edge}
      tabIndex={-1}
      sx={{ color: '#333', p: 0.5, '& .MuiSvgIcon-root': { fontSize: '1.5em' }, ...(sx || {}) }}
    >
      {visible ? <OpenEyeLashesIcon /> : <ClosedEyeLashesIcon />}
    </IconButton>
  );
}

PasswordVisibilityToggle.propTypes = {
  visible: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  sx: PropTypes.object,
  edge: PropTypes.oneOf(['start', 'end', false])
};
