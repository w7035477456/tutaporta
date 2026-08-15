import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

// project imports
import { getDebugDottedBorders } from 'config/debugEnv';

// constant
const headerStyle = {
  '& .MuiCardHeader-action': { mr: 0 }
};

export default function MainCard({
  border = false,
  boxShadow,
  children,
  content = true,
  contentClass = '',
  contentSX = {},
  headerSX = {},
  darkTitle,
  secondary,
  /** Optional node absolutely centered in the card header (e.g. Video Tutorials). */
  center,
  shadow,
  sx = {},
  title,
  ref,
  ...others
}) {
  const defaultShadow = '0 2px 14px 0 rgb(32 40 45 / 8%)';
  const debugBorder = getDebugDottedBorders();
  const showHeader = Boolean(title || darkTitle || secondary || center);

  return (
    <Card
      ref={ref}
      {...others}
      sx={(theme) => ({
        ...(debugBorder ? { border: '3px dashed green' } : {}), //by ANDREWTON, DO NOT REMOVE THIS CODE

        // Shell cards: follow app CSS vars instead of MUI `background.paper` (fixes page chrome on vsingles, etc.)
        backgroundColor: 'var(--theme-daynight-color)',

        // Extra space at bottom so last lines (e.g. footer links) are not clipped on small viewports only
        boxSizing: 'border-box',
        overflow: 'visible',
        [theme.breakpoints.down('sm')]: {
          paddingBottom: '4%'
        },

        ':hover': {
          boxShadow: boxShadow ? shadow || defaultShadow : 'inherit'
        },
        ...(typeof sx === 'function' ? sx(theme) : sx || {})
      })}
    >
      {/* card header and action */}
      {showHeader ? (
        <Box sx={{ position: 'relative' }}>
          {!darkTitle && (title || secondary) ? (
            <CardHeader sx={{ ...headerStyle, ...headerSX }} title={title} action={secondary} />
          ) : null}
          {darkTitle && (title || secondary) ? (
            <CardHeader
              sx={{ ...headerStyle, ...headerSX }}
              title={title ? <Typography variant="h3">{title}</Typography> : undefined}
              action={secondary}
            />
          ) : null}
          {center ? (
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
                maxWidth: { xs: '46%', sm: '40%' },
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                '& > *': { pointerEvents: 'auto' }
              }}
            >
              {center}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {/* content & header divider */}
      {showHeader && (title || darkTitle || secondary) ? <Divider /> : null}

      {/* card content */}
      {content && (
        <CardContent sx={contentSX} className={contentClass}>
          {children}
        </CardContent>
      )}
      {!content && children}
    </Card>
  );
}

MainCard.propTypes = {
  border: PropTypes.bool,
  boxShadow: PropTypes.bool,
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  content: PropTypes.bool,
  contentClass: PropTypes.string,
  contentSX: PropTypes.object,
  headerSX: PropTypes.object,
  darkTitle: PropTypes.bool,
  secondary: PropTypes.any,
  center: PropTypes.node,
  shadow: PropTypes.string,
  sx: PropTypes.object,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  ref: PropTypes.object,
  others: PropTypes.any
};
