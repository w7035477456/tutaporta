import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { fetchTodoItems, saveTodoItems } from 'api/monthlyBillFe';
import BillColumnButton from './BillColumnButton';
import BillReceiptsPopup from './BillReceiptsPopup';
import BillScheduleTutorialHeaderBar from './BillScheduleTutorialHeaderBar';
import TodoDoneBadge from './TodoDoneBadge';
import TodoDueDateButton, { localDateKey } from './TodoDueDateButton';
import SmsReminderButton from './SmsReminderButton';
import { attachDropToBillRow, readBillRowDrop } from './billRowDropAttach';
import { BILL_SCHEDULE_INK, billSchedulePanelRootSx } from './billScheduleTheme';

/** Swim lanes, left → right. `key` is the stored `todo_item.lane` value. Header = darker tone of the card colour. */
const LANES = [
  { key: 'repo', title: 'Todo Repository', headBg: '#d32f2f', cardBg: '#f28b82' },
  { key: 'scheduled', title: 'Todo Scheduled', headBg: '#fdd835', cardBg: '#fff59d' },
  { key: 'done', title: 'Todo Done', headBg: '#43a047', cardBg: '#9be37f' }
];
/** Drag id used while a new divider is dragged from one of the palette buttons above the lanes. */
const NEW_DIVIDER_ID = '__new_divider__';
const SAVE_DEBOUNCE_MS = 700;
const LANE_WIDTHS_LS_KEY = 'tutanotes.todo.laneWidths';
const MIN_LANE_PERCENT = 12;
const DEFAULT_LANE_WIDTHS = [100 / 3, 100 / 3, 100 / 3];

/** Lane widths in percent (sum 100), remembered per browser. */
function loadLaneWidths() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LANE_WIDTHS_LS_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((n) => Number.isFinite(n) && n >= MIN_LANE_PERCENT)) {
      const total = parsed.reduce((a, b) => a + b, 0);
      return parsed.map((n) => (n / total) * 100);
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANE_WIDTHS;
}

const laneResizeBarSx = {
  display: { xs: 'none', md: 'block' },
  flex: '0 0 auto',
  width: 8,
  mx: 0.5,
  alignSelf: 'stretch',
  position: 'relative',
  touchAction: 'none',
  cursor: 'col-resize',
  bgcolor: '#9e9e9e',
  borderRadius: 1,
  '&::after': {
    content: '""',
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 2,
    height: 36,
    borderRadius: 2,
    bgcolor: '#000'
  },
  '&:hover, &:active': { bgcolor: '#FFEB3B' }
};
const DRAG_MIME = 'application/x-tutanotes-todo';

let localIdCounter = 0;
function newLocalId() {
  localIdCounter += 1;
  return `todo-${Date.now()}-${localIdCounter}`;
}

/** Server rows (lane, seq) → flat client list; order within a lane is the sequence. */
function fromServer(items) {
  const sorted = [...(items || [])].sort(
    (a, b) => LANES.findIndex((l) => l.key === a.lane) - LANES.findIndex((l) => l.key === b.lane) || a.seq - b.seq
  );
  return sorted.map((it) => ({
    id: newLocalId(),
    kind: it.kind === 'divider' ? 'divider' : 'task',
    lane: it.lane,
    body: it.body ?? '',
    paidRecordId: Number(it.paid_record_id) || null,
    dueDate: it.due_date || null,
    smsReminderId: Number(it.sms_reminder_id) || null,
    doneAt: it.done_at || null,
    laneEnteredAt: it.lane_entered_at || null,
    hasContent: Boolean(it.has_bill_content)
  }));
}

