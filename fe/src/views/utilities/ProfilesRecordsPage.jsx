import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';

import MainCard from 'ui-component/cards/MainCard';
import Button from '@mui/material/Button';
import { colorTemplate10MenuItemButtonSx } from 'config/colorTemplate10Menu';
import { SelectedButtonLabelTextBox } from 'ui-component/SelectedButtonTemplate';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ColorTemplate12Underline from 'ui-component/ColorTemplate12Underline';
import GreenButton from 'ui-component/GreenButton';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { guestDemoAllowProps, isGuestDemoLogin } from 'utils/guestDemoLogin';
import { PROFILES_RECORDS_OPEN_TABS, PROFILES_RECORDS_TAB_PAY_HISTORY } from 'constants/profilesRecordsRoute';
import RefereeRewardCongratulationsPopup from './RefereeRewardCongratulationsPopup';
import { getPricePerTokenFromEnv } from 'config/pricePerTokenEnv';
import ProfilesRecordsMemberBanner from './ProfilesRecordsMemberBanner';
import { ProfilesRecordsInstructionPopup } from './ProfilesRecordsInstruction';
import ProfilesRecordsInviteFriendsTab from './ProfilesRecordsInviteFriendsTab';
import ProfilesRecordsReferEmailTab from './ProfilesRecordsReferEmailTab';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import {
  AltEmailPopup,
  ChangeEmailPopup,
  ChangePasswordPopup,
  ChangePhonePopup
} from './ProfilesRecordsAccountPopups';
import ProfilesRecordsAutoLogout from './ProfilesRecordsAutoLogout';
import {
  ProfilePhotoChangeConfirmDialog,
  ProfilePhotoChangeWaitDialog
} from 'views/dashboard/myStory/ProfilePhotoChangeGateDialog';
import {
  evaluateProfilePhotoChangeGate,
  fetchProfilePhotoVettingFromBioReview,
  formatProfilePhotoEditWaitMessage,
  PROFILE_PHOTO_EDIT_CONFIRM_MESSAGE
} from 'utils/profilePhotoChangeGate';
import { MY_STORY_PATH } from 'utils/profilePhotoSetup';
import { dispatchBellNotificationRefresh } from 'utils/notificationBellStore';
import {
  fetchConsentRecords,
  formatConsentImageLinkLabel,
  getConsentRecordMediaId,
  hasConsentRecordMedia,
  isConsentRecordVideoDescription,
  resolveConsentRecordMediaUrl
} from 'api/consentRecordFe';
import {
  COLOR_TEMPLATE1_BG_SELECTED,
  COLOR_TEMPLATE1_TEXT_SELECTED,
  colorTemplate1ButtonSx
} from 'config/colorTemplate1';
import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw, getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { formatAliasWithMemberCode } from 'utils/memberLabel';
import { formatPhoneNumber } from 'utils/signupParams';
import {
  buildAccountChangeCooldownMessage,
  formatAccountChangeRetryDate,
  isAccountChangeCooldownActive,
  todayDateStringLocal
} from 'utils/accountChangeCooldown';
import payIcon from 'assets/images/payicon.png';
import UserRound from 'assets/images/users/profile.jpeg';
import api from 'api/axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession, isImpersonationSession } from 'utils/adminSession';
import { useSinglesPreferences } from 'api/singlesPreferencesFe';
import { getPayPalCheckoutConfig } from 'api/paypalConfigFe';
import { CONSENT_DESCRIPTION_CHECKR_CHECK } from 'constants/consentRecordVariants';
import { formatUserDateTime, formatPaymentHistoryDescription } from 'utils/userTimeZone';
import { formatLastFirstMiddleName } from 'utils/fullNameFormat';

const titleFontSx = {
  color: 'var(--theme-primary-color)',
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() }
};
const textFontSx = {
  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() }
};

const CHANGE_SUCCESS_MESSAGE = 'Change Successful';

const changeSuccessNoticeSx = {
  color: '#ffd84d !important',
  fontWeight: 700,
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
  whiteSpace: 'nowrap'
};

/** Match /selfReportBiography bio table: selected header + white/grey striped body rows. */
const SETTINGS_TABLE_ROW_BG_EVEN = '#ffffff';
const SETTINGS_TABLE_ROW_BG_ODD = '#f0f0f0';
const SETTINGS_TABLE_BODY_TEXT_COLOR = '#000000';

/** Pay history — Description ~4× other columns; scroll horizontally when needed. */
const PAYMENT_HISTORY_TABLE_MIN_WIDTH = '72rem';
const paymentHistoryColumnWidthSx = {
  transactionId: { width: '7rem', minWidth: '7rem' },
  date: { width: '11rem', minWidth: '11rem' },
  amountDollar: { width: '6.5rem', minWidth: '6.5rem' },
  amountToken: { width: '8rem', minWidth: '8rem' },
  balanceToken: { width: '8rem', minWidth: '8rem' },
  description: { width: '32rem', minWidth: '32rem' }
};

const settingsPaymentHistoryTableContainerSx = {
  boxShadow: 'none',
  border: '3px double #000',
  borderRadius: 0,
  backgroundColor: SETTINGS_TABLE_ROW_BG_EVEN,
  maxWidth: '100%',
  overflowX: 'auto'
};

const settingsTableContainerSx = {
  boxShadow: 'none',
  border: '3px double #000',
  borderRadius: 0,
  backgroundColor: SETTINGS_TABLE_ROW_BG_EVEN,
  '& .MuiTableCell-root': textFontSx,
  '& .MuiTableCell-head.settings-table-header-cell': {
    ...textFontSx,
    fontWeight: 700,
    bgcolor: `${COLOR_TEMPLATE1_BG_SELECTED} !important`,
    color: `${COLOR_TEMPLATE1_TEXT_SELECTED} !important`,
    border: 'none'
  },
  '& .MuiTableBody-root .MuiTableCell-root': {
    color: `${SETTINGS_TABLE_BODY_TEXT_COLOR} !important`
  },
  '& .MuiTableBody-root .MuiTypography-root': {
    color: `${SETTINGS_TABLE_BODY_TEXT_COLOR} !important`
  },
  '& .MuiTableBody-root .MuiLink-root': {
    color: `${SETTINGS_TABLE_BODY_TEXT_COLOR} !important`,
    fontWeight: 700
  }
};

const settingsTableHeaderCellSx = {
  ...colorTemplate1ButtonSx({ selected: true }),
  border: 'none',
  fontWeight: 700,
  ...textFontSx
};

function settingsTableBodyCellSx(rowIndex) {
  return {
    bgcolor: rowIndex % 2 === 0 ? SETTINGS_TABLE_ROW_BG_EVEN : SETTINGS_TABLE_ROW_BG_ODD,
    color: SETTINGS_TABLE_BODY_TEXT_COLOR
  };
}

const PROFILE_RECORDS_TABS = [
  { value: 'profiles', label: 'Profiles' },
  { value: 'buyTokens', label: 'Buy Tokens' },
  { value: 'payHistory', label: 'Balance History' },
  { value: 'postFb', label: 'Post FB' },
  { value: 'referEmail', label: 'Refer Email' },
  { value: 'consents', label: 'Consents' }
];

const REQUIRED_BILLING_FIELD_KEYS = [
  'mailing_firstname',
  'mailing_lastname',
  'email',
  'phone',
  'mailing_street',
  'mailing_city',
  'mailing_zip',
  'mailing_country'
];

function getMissingRequiredBillingFields(profileForm) {
  const source = profileForm || {};
  return REQUIRED_BILLING_FIELD_KEYS.filter((key) => String(source[key] ?? '').trim() === '');
}

