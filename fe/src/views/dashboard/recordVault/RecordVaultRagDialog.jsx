import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import GreenButton from 'ui-component/GreenButton';
import SliderControlButton from 'ui-component/SliderControlButton';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import { fetchRecordVaultRagStatus, queryRecordVaultRag, readRecordVaultApiError } from 'api/recordVaultFe';
import { tutaNotesPostLoginActionButtonSx } from './tutaNotesPostLoginActionButtonSx';

const scrollableAnswerBoxSx = {
  px: 1.5,
  py: 1.25,
  borderRadius: 1,
  border: '2px solid #000',
  bgcolor: '#fff',
  color: '#000',
  flex: '1 1 auto',
  minHeight: 120,
  maxHeight: '100%',
  overflow: 'auto',
  overflowX: 'auto',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.5,
  fontSize: { xs: '0.95rem', sm: '1rem' },
  boxSizing: 'border-box'
};

const promptFieldSx = {
  flexShrink: 0,
  '& .MuiInputBase-root': {
    bgcolor: '#fff',
    color: '#000'
  }
};

const dialogButtonSx = {
  ...tutaNotesPostLoginActionButtonSx,
  flex: '1 1 0',
  minWidth: 0,
  maxWidth: 180,
  width: 'auto',
  px: 1.25,
  py: 0.65,
  minHeight: 40,
  fontSize: { xs: '0.9rem', sm: '1rem' }
};

const footerRowSx = {
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 1,
  pt: 1,
  pb: 0.5,
  px: 0.5,
  width: '100%',
  boxSizing: 'border-box'
};

/** Format milliseconds as M:SS (e.g. 1:05). */
function formatRagElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Ollama load_duration for this question — 0 when model was already in RAM. */
function formatRagModelLoadTime(modelLoadMs) {
  const ms = Math.max(0, Number(modelLoadMs) || 0);
  if (ms < 1000) {
    return '0 sec (already loaded)';
  }
  return formatRagElapsed(ms);
}

