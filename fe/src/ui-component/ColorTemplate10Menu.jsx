import PropTypes from 'prop-types';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ButtonTemplateIcon from 'ui-component/ButtonTemplateIcon';
import {
  buttonTemplateIconSizeResponsive,
  buttonTemplateIconSx
} from 'config/selectedUnselectedButtonTemplate';
import {
  COLOR_TEMPLATE10_MENU_HOVER_SCALE,
  colorTemplate10MenuIconSlotSx,
  colorTemplate10MenuItemButtonSx,
  colorTemplate10MenuItemInnerSx,
  colorTemplate10MenuItemSx,
  colorTemplate10MenuShellSx,
  colorTemplate10MenuWidthSx
} from 'config/colorTemplate10Menu';

/**
 * Sidebar menu rows — ColorTemplate10Menu theme colors.
 *
 * Unselected: theme-primary bg, theme-daynight text.
 * Selected: theme-secondary bg, theme-inverse-daynight text.
 * Hover: 25% scale. Icon size + width match existing sidebar defaults.
 *
 *   <ColorTemplate10Menu>
 *     <ColorTemplate10Menu.Item selected component={Link} to="...">
 *       <ColorTemplate10Menu.Icon src={icon} alt="" />
 *       <ColorTemplate10Menu.Label>All Singles</ColorTemplate10Menu.Label>
 *     </ColorTemplate10Menu.Item>
 *   </ColorTemplate10Menu>
 */
function ColorTemplate10Menu({ disablePadding = false, sx, children, ...rest }) {
  return (
    <List
      disablePadding={disablePadding}
      sx={{ ...colorTemplate10MenuShellSx(), ...(sx || {}) }}
      {...rest}
    >
      {children}
    </List>
  );
}

function ColorTemplate10MenuItem({
  selected = false,
  drawerOpen = true,
  level = 1,
  downSM = false,
  fullWidth = true,
  hoverScale = COLOR_TEMPLATE10_MENU_HOVER_SCALE,
  hoverZIndex,
  sx,
  children,
  ...rest
}) {
  if (level !== 1) {
    return (
      <ListItemButton selected={selected} sx={sx} {...rest}>
        {children}
      </ListItemButton>
    );
  }

  return (
    <Button
      fullWidth
      sx={{
        ...colorTemplate10MenuItemButtonSx({ selected, hoverScale, hoverZIndex }),
        ...(drawerOpen && fullWidth ? colorTemplate10MenuWidthSx() : null),
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: drawerOpen ? 'flex-start' : 'center',
        textAlign: 'left',
        mb: 0.5,
        position: 'relative',
        overflow: 'visible',
        ...(downSM && drawerOpen ? { py: 0.25, minHeight: 'auto' } : null),
        ...(!drawerOpen ? { px: 0.5, py: 0.75, minWidth: 0 } : null),
        ...(sx || {})
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

function ColorTemplate10MenuIcon(props) {
  return <ButtonTemplateIcon {...props} />;
}

function ColorTemplate10MenuLabel({ sx, children, ...rest }) {
  return (
    <Typography
      component="span"
      noWrap
      sx={{
        color: 'inherit',
        WebkitTextFillColor: 'inherit',
        fontWeight: 'inherit',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        ...(sx || {})
      }}
      {...rest}
    >
      {children}
    </Typography>
  );
}

ColorTemplate10Menu.Item = ColorTemplate10MenuItem;
ColorTemplate10Menu.Icon = ColorTemplate10MenuIcon;
ColorTemplate10Menu.Label = ColorTemplate10MenuLabel;
ColorTemplate10Menu.itemSx = colorTemplate10MenuItemSx;
ColorTemplate10Menu.itemButtonSx = colorTemplate10MenuItemButtonSx;
ColorTemplate10Menu.widthSx = colorTemplate10MenuWidthSx;
ColorTemplate10Menu.shellSx = colorTemplate10MenuShellSx;
ColorTemplate10Menu.iconSlotSx = colorTemplate10MenuIconSlotSx;
ColorTemplate10Menu.itemInnerSx = colorTemplate10MenuItemInnerSx;
ColorTemplate10Menu.hoverScale = COLOR_TEMPLATE10_MENU_HOVER_SCALE;
ColorTemplate10Menu.iconSize = buttonTemplateIconSizeResponsive;
ColorTemplate10Menu.iconSx = buttonTemplateIconSx;

export default ColorTemplate10Menu;

ColorTemplate10Menu.propTypes = {
  disablePadding: PropTypes.bool,
  sx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate10MenuItem.propTypes = {
  selected: PropTypes.bool,
  drawerOpen: PropTypes.bool,
  level: PropTypes.number,
  downSM: PropTypes.bool,
  fullWidth: PropTypes.bool,
  hoverScale: PropTypes.number,
  hoverZIndex: PropTypes.number,
  sx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate10MenuIcon.propTypes = {
  sx: PropTypes.object,
  src: PropTypes.string,
  alt: PropTypes.string
};

ColorTemplate10MenuLabel.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node
};

export {
  colorTemplate10MenuItemSx,
  colorTemplate10MenuItemButtonSx,
  colorTemplate10MenuWidthSx,
  colorTemplate10MenuShellSx,
  colorTemplate10MenuIconSlotSx,
  colorTemplate10MenuItemInnerSx,
  COLOR_TEMPLATE10_MENU_HOVER_SCALE,
  COLOR_TEMPLATE10_MENU_SHELL_BORDER
} from 'config/colorTemplate10Menu';
