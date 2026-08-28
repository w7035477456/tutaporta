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
import YellowButtonTemplate from 'ui-component/YellowButtonTemplate';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { COLOR_TEMPLATE16_POPUP_Z_INDEX } from 'config/colorTemplate16PopupCenterWide';
import { colorTemplate7PopupSliderSx } from 'config/colorTemplate7PopupLargeDark';
import PhotoAlbumsFillOutlineColorPicker from './PhotoAlbumsFillOutlineColorPicker';
import PhotoAlbumsPlaceTextMediaPreview from './PhotoAlbumsPlaceTextMediaPreview';
import PhotoAlbumsEmojiPickerPopover from './PhotoAlbumsEmojiPickerPopover';
import { PHOTO_ALBUMS_EMOJI_DEFAULT_SIZE_PX } from './photoAlbumsEmojiPalette';
import { newLabelId } from './photoAlbumsTextLabelNode';
import {
  computePlaceTextBottomRightRel,
  resolvePlaceTextCaption
} from './photoAlbumsPlaceTextPosition';
import {
  SLOT_ZOOM_PCT_MAX,
  SLOT_ZOOM_PCT_MIN,
  centeredPan,
  computeFramedZoomPatch,
  coverSizeForFrame,
  fitSizeForFrame,
  framedZoomPercentFromWidth,
  slotZoomPctLabelSx,
  slotZoomSliderRowSx,
  slotZoomSliderSx
} from './photoAlbumsSlotZoom';

