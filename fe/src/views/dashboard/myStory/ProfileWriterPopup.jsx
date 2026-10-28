import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { generateProfileParagraph } from 'api/profileWriterFe';
import { guestDemoAllowProps, guestDemoBlockProps } from 'utils/guestDemoLogin';

const MIN_PICKS = 8;
const MAX_PICKS = 15;
const CUSTOM_MAX_CHARS = 200;
const PANEL_BG = '#87cefa';
const SECTION_SX = { border: '2px solid #000', bgcolor: PANEL_BG, p: { xs: 1, sm: 1.5 } };

export const PROFILE_WORD_GROUPS = [
  {
    key: 'personality',
    title: 'Personality',
    words: ['Adventurous', 'Easygoing', 'Ambitious', 'Introverted', 'Extroverted', 'Witty & Sarcastic', 'Empathetic', 'Optimistic', 'Spontaneous', 'Calm & Grounded']
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle & Daily Rhythm',
    words: ['Early Bird', 'Night Owl', 'Homebody', 'Social Butterfly', 'Fitness-Focused', 'Workaholic', 'Work-Life Balance', 'Minimalist', 'Planner & Organized', 'Go-with-the-Flow']
  },
  {
    key: 'activeHobbies',
    title: 'Active Hobbies',
    words: ['Hiking', 'Running', 'Gym & Weightlifting', 'Yoga', 'Cycling', 'Surfing & Beach Days', 'Skiing & Snowboarding', 'Dancing', 'Team Sports', 'Martial Arts']
  },
  {
    key: 'creativeHobbies',
    title: 'Creative & Indoor Hobbies',
    words: ['Reading', 'Writing', 'Photography', 'Painting & Drawing', 'Playing Music', 'Video Gaming', 'Board Games', 'DIY & Building Things', 'Gardening', 'Fashion & Style']
  },
  {
    key: 'food',
    title: 'Food & Drink',
    words: ['Foodie', 'Home Cook', 'Baking', 'Coffee Lover', 'Wine Tasting', 'Craft Beer', 'Vegetarian/Vegan', 'Trying New Restaurants', 'Street Food', 'Healthy Eating']
  },
  {
    key: 'entertainment',
    title: 'Entertainment & Culture',
    words: ['Movie Buff', 'Binge-Watching Series', 'Live Music & Concerts', 'Podcasts', 'Stand-Up Comedy', 'Museums & Art Galleries', 'Theater', 'Anime', 'Sports Fan', 'Karaoke']
  },
  {
    key: 'travel',
    title: 'Travel',
    words: ['World Traveler', 'Road Trips', 'Camping', 'Weekend Getaways', 'Backpacking', 'Luxury Travel', 'Exploring Local Spots', 'Learning Languages', 'Beach Vacations', 'Bucket-List Chaser']
  },
  {
    key: 'values',
    title: 'Values',
    words: ['Family-Oriented', 'Faith & Spirituality', 'Career-Driven', 'Personal Growth', 'Honesty', 'Loyalty', 'Kindness', 'Volunteering & Giving Back', 'Financially Responsible', 'Eco-Conscious']
  },
  {
    key: 'relationship',
    title: 'Relationship Goals & Love Style',
    words: ['Looking for Long-Term', 'Ready to Settle Down', 'Wants Kids', "Doesn't Want Kids", 'Romantic at Heart', 'Quality Time', 'Words of Affirmation', 'Physical Affection', 'Acts of Service', 'Taking It Slow']
  },
  {
    key: 'pets',
    title: 'Pets & Pet Peeves',
    words: ['Dog Lover', 'Cat Lover', 'Pet-Free Home', 'No Drama', "Can't Stand Rudeness", 'Hates Being Late', 'Non-Smoker', 'Not a Big Drinker', 'Dislikes Small Talk', 'Phone-Free Dates']
  }
];

/** Picking one side of a pair un-picks the other. */
const EITHER_OR_PAIRS = [
  ['Early Bird', 'Night Owl'],
  ['Introverted', 'Extroverted'],
  ['Homebody', 'Social Butterfly'],
  ['Planner & Organized', 'Go-with-the-Flow'],
  ['Wants Kids', "Doesn't Want Kids"],
  ['Workaholic', 'Work-Life Balance'],
  ['Pet-Free Home', 'Dog Lover'],
  ['Pet-Free Home', 'Cat Lover']
];

const MIX_RULES = [
  { label: 'Personality', keys: ['personality'] },
  { label: 'Hobbies', keys: ['activeHobbies', 'creativeHobbies'] },
  { label: 'Relationship Goals', keys: ['relationship'] }
];

const wordGroupKey = new Map(PROFILE_WORD_GROUPS.flatMap((g) => g.words.map((w) => [w, g.key])));

const wordButtonSx = (selected) => ({
  display: 'inline',
  p: 0,
  m: 0,
  border: 'none',
  bgcolor: 'transparent',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: selected ? 800 : 400,
  color: selected ? '#ffeb3b !important' : '#000 !important',
  WebkitTextFillColor: selected ? '#ffeb3b !important' : '#000 !important',
  textShadow: selected ? '0 0 2px #000, 0 0 2px #000' : 'none',
  textDecoration: 'none',
  '@media (hover: hover)': { '&:hover': { textDecoration: 'underline' } },
  '&:focus-visible': { outline: '2px solid #000', outlineOffset: 1 }
});

