import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
// project imports
import MainCard from 'ui-component/cards/MainCard';

// assets
import UserRound from 'assets/images/users/profile.jpeg';
import MemberCardPhotoSection from '../singlesShared/MemberCardPhotoSection';
import { SINGLES_GRID_OUTER_SX, SINGLES_MEMBER_GRID_SX } from '../singlesShared/singlesGridSx';

import { useGetInterestedSingles, postInterestedRequestInfo, postNotInterested } from '../../../api/interestedSinglesFe';
import { useSinglesPreferences } from '../../../api/singlesPreferencesFe';
import { useAuth } from 'contexts/AuthContext';
import ServiceNoticeModal from 'ui-component/ServiceNoticeModal';
import { getDesktopButtonFontSizeVw, getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import {
  getMobileSinglesButtonFontSizeVw,
  getMobileSinglesTextFontSizeVw,
  getMobileSinglesTitleFontSizeVw
} from 'config/singlesMemberCardFontEnv';
import { isApiInfrastructureError } from 'utils/apiInfrastructureError';
import { formatMemberLabel, formatMemberNumber } from 'utils/memberLabel';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

// ==============================|| INTERESTED (clone of All Singles UI; data from requests) ||============================== //

const INSTRUCTION_POPUP_TEXT =
  "Spot someone who catches your eye from 'All Singles' menu? Simply click 'My Pick' to start your journey! From there, you can flutter over to 'Picks & Posts' to explore their life stories and get a glimpse into their world.\n\nWant to know a little more? Click 'Bio Request' to ask for their brief or full bio.";

const FILTER_AGE_MIN = 18;
const FILTER_AGE_MAX = 99;
const FILTER_DISTANCE_MIN = 0;
const FILTER_DISTANCE_MAX = 100;

/** US zip lookup: `https://api.zippopotam.us/us/{zip}` — UI accepts 5-digit zip only */
const ZIP_DIGITS_MAX = 5;
const ZIP_LOOKUP_COUNTRY_CODE = 'us';
const FE_DEBUG_ENABLED = String(import.meta.env.FE_DEBUG ?? '').trim().toLowerCase() === 'true';
const ON_LIGHT_INTERESTED_CELL_TEXT_COLOR = 'var(--theme-on-light-surface-color, var(--theme-primary-color))';
function isRequestedState(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested';
}

function sanitizeUsZipDigits(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, ZIP_DIGITS_MAX);
}

function parsePlaceLabel(label) {
  const text = String(label ?? '').trim();
  if (!text) return { city: '', state: '' };
  const idx = text.lastIndexOf(',');
  if (idx === -1) return { city: text, state: '' };
  return {
    city: text.slice(0, idx).trim(),
    state: text.slice(idx + 1).trim()
  };
}

function formatPlaceLabel(city, state) {
  const cityText = String(city ?? '').trim();
  const stateText = String(state ?? '').trim();
  if (cityText && stateText) return `${cityText}, ${stateText}`;
  return cityText || stateText;
}

