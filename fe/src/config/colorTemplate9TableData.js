/**
 * colorTemplate9TableData — data tables with zebra rows, inverse-daynight grid borders,
 * and ColorTemplate1-style tab buttons (Admin Tools Backup/Duplicate/Test mockup).
 *
 * Reuse tokens or *Sx() helpers; or compose ui-component/ColorTemplate9TableData.
 *
 * Panel `fullWidth` — stretch bordered chrome across the main content column (menu open/closed, window resize).
 */
import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getMobileSinglesTextFontSizeVw, getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import {
  COLOR_TEMPLATE1_BG_SELECTED,
  COLOR_TEMPLATE1_BG_UNSELECTED,
  COLOR_TEMPLATE1_BORDER_SELECTED,
  COLOR_TEMPLATE1_BORDER_UNSELECTED,
  COLOR_TEMPLATE1_TEXT_SELECTED,
  COLOR_TEMPLATE1_TEXT_UNSELECTED,
  COLOR_TEMPLATE1_WALL_COLOR_LIGHT,
  colorTemplate1ButtonSx
} from 'config/colorTemplate1';

/** Table scrollbar: theme-primary thumb on white track. */
export const COLOR_TEMPLATE9_TABLE_SCROLLBAR_THUMB = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE9_TABLE_SCROLLBAR_TRACK = COLOR_TEMPLATE1_WALL_COLOR_LIGHT;

// —— 1–2 Table header ——
export const COLOR_TEMPLATE9_TABLE_HEADER_BG = 'var(--theme-daynight-color)';
export const COLOR_TEMPLATE9_TABLE_HEADER_TEXT = 'var(--theme-inverse-daynight-color)';

// —— 3–4 Table body ——
export const COLOR_TEMPLATE9_TABLE_BODY_TEXT = 'var(--theme-inverse-daynight-color)';
export const COLOR_TEMPLATE9_TABLE_ROW_BG_EVEN = 'var(--theme-daynight-color)';
export const COLOR_TEMPLATE9_TABLE_ROW_BG_ODD =
  'var(--theme-daynight2-color, var(--theme-inverse-daynight-color))';

// —— 11 Cell borders ——
export const COLOR_TEMPLATE9_TABLE_CELL_BORDER_COLOR = 'var(--theme-inverse-daynight-color)';
export const COLOR_TEMPLATE9_TABLE_CELL_BORDER = `1px solid ${COLOR_TEMPLATE9_TABLE_CELL_BORDER_COLOR}`;

// —— 12 Table title ——
export const COLOR_TEMPLATE9_TABLE_TITLE_BG = 'var(--theme-daynight-color)';
export const COLOR_TEMPLATE9_TABLE_TITLE_TEXT = 'var(--theme-primary-color)';

// —— Default in-table buttons (Remove Dup, Add test, Reset; Run/Record use sx override) ——
export const COLOR_TEMPLATE9_DEFAULT_BUTTON_FONT_COLOR = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR = 'var(--theme-secondary-color)';
export const COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR_DISABLED = '#94B2C0';

// —— 6–9 Tab / toolbar buttons (selected + unselected; Backup / Duplicate / Test) ——
export const COLOR_TEMPLATE9_BUTTON_FONT_COLOR_SELECTED = COLOR_TEMPLATE1_TEXT_SELECTED;
export const COLOR_TEMPLATE9_BUTTON_FONT_COLOR_UNSELECTED = COLOR_TEMPLATE1_TEXT_UNSELECTED;
export const COLOR_TEMPLATE9_BUTTON_BORDER_SELECTED = COLOR_TEMPLATE1_BORDER_SELECTED;
export const COLOR_TEMPLATE9_BUTTON_BORDER_UNSELECTED = COLOR_TEMPLATE1_BORDER_UNSELECTED;
export const COLOR_TEMPLATE9_BUTTON_BG_SELECTED = COLOR_TEMPLATE1_BG_SELECTED;
export const COLOR_TEMPLATE9_BUTTON_BG_UNSELECTED = COLOR_TEMPLATE1_BG_UNSELECTED;

