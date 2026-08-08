/**
 * colorTemplate8PhotoGallery — vertical photo gallery column (My Picks left rail).
 * Gallery shell: daynight. Photo card bg: Selected/UnSelected templates.
 * Labels: daynight when unselected; inverse-daynight when selected.
 * Avatar: round when unselected; rectangular when selected (double thick primary border).
 * selectedGreenBackground: green card, no avatar zoom, same stack position as unselected.
 */
import {
  getMyPicksAvatarSize,
  getMyPicksAvatarBorderWidth,
  getMyPicksCardSpacing,
  getMyPicksColumnMinHeight,
  getMyPicksColumnWidth,
  getMyPicksOuterBorderWidth,
  getMyPicksRemoveIconSize
} from 'config/myPicksCardEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { hoverEnlargeChildrenSx } from 'config/hoverEnlargeEnv';
import { buttonSelectedMagnifyFontSx, getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { materialPanelSx } from 'utils/materialButtonSx';
import { selectedButtonTemplateSx } from 'ui-component/SelectedButtonTemplate';
import { unselectedButtonTemplateSx } from 'ui-component/UnSelectedButtonTemplate';
import {
  SELECTED_BUTTON_TEMPLATE_BG,
  UNSELECTED_BUTTON_TEMPLATE_BG
} from 'config/selectedUnselectedButtonTemplate';
import { DAYNIGHT_VAR, INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';

/** Gallery column background */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_SHELL_BG = 'var(--theme-daynight-color)';
/** Unselected stacked photo button — matches UnSelectedButtonTemplate */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_ITEM_BG_UNSELECTED = UNSELECTED_BUTTON_TEMPLATE_BG;
/** Selected stacked photo button — matches SelectedButtonTemplate */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_ITEM_BG_SELECTED = SELECTED_BUTTON_TEMPLATE_BG;
/** Selected item when gallery uses selectedGreenBackground — bright green card */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_ITEM_BG_SELECTED_GREEN = '#43a047';
export const COLOR_TEMPLATE8_PHOTO_GALLERY_BORDER = '1px solid var(--theme-primary-color)';
export const COLOR_TEMPLATE8_PHOTO_GALLERY_TEXT = 'var(--theme-primary-color)';
/** Member name / ID labels — unselected: daynight; selected: inverse-daynight. */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT = `var(${DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT_SELECTED = `var(${INVERSE_DAYNIGHT_VAR})`;
/** Legacy selected avatar zoom — only when selectedGreenBackground is false. */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_SCALE = 1.25;
/** Stacking — scaled selected avatar over adjacent gallery cards. */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_ITEM_Z_INDEX = 20;
export const COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_Z_INDEX = 10;
/** Remove-pick X — red on black square; 2× base icon size; 25% hover enlarge; flush top-right of card. */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_COLOR = '#e53935';
export const COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_BG = '#000000';
export const COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_SIZE_MULTIPLIER = 2;
/** @deprecated Use COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_ITEM_TEXT_UNSELECTED = COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT;
/** @deprecated Use COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT */
export const COLOR_TEMPLATE8_PHOTO_GALLERY_ITEM_TEXT_SELECTED = COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT;

const cardSpacing = getMyPicksCardSpacing();
const removeIconSize = getMyPicksRemoveIconSize();

/** Top-right of gallery card — outer edge (ColorTemplate8 only; not My Picks posting delete). */
function colorTemplate8PhotoGalleryRemoveButtonInset() {
  return {
    top: { xs: '-0.15vw', sm: '-0.12vh' },
    right: { xs: '-0.15vw', sm: '-0.12vw' }
  };
}

/** Selected / unselected photo card background — button template bg only (label text via LABEL_TEXT_*). */
function colorTemplate8PhotoGalleryButtonTemplateSx(selected = false) {
  return selected ? selectedButtonTemplateSx() : unselectedButtonTemplateSx();
}

const MY_PICKS_AVATAR_VW_DEFAULT = 9.2;
const MY_PICKS_AVATAR_VH_DEFAULT = 12;
/** Horizontal chrome around avatar in the gallery column (vw, sm+). */
const GALLERY_MINIMAL_EXTRA_VW = 2.4;

function readUnitNumber(value, fallback, max = 50) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export const COLOR_TEMPLATE8_PHOTO_GALLERY_WIDTH_STORAGE_KEY = 'colorTemplate8PhotoGalleryWidthPx_v2';

/**
 * Narrowest practical column width: avatar (MY_PICKS_AVATAR_* env) + card margins/padding.
 * Matches the minimal Vetted Friends / My Picks left rail in the mockup.
 */
export function measureColorTemplate8PhotoGalleryMinimalWidthPx() {
  if (typeof window === 'undefined') return 120;
  const avatarVw = readUnitNumber(import.meta.env.MY_PICKS_AVATAR_VW, MY_PICKS_AVATAR_VW_DEFAULT);
  const avatarVh = readUnitNumber(import.meta.env.MY_PICKS_AVATAR_VH, MY_PICKS_AVATAR_VH_DEFAULT);
  const avatarPx = Math.min((window.innerWidth * avatarVw) / 100, (window.innerHeight * avatarVh) / 100);
  const extraPx = Math.round((window.innerWidth * GALLERY_MINIMAL_EXTRA_VW) / 100) + 10;
  return Math.round(avatarPx + extraPx);
}

/** Default resizable column width — minimal (not legacy min(21vw, 32vh)). */
export function measureColorTemplate8PhotoGalleryDefaultWidthPx() {
  return measureColorTemplate8PhotoGalleryMinimalWidthPx();
}

export function clampColorTemplate8PhotoGalleryWidthPx(px) {
  if (typeof window === 'undefined') return px;
  const min = measureColorTemplate8PhotoGalleryMinimalWidthPx();
  const max = Math.min(Math.round(window.innerWidth * 0.45), Math.round(window.innerHeight * 0.55));
  return Math.min(max, Math.max(min, Math.round(px)));
}

export function colorTemplate8PhotoGalleryResizeWrapSx({ widthPx, fillHeight = true } = {}, overrides = {}) {
  const width =
    widthPx != null
      ? { xs: '100%', sm: `${clampColorTemplate8PhotoGalleryWidthPx(widthPx)}px` }
      : getMyPicksColumnWidth();
  return {
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 0,
    width,
    maxWidth: { xs: '100%', sm: '45vw' },
    minWidth: {
      xs: '100%',
      sm: widthPx != null ? `${measureColorTemplate8PhotoGalleryMinimalWidthPx()}px` : 'auto'
    },
    alignSelf: fillHeight ? 'stretch' : 'flex-start',
    minHeight: 0,
    '&:hover .color-template8-gallery-resize-handle::before': {
      opacity: 0.85
    },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryResizeHandleSx(overrides = {}) {
  return {
    flexShrink: 0,
    width: { xs: 0, sm: 10 },
    ml: { xs: 0, sm: -0.75 },
    alignSelf: 'stretch',
    cursor: { xs: 'default', sm: 'col-resize' },
    display: { xs: 'none', sm: 'flex' },
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
    border: 'none',
    p: 0,
    m: 0,
    bgcolor: 'transparent',
    '&::before': {
      content: '""',
      width: '2px',
      height: '100%',
      minHeight: 48,
      borderRadius: 1,
      bgcolor: 'var(--theme-primary-color)',
      opacity: 0,
      transition: 'opacity 120ms ease, width 120ms ease'
    },
    '&:hover::before, &:focus-visible::before': {
      opacity: 1,
      width: '3px'
    },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryShellSx({ fillResizeWrap = false, fillHeight = true } = {}, overrides = {}) {
  return {
    width: fillResizeWrap ? '100%' : getMyPicksColumnWidth(),
    flex: fillResizeWrap && fillHeight ? 1 : fillHeight ? undefined : '0 1 auto',
    minWidth: fillResizeWrap ? 0 : undefined,
    flexShrink: 0,
    border: COLOR_TEMPLATE8_PHOTO_GALLERY_BORDER,
    ...(fillResizeWrap ? { borderRight: 'none' } : {}),
    borderRadius: 1,
    bgcolor: COLOR_TEMPLATE8_PHOTO_GALLERY_SHELL_BG,
    display: 'flex',
    flexDirection: 'column',
    height: fillHeight ? undefined : 'auto',
    minHeight: fillHeight ? getMyPicksColumnMinHeight() : 0,
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryHeaderSx(overrides = {}) {
  return {
    px: { xs: '2vw', sm: '0.9vw' },
    py: { xs: '1.2vw', sm: '0.7vh' },
    borderBottom: COLOR_TEMPLATE8_PHOTO_GALLERY_BORDER,
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryHeaderTextSx(overrides = {}) {
  return {
    color: COLOR_TEMPLATE8_PHOTO_GALLERY_TEXT,
    fontWeight: 700,
    fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
    lineHeight: 1.3,
    textAlign: 'center',
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryListSx({ fillHeight = true } = {}, overrides = {}) {
  return {
    overflowY: fillHeight ? 'auto' : 'visible',
    overflowX: 'hidden',
    minHeight: 0,
    flex: fillHeight ? 1 : '0 1 auto',
    ...overrides
  };
}

/** All Singles — full-width shell; cards flow in rows and wrap at page edge. */
export function colorTemplate8PhotoGalleryWrapShellSx(overrides = {}) {
  return {
    width: '100%',
    flex: '1 1 auto',
    minWidth: 0,
    flexShrink: 1,
    height: 'auto',
    minHeight: 0,
    ...overrides
  };
}

/** Horizontal flex row with wrap for gallery card lists (e.g. All Singles). */
export function colorTemplate8PhotoGalleryWrapListSx(overrides = {}) {
  return {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
    gap: { xs: 1.5, sm: 1.5 },
    width: '100%',
    overflow: 'visible',
    flex: '0 1 auto',
    minHeight: 0,
    ...overrides
  };
}

/** Fixed card width so wrapped rows stay even (matches My Picks column width on sm+). */
export function colorTemplate8PhotoGalleryWrapItemSx(overrides = {}) {
  const cardWidth = getMyPicksColumnWidth();
  return {
    width: { xs: 'calc(50% - 0.75rem)', sm: cardWidth.sm },
    maxWidth: { xs: 'calc(50% - 0.75rem)', sm: cardWidth.sm },
    flex: { xs: '1 1 calc(50% - 0.75rem)', sm: '0 0 auto' },
    ml: 0,
    mr: 0,
    cursor: 'default',
    '&:active': { cursor: 'default' },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryEmptyTextSx(overrides = {}) {
  return {
    p: 1.5,
    color: COLOR_TEMPLATE8_PHOTO_GALLERY_TEXT,
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryItemSx(
  { selected = false, isDropTarget = false, selectedGreenBackground = false } = {},
  overrides = {}
) {
  const templateSx = isDropTarget ? null : colorTemplate8PhotoGalleryButtonTemplateSx(selected);
  const selectedAvatarScale = COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_SCALE;
  const useGreenSelectedBg = selected && selectedGreenBackground && !isDropTarget;
  const useFlatSelectedStyle = useGreenSelectedBg;
  const selectedBgcolor = useGreenSelectedBg
    ? COLOR_TEMPLATE8_PHOTO_GALLERY_ITEM_BG_SELECTED_GREEN
    : templateSx?.bgcolor;
  const selectedLabelColor = useGreenSelectedBg ? '#ffffff' : COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT_SELECTED;
  const itemWidth = useFlatSelectedStyle || !selected ? 'calc(100% - 0.75vw)' : 'calc(100% - 1.2vw)';
  return {
    position: 'relative',
    width: itemWidth,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    px: cardSpacing.innerPx,
    pt: cardSpacing.innerPt,
    pb: cardSpacing.innerPb,
    mb: cardSpacing.innerMb,
    my: cardSpacing.cardMy,
    ml: cardSpacing.cardMl,
    mr: useFlatSelectedStyle || !selected ? cardSpacing.cardMr : cardSpacing.cardMrSelected,
    borderStyle: isDropTarget ? 'dashed' : 'none',
    borderColor: isDropTarget ? 'rgba(255,255,255,0.85)' : 'transparent',
    borderWidth: isDropTarget ? getMyPicksOuterBorderWidth() : 0,
    borderRadius: { xs: 2, sm: '0.85vw' },
    ...(templateSx || useGreenSelectedBg
      ? {
          bgcolor: selectedBgcolor
        }
      : {
          bgcolor: 'rgba(255,255,255,0.12)'
        }),
    ...(selected && !useFlatSelectedStyle
      ? {
          zIndex: COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_ITEM_Z_INDEX,
          overflow: 'visible'
        }
      : {
          zIndex: 0
        }),
    '& .clickable-member-text .MuiTypography-root': {
      color: selected
        ? `${selectedLabelColor} !important`
        : `${COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT} !important`,
      WebkitTextFillColor: selected
        ? `${selectedLabelColor} !important`
        : `${COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT} !important`
    },
    ...materialPanelSx,
    ...hoverEnlargeChildrenSx(['.clickable-profile-photo', '.clickable-member-text']),
    ...(selected && !useFlatSelectedStyle
      ? {
          '& .clickable-profile-photo': {
            position: 'relative',
            zIndex: COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_Z_INDEX,
            transform: `scale(${selectedAvatarScale})`,
            transformOrigin: 'center'
          },
          '&:hover .clickable-profile-photo': {
            transform: `scale(${selectedAvatarScale})`
          }
        }
      : {}),
    cursor: 'grab',
    '&:active': { cursor: 'grabbing' },
    '& [data-clickable-zone="true"], & [data-clickable-zone="true"] *': {
      cursor: 'pointer'
    },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryAvatarSx(
  { selected = false, selectedAvatarCircular = false, selectedGreenBackground = false } = {},
  overrides = {}
) {
  const selectedAvatarScale = COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_SCALE;
  const keepCircular = selected && selectedAvatarCircular;
  const useFlatSelectedStyle = selected && selectedGreenBackground;
  return {
    width: getMyPicksAvatarSize(),
    height: getMyPicksAvatarSize(),
    borderRadius: selected && !keepCircular ? { xs: '4px', sm: '0.28vw' } : '50%',
    overflow: 'hidden',
    borderStyle: selected ? 'double' : 'none',
    borderColor: selected ? COLOR_TEMPLATE8_PHOTO_GALLERY_TEXT : 'transparent',
    borderWidth: selected ? getMyPicksAvatarBorderWidth() : 0,
    boxSizing: 'border-box',
    cursor: 'pointer',
    ...(selected && !useFlatSelectedStyle
      ? {
          position: 'relative',
          zIndex: COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_Z_INDEX
        }
      : null),
    transform: selected && !useFlatSelectedStyle ? `scale(${selectedAvatarScale})` : 'scale(1)',
    transformOrigin: 'center',
    transition: 'transform 180ms ease, border-width 180ms ease, border-radius 180ms ease',
    '& img': {
      objectFit: 'cover',
      width: '100%',
      height: '100%',
      ...(selected && !useFlatSelectedStyle
        ? {
            transform: 'scale(1.12)',
            transformOrigin: 'center center'
          }
        : {})
    },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryNameButtonSx(overrides = {}) {
  return {
    width: '100%',
    display: 'block',
    textAlign: 'center',
    px: { xs: '1vw', sm: '0.45vw' },
    py: { xs: '1vw', sm: '0.45vh' },
    mt: { xs: '0.8vw', sm: '0.35vh' },
    borderRadius: { xs: 1.5, sm: '0.5vw' },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryLabelWrapSx(overrides = {}) {
  return {
    minWidth: 0,
    transform: 'scale(1)',
    transformOrigin: 'center',
    transition: 'transform 180ms ease',
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryLabelLineSx(
  { selected = false, selectedGreenBackground = false } = {},
  overrides = {}
) {
  const labelColor = selected
    ? COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT_SELECTED
    : COLOR_TEMPLATE8_PHOTO_GALLERY_LABEL_TEXT;
  const labelFontSize = { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() };
  const useFlatSelectedStyle = selected && selectedGreenBackground;
  return {
    color: labelColor,
    WebkitTextFillColor: labelColor,
    fontWeight: selected ? 700 : 500,
    fontSize: labelFontSize,
    lineHeight: 1.25,
    ...(selected && !useFlatSelectedStyle ? buttonSelectedMagnifyFontSx({ baseFontSize: labelFontSize }) : {}),
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryRemoveButtonSx(overrides = {}) {
  const removeColor = COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_COLOR;
  const removeBg = COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_BG;
  const removeInset = colorTemplate8PhotoGalleryRemoveButtonInset();
  const sizeMul = COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_SIZE_MULTIPLIER;
  const iconSize = `calc(${removeIconSize} * ${sizeMul})`;
  const hoverIconSize = `calc(${removeIconSize} * ${sizeMul} * ${getHoverMagnifyFactor()})`;
  return {
    position: 'absolute',
    top: removeInset.top,
    right: removeInset.right,
    zIndex: COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_ITEM_Z_INDEX + 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto',
    height: 'auto',
    minWidth: iconSize,
    minHeight: iconSize,
    p: { xs: '0.2vw', sm: '0.12vw' },
    m: 0,
    border: 'none',
    borderRadius: 0,
    boxSizing: 'border-box',
    cursor: 'pointer',
    color: removeColor,
    bgcolor: removeBg,
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.35)',
    transformOrigin: 'top right',
    transition: 'background-color 0.15s ease',
    '@media (hover: hover)': {
      '&:hover:not(:disabled)': {
        bgcolor: removeBg,
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.35)',
        '& svg': {
          width: hoverIconSize,
          height: hoverIconSize
        }
      }
    },
    '&:active:not(:disabled)': {
      boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.35)'
    },
    '&:disabled': {
      bgcolor: removeBg,
      cursor: 'not-allowed',
      opacity: 0.45,
      boxShadow: 'none'
    },
    '& svg': {
      width: iconSize,
      height: iconSize,
      color: removeColor,
      transition: 'width 0.15s ease, height 0.15s ease'
    },
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryRemoveSpinnerSx(overrides = {}) {
  return {
    color: COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_COLOR,
    width: `calc(${removeIconSize} * ${COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_SIZE_MULTIPLIER})`,
    height: `calc(${removeIconSize} * ${COLOR_TEMPLATE8_PHOTO_GALLERY_REMOVE_X_SIZE_MULTIPLIER})`,
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryBioAnchorSx(overrides = {}) {
  return {
    mt: cardSpacing.bioMt,
    ...overrides
  };
}

export function colorTemplate8PhotoGalleryFooterSx(overrides = {}) {
  return {
    mt: cardSpacing.bioMt,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...overrides
  };
}
