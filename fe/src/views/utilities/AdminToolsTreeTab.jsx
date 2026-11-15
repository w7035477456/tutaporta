import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  adminStorageTreeFileUrl,
  fetchAdminStorageTree,
  fetchAdminStorageTreeFileHead,
  fetchAdminStorageTreeFiles
} from 'api/adminToolsFe';

/** Folders shallower than this start expanded. */
const DEFAULT_EXPAND_DEPTH = 3;
const INDENT_CH = 2.5;

const terminalSx = {
  m: 0,
  p: 1,
  height: 'calc(100vh - 340px)',
  minHeight: 320,
  overflowY: 'scroll',
  overflowX: 'hidden',
  bgcolor: '#000',
  color: '#3f3',
  border: '1px solid #333',
  fontFamily: 'monospace',
  fontSize: '0.68rem',
  lineHeight: 1.35,
  scrollbarWidth: 'auto',
  scrollbarColor: '#fc0 #222',
  '&::-webkit-scrollbar': { width: 12 },
  '&::-webkit-scrollbar-track': { background: '#222' },
  '&::-webkit-scrollbar-thumb': { background: '#fc0', borderRadius: 2 }
};

const pathLabelSx = {
  fontFamily: 'monospace',
  fontSize: '0.72rem',
  lineHeight: 1.3,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-all',
  opacity: 0.85
};

const rowSx = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover': { bgcolor: '#1a3a1a' }
};

const fileRowSx = { ...rowSx, color: '#9ef', '&:hover': { bgcolor: '#123' } };

/** Alternating block colors for adjacent folders under `users/`. */
const USER_STRIPE_SX = [
  {
    bgcolor: 'rgba(20, 70, 20, 0.35)',
    color: '#3f3',
    borderLeft: '2px solid #2a2',
    my: 0.25,
    py: 0.15
  },
  {
    bgcolor: 'rgba(20, 45, 90, 0.4)',
    color: '#6cf',
    borderLeft: '2px solid #48a',
    my: 0.25,
    py: 0.15
  }
];

/** Per-panel cycle: original order → largest users first → smallest users first. */
const USER_SORT_MODES = ['orig', 'desc', 'asc'];
const USER_SORT_LABEL = { orig: 'Size', desc: 'Size Desc', asc: 'Size Asc' };
const USER_SORT_TITLE = {
  orig: 'Original order — click for largest users first',
  desc: 'Largest users first — click for smallest users first',
  asc: 'Smallest users first — click for original order'
};

function nextUserSortMode(mode) {
  const i = USER_SORT_MODES.indexOf(mode);
  return USER_SORT_MODES[(i < 0 ? 0 : i + 1) % USER_SORT_MODES.length];
}

