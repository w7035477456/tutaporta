export const PROFILES_RECORDS_PATH = '/profilesRecords';

export const PROFILES_RECORDS_TAB_PAY_HISTORY = 'payHistory';
export const PROFILES_RECORDS_TAB_POST_FB = 'postFb';
export const PROFILES_RECORDS_TAB_REFER_EMAIL = 'referEmail';

/** Earn Tokens / bio popups — Invite Friends → Refer Email tab */
export const PROFILES_RECORDS_TAB_INVITE_FRIENDS = PROFILES_RECORDS_TAB_REFER_EMAIL;

/** Shared Payment view tabs used by /profileRecords and embedded TutaNotes Payment. */
export const PROFILES_RECORDS_PAYMENT_TABS = ['profiles', 'buyTokens', 'payHistory'];

export const PROFILES_RECORDS_OPEN_TABS = [
  'profiles',
  'buyTokens',
  'payHistory',
  PROFILES_RECORDS_TAB_POST_FB,
  PROFILES_RECORDS_TAB_REFER_EMAIL,
  'consents',
  'inviteFriends'
];
