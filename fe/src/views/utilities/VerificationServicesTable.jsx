import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import GreenButton from 'ui-component/GreenButton';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { COLOR_TEMPLATE1_BORDER_UNSELECTED, colorTemplate1ButtonSx } from 'config/colorTemplate1';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { getDesktopButtonFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { DAYNIGHT_VAR, INVERSE_DAYNIGHT_VAR, PRIMARY_VAR, SECONDARY_VAR } from 'utils/themeConfig';
import { BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE, BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE_MOBILE } from 'utils/checkrBioTableLayout';
import { formatVerificationDateSuffix, isVerificationServiceActionEnabled } from 'utils/profilePhotoChangeGate';
import { VETTING_STATUS_DOT_SIZE_PX } from 'utils/vettingStatusDisplay';

/**
 * Theme mapping (follows every palette):
 * - body rows  → theme primary (= left sidebar menu button bg) + daynight text
 * - header row + enabled Action buttons → theme secondary (= the "We never reveal…" box below)
 *   + inverse-daynight text
 */
const VERIFICATION_TABLE_BG = `var(${PRIMARY_VAR})`;
const VERIFICATION_TABLE_TEXT = `var(${DAYNIGHT_VAR})`;
const VERIFICATION_ACCENT_BG = `var(${SECONDARY_VAR})`;
const VERIFICATION_ACCENT_TEXT = `var(${INVERSE_DAYNIGHT_VAR})`;

/** Enabled Action buttons — secondary. Outranks GreenButton's Minimal-palete rule; disabled stays grey. */
const verificationActionButtonSx = {
  'html[data-color-palete="minimal"] &&&&:not(.Mui-disabled)': {
    bgcolor: `${VERIFICATION_ACCENT_BG} !important`,
    backgroundColor: `${VERIFICATION_ACCENT_BG} !important`,
    backgroundImage: 'none !important',
    color: `${VERIFICATION_ACCENT_TEXT} !important`,
    WebkitTextFillColor: `${VERIFICATION_ACCENT_TEXT} !important`,
    '& svg, & .MuiButton-startIcon': { color: `${VERIFICATION_ACCENT_TEXT} !important` }
  }
};

const tableTextFontSize = { xs: '0.9rem', sm: getDesktopTextFontSizeVw() };
const tableButtonFontSize = { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() };

/** Column labels only — theme secondary bg + inverse-daynight text, no hover scale. */
const verificationTableHeaderCellSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: tableTextFontSize,
  bgcolor: `${VERIFICATION_ACCENT_BG} !important`,
  color: `${VERIFICATION_ACCENT_TEXT} !important`,
  WebkitTextFillColor: `${VERIFICATION_ACCENT_TEXT} !important`,
  borderBottom: COLOR_TEMPLATE1_BORDER_UNSELECTED,
  py: 1.25,
  textAlign: 'center',
  cursor: 'default',
  transform: 'none !important',
  transition: 'none',
  '@media (hover: hover)': {
    '&:hover': {
      bgcolor: `${VERIFICATION_ACCENT_BG} !important`,
      color: `${VERIFICATION_ACCENT_TEXT} !important`,
      transform: 'none !important',
      filter: 'none'
    }
  }
};

const verificationStatusHeaderCellSx = {
  ...verificationTableHeaderCellSx,
  textAlign: 'left'
};

const bodyCellSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontSize: tableTextFontSize,
  bgcolor: VERIFICATION_TABLE_BG,
  color: VERIFICATION_TABLE_TEXT,
  borderColor: VERIFICATION_ACCENT_BG,
  verticalAlign: 'middle',
  py: 1.5
};

const statusCellSx = {
  ...bodyCellSx,
  textAlign: 'left',
  verticalAlign: 'middle'
};

const alignmentSpacerCellSx = {
  ...bodyCellSx,
  p: 0,
  borderLeft: 'none'
};

