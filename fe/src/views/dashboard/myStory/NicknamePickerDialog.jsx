import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';

import { saveOnlineNickname, ALIAS_ALNUM_ONLY_MESSAGE } from 'api/saveOnlineNicknameFe';
import {
  isValidAliasFormat,
  isDoubledWordAlias,
  isValidRhymingAliasFormat,
  sanitizeAliasForSave,
  ALIAS_DOUBLED_WORD_MESSAGE,
  ALIAS_RHYME_NAME_MESSAGE
} from 'utils/aliasValidation';
import {
  NICKNAME_ADJECTIVE_GROUPS,
  listNicknameAdjectives,
  nicknameFirstLetterKey,
  titleCaseNicknameWord,
  setNicknameGenderPreferenceOnce,
  resolveNicknameSuggestGender,
  generateRandomRhymingNickname
} from 'config/nicknameSuggestions';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import {
  COLOR_TEMPLATE7_POPUP_ACTION_GREEN,
  COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
  COLOR_TEMPLATE7_POPUP_INPUT_WIDTH
} from 'config/colorTemplate7PopupLargeDark';
import { greenButtonHoverScaleRaiseSx } from 'config/greenButton';
import { YELLOW_BUTTON_TEMPLATE_BG, YELLOW_BUTTON_TEMPLATE_TEXT } from 'config/yellowButtonTemplate';