/** Panel chrome around table + tabs */
export const COLOR_TEMPLATE9_TABLE_PANEL_BORDER = '1px solid var(--theme-primary-color)';
export const COLOR_TEMPLATE9_TABLE_PANEL_BG = 'var(--theme-daynight-color)';
export const COLOR_TEMPLATE9_TABLE_PANEL_DIVIDER = 'var(--theme-primary-color)';

export function colorTemplate9TableRowBg(rowIndex) {
  return rowIndex % 2 === 0 ? COLOR_TEMPLATE9_TABLE_ROW_BG_EVEN : COLOR_TEMPLATE9_TABLE_ROW_BG_ODD;
}

/**
 * Sticky left offsets for frozen lookup columns during horizontal scroll.
 * @param {number} columnIndex — 0-based grid column
 * @param {{ frozenColumnCount?: number, columnWidthsPx?: number[], rowIndex?: number, isHeader?: boolean }} opts
 */
export function colorTemplate9FrozenColumnStickyCellSx(
  columnIndex,
  { frozenColumnCount = 0, columnWidthsPx = [], rowIndex = 0, isHeader = false } = {}
) {
  const col = Number(columnIndex);
  const frozen = Number(frozenColumnCount);
  if (!Number.isFinite(col) || col < 0 || !Number.isFinite(frozen) || frozen < 1 || col >= frozen) {
    return {};
  }

  let left = 0;
  for (let i = 0; i < col; i += 1) {
    left += Math.max(0, Math.trunc(Number(columnWidthsPx[i]) || 0));
  }

  return {
    position: 'sticky',
    left,
    ...(isHeader ? { top: 0, zIndex: 7 + col } : { zIndex: 5 }),
    bgcolor: isHeader ? COLOR_TEMPLATE9_TABLE_HEADER_BG : colorTemplate9TableRowBg(rowIndex),
    backgroundClip: 'padding-box',
    ...(col === frozen - 1
      ? {
          boxShadow: '4px 0 8px -4px rgba(0,0,0,0.45)',
          borderRight: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
          ...(isHeader ? { zIndex: 10 + col } : null)
        }
      : null)
  };
}

/** 5 Table content font size */
export function colorTemplate9TableBodyFontSx(overrides = {}) {
  return {
    fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
    ...overrides
  };
}

/** 10 Table header font size */
export function colorTemplate9TableHeaderFontSx(overrides = {}) {
  return {
    ...colorTemplate9TableBodyFontSx(),
    fontWeight: 700,
    ...overrides
  };
}

/** 12 Table title font size + colors */
export function colorTemplate9TableTitleSx(overrides = {}) {
  return {
    bgcolor: COLOR_TEMPLATE9_TABLE_TITLE_BG,
    color: COLOR_TEMPLATE9_TABLE_TITLE_TEXT,
    fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
    ...overrides
  };
}

/** 1–2 Header row/cell */
export function colorTemplate9TableHeaderRowSx(overrides = {}) {
  return {
    bgcolor: COLOR_TEMPLATE9_TABLE_HEADER_BG,
    color: COLOR_TEMPLATE9_TABLE_HEADER_TEXT,
    fontWeight: 700,
    ...colorTemplate9TableHeaderFontSx(),
    '& .MuiTypography-root': { color: 'inherit', fontWeight: 'inherit' },
    ...overrides
  };
}

/** 3 Body cell text — nowrap keeps values like "26 clicks" on one row (override for wrapped filenames). */
export function colorTemplate9TableBodyTextSx(overrides = {}) {
  return {
    ...colorTemplate9TableBodyFontSx(),
    color: COLOR_TEMPLATE9_TABLE_BODY_TEXT,
    whiteSpace: 'nowrap',
    ...overrides
  };
}

