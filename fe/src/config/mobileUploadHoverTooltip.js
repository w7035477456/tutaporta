import { PAGE_INSTRUCTION_TOOLTIP_BG, PAGE_INSTRUCTION_TOOLTIP_TEXT } from 'config/pageInstructionEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';

/** Hover copy for Mobile Upload square button + yellow gallery label. */
export const MOBILE_UPLOAD_HOVER_TOOLTIP =
  'On your phone, visit tutamall.com and tap TutaDates, TutaNotes, or TutaPhoto. Next, tap Take Photo or Choose from Gallery. Once selected, your photos will appear in the yellow gallery on TutaDates (/myStory), TutaNotes, or TutaPhotos.';

/** Orange instruction tooltip — same family as page-instruction / My Picks tooltips. */
export function mobileUploadHoverTooltipSlotProps() {
  return {
    popper: {
      sx: { zIndex: 1400 }
    },
    tooltip: {
      sx: {
        bgcolor: PAGE_INSTRUCTION_TOOLTIP_BG,
        color: PAGE_INSTRUCTION_TOOLTIP_TEXT,
        WebkitTextFillColor: PAGE_INSTRUCTION_TOOLTIP_TEXT,
        border: '2px solid #d32f2f',
        borderRadius: '12px',
        fontWeight: 700,
        fontSize: buttonFontSizeResponsive,
        lineHeight: 1.4,
        maxWidth: 420,
        boxShadow: 'none',
        p: { xs: 1.25, sm: 1.5 },
        textAlign: 'left',
        whiteSpace: 'normal'
      }
    },
    arrow: {
      sx: {
        color: PAGE_INSTRUCTION_TOOLTIP_BG,
        '&::before': {
          border: '1px solid #d32f2f'
        }
      }
    }
  };
}
