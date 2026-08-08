import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SliderControlButton from 'ui-component/SliderControlButton';
import { fetchPhotoAlbumsUsbLocations } from 'api/photoAlbumsFe';
import { formatPhotoAlbumsBridgeClientError } from 'api/photoAlbumsBridgeFe';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import TutaPhotoAlbumsRadioMark, {
  tutaPhotoAlbumsNativeRadioInputSx,
  tutaPhotoAlbumsRadioControlWrapSx
} from './TutaPhotoAlbumsRadioMark';

const REFRESH_MS = 2500;

const pickerShellSx = {
  flex: '0 0 auto',
  width: '100%',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 1,
  bgcolor: 'var(--theme-secondary-color)',
  overflow: 'visible',
  fontFamily: MAIN_FONT_FAMILY,
  fontSize: 'inherit !important',
  lineHeight: 1.2
};

const pickerHeaderSx = {
  flexShrink: 0,
  px: 1,
  py: 0.75,
  borderBottom: '2px solid var(--theme-primary-color)',
  bgcolor: 'var(--theme-yellow-color)',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  fontWeight: 700,
  lineHeight: 1.2,
  fontSize: 'inherit',
  wordBreak: 'break-word'
};

const pickerButtonFontSx = {
  fontSize: 'inherit !important',
  '@media (min-width: 600px)': {
    fontSize: 'inherit !important'
  },
  '&.MuiButton-root': {
    fontSize: 'inherit !important',
    '@media (min-width: 600px)': {
      fontSize: 'inherit !important'
    }
  },
  '&.MuiButton-sizeSmall': {
    fontSize: 'inherit !important',
    '@media (min-width: 600px)': {
      fontSize: 'inherit !important'
    }
  },
  '& .MuiButton-label': {
    fontSize: 'inherit !important',
    '@media (min-width: 600px)': {
      fontSize: 'inherit !important'
    }
  },
  '& .MuiTypography-root': {
    fontSize: 'inherit !important',
    '@media (min-width: 600px)': {
      fontSize: 'inherit !important'
    }
  }
};

const refreshButtonSx = {
  ...pickerButtonFontSx,
  bgcolor: 'var(--theme-yellow-color) !important',
  fontSize: 'inherit !important',
  lineHeight: 1.2,
  py: 0.5,
  px: 0.75,
  minHeight: 0,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-yellow-color) !important'
    }
  }
};

const pickerListSx = {
  flex: '0 0 auto',
  overflow: 'visible',
  p: 0.75,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75
};

const driveRadioRowSx = (selected = false, disabled = false) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  width: '100%',
  minWidth: 0,
  px: 1,
  py: 0.65,
  bgcolor: disabled ? 'rgba(255,255,255,0.55)' : selected ? 'var(--theme-green-color)' : '#fff',
  color: '#000',
  border: selected ? '2px solid var(--theme-primary-color)' : '2px solid rgba(0, 0, 0, 0.35)',
  borderRadius: 1,
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: buttonFontSizeResponsive.xs,
  lineHeight: 1.25,
  boxSizing: 'border-box',
  opacity: disabled ? 0.75 : 1,
  '@media (min-width: 600px)': {
    fontSize: buttonFontSizeResponsive.sm
  },
  '&:has(input:focus-visible)': {
    outline: '2px solid var(--theme-yellow-color)',
    outlineOffset: 0
  }
});

const driveRadioLabelSx = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#000',
  WebkitTextFillColor: '#000'
};

function folderLabel(name, hasVault, sizeGb, fileSystem) {
  const details = [];
  if (hasVault) details.push('vault');
  if (sizeGb != null) details.push(`${sizeGb} GB`);
  if (fileSystem) details.push(fileSystem);
  if (!details.length) return name;
  return `${name} (${details.join(', ')})`;
}

