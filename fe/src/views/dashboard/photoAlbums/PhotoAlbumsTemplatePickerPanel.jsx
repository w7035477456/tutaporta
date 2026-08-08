import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { PHOTO_ALBUMS_PAGE_TEMPLATES } from './photoAlbumsPageTemplates';

/** MIME type when dragging a layout from the Page templates picker onto the album page. */
export const DRAG_ALBUM_TEMPLATE = 'application/x-rv-album-template';

/** Above sticky binder / CSS-zoom album layers (those can paint over lower overlays). */
export const ALBUM_TEMPLATE_PICKER_Z_INDEX = 20000;

export function isAlbumTemplateDrag(dataTransfer) {
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes(DRAG_ALBUM_TEMPLATE);
}

export function readAlbumTemplateDragId(dataTransfer) {
  try {
    const raw = dataTransfer?.getData?.(DRAG_ALBUM_TEMPLATE);
    return String(raw || '').trim();
  } catch {
    return '';
  }
}

/** Mini preview of a layout (dashed boxes). Aspect follows album Portrait/Landscape.
 * Height is vh-capped so the 3×3 picker fits the viewport without a scrollbar. */
function TemplateThumb({ template, selected, orientation = 'portrait' }) {
  const landscape = String(orientation).toLowerCase() === 'landscape';
  return (
    <Box
      sx={{
        position: 'relative',
        // Height-driven so rows + chrome stay inside ~90vh (3 cols sm+; 2 cols xs → shorter thumbs).
        height: { xs: 'min(11vh, 88px)', sm: 'min(15vh, 120px)' },
        width: 'auto',
        maxWidth: '100%',
        aspectRatio: landscape ? '12 / 10' : '10 / 12',
        mx: 'auto',
        bgcolor: '#fff',
        border: selected ? '3px solid #2e7d32' : '2px solid #bbb',
        borderRadius: 1.5,
        boxShadow: selected ? '0 0 0 3px rgba(46,125,50,0.35)' : 'none',
        overflow: 'hidden'
      }}
    >
      {(template.slots || []).map((slot) => (
        <Box
          key={slot.id}
          sx={{
            position: 'absolute',
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.w}%`,
            height: `${slot.h}%`,
            border: slot.type === 'text' ? '2px dashed #1976d2' : '2px dashed #c62828',
            bgcolor: slot.type === 'text' ? 'rgba(25,118,210,0.08)' : 'rgba(198,40,40,0.06)',
            boxSizing: 'border-box'
          }}
        />
      ))}
    </Box>
  );
}

TemplateThumb.propTypes = {
  template: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  orientation: PropTypes.oneOf(['portrait', 'landscape'])
};

/**
 * Page templates picker — ColorTemplate16PopupCenterWide (centered).
 * Click or drag a layout onto the album page.
 */
export default function PhotoAlbumsTemplatePickerPanel({
  open,
  // Kept for call-site compatibility; centering no longer uses the Template button anchor.
  anchorEl: _anchorEl = null,
  selectedTemplateId = '',
  orientation = 'portrait',
  onSelect,
  onClose
}) {
  return (
    <ColorTemplate16PopupCenterWide
      open={Boolean(open)}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: ALBUM_TEMPLATE_PICKER_Z_INDEX }}
      cardSx={{
        maxHeight: 'min(90vh, calc(100dvh - 16px))',
        overflowY: 'hidden'
      }}
      contentSx={{
        py: { xs: 1, sm: 1.25 },
        overflow: 'hidden'
      }}
      closeButtonAriaLabel="Close templates"
    >
      <ColorTemplate16PopupCenterWide.Title>Page templates</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={1} sx={{ textAlign: 'left' }}>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.3, opacity: 0.9, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
          Click or drag a layout onto the page
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
            gap: { xs: 1, sm: 1.25 }
          }}
        >
          {PHOTO_ALBUMS_PAGE_TEMPLATES.map((template) => {
            const selected = template.id === selectedTemplateId;
            return (
              <Box
                key={template.id}
                component="button"
                type="button"
                draggable
                onClick={() => onSelect?.(template.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_ALBUM_TEMPLATE, template.id);
                  event.dataTransfer.setData('text/plain', template.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                title={`${template.name} — click or drag onto the page`}
                aria-label={`Template ${template.name}`}
                aria-pressed={selected}
                sx={{
                  border: 'none',
                  bgcolor: 'transparent',
                  p: 0,
                  cursor: 'grab',
                  textAlign: 'left',
                  color: 'inherit',
                  WebkitTextFillColor: 'inherit',
                  '&:active': { cursor: 'grabbing' }
                }}
              >
                <TemplateThumb template={template} selected={selected} orientation={orientation} />
                <Typography
                  sx={{
                    mt: 0.5,
                    fontWeight: 700,
                    fontSize: { xs: '0.75rem', sm: '0.85rem' },
                    textAlign: 'center',
                    lineHeight: 1.2
                  }}
                >
                  {template.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

PhotoAlbumsTemplatePickerPanel.propTypes = {
  open: PropTypes.bool,
  anchorEl: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  selectedTemplateId: PropTypes.string,
  orientation: PropTypes.oneOf(['portrait', 'landscape']),
  onSelect: PropTypes.func,
  onClose: PropTypes.func
};
