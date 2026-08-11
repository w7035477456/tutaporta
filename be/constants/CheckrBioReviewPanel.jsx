import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate1Button from 'ui-component/ColorTemplate1Button';
import PillTemplate from 'ui-component/PillTemplate';
import GreenButton from 'ui-component/GreenButton';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS,
  COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR
} from 'ui-component/ColorTemplate9TableData';
import {
  COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_COLOR,
  COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_FONT_FAMILY,
  COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_HOVER_COLOR,
  colorTemplate3PopupLegendNumberInteractiveSx,
  colorTemplate3PopupLegendNumberSx
} from 'config/colorTemplate3Popup';
import {
  COLOR_TEMPLATE1_BG_SELECTED,
  COLOR_TEMPLATE1_BG_UNSELECTED,
  COLOR_TEMPLATE1_TEXT_SELECTED,
  COLOR_TEMPLATE1_TEXT_UNSELECTED,
  colorTemplate1ButtonSx
} from 'config/colorTemplate1';
import api from 'api/axios';
import { useAuth } from 'contexts/AuthContext';
import { postSaveConsentRecord } from 'api/consentRecordFe';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import {
  CONSENT_DESCRIPTION_CHECKR_CHECK,
  CONSENT_WATERMARK_VARIANTS
} from 'constants/consentRecordVariants';
import VerificationAuthorizationDialog from './VerificationAuthorizationDialog';
import { buttonFontSizeHalfResponsive, buttonFontSizeResponsive, buttonTemplateFontSizeSx } from 'config/buttonFontEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { formatAliasWithMemberCode } from 'utils/memberLabel';
import {
  formatCapitalizedFullName,
  FULLNAME_MIDDLE_MAX_LENGTH
} from 'utils/fullNameFormat';
import {
  calcBriefBioMatchPercentFromBioReview,
  calcFullBioMatchPercentFromBioReview
} from 'utils/receivedBioRequestDisplay';
import {
  shouldShowVettedNote,
  vettingStatusCompactLabel,
  vettingStatusDotSx,
  VETTING_STATUS_DOT_SIZE_PX,
  cycleVettingStatus,
  normalizeVettingStatusKey
} from 'utils/vettingStatusDisplay';
import { isDemoUserCategory } from 'utils/memberCategory';
import { getBioReviewRowVetColumn } from 'utils/receivedBioRequestDisplay';
import { themedAlert } from 'utils/themedDialog';

const DEMO_USER_MATCHING_STATUS_COMPLETED_LINES = ['Completed', '(DemoUser)'];
const DEMO_USER_MATCHING_STATUS_NOT_STARTED_LINES = ['Not Started', '(DemoUser)'];
/** Profile&DL / Profile&Live — DemoUser shows Not Started instead of Completed. */
const DEMO_USER_PROFILE_PHOTO_MATCH_KEYS = new Set(['profileDlPhoto', 'profileLivePhoto']);
const DEMO_USER_MATCHING_STATUS_COMPLETED_DOT_SX = {
  bgcolor: '#2e7d32',
  border: '6px solid #1b5e20'
};
const DEMO_USER_MATCHING_STATUS_NOT_STARTED_DOT_SX = {
  bgcolor: '#ffffff',
  border: '6px solid #9e9e9e'
};

const MASKED_HAS_DATA_LABEL = 'Locked';
const MASKED_EMPTY_LABEL = 'Empty, not filled out';
const MASKED_RESPONSE_RED_BG = '#c62828';
const MASKED_RESPONSE_BLUE_BG = '#1565c0';
function rowHasPreviewData(row) {
  if (!row) return false;
  if (typeof row.hasData === 'boolean') return row.hasData;
  if (row.responseType === 'profilePhoto' || row.responseType === 'profileMatchPair') {
    const id = Number(row.response);
    return Number.isFinite(id) && id > 0;
  }
  return displayResponse(row.response) !== '';
}

function MaskedResponseCell({ row, sectionKey }) {
  if (!rowHasPreviewData(row)) {
    return (
      <Typography sx={{ ...tableTextSx, fontStyle: 'italic', color: BIO_TABLE_BODY_TEXT_COLOR }}>{MASKED_EMPTY_LABEL}</Typography>
    );
  }
  const useBlueMask = sectionKey === 'miscBio' && !getBioReviewRowVetColumn(row);
  return (
    <PillTemplate
      component="span"
      disableRipple
      tabIndex={-1}
      hoverScale={1}
      templateBg={useBlueMask ? MASKED_RESPONSE_BLUE_BG : MASKED_RESPONSE_RED_BG}
      templateText="#ffffff"
      templateBorder="2px solid #000000"
      sx={{
        alignSelf: 'flex-start',
        fontWeight: 700,
        boxShadow: 'none',
        cursor: 'default',
        pointerEvents: 'none'
      }}
    >
      <PillTemplate.Label>{MASKED_HAS_DATA_LABEL}</PillTemplate.Label>
    </PillTemplate>
  );
}
import { updateVetBioMatchingStatus } from 'api/vetBioFe';
import { toDisplayVettedDate } from './verifySelfVettedDate';
import { useUserTimeZoneProfile } from 'hooks/useUserTimeZoneProfile';
import { formatUserDateTime } from 'utils/userTimeZone';
import { captureElementAsPng } from 'utils/captureConsentDialogImage';
import { combineImagesSideBySide } from 'utils/combineImagesSideBySide';
import { sampleDriverLicenseUrl, sampleUSPassportUrl } from 'constants/idVerificationSampleImages';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { saveCheckrBioReviewDraft, saveCheckrBioReviewField } from 'api/checkrBioReviewFe';
import { hoverEnlargeBaseSx } from 'config/hoverEnlargeEnv';
import { canPerFieldEditRow, fieldWasVerified, getDraftKeyForBioRow } from 'utils/bioReviewPerFieldEdit';
import { openLinkedInProfileWindow } from 'utils/linkedinOAuth';
import BioFieldEditDialog from './BioFieldEditDialog';

const LEGEND_POPUP_ITEMS = [
  {
    note: 1,
    boldPrefix: 'Internal Vetting Only:',
    body: ' These fields are used solely for background screening and search functionality. They are strictly confidential and will never be shown to other members. Other members will only see your alias or member number.'
  },
  {
    note: 2,
    boldPrefix: 'Brief Info:',
    body: ' If you choose "Approve Brief Info" for another member, they will see these fields and their verification statuses exactly as displayed in these two columns.'
  },
  {
    note: 3,
    boldPrefix: 'Full Bio:',
    body: ' If you choose "Approve Full-Bio" for another member, they will see these fields and their verification statuses exactly as displayed here.'
  },
  {
    note: 4,
    boldPrefix: 'Verified Data:',
    body: ' The information in these fields report it matches (or not matches) the third-party verification data provided on the date shown.'
  },
  {
    note: 5,
    boldPrefix: 'Self-Reported Info:',
    body: ' Responses in these fields cannot be officially verified, but they provide helpful context to share with others.'
  }
];

const BRIEF_BIO_LEGEND = { firstname: 1, age: 2 };
const LEGAL_NAME_FIELD_KEYS = new Set(['firstname', 'middlename', 'lastname']);
const PASSPORT_CITIZENSHIP_FIELD_KEYS = new Set(['citizenship', 'placeOfBirth', 'profilePpPhoto', 'passportGovId']);
const PROFILE_MATCH_PAIR_BRIEF_KEYS = new Set(['profileDlPhoto', 'profileLivePhoto']);
const OPTIONAL_PASSPORT_SECTION_BANNER = 'Beside below Passport info (citizenship, and POB), for security, Full Bio (Buddies Bio) any other passport informations or passport ID on this server';
const LEGAL_NAME_TABLE_BANNER = 'We never ever reveal your real name to members';
const LEGAL_NAME_TABLE_BORDER = '16px solid #c62828';

function expandBriefBioRows(rows) {
  return rows.map((row) => ({ ...row, legendNote: BRIEF_BIO_LEGEND[row.key] ?? null }));
}
const LEGEND_BADGE_FONT_SIZE = '2.1rem'; // 3× previous 0.7rem
const DATA_MATCHED_DISCLAIMER_WEBSITE_NAME = 'OnlineMall.Website';