function sortedUserChildren(children, mode) {
  if (!children?.length || mode === 'orig') return children || [];
  const copy = [...children];
  copy.sort((a, b) => {
    const diff = (a.totalBytes || 0) - (b.totalBytes || 0);
    return mode === 'asc' ? diff : -diff;
  });
  return copy;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

function findUsersNode(node) {
  if (!node) return null;
  if (node.name === 'users') return node;
  for (const child of node.children || []) {
    const found = findUsersNode(child);
    if (found) return found;
  }
  return null;
}

function usersPageCount(total, pageSize) {
  return Math.max(1, Math.ceil((total || 0) / pageSize));
}

function visiblePageNumbers(page, pageCount, maxButtons = 5) {
  if (pageCount <= maxButtons) return Array.from({ length: pageCount }, (_, i) => i + 1);
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = start + maxButtons - 1;
  if (end > pageCount) {
    end = pageCount;
    start = Math.max(1, end - maxButtons + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const pagerBtnSx = {
  minHeight: 22,
  minWidth: 28,
  py: 0.15,
  px: 0.6,
  fontSize: '0.65rem',
  lineHeight: 1.2
};

const pagerBtnActiveSx = {
  ...pagerBtnSx,
  bgcolor: '#1a4a9a !important',
  color: '#fff !important',
  borderColor: '#48f !important'
};

function PageNavButtons({ keyPrefix, pages, safePage, pageCount, onPageChange }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
      {pages.map((n) => (
        <ColorTemplate9TableData.Button
          key={`${keyPrefix}${n}`}
          type="button"
          onClick={() => onPageChange(n)}
          sx={safePage === n ? pagerBtnActiveSx : pagerBtnSx}
        >
          {n}
        </ColorTemplate9TableData.Button>
      ))}
      <ColorTemplate9TableData.Button
        type="button"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(safePage + 1)}
        sx={pagerBtnSx}
      >
        &gt;
      </ColorTemplate9TableData.Button>
      <ColorTemplate9TableData.Button
        type="button"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(pageCount)}
        sx={pagerBtnSx}
      >
        LAST
      </ColorTemplate9TableData.Button>
    </Box>
  );
}

PageNavButtons.propTypes = {
  keyPrefix: PropTypes.string.isRequired,
  pages: PropTypes.arrayOf(PropTypes.number).isRequired,
  safePage: PropTypes.number.isRequired,
  pageCount: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired
};

function UsersPager({ totalUsers, page, pageSize, onPageChange, onPageSizeChange }) {
  if (!totalUsers) return null;
  const pageCount = usersPageCount(totalUsers, pageSize);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pages = visiblePageNumbers(safePage, pageCount);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalUsers);
  const navProps = { pages, safePage, pageCount, onPageChange };
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        flexWrap: 'wrap',
        minHeight: 28,
        width: '100%'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
        <ColorTemplate9TableData.BodyText sx={{ ...pathLabelSx, opacity: 0.75, fontSize: '0.65rem' }}>
          {from}–{to} of {totalUsers} users · page {safePage}/{pageCount}
        </ColorTemplate9TableData.BodyText>
        <PageNavButtons keyPrefix="L" {...navProps} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 'auto' }}>
        <PageNavButtons keyPrefix="R" {...navProps} />
        {PAGE_SIZE_OPTIONS.map((n) => (
          <ColorTemplate9TableData.Button
            key={n}
            type="button"
            onClick={() => onPageSizeChange(n)}
            sx={pageSize === n ? pagerBtnActiveSx : pagerBtnSx}
          >
            {n}
          </ColorTemplate9TableData.Button>
        ))}
      </Box>
    </Box>
  );
}

UsersPager.propTypes = {
  totalUsers: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired
};

function collectDefaultExpanded(node, depth, out) {
  if (!node) return out;
  if (depth < DEFAULT_EXPAND_DEPTH) out.add(node.path);
  for (const child of node.children || []) collectDefaultExpanded(child, depth + 1, out);
  return out;
}

function collectAllPaths(node, out) {
  if (!node) return out;
  out.add(node.path);
  for (const child of node.children || []) collectAllPaths(child, out);
  return out;
}

function filePath(folderPath, name) {
  return folderPath ? `${folderPath}/${name}` : name;
}

