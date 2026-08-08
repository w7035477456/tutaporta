import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import buttonsImg from 'assets/images/buttons.png';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

/** Click regions over `buttons.png` (912×1408) — play, pause, skip, stop, save. */
const BUTTON_HIT_AREAS = {
  play: { top: '0%', left: '0%', width: '50%', height: '32%' },
  pause: { top: '0%', left: '50%', width: '50%', height: '32%' },
  skip: { top: '32%', left: '0%', width: '50%', height: '32%' },
  stop: { top: '32%', left: '50%', width: '50%', height: '32%' },
  save: { top: '64%', left: '12%', width: '76%', height: '36%' }
};

function SpriteHitButton({ areaKey, onClick, disabled, ariaLabel }) {
  const area = BUTTON_HIT_AREAS[areaKey];
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...guestDemoAllowProps()}
      sx={{
        position: 'absolute',
        top: area.top,
        left: area.left,
        width: area.width,
        height: area.height,
        p: 0,
        m: 0,
        border: 'none',
        bgcolor: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        borderRadius: areaKey === 'save' ? 1.5 : '50%',
        transition: 'opacity 180ms ease, transform 180ms ease',
        transform: 'scale(1)',
        transformOrigin: 'center center',
        '@media (hover: hover)': {
          '&:not(:disabled):hover': {
            transform: 'scale(1.06)'
          }
        }
      }}
    />
  );
}

SpriteHitButton.propTypes = {
  areaKey: PropTypes.oneOf(['play', 'pause', 'skip', 'stop', 'save']).isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  ariaLabel: PropTypes.string.isRequired
};

/** Play / pause / skip / stop / save pad from `buttons.png`. */
export default function SelfIntroRecordControlPad({
  onPlay,
  onPause,
  onSkip,
  onStop,
  onSave,
  playDisabled = false,
  pauseDisabled = false,
  skipDisabled = false,
  stopDisabled = false,
  saveDisabled = false
}) {
  return (
    <Box
      {...guestDemoAllowProps()}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: { xs: 200, sm: 220 },
        mx: 'auto',
        userSelect: 'none'
      }}
    >
      <Box
        component="img"
        src={buttonsImg}
        alt=""
        aria-hidden
        draggable={false}
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
          pointerEvents: 'none'
        }}
      />
      <SpriteHitButton areaKey="play" ariaLabel="Play or record" disabled={playDisabled} onClick={onPlay} />
      <SpriteHitButton areaKey="pause" ariaLabel="Pause or continue" disabled={pauseDisabled} onClick={onPause} />
      <SpriteHitButton areaKey="skip" ariaLabel="Record again" disabled={skipDisabled} onClick={onSkip} />
      <SpriteHitButton areaKey="stop" ariaLabel="Stop" disabled={stopDisabled} onClick={onStop} />
      <SpriteHitButton areaKey="save" ariaLabel="Save" disabled={saveDisabled} onClick={onSave} />
    </Box>
  );
}

SelfIntroRecordControlPad.propTypes = {
  onPlay: PropTypes.func,
  onPause: PropTypes.func,
  onSkip: PropTypes.func,
  onStop: PropTypes.func,
  onSave: PropTypes.func,
  playDisabled: PropTypes.bool,
  pauseDisabled: PropTypes.bool,
  skipDisabled: PropTypes.bool,
  stopDisabled: PropTypes.bool,
  saveDisabled: PropTypes.bool
};
