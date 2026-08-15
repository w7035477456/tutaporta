import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';

import { saveOnlineNickname, ALIAS_ALNUM_ONLY_MESSAGE } from 'api/saveOnlineNicknameFe';
import {
  isValidAliasFormat,
  isDoubledWordAlias,
  sanitizeAliasForSave,
  appendAliasSuggestionClick,
  ALIAS_DOUBLED_WORD_MESSAGE
} from 'utils/aliasValidation';
import { NICKNAME_ADJECTIVE_GROUPS } from 'config/nicknameSuggestions';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';

function AdjectiveChips({ items, onPick }) {
  return (
    <Box sx={{ lineHeight: 1.55 }}>
      {items.map((item) => {
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

function AdjectivesSection({ onPick }) {
  return (
    <Box sx={{ width: '100%' }}>
      <ColorTemplate7PopupLargeDark.SectionTitle>Adjectives</ColorTemplate7PopupLargeDark.SectionTitle>
      {NICKNAME_ADJECTIVE_GROUPS.map((group) => (
        <Box key={`adj-${group.key}`} sx={{ mb: 2 }}>
          <ColorTemplate7PopupLargeDark.SectionLabel>{group.label}</ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.SectionDescription>{group.description}</ColorTemplate7PopupLargeDark.SectionDescription>
          <AdjectiveChips items={group.adjectives ?? []} onPick={onPick} />
        </Box>
      ))}
    </Box>
  );
}

function NameChips({ names, onPick }) {
  return (
    <Box sx={{ lineHeight: 1.55 }}>
      {names.map((name) => (
        <ColorTemplate7PopupLargeDark.Link key={name} onClick={() => onPick(name)}>
          {name}
        </ColorTemplate7PopupLargeDark.Link>
      ))}
    </Box>
  );
}

function GenderColumn({ title, nameKey, onPick }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <ColorTemplate7PopupLargeDark.SectionTitle>{title}</ColorTemplate7PopupLargeDark.SectionTitle>
      {NICKNAME_ADJECTIVE_GROUPS.map((group) => (
        <Box key={`${nameKey}-${group.key}`} sx={{ mb: 2 }}>
          <ColorTemplate7PopupLargeDark.SectionLabel>{group.label}</ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.SectionDescription>{group.description}</ColorTemplate7PopupLargeDark.SectionDescription>
          <NameChips names={group[nameKey]} onPick={onPick} />
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
  dismissible = false
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setNickname(initialNickname);
    setError('');
  }, [open, initialNickname]);

  const handlePickWord = useCallback((word) => {
    setError('');
    setNickname((prev) => appendAliasSuggestionClick(prev, word));
  }, []);

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
  }, [nickname, onSaved, dismissible]);

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
          You can &ldquo;click&rdquo; any two words from the group of adjectives and nouns below, or type in, to set your
          Nickname/Alias (example: BubblyBob, or BubblyBob99)
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'center',
            gap: 1.5,
            width: '100%'
          }}
        >
          <ColorTemplate7PopupLargeDark.SectionLabel sx={{ whiteSpace: 'nowrap', mt: 0 }}>
            Nick name or alias:
          </ColorTemplate7PopupLargeDark.SectionLabel>
          <ColorTemplate7PopupLargeDark.Input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
            }}
            disabled={saving}
          />
          <ColorTemplate7PopupLargeDark.ActionButton onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Box>

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        <AdjectivesSection onPick={handlePickWord} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 2.5, md: 3 },
            width: '100%'
          }}
        >
          <GenderColumn title="50 Female Nicknames" nameKey="female" onPick={handlePickWord} />
          <GenderColumn title="50 Male Nicknames" nameKey="male" onPick={handlePickWord} />
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
  dismissible: PropTypes.bool
};
