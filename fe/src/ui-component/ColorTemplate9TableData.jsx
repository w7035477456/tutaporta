import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import {
  buildColorTemplate9AutoFitGridTemplateColumns,
  computeColorTemplate9AutoFitColumnWidthsPx,
  measureColorTemplate9ColumnButtonsMaxWidthPx,
  measureColorTemplate9InCellButtonWidthPx,
  sumColorTemplate9AutoFitColumnWidths
} from 'utils/colorTemplate9AutoFitColumns';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

import { colorTemplate10MenuItemButtonSx } from 'config/colorTemplate10Menu';
import { SelectedButtonLabelTextBox } from 'ui-component/SelectedButtonTemplate';
import { INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';
import {
  COLOR_TEMPLATE9_TABLE_PANEL_DIVIDER,
  COLOR_TEMPLATE9_UI_TEST_TABLE_MIN_WIDTH_PX,
  colorTemplate9TableBodyTextSx,
  colorTemplate9TableEmptyRowSx,
  colorTemplate9TableFooterActionBarSx,
  colorTemplate9TableGroupTitleSx,
  colorTemplate9TableActionCellSx,
  colorTemplate9TableButtonSx,
  colorTemplate9TableDataScopeSx,
  colorTemplate9TableUiTestHeaderCellSx,
  colorTemplate9TableUiTestLoopValueSx,
  colorTemplate9TableUiTestNameCellSx,
  colorTemplate9TableUiTestRowSx,
  colorTemplate9TableUiTestCellSx,
  colorTemplate9TablePrimaryActionButtonSx,
  colorTemplate9TableCellSx,
  colorTemplate9TableContentAreaSx,
  colorTemplate9TableGridSx,
  colorTemplate9TableHeaderRowSx,
  colorTemplate9TablePanelFullWidthSx,
  colorTemplate9TablePanelSx,
  colorTemplate9TableRowBg,
  COLOR_TEMPLATE9_TABLE_CELL_BORDER,
  colorTemplate9TableShellSx,
  colorTemplate9TableHorizontalScrollShellSx,
  colorTemplate9TableCustomScrollbarTrackSx,
  colorTemplate9TableCustomScrollbarThumbSx,
  colorTemplate9TableHideNativeScrollbarSx,
  colorTemplate9TableTabBarSx,
  colorTemplate9TableTitleSx,
  colorTemplate9FrozenColumnStickyCellSx
} from 'config/colorTemplate9TableData';

const TableFrozenColumnsContext = createContext({
  frozenColumnCount: 0,
  columnWidthsPx: []
});

const TableBodyRowIndexContext = createContext(0);

function useFrozenColumnStickySx(columnIndex, { isHeader = false } = {}) {
  const { frozenColumnCount, columnWidthsPx } = useContext(TableFrozenColumnsContext);
  const rowIndex = useContext(TableBodyRowIndexContext);
  return useMemo(
    () =>
      colorTemplate9FrozenColumnStickyCellSx(columnIndex, {
        frozenColumnCount,
        columnWidthsPx,
        rowIndex,
        isHeader
      }),
    [columnIndex, columnWidthsPx, frozenColumnCount, isHeader, rowIndex]
  );
}

/** Odd zebra rows (`alternate-row-table-content`) — body copy uses theme inverse-daynight. */
export const COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS = 'alternate-row-table-content';
/** CSS color for zebra stripe table body cells (`--theme-inverse-daynight-color`). */
export const COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR = `var(${INVERSE_DAYNIGHT_VAR})`;

function isAlternateTableRow(rowIndex) {
  return Number(rowIndex) % 2 === 1;
}

export function colorTemplate9AlternateRowContentSx(overrides = {}) {
  const text = COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR;
  return {
    color: text,
    '& .MuiTypography-root': {
      color: `${text} !important`,
      WebkitTextFillColor: `${text} !important`
    },
    '& .MuiInputBase-input': {
      color: `${text} !important`,
      WebkitTextFillColor: `${text} !important`
    },
    '& .MuiInputBase-root': {
      color: text
    },
    '& .MuiInput-root:not(.Mui-disabled):before': {
      borderBottomColor: text
    },
    '& .MuiInput-root:hover:not(.Mui-disabled):before': {
      borderBottomColor: text
    },
    '& .MuiInput-root.Mui-focused:after': {
      borderBottomColor: text
    },
    ...overrides
  };
}

function colorTemplate9TableDataScopeWithAlternateRowsSx() {
  return {
    ...colorTemplate9TableDataScopeSx(),
    [`& .${COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS}`]: colorTemplate9AlternateRowContentSx()
  };
}

/**
 * Reusable Admin Tools–style data table chrome.
 *
 *   <ColorTemplate9TableData.Panel>
 *     <ColorTemplate9TableData.Title>Admin Tools</ColorTemplate9TableData.Title>
 *     <ColorTemplate9TableData.TabBar>
 *       <ColorTemplate9TableData.TabButton selected>Backup</ColorTemplate9TableData.TabButton>
 *     </ColorTemplate9TableData.TabBar>
 *     <ColorTemplate9TableData.Content>
 *       <ColorTemplate9TableData.Table>
 *         <ColorTemplate9TableData.HeaderRow gridTemplateColumns="...">
 *           <ColorTemplate9TableData.HeaderCell>File Name</ColorTemplate9TableData.HeaderCell>
 *         </ColorTemplate9TableData.HeaderRow>
 *         <ColorTemplate9TableData.BodyRow rowIndex={0} gridTemplateColumns="...">
 *           <ColorTemplate9TableData.BodyCell>...</ColorTemplate9TableData.BodyCell>
 *         </ColorTemplate9TableData.BodyRow>
 *       </ColorTemplate9TableData.Table>
 *     </ColorTemplate9TableData.Content>
 *   </ColorTemplate9TableData.Panel>
 */
function ColorTemplate9TableDataPanel({ fullWidth = false, sx, children, ...rest }) {
  return (
    <Box
      data-color-template9-table=""
      sx={{
        ...colorTemplate9TablePanelSx(),
        ...(fullWidth ? colorTemplate9TablePanelFullWidthSx() : null),
        ...colorTemplate9TableDataScopeWithAlternateRowsSx(),
        ...(sx || {})
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataTitle({ component = 'h1', sx, children, ...rest }) {
  return (
    <Typography component={component} sx={{ ...colorTemplate9TableTitleSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Typography>
  );
}

function ColorTemplate9TableDataTabBar({ sx, children, ...rest }) {
  return (
    <Box sx={{ ...colorTemplate9TableTabBarSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Box>
  );
}

/** Tab button — ColorTemplate10Menu (primary/secondary theme tabs). */
function ColorTemplate9TableDataTabButton({ selected = false, sx, children, ...rest }) {
  return (
    <Button
      sx={{
        ...colorTemplate10MenuItemButtonSx({ selected, fitLabelWidth: true }),
        minHeight: 36,
        fontWeight: selected ? 700 : 600,
        px: 2.5,
        ...(sx || {})
      }}
      {...rest}
    >
      <SelectedButtonLabelTextBox enabled={selected}>{children}</SelectedButtonLabelTextBox>
    </Button>
  );
}

function ColorTemplate9TableDataPanelDivider({ sx, ...rest }) {
  return <Divider sx={{ borderColor: COLOR_TEMPLATE9_TABLE_PANEL_DIVIDER, ...(sx || {}) }} {...rest} />;
}

function ColorTemplate9TableDataContent({ sx, children, ...rest }) {
  return (
    <Box sx={{ ...colorTemplate9TableContentAreaSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Box>
  );
}

/**
 * Measure header + body strings and return fixed px grid columns (no clipping).
 * Pair with ColorTemplate9TableData.Table minTableWidth={minTableWidthPx}.
 *
 * @param {object} opts
 * @param {string[][]} opts.columnTexts — per-column strings (header label + each row)
 * @param {import('utils/colorTemplate9AutoFitColumns').ColorTemplate9AutoFitColumnButtons[]} [opts.columnButtons] — in-cell buttons per column
 * @param {number[]} [opts.minWidthsPx]
 * @param {number[]} [opts.extraWidthsPx] — extra px beyond measured text/buttons
 * @param {number} [opts.maxMeasureChars] — size columns to first N characters (0 = full string)
 * @param {boolean} [opts.enabled]
 */
export function useColorTemplate9AutoFitColumnWidths({
  columnTexts,
  columnButtons = [],
  minWidthsPx = [],
  extraWidthsPx = [],
  maxMeasureChars = 0,
  enabled = true
}) {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [enabled]);

  const columnWidthsPx = useMemo(() => {
    if (!enabled || !Array.isArray(columnTexts) || columnTexts.length === 0) {
      return minWidthsPx;
    }
    return computeColorTemplate9AutoFitColumnWidthsPx({
      columnTexts,
      columnButtons,
      minWidthsPx,
      extraWidthsPx,
      maxMeasureChars,
      viewportWidth
    });
  }, [columnButtons, columnTexts, enabled, extraWidthsPx, maxMeasureChars, minWidthsPx, viewportWidth]);

  const gridTemplateColumns = useMemo(
    () => buildColorTemplate9AutoFitGridTemplateColumns(columnWidthsPx),
    [columnWidthsPx]
  );

  const minTableWidthPx = useMemo(
    () => sumColorTemplate9AutoFitColumnWidths(columnWidthsPx),
    [columnWidthsPx]
  );

  return { columnWidthsPx, gridTemplateColumns, minTableWidthPx };
}

function ColorTemplate9TableCustomHorizontalScrollbar({ scrollRef, minTableWidth, placement = 'top' }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [thumb, setThumb] = useState({ width: 48, left: 0 });

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const trackEl = trackRef.current;
    if (!scrollEl || !trackEl) return undefined;

    const updateThumb = () => {
      const trackWidth = trackEl.clientWidth;
      const clientWidth = scrollEl.clientWidth;
      const scrollWidth = Math.max(
        scrollEl.scrollWidth || 0,
        scrollEl.firstElementChild?.scrollWidth || 0,
        Number(minTableWidth) || 0,
        1
      );
      const maxScroll = Math.max(0, scrollWidth - clientWidth);
      const thumbWidth = Math.max(24, Math.min(trackWidth, (clientWidth / scrollWidth) * trackWidth));
      const thumbLeft = maxScroll > 0 ? (scrollEl.scrollLeft / maxScroll) * (trackWidth - thumbWidth) : 0;
      setThumb({ width: thumbWidth, left: thumbLeft });
    };

    updateThumb();
    const rafId = window.requestAnimationFrame(updateThumb);
    scrollEl.addEventListener('scroll', updateThumb, { passive: true });
    window.addEventListener('resize', updateThumb, { passive: true });

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateThumb);
      ro.observe(scrollEl);
      ro.observe(trackEl);
      if (scrollEl.firstElementChild) ro.observe(scrollEl.firstElementChild);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      scrollEl.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
      ro?.disconnect();
    };
  }, [minTableWidth, scrollRef]);

  const jumpToClientX = (clientX) => {
    const scrollEl = scrollRef.current;
    const trackEl = trackRef.current;
    if (!scrollEl || !trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const trackWidth = rect.width;
    const clientWidth = scrollEl.clientWidth;
    const scrollWidth = Math.max(
      scrollEl.scrollWidth || 0,
      scrollEl.firstElementChild?.scrollWidth || 0,
      Number(minTableWidth) || 0,
      1
    );
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const thumbWidth = Math.max(24, Math.min(trackWidth, (clientWidth / scrollWidth) * trackWidth));
    const maxThumb = Math.max(0, trackWidth - thumbWidth);
    const nextLeft = Math.max(0, Math.min(maxThumb, clientX - rect.left - thumbWidth / 2));
    scrollEl.scrollLeft = maxThumb > 0 ? (nextLeft / maxThumb) * maxScroll : 0;
  };

  return (
    <Box
      ref={trackRef}
      role="scrollbar"
      aria-orientation="horizontal"
      aria-label="Table horizontal scroll"
      onPointerDown={(event) => {
        event.preventDefault();
        draggingRef.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        jumpToClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        jumpToClientX(event.clientX);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      sx={colorTemplate9TableCustomScrollbarTrackSx({
        borderBottom: placement === 'top' ? COLOR_TEMPLATE9_TABLE_CELL_BORDER : 'none',
        borderTop: placement === 'bottom' ? COLOR_TEMPLATE9_TABLE_CELL_BORDER : 'none'
      })}
    >
      <Box
        sx={{
          ...colorTemplate9TableCustomScrollbarThumbSx(),
          width: `${thumb.width}px`,
          left: `${thumb.left}px`
        }}
      />
    </Box>
  );
}

ColorTemplate9TableCustomHorizontalScrollbar.propTypes = {
  scrollRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  minTableWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  placement: PropTypes.oneOf(['top', 'bottom'])
};

function ColorTemplate9TableDataTable({
  sx,
  children,
  topHorizontalScrollbar = true,
  minTableWidth = null,
  /** When true, documents that caller uses useColorTemplate9AutoFitColumnWidths + minTableWidth (horizontal scroll when wider than viewport). */
  autoFitColumns = false,
  frozenColumnCount = 0,
  frozenColumnWidthsPx = [],
  ...rest
}) {
  const bottomScrollRef = useRef(null);
  const frozenContextValue = useMemo(
    () => ({
      frozenColumnCount: Math.max(0, Math.trunc(Number(frozenColumnCount) || 0)),
      columnWidthsPx: Array.isArray(frozenColumnWidthsPx) ? frozenColumnWidthsPx : []
    }),
    [frozenColumnCount, frozenColumnWidthsPx]
  );

  const resolvedMinWidth = minTableWidth || 0;
  const content = (
    <Box
      sx={{
        minWidth: resolvedMinWidth || '100%',
        width: resolvedMinWidth ? resolvedMinWidth : '100%',
        boxSizing: 'border-box'
      }}
    >
      {children}
    </Box>
  );

  const useHorizontalScrollShell = autoFitColumns || frozenContextValue.frozenColumnCount > 0 || Boolean(minTableWidth);
  const scrollShellSx = {
    ...(useHorizontalScrollShell
      ? colorTemplate9TableHorizontalScrollShellSx(
          topHorizontalScrollbar ? { borderTop: 'none' } : undefined
        )
      : colorTemplate9TableShellSx({
          overflowX: 'auto',
          ...(topHorizontalScrollbar ? { borderTop: 'none' } : null)
        })),
    ...(topHorizontalScrollbar ? colorTemplate9TableHideNativeScrollbarSx() : null)
  };

  return (
    <TableFrozenColumnsContext.Provider value={frozenContextValue}>
      <Box
        data-color-template9-table=""
        sx={{
          ...colorTemplate9TableDataScopeWithAlternateRowsSx(),
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'visible',
          ...(sx || {})
        }}
        {...rest}
      >
        {topHorizontalScrollbar ? (
          <ColorTemplate9TableCustomHorizontalScrollbar
            scrollRef={bottomScrollRef}
            minTableWidth={minTableWidth}
            placement="top"
          />
        ) : null}
        <Box ref={bottomScrollRef} sx={scrollShellSx}>
          {content}
        </Box>
        {topHorizontalScrollbar ? (
          <ColorTemplate9TableCustomHorizontalScrollbar
            scrollRef={bottomScrollRef}
            minTableWidth={minTableWidth}
            placement="bottom"
          />
        ) : null}
      </Box>
    </TableFrozenColumnsContext.Provider>
  );
}

/** Test tab table — desire mockup column widths + top/bottom horizontal scroll when narrow. */
function ColorTemplate9TableDataUiTestTable({ sx, children, ...rest }) {
  return (
    <ColorTemplate9TableDataTable
      topHorizontalScrollbar
      minTableWidth={COLOR_TEMPLATE9_UI_TEST_TABLE_MIN_WIDTH_PX}
      sx={sx}
      {...rest}
    >
      {children}
    </ColorTemplate9TableDataTable>
  );
}

/** In-table / footer action — primary bg, inverse-daynight text; pass sx to override (Run, Record, etc.). */
function ColorTemplate9TableDataButton({ sx, variant = 'contained', ...rest }) {
  return <Button variant={variant} sx={{ ...colorTemplate9TableButtonSx(), ...(sx || {}) }} {...rest} />;
}

function ColorTemplate9TableDataUiTestHeaderRow({ sx, children, ...rest }) {
  return (
    <Box sx={{ ...colorTemplate9TableUiTestRowSx(), ...colorTemplate9TableHeaderRowSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataUiTestBodyRow({ rowIndex = 0, sx, children, ...rest }) {
  const alternate = isAlternateTableRow(rowIndex);
  return (
    <Box
      className={alternate ? COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS : undefined}
      sx={{
        ...colorTemplate9TableUiTestRowSx(),
        bgcolor: colorTemplate9TableRowBg(rowIndex),
        ...(alternate ? colorTemplate9AlternateRowContentSx() : null),
        ...(sx || {})
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataUiTestCell({ action = false, name = false, sx, children, ...rest }) {
  let baseSx = colorTemplate9TableUiTestCellSx();
  if (action) baseSx = colorTemplate9TableActionCellSx();
  if (name) baseSx = colorTemplate9TableUiTestNameCellSx();
  return (
    <ColorTemplate9TableDataBodyCell sx={{ ...baseSx, ...(sx || {}) }} {...rest}>
      {children}
    </ColorTemplate9TableDataBodyCell>
  );
}

function ColorTemplate9TableDataUiTestHeaderCell({ sx, children, ...rest }) {
  return (
    <Box sx={{ ...colorTemplate9TableUiTestHeaderCellSx(), ...(sx || {}) }} {...rest}>
      {typeof children === 'string' ? (
        <Typography sx={{ fontWeight: 'inherit', color: 'inherit', whiteSpace: 'nowrap' }}>{children}</Typography>
      ) : (
        children
      )}
    </Box>
  );
}

function ColorTemplate9TableDataUiTestLoopValue({ sx, children, ...rest }) {
  return (
    <Typography sx={{ ...colorTemplate9TableUiTestLoopValueSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Typography>
  );
}

function ColorTemplate9TableDataHeaderRow({ gridTemplateColumns, sx, children, ...rest }) {
  return (
    <Box
      sx={{
        ...colorTemplate9TableGridSx({ gridTemplateColumns }),
        ...colorTemplate9TableHeaderRowSx(),
        ...(sx || {})
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataHeaderCell({ columnIndex, sx, children, ...rest }) {
  const frozenSx = useFrozenColumnStickySx(columnIndex, { isHeader: true });
  return (
    <Box sx={{ ...colorTemplate9TableCellSx(), ...frozenSx, ...(sx || {}) }} {...rest}>
      {typeof children === 'string' ? (
        <Typography
          sx={{
            fontWeight: 'inherit',
            color: 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%'
          }}
        >
          {children}
        </Typography>
      ) : (
        children
      )}
    </Box>
  );
}

function ColorTemplate9TableDataBodyRow({ rowIndex = 0, gridTemplateColumns, sx, children, ...rest }) {
  const alternate = isAlternateTableRow(rowIndex);
  return (
    <TableBodyRowIndexContext.Provider value={rowIndex}>
      <Box
        className={alternate ? COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS : undefined}
        sx={{
          ...colorTemplate9TableGridSx({ gridTemplateColumns }),
          bgcolor: colorTemplate9TableRowBg(rowIndex),
          ...(alternate ? colorTemplate9AlternateRowContentSx() : null),
          ...(sx || {})
        }}
        {...rest}
      >
        {children}
      </Box>
    </TableBodyRowIndexContext.Provider>
  );
}

function ColorTemplate9TableDataBodyCell({ columnIndex, sx, children, ...rest }) {
  const frozenSx = useFrozenColumnStickySx(columnIndex, { isHeader: false });
  return (
    <Box sx={{ ...colorTemplate9TableCellSx(), ...frozenSx, ...(sx || {}) }} {...rest}>
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataBodyText({ sx, children, ...rest }) {
  return (
    <Typography sx={{ ...colorTemplate9TableBodyTextSx(), color: 'inherit', ...(sx || {}) }} {...rest}>
      {children}
    </Typography>
  );
}

function ColorTemplate9TableDataEmptyText({ sx, children, ...rest }) {
  return (
    <Typography sx={{ ...colorTemplate9TableBodyTextSx(), p: 2, ...(sx || {}) }} {...rest}>
      {children}
    </Typography>
  );
}

function ColorTemplate9TableDataEmptyRow({ sx, children, ...rest }) {
  return (
    <Box sx={{ ...colorTemplate9TableEmptyRowSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataFooterAction({ sx, children, ...rest }) {
  return (
    <Box
      data-color-template9-table=""
      sx={{ ...colorTemplate9TableFooterActionBarSx(), ...colorTemplate9TableDataScopeWithAlternateRowsSx(), ...(sx || {}) }}
      {...rest}
    >
      {children}
    </Box>
  );
}

function ColorTemplate9TableDataPrimaryActionButton({ sx, children, ...rest }) {
  return (
    <Button sx={{ ...colorTemplate9TablePrimaryActionButtonSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Button>
  );
}

/** Subheader strip above a nested table (e.g. duplicate group title). */
function ColorTemplate9TableDataGroupTitle({ sx, children, ...rest }) {
  return (
    <Typography sx={{ ...colorTemplate9TableGroupTitleSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Typography>
  );
}

ColorTemplate9TableDataPanel.propTypes = {
  fullWidth: PropTypes.bool,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataTitle.propTypes = {
  component: PropTypes.elementType,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataTabBar.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataTabButton.propTypes = {
  selected: PropTypes.bool,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataContent.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataTable.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node,
  topHorizontalScrollbar: PropTypes.bool,
  minTableWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  autoFitColumns: PropTypes.bool,
  frozenColumnCount: PropTypes.number,
  frozenColumnWidthsPx: PropTypes.arrayOf(PropTypes.number)
};
ColorTemplate9TableDataUiTestTable.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataUiTestHeaderRow.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataUiTestBodyRow.propTypes = {
  rowIndex: PropTypes.number,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataUiTestCell.propTypes = {
  action: PropTypes.bool,
  name: PropTypes.bool,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataUiTestLoopValue.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataUiTestHeaderCell.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataHeaderRow.propTypes = {
  gridTemplateColumns: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataHeaderCell.propTypes = {
  columnIndex: PropTypes.number,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataBodyRow.propTypes = {
  rowIndex: PropTypes.number,
  gridTemplateColumns: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataBodyCell.propTypes = {
  columnIndex: PropTypes.number,
  sx: PropTypes.object,
  children: PropTypes.node
};
ColorTemplate9TableDataBodyText.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataEmptyText.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataEmptyRow.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataFooterAction.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataPrimaryActionButton.propTypes = { sx: PropTypes.object, children: PropTypes.node };
ColorTemplate9TableDataButton.propTypes = {
  sx: PropTypes.object,
  variant: PropTypes.string,
  children: PropTypes.node
};
ColorTemplate9TableDataGroupTitle.propTypes = { sx: PropTypes.object, children: PropTypes.node };

const ColorTemplate9TableData = ColorTemplate9TableDataPanel;
ColorTemplate9TableData.Panel = ColorTemplate9TableDataPanel;
ColorTemplate9TableData.Title = ColorTemplate9TableDataTitle;
ColorTemplate9TableData.TabBar = ColorTemplate9TableDataTabBar;
ColorTemplate9TableData.TabButton = ColorTemplate9TableDataTabButton;
ColorTemplate9TableData.PanelDivider = ColorTemplate9TableDataPanelDivider;
ColorTemplate9TableData.Content = ColorTemplate9TableDataContent;
ColorTemplate9TableData.Table = ColorTemplate9TableDataTable;
ColorTemplate9TableData.UiTestTable = ColorTemplate9TableDataUiTestTable;
ColorTemplate9TableData.UiTestHeaderRow = ColorTemplate9TableDataUiTestHeaderRow;
ColorTemplate9TableData.UiTestHeaderCell = ColorTemplate9TableDataUiTestHeaderCell;
ColorTemplate9TableData.UiTestBodyRow = ColorTemplate9TableDataUiTestBodyRow;
ColorTemplate9TableData.UiTestCell = ColorTemplate9TableDataUiTestCell;
ColorTemplate9TableData.UiTestLoopValue = ColorTemplate9TableDataUiTestLoopValue;
ColorTemplate9TableData.HeaderRow = ColorTemplate9TableDataHeaderRow;
ColorTemplate9TableData.HeaderCell = ColorTemplate9TableDataHeaderCell;
ColorTemplate9TableData.BodyRow = ColorTemplate9TableDataBodyRow;
ColorTemplate9TableData.BodyCell = ColorTemplate9TableDataBodyCell;
ColorTemplate9TableData.BodyText = ColorTemplate9TableDataBodyText;
ColorTemplate9TableData.EmptyText = ColorTemplate9TableDataEmptyText;
ColorTemplate9TableData.EmptyRow = ColorTemplate9TableDataEmptyRow;
ColorTemplate9TableData.FooterAction = ColorTemplate9TableDataFooterAction;
ColorTemplate9TableData.PrimaryActionButton = ColorTemplate9TableDataPrimaryActionButton;
ColorTemplate9TableData.Button = ColorTemplate9TableDataButton;
ColorTemplate9TableData.GroupTitle = ColorTemplate9TableDataGroupTitle;
ColorTemplate9TableData.alternateRowContentClassName = COLOR_TEMPLATE9_ALTERNATE_ROW_CLASS;
ColorTemplate9TableData.alternateRowContentColor = COLOR_TEMPLATE9_ALTERNATE_ROW_CONTENT_COLOR;
ColorTemplate9TableData.alternateRowContentSx = colorTemplate9AlternateRowContentSx;
ColorTemplate9TableData.useAutoFitColumnWidths = useColorTemplate9AutoFitColumnWidths;
ColorTemplate9TableData.computeAutoFitColumnWidthsPx = computeColorTemplate9AutoFitColumnWidthsPx;
ColorTemplate9TableData.buildAutoFitGridTemplateColumns = buildColorTemplate9AutoFitGridTemplateColumns;
ColorTemplate9TableData.measureInCellButtonWidthPx = measureColorTemplate9InCellButtonWidthPx;
ColorTemplate9TableData.measureColumnButtonsMaxWidthPx = measureColorTemplate9ColumnButtonsMaxWidthPx;

export default ColorTemplate9TableData;
