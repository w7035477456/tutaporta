import PropTypes from 'prop-types';
import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import AuthCardWrapper from 'views/pages/authentication/AuthCardWrapper';
import GreenButton from 'ui-component/GreenButton';
import useColorTemplate7PopupLargeDarkLayout from 'hooks/useColorTemplate7PopupLargeDarkLayout';
import { BUTTON_TEMPLATE_THICK_BLACK_BORDER } from 'config/selectedUnselectedButtonTemplate';
import { greenButtonSx } from 'config/greenButton';
import {
  COLOR_TEMPLATE7_POPUP_CONTENT_PADDING,
  COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH,
  COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
  COLOR_TEMPLATE7_POPUP_INPUT_MAX_CHARS,
  COLOR_TEMPLATE7_POPUP_PANEL_BG,
  colorTemplate7PopupActionButtonSx,
  colorTemplate7PopupBodySx,
  colorTemplate7PopupBodyTextSx,
  colorTemplate7PopupCheckboxCheckedMarkSx,
  colorTemplate7PopupCheckboxRootSx,
  colorTemplate7PopupCheckboxShellSx,
  colorTemplate7PopupClosePositionSx,
  colorTemplate7PopupCloseSx,
  colorTemplate7PopupClearXSx,
  colorTemplate7PopupErrorBarSx,
  colorTemplate7PopupFormRowControlsSx,
  colorTemplate7PopupFormRowInputSx,
  colorTemplate7PopupFormRowInputStretchSx,
  colorTemplate7PopupFormRowLabelSx,
  colorTemplate7PopupFormRowsSx,
  colorTemplate7PopupInputSx,
  colorTemplate7PopupLinkExampleSx,
  colorTemplate7PopupLinkSx,
  colorTemplate7PopupPanelShellSx,
  colorTemplate7PopupResizeHandleSx,
  colorTemplate7PopupRadioDotSx,
  colorTemplate7PopupRadioRootSx,
  colorTemplate7PopupRadioShellSx,
  colorTemplate7PopupSectionDescriptionSx,
  colorTemplate7PopupSectionLabelSx,
  colorTemplate7PopupSectionTitleSx,
  colorTemplate7PopupSliderSx,
  colorTemplate7PopupTitleSx,
  colorTemplate7PopupTextCascadeSx,
  colorTemplate7PopupNestedTextColorSx,
  colorTemplate7PopupBodyLeftExceptTitleLeadSx
} from 'config/colorTemplate7PopupLargeDark';

const ColorTemplate7PopupTextColorContext = createContext(null);

function useColorTemplate7PopupTextColor() {
  return useContext(ColorTemplate7PopupTextColorContext);
}

function popupTextColorSx(textColor) {
  if (!textColor) return {};
  return { color: textColor, WebkitTextFillColor: textColor };
}

/**
 * Large dark-theme gallery popup (ColorTemplate7PopupLargeDark).
 * Secondary panel, inverse-daynight copy, white inputs, GreenButton actions, top-right green square close X.
 * Default width fills the menu-aware gallery column; pass maxWidth only to cap narrower than gallery.
 *
 * Usage:
 *   <ColorTemplate7PopupLargeDark open onClose={handleClose}>
 *     <ColorTemplate7PopupLargeDark.Title>...</ColorTemplate7PopupLargeDark.Title>
 *     <ColorTemplate7PopupLargeDark.Body>...</ColorTemplate7PopupLargeDark.Body>
 *     <ColorTemplate7PopupLargeDark.FormRows>
 *       <ColorTemplate7PopupLargeDark.FormRow label="Company Email">
 *         <ColorTemplate7PopupLargeDark.Input formRow placeholder="you@company.com" />
 *         <ColorTemplate7PopupLargeDark.ActionButton>Send code</ColorTemplate7PopupLargeDark.ActionButton>
 *       </ColorTemplate7PopupLargeDark.FormRow>
 *     </ColorTemplate7PopupLargeDark.FormRows>
 *     Checkbox / Radio: DESKTOP_FONT_SIZE_ICON, white fill, thick red border; checked = red X / red dot.
 */
