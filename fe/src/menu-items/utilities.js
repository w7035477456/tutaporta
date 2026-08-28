// assets
import { IconTypography } from '@tabler/icons-react';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { VETTED_FRIENDS_PATH } from 'routes/vettedFriendsPaths';

// constant
const icons = {
  IconTypography
};

// ==============================|| UTILITIES MENU ITEMS ||============================== //

const utilities = {
  id: 'utilities',
  title: 'Vetting',
  type: 'group',
  children: [
    {
      id: 'util-vetself',
      title: 'Vetting Profile',
      type: 'item',
      url: '/verifyself',
      icon: icons.IconTypography,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: PRIMARY_COLOR_CSS,
        fontWeight: 600
      }
    },
    {
      id: 'util-received-bio-requests',
      title: 'Received Bio Req',
      type: 'item',
      url: RECEIVED_BIO_REQUESTS_PATH,
      icon: icons.IconTypography,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: PRIMARY_COLOR_CSS,
        fontWeight: 600
      }
    },
    {
      id: 'util-requests-sent',
      title: 'Acquaint. & Buddies',
      type: 'item',
      url: VETTED_FRIENDS_PATH,
      alsoHighlightWhenAt: ['/send-flower', '/request-ive-sent'],
      icon: icons.IconTypography,
      breadcrumbs: false,
      customStyle: {
        fontFamily: MAIN_FONT_FAMILY,
        color: PRIMARY_COLOR_CSS,
        fontWeight: 600
      }
    }
  ]
};

export default utilities;
