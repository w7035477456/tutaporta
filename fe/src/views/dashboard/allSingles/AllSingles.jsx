import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import EarnTokensPageTitle from 'ui-component/EarnTokensPageTitle';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import FriendshipStatesDiagramZoom from 'ui-component/FriendshipStatesDiagramZoom';
import friendShipStatesAllSinglesImg from 'assets/images/friendShipStates_AllSingles.png';
// project imports
import MainCard from 'ui-component/cards/MainCard';

// assets
import UserRound from 'assets/images/users/profile.jpeg';
import verifiedSeal from 'assets/images/verifiedSeal.png';
import audioAllSinglesSora from 'assets/sound/all_singles_instruction_Sora.m4a';
import audioAllSinglesJessica from 'assets/sound/all_singles_instruction_Jessica.m4a';
import audioAllSinglesMichael from 'assets/sound/all_singles_instruction_Michael.m4a';
import ColorTemplate8PhotoGallery from 'ui-component/ColorTemplate8PhotoGallery';
import {
  colorTemplate8PhotoGalleryWrapItemSx,
  colorTemplate8PhotoGalleryWrapListSx,
  colorTemplate8PhotoGalleryWrapShellSx
} from 'config/colorTemplate8PhotoGallery';

//import { useGetAllSingles } from 'api/allSinglesFe';
import { useGetAllSingles, postMarkInterested } from '../../../api/allSinglesFe';
import { fetchUserCustomization, saveUserCustomization } from '../../../api/userCustomizationFe';
import { useSinglesPreferences } from '../../../api/singlesPreferencesFe';
import { useAuth } from 'contexts/AuthContext';
import ServiceNoticeModal from 'ui-component/ServiceNoticeModal';
import {
  getDesktopTextFontSizeVw,
  getDesktopTitleFontSizeVw
} from 'config/desktopFontEnv';
import {
  getMobileSinglesTextFontSizeVw,
  getMobileSinglesTitleFontSizeVw
} from 'config/singlesMemberCardFontEnv';
import { isApiInfrastructureError } from 'utils/apiInfrastructureError';
import { isToolsOnlyAdminSession } from 'utils/adminSession';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { formatMemberLabel, formatMemberNumber, getMemberDisplayLines } from 'utils/memberLabel';
import {
  ALL_SINGLES_INSTRUCTION_CONTEXT_STEP,
  ALL_SINGLES_INSTRUCTION_CONTEXT_TITLE,
  ALL_SINGLES_INSTRUCTION_POPUP_TEXT,
  ALL_SINGLES_WELCOME_BANNER_TEXT
} from 'constants/allSinglesInstructionText';

// ==============================|| ALL SINGLES ||============================== //

const INSTRUCTION_POPUP_TEXT = ALL_SINGLES_INSTRUCTION_POPUP_TEXT;

const ALL_SINGLES_INSTRUCTION_AUDIO_BY_VOICE = {
  Sora: typeof audioAllSinglesSora === 'string' ? audioAllSinglesSora : audioAllSinglesSora?.default || '',
  Jessica:
    typeof audioAllSinglesJessica === 'string' ? audioAllSinglesJessica : audioAllSinglesJessica?.default || '',
  Michael:
    typeof audioAllSinglesMichael === 'string' ? audioAllSinglesMichael : audioAllSinglesMichael?.default || ''
};

const allSinglesGalleryItemSx = colorTemplate8PhotoGalleryWrapItemSx();

const allSinglesVerifiedSealSx = {
  position: 'absolute',
  right: '-4%',
  bottom: '-4%',
  width: '32%',
  height: 'auto',
  maxWidth: 'none',
  objectFit: 'contain',
  pointerEvents: 'none',
  zIndex: 4,
  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))'
};

const WELCOME_PANEL_HEADER_BG = 'grey.300';
const WELCOME_PANEL_CHEVRON_SIZE = 32;
const WELCOME_PANEL_CHEVRON_STROKE = 4.5;

