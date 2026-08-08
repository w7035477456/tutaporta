import { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import MainCard from 'ui-component/cards/MainCard';
import { gridSpacing } from 'store/constant';
import { useGetRequestsSent } from 'api/requestsSentFe';
import { useAuth } from 'contexts/AuthContext';
import { NOT_AVAILABLE, toDisplayVettedDate } from './verifySelfVettedDate';
import verifiedBasicSeal from 'assets/images/verifiedBasicSeal.png';
import verifiedDetailSeal from 'assets/images/verifiedDetailSeal.png';
import { getDesktopTitleFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { update_vetted_basic_count, update_vetted_detail_count } from 'utils/updateVettedStatusCounts';
import { formatMemberLabel } from 'utils/memberLabel';
import { triStateBioRequestApproval } from 'utils/receivedBioRequestDisplay';
import { APPROVAL_STATUS } from 'utils/approvalStatusEnum';

/**
 * Full-page read-only vetting layout (same table structure and section chrome as My Vetting / VerifySelf)
 * for a member you requested info from, shown when their basic and/or detail approval is granted.
 * Does not import or modify InterestedSingles or VerifySelf.
 */

const titleFontSx = {
  color: 'var(--theme-primary-color)',
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() }
};

const verifySelfTableTextFontSize = getDesktopTextFontSizeVw();
const verifySelfTableSx = {
  minWidth: 520,
  '& .MuiTableCell-root': { fontSize: verifySelfTableTextFontSize },
  '& .MuiTableCell-head': { fontSize: verifySelfTableTextFontSize },
  '& .MuiTypography-root': { fontSize: verifySelfTableTextFontSize }
};

function triStateApproval(value) {
  return triStateBioRequestApproval(value);
}

function toText(value) {
  if (value === null || value === undefined || value === '') return NOT_AVAILABLE;
  return String(value);
}
function buildBasicTableRows(row) {
  if (!row) return [];
  const info = row.profile_info ?? {};
  const vetting = row.profile_vetting ?? {};
  return [
    {
      id: 'name',
      field: 'Name',
      information: toText(info.name),
      status: toText(vetting.name?.status),
      note: toText(vetting.name?.note),
      date: toDisplayVettedDate(vetting.name?.date)
    },
    {
      id: 'photo',
      field: 'Photo',
      information: info.photo || null,
      status: toText(vetting.photo?.status),
      note: toText(vetting.photo?.note),
      date: toDisplayVettedDate(vetting.photo?.date)
    },
    {
      id: 'age',
      field: 'Age',
      information: toText(info.age),
      status: toText(vetting.age?.status),
      note: toText(vetting.age?.note),
      date: toDisplayVettedDate(vetting.age?.date)
    },
    {
      id: 'city',
      field: 'Current city',
      information: toText(info.currentCity),
      status: toText(vetting.currentCity?.status),
      note: toText(vetting.currentCity?.note),
      date: toDisplayVettedDate(vetting.currentCity?.date)
    }
  ];
}

function buildDetailTableRows(row) {
  if (!row) return [];
  const info = row.profile_info ?? {};
  const vetting = row.profile_vetting ?? {};
  return [
    {
      id: 'education',
      field: 'Education',
      information: toText(info.education),
      status: toText(vetting.education?.status),
      note: toText(vetting.education?.note),
      date: toDisplayVettedDate(vetting.education?.date)
    },
    {
      id: 'career',
      field: 'Career',
      information: toText(info.career),
      status: toText(vetting.career?.status),
      note: toText(vetting.career?.note),
      date: toDisplayVettedDate(vetting.career?.date)
    },
    {
      id: 'children',
      field: 'Children',
      information: toText(info.children),
      status: toText(vetting.children?.status),
      note: toText(vetting.children?.note),
      date: toDisplayVettedDate(vetting.children?.date)
    },
    {
      id: 'homeCity',
      field: 'Home City',
      information: toText(info.homeCity),
      status: toText(vetting.homeCity?.status),
      note: toText(vetting.homeCity?.note),
      date: toDisplayVettedDate(vetting.homeCity?.date)
    },
    {
      id: 'countryOfBirth',
      field: 'Country of Birth',
      information: toText(info.countryOfBirth),
      status: toText(vetting.countryOfBirth?.status),
      note: toText(vetting.countryOfBirth?.note),
      date: toDisplayVettedDate(vetting.countryOfBirth?.date)
    },
    {
      id: 'religion',
      field: 'Religion',
      information: toText(info.religion),
      status: toText(vetting.religion?.status),
      note: toText(vetting.religion?.note),
      date: toDisplayVettedDate(vetting.religion?.date)
    },
    {
      id: 'hobbies',
      field: 'Hobbies',
      information: toText(info.hobbies),
      status: toText(vetting.hobbies?.status),
      note: toText(vetting.hobbies?.note),
      date: toDisplayVettedDate(vetting.hobbies?.date)
    }
  ];
}

export default function RequestApprovedMemberVettingView() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const forcedViewKind = location?.state?.viewKind === 'detail' ? 'detail' : location?.state?.viewKind === 'basic' ? 'basic' : null;
  const { requestsSent, requestsSentLoading, requestsSentError } = useGetRequestsSent();

  const targetId = Number(memberId);
  const idOk = Number.isFinite(targetId) && targetId > 0;

  const rows = useMemo(() => {
    const myId = user?.singles_id != null ? Number(user.singles_id) : null;
    const myIdOk = Number.isFinite(myId);
    return requestsSent.filter((x) => {
      if (!Number.isFinite(x?.singles_id_to) || !Number.isFinite(x?.singles_id_from)) return false;
      if (myIdOk && Number(x.singles_id_from) !== myId) return false;
      return true;
    });
  }, [requestsSent, user?.singles_id]);

  const row = useMemo(() => {
    if (!idOk) return null;
    return rows.find((r) => Number(r.singles_id_to) === targetId) ?? null;
  }, [rows, targetId, idOk]);

  const basicApproved = row ? triStateApproval(row.brief_bio_request_approval) === APPROVAL_STATUS.APPROVE : false;
  const detailApproved = row ? triStateApproval(row.full_bio_request_approval) === APPROVAL_STATUS.APPROVE : false;
  const basicVettedComputed = row ? update_vetted_basic_count(row) : { vetted_basic_status: false, completedCount: 0 };
  const detailVettedComputed = row ? update_vetted_detail_count(row) : { vetted_detail_status: false, completedCount: 0 };
  const showBasicBase = basicApproved && basicVettedComputed.vetted_basic_status;
  /** Full bio view: approval unlocks the table; vetting seal is separate from access. */
  const showDetailWhenApproved = detailApproved;
  const showBasic = forcedViewKind ? forcedViewKind === 'basic' && showBasicBase : showBasicBase;
  const showDetail = forcedViewKind ? forcedViewKind === 'detail' && showDetailWhenApproved : showDetailWhenApproved;

  const memberLabel = formatMemberLabel({
    alias: row?.alias,
    singlesId: targetId,
    prefix: row?.prefix,
    memberId: row?.member_id
  });

  const basicVetted = Boolean(basicVettedComputed.vetted_basic_status);
  const detailVetted = Boolean(detailVettedComputed.vetted_detail_status);

  const basicRows = useMemo(() => buildBasicTableRows(row), [row]);
  const detailRows = useMemo(() => buildDetailTableRows(row), [row]);

  const accessOk =
    row &&
    (forcedViewKind === 'detail'
      ? showDetailWhenApproved
      : forcedViewKind === 'basic'
        ? showBasicBase
        : showBasicBase || showDetailWhenApproved);

  const onClose = () => navigate('/vettedFriends');

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
        px: { xs: 3, sm: 2.5, md: 2.5, lg: 0 }
      }}
    >
      <MainCard
        title={`Approved profile — ${memberLabel}`}
        headerSX={{
          '& .MuiCardHeader-title': {
            ...titleFontSx,
            lineHeight: 1.2
          }
        }}
        sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        contentSX={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {requestsSentLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : null}

        {requestsSentError ? (
          <Alert severity="error">
            Failed to load request data.
            <Box component="pre" sx={{ mt: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 120 }}>
              {requestsSentError?.message ?? String(requestsSentError)}
            </Box>
          </Alert>
        ) : null}

        {!requestsSentLoading && !requestsSentError ? (
          <Stack spacing={gridSpacing} sx={{ flex: 1, minHeight: 0, width: '100%', minWidth: 0 }}>
            {!idOk ? (
              <Alert severity="warning">Invalid member.</Alert>
            ) : !row ? (
              <Alert severity="warning">No outgoing request found for this member.</Alert>
            ) : !accessOk ? (
              <Alert severity="warning">You do not have an approved view for this member&apos;s profile.</Alert>
            ) : (
              <>
                {showBasic ? (
                  <Box sx={{ width: '100%', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
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
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {basicRows.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className={DARK_SURFACE_CLASS} sx={{ bgcolor: 'var(--theme-secondary-color)' }}>
                                <Typography variant="body2">
                                  {item.field}:{' '}
                                  {item.id === 'photo' && item.information && item.information !== NOT_AVAILABLE ? (
                                    <Box
                                      component="img"
                                      src={item.information}
                                      alt="Member"
                                      sx={{
                                        width: { xs: 40, sm: 48 },
                                        height: { xs: 40, sm: 48 },
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        verticalAlign: 'middle'
                                      }}
                                    />
                                  ) : (
                                    item.information
                                  )}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{item.status}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{item.note}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{item.date}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : null}

                {showDetail ? (
                  <Box sx={{ width: '100%', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
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
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detailRows.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className={DARK_SURFACE_CLASS} sx={{ bgcolor: 'var(--theme-secondary-color)' }}>
                                <Typography variant="body2">
                                  {item.field}: {item.information}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{item.status}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{item.note}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{item.date}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : null}
              </>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', pt: 2, pb: 1 }}>
              <Button
                variant="contained"
                size="large"
                onClick={onClose}
                sx={{
                  minWidth: { xs: '80%', sm: 280 },
                  maxWidth: 480,
                  py: 1.5,
                  px: 4,
                  fontSize: { xs: '1rem', sm: getDesktopTextFontSizeVw() },
                  textTransform: 'none',
                  bgcolor: 'var(--theme-primary-color)',
                  color: 'var(--theme-secondary-color)',
                  '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.95)' }
                }}
              >
                Close
              </Button>
            </Box>
          </Stack>
        ) : null}
      </MainCard>
    </Box>
  );
}
