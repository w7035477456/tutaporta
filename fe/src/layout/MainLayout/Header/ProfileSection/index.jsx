import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// material-ui
import { useTheme, keyframes } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import Transitions from 'ui-component/extended/Transitions';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import { colorTemplate10MenuItemButtonSx } from 'config/colorTemplate10Menu';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import useConfig from 'hooks/useConfig';
import { useAuth } from 'contexts/AuthContext';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { flushRecordVaultSessionsOnLeave } from 'api/recordVaultFe';
import { saveSinglesPreferences, useSinglesPreferences } from 'api/singlesPreferencesFe';
import {
  AI_VOICE_OPTIONS,
  applyThemeByName,
  DEFAULT_NEW_USER_THEME_NAME,
  findThemeByName,
  getAiVoice,
  getColorFullPalete,
  getLightThemeCounterpart,
  getThemeOptionsFromEnv,
  isDarkThemeName,
  isFlowerShopPath,
  persistThemeChoice,
  readStoredThemeChoice,
  resolveThemePreferenceName,
  setAiVoice,
  setColorFullPalete
} from 'utils/themeConfig';
import { beginFlowerShopLightThemeOverride, isFlowerShopThemeOverrideActive } from 'utils/flowerShopThemeOverride';
import { exitMenuIcon, profileRecordsIcon } from 'config/menuIcons';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { HEADER_PROFILE_AVATAR_SIZE, headerProfileChipHeightCss } from 'config/headerProfileChipEnv';
import { SIDEBAR_MENU_ICON_CLASS, exitToMallYellowDashedBorderSx } from 'config/selectedUnselectedButtonTemplate';
import { pickRandomProfileMenuGreetingLines } from 'utils/profileMenuGreeting';
import { requestOpenVaultProfilesRecords } from 'utils/vaultProfilesRecordsGate';
import {
  TOUR_STEP_THEME,
  VSINGLES_TOUR_END_EVENT,
  VSINGLES_TOUR_START_EVENT,
  VSINGLES_TOUR_STEP_EVENT,
  isVsinglesTourRoute
} from 'utils/vsinglesTour';
import { saveUserCustomization } from 'api/userCustomizationFe';
import { fetchBuildLabel } from 'config/buildInfoEnv';
import { siteFooterTextFontSize } from 'config/footerFontEnv';
import {
  ENV_MAIN_FONT_FAMILY,
  MAIN_FONT_FAMILY,
  MAIN_FONT_OPTIONS,
  RECOMMENDED_MAIN_FONT_STACK,
  ensureMainFontStylesheet,
  findMainFontOptionByStack
} from 'config/mainFontEnv';
import { formatLastFirstMiddleName } from 'utils/fullNameFormat';
import api from 'api/axios';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';

const PROFILE_MENU_PANEL_WIDTH_RATIO = 0.35;
const PROFILE_MENU_PANEL_MIN_PX = 280;

/** Pixel width from viewport — 50% of window, grows/shrinks on resize. */
function profileMenuPanelWidthPx(viewportWidth) {
  const vw = Number(viewportWidth) || 0;
  return Math.max(PROFILE_MENU_PANEL_MIN_PX, vw * PROFILE_MENU_PANEL_WIDTH_RATIO);
}

const PROFILE_MENU_PANEL_FILL_SX = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box'
};

const PROFILE_MENU_THEME_SECTION_SX = {
  ...PROFILE_MENU_PANEL_FILL_SX,
  px: 1
};

function getDarkThemeCounterpart(lightName, options) {
  const family = String(lightName)
    .replace(/\s*light\s*$/i, '')
    .trim();
  if (!family) return null;
  for (const candidate of [`${family} Dark`, `${family} dark`]) {
    const match = findThemeByName(candidate, options);
    if (match) return match.name;
  }
  const familyLower = family.toLowerCase();
  const fallback = options.find(
    (theme) => isDarkThemeName(theme.name) && theme.name.toLowerCase().startsWith(familyLower)
  );
  return fallback?.name ?? null;
}

// assets
import { IconSettings } from '@tabler/icons-react';

const PROFILE_MENU_EXIT_ICON_PX = 40;

const profileMenuButtonLayoutSx = {
  width: '100%',
  justifyContent: 'flex-start',
  textAlign: 'left',
  mb: 0.5,
  transformOrigin: 'left center',
  overflow: 'visible',
  whiteSpace: 'nowrap',
  WebkitTapHighlightColor: 'transparent',
  '& .MuiButton-startIcon': { marginRight: 1.5, marginLeft: 0, flexShrink: 0 },
  '& .MuiButton-label': { whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }
};

/**
 * Theme picker — equal half-width columns; labels shrink via shrinkLabelToFit (cqw).
 * Keep overflow hidden so long names never paint outside the pill.
 */
