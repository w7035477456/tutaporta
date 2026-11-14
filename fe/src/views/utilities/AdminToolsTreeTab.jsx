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

function FolderNode({ node, depth, rootKey, expanded, onToggle, filesByPath, onOpenFile, onLoadFiles, isRoot = false, totalLabel = '' }) {
  const isOpen = expanded.has(node.path);
  const hasContent = node.children.length > 0 || node.fileCount > 0;
  const files = filesByPath[node.path];
  const marker = hasContent ? (isOpen ? '▾' : '▸') : ' ';
  return (
    <>
      <Box sx={{ ...rowSx, pl: `${depth * INDENT_CH}ch` }} onClick={() => onToggle(rootKey, node)}>
        {`${marker} ${isRoot ? '' : '|-- '}${node.name}/`}
        {isRoot && totalLabel ? `  (${totalLabel})` : ''}
        {node.fileCount > 0 ? `  (${node.fileCount} files)` : ''}
      </Box>
      {isOpen ? (
        <>
          {node.children.map((child) => (
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
}

const treeNodeShape = PropTypes.shape({
  name: PropTypes.string,
  path: PropTypes.string,
  fileCount: PropTypes.number,
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
  totalLabel: PropTypes.string
};

function TreePanel({ data, expanded, onToggle, filesByPath, onOpenFile, onLoadFiles, onExpandAll, onCollapseAll }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0, gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <ColorTemplate9TableData.BodyText sx={{ ...pathLabelSx, flex: '1 1 0', minWidth: 0 }}>
          {data?.envVar}: {data?.root || '(not set)'}
        </ColorTemplate9TableData.BodyText>
        {data?.tree ? (
          <>
            <ColorTemplate9TableData.Button type="button" onClick={onExpandAll} sx={{ minHeight: 24, py: 0.25, px: 1, fontSize: '0.7rem' }}>
              Expand all
            </ColorTemplate9TableData.Button>
            <ColorTemplate9TableData.Button type="button" onClick={onCollapseAll} sx={{ minHeight: 24, py: 0.25, px: 1, fontSize: '0.7rem' }}>
              Collapse all
            </ColorTemplate9TableData.Button>
          </>
        ) : null}
      </Box>
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
            totalLabel={data.totalLabel}
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
  onCollapseAll: PropTypes.func.isRequired
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
    onCollapseAll: () => setExpanded((prev) => ({ ...prev, [rootKey]: new Set() }))
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
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5 }}>
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
