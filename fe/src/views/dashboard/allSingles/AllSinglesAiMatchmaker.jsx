import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import ColorTemplate8PhotoGallery from 'ui-component/ColorTemplate8PhotoGallery';
import { colorTemplate8PhotoGalleryWrapListSx, colorTemplate8PhotoGalleryWrapShellSx } from 'config/colorTemplate8PhotoGallery';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { AI_MATCH_BATCH_SIZE, fetchAiMatchCandidates, postAiMatchBatch } from 'api/aiMatchFilterFe';

export const AI_MATCH_CATEGORY_OPTIONS = [
  { key: 'age', label: 'Age' },
  { key: 'hobbies', label: 'Hobbies' },
  { key: 'intro', label: 'Intro Post' },
  { key: 'career', label: 'Career' },
  { key: 'location', label: 'Location' },
  { key: 'ethnicity', label: 'Ethnicity' }
];

/** Each AI call scores one batch, so cap a run to keep the wait reasonable. */
const MAX_AI_MATCH_CANDIDATES = 80;
const MAX_SHOWN_MATCHES = 12;

const textSx = {
  color: 'var(--theme-primary-color)',
  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
  lineHeight: 1.45,
  textAlign: 'center'
};

const categoryButtonSx = (selected) => ({
  display: 'block',
  mx: 'auto',
  p: 0,
  border: 'none',
  bgcolor: 'transparent',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
  lineHeight: 1.5,
  fontWeight: selected ? 800 : 400,
  color: selected ? '#ffeb3b !important' : '#000 !important',
  WebkitTextFillColor: selected ? '#ffeb3b !important' : '#000 !important',
  textShadow: selected ? '0 0 2px #000, 0 0 2px #000' : 'none',
  '@media (hover: hover)': { '&:hover': { textDecoration: 'underline' } },
  '&:focus-visible': { outline: '2px solid #000', outlineOffset: 1 }
});

const READY_BUTTON_SX = {
  bgcolor: '#43a047 !important',
  color: '#fff !important',
  WebkitTextFillColor: '#fff !important',
  border: '2px solid #000 !important'
};

export default function AllSinglesAiMatchmaker({ candidates, renderCard }) {
  const [picked, setPicked] = useState(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');
  const [viewerGender, setViewerGender] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const togglePick = useCallback((key) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setMatches(null);
    setError('');
  }, []);

  const runAiFilter = useCallback(async () => {
    const categories = AI_MATCH_CATEGORY_OPTIONS.map((o) => o.key).filter((k) => picked.has(k));
    if (!categories.length || !Array.isArray(candidates) || !candidates.length) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setScanning(true);
    setError('');
    setMatches([]);
    setProgress({ done: 0, total: 0 });

    const scores = new Map();
    try {
      const eligible = await fetchAiMatchCandidates({ signal: ac.signal });
      const eligibleIds = new Set(eligible.candidateIds);
      setViewerGender(eligible.viewerGender);
      const pool = candidates.filter((p) => eligibleIds.has(Number(p.singles_id))).slice(0, MAX_AI_MATCH_CANDIDATES);
      setProgress({ done: 0, total: pool.length });
      if (!pool.length) {
        setError(`No ${eligible.viewerGender === 'F' ? 'men' : 'women'} in this list for the AI to match yet.`);
        return;
      }

      for (let i = 0; i < pool.length; i += AI_MATCH_BATCH_SIZE) {
        const batch = pool.slice(i, i + AI_MATCH_BATCH_SIZE);
        const results = await postAiMatchBatch({
          categories,
          candidateIds: batch.map((p) => p.singles_id),
          signal: ac.signal
        });
        for (const r of results) scores.set(Number(r.singles_id), r);
        setMatches(
          pool
            .filter((p) => scores.has(Number(p.singles_id)))
            .map((p) => ({ person: p, match: scores.get(Number(p.singles_id)) }))
            .sort((a, b) => b.match.score - a.match.score)
        );
        setProgress({ done: Math.min(pool.length, i + batch.length), total: pool.length });
      }
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      setError(err?.response?.data?.error || err?.message || 'AI Filter failed. Please try again.');
    } finally {
      if (abortRef.current === ac) setScanning(false);
    }
  }, [candidates, picked]);

  const shownMatches = useMemo(() => (matches || []).slice(0, MAX_SHOWN_MATCHES), [matches]);
  const canRun = picked.size > 0 && !scanning && Array.isArray(candidates) && candidates.length > 0;
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={textSx}>Tell us what you&apos;re looking for, and we&apos;ll do the matchmaking</Typography>

      <Box role="group" aria-label="Matchmaking categories">
        {AI_MATCH_CATEGORY_OPTIONS.map((o) => (
          <Box
            key={o.key}
            component="button"
            type="button"
            aria-pressed={picked.has(o.key)}
            onClick={() => togglePick(o.key)}
            disabled={scanning}
            {...guestDemoAllowProps()}
            sx={categoryButtonSx(picked.has(o.key))}
          >
            {o.label}
          </Box>
        ))}
      </Box>

      <ColorTemplate13DisableGreenButton
        type="button"
        disabled={!canRun}
        onClick={() => void runAiFilter()}
        {...guestDemoAllowProps()}
        sx={canRun ? READY_BUTTON_SX : undefined}
      >
        {scanning ? 'Matching…' : 'AI Filter'}
      </ColorTemplate13DisableGreenButton>

      {scanning ? (
        <Box role="status" aria-live="polite" sx={{ width: '100%', maxWidth: 420 }}>
          <Typography sx={{ ...textSx, fontWeight: 700 }}>
            AI is reading profiles… {progress.done} of {progress.total} ({percent}%)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={percent}
            sx={{
              height: 10,
              borderRadius: 5,
              border: '1px solid #000',
              bgcolor: '#fff',
              '& .MuiLinearProgress-bar': { bgcolor: '#43a047' }
            }}
          />
        </Box>
      ) : null}

      {error ? <Typography sx={{ ...textSx, color: 'var(--theme-error-color)', fontWeight: 700 }}>{error}</Typography> : null}

      {matches ? (
        <>
          <Typography sx={textSx}>
            Here are the singles who best match what you&apos;re looking for
            {viewerGender ? ` (${viewerGender === 'M' ? 'women' : 'men'} only)` : ''}
          </Typography>
          {shownMatches.length ? (
            <ColorTemplate8PhotoGallery
              fillHeight={false}
              resizable={false}
              selectedGreenBackground
              selectedAvatarCircular
              sx={{ ...colorTemplate8PhotoGalleryWrapShellSx(), width: '100%' }}
              listSx={colorTemplate8PhotoGalleryWrapListSx()}
            >
              {shownMatches.map(({ person, match }) => renderCard(person, { match }))}
            </ColorTemplate8PhotoGallery>
          ) : !scanning ? (
            <Typography sx={textSx}>No matches yet — try picking different categories.</Typography>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

AllSinglesAiMatchmaker.propTypes = {
  candidates: PropTypes.array,
  renderCard: PropTypes.func.isRequired
};