function cityStateFromZippopotam(place) {
  if (!place || typeof place !== 'object') return { city: '', state: '' };
  return {
    city: String(place['place name'] ?? '').trim(),
    state: String(place['state abbreviation'] ?? place['state'] ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
  };
}

export default function InterestedSingles() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, profilePhotoCacheBust } = useAuth();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState('');
  const { interestedSingles, interestedSinglesLoading, interestedSinglesError, refetch: refetchInterested } =
    useGetInterestedSingles();
  const [requestBusyKey, setRequestBusyKey] = useState('');
  const [notInterestedBusyId, setNotInterestedBusyId] = useState(null);
  const [requestToggleState, setRequestToggleState] = useState({});

  /** API returns singles_id_to + profile; normalize to same shape as All Singles cards */
  const singles = useMemo(() => {
    if (!interestedSingles?.length) return [];
    return interestedSingles
      .map((row) => {
        const id = Number(row.singles_id_to);
        if (!Number.isFinite(id)) return null;
        return {
          singles_id: id,
          prefix: row.prefix ?? null,
          member_id: row.member_id ?? null,
          alias: row.alias ?? null,
          profile_image_url: row.profile_image_url,
          gallery_image_urls: Array.isArray(row.gallery_image_urls) ? row.gallery_image_urls : [],
          brief_bio_request: isRequestedState(row.brief_bio_request) ? 'requested' : 'notrequested',
          full_bio_request: isRequestedState(row.full_bio_request) ? 'requested' : 'notrequested',
          vetted_basic_status: row.vetted_basic_status,
          vetting_completion: {
            basicCompletedCount: Number(row?.vetting_completion?.basicCompletedCount ?? 0),
            detailCompletedCount: Number(row?.vetting_completion?.detailCompletedCount ?? 0)
          }
        };
      })
      .filter(Boolean);
  }, [interestedSingles]);

  useEffect(() => {
    const next = {};
    for (const person of singles) {
      next[person.singles_id] = {
        brief_bio_request: isRequestedState(person.brief_bio_request) ? 'requested' : 'notrequested',
        full_bio_request: isRequestedState(person.full_bio_request) ? 'requested' : 'notrequested'
      };
    }
    setRequestToggleState(next);
  }, [singles]);

  /** Applied filters (summary bar + list filtering where supported) */
  const [appliedAge, setAppliedAge] = useState([21, 35]);
  const [appliedDistanceMiles, setAppliedDistanceMiles] = useState(50);
  const [appliedPostcode, setAppliedPostcode] = useState('22003');
  const [appliedVettedOnly, setAppliedVettedOnly] = useState(false);
  /** City, state (or place) from postcode lookup; shown in modal and filter summary */
  const [appliedPlaceLabel, setAppliedPlaceLabel] = useState('');

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftAge, setDraftAge] = useState([21, 35]);
  const [draftDistanceMiles, setDraftDistanceMiles] = useState(50);
  const [draftPostcode, setDraftPostcode] = useState('22003');
  const [draftVettedOnly, setDraftVettedOnly] = useState(false);
  const [draftMember, setDraftMember] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftState, setDraftState] = useState('');
  const [postcodeLookupLoading, setPostcodeLookupLoading] = useState(false);
  const [postcodeLookupError, setPostcodeLookupError] = useState('');
  const postcodeLookupAbortRef = useRef(null);

  useEffect(() => {
    if (interestedSinglesError && !isApiInfrastructureError(interestedSinglesError)) {
      console.warn('[InterestedSingles] load error', interestedSinglesError?.message ?? interestedSinglesError);
    }
  }, [interestedSinglesError]);
  const { preferences, preferencesLoading } = useSinglesPreferences();

  const [instructionOpen, setInstructionOpen] = useState(false);

  useEffect(() => {
    if (!preferences || preferencesLoading) return;

    const { search_partner_age_from, search_partner_age_to, search_partner_zipcode } = preferences;

    if (search_partner_zipcode) {
      setAppliedPostcode(sanitizeUsZipDigits(search_partner_zipcode));
    }
    if (search_partner_age_from != null && search_partner_age_to != null) {
      setAppliedAge([Number(search_partner_age_from), Number(search_partner_age_to)]);
    }
  }, [preferences, preferencesLoading]);

  const openFilterModal = () => {
    setDraftAge([...appliedAge]);
    setDraftDistanceMiles(appliedDistanceMiles);
    setDraftPostcode(sanitizeUsZipDigits(appliedPostcode));
    setDraftVettedOnly(appliedVettedOnly);
    setDraftMember(String(searchQuery).replace(/\D/g, '').slice(0, 8));
    const { city, state } = parsePlaceLabel(appliedPlaceLabel);
    setDraftCity(city);
    setDraftState(state);
    setPostcodeLookupError('');
    setFilterModalOpen(true);
  };

  const runPostcodeLookup = useCallback(async () => {
    const raw = draftPostcode.trim();
    if (!raw) {
      setDraftCity('');
      setDraftState('');
      setPostcodeLookupError('');
      return;
    }
    const normalized = raw.replace(/\s+/g, '');
    postcodeLookupAbortRef.current?.abort();
    const ac = new AbortController();
    postcodeLookupAbortRef.current = ac;
    setPostcodeLookupLoading(true);
    setPostcodeLookupError('');
    try {
      const url = `https://api.zippopotam.us/${ZIP_LOOKUP_COUNTRY_CODE}/${encodeURIComponent(normalized)}`;
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) {
        setDraftCity('');
        setDraftState('');
        setPostcodeLookupError('No match for that zip code.');
        return;
      }
      const data = await res.json();
      const place = data?.places?.[0];
      const { city, state } = cityStateFromZippopotam(place);
      if (!city && !state) {
        setDraftCity('');
        setDraftState('');
        setPostcodeLookupError('No place data in response.');
        return;
      }
      setDraftCity(city);
      setDraftState(state);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setDraftCity('');
      setDraftState('');
      setPostcodeLookupError('Lookup failed. Try again.');
    } finally {
      setPostcodeLookupLoading(false);
    }
  }, [draftPostcode]);

  useEffect(() => {
    if (!filterModalOpen) postcodeLookupAbortRef.current?.abort();
  }, [filterModalOpen]);

  const filteredInterestedSingles = (singles || []).filter((person_CCCCCCCC) => {
    if (appliedVettedOnly && !person_CCCCCCCC.vetted_basic_status) return false;
    const query = searchQuery.toLowerCase();
    const memberNumber =
      formatMemberNumber(person_CCCCCCCC.prefix, person_CCCCCCCC.member_id) ??
      String(person_CCCCCCCC.singles_id).padStart(8, '0');
    const memberId = `member ${memberNumber}`;
    return memberId.includes(query);
  });

  const requestButtonStatusText = (completedCount, kind) => {
    const prefix = kind === 'brief' ? 'Brief Info Vetting' : 'Full Info Vetting';
    if (completedCount <= 0) return kind === 'full' ? 'Full Bios Not Ready' : `${prefix} not started`;
    if (kind === 'brief' && completedCount >= 2) return 'Brief Bios Ready';
    if (kind === 'full' && completedCount >= 3) return 'Full Info Vetting Completed';
    if (kind === 'full') return 'Full Bios Not Ready';
    if (completedCount <= 2) return `${prefix} not completed`;
    return `${prefix} Completed`;
  };

  const handleToggleRequest = async (singles_id, fieldName) => {
    if (requestBusyKey) return;
    const current = isRequestedState(requestToggleState?.[singles_id]?.[fieldName]);
    const nextValue = current ? 'notrequested' : 'requested';
    const busyKey = `${singles_id}:${fieldName}`;
    setRequestBusyKey(busyKey);
    setRequestToggleState((prev) => ({
      ...prev,
      [singles_id]: {
        brief_bio_request: isRequestedState(prev?.[singles_id]?.brief_bio_request) ? 'requested' : 'notrequested',
        full_bio_request: isRequestedState(prev?.[singles_id]?.full_bio_request) ? 'requested' : 'notrequested',
        [fieldName]: nextValue
      }
    }));
    try {
      await postInterestedRequestInfo(singles_id, {
        [fieldName]: nextValue
      });
      await refetchInterested();
    } catch (err) {
      console.error('[InterestedSingles] request toggle failed', err?.message ?? err);
      setRequestToggleState((prev) => ({
        ...prev,
        [singles_id]: {
          brief_bio_request: isRequestedState(prev?.[singles_id]?.brief_bio_request) ? 'requested' : 'notrequested',
          full_bio_request: isRequestedState(prev?.[singles_id]?.full_bio_request) ? 'requested' : 'notrequested',
          [fieldName]: current ? 'requested' : 'notrequested'
        }
      }));
    } finally {
      setRequestBusyKey('');
    }
  };

  const handleApplyFilterSearch = () => {
    setAppliedAge([...draftAge]);
    setAppliedDistanceMiles(draftDistanceMiles);
    setAppliedPostcode(sanitizeUsZipDigits(draftPostcode));
    setAppliedVettedOnly(draftVettedOnly);
    setAppliedPlaceLabel(formatPlaceLabel(draftCity, draftState));
    setSearchQuery(draftMember.trim());
    setFilterModalOpen(false);
  };

  const handleResetFilter = () => {
    const resetAge = [FILTER_AGE_MIN, FILTER_AGE_MAX];
    setDraftAge(resetAge);
    setDraftDistanceMiles(FILTER_DISTANCE_MAX);
    setDraftPostcode('');
    setDraftCity('');
    setDraftState('');
    setDraftVettedOnly(false);
    setDraftMember('');
    setPostcodeLookupError('');
    postcodeLookupAbortRef.current?.abort();

    setAppliedAge(resetAge);
    setAppliedDistanceMiles(FILTER_DISTANCE_MAX);
    setAppliedPostcode('');
    setAppliedPlaceLabel('');
    setAppliedVettedOnly(false);
    setSearchQuery('');
    setFilterModalOpen(false);
  };

  const openInterestedAlbum = (person) => {
    const id = Number(person?.singles_id);
    if (!Number.isFinite(id) || id < 1) return;
    const gallery = Array.isArray(person?.gallery_image_urls) ? person.gallery_image_urls.filter(Boolean) : [];
    const profile = typeof person?.profile_image_url === 'string' ? person.profile_image_url : '';
    const imageUrls = [...new Set([profile, ...gallery].filter(Boolean))];
    navigate('/publicPrivateAlbum', {
      state: {
        targetSinglesId: id,
        memberLabel: formatMemberLabel({
          alias: person?.alias,
          singlesId: person?.singles_id,
          prefix: person?.prefix,
          memberId: person?.member_id
        }),
        imageUrls
      }
    });
  };

  const handleMarkNotInterested = async (singlesIdTo) => {
    if (notInterestedBusyId != null || requestBusyKey) return;
    setNotInterestedBusyId(singlesIdTo);
    try {
      await postNotInterested(singlesIdTo);
      await refetchInterested();
    } catch (err) {
      console.error('[InterestedSingles] mark not interested failed', err?.message ?? err);
    } finally {
      setNotInterestedBusyId(null);
    }
  };

  const filterSummaryText = `Current Filter: age ${appliedAge[0]} to ${appliedAge[1]}, live within ${appliedDistanceMiles} miles ${appliedPostcode}${
    appliedPlaceLabel ? ` (${appliedPlaceLabel})` : ''
  }, people you marked interested${appliedVettedOnly ? ', vetted status' : ''}`;

  if (interestedSinglesError && isApiInfrastructureError(interestedSinglesError)) {
    return <ServiceNoticeModal onExit={() => window.close()} />;
  }

  return (
    <MainCard
      sx={{
        flex: { xs: '0 1 auto', sm: 1 },
        height: { xs: 'auto', sm: '100%' },
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: { xs: 'visible', sm: 'hidden' }
      }}
      contentSX={{
        flex: { xs: '0 1 auto', sm: 1 },
        display: 'flex',
        flexDirection: 'column',
        height: { xs: 'auto', sm: '100%' },
        minHeight: 0,
        overflowY: { xs: 'visible', sm: 'hidden' },
        overflowX: 'hidden'
      }}
      headerSX={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
      title={
        <Typography
          sx={{
            fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
            color: 'var(--theme-primary-color)'
          }}
        >
          Interested
        </Typography>
      }
        secondary={<PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />}
    >
      <Box
        data-suppress-touch-contextmenu="true"
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.5,
          mb: downSM ? 1.5 : 2,
          flexShrink: 0,
          px: { xs: 0.5, sm: 0 },
          WebkitTouchCallout: 'none'
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            py: 1.25,
            px: 2,
            borderRadius: 1,
            bgcolor: 'var(--theme-secondary-color)',
            border: '1px solid',
            borderColor: 'var(--theme-primary-color)'
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'var(--theme-primary-color)',
              fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
              lineHeight: 1.45
            }}
          >
            {filterSummaryText}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={openFilterModal}
          sx={{
            flexShrink: 0,
            alignSelf: { xs: 'stretch', sm: 'center' },
            bgcolor: 'var(--theme-secondary-color)',
            color: 'var(--theme-primary-color)',
            borderColor: 'var(--theme-primary-color)',
            fontWeight: 700,
            textTransform: 'none',
            px: 3,
            py: 1,
            transformOrigin: 'center center',
            ...buttonHoverMagnifyTransitionSx,
            zIndex: 1,
            '&:hover, &:focus-visible': {
              bgcolor: 'var(--theme-secondary-color)',
              color: 'var(--theme-primary-color)',
              borderColor: 'var(--theme-primary-color)',
              filter: 'brightness(0.92)',
              ...buttonHoverMagnifyFontSx()
            }
          }}
        >
          Edit filter
        </Button>
      </Box>

      <PageInstructionPopup
        open={instructionOpen}
        onClose={() => setInstructionOpen(false)}
        closeOnBackdrop
        bodyTextAlignLeft
        centeredLeadLines={1}
      >
        <PageInstructionPopup.Body>
          <PageInstructionPopup.Title>Instruction for this page</PageInstructionPopup.Title>
          <PageInstructionPopup.BodyText sx={{ whiteSpace: 'pre-line' }}>
            {INSTRUCTION_POPUP_TEXT}
          </PageInstructionPopup.BodyText>
        </PageInstructionPopup.Body>
      </PageInstructionPopup>

      <ColorTemplate7PopupLargeDark
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close search filter"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.Title>
            Ready for a new adventure?
            <br />
            Let&apos;s find someone special
          </ColorTemplate7PopupLargeDark.Title>

          <ColorTemplate7PopupLargeDark.FormRows>
            <ColorTemplate7PopupLargeDark.FormRow label="Vetted status">
              <ColorTemplate7PopupLargeDark.Checkbox
                checked={draftVettedOnly}
                onChange={(e) => setDraftVettedOnly(e.target.checked)}
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            <ColorTemplate7PopupLargeDark.FormRow
              label={`Age: between ${draftAge[0]} and ${draftAge[1]} years old`}
            >
              <ColorTemplate7PopupLargeDark.Slider
                formRow
                value={draftAge}
                onChange={(_, v) => setDraftAge(v)}
                min={FILTER_AGE_MIN}
                max={FILTER_AGE_MAX}
                valueLabelDisplay="auto"
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            <ColorTemplate7PopupLargeDark.FormRow label="zipcode">
              <ColorTemplate7PopupLargeDark.Input
                formRow
                id="interested-filter-zipcode-input"
                value={draftPostcode}
                onChange={(e) => {
                  setDraftPostcode(sanitizeUsZipDigits(e.target.value));
                  setPostcodeLookupError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runPostcodeLookup();
                  }
                }}
                placeholder="5-digit zip"
                inputProps={{
                  maxLength: ZIP_DIGITS_MAX,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  'aria-label': 'Zipcode, 5 digits'
                }}
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            {postcodeLookupError ? (
              <ColorTemplate7PopupLargeDark.ErrorBar>{postcodeLookupError}</ColorTemplate7PopupLargeDark.ErrorBar>
            ) : null}

            <ColorTemplate7PopupLargeDark.FormRow label="City, State">
              {postcodeLookupLoading ? (
                <CircularProgress size={22} />
              ) : (
                <ColorTemplate7PopupLargeDark.FormRowControls>
                  <ColorTemplate7PopupLargeDark.Input
                    formRow
                    fullWidth
                    value={draftCity}
                    onChange={(e) => setDraftCity(e.target.value)}
                    placeholder="City"
                    inputProps={{ 'aria-label': 'City' }}
                  />
                  <ColorTemplate7PopupLargeDark.Input
                    formRow
                    value={draftState}
                    onChange={(e) => setDraftState(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                    placeholder="State"
                    inputProps={{ 'aria-label': 'State abbreviation', maxLength: 2 }}
                    sx={{
                      width: { xs: '100%', sm: '8ch' },
                      maxWidth: { xs: '100%', sm: '8ch' },
                      flex: { xs: '1 1 auto', sm: '0 0 auto' }
                    }}
                  />
                </ColorTemplate7PopupLargeDark.FormRowControls>
              )}
            </ColorTemplate7PopupLargeDark.FormRow>

            <ColorTemplate7PopupLargeDark.FormRow label={`Distance: ${draftDistanceMiles} miles`}>
              <ColorTemplate7PopupLargeDark.Slider
                formRow
                value={draftDistanceMiles}
                onChange={(_, v) => setDraftDistanceMiles(v)}
                min={FILTER_DISTANCE_MIN}
                max={FILTER_DISTANCE_MAX}
                step={1}
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            <ColorTemplate7PopupLargeDark.FormRow label="Member#:">
              <ColorTemplate7PopupLargeDark.Input
                formRow
                value={draftMember}
                onChange={(e) => setDraftMember(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="e.g. 00863887"
                inputProps={{
                  'aria-label': 'Member number filter',
                  maxLength: 8,
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
              />
            </ColorTemplate7PopupLargeDark.FormRow>
          </ColorTemplate7PopupLargeDark.FormRows>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
            <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={handleResetFilter}>
              Reset
            </ColorTemplate7PopupLargeDark.ActionButton>
            <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={handleApplyFilterSearch}>
              Search
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      {interestedSinglesLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {interestedSinglesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load interested singles. Please try again later.
          <Box component="pre" sx={{ mt: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 120 }}>
            {interestedSinglesError?.message ?? String(interestedSinglesError)}
          </Box>
        </Alert>
      )}
      
      {!interestedSinglesLoading && !interestedSinglesError && (
        <Box
          sx={{
            width: '100%',
            flex: { xs: '0 1 auto', sm: 1 },
            minHeight: 0,
            mb: 0,
            overflowY: { xs: 'visible', sm: 'hidden' },
            overflowX: 'hidden'
          }}
        >
          <Box sx={SINGLES_GRID_OUTER_SX}>
            <Box sx={SINGLES_MEMBER_GRID_SX}>
            {filteredInterestedSingles.map((personIndex_DDDDDDD) => {
              const memberLabel = formatMemberLabel({
                alias: personIndex_DDDDDDD.alias,
                singlesId: personIndex_DDDDDDD.singles_id,
                prefix: personIndex_DDDDDDD.prefix,
                memberId: personIndex_DDDDDDD.member_id
              });
              const memberToggleState = requestToggleState?.[personIndex_DDDDDDD.singles_id] ?? {};
              const basicActive = isRequestedState(memberToggleState.brief_bio_request);
              const detailsActive = isRequestedState(memberToggleState.full_bio_request);
              
              const basicCompletedCount = Number(personIndex_DDDDDDD?.vetting_completion?.basicCompletedCount ?? 0);

              const detailCompletedCount = Number(personIndex_DDDDDDD?.vetting_completion?.detailCompletedCount ?? 0);

              const basicEligible = basicCompletedCount >= 2;
              const detailEligible = detailCompletedCount >= 3;
              const basicCompletedUi = basicCompletedCount >= 2;
              const basicButtonText = basicCompletedUi ? 'Brief Bios Ready' : requestButtonStatusText(basicCompletedCount, 'brief');
              const detailButtonText = requestButtonStatusText(detailCompletedCount, 'full');
              const basicRequestedUi = basicEligible && basicActive;
              const detailRequestedUi = detailEligible && detailsActive;
              let imgSrc =
                personIndex_DDDDDDD.profile_image_url && personIndex_DDDDDDD.profile_image_url !== 'profile.jpeg'
                  ? personIndex_DDDDDDD.profile_image_url
                  : UserRound;
              if (
                typeof imgSrc === 'string' &&
                imgSrc.includes('/api/photo/') &&
                user?.singles_id != null &&
                personIndex_DDDDDDD.singles_id === user.singles_id
              ) {
                const sep = imgSrc.includes('?') ? '&' : '?';
                imgSrc = `${imgSrc}${sep}v=${profilePhotoCacheBust}`;
              }
              return (
                <Box key={personIndex_DDDDDDD.singles_id} sx={{ minHeight: { xs: 'auto', sm: 0 } }}>
                  <Card
                    data-suppress-touch-contextmenu="true"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      height: { xs: 'auto', sm: '100%' },
                      minHeight: { xs: 'auto', sm: 0 },
                      backgroundColor: 'var(--theme-secondary-color)',
                      border: '1px solid var(--theme-primary-color)',
                      overflow: 'visible',
                      WebkitTouchCallout: 'none',
                      '&:hover': { boxShadow: 6 }
                    }}
                  >
                    <Box
                      sx={{
                        flex: { xs: '0 0 auto', sm: 1 },
                        minHeight: { sm: 0 },
                        minWidth: 0,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <MemberCardPhotoSection
                        downSM={downSM}
                        memberLabel={memberLabel}
                        singlesId={personIndex_DDDDDDD.singles_id}
                        desktopImageSrc={imgSrc}
                        galleryImageUrls={personIndex_DDDDDDD.gallery_image_urls ?? []}
                        vettedStatus={personIndex_DDDDDDD.vetted_basic_status}
                        userSinglesId={user?.singles_id}
                        profilePhotoCacheBust={profilePhotoCacheBust}
                        onPhotoDoubleClick={() => openInterestedAlbum(personIndex_DDDDDDD)}
                      />
                    </Box>
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: '100%',
                        bgcolor: { xs: 'var(--theme-secondary-color)', sm: 'var(--theme-secondary-color)' },
                        boxSizing: 'border-box',
                        px: { xs: 1.5, sm: 1 },
                        py: { xs: 1.5, sm: 1 },
                        display: 'flex',
                        flexDirection: 'column',
                        gap: { xs: 1.25, sm: 0 },
                        overflow: 'visible'
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        component="div"
                        sx={{
                          display: { xs: 'block', sm: 'none' },
                          color: 'var(--theme-primary-color)',
                          fontWeight: 700,
                          textAlign: 'center',
                          lineHeight: 1.25,
                          fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
                          wordBreak: 'break-word'
                        }}
                      >
                        {memberLabel}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: { xs: 1.5, sm: 1 },
                          width: '100%'
                        }}
                      >
                      <Button
                        fullWidth
                        color="inherit"
                        variant="contained"
                        size="small"
                        disabled={Boolean(requestBusyKey) || notInterestedBusyId != null}
                        onClick={() => handleMarkNotInterested(personIndex_DDDDDDD.singles_id)}
                        sx={{
                          width: '100%',
                          bgcolor: 'var(--theme-primary-color)',
                          color: 'var(--theme-secondary-color)',
                          border: basicCompletedUi ? '2px solid #1b5e20' : '1px solid var(--theme-primary-color)',
                          boxShadow: 'none',
                          fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                          fontWeight: { xs: 700, sm: 400 },
                          textTransform: 'none',
                          py: { xs: 1.75, sm: 0.65 },
                          minHeight: { xs: 68, sm: 34 },
                          zIndex: 1,
                          transformOrigin: 'center center',
                          ...buttonHoverMagnifyTransitionSx,
                          '&:hover, &:focus-visible': {
                            bgcolor: 'var(--theme-primary-color)',
                            border: basicCompletedUi ? '2px solid #1b5e20' : '1px solid var(--theme-primary-color)',
                            color: 'var(--theme-secondary-color)',
                            filter: 'brightness(0.95)',
                            ...buttonHoverMagnifyFontSx(),
                            zIndex: 3
                          },
                          '&.Mui-disabled': {
                            border: basicCompletedUi ? '2px solid #1b5e20' : '1px solid var(--theme-primary-color)',
                            color: 'var(--theme-secondary-color)',
                            opacity: 0.85
                          }
                        }}
                      >
                        {notInterestedBusyId === personIndex_DDDDDDD.singles_id ? (
                          <CircularProgress size={18} sx={{ color: 'var(--theme-secondary-color)' }} />
                        ) : (
                          'Mark Not Interested'
                        )}
                      </Button>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          justifyContent: { sm: 'center' },
                          alignItems: 'stretch',
                          gap: { xs: 1.5, sm: 1 },
                          width: '100%'
                        }}
                      >
                      <Button
                        fullWidth={downSM}
                        color="inherit"
                        variant="contained"
                        size="small"
                        disabled={Boolean(requestBusyKey) || !basicEligible}
                        onClick={() => handleToggleRequest(personIndex_DDDDDDD.singles_id, 'brief_bio_request')}
                        sx={{
                          flex: { xs: 'none', sm: 1 },
                          minWidth: { sm: 0 },
                          backgroundColor: !basicEligible ? '#9e9e9e' : basicRequestedUi ? '#ffeb3b' : basicCompletedUi ? '#ffffff' : 'var(--theme-secondary-color)',
                          color: !basicEligible
                            ? '#ffffff'
                            : basicRequestedUi
                              ? 'var(--theme-primary-color)'
                              : basicCompletedUi
                              ? ON_LIGHT_INTERESTED_CELL_TEXT_COLOR
                              : 'var(--theme-primary-color)',
                          border: '1px solid var(--theme-primary-color)',
                          boxShadow: 'none',
                          fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                          fontWeight: { xs: 700, sm: 400 },
                          textTransform: 'none',
                          py: { xs: 1.75, sm: 0.65 },
                          minHeight: { xs: 68, sm: 34 },
                          zIndex: 1,
                          transformOrigin: 'center center',
                          ...buttonHoverMagnifyTransitionSx,
                          '&.MuiButton-contained': {
                            backgroundColor: !basicEligible ? '#9e9e9e' : basicRequestedUi ? '#ffeb3b' : basicCompletedUi ? '#ffffff' : 'var(--theme-secondary-color)',
                            color: !basicEligible
                              ? '#ffffff'
                              : basicRequestedUi
                                ? 'var(--theme-primary-color)'
                                : basicCompletedUi
                                ? ON_LIGHT_INTERESTED_CELL_TEXT_COLOR
                                : 'var(--theme-primary-color)'
                          },
                          '&:hover, &:focus-visible': {
                            backgroundColor: !basicEligible
                              ? '#9e9e9e'
                              : basicRequestedUi
                                ? '#fdd835'
                              : basicCompletedUi
                                ? '#ffffff'
                                : 'var(--theme-secondary-color)',
                            border: basicCompletedUi ? '2px solid #1b5e20' : '1px solid var(--theme-primary-color)',
                            color: !basicEligible
                              ? '#ffffff'
                              : basicRequestedUi
                                ? 'var(--theme-primary-color)'
                                : basicCompletedUi
                                ? ON_LIGHT_INTERESTED_CELL_TEXT_COLOR
                                : 'var(--theme-primary-color)',
                            filter: basicRequestedUi ? 'none' : 'brightness(0.95)',
                            ...buttonHoverMagnifyFontSx(),
                            zIndex: 3
                          },
                          '&.Mui-disabled': {
                            backgroundColor: !basicEligible ? '#9e9e9e' : basicRequestedUi ? '#ffeb3b' : basicCompletedUi ? '#ffffff' : 'var(--theme-secondary-color)',
                            color: !basicEligible
                              ? '#ffffff'
                              : basicRequestedUi
                                ? 'var(--theme-primary-color)'
                                : basicCompletedUi
                                ? ON_LIGHT_INTERESTED_CELL_TEXT_COLOR
                                : 'var(--theme-primary-color)',
                            border: '1px solid var(--theme-primary-color)',
                            opacity: 0.85
                          }
                        }}
                      >
                        {requestBusyKey === `${personIndex_DDDDDDD.singles_id}:brief_bio_request` ? (
                          <CircularProgress
                            size={18}
                            sx={{
                              color: !basicEligible
                                ? '#ffffff'
                                : basicRequestedUi
                                  ? 'var(--theme-primary-color)'
                                  : basicCompletedUi
                                  ? ON_LIGHT_INTERESTED_CELL_TEXT_COLOR
                                  : 'var(--theme-primary-color)'
                            }}
                          />
                        ) : (
                          <Box component="span" sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                            <Box component="span">{basicRequestedUi ? 'Brief Bios Requested' : basicButtonText}</Box>
                            {FE_DEBUG_ENABLED ? (
                              <Box component="span" sx={{ fontSize: '0.8em', mt: 0.2 }}>
                                {basicCompletedCount}
                              </Box>
                            ) : null}
                          </Box>
                        )}
                      </Button>
                      <Button
                        fullWidth={downSM}
                        color="inherit"
                        variant="contained"
                        size="small"
                        disabled={Boolean(requestBusyKey) || !detailEligible}
                        onClick={() => handleToggleRequest(personIndex_DDDDDDD.singles_id, 'full_bio_request')}
                        sx={{
                          flex: { xs: 'none', sm: 1 },
                          minWidth: { sm: 0 },
                          backgroundColor: !detailEligible ? '#9e9e9e' : detailRequestedUi ? '#ffeb3b' : 'var(--theme-secondary-color)',
                          color: !detailEligible ? '#ffffff' : 'var(--theme-primary-color)',
                          border: '1px solid var(--theme-primary-color)',
                          boxShadow: 'none',
                          fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                          py: { xs: 1.75, sm: 0.65 },
                          minHeight: { xs: 68, sm: 34 },
                          lineHeight: 1.1,
                          fontWeight: 700,
                          textTransform: 'none',
                          zIndex: 1,
                          transformOrigin: 'center center',
                          ...buttonHoverMagnifyTransitionSx,
                          '&.MuiButton-contained': {
                            backgroundColor: !detailEligible ? '#9e9e9e' : detailRequestedUi ? '#ffeb3b' : 'var(--theme-secondary-color)',
                            color: !detailEligible ? '#ffffff' : 'var(--theme-primary-color)'
                          },
                          '&:hover, &:focus-visible': {
                            backgroundColor: !detailEligible
                              ? '#9e9e9e'
                              : detailRequestedUi
                                ? '#fdd835'
                                : 'var(--theme-secondary-color)',
                            border: '1px solid var(--theme-primary-color)',
                            color: !detailEligible ? '#ffffff' : 'var(--theme-primary-color)',
                            filter: detailRequestedUi ? 'none' : 'brightness(0.95)',
                            ...buttonHoverMagnifyFontSx(),
                            zIndex: 3
                          },
                          '&.Mui-disabled': {
                            backgroundColor: !detailEligible ? '#9e9e9e' : detailRequestedUi ? '#ffeb3b' : 'var(--theme-secondary-color)',
                            color: !detailEligible ? '#ffffff' : 'var(--theme-primary-color)',
                            border: '1px solid var(--theme-primary-color)',
                            opacity: 0.85
                          }
                        }}
                      >
                        {requestBusyKey === `${personIndex_DDDDDDD.singles_id}:full_bio_request` ? (
                          <CircularProgress size={18} sx={{ color: !detailEligible ? '#ffffff' : 'var(--theme-primary-color)' }} />
                        ) : (
                          <Box component="span" sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                            <Box component="span">{detailRequestedUi ? 'Full Info Requested' : detailButtonText}</Box>
                            {FE_DEBUG_ENABLED ? (
                              <Box component="span" sx={{ fontSize: '0.8em', mt: 0.2 }}>
                                {detailCompletedCount}
                              </Box>
                            ) : null}
                          </Box>
                        )}
                      </Button>
                      </Box>
                      </Box>
                    </Box>
                  </Card>
                </Box>
              );
            })}
          </Box>
            </Box>
        </Box>
      )}
      </MainCard>
  );
}
