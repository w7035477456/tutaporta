import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  albumPostingsIcon,
  allSinglesIcon,
  pickPostIcon
} from 'config/menuIcons';
import { PRIMARY_COLOR_CSS } from 'utils/themeConfig';
import { SPEED_DATING_PATH } from 'constants/speedDateRoute';

const SECONDARY_COLOR_CSS = 'var(--theme-secondary-color)';

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const dashboard = {
  id: 'dashboard',
  title: 'Singles',
  type: 'group',
  children: [
    {
      id: 'myStory',
      title: 'My Album&Posts',
      type: 'item',
      url: '/myStory',
      iconSrc: albumPostingsIcon,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: SECONDARY_COLOR_CSS,
        fontWeight: 600
      }
    },
    {
      id: 'allSingles',
      title: 'All Singles',
      type: 'item',
      url: '/allSingles',
      iconSrc: allSinglesIcon,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: PRIMARY_COLOR_CSS,
        fontWeight: 600
      }
    },
    {
      id: 'speedDating',
      title: 'Speed Dating',
      type: 'item',
      url: SPEED_DATING_PATH,
      iconSrc: pickPostIcon,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: PRIMARY_COLOR_CSS,
        fontWeight: 600
      }
    },
    {
      id: 'myPicks',
      title: 'Picks & Posts',
      type: 'item',
      url: '/myPicks',
      iconSrc: pickPostIcon,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: PRIMARY_COLOR_CSS,
        fontWeight: 600
      }
    }
  ]
};

export default dashboard;