export const PLACE_TEXT_FONT_FAMILIES = [
  { label: 'Algerian', value: 'Algerian, fantasy' },
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
    id: 'algerian-yellow',
    label: 'Algerian · yellow',
    color: '#FBE618',
    outlineColor: '#000000',
    fontFamily: 'Algerian, fantasy',
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
  text: 'Sample Feb 2025',
  color: '#F8E618',
  outlineColor: '#000000',
  fontFamily: 'Algerian, fantasy',
  fontWeight: 700,
  fontSize: 13,
  outlineWidth: 5,
  rotationDeg: -45
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
  selectedPreset,
  allowSampleFallback = true
}) {
  const trimmed = String(text || '').trim();
  const finalText =
    trimmed || (allowSampleFallback ? PLACE_TEXT_DEFAULTS.text : trimmed);
  const presetText = selectedPreset?.uppercase ? finalText.toUpperCase() : finalText;
  return {
    text: presetText,
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
  onConfirm,
  /** Apply rotate / slot-fit / pan-zoom patches onto the album photo node. */
  onPhotoChromeChange = null
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
  const [panEnabled, setPanEnabled] = useState(false);
  const [photoRotationDeg, setPhotoRotationDeg] = useState(0);
  const [photoSlotFit, setPhotoSlotFit] = useState('cover');
  const [mediaAspect, setMediaAspect] = useState(0);
  const skipStyleSyncRef = useRef(false);
  const splitContainerRef = useRef(null);
  const openSnapshotRef = useRef(null);
  const dialogInitRef = useRef(false);
  const seedSampleOnEmptyRef = useRef(true);
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

  const applyStyleFields = useCallback((next, seededText, allowSampleFallback = true) => {
    skipStyleSyncRef.current = true;
    const resolvedText =
      seededText != null
        ? String(seededText)
        : String(next.text ?? '').trim() ||
          (allowSampleFallback ? PLACE_TEXT_DEFAULTS.text : '');
    setText(resolvedText);
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
      setPanEnabled(false);
      setLabels([]);
      setActiveKey('');
      dialogInitRef.current = false;
      openSnapshotRef.current = null;
      return;
    }
    // Seed once per open — do not re-init when mediaSession chrome updates (pan/zoom).
    if (dialogInitRef.current) return;
    dialogInitRef.current = true;

    if (hasMedia) setPreviewSplitRatio(PLACE_TEXT_PREVIEW_SPLIT_DEFAULT);
    const rot0 = Number(mediaSession?.rotationDeg) || 0;
    const fit0 =
      String(mediaSession?.slotFit || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
    setPhotoRotationDeg(rot0);
    setPhotoSlotFit(fit0);
    setPanEnabled(false);

    const next = { ...PLACE_TEXT_DEFAULTS, ...(initialStyle || {}) };
    const seeded = String(initialText ?? '').trim();
    const preExistingOverlayCount = Number.isFinite(Number(mediaSession?.existingOverlayCount))
      ? Math.max(0, Number(mediaSession.existingOverlayCount))
      : Array.isArray(mediaSession?.labels)
        ? mediaSession.labels.filter((l) => !l.isNew).length
        : 0;
    seedSampleOnEmptyRef.current = preExistingOverlayCount < 1;

    let nextLabels = [];
    let nextActiveKey = '';
    if (hasMedia && mediaSession?.labels?.length) {
      nextLabels = mediaSession.labels.map((l) => ({ ...l }));
      if (preExistingOverlayCount >= 1) {
        nextLabels = nextLabels.filter((l) => !l.isNew);
      }
      const preferred =
        initialExistingId &&
        nextLabels.find(
          (l) =>
            l.labelId === String(initialExistingId) ||
            l.clientKey === String(initialExistingId)
        );
      const active = preferred || nextLabels[nextLabels.length - 1];
      nextActiveKey = active?.clientKey || '';
    }

    const activeLabelText = nextActiveKey
      ? String(nextLabels.find((l) => l.clientKey === nextActiveKey)?.text || '').trim()
      : '';
    const initialFieldText = resolvePlaceTextCaption({
      explicitText:
        seeded ||
        activeLabelText ||
        (preExistingOverlayCount >= 1 ? '' : next.text),
      existingOverlayCount: preExistingOverlayCount,
      editing: Boolean(initialExistingId)
    });
    applyStyleFields(next, initialFieldText, seedSampleOnEmptyRef.current);

    if (hasMedia && nextLabels.length) {
      setLabels(nextLabels);
      setActiveKey(nextActiveKey);
      const active = nextLabels.find((l) => l.clientKey === nextActiveKey);
      if (active) applyStyleFields(active, active.text);
    } else {
      setLabels([]);
      setActiveKey('');
    }

    let nextExistingPick = '';
    if (showExistingSelect && initialExistingId) {
      const match = labelOptions.find(
        (o) => o.labelId === String(initialExistingId) || o.key === String(initialExistingId)
      );
      nextExistingPick = match?.key || '';
      setExistingPick(nextExistingPick);
    } else {
      setExistingPick('');
    }

    openSnapshotRef.current = {
      text: initialFieldText,
      color: next.color || PLACE_TEXT_DEFAULTS.color,
      outlineColor: next.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
      fontFamily: next.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
      fontWeight: Number(next.fontWeight) || PLACE_TEXT_DEFAULTS.fontWeight,
      fontSize: Number(next.fontSize) || PLACE_TEXT_DEFAULTS.fontSize,
      outlineWidth:
        next.outlineWidth != null && Number.isFinite(Number(next.outlineWidth))
          ? Number(next.outlineWidth)
          : PLACE_TEXT_DEFAULTS.outlineWidth,
      selectedPresetId: PLACE_TEXT_STYLE_PRESETS[0].id,
      labels: nextLabels.map((l) => ({ ...l })),
      activeKey: nextActiveKey,
      existingPick: nextExistingPick,
      panEnabled: false,
      photoRotationDeg: rot0,
      photoSlotFit: fit0,
      photoChrome: {
        rotationDeg: rot0,
        slotFit: fit0,
        panX: mediaSession?.panX ?? null,
        panY: mediaSession?.panY ?? null,
        width: mediaSession?.photoW ?? null,
        height: mediaSession?.photoH ?? null,
        panZoom: false
      }
    };
    // Re-apply active label style into snapshot after preferred label override.
    if (nextActiveKey) {
      const active = nextLabels.find((l) => l.clientKey === nextActiveKey);
      if (active) {
        openSnapshotRef.current = {
          ...openSnapshotRef.current,
          text: active.text || openSnapshotRef.current.text,
          color: active.color || openSnapshotRef.current.color,
          outlineColor: active.outlineColor || openSnapshotRef.current.outlineColor,
          fontFamily: active.fontFamily || openSnapshotRef.current.fontFamily,
          fontWeight: Number(active.fontWeight) || openSnapshotRef.current.fontWeight,
          fontSize: Number(active.fontSize) || openSnapshotRef.current.fontSize,
          outlineWidth:
            active.outlineWidth != null && Number.isFinite(Number(active.outlineWidth))
              ? Number(active.outlineWidth)
              : openSnapshotRef.current.outlineWidth
        };
      }
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

  const displayText =
    String(text || '').trim() ||
    (seedSampleOnEmptyRef.current ? PLACE_TEXT_DEFAULTS.text : '');

  const previewSession = useMemo(() => {
    if (!mediaSession) return null;
    return {
      ...mediaSession,
      rotationDeg: photoRotationDeg,
      slotFit: photoSlotFit
    };
  }, [mediaSession, photoRotationDeg, photoSlotFit]);

  const applyPhotoChrome = useCallback(
    (patch) => {
      if (typeof onPhotoChromeChange === 'function') onPhotoChromeChange(patch);
    },
    [onPhotoChromeChange]
  );

  const handleTogglePanZoom = useCallback(() => {
    setPanEnabled((v) => {
      const next = !v;
      applyPhotoChrome({ panZoom: next });
      return next;
    });
  }, [applyPhotoChrome]);

  const handleRotatePhoto = useCallback(() => {
    setPhotoRotationDeg((prev) => {
      const next = (((Number(prev) || 0) + 90) % 360 + 360) % 360;
      applyPhotoChrome({ rotationDeg: next });
      return next;
    });
  }, [applyPhotoChrome]);

  const handlePhotoFitFull = useCallback(() => {
    setPhotoSlotFit('contain');
    const rect = mediaSession?.photoRect;
    const aspect = mediaAspect > 0 ? mediaAspect : 4 / 3;
    if (rect?.width && rect?.height) {
      const fit = fitSizeForFrame(aspect, rect.width, rect.height, 'contain');
      const pan = centeredPan(fit.width, fit.height, rect.width, rect.height);
      applyPhotoChrome({
        slotFit: 'contain',
        width: fit.width,
        height: fit.height,
        panX: pan.panX,
        panY: pan.panY
      });
    } else {
      applyPhotoChrome({ slotFit: 'contain' });
    }
  }, [applyPhotoChrome, mediaSession, mediaAspect]);

  const handlePhotoFitZoom = useCallback(() => {
    setPhotoSlotFit('cover');
    const rect = mediaSession?.photoRect;
    const aspect = mediaAspect > 0 ? mediaAspect : 4 / 3;
    if (rect?.width && rect?.height) {
      const fit = fitSizeForFrame(aspect, rect.width, rect.height, 'cover');
      const pan = centeredPan(fit.width, fit.height, rect.width, rect.height);
      applyPhotoChrome({
        slotFit: 'cover',
        width: fit.width,
        height: fit.height,
        panX: pan.panX,
        panY: pan.panY
      });
    } else {
      applyPhotoChrome({ slotFit: 'cover' });
    }
  }, [applyPhotoChrome, mediaSession, mediaAspect]);

  const photoZoomPct = useMemo(() => {
    const rect = mediaSession?.photoRect;
    if (!rect?.width || !rect?.height) return 0;
    const aspect = mediaAspect > 0 ? mediaAspect : 4 / 3;
    const cover = coverSizeForFrame(aspect, rect.width, rect.height);
    const photoW = mediaSession?.photoW || cover.width;
    return framedZoomPercentFromWidth(photoW, aspect, rect.width, rect.height);
  }, [mediaSession, mediaAspect]);

  const handlePhotoZoomSliderChange = useCallback(
    (_, v) => {
      const pct = Array.isArray(v) ? v[0] : v;
      const rect = mediaSession?.photoRect;
      if (!rect?.width || !rect?.height) return;
      const aspect = mediaAspect > 0 ? mediaAspect : 4 / 3;
      const patch = computeFramedZoomPatch({
        pct,
        aspect,
        frameW: rect.width,
        frameH: rect.height,
        photoW: mediaSession?.photoW,
        photoH: mediaSession?.photoH,
        panX: mediaSession?.panX,
        panY: mediaSession?.panY
      });
      applyPhotoChrome(patch);
    },
    [mediaSession, mediaAspect, applyPhotoChrome]
  );

  const handleNaturalAspectRatio = useCallback((aspect) => {
    if (aspect > 0) setMediaAspect(aspect);
  }, []);

  const handleReset = useCallback(() => {
    const snap = openSnapshotRef.current;
    if (!snap) return;
    applyStyleFields(
      {
        text: snap.text,
        color: snap.color,
        outlineColor: snap.outlineColor,
        fontFamily: snap.fontFamily,
        fontWeight: snap.fontWeight,
        fontSize: snap.fontSize,
        outlineWidth: snap.outlineWidth
      },
      snap.text
    );
    setSelectedPresetId(snap.selectedPresetId || PLACE_TEXT_STYLE_PRESETS[0].id);
    setLabels((snap.labels || []).map((l) => ({ ...l })));
    setActiveKey(snap.activeKey || '');
    setExistingPick(snap.existingPick || '');
    setPanEnabled(Boolean(snap.panEnabled));
    setPhotoRotationDeg(Number(snap.photoRotationDeg) || 0);
    setPhotoSlotFit(snap.photoSlotFit === 'contain' ? 'contain' : 'cover');
    const chrome = snap.photoChrome || {};
    const patch = { panZoom: false };
    if (chrome.rotationDeg != null) patch.rotationDeg = chrome.rotationDeg;
    if (chrome.slotFit != null) patch.slotFit = chrome.slotFit;
    if (chrome.panX != null) patch.panX = chrome.panX;
    if (chrome.panY != null) patch.panY = chrome.panY;
    if (chrome.width != null) patch.width = chrome.width;
    if (chrome.height != null) patch.height = chrome.height;
    // Clear pan/size when they were unset at open so zoom returns to cover default.
    if (chrome.panX == null) patch.panX = null;
    if (chrome.panY == null) patch.panY = null;
    if (chrome.width == null) patch.width = null;
    if (chrome.height == null) patch.height = null;
    applyPhotoChrome(patch);
  }, [applyStyleFields, applyPhotoChrome]);

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
        selectedPreset,
        allowSampleFallback: seedSampleOnEmptyRef.current
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
    if (!key) {
      if (!hasMedia || !mediaSession?.photoRect) {
        applyStyleFields({ ...PLACE_TEXT_DEFAULTS, text: '' }, '', false);
        return;
      }
      const pw = Math.max(1, mediaSession.photoRect.width);
      const ph = Math.max(1, mediaSession.photoRect.height);
      const fs = Math.max(10, Math.round(Number(fontSize) || PLACE_TEXT_DEFAULTS.fontSize));
      const estW = Math.max(0.18, Math.min(0.75, (fs * 12) / pw));
      const estH = Math.max(0.08, Math.min(0.35, (fs * 1.4) / ph));
      const rotationDeg = PLACE_TEXT_DEFAULTS.rotationDeg;
      const { relX, relY } = computePlaceTextBottomRightRel({
        relW: estW,
        relH: estH,
        rotationDeg,
        margin: 0
      });
      const clientKey = `new_${Date.now()}`;
      const nextLabel = {
        clientKey,
        isNew: true,
        docPos: null,
        labelId: newLabelId(),
        text: '',
        rotationDeg,
        relX,
        relY,
        relW: estW,
        relH: estH,
        color,
        outlineColor,
        outlineWidth,
        fontSize: fs,
        fontFamily,
        fontWeight
      };
      setLabels((prev) => [...prev, nextLabel]);
      setActiveKey(clientKey);
      applyStyleFields({ ...PLACE_TEXT_DEFAULTS, text: '' }, '', false);
      return;
    }
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
      selectedPreset,
      allowSampleFallback: seedSampleOnEmptyRef.current
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
        placeholder={PLACE_TEXT_DEFAULTS.text}
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

  const mediaActionButtonRow = hasMedia ? (
    <Stack
      direction="row"
      spacing={0.75}
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      sx={{ mt: 0.75, mb: 0.25, flexShrink: 0, width: '100%' }}
    >
      <YellowButtonTemplate
        type="button"
        onClick={onClose}
        title="Ignore all changes and exit"
        sx={{ minWidth: 88, fontWeight: 800 }}
      >
        Cancel
      </YellowButtonTemplate>
      {!mediaSession?.isVideo ? (
        <Stack
          direction="row"
          spacing={0.75}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ flex: '1 1 auto', justifyContent: 'center' }}
        >
          <GreenButton
            type="button"
            aria-pressed={panEnabled}
            onClick={handleTogglePanZoom}
            title="Pan & Zoom — drag the photo inside its slot on the album page"
            sx={{
              minWidth: 88,
              fontWeight: 800,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              ...(panEnabled
                ? {
                    bgcolor: '#FFEB3B !important',
                    color: '#000 !important',
                    WebkitTextFillColor: '#000 !important',
                    border: '2px solid #000 !important'
                  }
                : null)
            }}
          >
            Pan & Zoom
          </GreenButton>
          <GreenButton
            type="button"
            onClick={handleRotatePhoto}
            title="Rotate photo 90° clockwise"
            sx={{ minWidth: 72, fontWeight: 800 }}
          >
            Rotate
          </GreenButton>
          <GreenButton
            type="button"
            aria-pressed={photoSlotFit === 'contain'}
            onClick={handlePhotoFitFull}
            title="Show the full photo in the slot (may leave edges)"
            sx={{
              minWidth: 64,
              fontWeight: 800,
              ...(photoSlotFit === 'contain' ? { outline: '2px solid #fff', outlineOffset: 1 } : null)
            }}
          >
            Full
          </GreenButton>
          <GreenButton
            type="button"
            aria-pressed={photoSlotFit === 'cover'}
            onClick={handlePhotoFitZoom}
            title="Fill the slot (may clip edges)"
            sx={{
              minWidth: 64,
              fontWeight: 800,
              ...(photoSlotFit === 'cover' ? { outline: '2px solid #fff', outlineOffset: 1 } : null)
            }}
          >
            Zoom
          </GreenButton>
          <GreenButton
            type="button"
            onClick={handleReset}
            title="Restore photo and text to how this popup opened"
            sx={{ minWidth: 72, fontWeight: 800 }}
          >
            Reset
          </GreenButton>
        </Stack>
      ) : (
        <Box sx={{ flex: '1 1 auto' }} aria-hidden />
      )}
      <GreenButton
        type="button"
        onClick={handleOk}
        title="Save all changes and exit"
        sx={{ minWidth: 88, fontWeight: 800 }}
      >
        Save
      </GreenButton>
    </Stack>
  ) : null;

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
              {mediaActionButtonRow}
              {sizeSliderRow}
              {stylePresetButtons(true)}
              {textInputBlock(true)}
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
                spacing={0.75}
                justifyContent="flex-end"
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
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
      onClose={handleOk}
      closeOnBackdrop={false}
      showCloseButton
      maxWidth={hasMedia ? '90vw' : undefined}
      resizable={hasMedia}
      fillViewportHeight={false}
      defaultResizeHeight={hasMedia ? '90vh' : undefined}
      maxResizeHeight={hasMedia ? '90vh' : undefined}
      panelShellSx={
        hasMedia
          ? {
              width: '90vw',
              maxWidth: '90vw',
              height: '90vh',
              maxHeight: '90vh',
              minHeight: '90vh'
            }
          : undefined
      }
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
        {hasMedia ? 'Photo/Video Edit' : 'Add Text'}
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
            ? mediaSession?.isVideo
              ? 'Type below — text updates live on the video. Use Play / Pause and the slider to preview. Use Emoji for stickers. Cancel discards changes; Save applies them. Drag the yellow bar to resize preview vs controls.'
              : 'Type below — text updates live on the photo. Use Emoji for stickers. Use Pan Zoom / Rotate / Full / Zoom for the photo. Cancel discards changes; Save applies them. Drag corners to scale text; drag sides to stretch. Drag the yellow bar to resize preview vs controls.'
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
              <Box sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
                <PhotoAlbumsPlaceTextMediaPreview
                  session={previewSession}
                  labels={labels}
                  activeKey={activeKey}
                  noteId={noteId}
                  storageType={storageType}
                  panZoomActive={panEnabled}
                  onNaturalAspectRatio={handleNaturalAspectRatio}
                  onPhotoChromeChange={applyPhotoChrome}
                  onActivate={activateLabel}
                  onLabelChange={handleLabelChange}
                  onLabelDelete={handleLabelDelete}
                  onDoubleClickLabel={activateLabel}
                />
              </Box>
              {panEnabled && !mediaSession?.isVideo ? (
                <Box sx={slotZoomSliderRowSx(true)}>
                  <Typography component="span" sx={slotZoomPctLabelSx(true)}>
                    {SLOT_ZOOM_PCT_MIN}%
                  </Typography>
                  <Slider
                    min={SLOT_ZOOM_PCT_MIN}
                    max={SLOT_ZOOM_PCT_MAX}
                    step={1}
                    value={photoZoomPct}
                    onChange={handlePhotoZoomSliderChange}
                    sx={slotZoomSliderSx(true)}
                    aria-label="Photo zoom in slot"
                  />
                  <Typography component="span" sx={slotZoomPctLabelSx(true)}>
                    {SLOT_ZOOM_PCT_MAX}%
                  </Typography>
                </Box>
              ) : null}
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
  onConfirm: PropTypes.func,
  onPhotoChromeChange: PropTypes.func
};