function ColorTemplate7PopupLargeDarkTitle({ children, sx }) {
  const textColor = useColorTemplate7PopupTextColor();
  return (
    <Typography
      variant="inherit"
      component="h2"
      className="ct7-popup-title"
      sx={{ ...colorTemplate7PopupTitleSx(popupTextColorSx(textColor)), ...(sx || {}) }}
    >
      {children}
    </Typography>
  );
}

function ColorTemplate7PopupLargeDarkBodyText({ children, sx }) {
  const textColor = useColorTemplate7PopupTextColor();
  return (
    <Typography
      variant="inherit"
      className="ct7-popup-body-text"
      sx={{ ...colorTemplate7PopupBodyTextSx(popupTextColorSx(textColor)), ...(sx || {}) }}
    >
      {children}
    </Typography>
  );
}

function ColorTemplate7PopupLargeDarkBody({ children, spacing = 1.5, sx }) {
  const textColor = useColorTemplate7PopupTextColor();
  return (
    <Stack
      spacing={spacing}
      sx={{
        ...colorTemplate7PopupBodySx(textColor ? { textColor } : {}),
        textAlign: 'left',
        ...(sx || {})
      }}
    >
      {children}
    </Stack>
  );
}

function ColorTemplate7PopupLargeDarkInput({
  sx,
  size = 'small',
  fullWidth = false,
  formRow = false,
  inputHeight = 'bsize',
  inputProps,
  ...props
}) {
  const baseSx = formRow
    ? fullWidth
      ? colorTemplate7PopupFormRowInputStretchSx({}, inputHeight)
      : colorTemplate7PopupFormRowInputSx({}, inputHeight)
    : fullWidth
      ? colorTemplate7PopupInputSx(
          { width: '100%', maxWidth: '100%', mx: 0, flex: '1 1 auto', minWidth: 0 },
          inputHeight
        )
      : colorTemplate7PopupInputSx({}, inputHeight);
  return (
    <TextField
      size={size}
      fullWidth={fullWidth}
      className={
        formRow
          ? `color-template7-popup-input color-template7-popup-form-row-input${fullWidth ? ' color-template7-popup-form-row-input-stretch' : ''}`
          : 'color-template7-popup-input'
      }
      sx={{ ...baseSx, ...(sx || {}) }}
      inputProps={{
        maxLength: COLOR_TEMPLATE7_POPUP_INPUT_MAX_CHARS,
        ...inputProps
      }}
      {...props}
    />
  );
}