function isNicknameAliasEmpty(profileForm, user) {
  return !String(profileForm?.alias ?? user?.alias ?? '').trim();
}

function isCssDarkThemeActive() {
  if (typeof document === 'undefined') return false;
  const raw = String(getComputedStyle(document.documentElement).getPropertyValue('--theme-daynight-color') || '')
    .trim()
    .toLowerCase();
  if (raw === '#000' || raw === '#000000' || raw === 'black') return true;
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return false;
  const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r === 0 && g === 0 && b === 0;
}

function isCssLightThemeActive() {
  if (typeof document === 'undefined') return false;
  const raw = String(getComputedStyle(document.documentElement).getPropertyValue('--theme-daynight-color') || '')
    .trim()
    .toLowerCase();
  if (raw === '#fff' || raw === '#ffffff' || raw === 'white') return true;
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return false;
  const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r === 255 && g === 255 && b === 255;
}

function getThemeType(preferredThemeRaw) {
  if (isCssDarkThemeActive()) return 'darkTheme';
  if (isCssLightThemeActive()) return 'lightTheme';
  const preferredTheme = String(preferredThemeRaw || '').toLowerCase();
  if (/\bdark\b/.test(preferredTheme)) return 'darkTheme';
  if (/\blight\b/.test(preferredTheme)) return 'lightTheme';
  return 'lightTheme';
}

function formatTransactionIdDisplay(transactionId) {
  if (transactionId == null) return '';
  const n = Math.trunc(Number(transactionId));
  if (!Number.isFinite(n) || n < 0) return String(transactionId);
  return String(n).padStart(8, '0');
}

function formatViewerApprovedLabel(row) {
  if (String(row?.description ?? '').trim() === CONSENT_DESCRIPTION_CHECKR_CHECK) {
    return 'N/A';
  }
  const label = formatAliasWithMemberCode({
    alias: row?.viewer_nickname,
    prefix: row?.viewer_prefix,
    memberId: row?.viewer_member_id,
    fallback: ''
  });
  if (label) return label;
  const viewerId = Number(row?.viewer_approved);
  return Number.isFinite(viewerId) && viewerId > 0 ? String(viewerId) : '';
}

/** Live system clock in the logged-in user's resolved timezone (zip, else phone area code). */
function ProfilesRecordsUserTimeReadout({ userTimeZoneProfile, sx }) {
  const [nowLabel, setNowLabel] = useState(() => formatUserDateTime(new Date(), userTimeZoneProfile));

  useEffect(() => {
    const tick = () => setNowLabel(formatUserDateTime(new Date(), userTimeZoneProfile));
    tick();
    const intervalId = window.setInterval(tick, 30_000);
    return () => window.clearInterval(intervalId);
  }, [userTimeZoneProfile?.zip, userTimeZoneProfile?.phone]);

  if (!nowLabel) return null;

  return (
    <Typography
      component="time"
      dateTime={new Date().toISOString()}
      sx={{
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...sx
      }}
    >
      {nowLabel}
    </Typography>
  );
}

