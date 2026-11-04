import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useEditorState } from '@tiptap/react';
import { SLIDER_CONTROL_TRUE_YELLOW } from 'ui-component/SliderControlButton';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';
import { IMAGE_ROTATION_STEP } from './recordVaultImageRotation';

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
      // Keep the editor's image selection intact while pressing the button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={isDisabled}
      aria-label="Rotate selected image 90 degrees"
      title={isDisabled ? 'Click an image in the note, then rotate it 90°' : 'Rotate the selected image 90° clockwise'}
      className={LIGHT_SURFACE_CLASS}
      sx={{
        flexShrink: 0,
        p: 0,
        m: 0,
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid #000 !important',
        borderRadius: 0.5,
        bgcolor: `${SLIDER_CONTROL_TRUE_YELLOW} !important`,
        backgroundImage: 'none !important',
        color: '#000 !important',
        WebkitTextFillColor: '#000 !important',
        fontSize: '1rem',
        fontWeight: 900,
        lineHeight: 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        '&:hover': isDisabled ? undefined : { filter: 'brightness(1.06)' },
        '&:active': isDisabled ? undefined : { transform: 'scale(0.96)' }
      }}
    >
      ↻
    </Box>
  );
}

RecordVaultImageRotateButton.propTypes = {
  /** TipTap editor instance (null until the editor mounts). */
  editor: PropTypes.object,
  disabled: PropTypes.bool
};