/** Move `id` into `lane` before `beforeId` (null = end of lane). */
function moveItem(items, id, lane, beforeId) {
  if (id === beforeId) return items;
  const moving = items.find((it) => it.id === id);
  if (!moving) return items;
  const rest = items.filter((it) => it.id !== id);
  // Entering Todo Done stamps the completion time; leaving it clears the time.
  const doneAt = lane === 'done' && moving.kind !== 'divider' ? (moving.lane === 'done' ? moving.doneAt : new Date().toISOString()) : null;
  // Landing in a different lane restarts its day counter; reordering inside a lane keeps it.
  const laneEnteredAt = moving.lane === lane && moving.laneEnteredAt ? moving.laneEnteredAt : new Date().toISOString();
  const placed = { ...moving, lane, doneAt, laneEnteredAt };
  let at;
  if (beforeId) {
    at = rest.findIndex((it) => it.id === beforeId);
  } else {
    let lastInLane = -1;
    rest.forEach((it, i) => {
      if (it.lane === lane) lastInLane = i;
    });
    at = lastInLane + 1;
  }
  if (at < 0) at = rest.length;
  return [...rest.slice(0, at), placed, ...rest.slice(at)];
}

/** Whole calendar days between the local day `iso` falls on and the local day `todayKey` ('YYYY-MM-DD'). */
function daysInLane(iso, todayKey) {
  if (!iso) return 0;
  const entered = new Date(iso);
  if (Number.isNaN(entered.getTime())) return 0;
  const [y, m, d] = todayKey.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const enteredDay = new Date(entered.getFullYear(), entered.getMonth(), entered.getDate());
  return Math.max(0, Math.round((today - enteredDay) / 86400000));
}

const smallBtnSx = {
  width: 26,
  height: 26,
  p: 0,
  border: '2px solid #000',
  borderRadius: 0.5,
  bgcolor: '#fff',
  color: '#000',
  WebkitTextFillColor: '#000',
  fontSize: '0.8rem',
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  '&:disabled': { opacity: 0.3, cursor: 'default' },
  '&:hover:not(:disabled)': { filter: 'brightness(0.92)' }
};