function WelcomePanelChevron({ expanded, onToggle }) {
  const ToggleIcon = expanded ? IconChevronDown : IconChevronRight;
  return (
    <Box
      component="button"
      type="button"
      aria-label={expanded ? 'Collapse welcome text' : 'Expand welcome text'}
      onClick={onToggle}
      {...guestDemoAllowProps()}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
        m: 0,
        lineHeight: 0,
        border: 'none',
        bgcolor: 'transparent',
        color: 'var(--theme-primary-color)',
        cursor: 'pointer',
        flexShrink: 0
      }}
    >
      <ToggleIcon size={WELCOME_PANEL_CHEVRON_SIZE} stroke={WELCOME_PANEL_CHEVRON_STROKE} />
    </Box>
  );
}

function AllSinglesWelcomePanel({ expanded, onToggle, downSM, children }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        mb: downSM ? 1.5 : 2,
        mx: { xs: 0.5, sm: 0 },
        border: '1px solid',
        borderColor: 'var(--theme-primary-color)',
        borderRadius: 1,
        overflow: 'hidden'
      }}
    >
      <Box
        aria-expanded={expanded}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: 36,
          px: 0.75,
          py: 0.25,
          border: 'none',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'var(--theme-primary-color)',
          bgcolor: WELCOME_PANEL_HEADER_BG
        }}
      >
        <WelcomePanelChevron expanded={expanded} onToggle={onToggle} />
        <WelcomePanelChevron expanded={expanded} onToggle={onToggle} />
      </Box>
      <Collapse in={expanded} timeout="auto">
        <Box
          sx={{
            px: { xs: 1.25, sm: 1.75 },
            py: 1.25,
            bgcolor: 'var(--theme-secondary-color)'
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

const FILTER_AGE_MIN = 18;
const FILTER_AGE_MAX = 99;
const FILTER_DISTANCE_MIN = 0;
const FILTER_DISTANCE_MAX = 100;

/** US zip lookup: `https://api.zippopotam.us/us/{zip}` — UI accepts 5-digit zip only */
const ZIP_DIGITS_MAX = 5;
const ZIP_LOOKUP_COUNTRY_CODE = 'us';
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

export default function AllSingles() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, profilePhotoCacheBust } = useAuth();
  const toolsOnlyAdmin = isToolsOnlyAdminSession(user);
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState('');
  const { singles, singlesLoading, singlesError, refetch: refetchSingles } = useGetAllSingles();
  const [markInterestedBusyId, setMarkInterestedBusyId] = useState(null);
  const [markInterestedError, setMarkInterestedError] = useState('');

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
    if (singlesError && !isApiInfrastructureError(singlesError)) {
      console.warn('[AllSingles] singlesError', singlesError?.message ?? singlesError);
    }
  }, [singlesError]);
  const { preferences, preferencesLoading } = useSinglesPreferences();

  const [instructionOpen, setInstructionOpen] = useState(false);
  const [welcomeExpanded, setWelcomeExpanded] = useState(true);
  const toggleWelcomeExpanded = useCallback(() => {
    setWelcomeExpanded((open) => {
      const next = !open;
      void saveUserCustomization({ allSinglesWelcomeExpanded: next }).catch((err) => {
        console.warn('[AllSingles] save welcome panel preference failed', err?.message ?? err);
      });
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await fetchUserCustomization();
        if (!cancelled) {
          setWelcomeExpanded(prefs.allSinglesWelcomeExpanded !== false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[AllSingles] load welcome panel preference failed', err?.message ?? err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferences || preferencesLoading) return;

    const { search_partner_age_from, search_partner_age_to, search_partner_zipcode } = preferences;

    if (search_partner_zipcode) {
      setAppliedPostcode(String(search_partner_zipcode));
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

  // TEMP: filters are intentionally disabled by request.
  const filteredAllSingles_XXXXXXX = singles || [];

  const handleMarkInterested = async (singles_id) => {
    if (markInterestedBusyId != null) return;
    setMarkInterestedBusyId(singles_id);
    setMarkInterestedError('');
    try {
      await postMarkInterested(singles_id);
      await refetchSingles();
    } catch (err) {
      const message = err?.message ?? 'Could not add to My Picks. Please try again.';
      setMarkInterestedError(message);
      console.error('[AllSingles] mark interested failed', message);
    } finally {
      setMarkInterestedBusyId(null);
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

  const hasAnyFilter =
    appliedVettedOnly ||
    String(searchQuery || '').trim().length > 0 ||
    String(appliedPostcode || '').trim().length > 0 ||
    appliedDistanceMiles < FILTER_DISTANCE_MAX ||
    appliedAge[0] > FILTER_AGE_MIN ||
    appliedAge[1] < FILTER_AGE_MAX;

  const filterSummaryText = toolsOnlyAdmin
    ? 'Admin view: showing all members on the system (filters and My Picks are not used for admin)'
    : hasAnyFilter
      ? `Current Filter: age ${appliedAge[0]} to ${appliedAge[1]}, live within ${appliedDistanceMiles} miles ${
          appliedPostcode || 'any zip'
        }${appliedPlaceLabel ? ` (${appliedPlaceLabel})` : ''}, United States${appliedVettedOnly ? ', vetted status' : ''}${
          searchQuery ? `, member# ${searchQuery}` : ''
        }`
      : 'Current Filter: none (showing everyone in United States)';

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

  if (singlesError && isApiInfrastructureError(singlesError)) {
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
        <EarnTokensPageTitle>
          <Typography
            sx={{
              fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
              color: 'var(--theme-primary-color)'
            }}
          >
            All Singles
          </Typography>
        </EarnTokensPageTitle>
      }
      center={<PageVideoTutorialsButton pageKey="allSingles" />}
        secondary={<PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />}
    >
      <AllSinglesWelcomePanel expanded={welcomeExpanded} onToggle={toggleWelcomeExpanded} downSM={downSM}>
        <Typography
          component="div"
          sx={{
            color: 'var(--theme-primary-color)',
            fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
            lineHeight: 1.45,
            whiteSpace: 'pre-line'
          }}
        >
          {ALL_SINGLES_WELCOME_BANNER_TEXT}
        </Typography>
      </AllSinglesWelcomePanel>
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
            component="div"
            variant="body2"
            sx={{
              color: 'var(--theme-primary-color)',
              fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
              lineHeight: 1.45,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap'
            }}
          >
            <Box component="span">{filterSummaryText}</Box>
            {!toolsOnlyAdmin ? (
              <Box
                component="span"
                sx={{
                  color: 'var(--theme-primary-color)',
                  fontWeight: 700
                }}
              >
                (filter disabled when total members in All Singles page is too few)
              </Box>
            ) : null}
          </Typography>
        </Box>
        {!toolsOnlyAdmin ? (
          <SelectedButtonTemplate
            fitLabelWidth
            data-vsingles-tour-edit-filter=""
            onClick={openFilterModal}
            sx={{
              flexShrink: 0,
              alignSelf: { xs: 'stretch', sm: 'center' },
              px: 3,
              py: 1,
              transformOrigin: 'center center',
              zIndex: 1
            }}
          >
            Edit filter
          </SelectedButtonTemplate>
        ) : null}
      </Box>

      <PageInstructionPopup
        open={instructionOpen}
        onClose={() => setInstructionOpen(false)}
        closeOnBackdrop
        bodyTextAlignLeft
        centeredLeadLines={1}
      >
        <PageInstructionPopup.Body>
          <PageInstructionAudioTutorial
            active={instructionOpen}
            audioByVoice={ALL_SINGLES_INSTRUCTION_AUDIO_BY_VOICE}
            title={ALL_SINGLES_INSTRUCTION_CONTEXT_TITLE}
            contextStep={ALL_SINGLES_INSTRUCTION_CONTEXT_STEP}
          />
          <PageInstructionPopup.BodyText sx={{ whiteSpace: 'pre-line' }}>
            {INSTRUCTION_POPUP_TEXT}
          </PageInstructionPopup.BodyText>
          <FriendshipStatesDiagramZoom
            imageSrc={friendShipStatesAllSinglesImg}
            imageAlt="All Singles friendship states diagram"
          />
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
                id="filter-zipcode-input"
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

      {singlesLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {markInterestedError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMarkInterestedError('')}>
          {markInterestedError}
        </Alert>
      ) : null}

      {singlesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load singles. Please try again later.
          <Box component="pre" sx={{ mt: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 120 }}>
            {singlesError?.message ?? String(singlesError)}
          </Box>
        </Alert>
      )}
      
      {!singlesLoading && !singlesError && (
        <Box
          sx={{
            width: '100%',
            flex: { xs: '0 1 auto', sm: 1 },
            minHeight: 0,
            mb: 0,
            overflowY: { xs: 'visible', sm: 'auto' },
            overflowX: 'hidden'
          }}
        >
          <ColorTemplate8PhotoGallery
            fillHeight={false}
            resizable={false}
            selectedGreenBackground
            selectedAvatarCircular
            sx={colorTemplate8PhotoGalleryWrapShellSx()}
            listSx={colorTemplate8PhotoGalleryWrapListSx()}
          >
            {filteredAllSingles_XXXXXXX.map((personIndex_DDDDDDD, cardIndex) => {
              const tourMyPicksIndex = Math.floor((filteredAllSingles_XXXXXXX.length - 1) / 2);
              const memberLabel = formatMemberLabel({
                alias: personIndex_DDDDDDD.alias,
                singlesId: personIndex_DDDDDDD.singles_id,
                prefix: personIndex_DDDDDDD.prefix,
                memberId: personIndex_DDDDDDD.member_id
              });
              const memberDisplay = getMemberDisplayLines({
                alias: personIndex_DDDDDDD.alias,
                singlesId: personIndex_DDDDDDD.singles_id,
                prefix: personIndex_DDDDDDD.prefix,
                memberId: personIndex_DDDDDDD.member_id
              });
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
                <ColorTemplate8PhotoGallery.Item
                  key={personIndex_DDDDDDD.singles_id}
                  impersonateSinglesId={personIndex_DDDDDDD.singles_id}
                  impersonateTooltip={!toolsOnlyAdmin}
                  selected={false}
                  sx={allSinglesGalleryItemSx}
                >
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <ColorTemplate8PhotoGallery.Avatar
                      src={imgSrc}
                      alt={memberLabel}
                      selected={false}
                      onDoubleClick={() => openInterestedAlbum(personIndex_DDDDDDD)}
                      imgProps={{
                        onError: (e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = UserRound;
                        }
                      }}
                    />
                    {personIndex_DDDDDDD.vetted_basic_status ? (
                      <Box component="img" src={verifiedSeal} alt="Vetted" sx={allSinglesVerifiedSealSx} />
                    ) : null}
                  </Box>
                  <ColorTemplate8PhotoGallery.NameButton onDoubleClick={() => openInterestedAlbum(personIndex_DDDDDDD)}>
                    <ColorTemplate8PhotoGallery.Label
                      primary={memberDisplay.primary}
                      secondary={memberDisplay.secondary}
                      selected={false}
                    />
                  </ColorTemplate8PhotoGallery.NameButton>
                  <ColorTemplate8PhotoGallery.Footer>
                    {toolsOnlyAdmin ? (
                      <ColorTemplate8PhotoGallery.ImpersonateButton
                        targetSinglesId={personIndex_DDDDDDD.singles_id}
                      />
                    ) : (
                      <SelectedButtonTemplate
                        fullWidth
                        data-clickable-zone="true"
                        data-vsingles-tour-my-picks={cardIndex === tourMyPicksIndex ? '' : undefined}
                        disabled={markInterestedBusyId === personIndex_DDDDDDD.singles_id}
                        onClick={() => handleMarkInterested(personIndex_DDDDDDD.singles_id)}
                        sx={{
                          flex: { xs: 'none', sm: 1 },
                          minWidth: { sm: 0 },
                          zIndex: 1,
                          transformOrigin: 'center center'
                        }}
                      >
                        {markInterestedBusyId === personIndex_DDDDDDD.singles_id ? (
                          <CircularProgress size={18} sx={{ color: 'inherit' }} />
                        ) : (
                          'My Picks'
                        )}
                      </SelectedButtonTemplate>
                    )}
                  </ColorTemplate8PhotoGallery.Footer>
                </ColorTemplate8PhotoGallery.Item>
              );
            })}
          </ColorTemplate8PhotoGallery>
        </Box>
      )}
      </MainCard>
  );
}