const tableTextSx = { fontSize: { xs: '0.85rem', sm: getDesktopTextFontSizeVw() } };
/** LinkedIn profile URL — 50% of MOBILE_/DESKTOP_FONT_SIZE_BUTTON, single line. */
const linkedInUrlDisplaySx = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: buttonFontSizeHalfResponsive,
  lineHeight: 1.2,
  display: 'block',
  maxWidth: '100%'
};
/** View LinkedIn — MOBILE_/DESKTOP_FONT_SIZE_BUTTON (same as Edit buttons). */
const viewLinkedInButtonSx = {
  ...buttonTemplateFontSizeSx(),
  lineHeight: 1.2,
  py: { xs: 0.35, sm: 0.5 },
  px: { xs: 1, sm: 1.25 },
  minHeight: 'auto'
};
/** Zebra rows follow theme daynight / daynight2; body copy matches ColorTemplate9TableData. */
const BIO_TABLE_ROW_BG_EVEN = 'var(--theme-daynight-color)';
const BIO_TABLE_ROW_BG_ODD = 'var(--theme-daynight2-color, var(--theme-inverse-daynight-color))';
/** All table body data cells — same token as ColorTemplate9 alternate-row content. */
const BIO_TABLE_BODY_TEXT_COLOR = COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR;
/** Match Date column — always theme inverse-daynight (not row-default daynight). */
const BIO_TABLE_MATCH_DATE_TEXT_COLOR = COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR;
const bioTableMatchDateCellSx = {
  color: `${BIO_TABLE_MATCH_DATE_TEXT_COLOR} !important`,
  WebkitTextFillColor: `${BIO_TABLE_MATCH_DATE_TEXT_COLOR} !important`
};
const checkrSolidBlackBorderSx = {
  border: '1px solid #000000',
  '@media (hover: hover)': {
    '&:hover': { border: '1px solid #000000' }
  }
};
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import {
  BIO_TABLE_COL_WIDTHS,
  BIO_TABLE_COL_WIDTHS_MISC_ONLY,
  BIO_TABLE_COL_WIDTHS_MISC_ONLY_MOBILE,
  BIO_TABLE_COL_WIDTHS_MOBILE,
  BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE,
  BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE_MOBILE
} from 'utils/checkrBioTableLayout';
const editColumnCellSx = {
  textAlign: 'center',
  verticalAlign: 'middle',
  px: { xs: 0.25, sm: 0.5 },
  minWidth: { xs: 56, sm: 0 }
};
const tableSx = {
  tableLayout: 'fixed',
  width: '100%',
  minWidth: { xs: 0, sm: 720 },
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': tableTextSx,
  '& .MuiTableCell-head.checkr-bio-table-header-cell': {
    ...tableTextSx,
    fontWeight: 700,
    bgcolor: `${COLOR_TEMPLATE1_BG_SELECTED} !important`,
    color: `${COLOR_TEMPLATE1_TEXT_SELECTED} !important`,
    border: 'none'
  },
  '& .MuiTableCell-head.checkr-bio-table-header-cell .MuiTypography-root': {
    color: `${COLOR_TEMPLATE1_TEXT_SELECTED} !important`
  },
  '& .checkr-vetting-status-cell': { whiteSpace: 'nowrap' },
  '& .MuiTableBody-root .MuiTableCell-root.checkr-bio-match-date-cell': bioTableMatchDateCellSx,
  '& .MuiTableBody-root .MuiTableCell-root': { color: BIO_TABLE_BODY_TEXT_COLOR },
  [`& .MuiTableBody-root .MuiTableCell-root.${COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS}`]: {
    color: `${COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR} !important`
  },
  [`& .MuiTableBody-root .MuiTableCell-root.${COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS} .MuiTypography-root`]: {
    color: `${COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR} !important`
  },
  [`& .MuiTableBody-root .MuiTableCell-root.${COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS} .MuiInputBase-input`]: {
    color: `${COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR} !important`
  },
  [`& .MuiTableBody-root .MuiTableCell-root.${COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS} .MuiInputBase-root`]: {
    color: COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR
  },
  '& .MuiTableBody-root .MuiTableCell-root.checkr-info-label-cell': {
    bgcolor: COLOR_TEMPLATE1_BG_SELECTED,
    color: COLOR_TEMPLATE1_TEXT_SELECTED
  },
  '& .MuiTableBody-root .MuiTypography-root': { color: BIO_TABLE_BODY_TEXT_COLOR },
  '& .MuiTableBody-root .checkr-info-label-cell .MuiTypography-root': {
    color: `${COLOR_TEMPLATE1_TEXT_SELECTED} !important`
  },
  '& .MuiTableBody-root .MuiInputBase-input': { color: BIO_TABLE_BODY_TEXT_COLOR },
  '& .MuiTableBody-root .MuiInputBase-root': { color: BIO_TABLE_BODY_TEXT_COLOR }
};

function BioTableColGroup({ widths = BIO_TABLE_COL_WIDTHS }) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={index} style={{ width }} />
      ))}
    </colgroup>
  );
}
const vettedBioTableContainerSx = {
  boxShadow: 'none',
  border: '3px double #000',
  borderRadius: 0
};
const legalNameBioTableContainerSx = {
  boxShadow: 'none',
  border: LEGAL_NAME_TABLE_BORDER,
  borderRadius: 0,
  mb: 2
};
const legalNameBannerBoxSx = {
  display: 'inline-block',
  bgcolor: '#000000',
  px: 1.25,
  py: 0.5,
  mb: 0.75,
  borderRadius: 0.5
};
const legalNameBannerTextSx = {
  color: 'var(--theme-error-color) !important',
  WebkitTextFillColor: 'var(--theme-error-color) !important',
  fontWeight: 700,
  ...tableTextSx
};
const bioReviewPanelBgSx = {
  bgcolor: COLOR_TEMPLATE1_BG_UNSELECTED
};

function bioTableRowBg(rowIndex) {
  return rowIndex % 2 === 0 ? BIO_TABLE_ROW_BG_EVEN : BIO_TABLE_ROW_BG_ODD;
}

function bioTableBodyCellSx(rowIndex) {
  return {
    bgcolor: bioTableRowBg(rowIndex),
    color: COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR
  };
}

function bioTableBodyCellClassName() {
  return COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS;
}

function bioTableCellClassName(existingClass) {
  const alternateClass = bioTableBodyCellClassName();
  return [existingClass, alternateClass].filter(Boolean).join(' ') || undefined;
}

const infoColumnCellSx = { textAlign: 'right', verticalAlign: 'top' };
/** Information column row labels — same colors as ColorTemplate1Button selected. */
const infoColumnLabelCellSx = {
  ...infoColumnCellSx,
  bgcolor: COLOR_TEMPLATE1_BG_SELECTED,
  color: COLOR_TEMPLATE1_TEXT_SELECTED,
  fontWeight: 600
};
const responseColumnCellSx = { textAlign: 'left' };
/** Table header row — same colors as ColorTemplate1Button selected. */
const bioTableHeaderCellSx = {
  ...colorTemplate1ButtonSx({ selected: true }),
  border: 'none',
  fontWeight: 700,
  ...tableTextSx
};
const bioSectionTitleBarSx = {
  display: 'inline-flex',
  alignItems: 'center',
  width: { xs: '100%', sm: 'auto' },
  boxSizing: 'border-box',
  px: 1.25,
  py: 0.5,
  borderRadius: { xs: 0, sm: 1 },
  bgcolor: COLOR_TEMPLATE1_BG_UNSELECTED
};

function displayResponse(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  return String(value);
}

function buildDraftValues(bioReview) {
  if (!bioReview) return {};
  const draft = {};
  (bioReview.briefBio || []).forEach((row) => {
    draft[`briefBio.${row.key}`] = displayResponse(row.response);
  });
  (bioReview.fullBio || []).forEach((row) => {
    draft[`fullBio.${row.key}`] = displayResponse(row.response);
  });
  (bioReview.miscBio || []).forEach((row) => {
    draft[`miscBio.${row.key}`] = displayResponse(row.response);
  });
  return draft;
}

