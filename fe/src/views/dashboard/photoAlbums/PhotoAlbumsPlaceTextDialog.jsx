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
import { useAuth } from 'contexts/AuthContext';
import { guestDemoBlockProps, isGuestDemoLogin } from 'utils/guestDemoLogin';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { COLOR_TEMPLATE16_POPUP_Z_INDEX } from 'config/colorTemplate16PopupCenterWide';
import { colorTemplate7PopupSliderSx, colorTemplate7PopupActionButtonSx } from 'config/colorTemplate7PopupLargeDark';
import PhotoAlbumsFillOutlineColorPicker from './PhotoAlbumsFillOutlineColorPicker';
import PhotoAlbumsPlaceTextPhotoPreview from './PhotoAlbumsPlaceTextPhotoPreview';
import PhotoAlbumsEmojiPickerPopover from './PhotoAlbumsEmojiPickerPopover';
import {
  ALBUM_PHOTO_OVERLAY_MAX,
  ALBUM_PHOTO_VIEW_IDENTITY,
  createAlbumPhotoOverlay,
  normalizeAlbumPhotoView
} from './photoAlbumsPages';

/** Where a new label starts on a double-clicked photo (fraction of the photo frame). */
const PHOTO_TEXT_DEFAULT_ANCHOR = { fx: 0.08, fy: 0.08 };

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
  rotationDeg: 0
};

export const PLACE_TEXT_MAX_CHARS = 1073741823;


const SELECT_MENU_Z = COLOR_TEMPLATE16_POPUP_Z_INDEX + 200;

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