function AdjectiveChips({ items, letterFilter, onPick }) {
  const filtered = letterFilter
    ? items.filter((item) => {
        const word = typeof item === 'string' ? item : item.word;
        return nicknameFirstLetterKey(word) === letterFilter;
      })
    : items;
  if (!filtered.length) {
    return (
      <ColorTemplate7PopupLargeDark.SectionDescription>
        No adjectives start with “{String(letterFilter).toUpperCase()}”. Clear the name or pick a matching letter.
      </ColorTemplate7PopupLargeDark.SectionDescription>
    );
  }
  return (
    <Box sx={{ lineHeight: 1.55 }}>
      {filtered.map((item) => {
        const word = typeof item === 'string' ? item : item.word;
        const example = typeof item === 'string' ? null : item.example;
        return (
          <Box key={word} component="span" sx={{ mr: 0.75, mb: 0.35, display: 'inline' }}>
            <ColorTemplate7PopupLargeDark.Link onClick={() => onPick(word)}>{word}</ColorTemplate7PopupLargeDark.Link>
            {example ? (
              <ColorTemplate7PopupLargeDark.LinkExample>
                {' '}
                (e.g., {example})
              </ColorTemplate7PopupLargeDark.LinkExample>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

function AdjectivesSection({ letterFilter, onPick }) {
  return (
    <Box sx={{ width: '100%' }}>
      <ColorTemplate7PopupLargeDark.SectionTitle>Adjectives</ColorTemplate7PopupLargeDark.SectionTitle>
      {NICKNAME_ADJECTIVE_GROUPS.map((group) => (
        <Box key={`adj-${group.key}`} sx={{ mb: 2 }}>
          <ColorTemplate7PopupLargeDark.SectionLabel>{group.label}</ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.SectionDescription>{group.description}</ColorTemplate7PopupLargeDark.SectionDescription>
          <AdjectiveChips items={group.adjectives ?? []} letterFilter={letterFilter} onPick={onPick} />
        </Box>
      ))}
    </Box>
  );
}

function NameChips({ names, letterFilter, gender, onPick }) {
  const filtered = letterFilter
    ? names.filter((name) => nicknameFirstLetterKey(name) === letterFilter)
    : names;
  if (!filtered.length) {
    return (
      <ColorTemplate7PopupLargeDark.SectionDescription>
        No first names start with “{String(letterFilter).toUpperCase()}”. Pick a different adjective letter.
      </ColorTemplate7PopupLargeDark.SectionDescription>
    );
  }
  return (
    <Box sx={{ lineHeight: 1.55 }}>
      {filtered.map((name) => (
        <ColorTemplate7PopupLargeDark.Link key={name} onClick={() => onPick(name, { gender })}>
          {name}
        </ColorTemplate7PopupLargeDark.Link>
      ))}
    </Box>
  );
}

const NICKNAME_INPUT_WIDTH = `calc(${COLOR_TEMPLATE7_POPUP_INPUT_WIDTH} / 2)`;

/** Popup content Box forces form-row inputs to 40ch — override with !important. */
const nicknameInputHalfWidthSx = {
  '& .MuiTextField-root.color-template7-popup-form-row-input:not(.color-template7-popup-form-row-input-stretch)': {
    width: `${NICKNAME_INPUT_WIDTH} !important`,
    maxWidth: `${NICKNAME_INPUT_WIDTH} !important`,
    minWidth: NICKNAME_INPUT_WIDTH,
    flex: '0 0 auto !important',
    mx: '0 !important',
    alignSelf: 'center'
  }
};

const nicknameRowButtonHeightSx = {
  height: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
  minHeight: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
  py: 0,
  lineHeight: 1,
  boxShadow: 'none',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  minWidth: 0
};

const nicknameSuggestAnotherButtonSx = {
  ...nicknameRowButtonHeightSx,
  bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
  color: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
  WebkitTextFillColor: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
  border: '1px solid #000000 !important',
  ...greenButtonHoverScaleRaiseSx({
    bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
    color: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
    WebkitTextFillColor: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
    border: '1px solid #000000 !important'
  })
};

const nicknameSaveButtonSx = {
  ...nicknameRowButtonHeightSx,
  bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '1px solid #000000 !important',
  ...greenButtonHoverScaleRaiseSx({
    bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    border: '1px solid #000000 !important'
  })
};

function GenderColumn({ title, nameKey, letterFilter, gender, onPick }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <ColorTemplate7PopupLargeDark.SectionTitle>{title}</ColorTemplate7PopupLargeDark.SectionTitle>
      {NICKNAME_ADJECTIVE_GROUPS.map((group) => (
        <Box key={`${nameKey}-${group.key}`} sx={{ mb: 2 }}>
          <ColorTemplate7PopupLargeDark.SectionLabel>{group.label}</ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.SectionDescription>{group.description}</ColorTemplate7PopupLargeDark.SectionDescription>
          <NameChips names={group[nameKey]} letterFilter={letterFilter} gender={gender} onPick={onPick} />
        </Box>
      ))}
    </Box>
  );
}

export default function NicknamePickerDialog({
  open,
  initialNickname = '',
  onSaved,
  onClose,
  dismissible = false,
  excludeFirstName = '',
  genderSelfReport = null
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [pendingAdjective, setPendingAdjective] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const adjectiveSet = useMemo(
    () => new Set(listNicknameAdjectives().map((w) => w.toLowerCase())),
    []
  );

  useEffect(() => {
    if (!open) return;
    setNickname(initialNickname);
    setPendingAdjective('');
    setError('');
  }, [open, initialNickname]);

  const letterFilter = nicknameFirstLetterKey(pendingAdjective) || null;

  const handlePickWord = useCallback(
    (word, meta) => {
      setError('');
      const clean = titleCaseNicknameWord(word);
      const isAdjective = adjectiveSet.has(clean.toLowerCase());

      if (meta?.gender === 'female' || meta?.gender === 'male') {
        setNicknameGenderPreferenceOnce(meta.gender);
      }

      if (!pendingAdjective && isAdjective) {
        setPendingAdjective(clean);
        setNickname(clean);
        return;
      }

      if (pendingAdjective) {
        if (!nicknameFirstLetterKey(pendingAdjective) || nicknameFirstLetterKey(pendingAdjective) !== nicknameFirstLetterKey(clean)) {
          setError(ALIAS_RHYME_NAME_MESSAGE);
          return;
        }
        if (pendingAdjective.toLowerCase() === clean.toLowerCase()) {
          setError(ALIAS_DOUBLED_WORD_MESSAGE);
          return;
        }
        setNickname(`${pendingAdjective}${clean}`);
        setPendingAdjective('');
        return;
      }

      // Name clicked first → require matching adjective next.
      setPendingAdjective('');
      setNickname(clean);
      setError('Pick an adjective that starts with the same letter as this first name.');
    },
    [adjectiveSet, pendingAdjective]
  );

  const handleSave = useCallback(async () => {
    const aliasToSave = sanitizeAliasForSave(nickname);
    if (!aliasToSave) {
      if (!dismissible) {
        setError('Please enter a nickname.');
        return;
      }
      setSaving(true);
      setError('');
      try {
        const data = await saveOnlineNickname('');
        setNickname('');
        onSaved?.(data?.alias ?? '');
      } catch (err) {
        setError(err?.message || 'Failed to save nickname');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!isValidAliasFormat(aliasToSave)) {
      setError(ALIAS_ALNUM_ONLY_MESSAGE);
      return;
    }

    if (isDoubledWordAlias(aliasToSave)) {
      setError(ALIAS_DOUBLED_WORD_MESSAGE);
      return;
    }

    if (!isValidRhymingAliasFormat(aliasToSave, excludeFirstName)) {
      setError(ALIAS_RHYME_NAME_MESSAGE);
      return;
    }

    setNickname(aliasToSave);
    setSaving(true);
    setError('');
    try {
      const data = await saveOnlineNickname(aliasToSave);
      onSaved?.(data?.alias ?? aliasToSave);
    } catch (err) {
      setError(err?.message || 'Failed to save nickname');
    } finally {
      setSaving(false);
    }
  }, [nickname, onSaved, dismissible, excludeFirstName]);

  const handleSuggestAnother = useCallback(() => {
    setError('');
    const gender = resolveNicknameSuggestGender({ genderSelfReport });
    const next = generateRandomRhymingNickname({
      gender,
      excludeFirstName
    });
    if (!next) {
      setError('Could not suggest a nickname. Pick an adjective and first name, or try again.');
      return;
    }
    setNickname(next);
    setPendingAdjective('');
  }, [excludeFirstName, genderSelfReport]);

  const hasCloseHandler = typeof onClose === 'function';

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={hasCloseHandler ? onClose : undefined}
      showCloseButton={hasCloseHandler}
      closeOnBackdrop={dismissible && hasCloseHandler}
    >
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.Title>Please choose a nickname for this site.</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          Click one adjective, then a real first name that starts with the same letter (example: BrainyBobby). The second
          word must be a first name — not your legal first name.
          {pendingAdjective ? (
            <>
              {' '}
              Selected adjective: <strong>{pendingAdjective}</strong> — now pick a matching first name.
            </>
          ) : null}
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'flex-start',
            gap: 1.5,
            width: '100%',
            ...nicknameInputHalfWidthSx
          }}
        >
          <ColorTemplate7PopupLargeDark.SectionLabel sx={{ whiteSpace: 'nowrap', mt: 0, flexShrink: 0 }}>
            Nick name or alias:
          </ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.Input
            formRow
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setPendingAdjective('');
              setError('');
            }}
            disabled={saving}
            sx={{
              width: `${NICKNAME_INPUT_WIDTH} !important`,
              maxWidth: `${NICKNAME_INPUT_WIDTH} !important`,
              flex: '0 0 auto !important',
              mx: '0 !important'
            }}
          />
          <GreenButton
            type="button"
            onClick={handleSuggestAnother}
            disabled={saving}
            singleLineLabel
            sx={nicknameSuggestAnotherButtonSx}
          >
            Suggest Another
          </GreenButton>
          <GreenButton
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            singleLineLabel
            sx={nicknameSaveButtonSx}
          >
            {saving ? 'Saving...' : 'Save'}
          </GreenButton>
        </Box>

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        <AdjectivesSection letterFilter={null} onPick={handlePickWord} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 2.5, md: 3 },
            width: '100%'
          }}
        >
          <GenderColumn
            title="Female first names"
            nameKey="female"
            letterFilter={letterFilter}
            gender="female"
            onPick={handlePickWord}
          />
          <GenderColumn
            title="Male first names"
            nameKey="male"
            letterFilter={letterFilter}
            gender="male"
            onPick={handlePickWord}
          />
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

NicknamePickerDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  initialNickname: PropTypes.string,
  onSaved: PropTypes.func,
  onClose: PropTypes.func,
  dismissible: PropTypes.bool,
  excludeFirstName: PropTypes.string,
  genderSelfReport: PropTypes.string
};
