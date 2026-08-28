import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  profileRecordsIcon,
  receiveBioRequestIcon,
  selfReportBioIcon,
  settingsIcon,
  vettedFriendsIcon
} from 'config/menuIcons';
import { VETTED_FRIENDS_PATH } from 'routes/vettedFriendsPaths';
import { PRIMARY_COLOR_CSS } from 'utils/themeConfig';

// ==============================|| AUTHENTICATION MENU ITEMS ||============================== //

const vettingItemStyle = {
  fontFamily: MAIN_FONT_FAMILY,
  color: PRIMARY_COLOR_CSS,
  fontWeight: 600
};

const pages = {
  id: 'authentication',
  title: 'Vetting',
  type: 'group',
  children: [
    {
      id: 'util-vetself',
      title: 'My Bio',
      type: 'item',
      url: '/verifyself',
      iconSrc: settingsIcon,
      breadcrumbs: false,
      customStyle: vettingItemStyle
    },
    {
      id: 'util-received-bio-requests',
      title: 'Received Bio Req',
      type: 'item',
      url: RECEIVED_BIO_REQUESTS_PATH,
      iconSrc: receiveBioRequestIcon,
      breadcrumbs: false,
      customStyle: vettingItemStyle
    },
    {
      id: 'util-requests-sent',
      title: 'Acquaint. & Buddies',
      type: 'item',
      url: VETTED_FRIENDS_PATH,
      alsoHighlightWhenAt: ['/send-flower', '/request-ive-sent'],
      iconSrc: vettedFriendsIcon,
      breadcrumbs: false,
      customStyle: vettingItemStyle
    },
    {
      id: 'util-profiles-records',
      title: 'Profile & Records',
      type: 'item',
      url: PROFILES_RECORDS_PATH,
      iconSrc: profileRecordsIcon,
      breadcrumbs: false,
      customStyle: vettingItemStyle
    },
    {
      id: 'util-tools',
      title: 'Tools',
      type: 'item',
      url: ADMIN_TOOLS_PATH,
      iconSrc: settingsIcon,
      breadcrumbs: false,
      customStyle: vettingItemStyle
    },
    {
      id: 'util-self-report-biography',
      title: 'My Self-Report-Bio',
      type: 'item',
      url: SELF_REPORT_BIOGRAPHY_PATH,
      iconSrc: selfReportBioIcon,
      breadcrumbs: false,
      customStyle: vettingItemStyle
    }
  ]
};

export default pages;