/** 11 Shared grid cell */
export function colorTemplate9TableCellSx(overrides = {}) {
  return {
    borderRight: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    borderBottom: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    py: 1,
    px: 1.25,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    ...overrides
  };
}

/**
 * Test tab columns: Delete | Run | Record | # Loop | Name | Steps | Duration
 * Run 50% wider than base 112px; Name flex 10% smaller than 3.3fr baseline.
 */
export const COLOR_TEMPLATE9_UI_TEST_GRID_COLUMNS =
  '48px 168px 256px 192px minmax(297px, 2.97fr) 76px 140px';

export const COLOR_TEMPLATE9_UI_TEST_TABLE_MIN_WIDTH_PX = 1177;

export function colorTemplate9TableUiTestRowSx(overrides = {}) {
  return {
    ...colorTemplate9TableGridSx({ gridTemplateColumns: COLOR_TEMPLATE9_UI_TEST_GRID_COLUMNS }),
    width: '100%',
    minWidth: COLOR_TEMPLATE9_UI_TEST_TABLE_MIN_WIDTH_PX,
    boxSizing: 'border-box',
    ...overrides
  };
}

export function colorTemplate9TableUiTestShellSx(overrides = {}) {
  return {
    ...colorTemplate9TableShellSx(),
    width: '100%',
    overflowX: 'auto',
    overflowY: 'visible',
    ...overrides
  };
}

export function colorTemplate9TableUiTestCellSx(overrides = {}) {
  return colorTemplate9TableCellSx({
    py: 0.75,
    px: 1,
    overflow: 'visible',
    ...overrides
  });
}

export function colorTemplate9TableUiTestHeaderCellSx(overrides = {}) {
  return colorTemplate9TableUiTestCellSx({
    whiteSpace: 'nowrap',
    ...overrides
  });
}

export function colorTemplate9TableUiTestNameCellSx(overrides = {}) {
  return colorTemplate9TableUiTestCellSx({
    minWidth: 0,
    width: '100%',
    ...overrides
  });
}

/** # Loop column — larger bold numbers per desire mockup. */
export function colorTemplate9TableUiTestLoopValueSx(overrides = {}) {
  return {
    ...colorTemplate9TableBodyTextSx(),
    fontWeight: 700,
    fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
    lineHeight: 1.1,
    ...overrides
  };
}

/** Cells that contain Run / Record — fixed column width, no clip. */
export function colorTemplate9TableActionCellSx(overrides = {}) {
  return colorTemplate9TableUiTestCellSx({
    overflow: 'visible',
    justifyContent: 'flex-start',
    flexShrink: 0,
    ...overrides
  });
}

export function colorTemplate9TableGridSx({ gridTemplateColumns } = {}, overrides = {}) {
  return {
    display: 'grid',
    gridTemplateColumns,
    gap: 0,
    alignItems: 'stretch',
    borderLeft: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    ...overrides
  };
}

export function colorTemplate9TableShellSx(overrides = {}) {
  return {
    borderRadius: 0,
    overflow: 'hidden',
    borderTop: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    ...overrides
  };
}

/** Horizontal scroll viewport for wide ColorTemplate9 tables (frozen columns + bottom scrollbar). */
export function colorTemplate9TableHorizontalScrollShellSx(overrides = {}) {
  return {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    borderRadius: 0,
    borderTop: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    scrollbarGutter: 'stable',
    ...overrides
  };
}

/** White track for the custom table horizontal scrollbar (top + bottom). */
export function colorTemplate9TableCustomScrollbarTrackSx(overrides = {}) {
  return {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    flexShrink: 0,
    height: 12,
    minHeight: 12,
    maxHeight: 12,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: COLOR_TEMPLATE9_TABLE_SCROLLBAR_TRACK,
    borderRadius: 0,
    ...overrides
  };
}

