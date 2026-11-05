import { useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { IconPaperclip } from '@tabler/icons-react';
import {
  RECORD_VAULT_NOTE_HEADER_ICON_BUTTON_CLASS,
  recordVaultNoteHeaderIconButtonSx
} from './recordVaultNoteHeaderIconButton';

/**
 * Paperclip — opens the OS file picker to attach vault files into the open note
 * (same upload path as drag-and-drop onto the editor).
 */
export default function RecordVaultNoteAttachButton({
  disabled = false,
  onFiles,
  multiple = true,
  accept
}) {
  const inputRef = useRef(null);

  const handleChange = (event) => {
    const list = Array.from(event.target.files || []);
    event.target.value = '';
    if (list.length && typeof onFiles === 'function') {
      void onFiles(list);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={handleChange}
        aria-hidden
        tabIndex={-1}
      />
      <Box
        component="button"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        disabled={disabled}
        aria-label="Attach file to this note"
        title={disabled ? 'Unlock the note to attach files' : 'Attach a file from your computer'}
        className={RECORD_VAULT_NOTE_HEADER_ICON_BUTTON_CLASS}
        sx={recordVaultNoteHeaderIconButtonSx(disabled)}
      >
        <IconPaperclip size={18} stroke={2.25} aria-hidden />
      </Box>
    </>
  );
}

RecordVaultNoteAttachButton.propTypes = {
  disabled: PropTypes.bool,
  /** @param {File[]} files */
  onFiles: PropTypes.func,
  multiple: PropTypes.bool,
  accept: PropTypes.string
};
