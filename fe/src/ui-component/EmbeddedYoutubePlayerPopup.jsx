import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';

import {
  CUSTOM_MUSIC_URL_SLOT_COUNT,
  SLIDE_SHOW_MUSIC_SLOT_INDEX
} from 'api/userCustomizationFe';
import { YOUTUBE_MUSIC_URL_INPUT_MAX_CHARS } from 'config/youtubeMusicUrl';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import {
  COLOR_TEMPLATE10_MENU_UNSELECTED_BG,
  COLOR_TEMPLATE10_MENU_UNSELECTED_BORDER,
  COLOR_TEMPLATE10_MENU_UNSELECTED_TEXT
} from 'config/colorTemplate10Menu';
import { COLOR_TEMPLATE7_POPUP_PANEL_BG, COLOR_TEMPLATE7_POPUP_TEXT } from 'config/colorTemplate7PopupLargeDark';
import { greenButtonSx } from 'config/greenButton';

const TRACK_SLOT_COUNT = SLIDE_SHOW_MUSIC_SLOT_INDEX;

/** Inputs match theme-menu unselected buttons (primary bg + daynight text). */
const themeMenuInputSx = {
  width: '100%',
  maxWidth: 'none',
  mx: 0,
  alignSelf: 'stretch',
  flex: '1 1 0%',
  minWidth: 0,
  '& .MuiInputBase-root': {
    bgcolor: `${COLOR_TEMPLATE10_MENU_UNSELECTED_BG} !important`,
    border: COLOR_TEMPLATE10_MENU_UNSELECTED_BORDER,
    borderRadius: 1
  },
  '& .MuiInputBase-input': {
    color: `${COLOR_TEMPLATE10_MENU_UNSELECTED_TEXT} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE10_MENU_UNSELECTED_TEXT} !important`,
    fontWeight: 700
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'transparent'
  }
};

const greenChipSx = {
  ...greenButtonSx(),
  minWidth: 0,
  flexShrink: 0,
  px: 1.25,
  py: 0.5,
  height: 'auto',
  minHeight: 36,
  boxShadow: 'none'
};

const greenXSx = {
  ...greenChipSx,
  width: 36,
  minWidth: 36,
  px: 0,
  fontWeight: 900,
  fontSize: '1.1rem !important',
  lineHeight: 1
};

function SlotRow({ index, value, onChange, onKeyDown, onDelete, onPlay, playLabel }) {
  return (
    <ColorTemplate7PopupLargeDark.FormRowControls
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 1
      }}
    >
      <ColorTemplate7PopupLargeDark.Input
        formRow
        fullWidth
        size="small"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="https://www.youtube.com/watch?v=..."
        inputProps={{ maxLength: YOUTUBE_MUSIC_URL_INPUT_MAX_CHARS }}
        sx={themeMenuInputSx}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexShrink: 0
        }}
      >
        <GreenButton
          type="button"
          onClick={onDelete}
          aria-label={`Delete URL slot ${index + 1}`}
          sx={greenXSx}
        >
          X
        </GreenButton>
        <GreenButton type="button" onClick={onPlay} sx={greenChipSx}>
          {playLabel}
        </GreenButton>
      </Box>
    </ColorTemplate7PopupLargeDark.FormRowControls>
  );
}

SlotRow.propTypes = {
  index: PropTypes.number.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onPlay: PropTypes.func.isRequired,
  playLabel: PropTypes.string.isRequired
};

export default function EmbeddedYoutubePlayerPopup({
  open,
  onClose,
  slotValues,
  onMemorizeSlot,
  onPlaySlot,
  onLoadDefault,
  loadDefaultBusy = false,
  overlayZIndex,
  centerInWindow = false
}) {
  const [draftSlots, setDraftSlots] = useState(() =>
    Array.from({ length: CUSTOM_MUSIC_URL_SLOT_COUNT }, () => '')
  );

  useEffect(() => {
    if (!open) return;
    setDraftSlots(
      Array.from({ length: CUSTOM_MUSIC_URL_SLOT_COUNT }, (_v, index) => String(slotValues?.[index] ?? ''))
    );
  }, [open, slotValues]);

  const handleSlotChange = (index, value) => {
    setDraftSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleMemorize = (index, value = draftSlots[index] ?? '') => {
    void onMemorizeSlot(index, value);
  };

  const handleDeleteSlot = (index) => {
    handleSlotChange(index, '');
    handleMemorize(index, '');
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleMemorize(index);
    }
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeButtonAriaLabel="Close popup"
      showCloseButton
      closeOnBackdrop
      centerInWindow={centerInWindow}
      panelBg={COLOR_TEMPLATE7_POPUP_PANEL_BG}
      textColor={COLOR_TEMPLATE7_POPUP_TEXT}
      overlaySx={overlayZIndex != null ? { zIndex: overlayZIndex } : undefined}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.25}>
        <ColorTemplate7PopupLargeDark.Title>Embedded Youtube Player</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.SectionLabel>Youtube URL</ColorTemplate7PopupLargeDark.SectionLabel>
        {Array.from({ length: TRACK_SLOT_COUNT }, (_v, index) => (
          <SlotRow
            key={index}
            index={index}
            value={draftSlots[index] ?? ''}
            onChange={(event) => handleSlotChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onDelete={() => handleDeleteSlot(index)}
            onPlay={() => onPlaySlot(index, draftSlots[index] ?? '')}
            playLabel={`Play ${index + 1}`}
          />
        ))}

        <ColorTemplate7PopupLargeDark.SectionLabel sx={{ mt: 1 }}>
          Slide Show Music
        </ColorTemplate7PopupLargeDark.SectionLabel>
        <SlotRow
          index={SLIDE_SHOW_MUSIC_SLOT_INDEX}
          value={draftSlots[SLIDE_SHOW_MUSIC_SLOT_INDEX] ?? ''}
          onChange={(event) => handleSlotChange(SLIDE_SHOW_MUSIC_SLOT_INDEX, event.target.value)}
          onKeyDown={(event) => handleKeyDown(event, SLIDE_SHOW_MUSIC_SLOT_INDEX)}
          onDelete={() => handleDeleteSlot(SLIDE_SHOW_MUSIC_SLOT_INDEX)}
          onPlay={() =>
            onPlaySlot(SLIDE_SHOW_MUSIC_SLOT_INDEX, draftSlots[SLIDE_SHOW_MUSIC_SLOT_INDEX] ?? '')
          }
          playLabel="Play 10"
        />

        <ColorTemplate7PopupLargeDark.BodyText>
          Paste a full YouTube link (or 11-character video ID) into any slot and press Enter to memorize it. Play #
          loads that slot in the mini YouTube player. Slide Show Music (slot 10) plays during album slideshows.
        </ColorTemplate7PopupLargeDark.BodyText>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', pt: 0.25 }}>
          <GreenButton
            type="button"
            disabled={loadDefaultBusy}
            onClick={() => void onLoadDefault?.()}
            {...guestDemoAllowProps()}
          >
            {loadDefaultBusy ? 'Loading…' : 'Load Default'}
          </GreenButton>
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

EmbeddedYoutubePlayerPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  slotValues: PropTypes.arrayOf(PropTypes.string),
  onMemorizeSlot: PropTypes.func.isRequired,
  onPlaySlot: PropTypes.func.isRequired,
  onLoadDefault: PropTypes.func,
  loadDefaultBusy: PropTypes.bool,
  overlayZIndex: PropTypes.number,
  centerInWindow: PropTypes.bool
};
