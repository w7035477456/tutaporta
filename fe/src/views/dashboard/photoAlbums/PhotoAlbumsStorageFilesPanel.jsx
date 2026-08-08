import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  fetchPhotoAlbumsOneDriveVaultTree,
  fetchPhotoAlbumsUsbVaultTree,
  readPhotoAlbumsApiError
} from 'api/photoAlbumsFe';
import VaultWorkspaceErrorPopup from 'ui-component/VaultWorkspaceErrorPopup';

const REFRESH_MS = 4000;
const TREE_INDENT_PX = 14;
const TREE_LINE_COLOR = '#000';

const panelShellSx = {
  flex: '1 1 0',
  minHeight: 0,
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  mt: 0,
  overflow: 'hidden'
};

const panelScrollSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'scroll',
  overflowX: 'auto',
  bgcolor: 'var(--theme-daynight-color)',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  border: '2px solid #000',
  borderRadius: 1,
  p: 1,
  boxSizing: 'border-box',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: '0.78rem',
  lineHeight: 1.35,
  scrollbarWidth: 'thin',
  scrollbarColor: '#000 rgba(0,0,0,0.15)',
  '&::-webkit-scrollbar': {
    width: 12
  },
  '&::-webkit-scrollbar-track': {
    bgcolor: 'rgba(0,0,0,0.12)'
  },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: '#000',
    borderRadius: 6
  },
  '& .MuiTypography-root': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important'
  }
};

const treeRowSx = {
  display: 'flex',
  alignItems: 'stretch',
  whiteSpace: 'nowrap',
  minHeight: '1.35em'
};

const treeLabelSx = (isFolder) => ({
  fontFamily: 'inherit',
  fontSize: 'inherit',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  fontWeight: isFolder ? 700 : 400,
  alignSelf: 'center',
  pl: 0.25
});

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** Sum all file sizes under a vault tree node (bytes). */
function sumTreeFileBytes(node) {
  if (!node || typeof node !== 'object') return 0;
  if (node.type === 'file') return Math.max(0, Number(node.size) || 0);
  const children = Array.isArray(node.children) ? node.children : [];
  let total = 0;
  for (const child of children) {
    total += sumTreeFileBytes(child);
  }
  return total;
}

/** Screenshot format: Total size=435mb */
function formatTotalSizeMb(bytes) {
  const mb = Math.max(0, Math.round((Number(bytes) || 0) / (1024 * 1024)));
  return `Total size=${mb}mb`;
}

function VaultTreeAncestorRail({ showLine }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: TREE_INDENT_PX,
        flexShrink: 0,
        position: 'relative',
        alignSelf: 'stretch',
        ...(showLine
          ? {
              '&::before': {
                content: '""',
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                borderLeft: `1px solid ${TREE_LINE_COLOR}`
              }
            }
          : null)
      }}
    />
  );
}

VaultTreeAncestorRail.propTypes = {
  showLine: PropTypes.bool
};

function VaultTreeBranchRail({ isLast }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: TREE_INDENT_PX,
        flexShrink: 0,
        position: 'relative',
        alignSelf: 'stretch',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: '50%',
          top: 0,
          height: isLast ? '50%' : '100%',
          borderLeft: `1px solid ${TREE_LINE_COLOR}`
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          top: '50%',
          right: 0,
          borderTop: `1px solid ${TREE_LINE_COLOR}`
        }
      }}
    />
  );
}

VaultTreeBranchRail.propTypes = {
  isLast: PropTypes.bool
};

function VaultTreeNode({ node, depth = 0, isLast = true, ancestorHasNext = [] }) {
  if (!node?.name) return null;
  const isFolder = node.type === 'folder';
  const children = isFolder && Array.isArray(node.children) ? node.children : [];
  const sizeLabel = !isFolder && node.size ? ` (${formatFileSize(node.size)})` : '';
  const label = `${node.name}${sizeLabel}`;

  return (
    <>
      {depth === 0 ? (
        <Box sx={treeRowSx}>
          <Typography component="span" sx={treeLabelSx(true)}>
            {label}
          </Typography>
        </Box>
      ) : (
        <Box sx={treeRowSx} role="treeitem" aria-label={node.name}>
          {ancestorHasNext.map((hasNext, index) => (
            <VaultTreeAncestorRail key={`${depth}:${index}`} showLine={hasNext} />
          ))}
          <VaultTreeBranchRail isLast={isLast} />
          <Typography component="span" sx={treeLabelSx(isFolder)}>
            {label}
          </Typography>
        </Box>
      )}
      {children.map((child, index) => (
        <VaultTreeNode
          key={`${depth + 1}:${child.name}`}
          node={child}
          depth={depth + 1}
          isLast={index === children.length - 1}
          ancestorHasNext={depth === 0 ? [] : [...ancestorHasNext, !isLast]}
        />
      ))}
    </>
  );
}