/** Theme-primary thumb that sits on the white track. */
export function colorTemplate9TableCustomScrollbarThumbSx(overrides = {}) {
  return {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: COLOR_TEMPLATE9_TABLE_SCROLLBAR_THUMB,
    borderRadius: 0,
    cursor: 'grab',
    touchAction: 'none',
    '&:active': { cursor: 'grabbing' },
    ...overrides
  };
}

/** Hide the native scrollbar — custom red/white bars are the visible control. */
export function colorTemplate9TableHideNativeScrollbarSx(overrides = {}) {
  return {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    scrollbarGutter: 'auto',
    '&::-webkit-scrollbar': {
      display: 'none',
      height: 0,
      width: 0
    },
    ...overrides
  };
}

/** Outer card-style panel (tabs + table body) */
export function colorTemplate9TablePanelSx(overrides = {}) {
  return {
    border: COLOR_TEMPLATE9_TABLE_PANEL_BORDER,
    borderRadius: 1,
    overflow: 'visible',
    ...overrides
  };
}

/** Panel fills parent main column — use on Admin Tools / full-page table chrome. */
export function colorTemplate9TablePanelFullWidthSx(overrides = {}) {
  return {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    alignSelf: 'stretch',
    flex: '1 1 auto',
    ...overrides
  };
}

export function colorTemplate9TableTabBarSx(overrides = {}) {
  return {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    p: 1.5,
    bgcolor: COLOR_TEMPLATE9_TABLE_PANEL_BG,
    ...overrides
  };
}

export function colorTemplate9TableContentAreaSx(overrides = {}) {
  return {
    p: { xs: 1, sm: 1.5 },
    bgcolor: COLOR_TEMPLATE9_TABLE_PANEL_BG,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'visible',
    ...overrides
  };
}

/** Strip above a nested table (duplicate group heading). */
export function colorTemplate9TableGroupTitleSx(overrides = {}) {
  return {
    ...colorTemplate9TableBodyFontSx(),
    ...colorTemplate9TableHeaderRowSx(),
    px: 1.25,
    py: 0.75,
    borderBottom: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    display: 'block',
    ...overrides
  };
}

/** 9 Tab button font size — MOBILE/DESKTOP_FONT_SIZE_BUTTON (+ 6–8 via ColorTemplate1) */
export function colorTemplate9TabButtonSx({ selected = false, hoverScale = null } = {}, overrides = {}) {
  return {
    ...colorTemplate1ButtonSx({ selected, hoverScale }),
    fontSize: buttonFontSizeResponsive,
    textTransform: 'none',
    borderRadius: '8px',
    ...overrides
  };
}

/**
 * Scoped to ColorTemplate9TableData panels/tables: button font size + table content color.
 * Overrides global MuiInputBase (palette.text.dark) so Name fields read on dark zebra rows.
 */
export function colorTemplate9TableDataScopeSx(overrides = {}) {
  const tableText = COLOR_TEMPLATE9_TABLE_BODY_TEXT;
  return {
    '& .MuiButton-root': {
      fontSize: buttonFontSizeResponsive
    },
    '& .MuiTypography-root:not([class*="MuiAlert"] *)': {
      color: tableText
    },
    '& .MuiInputBase-input': {
      color: `${tableText} !important`,
      WebkitTextFillColor: `${tableText} !important`
    },
    '& .MuiInput-root:not(.Mui-disabled):before': {
      borderBottomColor: tableText
    },
    '& .MuiInput-root:hover:not(.Mui-disabled):before': {
      borderBottomColor: tableText
    },
    '& .MuiInput-root.Mui-focused:after': {
      borderBottomColor: tableText
    },
    ...overrides
  };
}

/**
 * Default table action button (secondary bg, primary label).
 * Pass overrides for Run (green), Record (yellow), etc.
 */
