import PropTypes from 'prop-types';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { YELLOW_VAR } from 'utils/themeConfig';
import {
  clampColorTemplate8PhotoGalleryWidthPx,
  colorTemplate8PhotoGalleryAvatarSx,
  colorTemplate8PhotoGalleryBioAnchorSx,
  colorTemplate8PhotoGalleryEmptyTextSx,
  colorTemplate8PhotoGalleryFooterSx,
  colorTemplate8PhotoGalleryHeaderSx,
  colorTemplate8PhotoGalleryHeaderTextSx,
  colorTemplate8PhotoGalleryItemSx,
  colorTemplate8PhotoGalleryLabelLineSx,
  colorTemplate8PhotoGalleryLabelWrapSx,
  COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT,
  colorTemplate8PhotoGalleryListSx,
  colorTemplate8PhotoGalleryNameButtonSx,
  colorTemplate8PhotoGalleryRemoveButtonSx,
  colorTemplate8PhotoGalleryResizeHandleSx,
  colorTemplate8PhotoGalleryResizeWrapSx,
  colorTemplate8PhotoGalleryShellSx,
  COLOR_TEMPLATE8_PHOTO_GALLERY_WIDTH_STORAGE_KEY,
  measureColorTemplate8PhotoGalleryDefaultWidthPx,
  measureColorTemplate8PhotoGalleryMinimalWidthPx
} from 'config/colorTemplate8PhotoGallery';

const ColorTemplate8PhotoGalleryContext = createContext({
  selectedGreenBackground: false,
  selectedAvatarCircular: false
});

function useColorTemplate8PhotoGalleryContext() {
  return useContext(ColorTemplate8PhotoGalleryContext);
}

function readInitialGalleryWidthPx() {
  const stored = readStoredGalleryWidthPx();
  if (stored != null) return stored;
  if (typeof window === 'undefined') return null;
  return measureColorTemplate8PhotoGalleryDefaultWidthPx();
}

