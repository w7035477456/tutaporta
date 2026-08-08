import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import {
  fetchAdminPasswordCheckLookup,
  fetchAdminPasswordHashPreview,
  setAdminGlobalPasswordHash,
  setAdminMemberCategoryPasswordHash,
  setAdminSinglesPasswordHash
} from 'api/adminToolsFe';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  SELECTED_BUTTON_TEMPLATE_BG,
  SELECTED_BUTTON_TEMPLATE_BORDER,
  SELECTED_BUTTON_TEMPLATE_TEXT
} from 'config/selectedUnselectedButtonTemplate';

const labelSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '1rem', sm: '1.15rem' },
  lineHeight: 1.25,
  color: 'var(--theme-inverse-daynight-color)',
  flexShrink: 0
};

const bigOrSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '1.35rem', sm: '1.85rem' },
  lineHeight: 1,
  color: 'var(--theme-inverse-daynight-color)',
  px: { xs: 0.25, sm: 0.75 },
  flexShrink: 0,
  alignSelf: 'center'
};

const rowGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'minmax(140px, 220px) minmax(0, 1fr)' },
  gap: { xs: 0.75, sm: 1.5 },
  alignItems: { xs: 'stretch', sm: 'center' },
  width: '100%',
  maxWidth: 920
};

const borderedPanelSx = {
  width: '100%',
  maxWidth: 920,
  border: '1px solid #ffffff',
  borderRadius: 0,
  p: { xs: 1.25, sm: 1.75 },
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25
};

const inputFieldSx = {
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff',
    color: '#000000 !important',
    borderRadius: 0,
    fontFamily: MAIN_FONT_FAMILY
  },
  '& .MuiInputBase-input': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important'
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#ffffff'
  }
};

const hashDisplaySx = {
  bgcolor: '#7eb8da',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '1px solid var(--theme-primary-color)',
  borderRadius: 0,
  px: 1.25,
  py: 1,
  minHeight: 52,
  flex: 1,
  minWidth: 0,
  fontFamily: 'monospace',
  fontSize: '0.78rem',
  lineHeight: 1.35,
  wordBreak: 'break-all',
  whiteSpace: 'pre-wrap',
  '&, & *': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important'
  }
};

const pillActionButtonSx = {
  borderRadius: 999,
  px: 1.75,
  py: 0.65,
  minHeight: 36,
  flexShrink: 0,
  alignSelf: { xs: 'flex-start', sm: 'center' }
};

const pillGenerateButtonSx = {
  ...pillActionButtonSx,
  px: 2
};

const setNewButtonSx = {
  ...pillActionButtonSx,
  bgcolor: `${SELECTED_BUTTON_TEMPLATE_BG} !important`,
  color: `${SELECTED_BUTTON_TEMPLATE_TEXT} !important`,
  WebkitTextFillColor: `${SELECTED_BUTTON_TEMPLATE_TEXT} !important`,
  border: `${SELECTED_BUTTON_TEMPLATE_BORDER} !important`,
  '&.Mui-disabled': {
    bgcolor: `${SELECTED_BUTTON_TEMPLATE_BG} !important`,
    color: `${SELECTED_BUTTON_TEMPLATE_TEXT} !important`,
    WebkitTextFillColor: `${SELECTED_BUTTON_TEMPLATE_TEXT} !important`,
    border: `${SELECTED_BUTTON_TEMPLATE_BORDER} !important`,
    opacity: '1 !important',
    cursor: 'not-allowed',
    pointerEvents: 'none',
    '& .MuiButton-label': {
      color: `${SELECTED_BUTTON_TEMPLATE_TEXT} !important`,
      WebkitTextFillColor: `${SELECTED_BUTTON_TEMPLATE_TEXT} !important`
    }
  }
};

function generateSixDigitPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function HashRow({ label, value }) {
  return (
    <Box sx={rowGridSx}>
      <Typography sx={labelSx}>{label}</Typography>
      <Box sx={hashDisplaySx}>{value || '\u00a0'}</Box>
    </Box>
  );
}

function SetNewActionRow({ label, onSetNew, setNewDisabled, setNewBusy }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        width: '100%'
      }}
    >
      <Typography sx={{ ...labelSx, flex: '1 1 auto', minWidth: 0 }}>{label}</Typography>
      <SelectedButtonTemplate
        type="button"
        disabled={setNewDisabled || setNewBusy}
        onClick={onSetNew}
        fitLabelWidth
        sx={setNewButtonSx}
      >
        {setNewBusy ? 'Saving…' : 'Set New'}
      </SelectedButtonTemplate>
    </Box>
  );
}

function hasLookupInput({ singlesIdInput, emailInput, aliasInput }) {
  const id = Number(String(singlesIdInput ?? '').trim());
  if (Number.isFinite(id) && id >= 1) return true;
  if (String(emailInput ?? '').trim()) return true;
  if (String(aliasInput ?? '').trim()) return true;
  return false;
}

