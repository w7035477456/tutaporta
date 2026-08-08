import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import makeSelfIntroImg from 'assets/images/makeSelfIntro.png';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

/** Task 1 — marquee image CTA to start self intro video flow. */
export default function SelfIntroVideoCta({ onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label="Let's make and post a fun self intro video"
      {...guestDemoAllowProps()}
      sx={{
        display: 'block',
        p: 0,
        border: 'none',
        bgcolor: 'transparent',
        cursor: 'pointer',
        mx: 'auto',
        mt: 1.5,
        width: '100%',
        maxWidth: '100%',
        flexShrink: 0,
        position: 'relative',
        zIndex: 3,
        transformOrigin: 'center center',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        '@media (hover: hover)': {
          '&:hover': {
            transform: 'scale(1.03)',
            opacity: 0.95
          }
        },
        '&:focus-visible': {
          outline: '2px solid var(--theme-primary-color)',
          outlineOffset: 2
        }
      }}
    >
      <Box
        component="img"
        src={makeSelfIntroImg}
        alt="Let's make and post a fun self intro video"
        sx={{ width: '100%', height: 'auto', display: 'block', verticalAlign: 'top' }}
      />
    </Box>
  );
}

SelfIntroVideoCta.propTypes = {
  onClick: PropTypes.func.isRequired
};