/** Bill Schedule → ToDo: three swim lanes with drag-and-drop, inline edit, auto numbering. */
export default function BillScheduleTodoPanel({
  storageType = 'tutaCloud',
  videoTutorialUrl = '',
  onBillScheduleTutorialClick,
  headerRightAction = null
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('idle'); // idle | dirty | saving | saved | error
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { lane, beforeId|null }
  /** Task whose text is being edited (double-click a task, or a new task from + Add Todo). */
  const [editingId, setEditingId] = useState(null);
  /** Bills/Receipts popup for one task: { itemId, ensurePayload }. */
  const [receipts, setReceipts] = useState(null);
  const [attachingId, setAttachingId] = useState(null);
  const [laneWidths, setLaneWidths] = useState(loadLaneWidths);
  const boardRef = useRef(null);
  /** Today's local date; refreshed each minute so past-due blinking starts at midnight. */
  const [todayKey, setTodayKey] = useState(localDateKey);
  useEffect(() => {
    const t = setInterval(() => setTodayKey(localDateKey()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  /** Storage the current `items` were loaded from — saves always go back there. */
  const loadedStorageRef = useRef(null);
  /** Saves run one at a time so an older full-replace never lands after a newer one. */
  const saveChainRef = useRef(Promise.resolve());

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current || !loadedStorageRef.current) return saveChainRef.current;
    dirtyRef.current = false;
    const snapshot = itemsRef.current.map((it) => ({
      kind: it.kind === 'divider' ? 'divider' : 'task',
      lane: it.lane,
      body: it.body,
      paid_record_id: it.paidRecordId || null,
      due_date: it.dueDate || null,
      sms_reminder_id: it.smsReminderId || null,
      done_at: it.doneAt || null,
      lane_entered_at: it.laneEnteredAt || null
    }));
    const storage = loadedStorageRef.current;
    setSaveState('saving');
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        await saveTodoItems(snapshot, { storageType: storage });
        setSaveState(dirtyRef.current ? 'dirty' : 'saved');
        setError('');
      } catch (err) {
        dirtyRef.current = true;
        setSaveState('error');
        setError(err?.response?.data?.error || err?.message || 'Save failed');
      }
    });
    return saveChainRef.current;
  }, []);

  /** Apply a change and schedule an autosave. */
  const commit = useCallback(
    (updater) => {
      setItems((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        itemsRef.current = next;
        return next;
      });
      dirtyRef.current = true;
      setSaveState('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    loadedStorageRef.current = null;
    setItems([]);
    itemsRef.current = [];
    // Wait for any pending save of the previous storage before reading this one.
    saveChainRef.current
      .then(() => fetchTodoItems({ storageType }))
      .then((data) => {
        if (cancelled) return;
        loadedStorageRef.current = storageType;
        const next = fromServer(data?.items);
        itemsRef.current = next;
        setItems(next);
        dirtyRef.current = false;
        setSaveState('idle');
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Could not load ToDo list');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storageType]);

  // Save any pending edit when leaving the panel / switching storage (runs before the next load).
  useEffect(() => () => void flushSave(), [flushSave, storageType]);

  const addTodo = () => {
    const id = newLocalId();
    commit((prev) =>
      moveItem(
        [
          ...prev,
          {
            id,
            kind: 'task',
            lane: 'repo',
            body: '',
            paidRecordId: null,
            dueDate: null,
            doneAt: null,
            laneEnteredAt: new Date().toISOString(),
            hasContent: false
          }
        ],
        id,
        'repo',
        null
      )
    );
    setEditingId(id);
  };

  const updateBody = (id, body) => commit((prev) => prev.map((it) => (it.id === id ? { ...it, body } : it)));
  const setDoneAt = (id, doneAt) => commit((prev) => prev.map((it) => (it.id === id ? { ...it, doneAt } : it)));
  const setDueDate = (id, dueDate) => commit((prev) => prev.map((it) => (it.id === id ? { ...it, dueDate } : it)));
  const setSmsReminder = (id, smsReminderId) =>
    commit((prev) => prev.map((it) => (it.id === id ? { ...it, smsReminderId } : it)));
  const removeItem = (id) => commit((prev) => prev.filter((it) => it.id !== id));

  /** Popup / drop reported the task's Bills/Receipts record — link it (saves when the link is new). */
  const applyReceipt = (itemId, data) => {
    if (!data?.paidRecordId) return;
    const current = itemsRef.current.find((it) => it.id === itemId);
    if (!current) return;
    const patch = (prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, paidRecordId: data.paidRecordId, hasContent: Boolean(data.hasBillContent) } : it));
    if (Number(current.paidRecordId) !== Number(data.paidRecordId)) {
      commit(patch);
    } else {
      setItems((prev) => {
        const next = patch(prev);
        itemsRef.current = next;
        return next;
      });
    }
  };

  const receiptPayload = (item) => ({ kind: 'todo', paid_record_id: item.paidRecordId || undefined });

  const openReceipts = (item) => {
    if (!loadedStorageRef.current) return;
    setReceipts({ itemId: item.id, ensurePayload: receiptPayload(item) });
  };

  const closeReceipts = () => setReceipts(null);

  /** Drop Mobile Upload photos / computer files on a task's paperclip to attach without opening the popup. */
  const dropAttach = async (item, dataTransfer) => {
    const dropped = readBillRowDrop(dataTransfer);
    if (!dropped.mobileUploadNames.length && !dropped.files.length) return;
    if (!loadedStorageRef.current) return;
    setAttachingId(item.id);
    try {
      const result = await attachDropToBillRow(receiptPayload(item), loadedStorageRef.current, dropped);
      if (result.record) applyReceipt(item.id, result.record);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to attach file');
    } finally {
      setAttachingId(null);
    }
  };

  /** Drag the bar between lane `i` and `i + 1`; the two neighbours trade width. */
  const startLaneResize = (i, event) => {
    event.preventDefault();
    event.stopPropagation();
    const board = boardRef.current;
    if (!board) return;
    const boardWidth = board.getBoundingClientRect().width;
    if (boardWidth <= 0) return;
    const startX = event.clientX;
    const start = laneWidths;
    const pair = start[i] + start[i + 1];
    let latest = start;
    const onMove = (moveEvent) => {
      const deltaPct = ((moveEvent.clientX - startX) / boardWidth) * 100;
      const left = Math.min(pair - MIN_LANE_PERCENT, Math.max(MIN_LANE_PERCENT, start[i] + deltaPct));
      latest = start.map((w, k) => (k === i ? left : k === i + 1 ? pair - left : w));
      setLaneWidths(latest);
    };
    const onUp = () => {
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try {
        localStorage.setItem(LANE_WIDTHS_LS_KEY, JSON.stringify(latest));
      } catch {
        // ignore
      }
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, id);
    e.dataTransfer.setData('text/plain', itemsRef.current.find((it) => it.id === id)?.body || '');
    // Same drag ghost as the notebook / note sidebar: a full-opacity clone of the card that
    // follows the pointer from the exact spot it was grabbed.
    const card = e.currentTarget;
    if (card && typeof e.dataTransfer.setDragImage === 'function') {
      try {
        const rect = card.getBoundingClientRect();
        const clone = card.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.top = '-10000px';
        clone.style.left = '-10000px';
        clone.style.margin = '0';
        clone.style.transform = 'none';
        clone.style.setProperty('width', `${rect.width}px`, 'important');
        clone.style.setProperty('height', `${rect.height}px`, 'important');
        clone.style.boxSizing = 'border-box';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '1';
        clone.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';
        document.body.appendChild(clone);
        const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const offsetY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        e.dataTransfer.setDragImage(clone, offsetX, offsetY);
        window.setTimeout(() => clone.remove(), 0);
      } catch {
        // Fall back to the browser's default drag image.
      }
    }
  };

  const endDrag = () => {
    setDragId(null);
    setDropTarget(null);
  };

  const handleCardDragOver = (e, lane, id) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    let beforeId = id;
    if (after) {
      const laneItems = itemsRef.current.filter((it) => it.lane === lane);
      const idx = laneItems.findIndex((it) => it.id === id);
      beforeId = laneItems[idx + 1]?.id ?? null;
    }
    if (dropTarget?.lane !== lane || dropTarget?.beforeId !== beforeId) setDropTarget({ lane, beforeId });
  };

  const handleLaneDragOver = (e, lane) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget?.lane !== lane) setDropTarget({ lane, beforeId: null });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragId || e.dataTransfer.getData(DRAG_MIME);
    if (id === NEW_DIVIDER_ID && dropTarget) {
      const dividerId = newLocalId();
      const divider = {
        id: dividerId,
        kind: 'divider',
        lane: dropTarget.lane,
        body: '',
        paidRecordId: null,
        dueDate: null,
        doneAt: null,
        laneEnteredAt: new Date().toISOString(),
        hasContent: false
      };
      commit((prev) => moveItem([...prev, divider], dividerId, dropTarget.lane, dropTarget.beforeId));
    } else if (id && dropTarget) {
      commit((prev) => moveItem(prev, id, dropTarget.lane, dropTarget.beforeId));
    }
    endDrag();
  };

  /** Palette button: drag it into any lane to add a dashed divider there (as many as you like). */
  const dividerPaletteButton = (lane) => (
    <Box
      key={`divider-palette-${lane.key}`}
      component="button"
      type="button"
      draggable={!loading && Boolean(loadedStorageRef.current)}
      disabled={loading || !loadedStorageRef.current}
      onDragStart={(e) => {
        setDragId(NEW_DIVIDER_ID);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DRAG_MIME, NEW_DIVIDER_ID);
      }}
      onDragEnd={endDrag}
      aria-label="Divider — drag into a lane"
      title="Drag into a lane to add a divider"
      sx={{
        border: '3px solid #000',
        borderRadius: 1,
        bgcolor: lane.headBg,
        px: 1.5,
        height: 38,
        minWidth: 110,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        flexShrink: 0,
        '&:active': { cursor: 'grabbing' },
        '&:hover:not(:disabled)': { filter: 'brightness(1.08)' },
        '&:disabled': { opacity: 0.5, cursor: 'default' }
      }}
    >
      <Box aria-hidden sx={{ width: 80, borderTop: '4px dashed #000' }} />
    </Box>
  );

  const dropLine = <Box aria-hidden sx={{ height: 0, borderTop: '4px solid #e60000', borderRadius: 2, my: -0.25, flexShrink: 0 }} />;

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'dirty'
        ? 'Unsaved changes…'
        : saveState === 'saved'
          ? 'Saved'
          : saveState === 'error'
            ? 'Save failed — will retry on next change'
            : '';

  return (
    <Box
      sx={{
        ...billSchedulePanelRootSx,
        fontFamily: MAIN_FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%'
      }}
    >
      <BillScheduleTutorialHeaderBar
        videoTutorialUrl={videoTutorialUrl}
        onTutorialClick={onBillScheduleTutorialClick}
        rightAction={headerRightAction}
      />
      {/* Toolbar row mirrors the lane widths so each divider button sits above its own lane. */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1, md: 0 }, mb: 1.5 }}>
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: `${laneWidths[0]} 1 0` },
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap'
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', color: BILL_SCHEDULE_INK }}>ToDo</Typography>
          <Box
            component="button"
            type="button"
            onClick={addTodo}
            disabled={loading || (!!error && !loadedStorageRef.current)}
            sx={{
              border: '3px solid #000',
              borderRadius: 1,
              bgcolor: '#60C446',
              color: '#000',
              WebkitTextFillColor: '#000',
              fontFamily: MAIN_FONT_FAMILY,
              fontWeight: 900,
              fontSize: '1.15rem',
              px: 2,
              py: 0.5,
              cursor: 'pointer',
              '&:hover:not(:disabled)': { filter: 'brightness(1.08)' },
              '&:disabled': { opacity: 0.5, cursor: 'default' }
            }}
          >
            + Add Todo
          </Box>
          {dividerPaletteButton(LANES[0])}
          {saveLabel ? (
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: BILL_SCHEDULE_INK, opacity: 0.75 }}>{saveLabel}</Typography>
          ) : null}
          {error ? (
            <Typography
              sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#e60000 !important', WebkitTextFillColor: '#e60000 !important' }}
            >
              {error}
            </Typography>
          ) : null}
        </Box>
        {LANES.slice(1).map((lane, k) => (
          <Fragment key={`toolbar-${lane.key}`}>
            {/* Same footprint as the lane resize bar (8px + 2 × 4px margin). */}
            <Box aria-hidden sx={{ display: { xs: 'none', md: 'block' }, flex: '0 0 16px' }} />
            <Box
              sx={{
                flex: { xs: '1 1 auto', md: `${laneWidths[k + 1]} 1 0` },
                minWidth: 0,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {dividerPaletteButton(lane)}
            </Box>
          </Fragment>
        ))}
      </Box>

      <Box
        ref={boardRef}
        sx={{
          flex: 1,
          minHeight: 360,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 2, md: 0 }
        }}
      >
        {LANES.map((lane, laneIndex) => {
          const laneItems = items.filter((it) => it.lane === lane.key);
          const taskCount = laneItems.filter((it) => it.kind !== 'divider').length;
          // Task numbers skip dividers (1, 2, 3 … across the whole lane).
          const taskNumber = new Map();
          laneItems.forEach((it) => {
            if (it.kind !== 'divider') taskNumber.set(it.id, taskNumber.size + 1);
          });
          const isTargetLane = dropTarget?.lane === lane.key;
          return (
            <Fragment key={lane.key}>
              {laneIndex > 0 ? (
                <Box
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${LANES[laneIndex - 1].title} / ${lane.title}`}
                  title="Drag left or right to resize"
                  onMouseDown={(e) => startLaneResize(laneIndex - 1, e)}
                  sx={laneResizeBarSx}
                />
              ) : null}
              <Box
                aria-label={lane.title}
                onDragOver={(e) => handleLaneDragOver(e, lane.key)}
                onDrop={handleDrop}
                sx={{
                  flex: { xs: '1 1 auto', md: `${laneWidths[laneIndex]} 1 0` },
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  border: '3px solid #000',
                  borderRadius: 1,
                  bgcolor: '#fff',
                  outline: isTargetLane ? '3px dashed #e60000' : 'none',
                  outlineOffset: 2
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 0.75,
                    bgcolor: lane.headBg,
                    borderBottom: '3px solid #000'
                  }}
                >
                  <Typography
                    sx={{ fontWeight: 900, fontSize: '1.15rem', color: '#000 !important', WebkitTextFillColor: '#000 !important' }}
                  >
                    {lane.title}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#000 !important', WebkitTextFillColor: '#000 !important' }}
                  >
                    {taskCount}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 120, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {loading ? (
                    <Typography sx={{ color: '#555 !important', WebkitTextFillColor: '#555 !important', fontWeight: 700 }}>
                      Loading…
                    </Typography>
                  ) : null}
                  {!loading && !laneItems.length ? (
                    <Typography
                      sx={{ color: '#777 !important', WebkitTextFillColor: '#777 !important', fontSize: '0.9rem', fontStyle: 'italic' }}
                    >
                      {lane.key === 'repo' ? 'Click “+ Add Todo” to create a task.' : 'Drag tasks here.'}
                    </Typography>
                  ) : null}
                  {laneItems.map((item) => {
                    const index = (taskNumber.get(item.id) || 1) - 1;
                    const before = isTargetLane && dropTarget.beforeId === item.id && dragId !== item.id ? dropLine : null;
                    if (item.kind === 'divider') {
                      return (
                        <Box key={item.id} sx={{ display: 'contents' }}>
                          {before}
                          <Box
                            data-todo-divider
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragEnd={endDrag}
                            onDragOver={(e) => handleCardDragOver(e, lane.key, item.id)}
                            onDrop={handleDrop}
                            title="Divider — drag to move · X to delete"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              minHeight: 30,
                              px: 0.5,
                              opacity: dragId === item.id ? 0.45 : 1,
                              cursor: 'grab',
                              userSelect: 'none',
                              '&:active': { cursor: 'grabbing' }
                            }}
                          >
                            <Box aria-hidden sx={{ flex: 1, borderTop: '5px dashed #000' }} />
                            <Box
                              component="button"
                              type="button"
                              aria-label="Delete divider"
                              title="Delete divider"
                              onClick={() => removeItem(item.id)}
                              sx={{ ...smallBtnSx, bgcolor: '#e60000', fontSize: '0.9rem' }}
                            >
                              X
                            </Box>
                          </Box>
                        </Box>
                      );
                    }
                    return (
                      <Box key={item.id} sx={{ display: 'contents' }}>
                        {before}
                        <Box
                          data-todo-card
                          // Grab anywhere on the card to drag (not while its text is being edited).
                          draggable={editingId !== item.id}
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          onDragEnd={endDrag}
                          onDragOver={(e) => handleCardDragOver(e, lane.key, item.id)}
                          onDrop={handleDrop}
                          title={editingId === item.id ? undefined : 'Drag to move or reorder · double-click text to edit'}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 0.75,
                            p: 0.75,
                            border: dragId === item.id ? '2px dashed #000' : '2px solid #000',
                            borderRadius: 1,
                            bgcolor: lane.cardBg,
                            opacity: dragId === item.id ? 0.45 : 1,
                            cursor: editingId === item.id ? 'default' : 'grab',
                            userSelect: editingId === item.id ? 'auto' : 'none',
                            '&:active': editingId === item.id ? undefined : { cursor: 'grabbing' }
                          }}
                        >
                          <Box
                            aria-label={`Task ${index + 1}`}
                            sx={{
                              flexShrink: 0,
                              minWidth: 34,
                              height: 30,
                              px: 0.5,
                              borderRadius: 0.75,
                              bgcolor: '#000',
                              color: '#fff !important',
                              WebkitTextFillColor: '#fff !important',
                              fontWeight: 900,
                              fontSize: '0.95rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              userSelect: 'none'
                            }}
                          >
                            {index + 1}
                          </Box>
                          {editingId === item.id ? (
                            <InputBase
                              multiline
                              fullWidth
                              autoFocus
                              value={item.body}
                              placeholder="Type a task…"
                              onFocus={(e) => {
                                const el = e.target;
                                el.setSelectionRange?.(el.value.length, el.value.length);
                              }}
                              onChange={(e) => updateBody(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                // Enter finishes (Shift+Enter = new line); Esc also finishes.
                                if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
                                  e.preventDefault();
                                  e.currentTarget.querySelector('textarea')?.blur();
                                  e.target.blur?.();
                                }
                              }}
                              onBlur={() => {
                                setEditingId((cur) => (cur === item.id ? null : cur));
                                void flushSave();
                              }}
                              inputProps={{ 'aria-label': `${lane.title} task ${index + 1}`, maxLength: 4000 }}
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                fontFamily: MAIN_FONT_FAMILY,
                                fontSize: '1rem',
                                fontWeight: 600,
                                py: 0.25,
                                px: 0.5,
                                bgcolor: '#fff',
                                border: '2px solid #1565c0',
                                borderRadius: 0.5,
                                '& textarea': {
                                  color: '#000',
                                  WebkitTextFillColor: '#000'
                                }
                              }}
                            />
                          ) : (
                            <Typography
                              onDoubleClick={() => setEditingId(item.id)}
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                py: 0.5,
                                fontFamily: MAIN_FONT_FAMILY,
                                fontSize: '1rem',
                                fontWeight: 600,
                                lineHeight: 1.35,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                color: item.body ? '#000 !important' : '#555 !important',
                                WebkitTextFillColor: item.body ? '#000 !important' : '#555 !important',
                                fontStyle: item.body ? 'normal' : 'italic',
                                textDecoration: lane.key === 'done' && item.body ? 'line-through' : 'none'
                              }}
                            >
                              {item.body || 'Double-click to type a task…'}
                            </Typography>
                          )}
                          {/* Icon row: [DONE] · day counter · due date · paperclip — one centred line. */}
                          <Box sx={{ flexShrink: 0, alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            {lane.key === 'done' ? (
                              <TodoDoneBadge value={item.doneAt} onChange={(next) => setDoneAt(item.id, next)} />
                            ) : (
                              <SmsReminderButton
                                kind="todo"
                                reminderId={item.smsReminderId}
                                label={item.body || ''}
                                dueYmd={item.dueDate}
                                onChange={(next) => setSmsReminder(item.id, next)}
                              />
                            )}
                            {(() => {
                              const days = daysInLane(item.laneEnteredAt, todayKey);
                              const label = `${days} day${days === 1 ? '' : 's'} in ${lane.title}`;
                              return (
                                <Box
                                  aria-label={label}
                                  title={label}
                                  sx={{
                                    flexShrink: 0,
                                    minWidth: 30,
                                    height: 30,
                                    px: days > 99 ? 0.5 : 0,
                                    borderRadius: 999,
                                    border: '2px solid #000',
                                    bgcolor: '#fff',
                                    color: '#000 !important',
                                    WebkitTextFillColor: '#000 !important',
                                    fontFamily: MAIN_FONT_FAMILY,
                                    fontWeight: 800,
                                    fontSize: '0.95rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    userSelect: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  {days}
                                </Box>
                              );
                            })()}
                            <TodoDueDateButton
                              value={item.dueDate}
                              // Past due blinks — except in Todo Done; never set (grey) never blinks.
                              blink={Boolean(item.dueDate) && item.dueDate < todayKey && lane.key !== 'done'}
                              onChange={(next) => setDueDate(item.id, next)}
                            />
                            <Box sx={{ flexShrink: 0, display: 'flex' }}>
                              <BillColumnButton
                                hasContent={item.hasContent}
                                borderColor="#000"
                                disabled={attachingId === item.id}
                                title={item.hasContent ? 'Open attachments / notes' : 'Attach a document or add notes'}
                                onClick={() => openReceipts(item)}
                                onDropAttach={(dataTransfer) => void dropAttach(item, dataTransfer)}
                              />
                            </Box>
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            aria-label="Delete task"
                            title="Delete task"
                            onClick={() => removeItem(item.id)}
                            sx={{ ...smallBtnSx, bgcolor: '#e60000', fontSize: '0.9rem' }}
                          >
                            X
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                  {isTargetLane && dropTarget.beforeId === null && laneItems.length ? dropLine : null}
                </Box>
              </Box>
            </Fragment>
          );
        })}
      </Box>

      {receipts ? (
        <BillReceiptsPopup
          open
          storageType={loadedStorageRef.current === 'usb' ? 'usb' : 'tutaCloud'}
          ensurePayload={receipts.ensurePayload}
          onClose={closeReceipts}
          onMarkPaid={closeReceipts}
          onCancel={closeReceipts}
          onChanged={(data) => applyReceipt(receipts.itemId, data)}
        />
      ) : null}
    </Box>
  );
}

BillScheduleTodoPanel.propTypes = {
  storageType: PropTypes.string,
  videoTutorialUrl: PropTypes.string,
  onBillScheduleTutorialClick: PropTypes.func,
  headerRightAction: PropTypes.node
};
