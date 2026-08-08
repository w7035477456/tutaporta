import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useAuth } from 'contexts/AuthContext';
import MainCard from 'ui-component/cards/MainCard';
import { gridSpacing } from 'store/constant';
import api from 'api/axios';
import verifiedBasicSeal from 'assets/images/verifiedBasicSeal.png';
import verifiedDetailSeal from 'assets/images/verifiedDetailSeal.png';
import { NOT_AVAILABLE, toDisplayVettedDate } from './verifySelfVettedDate';
import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';

/** DESKTOP_FONT_SIZE_TEXT for all copy inside both vetting tables (headers, labels, fields) */
const verifySelfTableTextFontSize = getDesktopTextFontSizeVw();
const verifySelfTableSx = {
  minWidth: 520,
  '& .MuiTableCell-root': { fontSize: verifySelfTableTextFontSize },
  '& .MuiTableCell-head': { fontSize: verifySelfTableTextFontSize },
  '& .MuiTypography-root': { fontSize: verifySelfTableTextFontSize }
};

function toDisplayValue(raw) {
  if (raw == null) return NOT_AVAILABLE;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'n/a') return NOT_AVAILABLE;
  return s;
}

function toBool(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return raw === true || raw === 1 || s === 'true' || s === 't' || s === '1' || s === 'yes';
}

function fromApiRow(rowData) {
  return {
    verificationStatus: toDisplayValue(rowData?.verificationStatus),
    vettedResult: toDisplayValue(rowData?.vettedNote),
    vettedDate: toDisplayVettedDate(rowData?.vettedDate),
    vettedBy: toDisplayValue(rowData?.vettedByUserid)
  };
}

const INITIAL_ROWS = [
  { id: 'name', field: 'Name', verificationStatus: 'Vetted', vettedResult: NOT_AVAILABLE, vettedDate: NOT_AVAILABLE, vettedBy: NOT_AVAILABLE },
  { id: 'photo', field: 'Photo', verificationStatus: NOT_AVAILABLE, vettedResult: NOT_AVAILABLE, vettedDate: NOT_AVAILABLE, vettedBy: NOT_AVAILABLE },
  { id: 'age', field: 'Age', verificationStatus: 'Vetted', vettedResult: NOT_AVAILABLE, vettedDate: NOT_AVAILABLE, vettedBy: NOT_AVAILABLE },
  { id: 'city', field: 'Current city', verificationStatus: 'Vetted', vettedResult: NOT_AVAILABLE, vettedDate: NOT_AVAILABLE, vettedBy: NOT_AVAILABLE }
];

/** Hardcoded placeholders — no DB mapping yet */
const DETAIL_ROWS = [
  { id: 'education', field: 'Education', verificationStatus: 'Vetted', vettedResult: NOT_AVAILABLE, vettedDate: NOT_AVAILABLE, vettedBy: NOT_AVAILABLE },
  { id: 'career', field: 'Career', verificationStatus: 'Vetted', vettedResult: NOT_AVAILABLE, vettedDate: '', vettedBy: '' },
  { id: 'children', field: 'Children', verificationStatus: 'In Process', vettedResult: NOT_AVAILABLE, vettedDate: '', vettedBy: '' },
  { id: 'homeCity', field: 'Home City', verificationStatus: 'New', vettedResult: NOT_AVAILABLE, vettedDate: '', vettedBy: '' },
  { id: 'country', field: 'Country of Birth', verificationStatus: 'Added', vettedResult: NOT_AVAILABLE, vettedDate: '', vettedBy: '' },
  { id: 'religion', field: 'Religion', verificationStatus: 'New', vettedResult: NOT_AVAILABLE, vettedDate: '', vettedBy: '' },
  { id: 'hobbies', field: 'Hobbies', verificationStatus: 'Vetted', vettedResult: NOT_AVAILABLE, vettedDate: '', vettedBy: '' }
];

