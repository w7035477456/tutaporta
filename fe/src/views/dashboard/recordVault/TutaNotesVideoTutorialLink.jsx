import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { ORANGE_BUTTON_ENABLED_BG } from 'config/orangeButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

const linkSx = {
  display: 'inline-block',
  width: 'fit-content',
  maxWidth: '100%',
  mt: 0.35,
  mb: 1,
  px: 0.75,
  py: 0.25,
  borderRadius: 0.5,
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '0.92rem', sm: '1rem' },
  lineHeight: 1.35,
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  textDecoration: 'underline !important',
  textDecorationColor: '#000 !important',
  cursor: 'pointer',
  border: 'none',
  bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`,
  textAlign: 'left',
  '&:link, &:visited, &:active': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    textDecorationColor: '#000 !important',
    bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`
  },
  '&:hover': {
    filter: 'brightness(1.05)',
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    textDecorationColor: '#000 !important',
    bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`
  }
};

/** Black text on orange — opens global.video_tutorial_tutanotes in a new window. */
export default function TutaNotesVideoTutorialLink({
  href = '',
  label = 'Click here for video tutorial on TutaNotes'
}) {
  const url = String(href || '').trim();
  const linkLabel = String(label || '').trim() || 'Click here for video tutorial on TutaNotes';

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box
      component="a"
      href={url || undefined}
      role="link"
      tabIndex={0}
      target={url ? '_blank' : undefined}
      rel={url ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleClick(event);
        }
      }}
      aria-disabled={!url}
      {...guestDemoAllowProps()}
      sx={{
        ...linkSx,
        ...(!url
          ? {
              cursor: 'default',
              opacity: 0.85
            }
          : null)
      }}
    >
      {linkLabel}
    </Box>
  );
}

TutaNotesVideoTutorialLink.propTypes = {
  href: PropTypes.string,
  label: PropTypes.string
};