function FolderNode({
  node,
  depth,
  rootKey,
  expanded,
  onToggle,
  filesByPath,
  onOpenFile,
  onLoadFiles,
  isRoot = false,
  userStripeIndex = null,
  userSortMode = 'orig',
  userPage = 1,
  userPageSize = DEFAULT_PAGE_SIZE
}) {
  const isOpen = expanded.has(node.path);
  const hasContent = node.children.length > 0 || node.fileCount > 0;
  const files = filesByPath[node.path];
  const marker = hasContent ? (isOpen ? '▾' : '▸') : ' ';
  const folderTotal = node.totalLabel || '';
  const showTotal = folderTotal && (isRoot || (node.totalBytes || 0) > 0);
  const stripeSx = userStripeIndex == null ? null : USER_STRIPE_SX[userStripeIndex % 2];
  let childList = node.children;
  if (node.name === 'users') {
    const sorted = sortedUserChildren(node.children, userSortMode);
    const pageCount = usersPageCount(sorted.length, userPageSize);
    const safePage = Math.min(Math.max(1, userPage), pageCount);
    const start = (safePage - 1) * userPageSize;
    childList = sorted.slice(start, start + userPageSize);
  }
  const content = (
    <>
      <Box sx={{ ...rowSx, pl: `${depth * INDENT_CH}ch` }} onClick={() => onToggle(rootKey, node)}>
        {`${marker} ${isRoot ? '' : '|-- '}${node.name}/`}
        {showTotal ? `  (total=${folderTotal})` : ''}
        {node.fileCount > 0 ? `  (${node.fileCount} files)` : ''}
      </Box>
      {isOpen ? (
        <>
          {childList.map((child, i) => (
            <FolderNode
              key={child.path}
              node={child}
              depth={depth + 1}
              rootKey={rootKey}
              expanded={expanded}
              onToggle={onToggle}
              filesByPath={filesByPath}
              onOpenFile={onOpenFile}
              onLoadFiles={onLoadFiles}
              userStripeIndex={node.name === 'users' ? i : null}
              userSortMode={userSortMode}
              userPage={userPage}
              userPageSize={userPageSize}
            />
          ))}
          {node.fileCount > 0 && files === undefined ? (
            <Box sx={{ ...fileRowSx, pl: `${(depth + 1) * INDENT_CH}ch`, opacity: 0.8 }} onClick={() => onLoadFiles(rootKey, node.path)}>
              {`  · list ${node.fileCount} files…`}
            </Box>
          ) : null}
          {node.fileCount > 0 && files === 'loading' ? (
            <Box sx={{ pl: `${(depth + 1) * INDENT_CH}ch`, opacity: 0.7 }}>loading files…</Box>
          ) : null}
          {typeof files === 'string' && files !== 'loading' ? (
            <Box sx={{ pl: `${(depth + 1) * INDENT_CH}ch`, color: '#f66' }}>{files}</Box>
          ) : null}
          {Array.isArray(files)
            ? files.map((file) => (
                <Box
                  key={file.name}
                  sx={{ ...fileRowSx, pl: `${(depth + 1) * INDENT_CH}ch` }}
                  onClick={() => onOpenFile(rootKey, filePath(node.path, file.name), file)}
                >
                  {`  · ${file.name}  (${file.sizeLabel})`}
                </Box>
              ))
            : null}
        </>
      ) : null}
    </>
  );
  return stripeSx ? <Box sx={stripeSx}>{content}</Box> : content;
}

const treeNodeShape = PropTypes.shape({
  name: PropTypes.string,
  path: PropTypes.string,
  fileCount: PropTypes.number,
  totalBytes: PropTypes.number,
  totalLabel: PropTypes.string,
  children: PropTypes.array
});

FolderNode.propTypes = {
  node: treeNodeShape.isRequired,
  depth: PropTypes.number.isRequired,
  rootKey: PropTypes.string.isRequired,
  expanded: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
  filesByPath: PropTypes.object.isRequired,
  onOpenFile: PropTypes.func.isRequired,
  onLoadFiles: PropTypes.func.isRequired,
  isRoot: PropTypes.bool,
  userStripeIndex: PropTypes.number,
  userSortMode: PropTypes.oneOf(USER_SORT_MODES),
  userPage: PropTypes.number,
  userPageSize: PropTypes.number
};

