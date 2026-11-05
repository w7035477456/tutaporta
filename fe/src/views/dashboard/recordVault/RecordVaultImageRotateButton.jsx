import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useEditorState } from '@tiptap/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { IMAGE_ROTATION_STEP } from './recordVaultImageRotation';
import {
  RECORD_VAULT_NOTE_HEADER_ICON_BUTTON_CLASS,
  recordVaultNoteHeaderIconButtonSx
} from './recordVaultNoteHeaderIconButton';

/**
 * Node types the rotate button can turn. `recordVaultAttachment` is an inline
 * vault file whose image preview is a real <img> (e.g. a scanned letter).
 */
const ROTATABLE_NODE_NAMES = new Set(['image', 'recordVaultAttachment']);

/** True when the editor selection is (or contains) a rotatable picture node. */
function selectionHasImage(editor) {
  if (!editor) return false;
  const { selection } = editor.state;
  if (selection?.node && ROTATABLE_NODE_NAMES.has(selection.node.type?.name)) return true;
  let found = false;
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (ROTATABLE_NODE_NAMES.has(node.type.name)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Note-header rotate button: turns the selected image in the note body 90°
 * clockwise each click. Disabled until an image is selected in the editor.
 */
export default function RecordVaultImageRotateButton({ editor, disabled = false }) {
  const hasImage = useEditorState({
    editor,
    selector: ({ editor: e }) => selectionHasImage(e)
  });

  const onClick = () => {
    if (!editor) return;
    editor.chain().rotateSelectedImages(IMAGE_ROTATION_STEP).run();
  };

  const isDisabled = disabled || !hasImage;

  return (
    <Box
      component="button"
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={isDisabled}
      aria-label="Rotate selected image 90 degrees clockwise"
      title={
        isDisabled
          ? 'Click an image in the note, then rotate it 90°'
          : 'Rotate the selected image 90° clockwise'
      }
      className={RECORD_VAULT_NOTE_HEADER_ICON_BUTTON_CLASS}
      sx={recordVaultNoteHeaderIconButtonSx(isDisabled)}
    >
      <FontAwesomeIcon icon={faRotate} style={{ fontSize: 18 }} aria-hidden />
    </Box>
  );
}

RecordVaultImageRotateButton.propTypes = {
  editor: PropTypes.object,
  disabled: PropTypes.bool
};