export default function ProfilesRecordsPage({
  visibleTabs = null,
  embedded = false,
  initialTab = 'profiles',
  initialTokensBuying = null,
  /** When set (vault embed), successful Save Fields closes the overlay and returns to notes. */
  onProfileSaved = null,
  /** Vault / Earn Tokens: Return closes overlay or navigates back to the caller page. */
  onReturn = null
}) {
  const MAX_ACCOUNT_TOKEN_BALANCE = 20;
  const { user } = useAuth();
  const guestDemo = isGuestDemoLogin(user);
  const { preferences } = useSinglesPreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const returnToPath = useMemo(() => {
    const raw = String(location?.state?.returnTo || '').trim();
    if (!raw.startsWith('/') || raw.startsWith('//')) return '';
    return raw;
  }, [location?.state?.returnTo]);
  const showReturn = typeof onReturn === 'function' || Boolean(returnToPath);
  const [paymentHistoryRows, setPaymentHistoryRows] = useState([]);
  const [consentRows, setConsentRows] = useState([]);
  const [enlargedConsentMediaUrl, setEnlargedConsentMediaUrl] = useState('');
  const [enlargedConsentDescription, setEnlargedConsentDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(() =>
    PROFILES_RECORDS_OPEN_TABS.includes(initialTab) ? initialTab : 'profiles'
  );
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [tokenBalanceFromDb, setTokenBalanceFromDb] = useState(null);
  const [profileImageFk, setProfileImageFk] = useState(null);
  const [myReferCode, setMyReferCode] = useState('');
  const [profileForm, setProfileForm] = useState({
    id: '',
    member_id: '',
    alias: '',
    firstname: '',
    lastname: '',
    mailing_firstname: '',
    mailing_middlename: '',
    mailing_lastname: '',
    email: '',
    phone: '',
    mailing_address: '',
    mailing_street: '',
    mailing_city: '',
    mailing_zip: '',
    mailing_country: ''
  });
  const userTimeZoneProfile = useMemo(
    () => ({
      zip: profileForm.mailing_zip || user?.mailing_zip || null,
      phone: profileForm.phone || user?.phone || null
    }),
    [profileForm.mailing_zip, profileForm.phone, user?.mailing_zip, user?.phone]
  );
  const [paymentForm, setPaymentForm] = useState({
    tokensBuying:
      initialTokensBuying != null && String(initialTokensBuying).replace(/\D/g, '')
        ? String(initialTokensBuying).replace(/\D/g, '')
        : '4'
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [adminTokenBalanceInput, setAdminTokenBalanceInput] = useState('');
  const [adminTokenBalanceSaving, setAdminTokenBalanceSaving] = useState(false);
  const [adminTokenBalanceMessage, setAdminTokenBalanceMessage] = useState('');
  const [showNicknameAliasPopup, setShowNicknameAliasPopup] = useState(false);
  const [showWhyProvideAddressPopup, setShowWhyProvideAddressPopup] = useState(false);
  const [pricePerToken, setPricePerToken] = useState(() => getPricePerTokenFromEnv());
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalEnv, setPaypalEnv] = useState('sandbox');
  const [paypalSdkReady, setPaypalSdkReady] = useState(false);
  const [paypalConfigLoading, setPaypalConfigLoading] = useState(false);
  const paypalButtonContainerRef = useRef(null);
  const paypalButtonsRef = useRef(null);
  const nicknameAliasCheckedOnEntryRef = useRef(false);
  const [themeType, setThemeType] = useState(() => getThemeType(preferences?.theme));
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordChangeNotice, setPasswordChangeNotice] = useState('');
  const [emailChangeNotice, setEmailChangeNotice] = useState('');
  const [phoneChangeNotice, setPhoneChangeNotice] = useState('');
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [altEmailOpen, setAltEmailOpen] = useState(false);
  const [altEmail, setAltEmail] = useState('');
  const [lastPasswordChangeDate, setLastPasswordChangeDate] = useState(null);
  const [lastEmailChangeDate, setLastEmailChangeDate] = useState(null);
  const [lastPhoneChangeDate, setLastPhoneChangeDate] = useState(null);
  const [accountChangeCooldownOpen, setAccountChangeCooldownOpen] = useState(false);
  const [accountChangeCooldownMessage, setAccountChangeCooldownMessage] = useState('');
  const [profilePhotoEditWaitOpen, setProfilePhotoEditWaitOpen] = useState(false);
  const [profilePhotoEditWaitMessage, setProfilePhotoEditWaitMessage] = useState('');
  const [profilePhotoEditConfirmOpen, setProfilePhotoEditConfirmOpen] = useState(false);
  const [refereeRewardPopupOpen, setRefereeRewardPopupOpen] = useState(false);
  /** Dark series: page copy always white. Light series: always theme primary. */
  const pageTextColor = themeType === 'darkTheme' ? '#ffffff' : 'var(--theme-primary-color)';
  const pageBgColor = themeType === 'darkTheme' ? '#000000' : '#ffffff';
  const controlTextColor = pageTextColor;
  const renderedTabs = useMemo(() => {
    if (!Array.isArray(visibleTabs) || visibleTabs.length === 0) return PROFILE_RECORDS_TABS;
    const allowed = new Set(visibleTabs);
    return PROFILE_RECORDS_TABS.filter((tab) => allowed.has(tab.value));
  }, [visibleTabs]);

  useEffect(() => {
    if (renderedTabs.some((tab) => tab.value === activeTab)) return;
    setActiveTab(renderedTabs[0]?.value || 'profiles');
  }, [activeTab, renderedTabs]);

  const tryOpenAccountChange = useCallback((lastChangeDate, openPopup, { clearNotice } = {}) => {
    if (isAccountChangeCooldownActive(lastChangeDate)) {
      const retryDate = formatAccountChangeRetryDate(lastChangeDate);
      setAccountChangeCooldownMessage(buildAccountChangeCooldownMessage(retryDate));
      setAccountChangeCooldownOpen(true);
      return;
    }
    clearNotice?.();
    openPopup();
  }, []);

  const loadPageData = async ({ pageLoad = false } = {}) => {
    try {
      if (pageLoad) setLoading(true);
      setProfileLoading(true);
      setError('');
      const [profileResponse, historyResponse, consentsResponse] = await Promise.all([
        api.get('/api/settings/profile'),
        api.get('/api/settings/payment/history'),
        fetchConsentRecords().catch(() => [])
      ]);
      const p = profileResponse?.data || {};
      const historyRows = Array.isArray(historyResponse?.data?.rows) ? historyResponse.data.rows : [];
      const consentList = Array.isArray(consentsResponse) ? consentsResponse : [];
      setProfileForm({
        id: p.id ?? '',
        member_id: p.member_id ?? '',
        alias: p.alias ?? '',
        firstname: p.firstname ?? '',
        lastname: p.lastname ?? '',
        mailing_firstname: p.mailing_firstname ?? '',
        mailing_middlename: p.mailing_middlename ?? '',
        mailing_lastname: p.mailing_lastname ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        mailing_address: p.mailing_address ?? '',
        mailing_street: p.mailing_street ?? '',
        mailing_city: p.mailing_city ?? '',
        mailing_zip: p.mailing_zip ?? '',
        mailing_country: p.mailing_country ?? ''
      });
      setTokenBalanceFromDb(Number.isFinite(Number(p.token_balance)) ? Number(p.token_balance) : 0);
      setProfileImageFk(p.profile_image_fk ?? null);
      setMyReferCode(String(p.my_refer_code ?? '').trim());
      setAltEmail(p.alt_email ?? '');
      setLastPasswordChangeDate(p.last_password_change_date ?? null);
      setLastEmailChangeDate(p.last_email_change_date ?? null);
      setLastPhoneChangeDate(p.last_phone_change_date ?? null);
      setPaymentHistoryRows(historyRows);
      setConsentRows(consentList);
      return true;
    } catch (err) {
      setError(err?.message ?? 'Failed to load payment history');
      return false;
    } finally {
      if (pageLoad) setLoading(false);
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadPageData({ pageLoad: true });
  }, []);

  /** Success labels beside Change password / Change Email / Change Phone — session-only; cleared when user leaves and re-enters. */
  useEffect(() => {
    setPasswordChangeNotice('');
    setEmailChangeNotice('');
    setPhoneChangeNotice('');
  }, [location.key]);

  useEffect(() => {
    setThemeType(getThemeType(preferences?.theme));
  }, [preferences?.theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeType(getThemeType(preferences?.theme));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => observer.disconnect();
  }, [preferences?.theme]);

  useEffect(() => {
    const tabFromState = location?.state?.openTab;
    const normalizedTab = tabFromState === 'inviteFriends' ? 'referEmail' : tabFromState;
    if (PROFILES_RECORDS_OPEN_TABS.includes(normalizedTab)) {
      setActiveTab(normalizedTab);
    }
    const tokensFromState = location?.state?.tokensBuying;
    if (tokensFromState != null && String(tokensFromState).trim() !== '') {
      const next = String(tokensFromState).replace(/\D/g, '');
      if (next) {
        setPaymentForm((prev) => ({ ...prev, tokensBuying: next }));
      }
    }
  }, [location?.state?.openTab, location?.state?.tokensBuying]);

  useEffect(() => {
    if (!location?.state?.showRefereeRewardPopup) return;
    setActiveTab(PROFILES_RECORDS_TAB_PAY_HISTORY);
    setRefereeRewardPopupOpen(true);
    navigate(location.pathname, {
      replace: true,
      state: { openTab: PROFILES_RECORDS_TAB_PAY_HISTORY }
    });
  }, [location?.state?.showRefereeRewardPopup, location.pathname, navigate]);
  // Token balance is sourced from DB payment.account_balance_token only.
  const latestTokenBalance = Number.isFinite(Number(tokenBalanceFromDb)) ? Number(tokenBalanceFromDb) : 0;
  const adminCanSetTokenBalance = isImpersonationSession(user);

  const profileDisplayName = useMemo(
    () =>
      formatLastFirstMiddleName(
        profileForm.mailing_lastname || profileForm.lastname,
        profileForm.mailing_firstname || profileForm.firstname,
        profileForm.mailing_middlename
      ),
    [
      profileForm.mailing_lastname,
      profileForm.lastname,
      profileForm.mailing_firstname,
      profileForm.firstname,
      profileForm.mailing_middlename
    ]
  );
  const profileDisplayPhone = String(profileForm.phone || user?.phone || '').trim();
  const profileDisplayEmail = String(profileForm.email || user?.email || '').trim();
  const profileDisplayAltEmail = String(altEmail || '').trim();
  const profileCurrentValueSx = {
    ...textFontSx,
    color: pageTextColor,
    fontWeight: 700,
    flex: '0 1 auto',
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  const profileActionRowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    flexWrap: 'nowrap',
    minWidth: 0,
    justifySelf: { sm: 'start' }
  };

  useEffect(() => {
    if (!adminCanSetTokenBalance) return;
    setAdminTokenBalanceInput(String(latestTokenBalance));
  }, [adminCanSetTokenBalance, latestTokenBalance]);

  const saveAdminTokenBalance = useCallback(async () => {
    const digits = String(adminTokenBalanceInput ?? '').replace(/\D/g, '');
    const nextBalance = digits === '' ? 0 : Math.trunc(Number(digits));
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      setAdminTokenBalanceMessage('Enter a non-negative whole number.');
      return;
    }
    setAdminTokenBalanceSaving(true);
    setAdminTokenBalanceMessage('');
    try {
      const { data } = await api.put('/api/admin/payment/token-balance', {
        account_balance_token: nextBalance
      });
      const saved = Number(data?.account_balance_token ?? data?.token_balance);
      setTokenBalanceFromDb(Number.isFinite(saved) ? saved : nextBalance);
      setAdminTokenBalanceInput(String(Number.isFinite(saved) ? saved : nextBalance));
      const historyResponse = await api.get('/api/settings/payment/history');
      const historyRows = Array.isArray(historyResponse?.data?.rows) ? historyResponse.data.rows : [];
      setPaymentHistoryRows(historyRows);
      setAdminTokenBalanceMessage('Token balance saved.');
    } catch (err) {
      setAdminTokenBalanceMessage(err?.response?.data?.error || err?.message || 'Failed to set token balance');
    } finally {
      setAdminTokenBalanceSaving(false);
    }
  }, [adminTokenBalanceInput]);
  const profilePhotoUrl =
    profileImageFk != null ? `${getApiBaseUrl()}/api/photo/${profileImageFk}` : user?.profile_image_fk ? `${getApiBaseUrl()}/api/photo/${user.profile_image_fk}` : null;
  const missingRequiredBillingFields = useMemo(() => getMissingRequiredBillingFields(profileForm), [profileForm]);
  const hasMissingRequiredBillingFields = missingRequiredBillingFields.length > 0;
  const isRequiredFieldMissing = (key) => missingRequiredBillingFields.includes(key);

  const handleProfilePhotoChange = useCallback(async () => {
    try {
      const vetting = await fetchProfilePhotoVettingFromBioReview();
      const gate = evaluateProfilePhotoChangeGate({ ...vetting, isAdmin: isAdminSession(user) });
      if (gate.action === 'blocked') {
        setProfilePhotoEditWaitMessage(formatProfilePhotoEditWaitMessage(vetting.vettedDate));
        setProfilePhotoEditWaitOpen(true);
        return;
      }
      if (gate.action === 'confirm') {
        setProfilePhotoEditConfirmOpen(true);
        return;
      }
      navigate(MY_STORY_PATH);
    } catch (err) {
      setProfileMessage(err?.response?.data?.error || err?.message || 'Failed to check profile photo status');
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!profileLoading && !nicknameAliasCheckedOnEntryRef.current) {
      nicknameAliasCheckedOnEntryRef.current = true;
      if (isNicknameAliasEmpty(profileForm, user)) {
        setShowNicknameAliasPopup(true);
      }
    }
  }, [profileLoading, profileForm.alias, user]);

  const saveProfileChanges = async () => {
    try {
      setProfileSaving(true);
      setProfileMessage('');
      const { data } = await api.put('/api/settings/profile', profileForm);
      setProfileForm({
        id: data.id ?? '',
        member_id: data.member_id ?? '',
        alias: data.alias ?? '',
        firstname: data.firstname ?? '',
        lastname: data.lastname ?? '',
        mailing_firstname: data.mailing_firstname ?? '',
        mailing_middlename: data.mailing_middlename ?? '',
        mailing_lastname: data.mailing_lastname ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        mailing_address: data.mailing_address ?? '',
        mailing_street: data.mailing_street ?? '',
        mailing_city: data.mailing_city ?? '',
        mailing_zip: data.mailing_zip ?? '',
        mailing_country: data.mailing_country ?? ''
      });
      setTokenBalanceFromDb(Number.isFinite(Number(data.token_balance)) ? Number(data.token_balance) : 0);
      setProfileImageFk(data.profile_image_fk ?? null);
      setProfileMessage('Profile saved.');
      if (typeof onProfileSaved === 'function') {
        onProfileSaved();
      }
    } catch (err) {
      setProfileMessage(err?.response?.data?.error || err?.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleReturn = () => {
    if (typeof onReturn === 'function') {
      onReturn();
      return;
    }
    if (returnToPath) {
      navigate(returnToPath);
    }
  };

  const resetProfileFields = async () => {
    setProfileMessage('');
    const ok = await loadPageData({ pageLoad: false });
    if (ok) {
      setProfileMessage('Fields reset from database.');
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadCheckoutConfig = async () => {
      setPaypalConfigLoading(true);
      try {
        const config = await getPayPalCheckoutConfig();
        if (!mounted || !config) return;
        setPaypalClientId(String(config.paypalClientId || '').trim());
        setPaypalEnv(String(config.paypalEnv || '').trim().toLowerCase() === 'live' ? 'live' : 'sandbox');
        const fromApi = Number(config.paymentPricePerToken);
        setPricePerToken(
          Number.isFinite(fromApi) && fromApi > 0 ? fromApi : getPricePerTokenFromEnv()
        );
      } finally {
        if (mounted) setPaypalConfigLoading(false);
      }
    };
    loadCheckoutConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const tokensBuyingNum = Number.parseInt(paymentForm.tokensBuying, 10) || 0;
  const totalPrice = tokensBuyingNum * pricePerToken;

  useEffect(() => {
    if (guestDemo || activeTab !== 'buyTokens' || !paypalClientId) return undefined;
    let cancelled = false;

    const scriptId = 'paypal-js-sdk-script';
    const ensureSdk = async () => {
      if (window.paypal?.Buttons) {
        if (!cancelled) setPaypalSdkReady(true);
        return;
      }
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.addEventListener('load', () => {
          if (!cancelled) setPaypalSdkReady(true);
        });
        existing.addEventListener('error', () => {
          if (!cancelled) setPaymentMessage('Failed to load PayPal checkout script.');
        });
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&components=buttons&intent=capture`;
      script.async = true;
      script.onload = () => {
        if (!cancelled) setPaypalSdkReady(true);
      };
      script.onerror = () => {
        if (!cancelled) setPaymentMessage('Failed to load PayPal checkout script.');
      };
      document.body.appendChild(script);
    };
    ensureSdk();

    return () => {
      cancelled = true;
    };
  }, [activeTab, paypalClientId, guestDemo]);

  useEffect(() => {
    if (guestDemo || activeTab !== 'buyTokens') return undefined;
    if (!paypalSdkReady || !window.paypal?.Buttons || !paypalButtonContainerRef.current) return undefined;

    paypalButtonsRef.current?.close?.();
    paypalButtonContainerRef.current.innerHTML = '';

    const buttons = window.paypal.Buttons({
      style: {
        shape: 'rect',
        layout: 'vertical',
        color: 'gold',
        label: 'paypal'
      },
      createOrder: async () => {
        const allowedToBuy = Math.max(0, MAX_ACCOUNT_TOKEN_BALANCE - latestTokenBalance);
        const tokensRaw = String(paymentForm.tokensBuying || '').trim();
        if (!/^\d+$/.test(tokensRaw) || tokensBuyingNum < 1 || tokensBuyingNum > MAX_ACCOUNT_TOKEN_BALANCE) {
          const message = 'Please enter a positive integer token amount (1-20).';
          setPaymentMessage(message);
          throw new Error(message);
        }
        if (tokensBuyingNum > allowedToBuy) {
          const message = `For your protection, we allow maximum of ${MAX_ACCOUNT_TOKEN_BALANCE} token per account balance. You can buy up to ${allowedToBuy} more token only.`;
          setPaymentMessage(message);
          throw new Error(message);
        }
        setPaymentSaving(true);
        setPaymentMessage('');
        try {
          const { data } = await api.post('/api/settings/payment/paypal/orders', {
            tokens_buying: tokensBuyingNum
          });
          if (!data?.id) throw new Error('Could not create PayPal order');
          return data.id;
        } catch (err) {
          const message = err?.response?.data?.error || err?.message || 'Could not initiate PayPal checkout';
          setPaymentMessage(message);
          setPaymentSaving(false);
          throw new Error(message);
        }
      },
      onApprove: async (data) => {
        try {
          const captureResponse = await api.post(`/api/settings/payment/paypal/orders/${data.orderID}/capture`);
          const historyResponse = await api.get('/api/settings/payment/history');
          const newTokenBalance = Number(captureResponse?.data?.token_balance);
          setTokenBalanceFromDb((prev) => (Number.isFinite(newTokenBalance) ? newTokenBalance : prev));
          setPaymentHistoryRows(Array.isArray(historyResponse?.data?.rows) ? historyResponse.data.rows : []);
          setPaymentMessage('Payment completed.');
          setActiveTab('payHistory');
          dispatchBellNotificationRefresh('balance');
        } catch (err) {
          setPaymentMessage(err?.response?.data?.error || err?.message || 'Failed to complete PayPal capture');
        } finally {
          setPaymentSaving(false);
        }
      },
      onError: (err) => {
        setPaymentSaving(false);
        setPaymentMessage(err?.message || 'PayPal checkout failed. Please try again.');
      }
    });

    buttons
      .render(paypalButtonContainerRef.current)
      .then(() => {
        paypalButtonsRef.current = buttons;
      })
      .catch((err) => {
        setPaymentMessage(err?.message || 'Could not render PayPal button.');
      });

    return () => {
      paypalButtonsRef.current?.close?.();
    };
  }, [activeTab, paypalSdkReady, paymentForm.tokensBuying, tokensBuyingNum, latestTokenBalance, guestDemo]);

  const profilesRecordsHeaderTitle = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
        alignItems: { xs: 'start', sm: 'center' },
        gap: { xs: 1, sm: 1.5 },
        width: '100%'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 0.75, sm: 1.5 },
          justifySelf: { xs: 'start', sm: 'start' },
          minWidth: 0
        }}
      >
        <Typography
          sx={{
            ...titleFontSx,
            color: pageTextColor,
            lineHeight: 1.2
          }}
        >
          Payment history
        </Typography>
        <ProfilesRecordsUserTimeReadout
          userTimeZoneProfile={userTimeZoneProfile}
          sx={{ ...textFontSx, color: pageTextColor }}
        />
      </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            justifySelf: 'center',
            gridColumn: { xs: '1', sm: '2' },
            gridRow: { xs: 2, sm: 'auto' }
          }}
        >
          <PageVideoTutorialsButton pageKey="profileRecords" />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}
          >
          <Typography sx={{ ...textFontSx, fontWeight: 600, color: pageTextColor, whiteSpace: 'nowrap' }}>
            Token balance:
          </Typography>
          {adminCanSetTokenBalance ? (
            <>
              <TextField
                size="small"
                value={adminTokenBalanceInput}
                onChange={(event) => {
                  setAdminTokenBalanceMessage('');
                  setAdminTokenBalanceInput(event.target.value.replace(/\D/g, ''));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveAdminTokenBalance();
                  }
                }}
                disabled={adminTokenBalanceSaving}
                inputProps={{
                  inputMode: 'numeric',
                  'aria-label': 'Token balance (admin set)',
                  style: { textAlign: 'center', fontWeight: 700 }
                }}
                sx={{
                  width: { xs: 72, sm: 88 },
                  '& .MuiInputBase-root': {
                    bgcolor: COLOR_TEMPLATE1_BG_SELECTED,
                    color: COLOR_TEMPLATE1_TEXT_SELECTED,
                    ...colorTemplate1ButtonSx({ selected: true })
                  },
                  '& .MuiInputBase-input': {
                    color: 'inherit',
                    WebkitTextFillColor: 'inherit',
                    ...textFontSx
                  }
                }}
              />
              <UnSelectedButtonTemplate
                type="button"
                disabled={adminTokenBalanceSaving}
                onClick={() => void saveAdminTokenBalance()}
                sx={{ flexShrink: 0 }}
              >
                {adminTokenBalanceSaving ? 'Saving…' : 'Set'}
              </UnSelectedButtonTemplate>
            </>
          ) : (
            <Typography sx={{ ...textFontSx, fontWeight: 700, color: pageTextColor, whiteSpace: 'nowrap' }}>
              {latestTokenBalance}
            </Typography>
          )}
          <Box
            component="img"
            src={payIcon}
            alt="payment icon"
            sx={{ width: { xs: 30, sm: 36 }, height: { xs: 30, sm: 36 }, objectFit: 'contain', flexShrink: 0 }}
          />
          </Box>
        </Box>
        {adminCanSetTokenBalance && adminTokenBalanceMessage ? (
          <Typography
            sx={{
              ...textFontSx,
              color: adminTokenBalanceMessage.includes('saved') ? '#4caf50' : '#e53935',
              textAlign: 'center',
              width: '100%',
              gridColumn: '1 / -1'
            }}
          >
            {adminTokenBalanceMessage}
          </Typography>
        ) : null}
      <Box sx={{ justifySelf: { xs: 'end', sm: 'end' }, gridColumn: { xs: '1', sm: '3' }, gridRow: { xs: 3, sm: 'auto' } }}>
        <PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />
      </Box>
    </Box>
  );

  return (
    <>
      {!embedded ? (
        <Box
          sx={{
            mx: { xs: -1.25, sm: -2, md: -2.5 },
            mt: { xs: -2, sm: -2, md: -2.5 },
            mb: { xs: 1, sm: 1.5 }
          }}
        >
          <ProfilesRecordsMemberBanner />
        </Box>
      ) : null}
      <MainCard
      title={profilesRecordsHeaderTitle}
      headerSX={{
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 1,
        '& .MuiCardHeader-content': {
          flex: 1,
          minWidth: 0
        },
        '& .MuiCardHeader-title': {
          width: '100%'
        }
      }}
    >
      <ProfilesRecordsInstructionPopup open={instructionOpen} onClose={() => setInstructionOpen(false)} />
      <RefereeRewardCongratulationsPopup
        open={refereeRewardPopupOpen}
        onClose={() => setRefereeRewardPopupOpen(false)}
      />
      <ChangePasswordPopup
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        phone={profileForm.phone || user?.phone || ''}
        email={profileForm.email || user?.email || ''}
        onSuccess={() => {
          setLastPasswordChangeDate(todayDateStringLocal());
          setPasswordChangeNotice(CHANGE_SUCCESS_MESSAGE);
        }}
      />
      <ChangePhonePopup
        open={changePhoneOpen}
        onClose={() => setChangePhoneOpen(false)}
        email={profileForm.email || user?.email || ''}
        phone={profileForm.phone || user?.phone || ''}
        onSuccess={(data) => {
          if (data?.phone) {
            setProfileForm((prev) => ({ ...prev, phone: formatPhoneNumber(data.phone) }));
          }
          setLastPhoneChangeDate(todayDateStringLocal());
          setPhoneChangeNotice(CHANGE_SUCCESS_MESSAGE);
        }}
      />
      <ChangeEmailPopup
        open={changeEmailOpen}
        onClose={() => setChangeEmailOpen(false)}
        phone={profileForm.phone || user?.phone || ''}
        email={profileForm.email || user?.email || ''}
        onSuccess={(data) => {
          if (data?.email) {
            setProfileForm((prev) => ({ ...prev, email: data.email }));
          }
          setLastEmailChangeDate(todayDateStringLocal());
          setEmailChangeNotice(CHANGE_SUCCESS_MESSAGE);
        }}
      />
      <AltEmailPopup
        open={altEmailOpen}
        onClose={() => setAltEmailOpen(false)}
        email={profileForm.email || user?.email || ''}
        altEmail={altEmail}
        onSuccess={(data) => setAltEmail(data?.alt_email || '')}
      />
      <ProfilePhotoChangeWaitDialog
        open={profilePhotoEditWaitOpen}
        onClose={() => setProfilePhotoEditWaitOpen(false)}
        message={profilePhotoEditWaitMessage}
      />
      <ProfilePhotoChangeConfirmDialog
        open={profilePhotoEditConfirmOpen}
        onClose={() => setProfilePhotoEditConfirmOpen(false)}
        message={PROFILE_PHOTO_EDIT_CONFIRM_MESSAGE}
        onConfirm={() => {
          setProfilePhotoEditConfirmOpen(false);
          navigate(MY_STORY_PATH);
        }}
      />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error ? (
        <>
          <Box sx={{ border: `1px solid ${controlTextColor}`, borderRadius: 1, overflow: 'hidden', bgcolor: pageBgColor }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 1,
                bgcolor: pageBgColor,
                overflowX: 'auto'
              }}
            >
              {renderedTabs.map((tab) => {
                const isSelected = activeTab === tab.value;
                return (
                  <Button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    {...guestDemoAllowProps()}
                    sx={{
                      ...colorTemplate10MenuItemButtonSx({ selected: isSelected, fitLabelWidth: true }),
                      minHeight: 30,
                      flexShrink: 0,
                      borderRadius: '6px 6px 0 0',
                      px: { xs: 1.25, sm: 1.5 },
                      py: 0.5,
                      whiteSpace: 'nowrap',
                      fontWeight: isSelected ? 700 : 600,
                      ...textFontSx
                    }}
                  >
                    <SelectedButtonLabelTextBox enabled={isSelected}>{tab.label}</SelectedButtonLabelTextBox>
                  </Button>
                );
              })}
            </Box>
            <Divider sx={{ borderColor: controlTextColor }} />
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                bgcolor: pageBgColor,
                '& .MuiTypography-root:not(.change-success-notice)': { ...textFontSx, color: pageTextColor },
                '& .MuiTableCell-root': { ...textFontSx, color: pageTextColor },
                '& .MuiInputBase-root:not(.invite-friends-white-field) .MuiInputBase-input': {
                  ...textFontSx,
                  color: pageTextColor
                },
                '& .MuiInputLabel-root': { ...textFontSx, color: pageTextColor },
                '& .MuiInputBase-root:not(.invite-friends-white-field)': { backgroundColor: pageBgColor },
                '& .MuiOutlinedInput-root:not(.invite-friends-white-field) .MuiOutlinedInput-notchedOutline': {
                  borderColor: pageTextColor
                }
              }}
            >
              {activeTab === 'profiles' ? (
                <Stack spacing={1.25}>
                  {profileLoading ? <Typography>Loading profile...</Typography> : null}
                  <Typography sx={{ ...titleFontSx, color: pageTextColor, fontWeight: 700 }}>Below is customize how you appear online:</Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%'
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'auto auto' },
                        columnGap: { xs: 0, sm: 1.5 },
                        rowGap: 1.25,
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: { xs: '100%', sm: 920 }
                      }}
                    >
                      <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                        Nick name or alias:
                      </Typography>
                      <TextField
                        size="small"
                        value={profileForm.alias}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, alias: e.target.value }))}
                        sx={{ width: { xs: '100%', sm: 300 }, maxWidth: '100%', justifySelf: { sm: 'start' } }}
                      />
                      {!embedded ? (
                        <>
                          <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                            Change profile photo:
                          </Typography>
                          <Box sx={profileActionRowSx}>
                            <Box
                              component="img"
                              src={profilePhotoUrl || UserRound}
                              alt="profile"
                              sx={{
                                width: { xs: 56, sm: 64 },
                                height: { xs: 56, sm: 64 },
                                objectFit: 'cover',
                                border: '1px solid rgba(0,0,0,0.35)',
                                flexShrink: 0
                              }}
                            />
                            <GreenButton
                              onClick={() => void handleProfilePhotoChange()}
                              sx={{ flexShrink: 0 }}
                            >
                              Click here
                            </GreenButton>
                            {profileDisplayName ? (
                              <Typography sx={profileCurrentValueSx}>{profileDisplayName}</Typography>
                            ) : null}
                          </Box>
                        </>
                      ) : null}
                      <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                        Change password:
                      </Typography>
                      <Box sx={profileActionRowSx}>
                        <GreenButton
                          onClick={() =>
                            tryOpenAccountChange(lastPasswordChangeDate, () => setChangePasswordOpen(true), {
                              clearNotice: () => setPasswordChangeNotice('')
                            })
                          }
                          sx={{ flexShrink: 0 }}
                        >
                          Click here
                        </GreenButton>
                        {passwordChangeNotice ? (
                          <Typography className="change-success-notice" sx={changeSuccessNoticeSx}>
                            {passwordChangeNotice}
                          </Typography>
                        ) : null}
                      </Box>
                      <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                        Change Phone:
                      </Typography>
                      <Box sx={profileActionRowSx}>
                        <GreenButton
                          onClick={() =>
                            tryOpenAccountChange(lastPhoneChangeDate, () => setChangePhoneOpen(true), {
                              clearNotice: () => setPhoneChangeNotice('')
                            })
                          }
                          sx={{ flexShrink: 0 }}
                        >
                          Click here
                        </GreenButton>
                        {profileDisplayPhone ? (
                          <Typography sx={profileCurrentValueSx}>{profileDisplayPhone}</Typography>
                        ) : null}
                        {phoneChangeNotice ? (
                          <Typography className="change-success-notice" sx={changeSuccessNoticeSx}>
                            {phoneChangeNotice}
                          </Typography>
                        ) : null}
                      </Box>
                      <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                        Change Email:
                      </Typography>
                      <Box sx={profileActionRowSx}>
                        <GreenButton
                          onClick={() =>
                            tryOpenAccountChange(lastEmailChangeDate, () => setChangeEmailOpen(true), {
                              clearNotice: () => setEmailChangeNotice('')
                            })
                          }
                          sx={{ flexShrink: 0 }}
                        >
                          Click here
                        </GreenButton>
                        {profileDisplayEmail ? (
                          <Typography sx={profileCurrentValueSx}>{profileDisplayEmail}</Typography>
                        ) : null}
                        {emailChangeNotice ? (
                          <Typography className="change-success-notice" sx={changeSuccessNoticeSx}>
                            {emailChangeNotice}
                          </Typography>
                        ) : null}
                      </Box>
                      <Typography sx={{ textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                        Alt/2nd Email:
                      </Typography>
                      <Box sx={profileActionRowSx}>
                        <GreenButton onClick={() => setAltEmailOpen(true)} sx={{ flexShrink: 0 }}>
                          Click here
                        </GreenButton>
                        {profileDisplayAltEmail ? (
                          <Typography sx={profileCurrentValueSx}>{profileDisplayAltEmail}</Typography>
                        ) : null}
                      </Box>
                      <ProfilesRecordsAutoLogout pageTextColor={pageTextColor} textFontSx={textFontSx} />
                    </Box>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1 }}>
                    <Typography sx={{ ...titleFontSx, color: pageTextColor, fontWeight: 700 }}>
                      Below is for billing and mailing purpose: (We will never reveal to anyone else)
                    </Typography>
                    <ColorTemplate12Underline onClick={() => setShowWhyProvideAddressPopup(true)}>
                      Why provide this
                    </ColorTemplate12Underline>
                  </Box>
                  <Grid
                    container
                    spacing={1}
                    alignItems="center"
                    sx={{
                      border: hasMissingRequiredBillingFields ? '2px dotted #ffd84d' : '2px dotted transparent',
                      borderRadius: 1,
                      p: 1
                    }}
                  >
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Mail/Bill First Name"
                        value={profileForm.mailing_firstname}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mailing_firstname: e.target.value }))}
                        error={isRequiredFieldMissing('mailing_firstname')}
                        sx={
                          isRequiredFieldMissing('mailing_firstname')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Mail/Bill Last Name"
                        value={profileForm.mailing_lastname}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mailing_lastname: e.target.value }))}
                        error={isRequiredFieldMissing('mailing_lastname')}
                        sx={
                          isRequiredFieldMissing('mailing_lastname')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                        error={isRequiredFieldMissing('email')}
                        sx={
                          isRequiredFieldMissing('email')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                        error={isRequiredFieldMissing('phone')}
                        sx={
                          isRequiredFieldMissing('phone')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Street"
                        value={profileForm.mailing_street}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mailing_street: e.target.value }))}
                        error={isRequiredFieldMissing('mailing_street')}
                        sx={
                          isRequiredFieldMissing('mailing_street')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="City"
                        value={profileForm.mailing_city}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mailing_city: e.target.value }))}
                        error={isRequiredFieldMissing('mailing_city')}
                        sx={
                          isRequiredFieldMissing('mailing_city')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Zip"
                        value={profileForm.mailing_zip}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mailing_zip: e.target.value }))}
                        error={isRequiredFieldMissing('mailing_zip')}
                        sx={
                          isRequiredFieldMissing('mailing_zip')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Country"
                        value={profileForm.mailing_country}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mailing_country: e.target.value }))}
                        error={isRequiredFieldMissing('mailing_country')}
                        sx={
                          isRequiredFieldMissing('mailing_country')
                            ? {
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#fff3f3'
                                }
                              }
                            : undefined
                        }
                      />
                    </Grid>
                  </Grid>
                  {profileMessage ? (
                    <Alert severity={profileMessage === 'Profile saved.' || profileMessage === 'Fields reset from database.' ? 'success' : 'error'}>
                      {profileMessage}
                    </Alert>
                  ) : null}
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-start' }}>
                    <GreenButton onClick={resetProfileFields}>Reset Fields</GreenButton>
                    <GreenButton onClick={saveProfileChanges} disabled={profileSaving}>
                      {profileSaving ? 'Saving...' : 'Save Fields'}
                    </GreenButton>
                  </Box>
                </Stack>
              ) : null}

              {activeTab === 'buyTokens' ? (
                <Stack spacing={1.25}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography>Tokens buying</Typography>
                    <TextField
                      size="small"
                      value={paymentForm.tokensBuying}
                      onChange={(e) => {
                        const next = String(e.target.value || '').replace(/\D/g, '');
                        setPaymentForm((prev) => ({ ...prev, tokensBuying: next }));
                      }}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1, max: MAX_ACCOUNT_TOKEN_BALANCE }}
                      sx={{ width: 90 }}
                    />
                    <Typography>Price per token ${pricePerToken}/token</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography>Total Price buying</Typography>
                    <TextField size="small" value={`$${totalPrice.toFixed(2)}`} inputProps={{ readOnly: true }} sx={{ width: 120 }} />
                  </Box>
                  <Box sx={{ maxWidth: 420, width: '100%' }}>
                    <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography>Checkout with PayPal</Typography>
                      <Chip
                        size="small"
                        color={paypalClientId ? 'success' : 'error'}
                        label={paypalClientId ? 'PayPal Connected' : 'PayPal Not Connected'}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={paypalEnv === 'live' ? 'warning' : 'info'}
                        label={paypalEnv === 'live' ? 'Live Mode' : 'Sandbox Mode'}
                      />
                    </Box>
                    {paypalConfigLoading && !guestDemo ? <Typography>Loading checkout...</Typography> : null}
                    {!guestDemo && !paypalConfigLoading && !paypalClientId ? (
                      <Alert severity="error">PayPal is not configured yet. Please contact support to set PAYPAL_CLIENT_ID.</Alert>
                    ) : null}
                    {guestDemo ? (
                      <Stack spacing={1} sx={{ width: '100%' }} aria-label="Checkout unavailable in demo mode">
                        {[
                          { label: 'PayPal', bgcolor: '#ffc439', color: '#111' },
                          { label: 'Pay Later', bgcolor: '#ffc439', color: '#111' },
                          { label: 'Debit or Credit Card', bgcolor: '#111', color: '#fff' }
                        ].map((btn) => (
                          <Box
                            key={btn.label}
                            component="button"
                            type="button"
                            aria-label={`${btn.label} unavailable in demo mode`}
                            sx={{
                              width: '100%',
                              minHeight: 45,
                              border: 'none',
                              borderRadius: 1,
                              bgcolor: btn.bgcolor,
                              color: btn.color,
                              fontWeight: 700,
                              fontSize: '1rem',
                              cursor: 'pointer',
                              fontFamily: 'inherit'
                            }}
                          >
                            {btn.label}
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Box
                        ref={paypalButtonContainerRef}
                        sx={{
                          minHeight: 42,
                          opacity: paymentSaving ? 0.7 : 1,
                          pointerEvents: paymentSaving ? 'none' : 'auto'
                        }}
                      />
                    )}
                  </Box>
                  {paymentMessage ? <Alert severity={paymentMessage === 'Payment completed.' ? 'success' : 'error'}>{paymentMessage}</Alert> : null}
                </Stack>
              ) : null}

              {activeTab === 'postFb' ? (
                <ProfilesRecordsInviteFriendsTab myReferCode={myReferCode} pageTextColor={pageTextColor} />
              ) : null}

              {activeTab === 'referEmail' ? (
                <ProfilesRecordsReferEmailTab
                  accountEmail={profileForm.email || user?.email}
                  pageTextColor={pageTextColor}
                  hasReferralCode={/^\d{6}$/.test(String(myReferCode ?? '').replace(/\D/g, ''))}
                  myReferCode={myReferCode}
                />
              ) : null}

              {activeTab === 'payHistory' ? (
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{ ...settingsTableContainerSx, ...settingsPaymentHistoryTableContainerSx }}
                >
                  <Table size="small" sx={{ tableLayout: 'fixed', minWidth: PAYMENT_HISTORY_TABLE_MIN_WIDTH }}>
                    <TableHead>
                      <TableRow>
                        <TableCell
                          className="settings-table-header-cell"
                          sx={{ ...settingsTableHeaderCellSx, ...paymentHistoryColumnWidthSx.transactionId }}
                        >
                          Transaction ID
                        </TableCell>
                        <TableCell
                          className="settings-table-header-cell"
                          sx={{ ...settingsTableHeaderCellSx, ...paymentHistoryColumnWidthSx.date }}
                        >
                          Date
                        </TableCell>
                        <TableCell
                          className="settings-table-header-cell"
                          sx={{ ...settingsTableHeaderCellSx, ...paymentHistoryColumnWidthSx.amountDollar }}
                        >
                          Amount $
                        </TableCell>
                        <TableCell
                          className="settings-table-header-cell"
                          sx={{ ...settingsTableHeaderCellSx, ...paymentHistoryColumnWidthSx.amountToken }}
                        >
                          Amount Token
                        </TableCell>
                        <TableCell
                          className="settings-table-header-cell"
                          sx={{ ...settingsTableHeaderCellSx, ...paymentHistoryColumnWidthSx.balanceToken }}
                        >
                          Balance Token
                        </TableCell>
                        <TableCell
                          className="settings-table-header-cell"
                          sx={{ ...settingsTableHeaderCellSx, ...paymentHistoryColumnWidthSx.description }}
                        >
                          Description
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentHistoryRows.length ? (
                        paymentHistoryRows.map((row, idx) => {
                          const bodyCellSx = settingsTableBodyCellSx(idx);
                          return (
                            <TableRow key={`${row.date ?? 'row'}-${idx}`} sx={{ bgcolor: bodyCellSx.bgcolor }}>
                              <TableCell sx={{ ...bodyCellSx, ...paymentHistoryColumnWidthSx.transactionId }}>
                                {formatTransactionIdDisplay(row?.transaction_id)}
                              </TableCell>
                              <TableCell sx={{ ...bodyCellSx, ...paymentHistoryColumnWidthSx.date }}>
                                {formatUserDateTime(row?.date, userTimeZoneProfile)}
                              </TableCell>
                              <TableCell sx={{ ...bodyCellSx, ...paymentHistoryColumnWidthSx.amountDollar }}>
                                {Number.isFinite(Number(row?.amount_dollar))
                                  ? `$${Number(row.amount_dollar).toFixed(2)}`
                                  : /^debit for viewing (?:basic|detail )?member\b/i.test(String(row?.description || ''))
                                    ? 'N/A'
                                    : ''}
                              </TableCell>
                              <TableCell sx={{ ...bodyCellSx, ...paymentHistoryColumnWidthSx.amountToken }}>
                                {Number.isFinite(Number(row?.amount_token)) ? `${Number(row.amount_token)} tokens` : ''}
                              </TableCell>
                              <TableCell sx={{ ...bodyCellSx, ...paymentHistoryColumnWidthSx.balanceToken }}>
                                {Number.isFinite(Number(row?.balance_token)) ? `${Number(row.balance_token)} tokens` : ''}
                              </TableCell>
                              <TableCell
                                sx={{
                                  ...bodyCellSx,
                                  ...paymentHistoryColumnWidthSx.description,
                                  whiteSpace: 'normal',
                                  lineHeight: 1.35
                                }}
                              >
                                {formatPaymentHistoryDescription(row?.description, row?.date, userTimeZoneProfile)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow sx={{ bgcolor: SETTINGS_TABLE_ROW_BG_EVEN }}>
                          <TableCell colSpan={6} sx={settingsTableBodyCellSx(0)}>
                            <Typography>No payment history rows found.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}

              {activeTab === 'consents' ? (
                <TableContainer component={Paper} elevation={0} sx={settingsTableContainerSx}>
                  <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell className="settings-table-header-cell" sx={settingsTableHeaderCellSx}>
                          Date
                        </TableCell>
                        <TableCell className="settings-table-header-cell" sx={settingsTableHeaderCellSx}>
                          Viewer approved
                        </TableCell>
                        <TableCell className="settings-table-header-cell" sx={settingsTableHeaderCellSx}>
                          Consent Image
                        </TableCell>
                        <TableCell className="settings-table-header-cell" sx={settingsTableHeaderCellSx}>
                          Description
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {consentRows.length ? (
                        consentRows.map((row, idx) => {
                          const bodyCellSx = settingsTableBodyCellSx(idx);
                          return (
                            <TableRow key={row.consent_record_id} sx={{ bgcolor: bodyCellSx.bgcolor }}>
                              <TableCell sx={bodyCellSx}>{formatUserDateTime(row?.date_signed, userTimeZoneProfile)}</TableCell>
                              <TableCell sx={bodyCellSx}>{formatViewerApprovedLabel(row)}</TableCell>
                              <TableCell sx={bodyCellSx}>
                                {hasConsentRecordMedia(row) ? (
                                  <Link
                                    component="button"
                                    type="button"
                                    underline="always"
                                    onClick={() => {
                                      setEnlargedConsentMediaUrl(resolveConsentRecordMediaUrl(row));
                                      setEnlargedConsentDescription(row.description || '');
                                    }}
                                    sx={{
                                      ...textFontSx,
                                      cursor: 'pointer',
                                      textDecorationColor: '#000000',
                                      textDecorationThickness: '2.5px',
                                      textUnderlineOffset: '2px'
                                    }}
                                  >
                                    {formatConsentImageLinkLabel(row.description, getConsentRecordMediaId(row))}
                                  </Link>
                                ) : (
                                  ''
                                )}
                              </TableCell>
                              <TableCell sx={bodyCellSx}>{row.description || ''}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow sx={{ bgcolor: SETTINGS_TABLE_ROW_BG_EVEN }}>
                          <TableCell colSpan={4} sx={settingsTableBodyCellSx(0)}>
                            <Typography>No consent records found.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}
              {showReturn ? (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
                  <GreenButton type="button" onClick={handleReturn} {...guestDemoAllowProps()}>
                    Return
                  </GreenButton>
                </Box>
              ) : null}
            </Box>
          </Box>
        </>
      ) : null}
      <ColorTemplate7PopupLargeDark
        open={Boolean(enlargedConsentMediaUrl)}
        onClose={() => {
          setEnlargedConsentMediaUrl('');
          setEnlargedConsentDescription('');
        }}
        closeOnBackdrop
        closeButtonAriaLabel="Close consent image"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={0}>
          {enlargedConsentMediaUrl ? (
            isConsentRecordVideoDescription(enlargedConsentDescription) ? (
              <Box
                component="video"
                src={enlargedConsentMediaUrl}
                controls
                autoPlay
                playsInline
                sx={{ width: '100%', maxHeight: '70vh' }}
              />
            ) : (
              <Box
                component="img"
                src={enlargedConsentMediaUrl}
                alt="Consent record image"
              />
            )
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={showWhyProvideAddressPopup}
        onClose={() => setShowWhyProvideAddressPopup(false)}
        closeOnBackdrop
        bodyTextAlignLeft
        centeredLeadLines={1}
        closeButtonAriaLabel="Close why provide address popup"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.Title>Why provide some address maybe handy...</ColorTemplate7PopupLargeDark.Title>
          <ColorTemplate7PopupLargeDark.BodyText>
            To help someone special brighten your day, please share a mailing name and address where you&apos;d love to receive a delivery. Whether
            it&apos;s your home or a favorite local pickup spot, this is just so our partner florists can find you.
          </ColorTemplate7PopupLargeDark.BodyText>
          <ColorTemplate7PopupLargeDark.BodyText>
            We take your privacy to heart your real identity and contact details stay tucked away safely with us and are never shared with other
            members. When a gift is on its way, the flower shop only gets the delivery info they need to make the magic happen. You&apos;ll always see
            who sent the gift, and if you aren&apos;t ready for surprises just yet, you can opt out-we&apos;ll still let you know if someone actually try to
            send you flowers/gift later!
          </ColorTemplate7PopupLargeDark.BodyText>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={accountChangeCooldownOpen}
        onClose={() => setAccountChangeCooldownOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close security notice"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.Title>For security</ColorTemplate7PopupLargeDark.Title>
          <ColorTemplate7PopupLargeDark.BodyText>{accountChangeCooldownMessage}</ColorTemplate7PopupLargeDark.BodyText>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={showNicknameAliasPopup}
        onClose={() => setShowNicknameAliasPopup(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close nickname popup"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.Title>Your profile, your privacy! 💖</ColorTemplate7PopupLargeDark.Title>
          <ColorTemplate7PopupLargeDark.BodyText>
            Swap out that clunky member number for a cute nickname or alias! We love keeping our community safe, so while we carefully verify
            everyone&apos;s photos and background info, we keep your personal data (name, email, phone, address) strictly under wraps, never reveal. We
            leave it entirely up to you to share your real name when you&apos;re ready, or simply enjoy chatting behind your alias.
          </ColorTemplate7PopupLargeDark.BodyText>
          <ColorTemplate7PopupLargeDark.BodyText>Happy connecting!</ColorTemplate7PopupLargeDark.BodyText>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </MainCard>
    </>
  );
}

ProfilesRecordsPage.propTypes = {
  /** Null = all /profileRecords tabs; TutaNotes passes the shared three Payment tabs. */
  visibleTabs: PropTypes.arrayOf(PropTypes.string),
  /** Embedded TutaNotes / TutaPhotoAlbums view — omits member banner and Change profile photo. */
  embedded: PropTypes.bool,
  /** Embedded callers can open directly on one of the shared tabs. */
  initialTab: PropTypes.oneOf(PROFILES_RECORDS_OPEN_TABS),
  initialTokensBuying: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Vault Profile & Records overlay: close after a successful Save Fields. */
  onProfileSaved: PropTypes.func,
  /** Close overlay / navigate back to myNote, myPhotoAlbums, allSingles, etc. */
  onReturn: PropTypes.func
};
