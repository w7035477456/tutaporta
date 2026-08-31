import { Activity, memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { exitToMallUnselectedButtonHoverSx } from 'config/selectedUnselectedButtonTemplate';

import { exitMenuIcon } from 'config/menuIcons';

// project imports
import NavItem from './NavItem';
import NavGroup from './NavGroup';
import menuItems, { toolsMenuItem } from 'menu-items';
import dashboard from 'menu-items/dashboard';

import { closeSidebarAfterNavSelectIfMobile, useGetMenuMaster } from 'api/menu';
import { flushRecordVaultSessionsOnLeave } from 'api/recordVaultFe';
import { navigationDrawerOpenState } from 'config/navigationCollapseEnv';
import { useAuth } from 'contexts/AuthContext';
import { applyProfilePhotoMenuDisabled, needsProfilePhotoSetup } from 'utils/profilePhotoSetup';
import { needsMyStoryFirstLoginSetup } from 'utils/firstLoginOnboarding';
import { fetchVetBioVerificationServices } from 'api/vetBioVerificationServicesFe';
import {
  applyIdentificationVerificationMenuDisabled,
  clearSignupIdentificationVerificationRequired,
  isIdentificationVerificationLockActive,
  SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT
} from 'utils/signupIdentificationVerification';
import { isToolsMenuVisible, isToolsOnlyMenuSession } from 'utils/toolsNavSession';
import ColorTemplate4TitlesPhrase from 'ui-component/ColorTemplate4TitlesPhrase';
import { colorTemplate10MenuWidthSx } from 'config/colorTemplate10Menu';
import {
  getSidebarCollapsedControlSizePx,
  getSidebarExitMenuIconPx,
  getSidebarMenuFontSizeResponsive,
  SIDEBAR_MENU_COLLAPSED_GUTTER_PX
} from 'config/menuNavFontEnv';

// ==============================|| SIDEBAR MENU LIST ||============================== //

const sidebarMenuFontSize = getSidebarMenuFontSizeResponsive();

const datingSocialPhrases = [
  'Share your daily stories on a lively social feed and connect confidently with safely vetted singles!',
  'Meet trusted, verified members and let romance blossom with private chats, photo sharing, and real flower surprises.',
  'Dating meets social media! Post your favorite moments, chat, and flirt on a platform built for genuine connection.',
  'Your safe haven for love: browse securely vetted profiles, share photos, and flirt effortlessly with cozy chats.',
  'Enjoy a vibrant social media feed where you can share your world, chat with wonderful people, and send real flowers right to their heart!',
  'Post your moments, browse verified singles, and flirt with fun chats, photos, and sweet flower gifts!',
  'Welcome to a secure dating community! Enjoy interactive social postings and peace of mind with trusted, 3rd-party vetting.',
  'The ultimate playground for romance! Bring your dating life to life with beautiful photo sharing, lively chats, and real flower deliveries.',
  'A friendly social space where you can securely meet trusted singles and share your world through interactive posts.',
  'From a fun social media feed and trusted 3rd-party safety vetting to playful chatting and flower gifting - we have built the perfect home for love.'
];

const underConstructionMenuItems = {
  items: [
    {
      id: 'under-construction',
      title: 'Under Construction',
      type: 'group',
      children: [
        { id: 'uc-2', title: 'Under Construction', type: 'item', url: '/eMarketPlace' },
        { id: 'uc-3', title: 'Under Construction', type: 'item', url: '/onlineProfessionals' },
        { id: 'uc-5', title: 'Under Construction', type: 'item', url: '/eServices' }
      ]
    }
  ]
};

const eMarketPlaceMenuItems = {
  items: [
    {
      id: 'e-marketplace-flower-shop',
      title: 'Flower Shop',
      type: 'group',
      children: [{ id: 'flower-shop-nav', title: 'Flower Shop', type: 'item', url: '/eMarketPlace/flowerShop' }]
    }
  ]
};

const eClassifiedsMenuItems = {
  items: [
    {
      id: 'e-classifieds-bpm',
      title: 'eClassifieds',
      type: 'group',
      children: [
        { id: 'ec-bpm-demo', title: 'BPM Demo', type: 'item', url: '/eClassifieds/bpm-demo' },
        {
          id: 'ec-my-listings',
          title: 'My Listings',
          titleSuffix: '(role=seller)',
          type: 'item',
          url: '/eClassifieds/my-listings'
        },
        {
          id: 'ec-pending',
          title: 'Pending Approvals',
          titleSuffix: '(role=manager)',
          type: 'item',
          url: '/eClassifieds/pending'
        },
        {
          id: 'ec-history',
          title: 'Process History',
          titleSuffix: '(Role=auditor)',
          type: 'item',
          url: '/eClassifieds/history'
        }
      ]
    }
  ]
};

function filterToolsMenuItem(menuConfig, showToolsMenu) {
  if (showToolsMenu || !menuConfig?.items) return menuConfig;
  return {
    ...menuConfig,
    items: menuConfig.items.map((group) => ({
      ...group,
      children: (group.children ?? []).filter((item) => item?.id !== 'util-tools')
    }))
  };
}

const allSinglesMenuItem = dashboard.children?.find((item) => item?.id === 'allSingles');

const toolsOnlyMenuItems = {
  items: [
    {
      id: 'menu-group-tools-only',
      type: 'group',
      title: '',
      children: [allSinglesMenuItem, toolsMenuItem].filter(Boolean)
    }
  ]
};

function MenuList() {
  const { menuMaster } = useGetMenuMaster();
  const { user } = useAuth();
  const navigate = useNavigate();
  const drawerOpen = navigationDrawerOpenState(menuMaster?.isDashboardDrawerOpened);
  const { pathname } = useLocation();
  const profilePhotoSetupRequired = needsProfilePhotoSetup(user);
  const myStoryFirstLoginSetupRequired = needsMyStoryFirstLoginSetup(user);
  const [identificationVerificationLockTick, setIdentificationVerificationLockTick] = useState(0);
  const [exitToMallBusy, setExitToMallBusy] = useState(false);
  const identificationVerificationLockActive = isIdentificationVerificationLockActive(user);
  const profileImageFk = user?.profile_image_fk ?? null;
  const showToolsMenu = isToolsMenuVisible({
    hasUser: Boolean(user),
    pathname,
    user
  });
  const toolsOnlyMenu = isToolsOnlyMenuSession({
    hasUser: Boolean(user),
    pathname,
    user
  });

  useEffect(() => {
    const onLockChanged = () => setIdentificationVerificationLockTick((tick) => tick + 1);
    window.addEventListener(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT, onLockChanged);
    return () => window.removeEventListener(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT, onLockChanged);
  }, []);

  useEffect(() => {
    if (!user || !isIdentificationVerificationLockActive(user)) return;
    let cancelled = false;
    void fetchVetBioVerificationServices()
      .then((data) => {
        if (cancelled) return;
        const idService = (data?.services || []).find((service) => service.key === 'id');
        if (idService?.status === 'completed') {
          clearSignupIdentificationVerificationRequired();
        }
      })
      .catch(() => {
        /* menu unlock sync is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [user, identificationVerificationLockTick]);

  const isEMarketPlaceSection = pathname.startsWith('/eMarketPlace/');
  const isEClassifiedsSection = pathname === '/eClassifieds' || pathname.startsWith('/eClassifieds/');

  const isUnderConstructionMallSection =
    pathname === '/eMarketPlace' || pathname === '/onlineProfessionals' || pathname === '/eServices';

  const activeMenuItems = useMemo(() => {
    if (toolsOnlyMenu) {
      return toolsOnlyMenuItems;
    }
    const base = isEClassifiedsSection
      ? eClassifiedsMenuItems
      : isEMarketPlaceSection
        ? eMarketPlaceMenuItems
        : isUnderConstructionMallSection
          ? underConstructionMenuItems
          : menuItems;
    const withTools = filterToolsMenuItem(base, showToolsMenu);
    const withProfilePhoto = applyProfilePhotoMenuDisabled(withTools, myStoryFirstLoginSetupRequired);
    return applyIdentificationVerificationMenuDisabled(withProfilePhoto, identificationVerificationLockActive);
  }, [
    isEClassifiedsSection,
    isEMarketPlaceSection,
    isUnderConstructionMallSection,
    profilePhotoSetupRequired,
    myStoryFirstLoginSetupRequired,
    identificationVerificationLockActive,
    identificationVerificationLockTick,
    profileImageFk,
    showToolsMenu,
    toolsOnlyMenu
  ]);

  const showExitToMall = !toolsOnlyMenu;

  const [selectedID, setSelectedID] = useState('');
  const datingSocialPhrase = useMemo(
    () => datingSocialPhrases[Math.floor(Math.random() * datingSocialPhrases.length)],
    []
  );

  const lastItem = null;

  let lastItemIndex = activeMenuItems.items.length - 1;
  let remItems = [];
  let lastItemId;

  if (lastItem && lastItem < activeMenuItems.items.length) {
    lastItemId = activeMenuItems.items[lastItem - 1].id;
    lastItemIndex = lastItem - 1;
    remItems = activeMenuItems.items.slice(lastItem - 1, activeMenuItems.items.length).map((item) => ({
      title: item.title,
      elements: item.children,
      icon: item.icon,
      ...(item.url && {
        url: item.url
      })
    }));
  }

  const navItems = activeMenuItems.items.slice(0, lastItemIndex + 1).map((item, index) => {
    switch (item.type) {
      case 'group':
        if (item.url && item.id !== lastItemId) {
          return (
            <List key={item.id} sx={{ overflow: 'visible', position: 'relative' }}>
              <NavItem item={item} level={1} isParents setSelectedID={() => setSelectedID('')} />
              <Activity mode={index !== 0 ? 'visible' : 'hidden'}>
                <Divider sx={{ py: 0.5 }} />
              </Activity>
            </List>
          );
        }

        return (
          <NavGroup
            key={`${item.id}-${profilePhotoSetupRequired ? 'setup' : `ready-${profileImageFk ?? 'none'}`}`}
            setSelectedID={setSelectedID}
            selectedID={selectedID}
            item={item}
            lastItem={lastItem}
            remItems={remItems}
            lastItemId={lastItemId}
          />
        );
      default:
        return (
          <Typography key={item.id} variant="h6" align="center" sx={{ color: 'error.main' }}>
            Menu Items Error
          </Typography>
        );
    }
  });

  const handleExitToMall = useCallback(async () => {
    if (identificationVerificationLockActive || exitToMallBusy) return;
    setExitToMallBusy(true);
    try {
      await flushRecordVaultSessionsOnLeave();
      const { flushPhotoAlbumsSessionsOnLeave } = await import('api/photoAlbumsFe');
      await flushPhotoAlbumsSessionsOnLeave();
      closeSidebarAfterNavSelectIfMobile();
      navigate('/mall');
    } catch (err) {
      console.error(err);
    } finally {
      setExitToMallBusy(false);
    }
  }, [exitToMallBusy, identificationVerificationLockActive, navigate]);

  const exitToMallControl = showExitToMall && (
    <Box
      sx={{
        px: 0,
        pt: 0.5,
        pb: 0.25,
        display: 'flex',
        justifyContent: 'center',
        width: '100%'
      }}
    >
      {drawerOpen ? (
        <UnSelectedButtonTemplate
          type="button"
          data-ui-test-target="exit-to-mall"
          disableElevation
          disableRipple
          disabled={identificationVerificationLockActive || exitToMallBusy}
          startIcon={<UnSelectedButtonTemplate.Icon src={exitMenuIcon} alt="" />}
          onClick={() => void handleExitToMall()}
          sx={{
            ...colorTemplate10MenuWidthSx(),
            display: 'flex',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            fontSize: sidebarMenuFontSize,
            py: 1.2,
            lineHeight: 1.2,
            '& .MuiButton-startIcon': { color: 'inherit' },
            ...exitToMallUnselectedButtonHoverSx()
          }}
        >
          Exit to Mall
        </UnSelectedButtonTemplate>
      ) : (
        <Tooltip title="Exit to Mall" placement="right">
          <UnSelectedButtonTemplate
            type="button"
            data-ui-test-target="exit-to-mall"
            disableElevation
            disableRipple
            disabled={identificationVerificationLockActive || exitToMallBusy}
            aria-label="Exit to Mall"
            onClick={() => void handleExitToMall()}
            sx={{
              minWidth: getSidebarCollapsedControlSizePx(),
              width: getSidebarCollapsedControlSizePx(),
              height: getSidebarCollapsedControlSizePx(),
              p: 0.5,
              WebkitTapHighlightColor: 'transparent',
              ...exitToMallUnselectedButtonHoverSx({ transformOrigin: 'center center' })
            }}
          >
            <UnSelectedButtonTemplate.Icon src={exitMenuIcon} alt="" size={getSidebarExitMenuIconPx(false)} />
          </UnSelectedButtonTemplate>
        </Tooltip>
      )}
    </Box>
  );

  const datingSocialPhraseBlock = drawerOpen ? (
    <Box sx={{ mx: '0.5rem', minWidth: 0, flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      <ColorTemplate4TitlesPhrase>{datingSocialPhrase}</ColorTemplate4TitlesPhrase>
    </Box>
  ) : null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        ...(drawerOpen && { mt: 1.5 })
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          flexGrow: 0,
          overflow: 'visible',
          mx: drawerOpen ? 0 : `${SIDEBAR_MENU_COLLAPSED_GUTTER_PX}px`,
          px: drawerOpen ? 0 : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5
        }}
      >
        {navItems}
        {exitToMallControl}
      </Box>
      {datingSocialPhraseBlock}
    </Box>
  );
}

export default memo(MenuList);