const profileThemeButtonLayoutSx = {
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  justifyContent: 'center',
  textAlign: 'center',
  mb: 0.5,
  transformOrigin: 'center center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'clip',
  py: { xs: 0.875, sm: 1 },
  px: { xs: 0.5, sm: 0.75 }
};

/** Shared 25% label hover magnify — Exit / Profile & Records rows and theme picker buttons. */
const profileMenuButtonHoverMagnifySx = {
  ...buttonHoverMagnifyTransitionSx,
  '@media (hover: hover)': {
    '&:hover': buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeResponsive })
  }
};

function profileMenuButtonSx(selected, layoutSx = {}, hoverFontBase = buttonFontSizeResponsive) {
  const base = colorTemplate10MenuItemButtonSx({ selected, hoverScale: 1 });
  const magnifyHover = buttonHoverMagnifyFontSx({ baseFontSize: hoverFontBase });
  return {
    ...base,
    ...layoutSx,
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover': {
        ...(base['@media (hover: hover)']?.['&:hover'] ?? {}),
        ...magnifyHover
      }
    }
  };
}

function ProfileMenuExitIcon() {
  return (
    <Box
      component="img"
      src={exitMenuIcon}
      alt=""
      className={SIDEBAR_MENU_ICON_CLASS}
      sx={{
        width: PROFILE_MENU_EXIT_ICON_PX,
        height: PROFILE_MENU_EXIT_ICON_PX,
        objectFit: 'contain',
        display: 'block'
      }}
    />
  );
}

/** Same 2s loop as theme Customization FAB (AnimateButton rotate). */
const headerGearSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const HEADER_PROFILE_PHOTO_HOVER_SCALE = 1.2;
const headerProfileChipIconSizeSx = {
  width: HEADER_PROFILE_AVATAR_SIZE,
  height: HEADER_PROFILE_AVATAR_SIZE,
  minWidth: HEADER_PROFILE_AVATAR_SIZE
};

// ==============================|| PROFILE MENU ||============================== //