const photoStickerBtnSx = {
  width: 64,
  height: 64,
  p: 0,
  flexShrink: 0,
  border: '2px solid #000',
  borderRadius: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 0.15s ease',
  '&:hover:not(:disabled)': { transform: 'scale(1.08)' },
  '&:disabled': { opacity: 0.45, cursor: 'default' }
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
 * Add Text dialog — styles a page text label or the album-wide page title.
 * With `photo` (double-clicked page photo) the photo shows on top and the text can be
 * dragged on it; OK then also returns `photoAnchor` ({ fx, fy } of the photo frame).
 * Crop / Original save the photo's zoom / pan / rotation on its page right away through
 * `onPhotoViewChange`; OK saves it too.
 */
export default function PhotoAlbumsPlaceTextDialog({
  open,
  initialText = '',
  initialStyle = null,
  photo = null,
  onClose,
  onConfirm,
  onPhotoViewChange
}) {
  const { user } = useAuth();
  const guestDemo = isGuestDemoLogin(user);
  const [text, setText] = useState(PLACE_TEXT_DEFAULTS.text);
  const [color, setColor] = useState(PLACE_TEXT_DEFAULTS.color);
  const [outlineColor, setOutlineColor] = useState(PLACE_TEXT_DEFAULTS.outlineColor);
  const [fontFamily, setFontFamily] = useState(PLACE_TEXT_DEFAULTS.fontFamily);
  const [fontWeight, setFontWeight] = useState(PLACE_TEXT_DEFAULTS.fontWeight);
  const [fontSize, setFontSize] = useState(PLACE_TEXT_DEFAULTS.fontSize);
  const [outlineWidth, setOutlineWidth] = useState(PLACE_TEXT_DEFAULTS.outlineWidth);
  const [selectedPresetId, setSelectedPresetId] = useState(PLACE_TEXT_STYLE_PRESETS[0].id);
  const [photoAnchor, setPhotoAnchor] = useState(PHOTO_TEXT_DEFAULT_ANCHOR);
  const [photoView, setPhotoView] = useState(ALBUM_PHOTO_VIEW_IDENTITY);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const dialogInitRef = useRef(false);

  const applyStyleFields = useCallback((next, seededText) => {
    const resolvedText =
      seededText != null ? String(seededText) : String(next.text ?? '').trim() || PLACE_TEXT_DEFAULTS.text;
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
  }, []);

  useEffect(() => {
    if (!open) {
      dialogInitRef.current = false;
      return;
    }
    // Seed once per open.
    if (dialogInitRef.current) return;
    dialogInitRef.current = true;
    setPhotoAnchor(PHOTO_TEXT_DEFAULT_ANCHOR);
    setPhotoView(normalizeAlbumPhotoView(photo?.view) || ALBUM_PHOTO_VIEW_IDENTITY);
    setSelectedOverlayId(null);
    setEmojiAnchorEl(null);
    const next = { ...PLACE_TEXT_DEFAULTS, ...(initialStyle || {}) };
    const seeded = String(initialText ?? '').trim();
    applyStyleFields(next, seeded || next.text);
  }, [open, initialText, initialStyle, applyStyleFields, photo]);

  const commitPhotoView = useCallback(
    (view) => {
      if (!photo) return;
      onPhotoViewChange?.(photo, normalizeAlbumPhotoView(view));
    },
    [photo, onPhotoViewChange]
  );

  /** Undo zoom / pan / rotation; emoji and blurs stay (remove those with their ×). */
  const handlePhotoOriginal = useCallback(() => {
    const next = { ...ALBUM_PHOTO_VIEW_IDENTITY, overlays: photoView.overlays || [] };
    setPhotoView(next);
    commitPhotoView(next);
  }, [commitPhotoView, photoView]);

  const overlayCount = Array.isArray(photoView.overlays) ? photoView.overlays.length : 0;
  const canAddOverlay = overlayCount < ALBUM_PHOTO_OVERLAY_MAX;

  const addPhotoOverlay = useCallback((kind, emoji) => {
    const overlay = createAlbumPhotoOverlay(kind, emoji);
    if (!overlay) return;
    setPhotoView((prev) => ({ ...prev, overlays: [...(prev.overlays || []), overlay] }));
    setSelectedOverlayId(overlay.id);
  }, []);

  const selectedPreset = useMemo(
    () => PLACE_TEXT_STYLE_PRESETS.find((p) => p.id === selectedPresetId) || PLACE_TEXT_STYLE_PRESETS[0],
    [selectedPresetId]
  );

  const displayText = String(text || '').trim() || PLACE_TEXT_DEFAULTS.text;

  const applyPreset = (preset) => {
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setColor(preset.color);
    setOutlineColor(preset.outlineColor);
    setFontFamily(preset.fontFamily);
    setFontWeight(preset.fontWeight);
    setFontSize(preset.fontSize);
    setOutlineWidth(preset.outlineWidth);
  };

  const handleOk = () => {
    const patch = stylePatchFromControls({
      text,
      color,
      outlineColor,
      fontFamily,
      fontWeight,
      fontSize,
      outlineWidth,
      selectedPreset
    });
    if (photo) commitPhotoView(photoView);
    onConfirm?.(photo ? { ...patch, photoAnchor } : patch);
  };

  const handleDialogClose = () => {
    if (guestDemo) {
      onClose?.();
      return;
    }
    handleOk();
  };

  const sizeSliderRow = (
    <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexShrink: 0, width: '100%' }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ ...labelSx, mb: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Font size: {Math.round(fontSize)} pt
        </Typography>
        <Slider
          min={10}
          max={120}
          step={0.5}
          value={fontSize}
          onChange={(_, v) => setFontSize(Array.isArray(v) ? v[0] : v)}
          sx={{ ...colorTemplate7PopupSliderSx(), flex: 1, minWidth: 48, m: 0 }}
          aria-label="Font size"
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ ...labelSx, mb: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Outline width: {Number(outlineWidth).toFixed(1)} pt
        </Typography>
        <Slider
          min={0}
          max={12}
          step={0.5}
          value={outlineWidth}
          onChange={(_, v) => setOutlineWidth(Array.isArray(v) ? v[0] : v)}
          sx={{ ...colorTemplate7PopupSliderSx(), flex: 1, minWidth: 48, m: 0 }}
          aria-label="Outline width"
        />
      </Box>
    </Stack>
  );

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={handleDialogClose}
      closeOnBackdrop={false}
      showCloseButton
      fillViewportHeight={false}
    >
      <ColorTemplate16PopupCenterWide.Title>Add Text</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={1.5}>
        <ColorTemplate16PopupCenterWide.SectionDescription>
          {photo
            ? 'Style your text and drag it on the photo, then OK to place it there (you can still drag & rotate it on the page).'
            : 'Style your text, then OK to place it on the page (drag & rotate on the page).'}
        </ColorTemplate16PopupCenterWide.SectionDescription>

        {photo ? (
          <PhotoAlbumsPlaceTextPhotoPreview
            noteId={photo.noteId}
            attachmentId={photo.attachmentId}
            storageType={photo.storageType}
            frameWidth={photo.frameWidth}
            frameHeight={photo.frameHeight}
            anchor={photoAnchor}
            onAnchorChange={setPhotoAnchor}
            view={photoView}
            onViewChange={setPhotoView}
            onOriginal={handlePhotoOriginal}
            onCrop={() => commitPhotoView(photoView)}
            selectedOverlayId={selectedOverlayId}
            onSelectOverlay={setSelectedOverlayId}
            text={selectedPreset?.uppercase ? displayText.toUpperCase() : displayText}
            textStyle={{
              color,
              outlineColor,
              fontFamily,
              fontWeight,
              fontSize,
              outlineWidth
            }}
          />
        ) : null}

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
            if (selected) {
              return (
                <Box
                  key={preset.id}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 0.75 }}
                >
                  <Typography
                    component="label"
                    htmlFor="place-text-edit-inline"
                    sx={{
                      flexShrink: 0,
                      fontWeight: 900,
                      fontSize: { xs: '1.1rem', sm: '1.35rem' },
                      lineHeight: 1.1,
                      textAlign: 'center',
                      color: '#000',
                      WebkitTextFillColor: '#000',
                      width: '3.5em'
                    }}
                  >
                    Use This
                  </Typography>
                  <Box
                    component="input"
                    id="place-text-edit-inline"
                    type="text"
                    value={text}
                    placeholder={PLACE_TEXT_DEFAULTS.text}
                    maxLength={PLACE_TEXT_MAX_CHARS}
                    spellCheck
                    aria-label={`Edit text (${preset.label} style)`}
                    onChange={(e) => setText(String(e.target.value ?? '').slice(0, PLACE_TEXT_MAX_CHARS))}
                    style={{ ...sampleTextInlineStyle(styleForButton), display: 'block' }}
                    sx={{
                      width: '80%',
                      p: 1.5,
                      textAlign: 'center',
                      bgcolor: '#fff',
                      border: '8px solid #e53935',
                      borderRadius: 1,
                      outline: 'none',
                      '&::placeholder': { opacity: 0.45 }
                    }}
                  />
                </Box>
              );
            }
            return (
              <Box key={preset.id} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="button"
                  type="button"
                  aria-pressed={false}
                  aria-label={`Style preset: ${preset.label}`}
                  onClick={() => applyPreset(preset)}
                  sx={{
                    display: 'block',
                    width: '100%',
                    p: 1.15,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: 'transparent',
                    border: '2px solid #000',
                    borderRadius: 1
                  }}
                >
                  <span style={sampleTextInlineStyle(styleForButton)}>{displayText}</span>
                </Box>
              </Box>
            );
          })}
        </Stack>

        <Box
          sx={{
            p: 1,
            border: '2px dashed var(--theme-yellow-color, #ffd700)',
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.18)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
            <Box sx={{ flex: '1 1 28%', minWidth: 160 }}>
              <PhotoAlbumsFillOutlineColorPicker
                fillColor={color}
                outlineColor={outlineColor}
                onFillChange={setColor}
                onOutlineChange={setOutlineColor}
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
              <Typography sx={{ ...labelSx, mb: 0.5 }}>Text</Typography>
              <TextField
                value={text}
                onChange={(e) => setText(String(e.target.value ?? '').slice(0, PLACE_TEXT_MAX_CHARS))}
                placeholder={PLACE_TEXT_DEFAULTS.text}
                autoFocus
                fullWidth
                multiline
                minRows={3}
                maxRows={3}
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
                    fontSize: '1rem',
                    lineHeight: 1.35,
                    py: 1,
                    px: 1.25,
                    resize: 'none'
                  }
                }}
              />
              {photo ? (
                <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, justifyContent: 'center' }}>
                  <Box
                    component="button"
                    type="button"
                    title="Add an emoji — pick one, then drag it and resize it on the photo"
                    aria-label="Add emoji"
                    disabled={!canAddOverlay}
                    onClick={(e) => setEmojiAnchorEl(e.currentTarget)}
                    sx={{ ...photoStickerBtnSx, bgcolor: '#fff', fontSize: 44, lineHeight: 1 }}
                  >
                    😀
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    title="Add a round blur — drag it over a face and resize it"
                    aria-label="Add blur"
                    disabled={!canAddOverlay}
                    onClick={() => addPhotoOverlay('blur')}
                    sx={{
                      ...photoStickerBtnSx,
                      bgcolor: '#000',
                      color: '#fff',
                      WebkitTextFillColor: '#fff',
                      fontFamily: MAIN_FONT_FAMILY,
                      fontWeight: 800,
                      fontSize: '1.35rem',
                      textShadow: '0 0 6px #7CFFB2, 0 0 12px #2196F3'
                    }}
                  >
                    blur
                  </Box>
                </Stack>
              ) : null}
              <PhotoAlbumsEmojiPickerPopover
                open={Boolean(emojiAnchorEl)}
                anchorEl={emojiAnchorEl}
                onClose={() => setEmojiAnchorEl(null)}
                onPick={(emoji) => {
                  setEmojiAnchorEl(null);
                  addPhotoOverlay('emoji', emoji);
                }}
              />
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2, flexShrink: 0 }}>
          <GreenButton type="button" onClick={() => onClose?.()} sx={{ minWidth: 96, fontWeight: 800 }}>
            Cancel
          </GreenButton>
          <GreenButton
            type="button"
            onClick={handleOk}
            {...guestDemoBlockProps()}
            sx={{ ...colorTemplate7PopupActionButtonSx(), minWidth: 96, fontWeight: 800 }}
          >
            OK
          </GreenButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

PhotoAlbumsPlaceTextDialog.propTypes = {
  open: PropTypes.bool,
  initialText: PropTypes.string,
  initialStyle: PropTypes.object,
  photo: PropTypes.shape({
    noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    attachmentId: PropTypes.number.isRequired,
    storageType: PropTypes.string,
    frameWidth: PropTypes.number.isRequired,
    frameHeight: PropTypes.number.isRequired,
    pageKey: PropTypes.string,
    view: PropTypes.object
  }),
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  onPhotoViewChange: PropTypes.func
};