function readStoredGalleryWidthPx() {
  try {
    const raw = sessionStorage.getItem(COLOR_TEMPLATE8_PHOTO_GALLERY_WIDTH_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return clampColorTemplate8PhotoGalleryWidthPx(parsed);
  } catch {
    return null;
  }
}

function writeStoredGalleryWidthPx(px) {
  try {
    sessionStorage.setItem(COLOR_TEMPLATE8_PHOTO_GALLERY_WIDTH_STORAGE_KEY, String(px));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Vertical photo gallery column — daynight shell; photo cards use Selected/UnSelected button template colors.
 *
 * Usage:
 *   <ColorTemplate8PhotoGallery header="Drag photos to rearrange order">
 *     <ColorTemplate8PhotoGallery.Item selected impersonateSinglesId={memberSinglesId}>
 *       <ColorTemplate8PhotoGallery.RemoveButton aria-label="Remove">...</ColorTemplate8PhotoGallery.RemoveButton>
 *       <ColorTemplate8PhotoGallery.Footer>...</ColorTemplate8PhotoGallery.Footer>
 *     </ColorTemplate8PhotoGallery.Item>
 *   </ColorTemplate8PhotoGallery>
 *
 * Admin sessions: hover a gallery item to show an "Impersonate ?" tooltip (requires impersonateSinglesId on Item),
 * or use ColorTemplate8PhotoGallery.ImpersonateButton in the footer with impersonateTooltip={false} on Item.
 *
 * Use fillHeight={false} when the gallery should shrink to its cards (e.g. All Singles)
 * instead of stretching to fill a parent column.
 *
 * selectedGreenBackground — when true, selected Item cards use bright green background.
 * selectedAvatarCircular — when true, selected Avatar stays circular (does not switch to square).
 */
function ColorTemplate8PhotoGallery({
  header,
  sx,
  listSx,
  children,
  resizable = true,
  fillHeight = true,
  selectedGreenBackground = false,
  selectedAvatarCircular = false
}) {
  const theme = useTheme();
  const isDesktopRow = useMediaQuery(theme.breakpoints.up('sm'));
  const [widthPx, setWidthPx] = useState(() => readInitialGalleryWidthPx());
  const widthPxRef = useRef(widthPx);
  widthPxRef.current = widthPx;

  useLayoutEffect(() => {
    if (!resizable || !isDesktopRow) return;
    setWidthPx((prev) => {
      if (prev != null) return clampColorTemplate8PhotoGalleryWidthPx(prev);
      const stored = readStoredGalleryWidthPx();
      return stored ?? measureColorTemplate8PhotoGalleryDefaultWidthPx();
    });
  }, [resizable, isDesktopRow]);

  useEffect(() => {
    if (!resizable || !isDesktopRow || widthPx == null) return;
    const clamped = clampColorTemplate8PhotoGalleryWidthPx(widthPx);
    if (clamped !== widthPx) setWidthPx(clamped);
  }, [resizable, isDesktopRow, widthPx]);

  useEffect(() => {
    if (!resizable || !isDesktopRow) return undefined;
    const onWindowResize = () => {
      setWidthPx((prev) => (prev == null ? prev : clampColorTemplate8PhotoGalleryWidthPx(prev)));
    };
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [resizable, isDesktopRow]);

  const handleResizeStart = useCallback(
    (event) => {
      if (!resizable || !isDesktopRow) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = widthPxRef.current ?? measureColorTemplate8PhotoGalleryDefaultWidthPx();

      const onMove = (moveEvent) => {
        const next = clampColorTemplate8PhotoGalleryWidthPx(startWidth + (moveEvent.clientX - startX));
        setWidthPx(next);
        writeStoredGalleryWidthPx(next);
      };
      const onUp = () => {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [resizable, isDesktopRow]
  );

  const useResizeWrap = resizable && isDesktopRow && widthPx != null;
  const shell = (
    <ColorTemplate8PhotoGalleryContext.Provider
      value={{
        selectedGreenBackground: Boolean(selectedGreenBackground),
        selectedAvatarCircular: Boolean(selectedAvatarCircular)
      }}
    >
      <Box sx={{ ...colorTemplate8PhotoGalleryShellSx({ fillResizeWrap: useResizeWrap, fillHeight }), ...(sx || {}) }}>
        {header != null && String(header).length > 0 ? (
          <Box sx={colorTemplate8PhotoGalleryHeaderSx()}>
            <Typography sx={colorTemplate8PhotoGalleryHeaderTextSx()}>{header}</Typography>
          </Box>
        ) : null}
        <Box sx={{ ...colorTemplate8PhotoGalleryListSx({ fillHeight }), ...(listSx || {}) }}>{children}</Box>
      </Box>
    </ColorTemplate8PhotoGalleryContext.Provider>
  );

  if (!useResizeWrap) {
    return shell;
  }

  return (
    <Box sx={colorTemplate8PhotoGalleryResizeWrapSx({ widthPx, fillHeight })}>
      {shell}
      <Box
        component="button"
        type="button"
        aria-label="Resize gallery column"
        className="color-template8-gallery-resize-handle"
        onMouseDown={handleResizeStart}
        sx={colorTemplate8PhotoGalleryResizeHandleSx()}
      />
    </Box>
  );
}

const IMPERSONATE_TOOLTIP_RED = '#e53935';
const IMPERSONATE_TOOLTIP_TEXT_OUTLINE =
  '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 2px #000';

const impersonateTooltipActionSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: '1.9rem',
  color: `var(${YELLOW_VAR})`,
  WebkitTextStroke: '0.5px #000',
  textShadow: IMPERSONATE_TOOLTIP_TEXT_OUTLINE,
  cursor: 'pointer',
  border: 0,
  bgcolor: 'transparent',
  p: 0,
  m: 0,
  textDecoration: 'none',
  '&:hover': {
    opacity: 0.9
  },
  '&:disabled': {
    opacity: 0.65,
    cursor: 'default'
  }
};

const impersonateFooterButtonSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: 'inherit',
  color: `var(${YELLOW_VAR})`,
  WebkitTextStroke: '0.5px #000',
  textShadow: IMPERSONATE_TOOLTIP_TEXT_OUTLINE,
  cursor: 'pointer',
  border: '2px solid #000',
  borderRadius: 1,
  bgcolor: IMPERSONATE_TOOLTIP_RED,
  px: 1.5,
  py: 0.75,
  width: '100%',
  display: 'block',
  textAlign: 'center',
  lineHeight: 1.2,
  '&:hover': {
    opacity: 0.92
  },
  '&:disabled': {
    opacity: 0.65,
    cursor: 'default'
  }
};

function useGalleryImpersonate(targetSinglesId) {
  const { user, impersonateMember } = useAuth();
  const [impersonateBusy, setImpersonateBusy] = useState(false);
  const targetId = Number(targetSinglesId);
  const currentSinglesId = Number(user?.singles_id);
  const isSameMember =
    Number.isFinite(currentSinglesId) && currentSinglesId >= 1 && currentSinglesId === targetId;
  const canImpersonate =
    isAdminSession(user) && Number.isFinite(targetId) && targetId >= 1 && !isSameMember;

  const handleImpersonateClick = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canImpersonate || impersonateBusy) return;

      setImpersonateBusy(true);
      try {
        await impersonateMember({ targetSinglesId: targetId });
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (err) {
        console.error('[ColorTemplate8PhotoGallery] Impersonation failed', err?.message ?? err);
      } finally {
        setImpersonateBusy(false);
      }
    },
    [canImpersonate, impersonateBusy, impersonateMember, targetId]
  );

  return { canImpersonate, impersonateBusy, handleImpersonateClick };
}

function ColorTemplate8PhotoGalleryImpersonateButton({ targetSinglesId, sx }) {
  const { canImpersonate, impersonateBusy, handleImpersonateClick } = useGalleryImpersonate(targetSinglesId);
  if (!canImpersonate) return null;

  return (
    <Box
      component="button"
      type="button"
      data-clickable-zone="true"
      disabled={impersonateBusy}
      onClick={handleImpersonateClick}
      sx={{ ...impersonateFooterButtonSx, ...(sx || {}) }}
    >
      {impersonateBusy ? 'Impersonating…' : 'Impersonate ?'}
    </Box>
  );
}

function ColorTemplate8PhotoGalleryItem({
  selected = false,
  isDropTarget = false,
  impersonateSinglesId,
  impersonateTooltip = true,
  sx,
  children,
  ...rest
}) {
  const { selectedGreenBackground } = useColorTemplate8PhotoGalleryContext();
  const { canImpersonate, impersonateBusy, handleImpersonateClick } = useGalleryImpersonate(impersonateSinglesId);

  const item = (
    <Box
      sx={{
        ...colorTemplate8PhotoGalleryItemSx({ selected, isDropTarget, selectedGreenBackground }),
        ...(sx || {})
      }}
      {...rest}
    >
      {children}
    </Box>
  );

  if (!canImpersonate || !impersonateTooltip) {
    return item;
  }

  return (
    <Tooltip
      arrow
      disableInteractive={false}
      describeChild
      title={
        <Box
          component="button"
          type="button"
          disabled={impersonateBusy}
          onClick={handleImpersonateClick}
          sx={impersonateTooltipActionSx}
        >
          {impersonateBusy ? 'Impersonating…' : 'Impersonate ?'}
        </Box>
      }
      slotProps={{
        tooltip: {
          sx: {
            fontFamily: MAIN_FONT_FAMILY,
            fontWeight: 700,
            bgcolor: IMPERSONATE_TOOLTIP_RED,
            color: `var(${YELLOW_VAR})`,
            border: '2px solid #000',
            boxShadow: 'none'
          }
        },
        arrow: {
          sx: {
            color: IMPERSONATE_TOOLTIP_RED,
            '&::before': {
              border: '2px solid #000'
            }
          }
        }
      }}
    >
      {item}
    </Tooltip>
  );
}

function ColorTemplate8PhotoGalleryAvatar({ selected = false, sx, ...rest }) {
  const { selectedAvatarCircular, selectedGreenBackground } = useColorTemplate8PhotoGalleryContext();
  const keepCircular = selected && selectedAvatarCircular;
  return (
    <Avatar
      variant={keepCircular ? 'circular' : selected ? 'square' : 'circular'}
      data-clickable-zone="true"
      className="clickable-profile-photo"
      draggable={false}
      sx={{
        ...colorTemplate8PhotoGalleryAvatarSx({ selected, selectedAvatarCircular, selectedGreenBackground }),
        ...(sx || {})
      }}
      {...rest}
    />
  );
}

function ColorTemplate8PhotoGalleryNameButton({ sx, children, ...rest }) {
  return (
    <ButtonBase data-clickable-zone="true" sx={{ ...colorTemplate8PhotoGalleryNameButtonSx(), ...(sx || {}) }} {...rest}>
      {children}
    </ButtonBase>
  );
}

function ColorTemplate8PhotoGalleryLabel({ primary, secondary, selected = false, sx }) {
  const { selectedGreenBackground } = useColorTemplate8PhotoGalleryContext();
  const lineSx = colorTemplate8PhotoGalleryLabelLineSx({ selected, selectedGreenBackground });
  return (
    <Box className="clickable-member-text" sx={{ ...colorTemplate8PhotoGalleryLabelWrapSx(), ...(sx || {}) }}>
      <Typography sx={lineSx}>{primary}</Typography>
      {secondary ? <Typography sx={{ ...lineSx, lineHeight: 1.2 }}>{secondary}</Typography> : null}
    </Box>
  );
}

function ColorTemplate8PhotoGalleryRemoveButton({ sx, children, ...rest }) {
  return (
    <Box
      component="button"
      {...rest}
      type="button"
      data-clickable-zone="true"
      sx={{ ...colorTemplate8PhotoGalleryRemoveButtonSx(), ...(sx || {}) }}
    >
      {children}
    </Box>
  );
}

function ColorTemplate8PhotoGalleryEmptyText({ children, sx }) {
  return (
    <Typography sx={{ ...colorTemplate8PhotoGalleryEmptyTextSx(), ...(sx || {}) }}>{children}</Typography>
  );
}

function ColorTemplate8PhotoGalleryBioAnchor({ sx, ...rest }) {
  return <Box sx={{ ...colorTemplate8PhotoGalleryBioAnchorSx(), ...(sx || {}) }} {...rest} />;
}

function ColorTemplate8PhotoGalleryFooter({ sx, children, ...rest }) {
  return (
    <Box sx={{ ...colorTemplate8PhotoGalleryFooterSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Box>
  );
}

ColorTemplate8PhotoGallery.Item = ColorTemplate8PhotoGalleryItem;
ColorTemplate8PhotoGallery.Avatar = ColorTemplate8PhotoGalleryAvatar;
ColorTemplate8PhotoGallery.NameButton = ColorTemplate8PhotoGalleryNameButton;
ColorTemplate8PhotoGallery.Label = ColorTemplate8PhotoGalleryLabel;
ColorTemplate8PhotoGallery.labelTextColor = COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT;
ColorTemplate8PhotoGallery.RemoveButton = ColorTemplate8PhotoGalleryRemoveButton;
ColorTemplate8PhotoGallery.EmptyText = ColorTemplate8PhotoGalleryEmptyText;
ColorTemplate8PhotoGallery.BioAnchor = ColorTemplate8PhotoGalleryBioAnchor;
ColorTemplate8PhotoGallery.Footer = ColorTemplate8PhotoGalleryFooter;
ColorTemplate8PhotoGallery.ImpersonateButton = ColorTemplate8PhotoGalleryImpersonateButton;
ColorTemplate8PhotoGallery.minimalWidthPx = measureColorTemplate8PhotoGalleryMinimalWidthPx;
ColorTemplate8PhotoGallery.defaultWidthPx = measureColorTemplate8PhotoGalleryDefaultWidthPx;

export default ColorTemplate8PhotoGallery;

ColorTemplate8PhotoGallery.propTypes = {
  header: PropTypes.node,
  sx: PropTypes.object,
  listSx: PropTypes.object,
  children: PropTypes.node,
  resizable: PropTypes.bool,
  fillHeight: PropTypes.bool,
  selectedGreenBackground: PropTypes.bool,
  selectedAvatarCircular: PropTypes.bool
};

ColorTemplate8PhotoGalleryItem.propTypes = {
  selected: PropTypes.bool,
  isDropTarget: PropTypes.bool,
  impersonateSinglesId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  impersonateTooltip: PropTypes.bool,
  sx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate8PhotoGalleryImpersonateButton.propTypes = {
  targetSinglesId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  sx: PropTypes.object
};

ColorTemplate8PhotoGalleryAvatar.propTypes = {
  selected: PropTypes.bool,
  sx: PropTypes.object
};

ColorTemplate8PhotoGalleryNameButton.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate8PhotoGalleryLabel.propTypes = {
  primary: PropTypes.node,
  secondary: PropTypes.node,
  selected: PropTypes.bool,
  sx: PropTypes.object
};

ColorTemplate8PhotoGalleryRemoveButton.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate8PhotoGalleryEmptyText.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate8PhotoGalleryBioAnchor.propTypes = {
  sx: PropTypes.object
};

ColorTemplate8PhotoGalleryFooter.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node
};
