import dashboard from './dashboard';
import pages from './pages';
import other from './other';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';
import { PRIMARY_COLOR_CSS } from 'utils/themeConfig';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { settingsIcon } from 'config/menuIcons';

// ==============================|| MENU ITEMS ||============================== //

/** Preserve single source of truth: pick menu rows by id from dashboard/pages. */
const pickChildren = (list, ids) => ids.map((id) => list.find((c) => c?.id === id)).filter(Boolean);

const dashboardKids = dashboard.children;
const pagesKids = pages.children;

/** Fallback if pages.js pick misses — keeps Tools in the sidebar. */
export const toolsMenuItem = {
  id: 'util-tools',
  title: 'Tools',
  type: 'item',
  url: ADMIN_TOOLS_PATH,
  iconSrc: settingsIcon,
  breadcrumbs: false,
  customStyle: {
    fontFamily: MAIN_FONT_FAMILY,
    color: PRIMARY_COLOR_CSS,
    fontWeight: 600
  }
};

/** Group 1: All Singles, My Picks, Outgoing Bio Requests */
const singlesOutgoingGroup = {
  id: 'menu-group-singles-outgoing',
  type: 'group',
  title: '',
  children: [
    ...pickChildren(dashboardKids, ['allSingles', 'myPicks']),
    ...pickChildren(pagesKids, ['util-requests-sent'])
  ]
};

/** Group 2: My photo album, My Self-Report-Bio, Received Bio Requests */
const albumBioRequestsGroup = {
  id: 'menu-group-album-bio-requests',
  type: 'group',
  title: '',
  children: [
    ...pickChildren(dashboardKids, ['myStory']),
    ...pickChildren(pagesKids, ['util-self-report-biography', 'util-received-bio-requests'])
  ]
};

/** Group 3: Settings */
const chatSettingsGroup = {
  id: 'menu-group-chat-settings',
  type: 'group',
  title: '',
  children: [
    ...pickChildren(pagesKids, ['util-profiles-records']),
    pagesKids.find((c) => c?.id === 'util-tools') ?? toolsMenuItem
  ]
};

const menuItems = {
  /** Ignore `other` while it has no items — avoids a trailing empty block and extra gap. */
  items: other.children?.length ? [singlesOutgoingGroup, albumBioRequestsGroup, chatSettingsGroup, other] : [singlesOutgoingGroup, albumBioRequestsGroup, chatSettingsGroup]
};

export default menuItems;