export default function RecordVaultRagDialog({
  open,
  onClose,
  selectedNoteIds = [],
  storageType = 'onedrive',
  keepModelInMemory = false,
  disabled = false
}) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);

  const noteCount = selectedNoteIds.length;
  const currentEntry = historyIndex >= 0 ? history[historyIndex] : null;

  const statusLine = useMemo(() => {
    if (!serviceStatus) return '';
    if (serviceStatus.status === 'disabled') return 'RAG is disabled on this server.';
    if (serviceStatus.status === 'unreachable') {
      return 'RAG service offline — run scripts/start-rag-service.sh and scripts/verify-ollama.sh';
    }
    if (serviceStatus.modelReady === false) {
      return 'Ollama is up but the model is missing — run: ollama pull llama3.2';
    }
    if (serviceStatus.status === 'ok') {
      return keepModelInMemory
        ? 'Ollama + RAG ready. Model pinned in memory (Keep Model ON).'
        : 'Ollama + RAG service ready. Model uses default ~5 min keep-alive.';
    }
    return serviceStatus.error || '';
  }, [serviceStatus, keepModelInMemory]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError('');
    void fetchRecordVaultRagStatus({ storageType })
      .then((data) => {
        if (!cancelled) setServiceStatus(data);
      })
      .catch(() => {
        if (!cancelled) setServiceStatus({ status: 'unreachable' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, storageType]);

  useEffect(() => {
    if (!busy) {
      setLiveElapsedMs(0);
      return undefined;
    }
    const startedAt = performance.now();
    const timerId = window.setInterval(() => {
      setLiveElapsedMs(Math.round(performance.now() - startedAt));
    }, 250);
    return () => window.clearInterval(timerId);
  }, [busy]);

  const handleAsk = useCallback(async () => {
    const question = prompt.trim();
    if (!question) {
      setError('Type a question first.');
      return;
    }
    if (!noteCount) {
      setError('Check at least one note in the list (yellow RAG checkbox) before asking.');
      return;
    }
    setBusy(true);
    setError('');
    const startedAt = performance.now();
    try {
      const data = await queryRecordVaultRag({
        noteIds: selectedNoteIds,
        prompt: question,
        storageType,
        keepModelInMemory
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      const entry = {
        prompt: question,
        answer: String(data?.answer || ''),
        sourceNotes: data?.sourceNotes || [],
        model: data?.model || '',
        elapsedMs,
        modelLoadMs: Number(data?.modelLoadMs) || 0
      };
      setHistory((prev) => [...prev, entry]);
      setHistoryIndex((prev) => prev + 1);
      setPrompt('');
    } catch (err) {
      setError(readRecordVaultApiError(err, 'RAG query failed'));
    } finally {
      setBusy(false);
    }
  }, [noteCount, prompt, selectedNoteIds, storageType, keepModelInMemory]);

  const handleClose = () => {
    if (busy) return;
    onClose?.();
  };

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={handleClose}
      maxWidth="62vw"
      resizable
      fourCornerResize
      defaultResizeHeight="72vh"
      maxResizeHeight="92vh"
      contentSx={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0
      }}
      cardSx={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <BusyHourglassOverlay open={busy} size={BUSY_HOURGLASS_MODAL_SIZE} />
      <ColorTemplate16PopupCenterWide.Title>RAG — Ask your notes</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body
        spacing={1.25}
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pb: 0.5
        }}
      >
        <Typography variant="body2" sx={{ color: '#fff', lineHeight: 1.45, flexShrink: 0 }}>
          {noteCount} note{noteCount === 1 ? '' : 's'} selected for RAG.
          {statusLine ? ` ${statusLine}` : ''}
        </Typography>

        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          placeholder='Example: "Show and compare my 2024 and 2025 tax deductions"'
          value={prompt}
          disabled={disabled || busy}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleAsk();
            }
          }}
          sx={promptFieldSx}
        />

        {error ? (
          <Typography variant="body2" sx={{ color: '#ffb4b4', fontWeight: 700, flexShrink: 0 }}>
            {error}
          </Typography>
        ) : null}

        <Stack
          spacing={1}
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {history.length > 0 ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0 }}>
                <SliderControlButton
                  type="button"
                  variant="yellow"
                  disabled={historyIndex <= 0 || busy}
                  onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
                  aria-label="Previous answer"
                >
                  {'<'}
                </SliderControlButton>
                <Typography variant="body2" sx={{ color: '#fff', minWidth: 72, textAlign: 'center' }}>
                  {historyIndex + 1}/{history.length}
                </Typography>
                <SliderControlButton
                  type="button"
                  variant="yellow"
                  disabled={historyIndex >= history.length - 1 || busy}
                  onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
                  aria-label="Next answer"
                >
                  {'>'}
                </SliderControlButton>
              </Box>
              {busy ? (
                <Typography
                  variant="body2"
                  role="status"
                  aria-live="polite"
                  sx={{ color: '#fff', textAlign: 'center', flexShrink: 0, fontWeight: 700 }}
                >
                  Processing and retrieving answer… {formatRagElapsed(liveElapsedMs)}
                </Typography>
              ) : null}
              {currentEntry ? (
                <>
                  <Box sx={{ ...scrollableAnswerBoxSx, flex: '0 0 auto', maxHeight: '22%', fontWeight: 700 }}>
                    {currentEntry.prompt}
                  </Box>
                  <Box sx={scrollableAnswerBoxSx}>{currentEntry.answer || '(empty answer)'}</Box>
                  {Number.isFinite(currentEntry.elapsedMs) ||
                  Number.isFinite(currentEntry.modelLoadMs) ||
                  currentEntry.sourceNotes?.length ||
                  currentEntry.model ? (
                    <Typography
                      variant="caption"
                      sx={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0, lineHeight: 1.35 }}
                    >
                      {Number.isFinite(currentEntry.modelLoadMs)
                        ? `Time to load model: ${formatRagModelLoadTime(currentEntry.modelLoadMs)}`
                        : null}
                      {Number.isFinite(currentEntry.elapsedMs)
                        ? `${Number.isFinite(currentEntry.modelLoadMs) ? ' · ' : ''}Total time: ${formatRagElapsed(currentEntry.elapsedMs)}`
                        : null}
                      {currentEntry.sourceNotes?.length
                        ? `${Number.isFinite(currentEntry.elapsedMs) || Number.isFinite(currentEntry.modelLoadMs) ? ' · ' : ''}Sources: ${currentEntry.sourceNotes.join(', ')}`
                        : null}
                      {currentEntry.model ? ` · model: ${currentEntry.model}` : ''}
                    </Typography>
                  ) : null}
                </>
              ) : null}
            </>
          ) : busy ? (
            <Typography
              variant="body2"
              role="status"
              aria-live="polite"
              sx={{ color: '#fff', textAlign: 'center', flexShrink: 0, fontWeight: 700, py: 2 }}
            >
              Processing and retrieving answer… {formatRagElapsed(liveElapsedMs)}
            </Typography>
          ) : (
            <Box sx={{ ...scrollableAnswerBoxSx, color: '#666', fontStyle: 'italic' }}>
              Answers appear here after you ask a question. Only notes with the RAG checkbox checked are
              included.
            </Box>
          )}
        </Stack>

        <Box sx={footerRowSx}>
          <GreenButton
            type="button"
            disabled={disabled || busy || !prompt.trim() || !noteCount}
            onClick={() => void handleAsk()}
            sx={dialogButtonSx}
          >
            {busy ? 'Thinking…' : 'Ask'}
          </GreenButton>
          <GreenButton type="button" disabled={busy} onClick={handleClose} sx={dialogButtonSx}>
            Close
          </GreenButton>
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

RecordVaultRagDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  selectedNoteIds: PropTypes.arrayOf(PropTypes.number),
  storageType: PropTypes.string,
  keepModelInMemory: PropTypes.bool,
  disabled: PropTypes.bool
};