function TreePanel({
  data,
  expanded,
  onToggle,
  filesByPath,
  onOpenFile,
  onLoadFiles,
  onExpandAll,
  onCollapseAll,
  userSortMode,
  onCycleUserSort,
  userPage,
  userPageSize,
  onUserPageChange,
  onUserPageSizeChange
}) {
  const btnSx = { minHeight: 24, py: 0.25, px: 1, fontSize: '0.7rem' };
  const usersNode = findUsersNode(data?.tree);
  const totalUsers = usersNode?.children?.length || 0;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0, gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <ColorTemplate9TableData.BodyText sx={{ ...pathLabelSx, flex: '1 1 0', minWidth: 0 }}>
          {data?.envVar}: {data?.root || '(not set)'}
        </ColorTemplate9TableData.BodyText>
        {data?.tree ? (
          <>
            <ColorTemplate9TableData.Button type="button" onClick={onCycleUserSort} title={USER_SORT_TITLE[userSortMode]} sx={btnSx}>
              {USER_SORT_LABEL[userSortMode]}
            </ColorTemplate9TableData.Button>
            <ColorTemplate9TableData.Button type="button" onClick={onExpandAll} sx={btnSx}>
              Expand all
            </ColorTemplate9TableData.Button>
            <ColorTemplate9TableData.Button type="button" onClick={onCollapseAll} sx={btnSx}>
              Collapse all
            </ColorTemplate9TableData.Button>
          </>
        ) : null}
      </Box>
      <UsersPager
        totalUsers={totalUsers}
        page={userPage}
        pageSize={userPageSize}
        onPageChange={onUserPageChange}
        onPageSizeChange={onUserPageSizeChange}
      />
      <Box sx={terminalSx}>
        {data?.error ? <Box sx={{ color: '#f66' }}>{data.error}</Box> : null}
        {data?.tree ? (
          <FolderNode
            node={data.tree}
            depth={0}
            rootKey={data.rootKey}
            expanded={expanded}
            onToggle={onToggle}
            filesByPath={filesByPath}
            onOpenFile={onOpenFile}
            onLoadFiles={onLoadFiles}
            isRoot
            userSortMode={userSortMode}
            userPage={userPage}
            userPageSize={userPageSize}
          />
        ) : null}
        {data?.truncated ? <Box sx={{ color: '#fc0' }}>{`... stopped after ${data.maxFolders} folders`}</Box> : null}
      </Box>
    </Box>
  );
}

TreePanel.propTypes = {
  data: PropTypes.shape({
    rootKey: PropTypes.string,
    envVar: PropTypes.string,
    root: PropTypes.string,
    tree: treeNodeShape,
    totalLabel: PropTypes.string,
    truncated: PropTypes.bool,
    maxFolders: PropTypes.number,
    error: PropTypes.string
  }),
  expanded: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
  filesByPath: PropTypes.object.isRequired,
  onOpenFile: PropTypes.func.isRequired,
  onLoadFiles: PropTypes.func.isRequired,
  onExpandAll: PropTypes.func.isRequired,
  onCollapseAll: PropTypes.func.isRequired,
  userSortMode: PropTypes.oneOf(USER_SORT_MODES).isRequired,
  onCycleUserSort: PropTypes.func.isRequired,
  userPage: PropTypes.number.isRequired,
  userPageSize: PropTypes.number.isRequired,
  onUserPageChange: PropTypes.func.isRequired,
  onUserPageSizeChange: PropTypes.func.isRequired
};

function looksLikeText(bytes) {
  if (!bytes.length) return true;
  const sample = bytes.subarray(0, 4096);
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) control += 1;
  }
  return control / sample.length < 0.05;
}