export default function ProfileSection({ clusterTight = false }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state: { borderRadius, fontFamily },
    setField
  } = useConfig();
  const { user, profilePhotoCacheBust, logout } = useAuth();
  const selectedMainFontStack = findMainFontOptionByStack(fontFamily || ENV_MAIN_FONT_FAMILY).stack;

  const avatarSrc =
    typeof window !== 'undefined' && user?.profile_image_fk
      ? `${getApiBaseUrl()}/api/photo/${user.profile_image_fk}?v=${profilePhotoCacheBust}`
      : undefined;

  const [open, setOpen] = useState(false);
  /** Font Select portals its menu — block profile ClickAway while it is open. */
  const [mainFontMenuOpen, setMainFontMenuOpen] = useState(false);
  /** Site-wide font swap can take several seconds (theme + Google Font load). */
  const [mainFontBusy, setMainFontBusy] = useState(false);
  const [menuPanelWidthPx, setMenuPanelWidthPx] = useState(() =>
    typeof window !== 'undefined' ? profileMenuPanelWidthPx(window.innerWidth) : PROFILE_MENU_PANEL_MIN_PX
  );
  const [profileGreetingLines, setProfileGreetingLines] = useState({ lead: '', nameLine: '' });
  const [profileMenuIdentity, setProfileMenuIdentity] = useState({ displayName: '', email: '' });
  const [tourActive, setTourActive] = useState(false);
  const [colorFullPalete, setColorFullPaleteState] = useState(() => getColorFullPalete());
  const [aiVoice, setAiVoiceState] = useState(() => getAiVoice());
  const themeOptions = useMemo(() => getThemeOptionsFromEnv(), [colorFullPalete]);
  const [selectedTheme, setSelectedTheme] = useState(
    () =>
      readStoredThemeChoice(themeOptions) ||
      findThemeByName(DEFAULT_NEW_USER_THEME_NAME, themeOptions)?.name ||
      DEFAULT_NEW_USER_THEME_NAME
  );
  const { preferences } = useSinglesPreferences();

  const closeProfileMenu = () => {
    if (tourActive) return;
    setMainFontMenuOpen(false);
    setOpen(false);
  };

  const pickAiVoice = (voice) => {
    if (tourActive) return;
    setAiVoiceState(setAiVoice(voice));
    closeProfileMenu();
  };

  const pickColorPaleteMode = (full) => {
    if (tourActive) return;
    const next = setColorFullPalete(full);
    setColorFullPaleteState(next);
    const options = getThemeOptionsFromEnv();
    const stillAvailable = findThemeByName(selectedTheme, options);
    if (!stillAvailable) {
      const fallback =
        findThemeByName(DEFAULT_NEW_USER_THEME_NAME, options)?.name ||
        options[0]?.name ||
        DEFAULT_NEW_USER_THEME_NAME;
      void pickTheme(fallback);
      return;
    }
    // Re-apply theme so yellow chrome (--theme-yellow-color) remaps for Minimal/Full.
    applyThemeByName(selectedTheme, options);
    closeProfileMenu();
  };

  useEffect(() => {
    if (!open) return undefined;

    const syncMenuPanelWidth = () => {
      setMenuPanelWidthPx(profileMenuPanelWidthPx(window.innerWidth));
    };

    syncMenuPanelWidth();
    window.addEventListener('resize', syncMenuPanelWidth);
    return () => window.removeEventListener('resize', syncMenuPanelWidth);
  }, [open]);

  const themeChoiceRows = useMemo(() => {
    const rows = [];
    for (const t of themeOptions) {
      const lightName = t.name;
      if (!/\bLight$/i.test(lightName)) continue;
      const darkName = getDarkThemeCounterpart(lightName, themeOptions);
      rows.push({ light: lightName, dark: darkName });
    }
    return rows;
  }, [themeOptions]);

  const pickTheme = async (value) => {
    if (tourActive) return;
    let next = value;
    if (isFlowerShopPath(location.pathname) && isDarkThemeName(next)) {
      next = getLightThemeCounterpart(next, themeOptions) || next;
    }
    setSelectedTheme(next);
    persistThemeChoice(next);
    applyThemeByName(next, themeOptions);
    closeProfileMenu();
    try {
      await saveSinglesPreferences({ theme: next.toLowerCase() });
    } catch (error) {
      console.error('Failed to save theme preference', error);
    }
  };

  /** Override fe/.env MAIN_FONT for this browser (persisted in vsingles-config). */
  const pickMainFont = (stack) => {
    if (tourActive || mainFontBusy) return;
    const option = findMainFontOptionByStack(stack);
    setMainFontMenuOpen(false);
    closeProfileMenu();
    setMainFontBusy(true);
    ensureMainFontStylesheet(option);
    // Paint hourglass first, then apply font (can block main thread for seconds).
    window.setTimeout(() => {
      try {
        setField('fontFamily', option.stack);
        void saveUserCustomization({ mainFont: option.stack }).catch((error) => {
          console.error('Failed to save main font preference', error);
        });
      } finally {
        const clearBusy = () => setMainFontBusy(false);
        const fontsReady =
          typeof document !== 'undefined' && document.fonts?.ready
            ? document.fonts.ready
            : Promise.resolve();
        void fontsReady
          .catch(() => {})
          .then(
            () =>
              new Promise((resolve) => {
                window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
              })
          )
          .then(clearBusy, clearBusy);
        // Safety: never leave the hourglass up forever.
        window.setTimeout(clearBusy, 8000);
      }
    }, 50);
  };

  /** Reset to Ocean light + recommended Algerian. */
  const resetThemeAndFont = () => {
    if (tourActive || mainFontBusy) return;
    closeProfileMenu();
    const oceanLight =
      findThemeByName('Ocean light', themeOptions)?.name ||
      findThemeByName('Ocean Light', themeOptions)?.name ||
      'Ocean light';
    void pickTheme(oceanLight);
    pickMainFont(RECOMMENDED_MAIN_FONT_STACK);
  };

  const renderThemePickButton = (themeName) => {
    const selected = selectedTheme === themeName;
    const Template = selected ? SelectedButtonTemplate : UnSelectedButtonTemplate;
    return (
      <Template
        key={themeName}
        type="button"
        fullWidth
        fitLabelWidth={false}
        /** Shrink label font to the column width (same family as GreenButton / UnSelected fit props). */
        shrinkLabelToFit
        hoverScale={1}
        selectedLabelScale={1}
        disableElevation
        disableRipple
        onClick={() => void pickTheme(themeName)}
        sx={profileThemeButtonLayoutSx}
      >
        {themeName}
      </Template>
    );
  };

  /**
   * anchorRef is used on different components and specifying one type leads to other components throwing an error
   * */
  const anchorRef = useRef(null);

  const handleToggle = () => {
    if (tourActive) return;
    setOpen((prevOpen) => {
      const nextOpen = !prevOpen;
      if (nextOpen && user) {
        setProfileGreetingLines(pickRandomProfileMenuGreetingLines(user));
      }
      return nextOpen;
    });
  };

  const handleClose = (event) => {
    if (tourActive) return;
    // Select menu is portaled; ClickAway would otherwise close this panel and unmount the Select.
    if (mainFontMenuOpen) return;
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    const target = event?.target;
    if (target instanceof Element && target.closest('.MuiMenu-root, .MuiModal-root, .MuiPopover-root, [role="listbox"]')) {
      return;
    }

    setOpen(false);
  };

  const handleExitOrLogout = async () => {
    try {
      closeProfileMenu();
      await flushRecordVaultSessionsOnLeave();
      const { flushPhotoAlbumsSessionsOnLeave } = await import('api/photoAlbumsFe');
      await flushPhotoAlbumsSessionsOnLeave();
      navigate('/mall');
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * On /myPhotoAlbums or /myNote: embed Profile & Records in the vault (no dating sidebar).
   * Elsewhere: navigate to /profilesRecords (same as the left menu).
   */
  const handleProfilesRecords = () => {
    closeProfileMenu();
    if (requestOpenVaultProfilesRecords()) return;
    navigate(PROFILES_RECORDS_PATH);
  };

  const exitLabel = 'Exit to Mall';
  const logoutLabelRest = 'gout OnlineMall.Website';
  const [buildLabel, setBuildLabel] = useState('');
  const [showBuildLabel, setShowBuildLabel] = useState(false);

  useEffect(() => {
    if (!open) {
      setMainFontMenuOpen(false);
      setMainFontBusy(false);
      setShowBuildLabel(false);
      return undefined;
    }

    let cancelled = false;
    fetchBuildLabel().then((label) => {
      if (!cancelled) setBuildLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleLogoutBuildInfoToggle = (event) => {
    event.stopPropagation();
    event.preventDefault();
    setShowBuildLabel((prev) => !prev);
  };

  const handleLogoutBottom = async () => {
    try {
      closeProfileMenu();
      // AuthContext.logout flushes Cloud/USB vault sessions first (hourglass + file detail).
      await logout();
      sessionStorage.setItem('logoutBlockBack', '1');
      window.location.replace('/pages/login');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!preferences) return;
    const resolvedName = resolveThemePreferenceName(preferences.theme, themeOptions);
    setSelectedTheme(resolvedName);
    persistThemeChoice(resolvedName);
  }, [preferences, themeOptions]);

  useEffect(() => {
    if (isFlowerShopPath(location.pathname)) {
      beginFlowerShopLightThemeOverride(selectedTheme, themeOptions);
      return;
    }
    if (isFlowerShopThemeOverrideActive()) return;
    applyThemeByName(selectedTheme, themeOptions);
  }, [selectedTheme, themeOptions, location.pathname]);


  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current.focus();
    }

    prevOpen.current = open;
  }, [open]);

  const profileMenuMemberKey = user
    ? [user.singles_id, user.prefix, user.member_id, user.alias ?? ''].join('|')
    : '';

  useEffect(() => {
    if (!open || !user) return;
    setProfileGreetingLines(pickRandomProfileMenuGreetingLines(user));
  }, [open, profileMenuMemberKey, user]);

  useEffect(() => {
    if (!open || !user) {
      setProfileMenuIdentity({ displayName: '', email: '' });
      return undefined;
    }
    let cancelled = false;
    const emailFallback = String(user.email || '').trim();
    setProfileMenuIdentity((prev) => ({
      displayName: prev.displayName,
      email: prev.email || emailFallback
    }));
    (async () => {
      try {
        const { data } = await api.get('/api/settings/profile');
        if (cancelled) return;
        const displayName = formatLastFirstMiddleName(
          data?.mailing_lastname || data?.lastname,
          data?.mailing_firstname || data?.firstname,
          data?.mailing_middlename
        );
        const email = String(data?.email || user.email || '').trim();
        setProfileMenuIdentity({ displayName, email });
      } catch {
        if (!cancelled) {
          setProfileMenuIdentity({ displayName: '', email: emailFallback });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, profileMenuMemberKey, user]);

  useEffect(() => {
    const applyTourStep = (tourStep) => {
      if (!isVsinglesTourRoute(location.pathname)) return;
      if (tourStep === TOUR_STEP_THEME) {
        setOpen(true);
        setTourActive(true);
      } else {
        setOpen(false);
        setTourActive(false);
      }
    };

    const onTourStart = (event) => {
      const step = event.detail?.step ?? TOUR_STEP_THEME;
      applyTourStep(step);
      if (step === TOUR_STEP_THEME) {
        window.setTimeout(() => applyTourStep(step), 120);
        window.setTimeout(() => applyTourStep(step), 400);
      }
    };
    const onTourStep = (event) => {
      applyTourStep(event.detail?.step);
    };
    const onTourEnd = () => {
      setTourActive(false);
      setOpen(false);
    };

    window.addEventListener(VSINGLES_TOUR_START_EVENT, onTourStart);
    window.addEventListener(VSINGLES_TOUR_STEP_EVENT, onTourStep);
    window.addEventListener(VSINGLES_TOUR_END_EVENT, onTourEnd);
    return () => {
      window.removeEventListener(VSINGLES_TOUR_START_EVENT, onTourStart);
      window.removeEventListener(VSINGLES_TOUR_STEP_EVENT, onTourStep);
      window.removeEventListener(VSINGLES_TOUR_END_EVENT, onTourEnd);
    };
  }, [location.pathname]);

  return (
    <>
      <BusyHourglassOverlay
        open={mainFontBusy}
        label="Applying main font"
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
        sx={{ zIndex: 1800 }}
      />
      <Chip
        data-guest-demo-allow="true"
        slotProps={{ label: { sx: { lineHeight: 0 } } }}
        sx={{
          ml: clusterTight ? 0 : 2,
          pointerEvents: tourActive ? 'none' : 'auto',
          height: headerProfileChipHeightCss(),
          alignItems: 'center',
          borderRadius: '999px',
          bgcolor: 'var(--theme-secondary-color)',
          border: '1px solid var(--theme-primary-color)',
          overflow: 'visible',
          position: 'relative',
          '& .MuiChip-icon': {
            overflow: 'hidden',
            flexShrink: 0,
            marginLeft: '8px !important',
            marginRight: '0 !important',
            position: 'relative',
            zIndex: 3,
            borderRadius: '50%',
            ...headerProfileChipIconSizeSx
          },
          '& .MuiChip-label': {
            overflow: 'visible',
            pl: '4px !important',
            pr: '8px !important',
            position: 'relative',
            zIndex: 2
          },
          // transition: 'var(--theme-primary-color) 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            bgcolor: 'var(--theme-primary-color)',
            borderColor: 'var(--theme-primary-color)',
            color: 'var(--theme-white-color)',
            '& svg': { color: 'var(--theme-white-color)' },
            [`& .${SIDEBAR_MENU_ICON_CLASS}`]: { filter: 'brightness(0) invert(1)' }
          }
        }}
        icon={
          <Avatar
            key={profilePhotoCacheBust}
            src={avatarSrc}
            alt="user-images"
            sx={{
              ...headerProfileChipIconSizeSx,
              margin: '4px 0 4px 0 !important',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 3,
              borderRadius: '50%',
              overflow: 'hidden',
              transition: 'transform 180ms ease',
              transformOrigin: 'center center',
              '@media (hover: hover)': {
                '&:hover': {
                  transform: `scale(${HEADER_PROFILE_PHOTO_HOVER_SCALE})`,
                  zIndex: theme.zIndex.tooltip
                }
              },
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
                '@media (hover: hover)': {
                  '&:hover': {
                    transform: 'none'
                  }
                }
              },
              ...(!avatarSrc
                ? {
                    bgcolor: 'grey.200',
                    '& .MuiAvatar-fallback': { display: 'none' }
                  }
                : null)
            }}
            ref={anchorRef}
            aria-controls={open ? 'menu-list-grow' : undefined}
            aria-haspopup="true"
            color="inherit"
          />
        }
        label={
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              lineHeight: 0,
              verticalAlign: 'middle',
              animation: `${headerGearSpin} 2s linear infinite`,
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none'
              }
            }}
          >
            <IconSettings
              stroke={open ? 2 : 1.5}
              color={open ? theme.palette.primary.main : 'var(--theme-primary-color)'}
              style={{
                width: HEADER_PROFILE_AVATAR_SIZE,
                height: HEADER_PROFILE_AVATAR_SIZE,
                ...(open ? { fill: theme.palette.primary.main } : { fill: 'none' })
              }}
            />
          </Box>
        }
        ref={anchorRef}
        aria-controls={open ? 'menu-list-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
        aria-label="user-account"
      />
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        sx={{
          zIndex: tourActive ? 1700 : 1400,
          width: `${menuPanelWidthPx}px`,
          maxWidth: '50vw',
          boxSizing: 'border-box'
        }}
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 14]
            }
          },
          {
            name: 'preventOverflow',
            options: {
              padding: 8,
              altAxis: true
            }
          }
        ]}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener
            onClickAway={handleClose}
            mouseEvent={mainFontMenuOpen ? false : 'onMouseDown'}
            touchEvent={mainFontMenuOpen ? false : 'onTouchEnd'}
          >
            <Box sx={PROFILE_MENU_PANEL_FILL_SX}>
              <Transitions in={open} {...TransitionProps} position="bottom-right" sx={PROFILE_MENU_PANEL_FILL_SX}>
              <Paper
                elevation={0}
                data-guest-demo-allow="true"
                data-vsingles-tour-profile-menu={tourActive ? '' : undefined}
                sx={{
                  bgcolor: 'var(--theme-secondary-color)',
                  backgroundImage: 'none',
                  boxShadow: 'none',
                  overflow: 'visible',
                  mb: 2,
                  border: '3px solid var(--theme-daynight-color)',
                  borderRadius: `${borderRadius}px`,
                  ...PROFILE_MENU_PANEL_FILL_SX,
                  pointerEvents: tourActive ? 'none' : 'auto',
                  ...(tourActive && {
                    boxShadow: '0 0 0 3px #000, 0 0 0 6px #ffeb3b'
                  })
                }}
              >
                {open && (
                  <Box>
                    <Box
                      sx={{
                        p: 2,
                        pb: 0,
                        color: 'var(--theme-primary-color)',
                        position: 'relative',
                        ...PROFILE_MENU_PANEL_FILL_SX
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                          mb: 1
                        }}
                      >
                        <PageVideoTutorialsButton pageKey="topRight" />
                      </Box>
                      <Typography
                        variant="h4"
                        component="div"
                        sx={{ color: 'var(--theme-primary-color)', lineHeight: 1.25 }}
                      >
                        {profileGreetingLines.lead ? (
                          <Box component="span" sx={{ display: 'block' }}>
                            {profileGreetingLines.lead}
                          </Box>
                        ) : null}
                        {profileGreetingLines.nameLine ? (
                          <Box
                            component="span"
                            sx={{ display: 'block', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            {profileGreetingLines.nameLine}
                          </Box>
                        ) : null}
                      </Typography>
                      {(profileMenuIdentity.displayName || profileMenuIdentity.email) ? (
                        <Box
                          sx={{
                            mt: 1,
                            mb: 0.5,
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 1.5,
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          {profileMenuIdentity.displayName ? (
                            <Typography
                              component="div"
                              sx={{
                                color: 'var(--theme-primary-color)',
                                fontWeight: 700,
                                fontSize: buttonFontSizeResponsive,
                                lineHeight: 1.25,
                                textAlign: 'left',
                                flex: '1 1 auto',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {profileMenuIdentity.displayName}
                            </Typography>
                          ) : (
                            <Box sx={{ flex: '1 1 auto', minWidth: 0 }} />
                          )}
                          {profileMenuIdentity.email ? (
                            <Typography
                              component="div"
                              sx={{
                                color: 'var(--theme-primary-color)',
                                fontWeight: 600,
                                fontSize: buttonFontSizeResponsive,
                                lineHeight: 1.25,
                                textAlign: 'right',
                                flex: '0 1 auto',
                                minWidth: 0,
                                maxWidth: '55%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {profileMenuIdentity.email}
                            </Typography>
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>
                    <Box
                      sx={{
                        ...PROFILE_MENU_PANEL_FILL_SX,
                        px: 2,
                        pt: 0,
                        pb: 1.5,
                        height: '100%',
                        maxHeight: 'calc(100dvh - 340px)',
                        overflowX: 'visible',
                        overflowY: 'auto',
                        color: 'var(--theme-primary-color)',
                        '& .MuiRadio-root': {
                          color: 'var(--theme-primary-color)',
                          '&.Mui-checked': { color: 'var(--theme-primary-color)' }
                        },
                        '&::-webkit-scrollbar': { width: 5 },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: 'var(--theme-primary-color)',
                          borderRadius: 4
                        }
                      }}
                    >
                      <Stack spacing={0.5} sx={{ ...PROFILE_MENU_PANEL_FILL_SX }}>
                        <Button
                          type="button"
                          fullWidth
                          disableElevation
                          disableRipple
                          startIcon={<ProfileMenuExitIcon />}
                          onClick={handleExitOrLogout}
                          sx={{
                            ...profileMenuButtonSx(false, profileMenuButtonLayoutSx),
                            ...exitToMallYellowDashedBorderSx(),
                            '@media (hover: hover)': {
                              '&:hover': {
                                ...exitToMallYellowDashedBorderSx()
                              }
                            }
                          }}
                        >
                          {exitLabel}
                        </Button>
                        <Button
                          type="button"
                          fullWidth
                          disableElevation
                          disableRipple
                          startIcon={
                            <Box
                              component="img"
                              src={profileRecordsIcon}
                              alt=""
                              className={SIDEBAR_MENU_ICON_CLASS}
                              sx={{ width: 40, height: 40, objectFit: 'contain' }}
                            />
                          }
                          onClick={handleProfilesRecords}
                          sx={profileMenuButtonSx(false, profileMenuButtonLayoutSx)}
                        >
                          Profile &amp; Records
                        </Button>
                      </Stack>
                      <Divider sx={{ my: 1.25, borderColor: 'currentColor', opacity: 0.35 }} />
                      <Box sx={{ ...PROFILE_MENU_THEME_SECTION_SX, mb: 1.5 }}>
                        <Typography
                          component="div"
                          sx={{
                            fontSize: '3rem',
                            lineHeight: 1,
                            color: 'var(--theme-primary-color)',
                            mb: 1.25
                          }}
                        >
                          Color Theme
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            columnGap: 1,
                            alignItems: 'stretch',
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          {[
                            { key: 'full', label: 'Full Paletes', full: true },
                            { key: 'minimal', label: 'Minimal Palete', full: false }
                          ].map(({ key, label, full }) => {
                            const selected = colorFullPalete === full;
                            const Template = selected ? SelectedButtonTemplate : UnSelectedButtonTemplate;
                            return (
                              <Template
                                key={key}
                                type="button"
                                fullWidth
                                fitLabelWidth={false}
                                shrinkLabelToFit
                                hoverScale={1}
                                selectedLabelScale={1}
                                disableElevation
                                disableRipple
                                disabled={tourActive}
                                aria-pressed={selected}
                                onClick={() => pickColorPaleteMode(full)}
                                sx={profileThemeButtonLayoutSx}
                              >
                                {label}
                              </Template>
                            );
                          })}
                        </Box>
                      </Box>
                      <Box sx={{ ...PROFILE_MENU_THEME_SECTION_SX, mb: 1.5 }}>
                        <Typography
                          component="div"
                          sx={{
                            fontSize: '3rem',
                            lineHeight: 1,
                            color: 'var(--theme-primary-color)',
                            mb: 1.25
                          }}
                        >
                          Tutorial Voice
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            columnGap: 1,
                            alignItems: 'stretch',
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          {AI_VOICE_OPTIONS.map((voice) => {
                            const selected = aiVoice === voice;
                            const Template = selected ? SelectedButtonTemplate : UnSelectedButtonTemplate;
                            return (
                              <Template
                                key={voice}
                                type="button"
                                fullWidth
                                fitLabelWidth={false}
                                shrinkLabelToFit
                                hoverScale={1}
                                selectedLabelScale={1}
                                disableElevation
                                disableRipple
                                disabled={tourActive}
                                aria-pressed={selected}
                                onClick={() => pickAiVoice(voice)}
                                sx={profileThemeButtonLayoutSx}
                              >
                                {voice}
                              </Template>
                            );
                          })}
                        </Box>
                      </Box>
                      <Box
                        sx={PROFILE_MENU_THEME_SECTION_SX}
                        data-vsingles-tour-theme={tourActive ? '' : undefined}
                        {...(tourActive && {
                          style: { outline: '3px solid #000', outlineOffset: 4, borderRadius: 8 }
                        })}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 1.5,
                            mb: 1.25,
                            width: '100%',
                            minWidth: 0
                          }}
                        >
                          <Typography
                            component="div"
                            sx={{ fontSize: '3rem', lineHeight: 1, color: 'var(--theme-primary-color)' }}
                          >
                            Theme
                          </Typography>
                          <Box
                            component="button"
                            type="button"
                            onClick={resetThemeAndFont}
                            disabled={tourActive || mainFontBusy}
                            sx={{
                              m: 0,
                              p: 0,
                              border: 0,
                              background: 'none',
                              cursor: tourActive || mainFontBusy ? 'default' : 'pointer',
                              fontFamily: MAIN_FONT_FAMILY,
                              fontWeight: 700,
                              fontSize: '1.05rem',
                              lineHeight: 1.2,
                              color: 'var(--theme-primary-color)',
                              textDecoration: 'underline',
                              textUnderlineOffset: 3,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              '&:disabled': { opacity: 0.55 }
                            }}
                          >
                            Reset (theme/font)
                          </Box>
                        </Box>
                        <Stack spacing={0.5} sx={{ width: '100%' }}>
                          {themeChoiceRows.map(({ light, dark }) => (
                            <Box
                              key={light}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: dark ? '1fr 1fr' : '1fr',
                                columnGap: 1,
                                alignItems: 'stretch',
                                width: '100%',
                                minWidth: 0
                              }}
                            >
                              {renderThemePickButton(light)}
                              {dark ? renderThemePickButton(dark) : null}
                            </Box>
                          ))}
                        </Stack>
                        <FormControl
                          fullWidth
                          size="small"
                          sx={{
                            mt: 2,
                            '& .MuiOutlinedInput-root': {
                              fontFamily: selectedMainFontStack,
                              color: 'var(--theme-daynight-color) !important',
                              WebkitTextFillColor: 'var(--theme-daynight-color) !important',
                              bgcolor: 'var(--theme-primary-color)',
                              '& fieldset': { borderColor: 'var(--theme-daynight-color)' },
                              '&:hover fieldset': { borderColor: 'var(--theme-daynight-color)' },
                              '&.Mui-focused fieldset': { borderColor: 'var(--theme-daynight-color)' },
                              '& .MuiSelect-select': {
                                color: 'var(--theme-daynight-color) !important',
                                WebkitTextFillColor: 'var(--theme-daynight-color) !important'
                              }
                            },
                            '& .MuiSelect-icon': {
                              color: 'var(--theme-daynight-color) !important'
                            }
                          }}
                        >
                          <Typography
                            component="label"
                            htmlFor="profile-main-font"
                            sx={{
                              display: 'block',
                              mb: 0.75,
                              fontFamily: MAIN_FONT_FAMILY,
                              fontWeight: 700,
                              fontSize: '1.05rem',
                              lineHeight: 1.25,
                              color: 'var(--theme-primary-color)'
                            }}
                          >
                            Main Font for website
                          </Typography>
                          <Select
                            id="profile-main-font"
                            displayEmpty
                            value={selectedMainFontStack}
                            open={mainFontMenuOpen}
                            onOpen={() => {
                              if (!mainFontBusy) setMainFontMenuOpen(true);
                            }}
                            onClose={() => setMainFontMenuOpen(false)}
                            onChange={(event) => pickMainFont(event.target.value)}
                            MenuProps={{
                              disableScrollLock: true,
                              // Profile Popper is z-index 1400 — menu modal must sit above it.
                              slotProps: {
                                root: { sx: { zIndex: 1600 } },
                                paper: {
                                  sx: {
                                    maxHeight: 'min(50vh, 360px)',
                                    bgcolor: 'var(--theme-primary-color)',
                                    border: '2px solid var(--theme-daynight-color)',
                                    '& .MuiMenuItem-root': {
                                      color: 'var(--theme-daynight-color)',
                                      fontSize: '2.25rem',
                                      lineHeight: 1.25,
                                      py: 1.25,
                                      minHeight: 'auto'
                                    },
                                    '& .MuiMenuItem-root.Mui-selected': {
                                      bgcolor: 'rgba(0,0,0,0.12)',
                                      color: 'var(--theme-daynight-color)'
                                    },
                                    '& .MuiMenuItem-root:hover': {
                                      bgcolor: 'rgba(0,0,0,0.18)',
                                      color: 'var(--theme-daynight-color)'
                                    },
                                    '& .MuiMenuItem-root[data-recommend="true"]': {
                                      color: 'var(--theme-yellow-color)',
                                      fontWeight: 800
                                    },
                                    '& .MuiMenuItem-root[data-recommend="true"].Mui-selected': {
                                      color: 'var(--theme-yellow-color)'
                                    },
                                    '& .MuiMenuItem-root[data-recommend="true"]:hover': {
                                      color: 'var(--theme-yellow-color)'
                                    }
                                  }
                                },
                                list: { sx: { py: 0.5 } }
                              }
                            }}
                          >
                            {MAIN_FONT_OPTIONS.map((option) => (
                              <MenuItem
                                key={option.id}
                                value={option.stack}
                                data-recommend={option.recommend ? 'true' : undefined}
                                sx={{
                                  fontFamily: option.stack,
                                  fontSize: '2.25rem'
                                }}
                              >
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>
                    <Divider sx={{ mx: 2, borderColor: 'currentColor', opacity: 0.35 }} />
                    <Stack spacing={0.5} sx={{ ...PROFILE_MENU_PANEL_FILL_SX, px: 2, pt: 1, pb: 2 }}>
                      <Button
                        type="button"
                        fullWidth
                        disableElevation
                        disableRipple
                        startIcon={<ProfileMenuExitIcon />}
                        onClick={handleLogoutBottom}
                        data-vsingles-tour-logout={tourActive ? '' : undefined}
                        sx={{
                          ...profileMenuButtonSx(false, profileMenuButtonLayoutSx),
                          ...(tourActive && {
                            outline: '3px solid #000',
                            outlineOffset: 2
                          })
                        }}
                      >
                        <Box component="span" sx={{ display: 'inline' }}>
                          L
                          <Box
                            component="span"
                            role="button"
                            tabIndex={0}
                            aria-label="Toggle build info"
                            onClick={handleLogoutBuildInfoToggle}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return;
                              handleLogoutBuildInfoToggle(event);
                            }}
                            sx={{ cursor: 'pointer' }}
                          >
                            o
                          </Box>
                          {logoutLabelRest}
                        </Box>
                      </Button>
                      {showBuildLabel && buildLabel ? (
                        <Typography
                          component="div"
                          title="Build time (ET), git commit, and fe+be source checksum (same on Mac/Ubuntu when commit matches)"
                          sx={{
                            mt: 0.75,
                            px: 0.5,
                            fontSize: siteFooterTextFontSize,
                            lineHeight: 1.3,
                            opacity: 0.75,
                            wordBreak: 'break-all',
                            textAlign: 'left'
                          }}
                        >
                          {buildLabel}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                )}
              </Paper>
              </Transitions>
            </Box>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
}
