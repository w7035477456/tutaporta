import PropTypes from 'prop-types';
import { Activity, useEffect, useRef, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import { handlerDrawerOpen, closeSidebarAfterNavSelectIfMobile, useGetMenuMaster } from 'api/menu';
import { navigationDrawerOpenState } from 'config/navigationCollapseEnv';
import useConfig from 'hooks/useConfig';
import usePressHoldZoomSuppression from 'hooks/usePressHoldZoomSuppression';
import useFitTextToWidth from 'hooks/useFitTextToWidth';
import useVsinglesTour from 'hooks/useVsinglesTour';
import { TOUR_STEP_ALL_SINGLES, TOUR_STEP_MY_PICKS, TOUR_STEP_VETTED_FRIENDS_SMS } from 'utils/vsinglesTour';
import {
  getSidebarMenuFontSizeResponsive,
  getSidebarMenuImgIconSize,
  getSidebarMenuTablerIconSize
} from 'config/menuNavFontEnv';
import ColorTemplate10Menu from 'ui-component/ColorTemplate10Menu';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { colorTemplate10MenuIconSlotSx } from 'config/colorTemplate10Menu';
import {
  SELECTED_BUTTON_TEMPLATE_TEXT,
  UNSELECTED_BUTTON_TEMPLATE_TEXT
} from 'config/selectedUnselectedButtonTemplate';
import { useGetReceivedBioRequestsPendingCount, useGetVettedFriendsBioResponsePendingCount, useGetBioRequestNotifications } from 'api/bioRequestNotificationsFe';
import { useSelfReportBioCompletedPercent } from 'api/checkrBioReviewFe';
import { receivedBioPendingBadgeChipSx, receivedBioPendingBadgeTooltipSlotProps } from 'config/receivedBioPendingBadge';
import { selfReportBioCompletedBadgeSx, SELF_REPORT_BIO_COMPLETED_BADGE_CLASS } from 'config/selfReportBioCompletedBadge';
import { formatReceivedBioPendingBadgeTooltip } from 'utils/receivedBioPendingTooltip';
import {
  BELL_NOTIFICATION_REFRESH_EVENT
} from 'utils/notificationBellStore';

// assets
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const sidebarMenuFontSize = getSidebarMenuFontSizeResponsive();

export default function NavItem({ item, level, isParents = false, setSelectedID }) {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const overflowProbeRef = useRef(null);

  const { pathname } = useLocation();
  const isReceivedBioRequestsItem = item?.id === 'util-received-bio-requests';
  const isVettedFriendsItem = item?.id === 'util-requests-sent';
  const isSelfReportBioItem = item?.id === 'util-self-report-biography';
  const { pendingCount, refetchPendingCount } = useGetReceivedBioRequestsPendingCount(isReceivedBioRequestsItem);
  const { bioRequestNotifications, refetchBioRequestNotifications } =
    useGetBioRequestNotifications(isReceivedBioRequestsItem);
  const { responsePendingCount, refetchBioResponsePendingCount } =
    useGetVettedFriendsBioResponsePendingCount(isVettedFriendsItem);
  const { completedPercent, refetchCompletedPercent } = useSelfReportBioCompletedPercent(isSelfReportBioItem);
  const {
    state: { borderRadius }
  } = useConfig();
  const { suppressPressHoldZoom, pointerProps: pressHoldPointerProps } = usePressHoldZoomSuppression();

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = navigationDrawerOpenState(menuMaster?.isDashboardDrawerOpened);
  const fitLabelRef = useFitTextToWidth(Boolean(drawerOpen && level === 1), String(item?.title ?? ''));
  const { open: tourOpen, step: tourStep } = useVsinglesTour();
  const tourHighlightNav =
    tourOpen &&
    ((tourStep === TOUR_STEP_ALL_SINGLES && item?.id === 'allSingles') ||
      (tourStep === TOUR_STEP_MY_PICKS && item?.id === 'myPicks') ||
      (tourStep === TOUR_STEP_VETTED_FRIENDS_SMS && item?.id === 'util-requests-sent'));
  const itemPath = item?.link ? item.link : item.url;
  const isSelected =
    (!!itemPath && !!matchPath({ path: itemPath, end: false }, pathname)) ||
    (item.id === 'util-requests-sent' && pathname.startsWith('/request-ive-sent')) ||
    (Array.isArray(item.alsoHighlightWhenAt) && item.alsoHighlightWhenAt.includes(pathname));
  const selectedNavTextColor = SELECTED_BUTTON_TEMPLATE_TEXT;
  const unselectedNavTextColor = UNSELECTED_BUTTON_TEMPLATE_TEXT;

  const [hoverStatus, setHover] = useState(false);

  const setLabelRef = (node) => {
    overflowProbeRef.current = node;
    fitLabelRef.current = node;
  };

  const compareSize = () => {
    const el = overflowProbeRef.current;
    const compare = Boolean(el && el.scrollWidth > el.clientWidth);
    setHover(compare);
  };

  useEffect(() => {
    compareSize();
    window.addEventListener('resize', compareSize);
    return () => window.removeEventListener('resize', compareSize);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(compareSize);
    return () => window.cancelAnimationFrame(id);
  }, [drawerOpen, item?.title]);
  useEffect(() => {
    if (!isReceivedBioRequestsItem && !isVettedFriendsItem && !isSelfReportBioItem) return undefined;
    const onRefresh = (event) => {
      const scope = event?.detail?.scope;
      if (scope === 'bio' || scope === 'all') {
        if (isReceivedBioRequestsItem) {
          void refetchPendingCount();
          void refetchBioRequestNotifications();
        }
        if (isVettedFriendsItem) void refetchBioResponsePendingCount();
        if (isSelfReportBioItem) void refetchCompletedPercent();
      }
    };
    window.addEventListener(BELL_NOTIFICATION_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(BELL_NOTIFICATION_REFRESH_EVENT, onRefresh);
  }, [
    isReceivedBioRequestsItem,
    isVettedFriendsItem,
    isSelfReportBioItem,
    refetchPendingCount,
    refetchBioRequestNotifications,
    refetchBioResponsePendingCount,
    refetchCompletedPercent
  ]);

  useEffect(() => {
    if (isReceivedBioRequestsItem) {
      void refetchPendingCount();
      void refetchBioRequestNotifications();
    }
    if (isVettedFriendsItem) void refetchBioResponsePendingCount();
    if (isSelfReportBioItem) void refetchCompletedPercent();
  }, [
    isReceivedBioRequestsItem,
    isVettedFriendsItem,
    isSelfReportBioItem,
    pathname,
    refetchPendingCount,
    refetchBioRequestNotifications,
    refetchBioResponsePendingCount,
    refetchCompletedPercent
  ]);

  const receivedBioPendingTooltipTitle = formatReceivedBioPendingBadgeTooltip(
    pendingCount,
    bioRequestNotifications
  );

  const navChip =
    isReceivedBioRequestsItem && pendingCount > 0
      ? {
          label: String(pendingCount),
          color: 'error',
          size: 'small',
          variant: 'filled'
        }
      : isVettedFriendsItem && responsePendingCount > 0
        ? {
            label: String(responsePendingCount),
            color: 'error',
            size: 'small',
            variant: 'filled'
          }
        : item.chip;

  const navPendingCountChip = isReceivedBioRequestsItem || isVettedFriendsItem;
  const pendingBadgeTooltipTitle =
    isReceivedBioRequestsItem && pendingCount > 0 ? receivedBioPendingTooltipTitle : '';

  function renderNavPendingChip() {
    if (!navChip) return null;
    const chip = (
      <Chip
        color={navChip.color}
        variant={navChip.variant}
        size={navChip.size}
        label={navChip.label}
        sx={
          navPendingCountChip
            ? receivedBioPendingBadgeChipSx()
            : {
                flexShrink: 0,
                minWidth: 24,
                height: 24,
                '& .MuiChip-label': { px: 0.75, fontWeight: 700 }
              }
        }
        avatar={
          <Activity mode={navChip.avatar ? 'visible' : 'hidden'}>
            <Avatar>{navChip.avatar}</Avatar>
          </Activity>
        }
      />
    );
    if (pendingBadgeTooltipTitle) {
      return (
        <Tooltip
          title={pendingBadgeTooltipTitle}
          arrow
          placement="right"
          slotProps={receivedBioPendingBadgeTooltipSlotProps()}
        >
          <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
            {chip}
          </Box>
        </Tooltip>
      );
    }
    return chip;
  }

  const Icon = item?.icon;
  const itemIcon = item?.iconSrc ? (
    <ColorTemplate10Menu.Icon src={item.iconSrc} alt="" size={getSidebarMenuImgIconSize(drawerOpen)} />
  ) : item?.icon ? (
    <Icon
      stroke={1.5}
      size={getSidebarMenuTablerIconSize(drawerOpen)}
      style={{ ...(isParents && { fontSize: getSidebarMenuTablerIconSize(drawerOpen), stroke: '1.5' }) }}
    />
  ) : (
    <FiberManualRecordIcon sx={{ width: isSelected ? 8 : 6, height: isSelected ? 8 : 6 }} fontSize={level > 0 ? 'inherit' : 'medium'} />
  );

  let itemTarget = '_self';
  if (item.target) {
    itemTarget = '_blank';
  }

  const itemHandler = () => {
    if (item.disabled) return;
    if (isParents && setSelectedID) {
      setSelectedID();
    }
    if (item.url || item.link) {
      closeSidebarAfterNavSelectIfMobile();
    }
  };

  const handleNavContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  /** Stacking for 2× scale: above sibling rows, main column, and app bar (nav column uses theme.zIndex.modal). */
  const scaledMenuZ = theme.zIndex.tooltip;

  const showSelfReportCompletedBadge =
    isSelfReportBioItem && drawerOpen && completedPercent !== null && Number.isFinite(completedPercent);

  const level1MenuSx = {
    zIndex: 1201,
    position: 'relative',
    overflow: 'visible',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    ...(showSelfReportCompletedBadge
      ? {
          [`& .${SELF_REPORT_BIO_COMPLETED_BADGE_CLASS}`]: selfReportBioCompletedBadgeSx()
        }
      : null),
    ...(item.disabled && {
      opacity: 0.42,
      pointerEvents: 'none',
      cursor: 'not-allowed',
      filter: 'grayscale(0.35)',
      boxShadow: 'none !important',
      transform: 'none !important'
    }),
    ...(downSM && drawerOpen && { py: 0.25, minHeight: 'auto' }),
    '&:active': {
      transform: `scale(${getHoverMagnifyFactor()}) !important`,
      zIndex: scaledMenuZ,
      isolation: 'isolate'
    },
    ...(tourHighlightNav && {
      bgcolor: '#000 !important',
      color: '#fff !important',
      border: '3px solid #000 !important',
      boxShadow: '0 0 0 4px #ffeb3b !important',
      transform: 'scale(1.05) !important',
      zIndex: scaledMenuZ,
      '& .MuiListItemIcon-root': { color: '#fff !important' },
      '& .MuiTypography-root': { color: '#fff !important' }
    }),
    ...(suppressPressHoldZoom && {
      transform: 'scale(1) !important',
      '@media (hover: hover)': {
        '&:hover': { transform: 'scale(1) !important' }
      },
      '&:active': { transform: 'scale(1) !important' },
      '&:focus-visible': { transform: 'scale(1) !important' }
    })
  };

  const menuLabel = (
    <Typography
      ref={setLabelRef}
      noWrap
      variant={isSelected ? 'h5' : 'body1'}
      sx={{
        fontSize: sidebarMenuFontSize,
        overflow: 'hidden',
        textOverflow: 'clip',
        maxWidth: '100%',
        flex: drawerOpen ? '1 1 auto' : undefined,
        minWidth: 0,
        color: level === 1 ? 'inherit' : isSelected ? selectedNavTextColor : unselectedNavTextColor,
        WebkitTextFillColor: level === 1 ? 'inherit' : isSelected ? selectedNavTextColor : unselectedNavTextColor,
        fontWeight: item.customStyle?.fontWeight ?? (isSelected ? 700 : 600),
        ...(level !== 1 && !isSelected && item.customStyle ? item.customStyle : null)
      }}
    >
      {item.title}
    </Typography>
  );

  if (level === 1) {
    return (
      <ColorTemplate10Menu.Item
        selected={isSelected || tourHighlightNav}
        drawerOpen={drawerOpen}
        level={level}
        downSM={downSM}
        hoverZIndex={scaledMenuZ}
        component={item.disabled ? 'div' : Link}
        to={item.disabled ? undefined : item.url}
        target={itemTarget}
        disabled={item.disabled}
        disableRipple={!drawerOpen}
        onContextMenu={handleNavContextMenu}
        data-vsingles-tour-nav={item?.id ? item.id : undefined}
        {...pressHoldPointerProps}
        onClick={() => itemHandler()}
        sx={level1MenuSx}
      >
        <Box sx={ColorTemplate10Menu.itemInnerSx(drawerOpen)}>
          <Box
            sx={{
              ...colorTemplate10MenuIconSlotSx(drawerOpen, { level, downSM }),
              display: 'inline-flex',
              flexShrink: 0,
              ...(!drawerOpen ? { borderRadius: `${borderRadius}px` } : null)
            }}
          >
            {itemIcon}
          </Box>
          {(drawerOpen || level !== 1) && (
            <Tooltip title={item.title} disableHoverListener={!hoverStatus}>
              <Box sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>{menuLabel}</Box>
            </Tooltip>
          )}
          <Activity mode={drawerOpen && navChip ? 'visible' : 'hidden'}>{renderNavPendingChip()}</Activity>
        </Box>
        {showSelfReportCompletedBadge ? (
          <Box component="span" className={SELF_REPORT_BIO_COMPLETED_BADGE_CLASS} aria-hidden>
            {completedPercent}% completed
          </Box>
        ) : null}
      </ColorTemplate10Menu.Item>
    );
  }

  return (
    <>
      <ListItemButton
        component={item.disabled ? 'div' : Link}
        to={item.disabled ? undefined : item.url}
        target={itemTarget}
        disabled={item.disabled}
        disableRipple={!drawerOpen}
        onContextMenu={handleNavContextMenu}
        data-vsingles-tour-nav={item?.id ? item.id : undefined}
        sx={{
          zIndex: 1201,
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          borderRadius: `${borderRadius}px`,
          mb: 0.5,
          ...(item.disabled && {
            opacity: 0.42,
            pointerEvents: 'none',
            cursor: 'not-allowed',
            filter: 'grayscale(0.35)',
            boxShadow: 'none !important',
            transform: 'none !important'
          }),
          ...(drawerOpen && level !== 1 && { ml: downSM ? `${level * 8}px` : `${level * 18}px` }),
          ...(!drawerOpen && { pl: 1.25 }),
          ...(downSM && drawerOpen && { py: 0.25, minHeight: 'auto' }),
          ...(level !== 1 && {
            py: 1,
            '&:hover': { bgcolor: 'transparent' },
            '&.Mui-selected': {
              '&:hover': { bgcolor: 'transparent' },
              bgcolor: 'transparent'
            }
          }),
        }}
        selected={isSelected || tourHighlightNav}
        onClick={() => itemHandler()}
      >
        <ButtonBase aria-label="theme-icon" sx={{ borderRadius: `${borderRadius}px` }} disableRipple={drawerOpen}>
          <ListItemIcon
            sx={{
              color: isSelected ? selectedNavTextColor : unselectedNavTextColor,
              ...colorTemplate10MenuIconSlotSx(drawerOpen, { level, downSM }),
              ...(!drawerOpen ? { borderRadius: `${borderRadius}px` } : null)
            }}
          >
            {itemIcon}
          </ListItemIcon>
        </ButtonBase>

        <Tooltip title={item.title} disableHoverListener={!hoverStatus}>
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
              primary={menuLabel}
              secondary={
                item.caption && (
                  <Typography
                    variant="caption"
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
                    {item.caption}
                  </Typography>
                )
              }
            />
          </Tooltip>

        <Activity mode={drawerOpen && navChip ? 'visible' : 'hidden'}>{renderNavPendingChip()}</Activity>
      </ListItemButton>
    </>
  );
}

NavItem.propTypes = { item: PropTypes.any, level: PropTypes.number, isParents: PropTypes.bool, setSelectedID: PropTypes.func };