function actionButtonSx() {
  return {
    textTransform: 'none',
    fontSize: buttonFontSizeResponsive,
    px: 2.5,
    py: 0.75,
    ...checkrSolidBlackBorderSx
  };
}

function FieldEditButton({ onClick, disabled }) {
  return (
    <GreenButton onClick={onClick} disabled={disabled}>
      Edit
    </GreenButton>
  );
}

function formatSubmittedAt(date, userTimeZoneProfile) {
  return formatUserDateTime(date, userTimeZoneProfile);
}

function DataMatchedSuperscript({ onClick }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label="Data matched disclaimer"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      sx={{
        color: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_COLOR,
        fontFamily: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_FONT_FAMILY,
        fontStyle: 'italic',
        fontWeight: 700,
        fontSize: '1.44em',
        lineHeight: 1,
        position: 'relative',
        top: '-0.35em',
        ml: '0.08em',
        display: 'inline',
        verticalAlign: 'baseline',
        m: 0,
        p: 0,
        minWidth: 0,
        border: 'none',
        bgcolor: 'transparent',
        cursor: 'pointer',
        transform: 'scale(1)',
        transformOrigin: 'left bottom',
        transition: 'transform 0.15s ease, color 0.15s ease',
        '@media (hover: hover)': {
          '&:hover': {
            transform: 'scale(1.5)',
            color: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_HOVER_COLOR
          }
        }
      }}
    >
      4
    </Box>
  );
}