function formatLookupSummary(dbLookup) {
  if (!dbLookup?.singlesId) return '';
  const parts = [`singles_id ${dbLookup.singlesId}`];
  if (dbLookup.email) parts.push(dbLookup.email);
  if (dbLookup.alias) parts.push(dbLookup.alias);
  if (dbLookup.lookupBy) parts.push(`found by ${dbLookup.lookupBy}`);
  return parts.join(' - ');
}

export default function AdminToolsPasswordCheckTab({ onError }) {
  const [singlesIdInput, setSinglesIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [password, setPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  /** 'typed' | 'generated' — password entry and Generate are mutually exclusive. */
  const [passwordSource, setPasswordSource] = useState('');
  const [newHash, setNewHash] = useState('');
  const [hashBusy, setHashBusy] = useState(false);
  const [dbLookup, setDbLookup] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [setSinglesBusy, setSetSinglesBusy] = useState(false);
  const [setMemberCatBusy, setSetMemberCatBusy] = useState(false);
  const [setGlobalBusy, setSetGlobalBusy] = useState(false);
  const hashRequestIdRef = useRef(0);

  const lookupPayload = useCallback(
    () => ({
      singlesId: String(singlesIdInput ?? '').trim() || undefined,
      email: String(emailInput ?? '').trim() || undefined,
      alias: String(aliasInput ?? '').trim() || undefined
    }),
    [aliasInput, emailInput, singlesIdInput]
  );

  const refreshNewHash = useCallback(
    async (plain) => {
      const trimmed = String(plain ?? '').trim();
      if (!trimmed) {
        setNewHash('');
        return;
      }
      const requestId = hashRequestIdRef.current + 1;
      hashRequestIdRef.current = requestId;
      setHashBusy(true);
      try {
        const data = await fetchAdminPasswordHashPreview({ password: trimmed });
        if (hashRequestIdRef.current !== requestId) return;
        setNewHash(String(data?.passwordHashFromInput ?? ''));
      } catch (err) {
        if (hashRequestIdRef.current !== requestId) return;
        setNewHash('');
        onError?.(err?.response?.data?.error || err?.message || 'Failed to generate New Hash');
      } finally {
        if (hashRequestIdRef.current === requestId) {
          setHashBusy(false);
        }
      }
    },
    [onError]
  );

  useEffect(() => {
    if (!hasLookupInput({ singlesIdInput, emailInput, aliasInput })) {
      setDbLookup(null);
      setLookupBusy(false);
      return undefined;
    }

    setLookupBusy(true);
    const timer = setTimeout(async () => {
      try {
        const data = await fetchAdminPasswordCheckLookup(lookupPayload());
        setDbLookup(data);
        onError?.('');
      } catch (err) {
        setDbLookup(
          err?.response?.status === 404
            ? { globalPasswordHash: String(err?.response?.data?.globalPasswordHash ?? '') }
            : null
        );
        if (err?.response?.status === 404) {
          onError?.('Could not find any of given');
        } else {
          onError?.(err?.response?.data?.error || err?.message || 'Failed to load DB password hashes');
        }
      } finally {
        setLookupBusy(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [aliasInput, emailInput, lookupPayload, onError, singlesIdInput]);

  const memberFound =
    !lookupBusy &&
    Number.isFinite(Number(dbLookup?.singlesId)) &&
    Number(dbLookup.singlesId) >= 1;

  useEffect(() => {
    if (passwordSource !== 'typed') return undefined;
    const trimmed = password.trim();
    if (!trimmed) {
      setNewHash('');
      return undefined;
    }
    const timer = setTimeout(() => {
      void refreshNewHash(trimmed);
    }, 350);
    return () => clearTimeout(timer);
  }, [password, passwordSource, refreshNewHash]);

  const handlePasswordChange = useCallback(
    (value) => {
      setPasswordSource('typed');
      setGeneratedPassword('');
      setPassword(value);
      onError?.('');
    },
    [onError]
  );

  const handleGeneratePassword = useCallback(() => {
    const sixDigit = generateSixDigitPassword();
    setPassword('');
    setGeneratedPassword(sixDigit);
    setPasswordSource('generated');
    onError?.('');
    void refreshNewHash(sixDigit);
  }, [onError, refreshNewHash]);

  const handleGeneratedPasswordChange = useCallback(
    (value) => {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      setPassword('');
      setGeneratedPassword(digits);
      setPasswordSource('generated');
      onError?.('');
      if (!digits) {
        setNewHash('');
        return;
      }
      void refreshNewHash(digits);
    },
    [onError, refreshNewHash]
  );

  const handleSetSinglesHash = useCallback(async () => {
    const singlesId = Number(dbLookup?.singlesId);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      onError?.('Enter Single Id, Email, or Alias and wait for member lookup');
      return;
    }
    if (!newHash) {
      onError?.('Enter Password or click Generate to create New Hash first');
      return;
    }

    setSetSinglesBusy(true);
    onError?.('');
    try {
      const data = await setAdminSinglesPasswordHash({ singlesId, passwordHash: newHash });
      setDbLookup((prev) =>
        prev
          ? {
              ...prev,
              singlesPasswordHash: data.singlesPasswordHash ?? newHash
            }
          : prev
      );
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to update singles.password_hash');
    } finally {
      setSetSinglesBusy(false);
    }
  }, [dbLookup?.singlesId, newHash, onError]);

  const handleSetMemberCategoryHash = useCallback(async () => {
    if (!newHash) {
      onError?.('Enter Password or click Generate to create New Hash first');
      return;
    }

    setSetMemberCatBusy(true);
    onError?.('');
    try {
      await setAdminMemberCategoryPasswordHash({ passwordHash: newHash });
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to update member category passwords');
    } finally {
      setSetMemberCatBusy(false);
    }
  }, [newHash, onError]);

  const handleSetGlobalHash = useCallback(async () => {
    if (!newHash) {
      onError?.('Enter Password or click Generate to create New Hash first');
      return;
    }

    setSetGlobalBusy(true);
    onError?.('');
    try {
      const data = await setAdminGlobalPasswordHash({ passwordHash: newHash });
      setDbLookup((prev) =>
        prev
          ? {
              ...prev,
              globalPasswordHash: data.globalPasswordHash ?? newHash
            }
          : { globalPasswordHash: data.globalPasswordHash ?? newHash }
      );
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to update global.password_hash');
    } finally {
      setSetGlobalBusy(false);
    }
  }, [newHash, onError]);

  const canSetNew = Boolean(String(newHash ?? '').trim());
  const canSetSingles = canSetNew && memberFound;
  const lookupSummary = memberFound ? formatLookupSummary(dbLookup) : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', width: '100%' }}>
      <Box sx={rowGridSx}>
        <Typography sx={labelSx}>Password:</Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            minWidth: 0
          }}
        >
          <TextField
            type="text"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            size="small"
            autoComplete="off"
            sx={{
              ...inputFieldSx,
              flex: '1 1 140px',
              minWidth: 120
            }}
          />
          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>
          <SelectedButtonTemplate type="button" onClick={handleGeneratePassword} fitLabelWidth sx={pillGenerateButtonSx}>
            Generate
          </SelectedButtonTemplate>
          <TextField
            type="text"
            value={generatedPassword}
            onChange={(e) => handleGeneratedPasswordChange(e.target.value)}
            placeholder="6-digit"
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
            size="small"
            autoComplete="off"
            sx={{
              ...inputFieldSx,
              flex: '0 1 120px',
              width: { xs: '100%', sm: 120 }
            }}
          />
        </Box>
      </Box>

      <HashRow label="New Hash:" value={hashBusy ? '…' : newHash} />

      <Box sx={borderedPanelSx}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: { xs: 'flex-start', md: 'space-between' },
            gap: { xs: 1, sm: 1.25, md: 1.5 }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: '1 1 160px', minWidth: 0 }}>
            <Typography sx={labelSx}>Single Id:</Typography>
            <TextField
              value={singlesIdInput}
              onChange={(e) => setSinglesIdInput(e.target.value.replace(/\D/g, ''))}
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              size="small"
              fullWidth
              sx={inputFieldSx}
            />
          </Box>

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: '1 1 200px', minWidth: 0 }}>
            <Typography sx={labelSx}>Email:</Typography>
            <TextField
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              size="small"
              fullWidth
              autoComplete="off"
              sx={inputFieldSx}
            />
          </Box>

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: '1 1 180px', minWidth: 0 }}>
            <Typography sx={labelSx}>Alias:</Typography>
            <TextField
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              size="small"
              fullWidth
              autoComplete="off"
              sx={inputFieldSx}
            />
          </Box>
        </Box>

        {lookupSummary ? (
          <Typography sx={{ ...labelSx, fontSize: '0.95rem', fontWeight: 400 }}>{lookupSummary}</Typography>
        ) : null}

        <SetNewActionRow
          label={memberFound ? `Single Id ${dbLookup.singlesId} Password` : 'Single Id Password'}
          onSetNew={() => void handleSetSinglesHash()}
          setNewDisabled={!canSetSingles}
          setNewBusy={setSinglesBusy}
        />
      </Box>

      <Box sx={borderedPanelSx}>
        <SetNewActionRow
          label="Member Cat Password"
          onSetNew={() => void handleSetMemberCategoryHash()}
          setNewDisabled={!canSetNew}
          setNewBusy={setMemberCatBusy}
        />
        <SetNewActionRow
          label="ADMIN password"
          onSetNew={() => void handleSetGlobalHash()}
          setNewDisabled={!canSetNew}
          setNewBusy={setGlobalBusy}
        />
      </Box>
    </Box>
  );
}