export default function VerifySelf() {
  const { user } = useAuth();
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [detailRows, setDetailRows] = useState(DETAIL_ROWS);
  const [basicVetted, setBasicVetted] = useState(false);
  const [detailVetted, setDetailVetted] = useState(false);
  const [saveError, setSaveError] = useState('');

  const applyLoadedData = (data) => {
    setBasicVetted(toBool(data?.vettedBasicStatus));
    setDetailVetted(toBool(data?.vettedDetailStatus));
    const nextBasicRows = INITIAL_ROWS.map((row) =>
      row.id === 'photo'
        ? {
            ...row,
            verificationStatus: toDisplayValue(data?.verificationStatus),
            vettedResult: toDisplayValue(data?.vettedNote),
            vettedDate: toDisplayVettedDate(data?.vettedDate),
            vettedBy: toDisplayValue(data?.vettedByUserid)
          }
        : row.id === 'name'
          ? {
              ...row,
              verificationStatus: toDisplayValue(data?.nameVerificationStatus),
              vettedResult: toDisplayValue(data?.nameVettedNote),
              vettedDate: toDisplayVettedDate(data?.nameVettedDate),
              vettedBy: toDisplayValue(data?.nameVettedByUserid)
            }
          : row.id === 'age'
            ? {
                ...row,
                verificationStatus: toDisplayValue(data?.ageVerificationStatus),
                vettedResult: toDisplayValue(data?.ageVettedNote),
                vettedDate: toDisplayVettedDate(data?.ageVettedDate),
                vettedBy: toDisplayValue(data?.ageVettedByUserid)
              }
            : row.id === 'city'
              ? {
                  ...row,
                  verificationStatus: toDisplayValue(data?.cityVerificationStatus),
                  vettedResult: toDisplayValue(data?.cityVettedNote),
                  vettedDate: toDisplayVettedDate(data?.cityVettedDate),
                  vettedBy: toDisplayValue(data?.cityVettedByUserid)
                }
              : row
    );
    const nextDetailRows = DETAIL_ROWS.map((row) => ({
      ...row,
      ...fromApiRow(data?.rowsById?.[row.id])
    }));
    setRows(nextBasicRows);
    setDetailRows(nextDetailRows);
  };

  const applyErrorData = () => {
    setBasicVetted(false);
    setDetailVetted(false);
    const nextBasicRows = INITIAL_ROWS.map((row) =>
      row.id === 'photo' || row.id === 'name' || row.id === 'age' || row.id === 'city'
        ? {
            ...row,
            verificationStatus: NOT_AVAILABLE,
            vettedResult: NOT_AVAILABLE,
            vettedDate: NOT_AVAILABLE,
            vettedBy: NOT_AVAILABLE
          }
        : row
    );
    const nextDetailRows = DETAIL_ROWS.map((row) => ({
      ...row,
      verificationStatus: NOT_AVAILABLE,
      vettedResult: NOT_AVAILABLE,
      vettedDate: NOT_AVAILABLE,
      vettedBy: NOT_AVAILABLE
    }));
    setRows(nextBasicRows);
    setDetailRows(nextDetailRows);
  };

  useEffect(() => {
    if (user == null) return undefined;
    let mounted = true;
    const loadVerifySelfRows = async () => {
      try {
        if (!mounted) return;
        const { data } = await api.get('/api/verifyself/photo');
        if (!mounted) return;
        applyLoadedData(data);
      } catch (_) {
        if (!mounted) return;
        applyErrorData();
      }
    };

    loadVerifySelfRows();
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        /* Extra side margin on narrow screens — main column uses asymmetric margins on mobile */
        px: { xs: 3, sm: 2.5, md: 2.5, lg: 0 }
      }}
    >
      <MainCard
        sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        contentSX={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Stack spacing={gridSpacing} sx={{ flex: 1, minHeight: 0, width: '100%', minWidth: 0 }}>
          {!!saveError && (
            <Box sx={{ width: '100%', minWidth: 0 }}>
              <Alert severity="error">{saveError}</Alert>
            </Box>
          )}
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              border: '1px solid var(--theme-primary-color)',
              borderRadius: 1,
              px: 1.25,
              py: 1
            }}
          >
            <Typography
              sx={{
                color: 'var(--theme-primary-color)',
                fontSize: { xs: '0.82rem', sm: getDesktopTextFontSizeVw() },
                textAlign: 'left',
                lineHeight: 1.3
              }}
            >
              You&apos;re in the driver&apos;s seat! Your bio stays hidden until you personally give someone the
              &quot;thumbs up&quot; to view it. We value your trust, which is why we never sell your info to third parties.
              Whether you&apos;re looking for a new friend or a lifelong partner, we make sure your privacy is always our top
              priority. Explore new connections with peace of mind, knowing that your privacy is protected by our highest
              security standards.
            </Typography>
          </Box>

          <Box sx={{ width: '100%', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: 'var(--theme-secondary-color)'
                }}
              >
                <Typography
                  sx={{
                    color: 'var(--theme-primary-color)',
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', sm: getDesktopTitleFontSizeVw() }
                  }}
                >
                  Just the basic about me
                </Typography>
              </Box>
              {basicVetted ? (
                <Box component="img" src={verifiedBasicSeal} alt="basic vetted" sx={{ width: 34, height: 34 }} />
              ) : (
                <Typography
                  sx={{
                    color: 'var(--theme-error-color)',
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', sm: getDesktopTitleFontSizeVw() },
                    lineHeight: 1
                  }}
                >
                  Not Vetted
                </Typography>
              )}
              </Box>
            </Box>
            <TableContainer
              component={Paper}
              sx={{
                border: '2px solid var(--theme-primary-color)',
                boxShadow: 'none',
                width: '100%',
                maxWidth: '100%',
                overflowX: 'auto'
              }}
            >
              <Table size="small" sx={verifySelfTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Fields Information</TableCell>
                    <TableCell>Verification Status</TableCell>
                    <TableCell>Vetted Result/Note</TableCell>
                    <TableCell>Vetted Date</TableCell>
                    <TableCell>Vetted by</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ bgcolor: 'var(--theme-secondary-color)' }}>
                        <Typography variant="body2">{row.field}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.verificationStatus}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.vettedResult}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.vettedDate}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.vettedBy}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box sx={{ width: '100%', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: 'var(--theme-secondary-color)'
                }}
              >
                <Typography
                  sx={{
                    color: 'var(--theme-primary-color)',
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', sm: getDesktopTitleFontSizeVw() }
                  }}
                >
                  A little more about me
                </Typography>
              </Box>
              {detailVetted ? (
                <Box component="img" src={verifiedDetailSeal} alt="detail vetted" sx={{ width: 34, height: 34 }} />
              ) : (
                <Typography
                  sx={{
                    color: 'var(--theme-error-color)',
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', sm: getDesktopTitleFontSizeVw() },
                    lineHeight: 1
                  }}
                >
                  Not Vetted
                </Typography>
              )}
              </Box>
            </Box>
            <TableContainer
              component={Paper}
              sx={{
                border: '2px solid var(--theme-primary-color)',
                boxShadow: 'none',
                width: '100%',
                maxWidth: '100%',
                overflowX: 'auto'
              }}
            >
              <Table size="small" sx={verifySelfTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Fields Information</TableCell>
                    <TableCell>Verification Status</TableCell>
                    <TableCell>Vetted Result/Note</TableCell>
                    <TableCell>Vetted Date</TableCell>
                    <TableCell>Vetted by</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ bgcolor: 'var(--theme-secondary-color)' }}>
                        <Typography variant="body2">{row.field}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.verificationStatus}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.vettedResult || '\u00a0'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.vettedDate || '\u00a0'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.vettedBy || '\u00a0'}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </MainCard>
    </Box>
  );
}