function DataMatchedDisclaimerPopup({ open, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close data disclaimer"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Data Disclaimer</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          {`A green dotted circle and 'Data Matched' status next to a member's profile indicates that the profile details provided by ` +
            `this member programmatically correspond with records returned via several third-party verification services at the time of check. ` +
            `Matches are dependent on third-party data availability and accuracy. ${DATA_MATCHED_DISCLAIMER_WEBSITE_NAME} does not independently ` +
            `investigate, warrant, or guarantee the absolute accuracy of self-reported user details or background check contents. ` +
            `Use standard safety precautions when meeting platform members.`}
        </ColorTemplate7PopupLargeDark.BodyText>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

function VettingStatusPill({
  status,
  clickable = false,
  onClick,
  saving = false,
  onDataMatchedDisclaimerClick = null,
  title = null,
  forcedLabel = null
}) {
  const forcedLines = Array.isArray(forcedLabel)
    ? forcedLabel.map((line) => String(line ?? '').trim()).filter(Boolean)
    : null;
  const label = saving
    ? 'Saving…'
    : forcedLines
      ? null
      : forcedLabel != null
        ? forcedLabel
        : vettingStatusCompactLabel(status);
  const demoForcedNotStarted =
    forcedLines != null && String(forcedLines[0] ?? '').toLowerCase() === 'not started';
  const dotSx =
    forcedLabel != null
      ? demoForcedNotStarted
        ? DEMO_USER_MATCHING_STATUS_NOT_STARTED_DOT_SX
        : DEMO_USER_MATCHING_STATUS_COMPLETED_DOT_SX
      : vettingStatusDotSx(status);
  const interactive = clickable && !saving && forcedLabel == null;
  const showDataMatchedSuperscript =
    !saving &&
    forcedLabel == null &&
    normalizeVettingStatusKey(status) === 'info_matches' &&
    typeof onDataMatchedDisclaimerClick === 'function';

  return (
    <Box
      component={interactive ? 'button' : 'span'}
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      title={interactive ? title : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: forcedLines ? 'flex-start' : 'center',
        gap: 0.75,
        border: 'none',
        bgcolor: 'transparent',
        p: 0,
        m: 0,
        font: 'inherit',
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        ...(interactive
          ? {
              '&:hover .vetting-status-dot': { filter: 'brightness(0.92)' },
              '&:hover .vetting-status-label': { textDecoration: 'underline' }
            }
          : null)
      }}
    >
      <Box
        className="vetting-status-dot"
        aria-hidden
        sx={{
          width: VETTING_STATUS_DOT_SIZE_PX,
          height: VETTING_STATUS_DOT_SIZE_PX,
          borderRadius: '50%',
          flexShrink: 0,
          boxSizing: 'border-box',
          ...(forcedLines ? { mt: '0.1em' } : null),
          ...dotSx
        }}
      />
      {forcedLines ? (
        <Box
          className="vetting-status-label"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            lineHeight: 1.15,
            minWidth: 0
          }}
        >
          {forcedLines.map((line) => (
            <Typography
              key={line}
              component="span"
              sx={{
                ...tableTextSx,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color: 'inherit',
                lineHeight: 1.15
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      ) : (
        <Typography
          className="vetting-status-label"
          component="span"
          sx={{
            ...tableTextSx,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            color: 'inherit'
          }}
        >
          {label}
          {showDataMatchedSuperscript ? <DataMatchedSuperscript onClick={onDataMatchedDisclaimerClick} /> : null}
        </Typography>
      )}
    </Box>
  );
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function ProfilePhotoMatchLabel({ label, percent, color }) {
  if (percent == null) return null;
  return (
    <Typography sx={{ ...tableTextSx, fontWeight: 700, color, lineHeight: 1.2 }}>
      {label}:{percent}%
    </Typography>
  );
}

const PROFILE_MATCH_LABEL_COLORS = {
  dl: '#d32f2f',
  pp: '#1565c0',
  live: '#43a047'
};

const PROFILE_MATCH_COMPARISON_URLS = {
  driver_license: sampleDriverLicenseUrl,
  passport: sampleUSPassportUrl
};

const profileMatchThumbSx = {
  width: { xs: 56, sm: 72 },
  height: { xs: 56, sm: 72 },
  objectFit: 'cover',
  border: '1px solid #000',
  borderRadius: 1,
  display: 'block',
  flexShrink: 0
};

function useMemberPhotoDataUrl({
  photosId,
  singlesId,
  isOwnProfile,
  profileImageFk,
  profilePhotoCacheBust,
  enabled = true
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl('');
    setLoadFailed(false);
    setLoading(false);

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    const id = Number(photosId);
    let url = '';
    if (Number.isFinite(id) && id > 0) {
      url = `${getApiBaseUrl()}/api/photo/${id}?v=${profilePhotoCacheBust}`;
    } else if (isOwnProfile) {
      const profileId = Number(profileImageFk);
      if (Number.isFinite(profileId) && profileId > 0) {
        url = `${getApiBaseUrl()}/api/photo/${profileId}?v=${profilePhotoCacheBust}`;
      }
    } else if (Number.isFinite(singlesId) && singlesId > 0) {
      url = `${getApiBaseUrl()}/api/profile-photo/${singlesId}?v=${profilePhotoCacheBust}`;
    }

    if (!url) {
      setLoadFailed(true);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    fetch(url, { credentials: 'include', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Photo failed (${response.status})`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .then((nextUrl) => {
        if (!cancelled) setDataUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [photosId, singlesId, isOwnProfile, profileImageFk, profilePhotoCacheBust, enabled]);

  return { dataUrl, loadFailed, loading };
}

function ProfileMatchPairResponse({ row }) {
  const singlesId = row?.singlesId;
  const { user, profilePhotoCacheBust } = useAuth();
  const authSinglesId = Number(user?.singles_id);
  const targetSinglesId = Number(singlesId);
  const isOwnProfile = Number.isFinite(authSinglesId) && authSinglesId === targetSinglesId;
  const matchLabel = row?.matchLabel || 'MATCH';
  const matchPercent = row?.matchPercent;
  const matchKind = row?.matchKind || 'dl';
  const comparisonImageKind = row?.comparisonImageKind || 'driver_license';
  const comparisonPhotosId =
    row?.comparisonImagePhotosId ??
    (comparisonImageKind === 'profile' ? row?.response : null);
  const useStoredComparisonPhoto = Number(comparisonPhotosId) > 0;

  const {
    dataUrl: leftPhotoDataUrl,
    loadFailed: leftLoadFailed,
    loading: leftLoading
  } = useMemberPhotoDataUrl({
    photosId: row?.primaryImagePhotosId,
    singlesId: targetSinglesId,
    isOwnProfile,
    profileImageFk: user?.profile_image_fk,
    profilePhotoCacheBust
  });

  const {
    dataUrl: rightPhotoDataUrl,
    loadFailed: rightLoadFailed,
    loading: rightLoading
  } = useMemberPhotoDataUrl({
    photosId: comparisonPhotosId,
    singlesId: targetSinglesId,
    isOwnProfile,
    profileImageFk: user?.profile_image_fk,
    profilePhotoCacheBust,
    enabled: useStoredComparisonPhoto
  });

  const showSampleComparison = !useStoredComparisonPhoto && matchPercent == null;
  const rightPhotoSrc = useStoredComparisonPhoto
    ? rightPhotoDataUrl
    : showSampleComparison
      ? PROFILE_MATCH_COMPARISON_URLS[comparisonImageKind] || ''
      : '';

  const leftAlt = matchKind === 'live' ? 'Live face scan' : 'Profile';
  const rightAlt =
    comparisonImageKind === 'profile'
      ? 'Profile'
      : comparisonImageKind === 'passport'
        ? useStoredComparisonPhoto
          ? 'Passport face'
          : 'Passport'
        : useStoredComparisonPhoto
          ? 'Driver license face'
          : 'Driver license';

  if (leftLoading || (useStoredComparisonPhoto && rightLoading)) {
    return (
      <Typography sx={{ ...tableTextSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        Loading photos...
      </Typography>
    );
  }

  if (!leftPhotoDataUrl) {
    return (
      <Typography sx={{ ...tableTextSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {leftLoadFailed
          ? matchKind === 'live'
            ? 'No live scan photo'
            : 'No profile photo'
          : 'Loading photos...'}
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      <Box component="img" src={leftPhotoDataUrl} alt={leftAlt} sx={profileMatchThumbSx} />
      {rightPhotoSrc ? (
        <Box component="img" src={rightPhotoSrc} alt={rightAlt} sx={profileMatchThumbSx} />
      ) : useStoredComparisonPhoto && rightLoadFailed ? (
        <Typography sx={{ ...tableTextSx }}>
          {comparisonImageKind === 'passport' ? 'No passport face photo' : 'No driver license face photo'}
        </Typography>
      ) : !showSampleComparison && !rightPhotoSrc ? (
        <Typography sx={{ ...tableTextSx }}>
          {comparisonImageKind === 'passport' ? 'No passport face photo' : 'No driver license face photo'}
        </Typography>
      ) : comparisonImageKind === 'profile' && rightLoadFailed ? (
        <Typography sx={{ ...tableTextSx }}>No profile photo</Typography>
      ) : null}
      <ProfilePhotoMatchLabel
        label={matchLabel}
        percent={matchPercent}
        color={PROFILE_MATCH_LABEL_COLORS[matchKind] || PROFILE_MATCH_LABEL_COLORS.dl}
      />
    </Stack>
  );
}

function ProfilePhotoResponse({ row }) {
  const singlesId = row?.singlesId;
  const percents = row?.profileMatchPercents ?? {};
  const { user, profilePhotoCacheBust } = useAuth();
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const authSinglesId = Number(user?.singles_id);
  const targetSinglesId = Number(singlesId);
  const isOwnProfile = Number.isFinite(authSinglesId) && authSinglesId === targetSinglesId;

  const profilePhotoUrl = useMemo(() => {
    if (isOwnProfile) {
      const photoId = Number(user?.profile_image_fk);
      if (Number.isFinite(photoId) && photoId > 0) {
        return `${getApiBaseUrl()}/api/photo/${photoId}?v=${profilePhotoCacheBust}`;
      }
    }
    if (Number.isFinite(targetSinglesId) && targetSinglesId > 0) {
      return `${getApiBaseUrl()}/api/profile-photo/${targetSinglesId}?v=${profilePhotoCacheBust}`;
    }
    return '';
  }, [isOwnProfile, user?.profile_image_fk, targetSinglesId, profilePhotoCacheBust]);

  useEffect(() => {
    let cancelled = false;
    setPhotoDataUrl('');
    setLoadFailed(false);

    if (!profilePhotoUrl) {
      setLoadFailed(true);
      return () => {
        cancelled = true;
      };
    }

    fetch(profilePhotoUrl, { credentials: 'include', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Profile photo failed (${response.status})`);
        return response.blob();
      })
      .then(blobToDataUrl)
      .then((dataUrl) => {
        if (!cancelled) setPhotoDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [profilePhotoUrl]);

  if (!photoDataUrl) {
    return (
      <Typography sx={{ ...tableTextSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {loadFailed ? 'No profile photo' : 'Loading profile photo...'}
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      <Box
        component="img"
        src={photoDataUrl}
        alt="Profile"
        sx={{
          width: { xs: 56, sm: 72 },
          height: { xs: 56, sm: 72 },
          objectFit: 'cover',
          border: '1px solid #000',
          borderRadius: 1,
          display: 'block',
          flexShrink: 0
        }}
      />
      <Stack spacing={0.15} sx={{ minWidth: 0 }}>
        <ProfilePhotoMatchLabel label="DL" percent={percents.dl} color="#d32f2f" />
        <ProfilePhotoMatchLabel label="PP" percent={percents.pp} color="#1565c0" />
        <ProfilePhotoMatchLabel label="LIVE" percent={percents.live} color="#43a047" />
      </Stack>
    </Stack>
  );
}

function ResponseField({ row, editable, value, onChange, inputProps }) {
  const currentValue = value ?? displayResponse(row.response);
  if (row.responseType === 'profileMatchPair') {
    return <ProfileMatchPairResponse row={row} />;
  }
  if (row.responseType === 'profilePhoto') {
    return <ProfilePhotoResponse row={row} />;
  }

  if (!editable) {
    const readOnlyTextSx =
      row.key === 'linkedin_url' ? linkedInUrlDisplaySx : { ...tableTextSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
    return <Typography sx={readOnlyTextSx}>{displayResponse(currentValue)}</Typography>;
  }

  if (row.responseType === 'radio') {
    return (
      <RadioGroup
        row
        value={currentValue}
        onChange={(event) => onChange?.(event.target.value)}
        sx={{
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 0.75,
          '& .MuiFormControlLabel-root': { m: 0, mr: 1 },
          '& .MuiFormControlLabel-label': { ...tableTextSx, color: BIO_TABLE_BODY_TEXT_COLOR, lineHeight: 1.1 },
          '& .MuiRadio-root': { p: 0.25 }
        }}
      >
        {(row.responseOptions || []).map((opt) => (
          <FormControlLabel key={opt} value={opt} control={<Radio size="small" />} label={opt} />
        ))}
      </RadioGroup>
    );
  }

  if (row.responseType === 'select') {
    return (
      <TextField
        select
        size="small"
        fullWidth
        value={currentValue}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Select an item"
        sx={{ '& .MuiInputBase-root': tableTextSx }}
      >
        <MenuItem value="">
          <em>Select an item</em>
        </MenuItem>
        {(row.responseOptions || []).map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <TextField
      size="small"
      fullWidth
      value={currentValue}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder=""
      inputProps={inputProps}
      sx={{ '& .MuiInputBase-root': tableTextSx }}
    />
  );
}

function LegendBadge({ note, activeNote, onSelect }) {
  if (!note) return null;
  const isActive = activeNote === note;

  return (
    <Box
      component="button"
      type="button"
      aria-label={`Legend note ${note}`}
      aria-pressed={isActive}
      onClick={() => onSelect(isActive ? null : note)}
      sx={{
        ...colorTemplate3PopupLegendNumberInteractiveSx(LEGEND_BADGE_FONT_SIZE),
        display: 'inline',
        verticalAlign: 'baseline',
        m: 0,
        ml: '0.08em',
        p: 0,
        minWidth: 0,
        border: 'none',
        bgcolor: 'transparent',
        whiteSpace: 'nowrap'
      }}
    >
      {note}
    </Box>
  );
}

function LabelWithLegendBadge({ label, note, activeNote, onLegendSelect }) {
  if (!note) return label;
  return (
    <Box component="span" sx={{ display: 'inline', lineHeight: 1.35, whiteSpace: 'normal' }}>
      {label}
      <LegendBadge note={note} activeNote={activeNote} onSelect={onLegendSelect} />
    </Box>
  );
}

function LegendPopup({ highlightedNote, onClose }) {
  const popupNumberSx = colorTemplate3PopupLegendNumberSx(LEGEND_BADGE_FONT_SIZE);

  return (
    <ColorTemplate7PopupLargeDark
      open={Boolean(highlightedNote)}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close legend"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        {LEGEND_POPUP_ITEMS.map(({ note, boldPrefix, body }) => (
          <Box key={note} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
            <Typography component="span" className="color-template3-legend-number" sx={popupNumberSx}>
              {note}
            </Typography>
            <ColorTemplate7PopupLargeDark.BodyText>
              <Box component="span" sx={{ fontWeight: 700 }}>
                {boldPrefix}
              </Box>
              {body}
            </ColorTemplate7PopupLargeDark.BodyText>
          </Box>
        ))}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

function BioSectionTitle({ title, member, matchPercent = null }) {
  const subjectLabel = formatAliasWithMemberCode({
    alias: member?.alias ?? member?.displayName,
    prefix: member?.prefix,
    memberId: member?.memberId
  });
  const showMatchPercent = matchPercent !== null && matchPercent !== undefined;
  return (
    <Box
      sx={{
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        flexWrap: 'wrap'
      }}
    >
      <Box sx={bioSectionTitleBarSx}>
        <Typography sx={{ fontWeight: 700, color: COLOR_TEMPLATE1_TEXT_UNSELECTED, ...tableTextSx }}>
          {title} of {subjectLabel}
        </Typography>
      </Box>
      {showMatchPercent ? (
        <Typography sx={{ fontWeight: 700, color: COLOR_TEMPLATE1_TEXT_UNSELECTED, whiteSpace: 'nowrap', ...tableTextSx }}>
          {`Matching ${matchPercent}%`}
        </Typography>
      ) : null}
    </Box>
  );
}

function OptionalPassportCitizenshipSectionTitle({ onUploadClick }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={bioSectionTitleBarSx}>
        <Typography sx={{ fontWeight: 700, color: COLOR_TEMPLATE1_TEXT_UNSELECTED, ...tableTextSx }}>
          Optional Passport Citizenship{' '}
          {onUploadClick ? (
            <Box
              component="button"
              type="button"
              onClick={onUploadClick}
              sx={{
                display: 'inline',
                p: 0,
                m: 0,
                border: 'none',
                bgcolor: 'transparent',
                color: 'var(--theme-primary-color)',
                WebkitTextFillColor: 'var(--theme-primary-color)',
                font: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                '&:hover': { opacity: 0.85 }
              }}
            >
              (click here to upload optional/voluntary Passport info)
            </Box>
          ) : (
            '(optional)'
          )}
        </Typography>
      </Box>
    </Box>
  );
}

function VettedBioTable({
  rows,
  activeNote,
  onLegendSelect,
  editable,
  draftValues,
  onDraftChange,
  sectionKey,
  insertBeforeKey = null,
  renderInsertBefore = null,
  adminCanEditStatus = false,
  memberSinglesId = null,
  statusOverrides = {},
  savingStatusKey = null,
  onCycleVettingStatus = null,
  showMatchNoteColumn = true,
  showPerFieldEdit = false,
  onFieldEdit = null,
  onProfilePhotoEdit = null,
  onDataMatchedDisclaimerClick = null,
  legalNameTable = false,
  viewerMaskPending = false,
  suppressEditActions = false,
  userTimeZoneProfile = null,
  demoUserMatchingStatus = false
}) {
  const bioTableMobileLayout = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const colWidths = bioTableMobileLayout
    ? showMatchNoteColumn
      ? BIO_TABLE_COL_WIDTHS_MOBILE
      : BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE_MOBILE
    : showMatchNoteColumn
      ? BIO_TABLE_COL_WIDTHS
      : BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE;

  const renderStatusPill = (row) => {
    const overrideKey = row.key;
    const status = statusOverrides[overrideKey] ?? row.verificationStatus;
    const vetColumn = getBioReviewRowVetColumn(row);
    const clickable = Boolean(
      !demoUserMatchingStatus && adminCanEditStatus && vetColumn && memberSinglesId && onCycleVettingStatus
    );
    const saving = savingStatusKey === overrideKey;
    return (
      <VettingStatusPill
        status={status}
        clickable={clickable}
        saving={saving}
        onClick={() => onCycleVettingStatus?.(row, status)}
        onDataMatchedDisclaimerClick={onDataMatchedDisclaimerClick}
        title={clickable ? 'Admin: click to cycle matching status' : undefined}
        forcedLabel={
          demoUserMatchingStatus
            ? DEMO_USER_PROFILE_PHOTO_MATCH_KEYS.has(row.key)
              ? DEMO_USER_MATCHING_STATUS_NOT_STARTED_LINES
              : DEMO_USER_MATCHING_STATUS_COMPLETED_LINES
            : null
        }
      />
    );
  };
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={legalNameTable ? legalNameBioTableContainerSx : vettedBioTableContainerSx}
    >
      <Table size="small" sx={tableSx}>
        <BioTableColGroup widths={colWidths} />
        <TableHead>
          <TableRow>
            <TableCell className="checkr-bio-table-header-cell" sx={{ ...bioTableHeaderCellSx, ...infoColumnCellSx }} aria-hidden />
            <TableCell className="checkr-bio-table-header-cell" sx={{ ...bioTableHeaderCellSx, ...editColumnCellSx }} aria-hidden />
            <TableCell className="checkr-bio-table-header-cell" sx={{ ...bioTableHeaderCellSx, ...responseColumnCellSx }}>
              Self-Report-Info
            </TableCell>
            <TableCell className="checkr-bio-table-header-cell checkr-vetting-status-cell" sx={bioTableHeaderCellSx}>
              Matching Status
            </TableCell>
            <TableCell className="checkr-bio-table-header-cell" sx={bioTableHeaderCellSx}>
              Match Date
            </TableCell>
            {showMatchNoteColumn ? (
              <TableCell className="checkr-bio-table-header-cell" sx={bioTableHeaderCellSx}>
                <Box component="span">
                  Match Note
                  <LegendBadge note={4} activeNote={activeNote} onSelect={onLegendSelect} />
                </Box>
              </TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => {
            const insertRow =
              insertBeforeKey && row.key === insertBeforeKey && typeof renderInsertBefore === 'function' ? (
                <TableRow key={`${sectionKey}-insert-before-${insertBeforeKey}`}>
                  <TableCell
                    colSpan={showMatchNoteColumn ? 6 : 5}
                    sx={{ py: 1.25, textAlign: 'center', bgcolor: BIO_TABLE_ROW_BG_EVEN }}
                  >
                    {renderInsertBefore()}
                  </TableCell>
                </TableRow>
              ) : null;
            const dateDisplay = toDisplayVettedDate(row.vettedDate, userTimeZoneProfile);
            const showDate = dateDisplay && dateDisplay !== 'Not Available';
            const showNote = shouldShowVettedNote(row.vettedNote);
            const draftKey = getDraftKeyForBioRow(row, sectionKey);
            const bodyCellSx = bioTableBodyCellSx(rowIndex);
            const fieldEditable = canPerFieldEditRow(row, sectionKey);
            const govIdField = row.key === 'govId' || row.key === 'passportGovId';
            const openFieldEdit = () =>
              onFieldEdit?.({
                row,
                sectionKey,
                draftKey,
                fieldLabel: row.label,
                initialValue: draftValues[draftKey] ?? displayResponse(row.response)
              });
            const showProfilePhotoEdit =
              !suppressEditActions &&
              !viewerMaskPending &&
              showPerFieldEdit &&
              sectionKey === 'briefBio' &&
              row.key === 'profileDlPhoto' &&
              typeof onProfilePhotoEdit === 'function';
            const hideVettingColumns = Boolean(row.hideVettingColumns);
            const showEdit =
              !suppressEditActions &&
              !viewerMaskPending &&
              showPerFieldEdit &&
              fieldEditable &&
              (!hideVettingColumns || govIdField);
            const adminResponseClickable = Boolean(
              adminCanEditStatus && showPerFieldEdit && fieldEditable && onFieldEdit && (!hideVettingColumns || govIdField)
            );
            const vettedCells = hideVettingColumns ? (
              <>
                <TableCell className={bioTableCellClassName('checkr-vetting-status-cell')} sx={bodyCellSx} aria-hidden />
                <TableCell className={bioTableCellClassName('checkr-bio-match-date-cell')} sx={bodyCellSx} aria-hidden />
                {showMatchNoteColumn ? (
                  <TableCell className={bioTableBodyCellClassName()} sx={bodyCellSx} aria-hidden />
                ) : null}
              </>
            ) : (
              <>
                <TableCell
                  className={bioTableCellClassName('checkr-vetting-status-cell')}
                  sx={{ ...bodyCellSx, verticalAlign: 'middle' }}
                >
                  {renderStatusPill(row)}
                </TableCell>
                <TableCell
                  className={bioTableCellClassName('checkr-bio-match-date-cell')}
                  sx={{ ...bodyCellSx, ...bioTableMatchDateCellSx, verticalAlign: 'middle' }}
                >
                  {showDate ? dateDisplay : ''}
                </TableCell>
                {showMatchNoteColumn ? (
                  <TableCell className={bioTableBodyCellClassName()} sx={{ ...bodyCellSx, verticalAlign: 'middle' }}>
                    {showNote ? String(row.vettedNote).trim() : ''}
                  </TableCell>
                ) : null}
              </>
            );
            return (
              <>
                {insertRow}
                <TableRow key={row.key} sx={{ bgcolor: bodyCellSx.bgcolor }}>
                <TableCell className="checkr-info-label-cell" sx={infoColumnLabelCellSx}>
                  <LabelWithLegendBadge
                    label={row.label}
                    note={row.legendNote}
                    activeNote={activeNote}
                    onLegendSelect={onLegendSelect}
                  />
                </TableCell>
                <TableCell className={bioTableBodyCellClassName()} sx={{ ...editColumnCellSx, ...bodyCellSx }}>
                  {showProfilePhotoEdit ? (
                    <FieldEditButton onClick={onProfilePhotoEdit} />
                  ) : showEdit ? (
                    <FieldEditButton onClick={openFieldEdit} />
                  ) : null}
                </TableCell>
                <TableCell
                  className={bioTableBodyCellClassName()}
                  sx={{ ...responseColumnCellSx, ...bodyCellSx }}
                  onClick={adminResponseClickable ? openFieldEdit : undefined}
                  title={adminResponseClickable ? 'Admin: click to edit this field' : undefined}
                >
                  {viewerMaskPending ? (
                    <MaskedResponseCell row={row} sectionKey={sectionKey} />
                  ) : (
                    <Box sx={adminResponseClickable ? { cursor: 'pointer' } : undefined}>
                      <ResponseField
                        row={row}
                        editable={editable}
                        value={draftValues[draftKey]}
                        onChange={(nextValue) => onDraftChange(draftKey, nextValue)}
                        inputProps={row.key === 'middlename' ? { maxLength: FULLNAME_MIDDLE_MAX_LENGTH } : undefined}
                      />
                      {row.key === 'linkedin_url' && String(row.response ?? '').trim() ? (
                        <Box sx={{ mt: 0.75 }}>
                          <ColorTemplate1Button
                            size="small"
                            onClick={() => openLinkedInProfileWindow(String(row.response).trim())}
                            sx={viewLinkedInButtonSx}
                          >
                            View LinkedIn
                          </ColorTemplate1Button>
                        </Box>
                      ) : null}
                    </Box>
                  )}
                </TableCell>
                {vettedCells}
              </TableRow>
              </>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MiscBioTable({
  rows,
  activeNote,
  onLegendSelect,
  editable,
  draftValues,
  onDraftChange,
  showPerFieldEdit = false,
  onFieldEdit = null,
  viewerMaskPending = false,
  viewerMaskMiscOnly = false,
  suppressEditActions = false
}) {
  const maskMiscResponses = viewerMaskPending || viewerMaskMiscOnly;
  const bioTableMobileLayout = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const miscColWidths = bioTableMobileLayout ? BIO_TABLE_COL_WIDTHS_MISC_ONLY_MOBILE : BIO_TABLE_COL_WIDTHS_MISC_ONLY;

  return (
    <TableContainer component={Paper} elevation={0} sx={vettedBioTableContainerSx}>
      <Table size="small" sx={tableSx}>
        <BioTableColGroup widths={miscColWidths} />
        <TableHead>
          <TableRow>
            <TableCell className="checkr-bio-table-header-cell" sx={{ ...bioTableHeaderCellSx, ...infoColumnCellSx }} aria-hidden />
            <TableCell className="checkr-bio-table-header-cell" sx={{ ...bioTableHeaderCellSx, ...editColumnCellSx }} aria-hidden />
            <TableCell className="checkr-bio-table-header-cell" sx={{ ...bioTableHeaderCellSx, ...responseColumnCellSx }}>
              Self-Report-Info
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => {
            const draftKey = `miscBio.${row.key}`;
            const currentValue = draftValues[draftKey] ?? displayResponse(row.response);
            const bodyCellSx = bioTableBodyCellSx(rowIndex);
            return (
              <TableRow key={row.key} sx={{ bgcolor: bodyCellSx.bgcolor }}>
                <TableCell className="checkr-info-label-cell" sx={infoColumnLabelCellSx}>
                  <LabelWithLegendBadge label={row.label} note={5} activeNote={activeNote} onLegendSelect={onLegendSelect} />
                </TableCell>
                <TableCell className={bioTableBodyCellClassName()} sx={{ ...editColumnCellSx, ...bodyCellSx }}>
                  {!suppressEditActions && !maskMiscResponses && showPerFieldEdit && canPerFieldEditRow(row, 'miscBio') ? (
                    <FieldEditButton
                      onClick={() =>
                        onFieldEdit?.({
                          row,
                          sectionKey: 'miscBio',
                          draftKey,
                          fieldLabel: row.label,
                          initialValue: currentValue
                        })
                      }
                    />
                  ) : null}
                </TableCell>
                <TableCell className={bioTableBodyCellClassName()} sx={{ ...responseColumnCellSx, ...bodyCellSx }}>
                  {maskMiscResponses ? (
                    <MaskedResponseCell row={row} sectionKey="miscBio" />
                  ) : editable ? (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={1}
                      value={currentValue}
                      onChange={(event) => onDraftChange(draftKey, event.target.value)}
                      sx={{ '& .MuiInputBase-root': tableTextSx }}
                    />
                  ) : (
                    <Typography sx={{ ...tableTextSx, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {displayResponse(currentValue)}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function CheckrBioReviewPanel({
  bioReview,
  loading,
  onBioReviewSaved,
  bioCaptureRef = null,
  consentFlowEnabled = true,
  visibleSections = { brief: true, full: true, misc: true },
  showMatchNoteColumn = true,
  onProfilePhotoEdit = null,
  onPassportUploadClick = null,
  showLegalNameTable = false,
  showBriefBioSectionFieldEdit = true,
  showFullBioSectionFieldEdit = true,
  canEditVettingStatus = false,
  viewerMaskPending = false,
  viewerMaskMiscOnly = false,
  suppressEditActions = false
}) {
  const navigate = useNavigate();
  const userTimeZoneProfile = useUserTimeZoneProfile();
  const [activeLegendNote, setActiveLegendNote] = useState(null);
  const [dataDisclaimerOpen, setDataDisclaimerOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [savingStatusKey, setSavingStatusKey] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [draftValues, setDraftValues] = useState({});
  const [pendingSelfReportImage, setPendingSelfReportImage] = useState(null);
  const [fieldEditState, setFieldEditState] = useState(null);
  const [fieldEditSaving, setFieldEditSaving] = useState(false);
  const internalBioCaptureRef = useRef(null);
  const selfReportCaptureRef = bioCaptureRef ?? internalBioCaptureRef;
  const selfReportCaptureInFlightRef = useRef(false);

  useEffect(() => {
    setIsEditing(false);
    setAuthDialogOpen(false);
    setPendingSelfReportImage(null);
    setDraftValues(buildDraftValues(bioReview));
    setStatusOverrides({});
  }, [bioReview]);

  const handleDraftChange = (draftKey, nextValue) => {
    setDraftValues((prev) => ({ ...prev, [draftKey]: nextValue }));
  };

  const handleCycleVettingStatus = async (row, currentStatus) => {
    const memberSinglesId = bioReview?.member?.singlesId;
    if (!canEditVettingStatus || !memberSinglesId) return;
    if (!getBioReviewRowVetColumn(row)) return;

    const overrideKey = row.key;
    const nextStatus = cycleVettingStatus(currentStatus);
    setSavingStatusKey(overrideKey);
    setStatusOverrides((prev) => ({
      ...prev,
      [overrideKey]: nextStatus
    }));

    try {
      await updateVetBioMatchingStatus({
        memberId: memberSinglesId,
        rowKey: row.key,
        vettedStatus: nextStatus
      });
      await onBioReviewSaved?.();
    } catch (err) {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to save matching status');
    } finally {
      setSavingStatusKey(null);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleFieldEditOpen = useCallback((payload) => {
    setFieldEditState(payload);
  }, []);

  const handleFieldEditClose = useCallback(() => {
    if (fieldEditSaving) return;
    setFieldEditState(null);
  }, [fieldEditSaving]);

  const handleFieldEditSubmit = useCallback(
    async (nextValue) => {
      if (!fieldEditState?.draftKey) return;
      setFieldEditSaving(true);
      try {
        const resetVetting = canEditVettingStatus ? false : fieldWasVerified(fieldEditState.row);
        await saveCheckrBioReviewField({
          draftKey: fieldEditState.draftKey,
          value: nextValue,
          resetVetting
        });
        setFieldEditState(null);
        await onBioReviewSaved?.();
      } catch (err) {
        await themedAlert(err?.response?.data?.error || err?.message || 'Failed to save field');
      } finally {
        setFieldEditSaving(false);
      }
    },
    [canEditVettingStatus, fieldEditState, onBioReviewSaved]
  );

  const handleSubmitClick = async () => {
    if (selfReportCaptureInFlightRef.current || submitSaving) return;
    selfReportCaptureInFlightRef.current = true;
    try {
      const selfReportImage = await captureElementAsPng(selfReportCaptureRef.current, {
        backgroundColor: '#ffffff'
      });
      setPendingSelfReportImage(selfReportImage);
      setAuthDialogOpen(true);
    } catch (err) {
      console.warn('[CheckrBioReviewPanel] self-report capture failed', err?.message || err);
      await themedAlert('Failed to capture self-report bio image. Please try again.');
    } finally {
      selfReportCaptureInFlightRef.current = false;
    }
  };

  const handleAuthCancel = async () => {
    if (submitSaving) return;
    setAuthDialogOpen(false);
    setPendingSelfReportImage(null);
    setIsEditing(false);
    setDraftValues(buildDraftValues(bioReview));
    try {
      await onBioReviewSaved?.();
    } catch (err) {
      console.warn('[CheckrBioReviewPanel] cancel reload failed', err?.message || err);
    }
  };

  const handleAuthConfirm = async ({ fullNameSigned, viewerApprovedId, dateSigned, consentSignatureImage }) => {
    setSubmitSaving(true);
    try {
      let consentImageToSave = consentSignatureImage;
      if (pendingSelfReportImage && consentSignatureImage) {
        consentImageToSave = await combineImagesSideBySide(pendingSelfReportImage, consentSignatureImage);
      }

      await saveCheckrBioReviewDraft(draftValues);
      await postSaveConsentRecord({
        full_name_signed: fullNameSigned,
        viewer_approved: viewerApprovedId,
        date_signed: dateSigned,
        consent_signature_image: consentImageToSave,
        description: CONSENT_DESCRIPTION_CHECKR_CHECK,
        watermark_variant: CONSENT_WATERMARK_VARIANTS.checkrCheck
      });
      setAuthDialogOpen(false);
      setPendingSelfReportImage(null);
      setIsEditing(false);
      const savedAt = dateSigned ? new Date(dateSigned) : new Date();
      setSubmittedAt(savedAt);
      await onBioReviewSaved?.();
      navigate(PROFILES_RECORDS_PATH, { state: { openTab: 'consents' } });
    } catch (err) {
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to save bio verification');
    } finally {
      setSubmitSaving(false);
    }
  };

  const viewerApprovedId = bioReview?.member?.singlesId ?? null;
  const viewerApprovedLabel = formatAliasWithMemberCode({
    alias: bioReview?.member?.alias ?? bioReview?.member?.displayName,
    prefix: bioReview?.member?.prefix,
    memberId: bioReview?.member?.memberId,
    singlesId: bioReview?.member?.singlesId
  });

  const expectedFullName = useMemo(() => {
    const readNamePart = (key) => {
      const draftKey = `briefBio.${key}`;
      if (draftKey in draftValues) return draftValues[draftKey];
      const row = (bioReview?.briefBio || []).find((item) => item.key === key);
      return row?.response ?? '';
    };
    return formatCapitalizedFullName(
      readNamePart('firstname'),
      readNamePart('middlename'),
      readNamePart('lastname')
    );
  }, [draftValues, bioReview?.briefBio]);

  const briefRows = useMemo(() => {
    if (!bioReview?.briefBio) return [];
    return expandBriefBioRows(bioReview.briefBio);
  }, [bioReview?.briefBio]);

  const legalNameRows = useMemo(
    () => briefRows.filter((row) => LEGAL_NAME_FIELD_KEYS.has(row.key)),
    [briefRows]
  );

  const memberBriefRows = useMemo(
    () => briefRows.filter((row) => !LEGAL_NAME_FIELD_KEYS.has(row.key)),
    [briefRows]
  );

  const passportCitizenshipRows = useMemo(() => {
    const orderedKeys = ['profilePpPhoto', 'citizenship', 'placeOfBirth', 'passportGovId'];
    const rowByKey = new Map(
      memberBriefRows.filter((row) => PASSPORT_CITIZENSHIP_FIELD_KEYS.has(row.key)).map((row) => [row.key, row])
    );
    return orderedKeys.map((key) => rowByKey.get(key)).filter(Boolean);
  }, [memberBriefRows]);

  const briefBioTableRows = useMemo(() => {
    const profileMatchRows = memberBriefRows.filter((row) => PROFILE_MATCH_PAIR_BRIEF_KEYS.has(row.key));
    const otherRows = memberBriefRows.filter(
      (row) =>
        !PROFILE_MATCH_PAIR_BRIEF_KEYS.has(row.key) && !PASSPORT_CITIZENSHIP_FIELD_KEYS.has(row.key)
    );
    return [...profileMatchRows, ...otherRows];
  }, [memberBriefRows]);

  const fullRows = useMemo(() => {
    if (!bioReview?.fullBio) return [];
    return bioReview.fullBio.map((row) => ({ ...row, legendNote: 3 }));
  }, [bioReview?.fullBio]);

  const briefBioSectionFieldEdit = showBriefBioSectionFieldEdit && !suppressEditActions;
  const fullBioSectionFieldEdit = showFullBioSectionFieldEdit && !suppressEditActions;

  const miscRows = bioReview?.miscBio || [];
  const showBriefBio = visibleSections.brief !== false;
  const showFullBio = visibleSections.full !== false;
  const showMiscBio = visibleSections.misc !== false;
  const demoUserMatchingStatus = isDemoUserCategory(bioReview?.member?.memberCategory);
  const briefMatchPercent = useMemo(() => calcBriefBioMatchPercentFromBioReview(bioReview), [bioReview]);
  const fullMatchPercent = useMemo(() => calcFullBioMatchPercentFromBioReview(bioReview), [bioReview]);

  if (loading) {
    return (
      <Box
        sx={{
          border: '2px solid #000',
          borderRadius: 1,
          p: 3,
          display: 'flex',
          justifyContent: 'center',
          ...bioReviewPanelBgSx
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!bioReview) return null;

  const { member } = bioReview;

  return (
    <Box
      ref={selfReportCaptureRef}
      sx={{
        position: 'relative',
        border: '2px solid #000',
        borderRadius: { xs: 0, sm: 1 },
        p: { xs: 0, sm: 2 },
        ...bioReviewPanelBgSx
      }}
    >
      {submittedAt ? (
        <Box
          sx={{
            mb: 2,
            p: 1.25,
            borderRadius: 1,
            textAlign: 'center',
            ...colorTemplate1ButtonSx({ selected: false }),
            ...checkrSolidBlackBorderSx
          }}
        >
          <Typography sx={{ fontWeight: 700, ...tableTextSx, color: 'inherit' }}>
            Verification Submitted {formatSubmittedAt(submittedAt, userTimeZoneProfile)}
          </Typography>
        </Box>
      ) : null}

      <Stack spacing={2.5}>
        {showBriefBio ? (
          <Box>
            {showLegalNameTable && legalNameRows.length ? (
              <Box sx={{ mb: 2 }}>
              <Box sx={legalNameBannerBoxSx}>
                <Typography className="theme-red-emphasis" sx={legalNameBannerTextSx}>
                  {LEGAL_NAME_TABLE_BANNER}
                </Typography>
              </Box>
                <VettedBioTable
                  legalNameTable
                  rows={legalNameRows}
                  activeNote={activeLegendNote}
                  onLegendSelect={setActiveLegendNote}
                  editable={isEditing}
                  draftValues={draftValues}
                  onDraftChange={handleDraftChange}
                  sectionKey="briefBio"
                  adminCanEditStatus={canEditVettingStatus}
                  memberSinglesId={member?.singlesId}
                  statusOverrides={statusOverrides}
                  savingStatusKey={savingStatusKey}
                  onCycleVettingStatus={handleCycleVettingStatus}
                  showMatchNoteColumn={showMatchNoteColumn}
                  showPerFieldEdit={briefBioSectionFieldEdit}
                  onFieldEdit={handleFieldEditOpen}
                  onDataMatchedDisclaimerClick={() => setDataDisclaimerOpen(true)}
                  viewerMaskPending={viewerMaskPending}
                  suppressEditActions={suppressEditActions}
                  userTimeZoneProfile={userTimeZoneProfile}
                  demoUserMatchingStatus={demoUserMatchingStatus}
                />
              </Box>
            ) : null}
            <BioSectionTitle
              title="Brief Bio"
              member={member}
              matchPercent={consentFlowEnabled ? briefMatchPercent : null}
            />
            <VettedBioTable
              rows={briefBioTableRows}
              viewerMaskPending={viewerMaskPending}
              suppressEditActions={suppressEditActions}
              userTimeZoneProfile={userTimeZoneProfile}
              activeNote={activeLegendNote}
              onLegendSelect={setActiveLegendNote}
              editable={isEditing}
              draftValues={draftValues}
              onDraftChange={handleDraftChange}
              sectionKey="briefBio"
              adminCanEditStatus={canEditVettingStatus}
              memberSinglesId={member?.singlesId}
              statusOverrides={statusOverrides}
              savingStatusKey={savingStatusKey}
              onCycleVettingStatus={handleCycleVettingStatus}
              showMatchNoteColumn={showMatchNoteColumn}
              showPerFieldEdit={briefBioSectionFieldEdit}
              onFieldEdit={handleFieldEditOpen}
              onProfilePhotoEdit={briefBioSectionFieldEdit ? onProfilePhotoEdit : null}
              onDataMatchedDisclaimerClick={() => setDataDisclaimerOpen(true)}
              demoUserMatchingStatus={demoUserMatchingStatus}
            />
          </Box>
        ) : null}

        {showBriefBio && passportCitizenshipRows.length ? (
          <Box sx={{ mb: 2 }}>
            <OptionalPassportCitizenshipSectionTitle
              onUploadClick={onPassportUploadClick && !suppressEditActions ? onPassportUploadClick : null}
            />
            <Box sx={legalNameBannerBoxSx}>
              <Typography className="theme-red-emphasis" sx={legalNameBannerTextSx}>
                {OPTIONAL_PASSPORT_SECTION_BANNER}
              </Typography>
            </Box>
            <VettedBioTable
              legalNameTable
              rows={passportCitizenshipRows}
              viewerMaskPending={viewerMaskPending}
              suppressEditActions={suppressEditActions}
              userTimeZoneProfile={userTimeZoneProfile}
              activeNote={activeLegendNote}
              onLegendSelect={setActiveLegendNote}
              editable={isEditing}
              draftValues={draftValues}
              onDraftChange={handleDraftChange}
              sectionKey="briefBio"
              adminCanEditStatus={canEditVettingStatus}
              memberSinglesId={member?.singlesId}
              statusOverrides={statusOverrides}
              savingStatusKey={savingStatusKey}
              onCycleVettingStatus={handleCycleVettingStatus}
              showMatchNoteColumn={showMatchNoteColumn}
              showPerFieldEdit={briefBioSectionFieldEdit}
              onFieldEdit={handleFieldEditOpen}
              onDataMatchedDisclaimerClick={() => setDataDisclaimerOpen(true)}
              demoUserMatchingStatus={demoUserMatchingStatus}
            />
          </Box>
        ) : null}

        {showFullBio ? (
          <Box>
            <BioSectionTitle
              title="Full Bio"
              member={member}
              matchPercent={consentFlowEnabled ? fullMatchPercent : null}
            />
            <VettedBioTable
              rows={fullRows}
              viewerMaskPending={viewerMaskPending}
              suppressEditActions={suppressEditActions}
              userTimeZoneProfile={userTimeZoneProfile}
              activeNote={activeLegendNote}
              onLegendSelect={setActiveLegendNote}
              editable={isEditing}
              draftValues={draftValues}
              onDraftChange={handleDraftChange}
              sectionKey="fullBio"
              adminCanEditStatus={canEditVettingStatus}
              memberSinglesId={member?.singlesId}
              statusOverrides={statusOverrides}
              savingStatusKey={savingStatusKey}
              onCycleVettingStatus={handleCycleVettingStatus}
              showMatchNoteColumn={showMatchNoteColumn}
              showPerFieldEdit={fullBioSectionFieldEdit}
              onFieldEdit={handleFieldEditOpen}
              onDataMatchedDisclaimerClick={() => setDataDisclaimerOpen(true)}
              demoUserMatchingStatus={demoUserMatchingStatus}
            />
          </Box>
        ) : null}

        {showMiscBio ? (
          <Box>
            <BioSectionTitle title="Miscellaneous Optional Bio" member={member} />
            <MiscBioTable
              rows={miscRows}
              viewerMaskPending={viewerMaskPending}
              viewerMaskMiscOnly={viewerMaskMiscOnly}
              suppressEditActions={suppressEditActions}
              activeNote={activeLegendNote}
              onLegendSelect={setActiveLegendNote}
              editable={isEditing}
              draftValues={draftValues}
              onDraftChange={handleDraftChange}
              showPerFieldEdit
              onFieldEdit={handleFieldEditOpen}
            />
          </Box>
        ) : null}
      </Stack>

      <BioFieldEditDialog
        open={Boolean(fieldEditState)}
        fieldLabel={fieldEditState?.fieldLabel ?? ''}
        initialValue={fieldEditState?.initialValue ?? ''}
        showVerifiedWarning={!canEditVettingStatus && fieldEditState ? fieldWasVerified(fieldEditState.row) : false}
        saving={fieldEditSaving}
        onClose={handleFieldEditClose}
        onSubmit={handleFieldEditSubmit}
      />

      {consentFlowEnabled ? (
        <VerificationAuthorizationDialog
          open={authDialogOpen}
          confirmBusy={submitSaving}
          viewerApprovedLabel={viewerApprovedLabel}
          viewerApprovedId={viewerApprovedId}
          expectedFullName={expectedFullName}
          showViewerApproved={false}
          onConfirm={handleAuthConfirm}
          onCancel={handleAuthCancel}
        />
      ) : null}

      <LegendPopup highlightedNote={activeLegendNote} onClose={() => setActiveLegendNote(null)} />
      <DataMatchedDisclaimerPopup open={dataDisclaimerOpen} onClose={() => setDataDisclaimerOpen(false)} />
    </Box>
  );
}