export function colorTemplate9TableButtonSx(overrides = {}) {
  return colorTemplate9TableActionButtonSx({
    color: COLOR_TEMPLATE9_DEFAULT_BUTTON_FONT_COLOR,
    bgcolor: COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR,
    '&:hover': {
      bgcolor: COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR,
      color: COLOR_TEMPLATE9_DEFAULT_BUTTON_FONT_COLOR,
      filter: 'brightness(0.96)',
      boxShadow: 'none'
    },
    '&.Mui-disabled': {
      bgcolor: COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR_DISABLED,
      color: COLOR_TEMPLATE9_DEFAULT_BUTTON_FONT_COLOR,
      opacity: 1
    },
    ...overrides
  });
}

/** Wide enough label area; no clipping at large DESKTOP_FONT_SIZE_BUTTON. */
export function colorTemplate9TableActionButtonSx(overrides = {}) {
  return {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: buttonFontSizeResponsive,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    width: 'max-content',
    minWidth: 'max-content',
    maxWidth: 'none',
    flexShrink: 0,
    px: 2,
    py: 0.75,
    boxShadow: 'none',
    overflow: 'visible',
    ...overrides
  };
}

/** Centered primary action below a table (e.g. Add test). */
export function colorTemplate9TableFooterActionBarSx(overrides = {}) {
  return {
    display: 'flex',
    justifyContent: 'center',
    mt: 2,
    ...overrides
  };
}

export function colorTemplate9TablePrimaryActionButtonSx(overrides = {}) {
  return colorTemplate9TableButtonSx(overrides);
}

export function colorTemplate9TableEmptyRowSx(overrides = {}) {
  return {
    borderLeft: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    borderRight: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    borderBottom: COLOR_TEMPLATE9_TABLE_CELL_BORDER,
    bgcolor: COLOR_TEMPLATE9_TABLE_ROW_BG_EVEN,
    ...overrides
  };
}

/** Read-only token map for docs / debugging */
export function getColorTemplate9TableDataTokens({ buttonSelected = false } = {}) {
  return {
    tableHeaderBackgroundColor: COLOR_TEMPLATE9_TABLE_HEADER_BG,
    tableHeaderFontColor: COLOR_TEMPLATE9_TABLE_HEADER_TEXT,
    tableContentFontColor: COLOR_TEMPLATE9_TABLE_BODY_TEXT,
    tableContentBackgroundColorEven: COLOR_TEMPLATE9_TABLE_ROW_BG_EVEN,
    tableContentBackgroundColorOdd: COLOR_TEMPLATE9_TABLE_ROW_BG_ODD,
    tableContentFontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
    defaultButtonFontColor: COLOR_TEMPLATE9_DEFAULT_BUTTON_FONT_COLOR,
    defaultButtonBackgroundColor: COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR,
    defaultButtonBackgroundColorDisabled: COLOR_TEMPLATE9_DEFAULT_BUTTON_BG_COLOR_DISABLED,
    tabButtonFontColor: buttonSelected
      ? COLOR_TEMPLATE9_BUTTON_FONT_COLOR_SELECTED
      : COLOR_TEMPLATE9_BUTTON_FONT_COLOR_UNSELECTED,
    tabButtonBorderColor: buttonSelected
      ? COLOR_TEMPLATE9_BUTTON_BORDER_SELECTED
      : COLOR_TEMPLATE9_BUTTON_BORDER_UNSELECTED,
    tabButtonBackgroundColor: buttonSelected
      ? COLOR_TEMPLATE9_BUTTON_BG_SELECTED
      : COLOR_TEMPLATE9_BUTTON_BG_UNSELECTED,
    buttonFontSize: buttonFontSizeResponsive,
    tableHeaderFontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
    tableCellBorderColor: COLOR_TEMPLATE9_TABLE_CELL_BORDER_COLOR,
    tableTitleFontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
    tableTitleFontColor: COLOR_TEMPLATE9_TABLE_TITLE_TEXT,
    tableTitleBackgroundColor: COLOR_TEMPLATE9_TABLE_TITLE_BG
  };
}