function ColorTemplate7PopupLargeDarkActionButton({ children, sx, thickBlackBorder = false, type = 'button', ...props }) {
  return (
    <GreenButton
      type={type}
      className="color-template7-popup-action"
      sx={{
        ...colorTemplate7PopupActionButtonSx(),
        ...(thickBlackBorder ? { border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER} !important` } : null),
        ...(sx || {})
      }}
      {...props}
    >
      {children}
    </GreenButton>
  );
}

function ColorTemplate7PopupLargeDarkSlider({ sx, formRow = false, ...props }) {
  return (
    <Slider
      className={
        formRow
          ? 'color-template7-popup-slider color-template7-popup-form-row-slider'
          : 'color-template7-popup-slider'
      }
      sx={{
        ...(formRow ? { width: '100%', minWidth: 0 } : null),
        ...colorTemplate7PopupSliderSx(),
        ...(sx || {})
      }}
      {...props}
    />
  );
}

function ColorTemplate7PopupCheckboxIcon({ checked = false }) {
  return (
    <Box className="color-template7-popup-checkbox-shell" sx={colorTemplate7PopupCheckboxShellSx()}>
      {checked ? (
        <Box component="span" className="color-template7-popup-checkbox-mark" sx={colorTemplate7PopupCheckboxCheckedMarkSx()}>
          X
        </Box>
      ) : null}
    </Box>
  );
}

function ColorTemplate7PopupRadioIcon({ checked = false }) {
  return (
    <Box className="color-template7-popup-radio-shell" sx={colorTemplate7PopupRadioShellSx()}>
      {checked ? <Box className="color-template7-popup-radio-dot" sx={colorTemplate7PopupRadioDotSx()} /> : null}
    </Box>
  );
}

function ColorTemplate7PopupLargeDarkCheckbox({ sx, icon, checkedIcon, ...props }) {
  return (
    <Checkbox
      className="color-template7-popup-checkbox"
      icon={icon ?? <ColorTemplate7PopupCheckboxIcon checked={false} />}
      checkedIcon={checkedIcon ?? <ColorTemplate7PopupCheckboxIcon checked />}
      sx={{ ...colorTemplate7PopupCheckboxRootSx(), ...(sx || {}) }}
      {...props}
    />
  );
}

function ColorTemplate7PopupLargeDarkRadio({ sx, icon, checkedIcon, ...props }) {
  return (
    <Radio
      className="color-template7-popup-radio"
      icon={icon ?? <ColorTemplate7PopupRadioIcon checked={false} />}
      checkedIcon={checkedIcon ?? <ColorTemplate7PopupRadioIcon checked />}
      sx={{ ...colorTemplate7PopupRadioRootSx(), ...(sx || {}) }}
      {...props}
    />
  );
}

function ColorTemplate7PopupLargeDarkSectionTitle({ children, sx, leadLine = false }) {
  const textColor = useColorTemplate7PopupTextColor();
  return (
    <Typography
      variant="inherit"
      className={`ct7-popup-section-title${leadLine ? ' ct7-popup-lead-line' : ''}`}
      sx={{ ...colorTemplate7PopupSectionTitleSx(popupTextColorSx(textColor)), ...(sx || {}) }}
    >
      {children}
    </Typography>
  );
}

function ColorTemplate7PopupLargeDarkSectionLabel({ children, sx }) {
  const textColor = useColorTemplate7PopupTextColor();
  return (
    <Typography
      variant="inherit"
      className="ct7-popup-section-label"
      sx={{ ...colorTemplate7PopupSectionLabelSx(popupTextColorSx(textColor)), ...(sx || {}) }}
    >
      {children}
    </Typography>
  );
}

function ColorTemplate7PopupLargeDarkSectionDescription({ children, sx }) {
  const textColor = useColorTemplate7PopupTextColor();
  return (
    <Typography
      variant="inherit"
      className="ct7-popup-section-description"
      sx={{ ...colorTemplate7PopupSectionDescriptionSx(popupTextColorSx(textColor)), ...(sx || {}) }}
    >
      {children}
    </Typography>
  );
}

function ColorTemplate7PopupLargeDarkLink({ children, onClick, sx, ...props }) {
  return (
    <Box
      component="span"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      sx={{ ...colorTemplate7PopupLinkSx(), ...(sx || {}) }}
      {...props}
    >
      {children}
    </Box>
  );
}

function ColorTemplate7PopupLargeDarkLinkExample({ children, sx }) {
  return (
    <Box component="span" sx={{ ...colorTemplate7PopupLinkExampleSx(), ...(sx || {}) }}>
      {children}
    </Box>
  );
}

function ColorTemplate7PopupLargeDarkErrorBar({ children, sx }) {
  return <Box sx={{ ...colorTemplate7PopupErrorBarSx(), ...(sx || {}) }}>{children}</Box>;
}

function ColorTemplate7PopupLargeDarkFormRows({ children, sx }) {
  return <Box sx={{ ...colorTemplate7PopupFormRowsSx(), ...(sx || {}) }}>{children}</Box>;
}

function ColorTemplate7PopupLargeDarkFormRowLabel({ children, sx }) {
  return (
    <Typography variant="inherit" sx={{ ...colorTemplate7PopupFormRowLabelSx(), ...(sx || {}) }}>
      {children}
    </Typography>
  );
}

function ColorTemplate7PopupLargeDarkFormRowControls({ children, sx }) {
  return <Box sx={{ ...colorTemplate7PopupFormRowControlsSx(), ...(sx || {}) }}>{children}</Box>;
}

function ColorTemplate7PopupLargeDarkFormRow({ label, children, labelSx, controlsSx }) {
  return (
    <>
      <ColorTemplate7PopupLargeDarkFormRowLabel sx={labelSx}>{label}</ColorTemplate7PopupLargeDarkFormRowLabel>
      <ColorTemplate7PopupLargeDarkFormRowControls sx={controlsSx}>{children}</ColorTemplate7PopupLargeDarkFormRowControls>
    </>
  );
}

function ColorTemplate7PopupLargeDarkClose({ onClose, sx, disabled = false, 'aria-label': ariaLabel = 'Close popup' }) {
  return (
    <GreenButton
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClose}
      className="color-template7-popup-close"
      sx={{
        ...colorTemplate7PopupClosePositionSx(),
        ...colorTemplate7PopupCloseSx(),
        ...(sx || {})
      }}
    >
      X
    </GreenButton>
  );
}

function ColorTemplate7PopupLargeDarkClearX({ onClick, sx, type = 'button', 'aria-label': ariaLabel = 'Clear', ...props }) {
  return (
    <GreenButton
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      className="color-template7-popup-clear-x"
      sx={{
        ...colorTemplate7PopupClearXSx(),
        flexShrink: 0,
        alignSelf: 'center',
        ...(sx || {})
      }}
      {...props}
    >
      X
    </GreenButton>
  );
}

export default function ColorTemplate7PopupLargeDark({
  open,
  onClose,
  children,
  maxWidth = COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH,
  closeOnBackdrop = false,
  showCloseButton = true,
  closeButtonComponent,
  closeButtonDisabled = false,
  closeButtonAriaLabel = 'Close popup',
  closeButtonSx,
  panelShellSx: panelShellSxOverride,
  overlaySx: overlaySxOverride,
  contentSx,
  /** Merged into the scrollable AuthCardWrapper (e.g. hide scrollbar). */
  cardSx,
  panelBg,
  textColor,
  /** Left-align BodyText / section copy; Title (+ centeredLeadLines) stay centered. */
  bodyTextAlignLeft = false,
  centeredLeadLines = 2,
  /** Center in full browser viewport (ignore sidebar / gallery column offset). */
  centerInWindow = false,
  /** Center in menu-aware gallery column (narrower nested popups). */
  centerInGallery = false,
  /** Panel pinned top-to-bottom at 100vh (Add Text photo editor). */
  fillViewportHeight = false,
  /** Show bottom-right drag handle to resize panel (requires panelShellSx width/height). */
  resizable = false,
  onResizePointerDown,
  resizeHandleSx
}) {
  const { overlaySx, panelShellSx } = useColorTemplate7PopupLargeDarkLayout({
    maxWidth,
    centerInWindow,
    centerInGallery
  });
  const bodyAlignSx = bodyTextAlignLeft ? colorTemplate7PopupBodyLeftExceptTitleLeadSx({ centeredLeadLines }) : null;
  const CloseButton = closeButtonComponent ?? ColorTemplate7PopupLargeDarkClose;

  if (!open || typeof document === 'undefined') return null;

  const handleClose = () => {
    if (typeof onClose === 'function') onClose();
  };

  return createPortal(
    <Box
      sx={{ ...overlaySx, ...(overlaySxOverride || {}) }}
      onClick={closeOnBackdrop ? handleClose : undefined}
      role="presentation"
    >
      <Box
        sx={{
          ...colorTemplate7PopupPanelShellSx(
            fillViewportHeight || resizable ? { maxHeight: '100vh' } : {}
          ),
          ...(fillViewportHeight ? null : panelShellSx),
          ...(panelShellSxOverride || {}),
          ...(fillViewportHeight
            ? {
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                height: '100vh',
                maxHeight: '100vh',
                minHeight: '100vh',
                margin: 0,
                alignSelf: 'unset',
                flex: 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }
            : null)
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {showCloseButton && onClose ? (
          <CloseButton
            onClose={handleClose}
            disabled={closeButtonDisabled}
            aria-label={closeButtonAriaLabel}
            sx={closeButtonSx}
          />
        ) : null}
        <AuthCardWrapper
          tight
          fullWidth
          disableMobileFit
          sx={{
            width: '100%',
            maxWidth: '100%',
            my: 0,
            mx: 0,
            bgcolor: panelBg ?? COLOR_TEMPLATE7_POPUP_PANEL_BG,
            height: fillViewportHeight || resizable ? '100%' : 'auto',
            maxHeight: fillViewportHeight || resizable ? '100%' : COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
            flex: fillViewportHeight || resizable ? '1 1 auto' : undefined,
            minHeight: fillViewportHeight || resizable ? 0 : undefined,
            overflowY: fillViewportHeight || resizable ? 'hidden' : 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            borderRadius: fillViewportHeight ? 0 : undefined,
            ...(fillViewportHeight || resizable
              ? {
                  display: 'flex',
                  flexDirection: 'column'
                }
              : null),
            ...(cardSx || {})
          }}
        >
          <Box
            sx={{
              width: '100%',
              ...(showCloseButton && onClose ? { pt: { xs: 1.25, sm: 1.5 } } : null),
              ...(resizable ? { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } : null)
            }}
          >
            <Box
              sx={{
                ...COLOR_TEMPLATE7_POPUP_CONTENT_PADDING,
                ...colorTemplate7PopupTextCascadeSx(textColor ? { textColor } : {}),
                ...(textColor ? colorTemplate7PopupNestedTextColorSx(textColor) : {}),
                '& .MuiTextField-root.color-template7-popup-input': colorTemplate7PopupInputSx(),
                '& .MuiTextField-root.color-template7-popup-form-row-input:not(.color-template7-popup-form-row-input-stretch)':
                  colorTemplate7PopupFormRowInputSx(),
                '& .MuiTextField-root.color-template7-popup-form-row-input-stretch':
                  colorTemplate7PopupFormRowInputStretchSx(),
                '& .MuiButton-root.color-template7-popup-action': {
                  ...greenButtonSx(),
                  ...colorTemplate7PopupActionButtonSx()
                },
                '& .MuiButton-root.color-template7-popup-close': {
                  ...greenButtonSx(),
                  ...colorTemplate7PopupCloseSx()
                },
                '& .MuiButton-root.color-template7-popup-clear-x': {
                  ...greenButtonSx(),
                  ...colorTemplate7PopupClearXSx()
                },
                '& .MuiSlider-root.color-template7-popup-slider': colorTemplate7PopupSliderSx(),
                '& .MuiCheckbox-root.color-template7-popup-checkbox': colorTemplate7PopupCheckboxRootSx(),
                '& .color-template7-popup-checkbox-mark': colorTemplate7PopupCheckboxCheckedMarkSx(),
                '& .MuiRadio-root.color-template7-popup-radio': colorTemplate7PopupRadioRootSx(),
                '& .color-template7-popup-radio-dot': colorTemplate7PopupRadioDotSx(),
                ...(bodyAlignSx || {}),
                ...(resizable
                  ? {
                      flex: '1 1 auto',
                      minHeight: 0,
                      overflowY:
                        contentSx?.overflow === 'hidden' || contentSx?.overflowY === 'hidden'
                          ? 'hidden'
                          : 'auto',
                      overflowX: 'hidden'
                    }
                  : null),
                ...(contentSx || {})
              }}
            >
              <ColorTemplate7PopupTextColorContext.Provider value={textColor ?? null}>
                {children}
              </ColorTemplate7PopupTextColorContext.Provider>
            </Box>
          </Box>
        </AuthCardWrapper>
        {resizable && typeof onResizePointerDown === 'function' ? (
          <Box
            role="separator"
            aria-label="Resize dialog"
            onMouseDown={onResizePointerDown}
            sx={resizeHandleSx ?? colorTemplate7PopupResizeHandleSx()}
          />
        ) : null}
      </Box>
    </Box>,
    document.body
  );
}

ColorTemplate7PopupLargeDark.Title = ColorTemplate7PopupLargeDarkTitle;
ColorTemplate7PopupLargeDark.BodyText = ColorTemplate7PopupLargeDarkBodyText;
ColorTemplate7PopupLargeDark.Body = ColorTemplate7PopupLargeDarkBody;
ColorTemplate7PopupLargeDark.Input = ColorTemplate7PopupLargeDarkInput;
ColorTemplate7PopupLargeDark.ActionButton = ColorTemplate7PopupLargeDarkActionButton;
ColorTemplate7PopupLargeDark.Slider = ColorTemplate7PopupLargeDarkSlider;
ColorTemplate7PopupLargeDark.Checkbox = ColorTemplate7PopupLargeDarkCheckbox;
ColorTemplate7PopupLargeDark.Radio = ColorTemplate7PopupLargeDarkRadio;
ColorTemplate7PopupLargeDark.SectionTitle = ColorTemplate7PopupLargeDarkSectionTitle;
ColorTemplate7PopupLargeDark.SectionLabel = ColorTemplate7PopupLargeDarkSectionLabel;
ColorTemplate7PopupLargeDark.SectionDescription = ColorTemplate7PopupLargeDarkSectionDescription;
ColorTemplate7PopupLargeDark.Link = ColorTemplate7PopupLargeDarkLink;
ColorTemplate7PopupLargeDark.LinkExample = ColorTemplate7PopupLargeDarkLinkExample;
ColorTemplate7PopupLargeDark.ErrorBar = ColorTemplate7PopupLargeDarkErrorBar;
ColorTemplate7PopupLargeDark.FormRows = ColorTemplate7PopupLargeDarkFormRows;
ColorTemplate7PopupLargeDark.FormRow = ColorTemplate7PopupLargeDarkFormRow;
ColorTemplate7PopupLargeDark.FormRowLabel = ColorTemplate7PopupLargeDarkFormRowLabel;
ColorTemplate7PopupLargeDark.FormRowControls = ColorTemplate7PopupLargeDarkFormRowControls;
ColorTemplate7PopupLargeDark.Close = ColorTemplate7PopupLargeDarkClose;
ColorTemplate7PopupLargeDark.ClearX = ColorTemplate7PopupLargeDarkClearX;

ColorTemplate7PopupLargeDark.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node,
  maxWidth: PropTypes.string,
  closeOnBackdrop: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  closeButtonComponent: PropTypes.elementType,
  closeButtonDisabled: PropTypes.bool,
  closeButtonAriaLabel: PropTypes.string,
  closeButtonSx: PropTypes.object,
  panelShellSx: PropTypes.object,
  overlaySx: PropTypes.object,
  contentSx: PropTypes.object,
  cardSx: PropTypes.object,
  panelBg: PropTypes.string,
  textColor: PropTypes.string,
  bodyTextAlignLeft: PropTypes.bool,
  centeredLeadLines: PropTypes.number,
  centerInWindow: PropTypes.bool,
  centerInGallery: PropTypes.bool,
  fillViewportHeight: PropTypes.bool,
  resizable: PropTypes.bool,
  onResizePointerDown: PropTypes.func,
  resizeHandleSx: PropTypes.object
};

ColorTemplate7PopupLargeDarkTitle.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkBodyText.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkBody.propTypes = {
  children: PropTypes.node,
  spacing: PropTypes.number,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkInput.propTypes = {
  sx: PropTypes.object,
  size: PropTypes.string,
  fullWidth: PropTypes.bool,
  formRow: PropTypes.bool,
  /** 'bsize' (default) — fe/.env BSIZE vw height; 'fixed' — legacy 40px. */
  inputHeight: PropTypes.oneOf(['bsize', 'fixed']),
  inputProps: PropTypes.object
};

ColorTemplate7PopupLargeDarkActionButton.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object,
  thickBlackBorder: PropTypes.bool
};

ColorTemplate7PopupLargeDarkSlider.propTypes = {
  sx: PropTypes.object,
  formRow: PropTypes.bool
};

ColorTemplate7PopupLargeDarkCheckbox.propTypes = {
  sx: PropTypes.object,
  icon: PropTypes.node,
  checkedIcon: PropTypes.node
};

ColorTemplate7PopupLargeDarkRadio.propTypes = {
  sx: PropTypes.object,
  icon: PropTypes.node,
  checkedIcon: PropTypes.node
};

ColorTemplate7PopupLargeDarkSectionTitle.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object,
  leadLine: PropTypes.bool
};

ColorTemplate7PopupLargeDarkSectionLabel.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkSectionDescription.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkLink.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkLinkExample.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkErrorBar.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkFormRows.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkFormRowLabel.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkFormRowControls.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate7PopupLargeDarkFormRow.propTypes = {
  label: PropTypes.node.isRequired,
  children: PropTypes.node,
  labelSx: PropTypes.object,
  controlsSx: PropTypes.object
};

ColorTemplate7PopupLargeDarkClose.propTypes = {
  onClose: PropTypes.func.isRequired,
  sx: PropTypes.object,
  disabled: PropTypes.bool,
  'aria-label': PropTypes.string
};

ColorTemplate7PopupLargeDarkClearX.propTypes = {
  onClick: PropTypes.func.isRequired,
  sx: PropTypes.object,
  type: PropTypes.string,
  'aria-label': PropTypes.string
};