export default function PhotoAlbumsUsbLocationPicker({
  selectedPath,
  preferredMountPath = '',
  headerLabel = 'Pick USB or folder',
  headerLogoSrc = null,
  hideHeader = false,
  bridgeConnected = false,
  waitForBridge = false,
  excludePaths = [],
  assignedPaths = [],
  refreshToken = 0,
  onSelect,
  onReset
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const excludedPathSet = new Set(
    (Array.isArray(excludePaths) ? excludePaths : [])
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
  );
  const assignedPathSet = new Set(
    (Array.isArray(assignedPaths) ? assignedPaths : [])
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
  );

  const emitSelect = (location) => {
    const mountPath = String(location?.mountPath ?? '').trim();
    if (!mountPath || excludedPathSet.has(mountPath)) return;
    // Allow re-selecting the current primary; block other assigned paths (e.g. backup).
    if (assignedPathSet.has(mountPath) && mountPath !== String(selectedPath || '').trim()) return;
    onSelect?.(location);
  };

  const semiPreselectAppliedRef = useRef(false);

  useEffect(() => {
    semiPreselectAppliedRef.current = false;
  }, [preferredMountPath]);

  const loadTopLevel = useCallback(async ({ silent = false } = {}) => {
    if (waitForBridge && !bridgeConnected) {
      if (!silent) {
        setLoading(false);
        setEntries([]);
        setError('');
      }
      return;
    }
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const locations = await fetchPhotoAlbumsUsbLocations();
      setEntries(
        locations.map((loc) => ({
          name: loc.label,
          path: loc.mountPath,
          hasVault: Boolean(loc.hasVault),
          partial: Boolean(loc.partial),
          legacyPinVault: Boolean(loc.legacyPinVault),
          vaultId: loc.vaultId || null,
          sizeGb: loc.sizeGb ?? null,
          availGb: loc.availGb ?? null,
          freePercent: loc.freePercent ?? null,
          vaultUsedGb: loc.vaultUsedGb ?? null,
          vaultUsedBytes: loc.vaultUsedBytes ?? null,
          fileSystem: loc.fileSystem || null
        }))
      );
      if (silent) setError('');
    } catch (err) {
      const message = formatPhotoAlbumsBridgeClientError(err);
      if (!silent) {
        setError(message);
        setEntries([]);
      } else {
        setEntries((prev) => {
          if (!prev.length) setError(message);
          return prev;
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [waitForBridge, bridgeConnected]);

  useEffect(() => {
    void loadTopLevel({ silent: false });
  }, [loadTopLevel, refreshToken]);

  useEffect(() => {
    if (waitForBridge && !bridgeConnected) return undefined;
    const timerId = window.setInterval(() => {
      void loadTopLevel({ silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(timerId);
  }, [loadTopLevel, waitForBridge, bridgeConnected]);

  useEffect(() => {
    if (semiPreselectAppliedRef.current || loading || selectedPath) return;
    const rememberedPath = String(preferredMountPath ?? '').trim();
    if (!rememberedPath) return;
    const match = entries.find((entry) => entry.path === rememberedPath);
    if (!match) return;
    semiPreselectAppliedRef.current = true;
    emitSelect({
      mountPath: match.path,
      label: match.name,
      hasVault: match.hasVault,
      partial: match.partial,
      legacyPinVault: match.legacyPinVault,
      vaultUsedGb: match.vaultUsedGb,
      vaultUsedBytes: match.vaultUsedBytes,
      freePercent: match.freePercent
    });
  }, [loading, selectedPath, preferredMountPath, entries, excludePaths, assignedPaths]);

  return (
    <Box sx={pickerShellSx}>
      {hideHeader ? null : (
        <Box sx={pickerHeaderSx}>
          {headerLogoSrc ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box
                component="img"
                src={headerLogoSrc}
                alt=""
                aria-hidden
                sx={{
                  width: 32,
                  height: 32,
                  objectFit: 'contain',
                  flexShrink: 0,
                  borderRadius: 0.5,
                  border: '1px solid #000'
                }}
              />
              <Box component="span">{headerLabel}</Box>
            </Box>
          ) : (
            headerLabel
          )}
        </Box>
      )}
      <Typography sx={{ px: 1, pt: 0.75, pb: 0.25, fontWeight: 700, lineHeight: 1.3, fontSize: 'inherit' }}>
        Choose a USB Drive below to mount as TutaPhotoAlbums
      </Typography>
      <Box sx={{ flexShrink: 0, px: 0.75, pt: 0.75, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        <SliderControlButton type="button" sx={refreshButtonSx} onClick={() => void loadTopLevel({ silent: false })}>
          Refresh
        </SliderControlButton>
        {typeof onReset === 'function' ? (
          <SliderControlButton
            type="button"
            sx={refreshButtonSx}
            onClick={() => {
              onReset();
              void loadTopLevel({ silent: false });
            }}
          >
            Reset
          </SliderControlButton>
        ) : null}
      </Box>
      <Box sx={pickerListSx} role="radiogroup" aria-label="Mounted USB drives">
        {loading && !entries.length ? (
          <Stack alignItems="center" py={2}>
            <CircularProgress size={24} />
          </Stack>
        ) : null}
        {!loading && error && !entries.length ? (
          <Typography sx={{ color: '#b00020', fontWeight: 700, px: 0.5, fontSize: 'inherit' }}>{error}</Typography>
        ) : null}
        {entries.map((entry) => {
          const selected = selectedPath === entry.path;
          const blocked =
            excludedPathSet.has(entry.path) ||
            (assignedPathSet.has(entry.path) && entry.path !== String(selectedPath || '').trim());
          const label = folderLabel(entry.name, entry.hasVault, entry.sizeGb, entry.fileSystem);
          return (
            <Box
              key={entry.path}
              component="label"
              sx={driveRadioRowSx(selected, blocked)}
            >
              <Box sx={tutaPhotoAlbumsRadioControlWrapSx}>
                <Box
                  component="input"
                  type="radio"
                  name="record-vault-usb-drive"
                  value={entry.path}
                  checked={selected}
                  disabled={blocked}
                  onChange={() => {
                    if (blocked) return;
                    emitSelect({
                      mountPath: entry.path,
                      label: entry.name,
                      hasVault: entry.hasVault,
                      partial: entry.partial,
                      legacyPinVault: entry.legacyPinVault,
                      vaultUsedGb: entry.vaultUsedGb,
                      vaultUsedBytes: entry.vaultUsedBytes,
                      freePercent: entry.freePercent
                    });
                  }}
                  sx={tutaPhotoAlbumsNativeRadioInputSx}
                />
                <TutaPhotoAlbumsRadioMark selected={selected} disabled={blocked} />
              </Box>
              <Box component="span" sx={driveRadioLabelSx} title={label}>
                {label}
              </Box>
            </Box>
          );
        })}
        {!loading && !error && !entries.length ? (
          <Typography sx={{ px: 0.5, fontSize: 'inherit' }}>
            {bridgeConnected
              ? 'No USB drives found. Plug in a drive and wait a moment.'
              : 'No USB drives found. Start Record Vault USB Bridge on this computer, then click Connect local USB above and Allow in Chrome.'}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
