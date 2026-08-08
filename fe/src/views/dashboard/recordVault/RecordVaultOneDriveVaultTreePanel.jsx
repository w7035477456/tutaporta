import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { fetchRecordVaultOneDriveVaultTree, fetchRecordVaultUsbVaultTree } from 'api/recordVaultFe';

const VAULT_TREE_INDENT_PX = 18;
const VAULT_TREE_LINE_COLOR = 'var(--theme-yellow-color)';

const vaultTreeScrollSx = (maxHeight) => ({
  width: '100%',
  maxHeight,
  minHeight: 160,
  overflowY: 'scroll',
  overflowX: 'auto',
  border: '2px solid #000',
  bgcolor: 'rgba(0,0,0,0.25)',
  p: 1.5,
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  fontSize: '0.92rem',
  lineHeight: 1.45,
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--theme-yellow-color) rgba(0,0,0,0.4)',
  '&::-webkit-scrollbar': {
    width: 14
  },
  '&::-webkit-scrollbar-track': {
    bgcolor: 'rgba(0,0,0,0.4)'
  },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'var(--theme-yellow-color)',
    borderRadius: 7,
    border: '2px solid #000'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    filter: 'brightness(1.08)'
  }
});

const vaultTreeRowSx = {
  display: 'flex',
  alignItems: 'stretch',
  whiteSpace: 'nowrap',
  minHeight: '1.45em'
};

const vaultTreeLabelSx = (isFolder) => ({
  fontFamily: 'inherit',
  fontSize: 'inherit',
  color: 'inherit',
  fontWeight: isFolder ? 600 : 400,
  alignSelf: 'center',
  pl: 0.5
});

function VaultTreeAncestorRail({ showLine }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: VAULT_TREE_INDENT_PX,
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
                borderLeft: `1px solid ${VAULT_TREE_LINE_COLOR}`
              }
            }
          : null)
      }}
    />
  );
}

function VaultTreeBranchRail({ isLast }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: VAULT_TREE_INDENT_PX,
        flexShrink: 0,
        position: 'relative',
        alignSelf: 'stretch',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: '50%',
          top: 0,
          height: isLast ? '50%' : '100%',
          borderLeft: `1px solid ${VAULT_TREE_LINE_COLOR}`
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          top: '50%',
          right: 0,
          borderTop: `1px solid ${VAULT_TREE_LINE_COLOR}`
        }
      }}
    />
  );
}

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function VaultTreeNode({ node, depth = 0, isLast = true, ancestorHasNext = [] }) {
  if (!node?.name) return null;
  const isFolder = node.type === 'folder';
  const children = isFolder && Array.isArray(node.children) ? node.children : [];
  const label = `${node.name}${!isFolder && node.size ? ` (${formatFileSize(node.size)})` : ''}`;

  return (
    <>
      {depth === 0 ? (
        <Box sx={vaultTreeRowSx}>
          <Typography component="span" sx={vaultTreeLabelSx(true)}>
            {label}
          </Typography>
        </Box>
      ) : (
        <Box sx={vaultTreeRowSx} role="treeitem" aria-label={node.name}>
          {ancestorHasNext.map((hasNext, index) => (
            <VaultTreeAncestorRail key={`${depth}:${index}`} showLine={hasNext} />
          ))}
          <VaultTreeBranchRail isLast={isLast} />
          <Typography component="span" sx={vaultTreeLabelSx(isFolder)}>
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
          ancestorHasNext={[...ancestorHasNext, !isLast]}
        />
      ))}
    </>
  );
}

/** Shared vault folder descriptions + live tree (View OneDrive / View USB / Backup & Restore). */
export default function RecordVaultOneDriveVaultTreePanel({
  active = true,
  storageType = 'onedrive',
  folderName = '',
  refreshToken = 0,
  maxHeight = '58vh',
  showDescriptions = true,
  onLoadingChange
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tree, setTree] = useState(null);
  const isUsb = storageType === 'usb';
  const storageLabel = isUsb ? 'USB' : 'OneDrive Cloud';
  const storageFolderHint = isUsb
    ? 'your USB vault folder'
    : `your OneDrive vault folder${folderName ? ` (${folderName})` : ''}`;

  useEffect(() => {
    if (!active) {
      setLoading(false);
      setError('');
      setTree(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const load = isUsb ? fetchRecordVaultUsbVaultTree() : fetchRecordVaultOneDriveVaultTree();
    void load
      .then((result) => {
        if (cancelled) return;
        setTree(result.tree || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setTree(null);
        setError(err?.response?.data?.error || err?.message || 'Unable to load vault tree');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, refreshToken, isUsb]);

  useEffect(() => {
    onLoadingChange?.(active && loading);
  }, [active, loading, onLoadingChange]);

  return (
    <>
      {showDescriptions ? (
        <>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0 }}>
            All folders and encrypted files stored in {storageFolderHint} ({storageLabel}). It is never stored on our
            server or anywhere else.
          </ColorTemplate16PopupCenterWide.SectionDescription>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, fontStyle: 'italic' }}>
            All *.enc are encrypted at rest and only this website can decrypt, just momentarily only, for you to view,
            after 3 layers of security are verified.
          </ColorTemplate16PopupCenterWide.SectionDescription>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0 }}>
            All text is saved in vault.db.enc. Encryption keys are hashed and not kept on {storageLabel}. Periodic key
            rotation and hash protection and triple layers verification give MyNote iron clad impenetrable privacy.
          </ColorTemplate16PopupCenterWide.SectionDescription>
        </>
      ) : null}
      {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}
      {loading && !tree ? (
        <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, opacity: 0.85 }}>
          Loading {storageLabel} vault tree…
        </ColorTemplate16PopupCenterWide.SectionDescription>
      ) : null}
      {!error && tree ? (
        <Box sx={vaultTreeScrollSx(maxHeight)} role="tree" aria-label={`${storageLabel} vault folder tree`}>
          <VaultTreeNode node={tree} />
        </Box>
      ) : null}
    </>
  );
}
