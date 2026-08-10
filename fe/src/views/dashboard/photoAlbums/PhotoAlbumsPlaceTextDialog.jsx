import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import GreenButton from 'ui-component/GreenButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { COLOR_TEMPLATE16_POPUP_Z_INDEX } from 'config/colorTemplate16PopupCenterWide';
import { colorTemplate7PopupSliderSx } from 'config/colorTemplate7PopupLargeDark';
import PhotoAlbumsFillOutlineColorPicker from './PhotoAlbumsFillOutlineColorPicker';
import PhotoAlbumsPlaceTextMediaPreview from './PhotoAlbumsPlaceTextMediaPreview';
import PhotoAlbumsEmojiPickerPopover from './PhotoAlbumsEmojiPickerPopover';
import { PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX } from './photoAlbumsEmojiPalette';
import { newLabelId } from './photoAlbumsTextLabelNode';

export const PLACE_TEXT_FONT_FAMILIES = [
  { label: 'Comic Sans MS', value: 'Comic Sans MS, Comic Neue, cursive' },
  { label: 'Herculanum', value: 'Herculanum, Papyrus, fantasy' },
  { label: 'Brush Script MT', value: '"Brush Script MT", "Segoe Script", cursive' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Bradley Hand', value: '"Bradley Hand", "Bradley Hand ITC", "Segoe Print", cursive' },
  { label: 'Snell Roundhand', value: '"Snell Roundhand", "Segoe Script", cursive' },
  { label: 'Optima', value: 'Optima, "Optima Medium", "Segoe UI", sans-serif' },
  { label: 'Comic Neue', value: 'Comic Neue, Comic Sans MS, cursive' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' }
];

export const PLACE_TEXT_FONT_WEIGHTS = [
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Semi Bold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Black', value: 900 }
];

/** Five pre-styled place-text buttons (font / fill / outline / size). */
export const PLACE_TEXT_STYLE_PRESETS = [
  {
    id: 'comic-yellow',
    label: 'Comic Sans MS · yellow',
    color: '#FBE618',
    outlineColor: '#000000',
    fontFamily: 'Comic Sans MS, Comic Neue, cursive',
    fontWeight: 700,
    fontSize: 45,
    outlineWidth: 5,
    uppercase: false
  },
  {
    id: 'herculanum-white',
    label: 'Herculanum · white',
    color: '#FFFFFF',
    outlineColor: '#000000',
    fontFamily: 'Herculanum, Papyrus, fantasy',
    fontWeight: 700,
    fontSize: 45,
    outlineWidth: 5,
    uppercase: true
  },
  {
    id: 'brush-red',
    label: 'Brush Script MT · red',
    color: '#E53935',
    outlineColor: '#000000',
    fontFamily: '"Brush Script MT", "Segoe Script", cursive',
    fontWeight: 700,
    fontSize: 45,
    outlineWidth: 5,
    uppercase: false
  },
  {
    id: 'courier-purple',
    label: 'Courier New · purple',
    color: '#9C27B0',
    outlineColor: '#000000',
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 700,
    fontSize: 45,
    outlineWidth: 5,
    uppercase: false
  },
  {
    id: 'bradley-blue',
    label: 'Bradley Hand · blue',
    color: '#1E88E5',
    outlineColor: '#000000',
    fontFamily: '"Bradley Hand", "Bradley Hand ITC", "Segoe Print", cursive',
    fontWeight: 700,
    fontSize: 45,
    outlineWidth: 5,
    uppercase: false
  }
];

export const PLACE_TEXT_DEFAULTS = {
  text: 'Hawaii Feb 2025',
  color: PLACE_TEXT_STYLE_PRESETS[0].color,
  outlineColor: PLACE_TEXT_STYLE_PRESETS[0].outlineColor,
  fontFamily: PLACE_TEXT_STYLE_PRESETS[0].fontFamily,
  fontWeight: PLACE_TEXT_STYLE_PRESETS[0].fontWeight,
  fontSize: PLACE_TEXT_STYLE_PRESETS[0].fontSize,
  outlineWidth: PLACE_TEXT_STYLE_PRESETS[0].outlineWidth
};

export const PLACE_TEXT_MAX_CHARS = 1_073_741_823;

/** Preview vs controls split in photo Add Text dialog (0–1). */
const PLACE_TEXT_PREVIEW_SPLIT_DEFAULT = 0.74;
const PLACE_TEXT_PREVIEW_SPLIT_MIN = 0.22;
const PLACE_TEXT_PREVIEW_SPLIT_MAX = 0.82;
const PLACE_TEXT_SPLIT_HANDLE_PX = 10;

const SELECT_MENU_Z = COLOR_TEMPLATE16_POPUP_Z_INDEX + 200;
const EMOJI_PICKER_Z = COLOR_TEMPLATE16_POPUP_Z_INDEX + 300;
const PLACE_TEXT_EMOJI_FONT = 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';

const labelSx = {
  color: 'var(--theme-yellow-color) !important',
  WebkitTextFillColor: 'var(--theme-yellow-color) !important',
  fontWeight: 700,
  fontSize: '0.9rem !important',
  fontFamily: MAIN_FONT_FAMILY,
  mb: 0.35
};

const selectSx = {
  bgcolor: '#fff',
  color: '#000',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 600,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
  '& .MuiSelect-select': {
    py: 1,
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    fontSize: '0.95rem !important'
  }
};

const selectMenuProps = {
  disableScrollLock: true,
  sx: { zIndex: SELECT_MENU_Z },
  style: { zIndex: SELECT_MENU_Z },
  slotProps: {
    root: {
      sx: { zIndex: SELECT_MENU_Z },
      style: { zIndex: SELECT_MENU_Z }
    }
  },
  PaperProps: {
    sx: {
      bgcolor: '#fff',
      border: '2px solid #000',
      maxHeight: 280,
      '& .MuiMenuItem-root': {
        color: '#000 !important',
        WebkitTextFillColor: '#000 !important',
        fontSize: '0.95rem !important'
      }
    }
  }
};

function sampleTextInlineStyle({
  color,
  outlineColor,
  fontFamily,
  fontWeight,
  fontSize,
  outlineWidth,
  uppercase = false
}) {
  const stroke = Math.max(0, Number(outlineWidth) || 0);
  const sizePx = Math.max(10, Number(fontSize) || 45);
  return {
    display: 'inline-block',
    maxWidth: '100%',
    boxSizing: 'border-box',
    fontFamily,
    fontWeight,
    fontSize: `${sizePx}px`,
    lineHeight: 1.2,
    color,
    WebkitTextFillColor: color,
    WebkitTextStroke: stroke > 0 ? `${stroke}px ${outlineColor}` : '0px transparent',
    paintOrder: 'stroke fill',
    textShadow: stroke > 0 ? `0 1px 0 ${outlineColor}` : 'none',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    textTransform: uppercase ? 'uppercase' : 'none'
  };
}

function stylePatchFromControls({
  text,
  color,
  outlineColor,
  fontFamily,
  fontWeight,
  fontSize,
  outlineWidth,
  selectedPreset
}) {
  const trimmed = String(text || '').trim() || PLACE_TEXT_DEFAULTS.text;
  const finalText = selectedPreset?.uppercase ? trimmed.toUpperCase() : trimmed;
  return {
    text: finalText,
    color,
    outlineColor,
    fontFamily,
    fontWeight,
    fontSize: Math.round(Number(fontSize) || PLACE_TEXT_DEFAULTS.fontSize),
    outlineWidth: Math.max(0, Math.round((Number(outlineWidth) || 0) * 10) / 10)
  };
}

/**
 * Add Text dialog — photo/video: top-half live preview + bottom-half font controls.
 * Page / album title: classic styling popup without media preview.
 */
export default function PhotoAlbumsPlaceTextDialog({
  open,
  initialText = '',
  initialStyle = null,
  existingLabels = null,
  initialExistingId = null,
  mediaSession = null,
  noteId = null,
  storageType = null,
  onClose,
  onConfirm
}) {
  const hasMedia = Boolean(mediaSession?.photoRect);
  const [text, setText] = useState(PLACE_TEXT_DEFAULTS.text);
  const [color, setColor] = useState(PLACE_TEXT_DEFAULTS.color);
  const [outlineColor, setOutlineColor] = useState(PLACE_TEXT_DEFAULTS.outlineColor);
  const [fontFamily, setFontFamily] = useState(PLACE_TEXT_DEFAULTS.fontFamily);
  const [fontWeight, setFontWeight] = useState(PLACE_TEXT_DEFAULTS.fontWeight);
  const [fontSize, setFontSize] = useState(PLACE_TEXT_DEFAULTS.fontSize);
  const [outlineWidth, setOutlineWidth] = useState(PLACE_TEXT_DEFAULTS.outlineWidth);
  const [selectedPresetId, setSelectedPresetId] = useState(PLACE_TEXT_STYLE_PRESETS[0].id);
  const [existingPick, setExistingPick] = useState('');
  const [labels, setLabels] = useState([]);
  const [activeKey, setActiveKey] = useState('');
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState(null);
  const skipStyleSyncRef = useRef(false);
  const splitContainerRef = useRef(null);
  const [previewSplitRatio, setPreviewSplitRatio] = useState(PLACE_TEXT_PREVIEW_SPLIT_DEFAULT);

  const labelOptions = useMemo(() => {
    const list = Array.isArray(existingLabels) ? existingLabels : [];
    return list
      .map((item, index) => {
        if (!item) return null;
        const labelId = String(item.labelId || '').trim();
        const pos = Number.isFinite(item.pos) ? item.pos : null;
        const key = labelId || (pos != null ? `__pos_${pos}` : `__idx_${index}`);
        return {
          key,
          labelId: labelId || null,
          pos,
          text: String(item.text || '').trim() || 'Text',
          color: item.color,
          outlineColor: item.outlineColor,
          outlineWidth: item.outlineWidth,
          fontSize: item.fontSize,
          fontFamily: item.fontFamily,
          fontWeight: item.fontWeight
        };
      })
      .filter(Boolean);
  }, [existingLabels]);

  const showExistingSelect = labelOptions.length >= 2;

  const applyStyleFields = useCallback((next, seededText) => {
    skipStyleSyncRef.current = true;
    setText(seededText || next.text || PLACE_TEXT_DEFAULTS.text);
    setColor(next.color || PLACE_TEXT_DEFAULTS.color);
    setOutlineColor(next.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor);
    setFontFamily(next.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily);
    setFontWeight(Number(next.fontWeight) || PLACE_TEXT_DEFAULTS.fontWeight);
    setFontSize(Number(next.fontSize) || PLACE_TEXT_DEFAULTS.fontSize);
    setOutlineWidth(
      next.outlineWidth != null && Number.isFinite(Number(next.outlineWidth))
        ? Number(next.outlineWidth)
        : PLACE_TEXT_DEFAULTS.outlineWidth
    );
    const match = PLACE_TEXT_STYLE_PRESETS.find(
      (p) =>
        p.fontFamily === (next.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily) &&
        String(p.color).toLowerCase() === String(next.color || PLACE_TEXT_DEFAULTS.color).toLowerCase()
    );
    setSelectedPresetId(match?.id || PLACE_TEXT_STYLE_PRESETS[0].id);
    requestAnimationFrame(() => {
      skipStyleSyncRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setEmojiPickerAnchor(null);
      return;
    }
    if (hasMedia) setPreviewSplitRatio(PLACE_TEXT_PREVIEW_SPLIT_DEFAULT);
    const next = { ...PLACE_TEXT_DEFAULTS, ...(initialStyle || {}) };
    const seeded = String(initialText || '').trim();
    applyStyleFields(next, seeded || next.text || PLACE_TEXT_DEFAULTS.text);

    if (hasMedia && mediaSession?.labels?.length) {
      const nextLabels = mediaSession.labels.map((l) => ({ ...l }));
      setLabels(nextLabels);
      const preferred =
        initialExistingId &&
        nextLabels.find(
          (l) =>
            l.labelId === String(initialExistingId) ||
            l.clientKey === String(initialExistingId)
        );
      const active = preferred || nextLabels[nextLabels.length - 1];
      setActiveKey(active?.clientKey || '');
      if (active) applyStyleFields(active, active.text);
    } else {
      setLabels([]);
      setActiveKey('');
    }

    if (showExistingSelect && initialExistingId) {
      const match = labelOptions.find(
        (o) => o.labelId === String(initialExistingId) || o.key === String(initialExistingId)
      );
      setExistingPick(match?.key || '');
    } else {
      setExistingPick('');
    }
  }, [
    open,
    initialText,
    initialStyle,
    initialExistingId,
    showExistingSelect,
    labelOptions,
    hasMedia,
    mediaSession,
    applyStyleFields
  ]);

  const selectedPreset = useMemo(
    () => PLACE_TEXT_STYLE_PRESETS.find((p) => p.id === selectedPresetId) || PLACE_TEXT_STYLE_PRESETS[0],
    [selectedPresetId]
  );

  const displayText = String(text || '').trim() || 'Hawaii Feb 2025';

  const patchActiveLabel = useCallback(
    (patch) => {
      if (!hasMedia || !activeKey) return;
      setLabels((prev) =>
        prev.map((l) => (l.clientKey === activeKey ? { ...l, ...patch } : l))
      );
    },
    [hasMedia, activeKey]
  );

  const activeLabelIsEmoji = useMemo(() => {
    const active = labels.find((l) => l.clientKey === activeKey);
    return Boolean(
      active &&
        (active.isEmoji || /Emoji/i.test(String(active.fontFamily || '')))
    );
  }, [labels, activeKey]);

  /** Keep preview labels in sync without RAF skip races from applyStyleFields. */
  const handleFillChange = useCallback(
    (next) => {
      setColor(next);
      if (!activeLabelIsEmoji) patchActiveLabel({ color: next });
    },
    [patchActiveLabel, activeLabelIsEmoji]
  );

  const handleOutlineChange = useCallback(
    (next) => {
      setOutlineColor(next);
      if (!activeLabelIsEmoji) patchActiveLabel({ outlineColor: next });
    },
    [patchActiveLabel, activeLabelIsEmoji]
  );

  useEffect(() => {
    if (!hasMedia || !activeKey || skipStyleSyncRef.current) return;
    if (activeLabelIsEmoji) {
      // Stickers: only size from the font-size slider (box tracks glyph size).
      const fs = Math.max(
        10,
        Math.round(Number(fontSize) || PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX)
      );
      const pw = Math.max(1, mediaSession?.photoRect?.width || 1);
      const ph = Math.max(1, mediaSession?.photoRect?.height || 1);
      patchActiveLabel({
        fontSize: fs,
        relW: Math.max(0.06, (fs + 12) / pw),
        relH: Math.max(0.06, (fs + 12) / ph)
      });
      return;
    }
    patchActiveLabel(
      stylePatchFromControls({
        text,
        color,
        outlineColor,
        fontFamily,
        fontWeight,
        fontSize,
        outlineWidth,
        selectedPreset
      })
    );
  }, [
    hasMedia,
    activeKey,
    activeLabelIsEmoji,
    text,
    color,
    outlineColor,
    fontFamily,
    fontWeight,
    fontSize,
    outlineWidth,
    selectedPreset,
    mediaSession,
    patchActiveLabel
  ]);

  const activateLabel = useCallback(
    (key) => {
      if (!key) return;
      setActiveKey(key);
      const l = labels.find((item) => item.clientKey === key);
      if (!l) return;
      const isEmoji =
        Boolean(l.isEmoji) || /Emoji/i.test(String(l.fontFamily || ''));
      if (isEmoji) {
        // Stickers: update size slider only — never replace caption Text / style samples.
        skipStyleSyncRef.current = true;
        setFontSize(
          Math.max(
            10,
            Math.round(Number(l.fontSize) || PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX)
          )
        );
        requestAnimationFrame(() => {
          skipStyleSyncRef.current = false;
        });
        return;
      }
      applyStyleFields(l, l.text);
    },
    [labels, applyStyleFields]
  );

  const applyPreset = (preset) => {
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setColor(preset.color);
    setOutlineColor(preset.outlineColor);
    setFontFamily(preset.fontFamily);
    setFontWeight(preset.fontWeight);
    setFontSize(preset.fontSize);
    setOutlineWidth(preset.outlineWidth);
    if (activeLabelIsEmoji) return;
    // Sync immediately — do not wait on the style-sync effect (skipStyleSync races).
    patchActiveLabel({
      color: preset.color,
      outlineColor: preset.outlineColor,
      fontFamily: preset.fontFamily,
      fontWeight: preset.fontWeight,
      fontSize: preset.fontSize,
      outlineWidth: preset.outlineWidth
    });
  };

  const handleExistingPick = (key) => {
    setExistingPick(key);
    if (!key) return;
    const opt = labelOptions.find((o) => o.key === key);
    if (!opt) return;
    applyStyleFields(
      {
        color: opt.color,
        outlineColor: opt.outlineColor,
        outlineWidth: opt.outlineWidth,
        fontSize: opt.fontSize,
        fontFamily: opt.fontFamily,
        fontWeight: opt.fontWeight
      },
      opt.text
    );
    if (hasMedia) {
      const match = labels.find(
        (l) =>
          (opt.labelId && l.labelId === opt.labelId) ||
          (opt.pos != null && l.docPos === opt.pos)
      );
      if (match) activateLabel(match.clientKey);
    }
  };

  const handleLabelChange = useCallback(
    (clientKey, patch) => {
      setLabels((prev) =>
        prev.map((l) => (l.clientKey === clientKey ? { ...l, ...patch } : l))
      );
      if (clientKey === activeKey && patch.fontSize != null) {
        skipStyleSyncRef.current = true;
        setFontSize(Number(patch.fontSize) || PLACE_TEXT_DEFAULTS.fontSize);
        requestAnimationFrame(() => {
          skipStyleSyncRef.current = false;
        });
      }
    },
    [activeKey]
  );

  const handleLabelDelete = useCallback(
    (clientKey) => {
      if (!clientKey) return;
      setLabels((prev) => {
        const next = prev.filter((l) => l.clientKey !== clientKey);
        if (clientKey === activeKey) {
          const fallback = next[next.length - 1] || null;
          setActiveKey(fallback?.clientKey || '');
          if (fallback) applyStyleFields(fallback, fallback.text);
        }
        return next;
      });
    },
    [activeKey, applyStyleFields]
  );

  const startPreviewSplitDrag = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const startY = event.clientY;
      const startRatio = previewSplitRatio;

      const onMove = (moveEvent) => {
        const dy = moveEvent.clientY - startY;
        const next = startRatio + dy / Math.max(1, rect.height);
        setPreviewSplitRatio(
          Math.min(
            PLACE_TEXT_PREVIEW_SPLIT_MAX,
            Math.max(PLACE_TEXT_PREVIEW_SPLIT_MIN, next)
          )
        );
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [previewSplitRatio]
  );

  const handleOk = () => {
    const style = stylePatchFromControls({
      text,
      color,
      outlineColor,
      fontFamily,
      fontWeight,
      fontSize,
      outlineWidth,
      selectedPreset
    });
    const picked = existingPick ? labelOptions.find((o) => o.key === existingPick) : null;

    let finalLabels = labels;
    if (hasMedia && activeKey) {
      const active = labels.find((l) => l.clientKey === activeKey);
      // Don't overwrite emoji stickers with the text-style form fields.
      if (active && !active.isEmoji && !/Emoji/i.test(String(active.fontFamily || ''))) {
        finalLabels = labels.map((l) =>
          l.clientKey === activeKey ? { ...l, ...style } : l
        );
      }
    }

    onConfirm?.({
      ...style,
      ...(showExistingSelect
        ? {
            editLabelId: picked?.labelId || null,
            editPos: picked?.pos ?? null
          }
        : null),
      ...(hasMedia && mediaSession
        ? {
            placeTextSession: {
              ...mediaSession,
              labels: finalLabels
            }
          }
        : null)
    });
  };

  const handlePlaceEmoji = useCallback(
    (em) => {
      const emoji = String(em || '').trim();
      if (!emoji || !hasMedia || !mediaSession?.photoRect) return;
      const pw = Math.max(1, mediaSession.photoRect.width);
      const ph = Math.max(1, mediaSession.photoRect.height);
      const size = PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX;
      const clientKey = `emoji_${Date.now()}`;
      const next = {
        clientKey,
        isNew: true,
        isEmoji: true,
        docPos: null,
        labelId: newLabelId(),
        text: emoji,
        color: '#000000',
        outlineColor: '#000000',
        outlineWidth: 0,
        fontSize: size,
        fontFamily: PLACE_TEXT_EMOJI_FONT,
        fontWeight: 400,
        rotationDeg: 0,
        relX: 0.38,
        relY: 0.38,
        relW: Math.max(0.06, (size + 12) / pw),
        relH: Math.max(0.06, (size + 12) / ph)
      };
      setLabels((prev) => [...prev, next]);
      // Select sticker for drag/resize, but do not overwrite Text / style-preset samples.
      skipStyleSyncRef.current = true;
      setActiveKey(clientKey);
      requestAnimationFrame(() => {
        skipStyleSyncRef.current = false;
      });
      setEmojiPickerAnchor(null);
    },
    [hasMedia, mediaSession]
  );

  const stylePresetButtons = (compact = false) => (
    <Stack spacing={compact ? 0.35 : 0.5} sx={{ mb: compact ? 0.5 : 1 }}>
      {PLACE_TEXT_STYLE_PRESETS.map((preset) => {
        const selected = preset.id === selectedPresetId;
        const styleForButton = selected
          ? {
              color,
              outlineColor,
              fontFamily,
              fontWeight,
              fontSize: Math.round(Number(fontSize) || preset.fontSize),
              outlineWidth,
              uppercase: preset.uppercase
            }
          : {
              color: preset.color,
              outlineColor: preset.outlineColor,
              fontFamily: preset.fontFamily,
              fontWeight: preset.fontWeight,
              fontSize: preset.fontSize,
              outlineWidth: preset.outlineWidth,
              uppercase: preset.uppercase
            };
        const capSize = compact ? 22 : 28;
        return (
          <Box
            key={preset.id}
            component="button"
            type="button"
            aria-pressed={selected}
            aria-label={`Style preset: ${preset.label}`}
            title={preset.label}
            onClick={() => applyPreset(preset)}
            sx={{
              display: 'block',
              width: '100%',
              m: 0,
              p: compact ? (selected ? 0.35 : 0.25) : selected ? 0.65 : 0.5,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: '#fff',
              border: selected ? (compact ? '3px solid #e53935' : '4px solid #e53935') : '2px solid #000',
              borderRadius: 1,
              boxShadow: selected ? '0 2px 8px rgba(229,57,53,0.35)' : '0 1px 2px rgba(0,0,0,0.15)',
              '&:focus-visible': {
                outline: '2px solid #ffeb3b',
                outlineOffset: 2
              }
            }}
          >
            <span
              style={sampleTextInlineStyle({
                ...styleForButton,
                fontSize: Math.min(capSize, styleForButton.fontSize)
              })}
            >
              {displayText}
            </span>
          </Box>
        );
      })}
    </Stack>
  );

  const textInputBlock = (compact = false) => (
    <>
      <Typography sx={{ ...labelSx, mb: 0.5 }}>Text</Typography>
      {showExistingSelect ? (
        <Select
          fullWidth
          size="small"
          displayEmpty
          value={existingPick}
          onChange={(e) => handleExistingPick(e.target.value)}
          sx={{ ...selectSx, mb: compact ? 0.5 : 1 }}
          MenuProps={selectMenuProps}
          inputProps={{ 'aria-label': 'Select existing text on this photo' }}
          renderValue={(selected) => {
            if (!selected) return 'Select';
            const opt = labelOptions.find((o) => o.key === selected);
            return opt?.text || 'Select';
          }}
        >
          <MenuItem value="">
            <em>New text…</em>
          </MenuItem>
          {labelOptions.map((opt) => (
            <MenuItem key={opt.key} value={opt.key}>
              {opt.text}
            </MenuItem>
          ))}
        </Select>
      ) : null}
      <TextField
        value={text}
        onChange={(e) => setText(String(e.target.value ?? '').slice(0, PLACE_TEXT_MAX_CHARS))}
        placeholder="Hawaii Feb 2025"
        autoFocus={!hasMedia}
        fullWidth
        multiline={!compact}
        minRows={compact ? undefined : 3}
        maxRows={compact ? undefined : 3}
        inputProps={{
          maxLength: PLACE_TEXT_MAX_CHARS,
          'aria-label': 'Add text',
          spellCheck: true
        }}
        sx={{
          width: '100%',
          bgcolor: '#fff',
          '& .MuiOutlinedInput-root': {
            bgcolor: '#fff',
            alignItems: 'stretch',
            '& fieldset': { borderColor: '#000', borderWidth: 2 },
            '&:hover fieldset': { borderColor: '#000' },
            '&.Mui-focused fieldset': { borderColor: '#000' }
          },
          '& .MuiInputBase-input': {
            color: '#000',
            WebkitTextFillColor: '#000',
            fontFamily: MAIN_FONT_FAMILY,
            fontWeight: 600,
            fontSize: compact ? '0.95rem' : '1rem',
            lineHeight: 1.35,
            py: compact ? 0.75 : 1,
            px: 1.25,
            resize: 'none'
          }
        }}
      />
    </>
  );

  const sizeSliderRow = (
    <Stack
      direction="row"
      spacing={hasMedia ? 0.75 : 1.5}
      sx={{
        mt: hasMedia ? 0.5 : 1.5,
        flexShrink: 0,
        width: '100%'
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: hasMedia ? 0.5 : 1
        }}
      >
        <Typography
          sx={{
            ...labelSx,
            mb: 0,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            ...(hasMedia ? { fontSize: '0.82rem !important' } : {})
          }}
        >
          Font size: {Math.round(fontSize)} pt
        </Typography>
        <Slider
          min={10}
          max={120}
          step={0.5}
          value={fontSize}
          onChange={(_, v) => setFontSize(Array.isArray(v) ? v[0] : v)}
          sx={{ ...colorTemplate7PopupSliderSx(), flex: 1, minWidth: hasMedia ? 72 : 48, m: 0 }}
          aria-label="Font size"
        />
      </Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: hasMedia ? 0.5 : 1
        }}
      >
        <Typography
          sx={{
            ...labelSx,
            mb: 0,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            ...(hasMedia ? { fontSize: '0.82rem !important' } : {})
          }}
        >
          Outline width: {Number(outlineWidth).toFixed(1)} pt
        </Typography>
        <Slider
          min={0}
          max={12}
          step={0.5}
          value={outlineWidth}
          onChange={(_, v) => setOutlineWidth(Array.isArray(v) ? v[0] : v)}
          sx={{ ...colorTemplate7PopupSliderSx(), flex: 1, minWidth: hasMedia ? 72 : 48, m: 0 }}
          aria-label="Outline width"
        />
      </Box>
    </Stack>
  );

  const controlsPanel = (
    <Box
      sx={{
        flex: hasMedia ? '1 1 auto' : '0 0 auto',
        height: hasMedia ? '100%' : 'auto',
        minHeight: hasMedia ? 0 : undefined,
        overflow: hasMedia ? 'hidden' : 'auto',
        display: hasMedia ? 'flex' : 'block',
        flexDirection: hasMedia ? 'column' : undefined
      }}
    >
      <Box
        sx={{
          p: 1,
          border: '2px dashed var(--theme-yellow-color, #ffd700)',
          borderRadius: hasMedia ? 0 : 1,
          bgcolor: 'rgba(0,0,0,0.18)',
          flex: hasMedia ? '1 1 auto' : undefined,
          minHeight: hasMedia ? 0 : undefined,
          overflow: hasMedia ? 'auto' : undefined,
          display: hasMedia ? 'flex' : 'block',
          flexDirection: hasMedia ? 'column' : undefined
        }}
      >
        {hasMedia ? (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ flex: '1 1 auto', minHeight: 0, alignItems: 'stretch' }}
          >
            <Box
              sx={{
                flex: '0 0 34%',
                minWidth: 200,
                maxWidth: 360,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
              }}
            >
              <PhotoAlbumsFillOutlineColorPicker
                fillColor={color}
                outlineColor={outlineColor}
                onFillChange={handleFillChange}
                onOutlineChange={handleOutlineChange}
              />
            </Box>

            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
              }}
            >
              {stylePresetButtons(true)}
              {textInputBlock(true)}
              {sizeSliderRow}
            </Box>

            <Box
              sx={{
                flex: '0 0 17%',
                minWidth: 128,
                maxWidth: 180,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
              }}
            >
              <Typography sx={labelSx}>Font family</Typography>
              <Select
                fullWidth
                size="small"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                sx={selectSx}
                MenuProps={selectMenuProps}
              >
                {PLACE_TEXT_FONT_FAMILIES.map((f) => (
                  <MenuItem key={f.value} value={f.value} sx={{ fontFamily: f.value }}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
              <Box sx={{ mt: 1 }}>
                <Typography sx={labelSx}>Font weight</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={fontWeight}
                  onChange={(e) => setFontWeight(Number(e.target.value))}
                  sx={selectSx}
                  MenuProps={selectMenuProps}
                >
                  {PLACE_TEXT_FONT_WEIGHTS.map((w) => (
                    <MenuItem key={w.value} value={w.value}>
                      {w.label}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="flex-end"
                alignItems="center"
                sx={{ mt: 'auto', pt: 1, flexShrink: 0 }}
              >
                <GreenButton
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={emojiPickerAnchor ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = e.currentTarget;
                    setEmojiPickerAnchor((prev) => (prev ? null : el));
                  }}
                  sx={{ minWidth: 80, fontWeight: 800 }}
                >
                  Emoji
                </GreenButton>
                <GreenButton type="button" onClick={onClose} sx={{ minWidth: 80, fontWeight: 800 }}>
                  Cancel
                </GreenButton>
                <GreenButton type="button" onClick={handleOk} sx={{ minWidth: 80, fontWeight: 800 }}>
                  OK
                </GreenButton>
              </Stack>
              <PhotoAlbumsEmojiPickerPopover
                open={Boolean(emojiPickerAnchor)}
                anchorEl={emojiPickerAnchor}
                onClose={() => setEmojiPickerAnchor(null)}
                onPick={(em) => handlePlaceEmoji(em)}
                zIndex={EMOJI_PICKER_Z}
              />
            </Box>
          </Stack>
        ) : (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'flex-start' } }}
          >
            <Box sx={{ flex: '1 1 28%', minWidth: 160 }}>
              <PhotoAlbumsFillOutlineColorPicker
                fillColor={color}
                outlineColor={outlineColor}
                onFillChange={handleFillChange}
                onOutlineChange={handleOutlineChange}
              />
              {sizeSliderRow}
            </Box>

            <Box sx={{ flex: '1 1 24%', minWidth: 150 }}>
              <Typography sx={labelSx}>Font family</Typography>
              <Select
                fullWidth
                size="small"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                sx={selectSx}
                MenuProps={selectMenuProps}
              >
                {PLACE_TEXT_FONT_FAMILIES.map((f) => (
                  <MenuItem key={f.value} value={f.value} sx={{ fontFamily: f.value }}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={labelSx}>Font weight</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={fontWeight}
                  onChange={(e) => setFontWeight(Number(e.target.value))}
                  sx={selectSx}
                  MenuProps={selectMenuProps}
                >
                  {PLACE_TEXT_FONT_WEIGHTS.map((w) => (
                    <MenuItem key={w.value} value={w.value}>
                      {w.label}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            <Box sx={{ flex: '1 1 34%', minWidth: 180 }}>
              {stylePresetButtons(false)}
              {textInputBlock(false)}
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      resizable={hasMedia}
      fillViewportHeight={hasMedia}
      defaultResizeHeight={hasMedia ? '100vh' : undefined}
      maxResizeHeight={hasMedia ? '100vh' : undefined}
      contentSx={
        hasMedia
          ? {
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              flex: '1 1 auto',
              overflow: 'hidden',
              overflowY: 'hidden',
              pt: { xs: 1, sm: 1.25 },
              px: { xs: 1, sm: 1.5 },
              pb: 0
            }
          : undefined
      }
      cardSx={
        hasMedia
          ? { display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto', height: '100%' }
          : undefined
      }
    >
      <ColorTemplate16PopupCenterWide.Title
        sx={hasMedia ? { flexShrink: 0, py: 0.75 } : undefined}
      >
        Add Text
      </ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body
        spacing={hasMedia ? 0.75 : 1.5}
        sx={
          hasMedia
            ? {
                flex: 1,
                minHeight: 0,
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }
            : undefined
        }
      >
        <ColorTemplate16PopupCenterWide.SectionDescription
          sx={hasMedia ? { flexShrink: 0, mb: 0, lineHeight: 1.3, fontSize: '0.88rem' } : undefined}
        >
          {hasMedia
            ? 'Type below — text updates live on the photo. Use Emoji to place stickers. Drag corners to scale; drag sides to stretch the box. Drag the yellow bar to resize preview vs controls.'
            : 'Style your text, then OK to place it on the page (drag & rotate like a photo).'}
        </ColorTemplate16PopupCenterWide.SectionDescription>

        {hasMedia ? (
          <Box
            ref={splitContainerRef}
            sx={{
              display: 'grid',
              gridTemplateRows: `${previewSplitRatio}fr ${PLACE_TEXT_SPLIT_HANDLE_PX}px ${1 - previewSplitRatio}fr`,
              flex: '1 1 auto',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <Box sx={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <PhotoAlbumsPlaceTextMediaPreview
                session={mediaSession}
                labels={labels}
                activeKey={activeKey}
                noteId={noteId}
                storageType={storageType}
                onActivate={activateLabel}
                onLabelChange={handleLabelChange}
                onLabelDelete={handleLabelDelete}
                onDoubleClickLabel={activateLabel}
              />
            </Box>
            <Box
              role="separator"
              aria-orientation="horizontal"
              aria-label="Drag to resize photo preview and font controls"
              aria-valuenow={Math.round(previewSplitRatio * 100)}
              aria-valuemin={Math.round(PLACE_TEXT_PREVIEW_SPLIT_MIN * 100)}
              aria-valuemax={Math.round(PLACE_TEXT_PREVIEW_SPLIT_MAX * 100)}
              onMouseDown={startPreviewSplitDrag}
              sx={{
                cursor: 'row-resize',
                touchAction: 'none',
                bgcolor: 'rgba(255,235,59,0.25)',
                borderTop: '2px solid var(--theme-yellow-color, #ffd700)',
                borderBottom: '2px solid var(--theme-yellow-color, #ffd700)',
                zIndex: 2,
                '@media (hover: hover)': {
                  '&:hover': { bgcolor: 'rgba(255,235,59,0.45)' }
                }
              }}
            />
            <Box
              sx={{
                minHeight: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {controlsPanel}
            </Box>
          </Box>
        ) : (
          <>
            <Stack spacing={1.25} sx={{ mt: 1.5, mb: 2, py: 1.5, overflow: 'visible' }}>
              {PLACE_TEXT_STYLE_PRESETS.map((preset) => {
                const selected = preset.id === selectedPresetId;
                const styleForButton = selected
                  ? {
                      color,
                      outlineColor,
                      fontFamily,
                      fontWeight,
                      fontSize: Math.round(Number(fontSize) || preset.fontSize),
                      outlineWidth,
                      uppercase: preset.uppercase
                    }
                  : {
                      color: preset.color,
                      outlineColor: preset.outlineColor,
                      fontFamily: preset.fontFamily,
                      fontWeight: preset.fontWeight,
                      fontSize: preset.fontSize,
                      outlineWidth: preset.outlineWidth,
                      uppercase: preset.uppercase
                    };
                return (
                  <Box key={preset.id} sx={{ display: 'flex', justifyContent: 'center', py: selected ? 0.75 : 0 }}>
                    <Box
                      component="button"
                      type="button"
                      aria-pressed={selected}
                      onClick={() => applyPreset(preset)}
                      sx={{
                        display: 'block',
                        width: selected ? '80%' : '100%',
                        p: selected ? 1.5 : 1.15,
                        textAlign: 'center',
                        cursor: 'pointer',
                        bgcolor: '#fff',
                        border: selected ? '8px solid #e53935' : '2px solid #000',
                        borderRadius: 1
                      }}
                    >
                      <span style={sampleTextInlineStyle(styleForButton)}>{displayText}</span>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
            {controlsPanel}
          </>
        )}

        {!hasMedia ? (
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2, flexShrink: 0 }}>
            <GreenButton type="button" onClick={onClose} sx={{ minWidth: 96, fontWeight: 800 }}>
              Cancel
            </GreenButton>
            <GreenButton type="button" onClick={handleOk} sx={{ minWidth: 96, fontWeight: 800 }}>
              OK
            </GreenButton>
          </Stack>
        ) : null}
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

PhotoAlbumsPlaceTextDialog.propTypes = {
  open: PropTypes.bool,
  initialText: PropTypes.string,
  initialStyle: PropTypes.object,
  existingLabels: PropTypes.arrayOf(
    PropTypes.shape({
      labelId: PropTypes.string,
      pos: PropTypes.number,
      text: PropTypes.string,
      color: PropTypes.string,
      outlineColor: PropTypes.string,
      outlineWidth: PropTypes.number,
      fontSize: PropTypes.number,
      fontFamily: PropTypes.string,
      fontWeight: PropTypes.number
    })
  ),
  initialExistingId: PropTypes.string,
  mediaSession: PropTypes.object,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func
};
