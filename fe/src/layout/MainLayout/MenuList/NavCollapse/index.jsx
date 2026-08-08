import PropTypes from 'prop-types';
import { Activity, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import NavItem from '../NavItem';
import Transitions from 'ui-component/extended/Transitions';

import { useGetMenuMaster } from 'api/menu';
import useConfig from 'hooks/useConfig';
import useMenuCollapse from 'hooks/useMenuCollapse';
import {
  getSidebarMenuFontSizeResponsive,
  getSidebarMenuIconSlotSx,
  getSidebarMenuImgIconSize,
  getSidebarMenuTablerIconSize
} from 'config/menuNavFontEnv';
import ColorTemplate10Menu from 'ui-component/ColorTemplate10Menu';

// assets
import { IconChevronDown, IconChevronRight, IconChevronUp } from '@tabler/icons-react';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const sidebarMenuFontSize = getSidebarMenuFontSizeResponsive();

export default function NavCollapse({ menu, level, parentId }) {
  const theme = useTheme();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const ref = useRef(null);

  const {
    state: { borderRadius }
  } = useConfig();

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;

  // Always keep Singles group (dashboard) expanded
  const isAlwaysExpanded = menu.id === 'dashboard';
  const [open, setOpen] = useState(isAlwaysExpanded);
  const [selected, setSelected] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClickMini = (event) => {
    setAnchorEl(null);
    if (drawerOpen) {
      // Don't toggle if this menu should always be expanded
      if (!isAlwaysExpanded) {
        setOpen(!open);
        setSelected(!selected ? menu.id : null);
      }
    } else {
      setAnchorEl(event?.currentTarget);
    }
  };

  const openMini = Boolean(anchorEl);

  const handleMiniClose = () => {
    setAnchorEl(null);
  };

  const handleClosePopper = () => {
    // Don't close if this menu should always be expanded
    if (!isAlwaysExpanded) {
      setOpen(false);
    }
    if (!openMini) {
      if (!menu.url) {
        setSelected(null);
      }
    }
    setAnchorEl(null);
  };

  const { pathname } = useLocation();

  // menu collapse for sub-levels
  useMenuCollapse(menu, pathname, openMini, setSelected, setOpen, setAnchorEl);

  const [hoverStatus, setHover] = useState(false);

  const compareSize = () => {
    const compare = ref.current && ref.current.scrollWidth > ref.current.clientWidth;
    setHover(compare);
  };

  useEffect(() => {
    compareSize();
    window.addEventListener('resize', compareSize);
    return () => window.removeEventListener('resize', compareSize);
  }, []);

  useEffect(() => {
    if (menu.url === pathname) {
      setSelected(menu.id);
      setAnchorEl(null);
      setOpen(true);
    }
    // Ensure always expanded menus stay open
    if (isAlwaysExpanded) {
      setOpen(true);
    }
  }, [pathname, menu, isAlwaysExpanded]);

  // menu collapse & item
  const menus = menu.children?.map((item) => {
    switch (item.type) {
      case 'collapse':
        return <NavCollapse key={item.id} menu={item} level={level + 1} parentId={parentId} />;
      case 'item':
        return <NavItem key={item.id} item={item} level={level + 1} />;
      default:
        return (
          <Typography key={item.id} variant="h6" align="center" sx={{ color: 'error.main' }}>
            Menu Items Error
          </Typography>
        );
    }
  });

  const isSelected = selected === menu.id;

  const Icon = menu?.icon;
  const menuIcon = menu?.iconSrc ? (
    <ColorTemplate10Menu.Icon src={menu.iconSrc} alt="" size={getSidebarMenuImgIconSize(drawerOpen)} />
  ) : Icon ? (
    <Icon strokeWidth={1.5} size={getSidebarMenuTablerIconSize(drawerOpen)} />
  ) : (
    <FiberManualRecordIcon
      sx={{
        width: isSelected ? 8 : 6,
        height: isSelected ? 8 : 6
      }}
      fontSize={level > 0 ? 'inherit' : 'medium'}
    />
  );

  const collapseIcon = drawerOpen ? (
    <IconChevronUp stroke={1.5} size="16px" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
  ) : (
    <IconChevronRight stroke={1.5} size="16px" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
  );

  const handleNavContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <ListItemButton
        onContextMenu={handleNavContextMenu}
        sx={{
          zIndex: 1201,
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          borderRadius: `${borderRadius}px`,
          mb: 0.5,
          ...(drawerOpen && level !== 1 && { ml: downSM ? `${level * 8}px` : `${level * 18}px` }),
          ...(!drawerOpen && { pl: 1.25 }),
          ...(downSM && drawerOpen && { py: 0.25, minHeight: 'auto' }),
          ...(level !== 1 && {
            py: 1,
            '&:hover': { bgcolor: 'transparent' },
            '&.Mui-selected': { '&:hover': { bgcolor: 'transparent' }, bgcolor: 'transparent' }
          }),
          ...(level === 1 && {
            bgcolor: 'var(--theme-secondary-color)',
            color: 'var(--theme-primary-color)',
            border: isSelected || anchorEl ? '6px double var(--theme-primary-color)' : '1px solid var(--theme-primary-color)',
            boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
            transition: 'all 0.15s ease',
            transform: 'translate(0, 0)',
            '& .MuiListItemIcon-root': { color: 'var(--theme-primary-color)' },
            '& .MuiTypography-root': { color: 'var(--theme-primary-color) !important' },
            '&:hover': {
              bgcolor: 'var(--theme-secondary-color)',
              color: 'var(--theme-primary-color)',
              border: isSelected || anchorEl ? '6px double var(--theme-primary-color)' : '1px solid var(--theme-primary-color)',
              filter: 'brightness(0.96)',
              boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
              transform: 'translate(2px, 2px) !important',
              '& .MuiListItemIcon-root': { color: 'var(--theme-primary-color)' },
              '& .MuiTypography-root': { color: 'var(--theme-primary-color) !important' }
            },
            '&:active': {
              transform: 'translate(4px, 4px) !important',
              boxShadow: '0px 1px 1px 0px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 2px 0px rgba(0,0,0,0.12)'
            },
            ...(!drawerOpen && {
              justifyContent: 'center',
              px: 0.5,
              py: 0.75
            }),
            '&.Mui-selected': {
              bgcolor: 'var(--theme-secondary-color)',
              color: 'var(--theme-primary-color)',
              border: '6px double var(--theme-primary-color)',
              '&:hover': {
                bgcolor: 'var(--theme-secondary-color)',
                color: 'var(--theme-primary-color)',
                border: '6px double var(--theme-primary-color)',
                filter: 'brightness(0.96)',
                transform: 'translate(2px, 2px) !important',
                '& .MuiListItemIcon-root': { color: 'var(--theme-primary-color)' },
                '& .MuiTypography-root': { color: 'var(--theme-primary-color) !important' }
              },
              '&:active': { transform: 'translate(4px, 4px) !important' }
            }
          })
        }}
        selected={isSelected}
        {...(!drawerOpen && { onMouseEnter: handleClickMini, onMouseLeave: handleMiniClose })}
        className={anchorEl ? 'Mui-selected' : ''}
        onClick={handleClickMini}
      >
        <Activity mode={menuIcon ? 'visible' : 'hidden'}>
          <ListItemIcon
            sx={{
              color: 'var(--theme-primary-color)',
              ...getSidebarMenuIconSlotSx(drawerOpen, { level, downSM }),
              ...(!drawerOpen && level === 1 ? { borderRadius: `${borderRadius}px` } : null)
            }}
          >
            {menuIcon}
          </ListItemIcon>
        </Activity>
        {(drawerOpen || (!drawerOpen && level !== 1)) && (
          <Tooltip title={menu.title} disableHoverListener={!hoverStatus}>
            <ListItemText
              sx={
                drawerOpen
                  ? {
                      flex: '1 1 auto',
                      minWidth: 0,
                      my: 0,
                      overflow: 'hidden',
                      '& .MuiListItemText-primary': { overflow: 'hidden' }
                    }
                  : undefined
              }
              primary={
                <Typography
                  ref={ref}
                  noWrap
                  variant={isSelected || anchorEl ? 'h5' : 'body1'}
                  sx={{
                    fontSize: sidebarMenuFontSize,
                    color: 'var(--theme-primary-color)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%'
                  }}
                >
                  {menu.title}
                </Typography>
              }
              secondary={
                menu.caption && (
                  <Typography
                    gutterBottom
                    sx={{
                      display: 'block',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: 'var(--theme-primary-color)',
                      textTransform: 'capitalize',
                      lineHeight: 1.66
                    }}
                  >
                    {menu.caption}
                  </Typography>
                )
              }
            />
          </Tooltip>
        )}

        {openMini || open ? collapseIcon : <IconChevronDown stroke={1.5} size="16px" style={{ marginTop: 'auto', marginBottom: 'auto' }} />}

        <Activity mode={!drawerOpen ? 'visible' : 'hidden'}>
          <Popper
            open={openMini}
            anchorEl={anchorEl}
            placement="right-start"
            modifiers={[
              {
                name: 'offset',
                options: {
                  offset: [-12, 0]
                }
              }
            ]}
            sx={{
              overflow: 'visible',
              zIndex: 2001,
              minWidth: 180,
              '&:before': {
                content: '""',
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 120,
                borderLeft: `1px solid`,
                borderBottom: `1px solid`,
                borderColor: 'divider'
              }
            }}
          >
            {({ TransitionProps }) => (
              <Transitions in={openMini} {...TransitionProps}>
                <Paper
                  sx={{
                    overflow: 'hidden',
                    boxShadow: theme.shadows[8],
                    backgroundImage: 'none'
                  }}
                >
                  <ClickAwayListener onClickAway={handleClosePopper}>
                    <Box>{menus}</Box>
                  </ClickAwayListener>
                </Paper>
              </Transitions>
            )}
          </Popper>
        </Activity>
      </ListItemButton>
      <Activity mode={drawerOpen ? 'visible' : 'hidden'}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Activity mode={open ? 'visible' : 'hidden'}>
            <List disablePadding sx={{ position: 'relative' }}>
              {menus}
            </List>
          </Activity>
        </Collapse>
      </Activity>
    </>
  );
}

NavCollapse.propTypes = { menu: PropTypes.any, level: PropTypes.number, parentId: PropTypes.string };