function hexDump(bytes, maxBytes = 1024) {
  const lines = [];
  const end = Math.min(bytes.length, maxBytes);
  for (let off = 0; off < end; off += 16) {
    const row = bytes.subarray(off, Math.min(off + 16, end));
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(row, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return lines.join('\n');
}

const previewPreSx = {
  m: 0,
  p: 1,
  maxHeight: '70vh',
  overflow: 'auto',
  bgcolor: '#000',
  color: '#3f3',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  textAlign: 'left'
};

function FilePreviewPopup({ preview, onClose }) {
  const [textState, setTextState] = useState({ status: 'idle' });
  const url = preview ? adminStorageTreeFileUrl(preview.rootKey, preview.path) : '';
  const kind = preview?.file?.kind;
  const needsBytes = preview && (kind === 'text' || kind === 'other');

  useEffect(() => {
    if (!needsBytes) return undefined;
    let cancelled = false;
    setTextState({ status: 'loading' });
    fetchAdminStorageTreeFileHead(preview.rootKey, preview.path)
      .then((bytes) => {
        if (cancelled) return;
        const truncated = bytes.length < (preview.file.size || 0);
        if (looksLikeText(bytes)) {
          setTextState({ status: 'text', text: new TextDecoder('utf-8').decode(bytes), truncated });
        } else {
          setTextState({ status: 'hex', text: hexDump(bytes), truncated: (preview.file.size || 0) > 1024 });
        }
      })
      .catch((err) => {
        if (!cancelled) setTextState({ status: 'error', text: err?.response?.status ? `HTTP ${err.response.status}` : err?.message || 'Failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [needsBytes, preview]);

  if (!preview) return null;
  const { file } = preview;

  return (
    <ColorTemplate7PopupLargeDark open onClose={onClose} centerInWindow closeOnBackdrop maxWidth="min(1200px, 94vw)">
      <ColorTemplate7PopupLargeDark.Title sx={{ wordBreak: 'break-all' }}>{file.name}</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body spacing={1}>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
          {preview.path} · {file.sizeLabel}
          {file.modified ? ` · ${new Date(file.modified).toLocaleString()}` : ''}
        </ColorTemplate7PopupLargeDark.BodyText>
        {kind === 'image' ? (
          <Box component="img" src={url} alt={file.name} sx={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', alignSelf: 'center' }} />
        ) : null}
        {kind === 'video' ? (
          <Box component="video" src={url} controls autoPlay sx={{ maxWidth: '100%', maxHeight: '72vh', alignSelf: 'center', bgcolor: '#000' }} />
        ) : null}
        {kind === 'audio' ? <Box component="audio" src={url} controls autoPlay sx={{ width: '100%' }} /> : null}
        {kind === 'pdf' ? <Box component="iframe" src={url} title={file.name} sx={{ width: '100%', height: '72vh', border: 0, bgcolor: '#fff' }} /> : null}
        {needsBytes && textState.status === 'loading' ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : null}
        {needsBytes && (textState.status === 'text' || textState.status === 'hex') ? (
          <>
            {textState.status === 'hex' ? (
              <ColorTemplate7PopupLargeDark.BodyText sx={{ fontSize: '0.75rem' }}>
                Binary file (possibly encrypted) — first bytes shown as hex.
              </ColorTemplate7PopupLargeDark.BodyText>
            ) : null}
            <Box component="pre" sx={previewPreSx}>
              {textState.text}
            </Box>
            {textState.truncated ? (
              <ColorTemplate7PopupLargeDark.BodyText sx={{ fontSize: '0.75rem' }}>Showing the beginning of the file only.</ColorTemplate7PopupLargeDark.BodyText>
            ) : null}
          </>
        ) : null}
        {needsBytes && textState.status === 'error' ? (
          <ColorTemplate7PopupLargeDark.ErrorBar>Could not load file: {textState.text}</ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}
        <ColorTemplate7PopupLargeDark.Link onClick={() => window.open(url, '_blank', 'noopener')}>Open in new tab</ColorTemplate7PopupLargeDark.Link>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

FilePreviewPopup.propTypes = {
  preview: PropTypes.shape({
    rootKey: PropTypes.string,
    path: PropTypes.string,
    file: PropTypes.shape({
      name: PropTypes.string,
      size: PropTypes.number,
      sizeLabel: PropTypes.string,
      modified: PropTypes.string,
      kind: PropTypes.string
    })
  }),
  onClose: PropTypes.func.isRequired
};

export default function AdminToolsTreeTab({ onError }) {
  const [trees, setTrees] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState({ large: new Set(), fast: new Set() });
  const [files, setFiles] = useState({ large: {}, fast: {} });
  const [userSort, setUserSort] = useState({ large: 'orig', fast: 'orig' });
  const [userPaging, setUserPaging] = useState({
    large: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    fast: { page: 1, pageSize: DEFAULT_PAGE_SIZE }
  });
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    onError?.('');
    try {
      const data = await fetchAdminStorageTree();
      setTrees(data);
      setExpanded({
        large: collectDefaultExpanded(data?.largeCheap?.tree, 0, new Set()),
        fast: collectDefaultExpanded(data?.fast?.tree, 0, new Set())
      });
      setFiles({ large: {}, fast: {} });
      setUserSort({ large: 'orig', fast: 'orig' });
      setUserPaging({
        large: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
        fast: { page: 1, pageSize: DEFAULT_PAGE_SIZE }
      });
    } catch (err) {
      onError?.(err);
      setTrees(null);
    } finally {
      setBusy(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFiles = useCallback((rootKey, folderPath) => {
    setFiles((prev) => ({ ...prev, [rootKey]: { ...prev[rootKey], [folderPath]: 'loading' } }));
    fetchAdminStorageTreeFiles(rootKey, folderPath)
      .then((list) => setFiles((prev) => ({ ...prev, [rootKey]: { ...prev[rootKey], [folderPath]: list } })))
      .catch((err) => {
        const message = err?.response?.data?.error || err?.message || 'Failed to list files';
        setFiles((prev) => ({ ...prev, [rootKey]: { ...prev[rootKey], [folderPath]: message } }));
      });
  }, []);

  const onToggle = useCallback(
    (rootKey, node) => {
      const opening = !expanded[rootKey].has(node.path);
      setExpanded((prev) => {
        const next = new Set(prev[rootKey]);
        if (opening) next.add(node.path);
        else next.delete(node.path);
        return { ...prev, [rootKey]: next };
      });
      if (opening && node.fileCount > 0 && files[rootKey][node.path] === undefined) loadFiles(rootKey, node.path);
    },
    [expanded, files, loadFiles]
  );

  const onOpenFile = useCallback((rootKey, path, file) => setPreview({ rootKey, path, file }), []);

  const panelProps = (rootKey, data) => ({
    data,
    expanded: expanded[rootKey],
    onToggle,
    filesByPath: files[rootKey],
    onOpenFile,
    onLoadFiles: loadFiles,
    onExpandAll: () => setExpanded((prev) => ({ ...prev, [rootKey]: collectAllPaths(data?.tree, new Set()) })),
    onCollapseAll: () => setExpanded((prev) => ({ ...prev, [rootKey]: new Set() })),
    userSortMode: userSort[rootKey],
    onCycleUserSort: () => {
      setUserSort((prev) => ({ ...prev, [rootKey]: nextUserSortMode(prev[rootKey]) }));
      setUserPaging((prev) => ({ ...prev, [rootKey]: { ...prev[rootKey], page: 1 } }));
    },
    userPage: userPaging[rootKey].page,
    userPageSize: userPaging[rootKey].pageSize,
    onUserPageChange: (page) => setUserPaging((prev) => ({ ...prev, [rootKey]: { ...prev[rootKey], page } })),
    onUserPageSizeChange: (pageSize) => setUserPaging((prev) => ({ ...prev, [rootKey]: { page: 1, pageSize } }))
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <ColorTemplate9TableData.Button type="button" disabled={busy} onClick={() => void load()}>
          {busy ? 'Loading…' : 'Refresh'}
        </ColorTemplate9TableData.Button>
        <ColorTemplate9TableData.BodyText sx={{ ...pathLabelSx, opacity: 0.7 }}>
          Click a folder to expand / collapse and list its files. Click a file to preview it.
        </ColorTemplate9TableData.BodyText>
      </Box>
      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : trees ? (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5 }}>
          <TreePanel {...panelProps('large', trees.largeCheap)} />
          <TreePanel {...panelProps('fast', trees.fast)} />
        </Box>
      ) : null}
      <FilePreviewPopup preview={preview} onClose={() => setPreview(null)} />
    </Box>
  );
}

AdminToolsTreeTab.propTypes = {
  onError: PropTypes.func
};