const stepChipSx = {
  ...colorTemplate1ButtonSx({ selected: false }),
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: tableButtonFontSize,
  textTransform: 'none',
  borderRadius: '12px',
  border: 'none',
  px: 2.5,
  py: { xs: 1.25, sm: 1.5 },
  minWidth: { xs: 72, sm: 120 },
  boxShadow: 'none',
  bgcolor: 'transparent !important',
  color: `${VERIFICATION_TABLE_TEXT} !important`,
  WebkitTextFillColor: `${VERIFICATION_TABLE_TEXT} !important`,
  cursor: 'default',
  pointerEvents: 'none',
  '@media (hover: hover)': {
    '&:hover': {
      border: 'none'
    }
  }
};

const STATUS_TEXT_COLOR = VERIFICATION_TABLE_TEXT;

function normalizeStatusKey(status) {
  return String(status ?? 'notstarted')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function displayStatusLabel(status) {
  const key = normalizeStatusKey(status);
  if (key === 'completed') return 'Completed';
  if (key === 'error') return 'Error';
  return 'Not Started';
}

function verificationStatusDotSx(status) {
  const key = normalizeStatusKey(status);
  if (key === 'completed') {
    return { bgcolor: '#2e7d32', border: '6px solid #1b5e20' };
  }
  if (key === 'error') {
    return { bgcolor: '#e53935', border: '6px solid #b71c1c' };
  }
  return { bgcolor: '#ffffff', border: '6px solid #9e9e9e' };
}

function VerificationStatusIndicator({
  status,
  statusLabel,
  verificationDate,
  clickable = false,
  saving = false,
  onClick,
  partnerSuffix = null,
  title = null
}) {
  const label = saving ? 'Saving…' : displayStatusLabel(status);
  const daysAgo =
    !saving && normalizeStatusKey(status) === 'completed' ? formatVerificationDateSuffix(verificationDate) : '';

  const interactive = clickable && !saving && typeof onClick === 'function';

  return (
    <Box
      component={interactive ? 'button' : 'span'}
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      title={interactive ? title : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: { xs: 0.75, sm: 1 },
        flexWrap: 'wrap',
        fontFamily: MAIN_FONT_FAMILY,
        fontWeight: 700,
        fontSize: tableTextFontSize,
        lineHeight: 1.2,
        color: STATUS_TEXT_COLOR,
        WebkitTextFillColor: STATUS_TEXT_COLOR,
        whiteSpace: 'nowrap',
        border: 'none',
        bgcolor: 'transparent',
        p: 0,
        m: 0,
        font: 'inherit',
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        ...(interactive
          ? {
              '&:hover .verification-status-dot': { filter: 'brightness(0.92)' },
              '&:hover .verification-status-label': { textDecoration: 'underline' }
            }
          : null)
      }}
    >
      <Box
        className="verification-status-dot"
        component="span"
        aria-hidden
        sx={{
          width: VETTING_STATUS_DOT_SIZE_PX,
          height: VETTING_STATUS_DOT_SIZE_PX,
          minWidth: VETTING_STATUS_DOT_SIZE_PX,
          minHeight: VETTING_STATUS_DOT_SIZE_PX,
          borderRadius: '50%',
          boxSizing: 'border-box',
          flexShrink: 0,
          display: 'inline-block',
          ...verificationStatusDotSx(status)
        }}
      />
      <Box component="span" className="verification-status-label">
        {label}
        {daysAgo ? (
          <Box component="span" sx={{ fontWeight: 700 }}>
            {daysAgo}
          </Box>
        ) : null}
      </Box>
      {partnerSuffix != null ? (
        <Box
          component="span"
          sx={{
            fontWeight: 700,
            color: '#f9a825',
            WebkitTextFillColor: '#f9a825',
            ml: { xs: 0.5, sm: 1 }
          }}
        >
          Partner Status: {partnerSuffix}
        </Box>
      ) : null}
    </Box>
  );
}

VerificationStatusIndicator.propTypes = {
  status: PropTypes.string,
  statusLabel: PropTypes.string,
  verificationDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  clickable: PropTypes.bool,
  saving: PropTypes.bool,
  onClick: PropTypes.func,
  partnerSuffix: PropTypes.oneOf(['T', 'F']),
  title: PropTypes.string
};