VaultTreeNode.propTypes = {
  node: PropTypes.object,
  depth: PropTypes.number,
  isLast: PropTypes.bool,
  ancestorHasNext: PropTypes.arrayOf(PropTypes.bool)
};

function usbListingToTree(listing) {
  if (listing?.tree?.name) return listing.tree;
  const children = (listing?.entries || []).map((entry) => ({
    name: entry.name,
    type: entry.type === 'folder' ? 'folder' : 'file',
    size: entry.size ?? null,
    children: entry.type === 'folder' ? [] : undefined
  }));
  return {
    name: listing?.path || 'USB vault',
    type: 'folder',
    children
  };
}

export default function PhotoAlbumsStorageFilesPanel({ storageType, active = true, hideTitle = false }) {
  const isOneDrive = storageType === 'onedrive';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorPopupOpen, setErrorPopupOpen] = useState(false);
  const [tree, setTree] = useState(null);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      setError('');
      setErrorPopupOpen(false);
      setTree(null);
      return undefined;
    }

    let cancelled = false;

    const load = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError('');
        setErrorPopupOpen(false);
      }
      try {
        if (isOneDrive) {
          const result = await fetchPhotoAlbumsOneDriveVaultTree();
          if (cancelled) return;
          setTree(result.tree || null);
          setError('');
          setErrorPopupOpen(false);
        } else {
          const result = await fetchPhotoAlbumsUsbVaultTree();
          if (cancelled) return;
          setTree(usbListingToTree(result));
          setError('');
          setErrorPopupOpen(false);
        }
      } catch (err) {
        if (cancelled) return;
        // Silent refresh must not re-open the popup every poll.
        if (silent) return;
        setTree(null);
        setError(readPhotoAlbumsApiError(err, 'Unable to load folders & files'));
        setErrorPopupOpen(true);
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    void load({ silent: false });
    const timerId = window.setInterval(() => {
      void load({ silent: true });
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [active, isOneDrive, storageType]);

  return (
    <Box sx={panelShellSx} aria-label={isOneDrive ? 'OneDrive folders and files' : 'USB folders and files'}>
      {hideTitle ? null : (
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            mb: 0.5,
            color: '#000 !important',
            WebkitTextFillColor: '#000 !important'
          }}
        >
          Folders &amp; Files
        </Typography>
      )}
      <Box sx={panelScrollSx} role="tree" aria-label={isOneDrive ? 'OneDrive vault folder tree' : 'USB vault folder tree'}>
        {error ? (
          <Typography
            component="span"
            sx={{
              ...treeLabelSx(false),
              color: '#b00020 !important',
              WebkitTextFillColor: '#b00020 !important',
              whiteSpace: 'pre-wrap',
              display: 'block'
            }}
          >
            {error}
          </Typography>
        ) : null}
        {loading && !tree ? (
          <Typography component="span" sx={{ ...treeLabelSx(false), display: 'block' }}>
            Loading…
          </Typography>
        ) : null}
        {!error && tree ? (
          <>
            <Typography component="span" sx={{ ...treeLabelSx(true), display: 'block', mb: 0.5 }}>
              {formatTotalSizeMb(sumTreeFileBytes(tree))}
            </Typography>
            <VaultTreeNode node={tree} />
          </>
        ) : null}
      </Box>
      <VaultWorkspaceErrorPopup
        error={errorPopupOpen ? error : ''}
        onClose={() => setErrorPopupOpen(false)}
      />
    </Box>
  );
}

PhotoAlbumsStorageFilesPanel.propTypes = {
  storageType: PropTypes.oneOf(['onedrive', 'usb']).isRequired,
  active: PropTypes.bool,
  hideTitle: PropTypes.bool
};
