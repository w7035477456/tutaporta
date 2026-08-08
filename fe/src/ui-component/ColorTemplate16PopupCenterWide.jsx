import PropTypes from 'prop-types';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import {
  COLOR_TEMPLATE16_POPUP_PANEL_WIDTH,
  COLOR_TEMPLATE16_POPUP_DEFAULT_RESIZE_HEIGHT,
  colorTemplate16PopupCloseSx,
  colorTemplate16PopupResizeHandleSx
} from 'config/colorTemplate16PopupCenterWide';
import useColorTemplate16PopupCenterWideLayout from 'hooks/useColorTemplate16PopupCenterWideLayout';
import usePopupBottomRightResize from 'hooks/usePopupBottomRightResize';

/**
 * Viewport-centered wide popup (ColorTemplate16PopupCenterWide).
 * 75vw width, H+V center in browser window, theme secondary panel, red top-right close X, GreenButton actions.
 *
 * Usage:
 *   <ColorTemplate16PopupCenterWide open onClose={handleClose}>
 *     <ColorTemplate16PopupCenterWide.Title>...</ColorTemplate16PopupCenterWide.Title>
 *     <ColorTemplate16PopupCenterWide.Body>...</ColorTemplate16PopupCenterWide.Body>
 *   </ColorTemplate16PopupCenterWide>
 *
 * Pass `resizable` to drag the bottom-right corner and resize the panel.
 * (`verticalHalf` is ignored — half-viewport shade was retired; popups always
 * cover the full window and center vertically.)
 */
export default function ColorTemplate16PopupCenterWide({
  open,
  onClose,
  children,
  closeOnBackdrop = false,
  showCloseButton = true,
  closeButtonSx,
  bodyTextAlignLeft = true,
  centeredLeadLines = 2,
  resizable = false,
  defaultResizeHeight = COLOR_TEMPLATE16_POPUP_DEFAULT_RESIZE_HEIGHT,
  maxResizeHeight = '92vh',
  /** Stretch panel from top to bottom of the browser window (Add Text photo editor). */
  fillViewportHeight = false,
  verticalHalf: _verticalHalf,
  overlaySx: overlaySxOverride,
  panelShellSx: panelShellSxOverride,
  contentSx,
  cardSx,
  ...rest
}) {
  const { overlaySx, panelShellSx } = useColorTemplate16PopupCenterWideLayout();
  const effectiveDefaultHeight = fillViewportHeight ? '100vh' : defaultResizeHeight;
  const effectiveMaxHeight = fillViewportHeight ? '100vh' : maxResizeHeight;
  const { panelSize, onResizeStart } = usePopupBottomRightResize({
    open,
    enabled: resizable,
    defaultWidth: COLOR_TEMPLATE16_POPUP_PANEL_WIDTH,
    defaultHeight: effectiveDefaultHeight,
    maxHeight: effectiveMaxHeight
  });

  const fillViewportOverlaySx = fillViewportHeight
    ? {
        py: 0,
        pl: { xs: 0.75, sm: 1 },
        pr: { xs: 0.75, sm: 1 },
        alignItems: 'flex-start',
        justifyContent: 'center'
      }
    : null;

  const panelWidth = panelSize?.width ?? COLOR_TEMPLATE16_POPUP_PANEL_WIDTH;

  const fillViewportPanelSx = fillViewportHeight
    ? {
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: panelWidth,
        maxWidth: panelWidth,
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
    : null;

  const resizedPanelShellSx = resizable
    ? fillViewportHeight
      ? fillViewportPanelSx
      : {
          ...panelShellSx,
          ...(panelSize
            ? {
                width: panelSize.width,
                maxWidth: panelSize.width,
                height: panelSize.height,
                maxHeight: panelSize.height
              }
            : {
                width: COLOR_TEMPLATE16_POPUP_PANEL_WIDTH,
                height: effectiveDefaultHeight,
                maxHeight: effectiveDefaultHeight
              }),
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
    : fillViewportHeight
      ? fillViewportPanelSx
      : { ...panelShellSx };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
      showCloseButton={showCloseButton}
      maxWidth={COLOR_TEMPLATE16_POPUP_PANEL_WIDTH}
      centerInWindow
      bodyTextAlignLeft={bodyTextAlignLeft}
      centeredLeadLines={centeredLeadLines}
      closeButtonSx={closeButtonSx ?? colorTemplate16PopupCloseSx()}
      overlaySx={{ ...overlaySx, ...(overlaySxOverride || {}), ...(fillViewportOverlaySx || {}) }}
      panelShellSx={resizedPanelShellSx}
      contentSx={contentSx}
      cardSx={cardSx}
      resizable={resizable}
      fillViewportHeight={fillViewportHeight}
      onResizePointerDown={onResizeStart}
      resizeHandleSx={colorTemplate16PopupResizeHandleSx()}
      {...rest}
    >
      {children}
    </ColorTemplate7PopupLargeDark>
  );
}

ColorTemplate16PopupCenterWide.Title = ColorTemplate7PopupLargeDark.Title;
ColorTemplate16PopupCenterWide.BodyText = ColorTemplate7PopupLargeDark.BodyText;
ColorTemplate16PopupCenterWide.Body = ColorTemplate7PopupLargeDark.Body;
ColorTemplate16PopupCenterWide.Input = ColorTemplate7PopupLargeDark.Input;
ColorTemplate16PopupCenterWide.ActionButton = ColorTemplate7PopupLargeDark.ActionButton;
ColorTemplate16PopupCenterWide.GreenButton = GreenButton;
ColorTemplate16PopupCenterWide.SectionTitle = ColorTemplate7PopupLargeDark.SectionTitle;
ColorTemplate16PopupCenterWide.SectionLabel = ColorTemplate7PopupLargeDark.SectionLabel;
ColorTemplate16PopupCenterWide.SectionDescription = ColorTemplate7PopupLargeDark.SectionDescription;
ColorTemplate16PopupCenterWide.ErrorBar = ColorTemplate7PopupLargeDark.ErrorBar;
ColorTemplate16PopupCenterWide.FormRows = ColorTemplate7PopupLargeDark.FormRows;
ColorTemplate16PopupCenterWide.FormRow = ColorTemplate7PopupLargeDark.FormRow;
ColorTemplate16PopupCenterWide.FormRowLabel = ColorTemplate7PopupLargeDark.FormRowLabel;
ColorTemplate16PopupCenterWide.FormRowControls = ColorTemplate7PopupLargeDark.FormRowControls;
ColorTemplate16PopupCenterWide.Close = ColorTemplate7PopupLargeDark.Close;

ColorTemplate16PopupCenterWide.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node,
  closeOnBackdrop: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  closeButtonSx: PropTypes.object,
  bodyTextAlignLeft: PropTypes.bool,
  centeredLeadLines: PropTypes.number,
  resizable: PropTypes.bool,
  /** Initial panel height when `resizable` (e.g. `'100vh'`). */
  defaultResizeHeight: PropTypes.string,
  /** Max drag-resize height (e.g. `'100vh'`). */
  maxResizeHeight: PropTypes.string,
  /** Panel fills viewport top-to-bottom (`100vh`). */
  fillViewportHeight: PropTypes.bool,
  /** @deprecated Ignored — half-viewport shade removed; popups are full-window centered. */
  verticalHalf: PropTypes.oneOf(['top', 'bottom']),
  overlaySx: PropTypes.object,
  panelShellSx: PropTypes.object,
  contentSx: PropTypes.object,
  cardSx: PropTypes.object
};