export default function VerificationServicesTable({
  services,
  linkedInPartnerPositions = null,
  onActionClick,
  actionLoadingKey = null,
  adminCanEditStatus = false,
  onCycleStatus = null,
  savingStatusKey = null,
  statusOverrides = {}
}) {
  const rows = Array.isArray(services) ? services : [];
  const bioTableMobileLayout = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const colWidths = bioTableMobileLayout ? BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE_MOBILE : BIO_TABLE_COL_WIDTHS_NO_MATCH_NOTE;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        sx={{
          fontFamily: MAIN_FONT_FAMILY,
          fontWeight: 700,
          fontSize: tableTextFontSize,
          color: 'var(--theme-primary-color)',
          textAlign: 'center',
          mb: 1.5
        }}
      >
        Verification Services
      </Typography>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid var(--theme-primary-color)',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: VERIFICATION_TABLE_BG
        }}
      >
        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%', minWidth: { xs: 0, sm: 780 }, bgcolor: VERIFICATION_TABLE_BG }}>
          <colgroup>
            {colWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell sx={verificationTableHeaderCellSx} align="center">
                Step
              </TableCell>
              <TableCell sx={verificationTableHeaderCellSx} align="center" colSpan={2}>
                Action
              </TableCell>
              <TableCell sx={verificationStatusHeaderCellSx} align="left" className="checkr-vetting-status-cell">
                Status
              </TableCell>
              <TableCell sx={{ ...verificationTableHeaderCellSx, p: 0 }} aria-hidden />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const loading = actionLoadingKey === row.key;
              const otherActionLoading = Boolean(actionLoadingKey) && !loading;
              const effectiveStatus = statusOverrides[row.key] ?? row.status;
              const effectiveVerificationDate =
                row.key === 'id' && normalizeStatusKey(effectiveStatus) !== 'completed'
                  ? null
                  : row.verificationDate;
              // Only Identification Verification uses the 30-day date lock; work/education stay clickable.
              const statusSaving = savingStatusKey === row.key;
              const cooldownLocked =
                !adminCanEditStatus && row.key === 'id' && !isVerificationServiceActionEnabled(row.verificationDate);
              return (
                <TableRow key={row.key} sx={{ bgcolor: VERIFICATION_TABLE_BG }}>
                  <TableCell sx={bodyCellSx} align="center">
                    <Box component="span" sx={stepChipSx}>
                      Step {row.step}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, px: { xs: 0.75, sm: 1.5 }, overflow: 'visible' }} align="center" colSpan={2}>
                    <GreenButton
                      type="button"
                      disabled={otherActionLoading || loading || statusSaving || cooldownLocked}
                      onClick={() => onActionClick?.(row.key)}
                      sx={{
                        width: '100%',
                        minWidth: '100%',
                        maxWidth: '100%',
                        justifyContent: 'center',
                        ...verificationActionButtonSx
                      }}
                    >
                      {loading || statusSaving ? `${row.label}…` : row.label}
                    </GreenButton>
                  </TableCell>
                  <TableCell sx={statusCellSx} align="left" className="checkr-vetting-status-cell">
                    <VerificationStatusIndicator
                      status={effectiveStatus}
                      statusLabel={row.statusLabel}
                      verificationDate={effectiveVerificationDate}
                      clickable={adminCanEditStatus}
                      saving={statusSaving}
                      onClick={() => onCycleStatus?.(row, effectiveStatus)}
                      title={adminCanEditStatus ? 'Admin: click to cycle verification status' : undefined}
                      partnerSuffix={
                        row.key === 'linkedin' ? (linkedInPartnerPositions ? 'T' : 'F') : null
                      }
                    />
                  </TableCell>
                  <TableCell sx={alignmentSpacerCellSx} aria-hidden />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

VerificationServicesTable.propTypes = {
  services: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      step: PropTypes.number,
      label: PropTypes.string,
      status: PropTypes.string,
      statusLabel: PropTypes.string,
      verificationDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])
    })
  ),
  linkedInPartnerPositions: PropTypes.bool,
  onActionClick: PropTypes.func,
  actionLoadingKey: PropTypes.string,
  adminCanEditStatus: PropTypes.bool,
  onCycleStatus: PropTypes.func,
  savingStatusKey: PropTypes.string,
  statusOverrides: PropTypes.object
};