/** The AI reports no progress, so % complete is elapsed time vs. the recent average write time. */
const WRITE_ESTIMATE_STORAGE_KEY = 'profileWriterWriteMs_v1';
const DEFAULT_WRITE_ESTIMATE_MS = 60000;

function readWriteEstimateMs() {
  try {
    const saved = JSON.parse(localStorage.getItem(WRITE_ESTIMATE_STORAGE_KEY) || '[]');
    const recent = Array.isArray(saved) ? saved.filter((n) => Number.isFinite(n) && n > 0) : [];
    return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : DEFAULT_WRITE_ESTIMATE_MS;
  } catch {
    return DEFAULT_WRITE_ESTIMATE_MS;
  }
}

function saveWriteDurationMs(ms) {
  try {
    const saved = JSON.parse(localStorage.getItem(WRITE_ESTIMATE_STORAGE_KEY) || '[]');
    const recent = Array.isArray(saved) ? saved.filter((n) => Number.isFinite(n) && n > 0) : [];
    localStorage.setItem(WRITE_ESTIMATE_STORAGE_KEY, JSON.stringify([...recent, ms].slice(-5)));
  } catch {
    // storage unavailable; keep the default estimate
  }
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const HOURGLASS_SPIN_SX = {
  display: 'inline-block',
  fontSize: '1.8rem',
  lineHeight: 1,
  animation: 'profileWriterHourglassSpin 1.6s ease-in-out infinite',
  '@keyframes profileWriterHourglassSpin': {
    '0%': { transform: 'rotate(0deg)' },
    '40%': { transform: 'rotate(180deg)' },
    '50%': { transform: 'rotate(180deg)' },
    '90%': { transform: 'rotate(360deg)' },
    '100%': { transform: 'rotate(360deg)' }
  }
};

const WRITE_READY_BUTTON_SX = {
  bgcolor: '#43a047 !important',
  color: '#fff !important',
  WebkitTextFillColor: '#fff !important',
  border: '2px solid #000 !important'
};

/** Red until at least one word in the group is picked, then green. */
const groupHeaderSx = (hasPick) => {
  const textColor = hasPick ? '#000' : '#fff';
  return {
    display: 'inline-block',
    px: 0.75,
    mb: 0.25,
    fontSize: '0.9rem',
    border: '1px solid #000',
    bgcolor: hasPick ? '#66bb6a' : '#e53935',
    color: `${textColor} !important`,
    WebkitTextFillColor: `${textColor} !important`,
    transition: 'background-color 0.15s ease'
  };
};

export default function ProfileWriterPopup({ open, onClose, onSave }) {
  const [picked, setPicked] = useState([]);
  const [custom, setCustom] = useState('');
  const [paragraph, setParagraph] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generateStartedAt, setGenerateStartedAt] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [estimateMs, setEstimateMs] = useState(DEFAULT_WRITE_ESTIMATE_MS);

  const pickedSet = useMemo(() => new Set(picked), [picked]);

  const toggleWord = useCallback((word) => {
    setPicked((prev) => {
      if (prev.includes(word)) return prev.filter((w) => w !== word);
      const opposites = new Set(EITHER_OR_PAIRS.filter((pair) => pair.includes(word)).flat());
      opposites.delete(word);
      return [...prev.filter((w) => !opposites.has(w)), word];
    });
  }, []);

  const missingMix = MIX_RULES.filter((rule) => !picked.some((w) => rule.keys.includes(wordGroupKey.get(w)))).map((r) => r.label);
  const countOk = picked.length >= MIN_PICKS && picked.length <= MAX_PICKS;
  const canGenerate = countOk && missingMix.length === 0 && !generating && !saving;

  let pickHint = `Picked ${picked.length} of ${MIN_PICKS}–${MAX_PICKS} words.`;
  if (picked.length > MAX_PICKS) pickHint += ` Please remove ${picked.length - MAX_PICKS}.`;
  else if (picked.length < MIN_PICKS) pickHint += ` Pick ${MIN_PICKS - picked.length} more.`;
  if (missingMix.length) pickHint += ` Still need at least one from: ${missingMix.join(', ')}.`;

  const writePercent = generating
    ? Math.min(99, Math.floor(((nowMs - generateStartedAt) / Math.max(1, estimateMs)) * 100))
    : 0;

  useEffect(() => {
    if (!generating) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, [generating]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    const started = Date.now();
    setGenerateStartedAt(started);
    setNowMs(started);
    setEstimateMs(readWriteEstimateMs());
    setGenerating(true);
    setError('');
    try {
      const next = await generateProfileParagraph({ words: picked, custom: custom.trim(), previous: paragraph.trim() });
      saveWriteDurationMs(Date.now() - started);
      setParagraph(next);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not write your profile. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, custom, paragraph, picked]);

  const handleSave = useCallback(async () => {
    const text = paragraph.trim();
    if (!text || saving || generating) return;
    setSaving(true);
    setError('');
    try {
      await onSave(text);
      setPicked([]);
      setCustom('');
      setParagraph('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save your profile posting.');
    } finally {
      setSaving(false);
    }
  }, [generating, onSave, paragraph, saving]);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      panelBg={PANEL_BG}
      textColor="#000"
      closeButtonAriaLabel="Close profile writer"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <Box sx={SECTION_SX}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>Let&apos;s write your profile together ✨</Typography>
          <Typography sx={{ fontWeight: 700, mt: 0.75 }}>Intro</Typography>
          <Typography>
            Tell us a little about yourself by tapping the words that feel most like you, and we&apos;ll turn them into a profile
            that sounds like you on your best day.
          </Typography>
          <Typography sx={{ fontWeight: 700, mt: 0.75 }}>How it works</Typography>
          <Typography>
            • <b>Pick 8 to 15 words.</b> That&apos;s the sweet spot. Too few and we won&apos;t know enough about you; too many and
            your profile starts to sound like a list.
          </Typography>
          <Typography>
            • <b>Mix it up.</b> Choose at least one from Personality, Hobbies, and Relationship Goals, so matches get a feel for
            who you are, what you love doing, and what you&apos;re looking for.
          </Typography>
          <Typography>
            • <b>Some words are either/or.</b> You can be an Early Bird or a Night Owl, but not both (we checked 😉).
          </Typography>
        </Box>

        <Box sx={SECTION_SX}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>What sounds like you?</Typography>
          {PROFILE_WORD_GROUPS.map((group, gi) => (
            <Box key={group.key} sx={{ mb: 1.25 }}>
              <Box component="div" sx={groupHeaderSx(group.words.some((w) => pickedSet.has(w)))}>
                {gi + 1}. {group.title}
              </Box>
              <Typography component="div" sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                {group.words.map((word, wi) => (
                  <Box component="span" key={word}>
                    {wi > 0 ? ' · ' : null}
                    <Box
                      component="button"
                      type="button"
                      aria-pressed={pickedSet.has(word)}
                      onClick={() => toggleWord(word)}
                      {...guestDemoAllowProps()}
                      sx={wordButtonSx(pickedSet.has(word))}
                    >
                      {word}
                    </Box>
                  </Box>
                ))}
              </Typography>
            </Box>
          ))}
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{pickHint}</Typography>
        </Box>

        <Box sx={SECTION_SX}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.75 }}>One thing people should know about me:</Typography>
          <TextField
            fullWidth
            size="small"
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, CUSTOM_MAX_CHARS))}
            placeholder={'e.g. "I make the best pancakes in town" or "I\'ve never met a dog I didn\'t want to pet"'}
            inputProps={{ maxLength: CUSTOM_MAX_CHARS, ...guestDemoAllowProps() }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff59d', color: '#000' } }}
          />
          <Typography sx={{ textAlign: 'center', mt: 0.75 }}>
            This is your chance to add something only you could say. It&apos;s often the detail that sparks a conversation.
          </Typography>
        </Box>

        <Box sx={SECTION_SX}>
          <Typography sx={{ textAlign: 'center' }}>
            {paragraph
              ? "Here's your profile! ❤️ Feel free to edit anything, or change your picks and try again until it feels just right."
              : 'When your picks look good, let our AI write your first version.'}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, my: 1.5 }}>
            <ColorTemplate13DisableGreenButton
              type="button"
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
              {...guestDemoAllowProps()}
              sx={canGenerate ? WRITE_READY_BUTTON_SX : undefined}
            >
              {generating ? 'Writing…' : paragraph ? 'Try Another Version' : 'Write My Profile'}
            </ColorTemplate13DisableGreenButton>
            <ColorTemplate13DisableGreenButton
              type="button"
              disabled={!paragraph.trim() || generating || saving}
              onClick={() => void handleSave()}
              {...guestDemoBlockProps()}
              sx={paragraph.trim() && !generating && !saving ? WRITE_READY_BUTTON_SX : undefined}
            >
              {saving ? 'Saving…' : 'Love It, Save My Profile'}
            </ColorTemplate13DisableGreenButton>
          </Box>
          {generating ? (
            <Box role="status" aria-live="polite" sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 0.75 }}>
                <Box component="span" aria-hidden sx={HOURGLASS_SPIN_SX}>
                  ⏳
                </Box>
                <Box component="span" sx={{ fontWeight: 800, fontSize: '1.2rem', fontVariantNumeric: 'tabular-nums' }}>
                  {formatElapsed(nowMs - generateStartedAt)}
                </Box>
                <Box component="span" sx={{ fontWeight: 800, fontSize: '1.2rem', fontVariantNumeric: 'tabular-nums' }}>
                  {writePercent}% completed
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={writePercent}
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
          {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
          <TextField
            fullWidth
            multiline
            minRows={8}
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            placeholder="Your profile will appear here."
            disabled={generating}
            inputProps={{ 'aria-label': 'Your profile text', ...guestDemoAllowProps() }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', color: '#000', alignItems: 'flex-start' } }}
          />
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

ProfileWriterPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired
};
