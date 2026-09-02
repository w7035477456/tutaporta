import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { exitMenuIcon } from 'config/menuIcons';
import { colorTemplate10MenuItemButtonSx } from 'config/colorTemplate10Menu';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getSidebarCollapsedControlSizePx, getSidebarExitMenuIconPx } from 'config/menuNavFontEnv';
import { SIDEBAR_MENU_ICON_CLASS, exitToMallYellowDashedBorderSx } from 'config/selectedUnselectedButtonTemplate';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';

const EXIT_ICON_PX = 40;

const toolbarLayoutSx = {
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: '100%',
  flexShrink: 0,
  justifyContent: 'flex-start',
  textAlign: 'left',
  transformOrigin: 'left center',
  overflow: 'visible',
  whiteSpace: 'nowrap',
  WebkitTapHighlightColor: 'transparent',
  py: { xs: 0.75, sm: 0.875 },
  px: { xs: 1, sm: 1.25 },
  lineHeight: 1.2,
  '& .MuiButton-startIcon': { marginRight: 1, marginLeft: 0, flexShrink: 0 },
  '& .MuiButton-label': { whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }
};

function vaultExitToolbarButtonSx(compact) {
  const base = colorTemplate10MenuItemButtonSx({ selected: false, hoverScale: 1 });
  const magnifyHover = buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeResponsive });
  return {
    ...base,
    ...toolbarLayoutSx,
    ...exitToMallYellowDashedBorderSx(),
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover': {
        ...(base['@media (hover: hover)']?.['&:hover'] ?? {}),
        ...magnifyHover,
        ...exitToMallYellowDashedBorderSx()
      }
    },
    ...(compact
      ? {
          minWidth: getSidebarCollapsedControlSizePx(),
          width: getSidebarCollapsedControlSizePx(),
          height: getSidebarCollapsedControlSizePx(),
          p: 0.5,
          justifyContent: 'center'
        }
      : null)
  };
}

function VaultExitIcon({ size }) {
  return (
    <Box
      component="img"
      src={exitMenuIcon}
      alt=""
      className={SIDEBAR_MENU_ICON_CLASS}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block'
      }}
    />
  );
}

VaultExitIcon.propTypes = {
  size: PropTypes.number.isRequired
};

/**
 * TutaNotes / TutaPhotoAlbums header Exit to Mall — same look as Profile menu (icon + label).
 */
export default function VaultExitToMallToolbarButton({
  onClick,
  disabled = false,
  compact = false,
  usePaneLogOff = false,
  logOffPaneLabel = 'Log off',
  sx,
  ...rest
}) {
  const exitLabel = usePaneLogOff ? logOffPaneLabel : 'Exit to Mall';
  const iconPx = compact ? getSidebarExitMenuIconPx(false) : EXIT_ICON_PX;

  const button = (
    <Button
      type="button"
      disableElevation
      disableRipple
      disabled={disabled}
      startIcon={compact ? undefined : <VaultExitIcon size={iconPx} />}
      onClick={onClick}
      aria-label={exitLabel}
      title={exitLabel}
      sx={{ ...vaultExitToolbarButtonSx(compact), ...sx }}
      {...rest}
    >
      {compact ? (
        usePaneLogOff ? (
          logOffPaneLabel.charAt(0)
        ) : (
          <VaultExitIcon size={iconPx} />
        )
      ) : usePaneLogOff ? (
        logOffPaneLabel
      ) : (
        'Exit to Mall'
      )}
    </Button>
  );

  if (compact) {
    return (
      <Tooltip title={exitLabel} placement="bottom">
        {button}
      </Tooltip>
    );
  }

  return button;
}

VaultExitToMallToolbarButton.propTypes = {
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
  usePaneLogOff: PropTypes.bool,
  logOffPaneLabel: PropTypes.string,
  sx: PropTypes.object
};
