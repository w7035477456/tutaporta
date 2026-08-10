import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SliderControlButton from 'ui-component/SliderControlButton';
import GreenButton from 'ui-component/GreenButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { RECORD_VAULT_BRIDGE_PORT } from 'api/recordVaultBridgeFe';
import { downloadUsbBridgeInstaller, readRecordVaultApiError } from 'api/recordVaultFe';
import {
  normalizeUsbBridgeInstallerUrl,
  USB_BRIDGE_INSTALLER_API
} from 'utils/usbBridgeInstallerDownloadUrl';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { themedAlert } from 'utils/themedDialog';
import { tutaNotesPostLoginActionButtonSx } from './tutaNotesPostLoginActionButtonSx';
import usbLogoImage from 'assets/images/usbLogo.png';

/** Match desktop Record Vault USB Bridge status window colors. */
export const BRIDGE_STATUS_BG = {
  ready: '#5ec43a',
  notready: '#f0a000',
  nousb: '#d32f2f',
  offline: '#d32f2f'
};

const panelShellSx = {
  width: '100%',
  maxWidth: '100%',
  borderRadius: 1,
  border: '4px solid #000',
  boxSizing: 'border-box',
  px: 1.5,
  py: 1.25
};

const panelTextSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '0.92rem', sm: '1.05rem' },
  lineHeight: 1.35,
  color: '#000',
  WebkitTextFillColor: '#000'
};

const usbLogoSx = {
  width: { xs: 72, sm: 96 },
  height: 'auto',
  flexShrink: 0,
  display: 'block',
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.28))',
  userSelect: 'none',
  pointerEvents: 'none'
};

const downloadBridgeButtonSx = {
  ...tutaNotesPostLoginActionButtonSx,
  alignSelf: 'stretch',
  width: '100%',
  maxWidth: '100%',
  fontWeight: 800
};

function preferMacInstaller() {
  if (typeof navigator === 'undefined') return true;
  const platform = String(navigator.platform || '');
  const ua = String(navigator.userAgent || '');
  if (/Win/i.test(platform) || /Windows NT/i.test(ua) || /Windows/i.test(ua)) return false;
  return true;
}

function normalizeBridgeStatus({ bridgeConnected, bridgeConnecting, driveLabels, hasAnyUsb }) {
  if (bridgeConnecting) return 'notready';
  const drives = (Array.isArray(driveLabels) ? driveLabels : [])
    .map((label) => String(label || '').trim())
    .filter(Boolean);
  // USB already visible/usable — never push the installer download banner.
  if (drives.length) return 'ready';
  if (hasAnyUsb) return 'notready';
  if (!bridgeConnected) return 'offline';
  // Bridge up: no USB sticks plugged → red.
  return 'nousb';
}

function StatusCard({ bgcolor, statusLine, driveLine, listenLine, textColor = '#000' }) {
  const textSx = {
    ...panelTextSx,
    color: textColor,
    WebkitTextFillColor: textColor,
    textAlign: 'left'
  };
  return (
    <Box
      sx={{
        ...panelShellSx,
        bgcolor,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: { xs: 1.25, sm: 2 },
        justifyContent: 'flex-start'
      }}
    >
      <Box component="img" src={usbLogoImage} alt="" aria-hidden sx={usbLogoSx} />
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        <Typography sx={{ ...textSx, fontWeight: 900, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
          {statusLine}
        </Typography>
        <Typography sx={textSx}>{driveLine}</Typography>
        <Typography sx={textSx}>{listenLine}</Typography>
      </Box>
    </Box>
  );
}

StatusCard.propTypes = {
  bgcolor: PropTypes.string.isRequired,
  statusLine: PropTypes.string.isRequired,
  driveLine: PropTypes.string.isRequired,
  listenLine: PropTypes.string.isRequired,
  textColor: PropTypes.string
};

/**
 * TutaNotes USB Login bridge strip — four states:
 * Task1 offline (download), Task2 ready (green), Task3 notready (amber), Task4 nousb (red).
 * Always shows “Download usbbridge zip” above the status card.
 */
export default function RecordVaultUsbBridgeStatusPanel({
  bridgeConnected = false,
  bridgeConnecting = false,
  driveLabels = [],
  hasAnyUsb = false,
  installerMacUrl = USB_BRIDGE_INSTALLER_API.mac,
  installerWinUrl = USB_BRIDGE_INSTALLER_API.win,
  showConnectButton = false,
  onConnectClick
}) {
  const preferMac = preferMacInstaller();
  const downloadPlatform = preferMac ? 'mac' : 'win';
  const downloadHref = preferMac
    ? normalizeUsbBridgeInstallerUrl(installerMacUrl, 'mac')
    : normalizeUsbBridgeInstallerUrl(installerWinUrl, 'win');
  const downloadLabel = preferMac ? 'Mac (.zip)' : 'Windows (.zip)';

  const handleInstallerDownload = (event) => {
    event?.preventDefault?.();
    void downloadUsbBridgeInstaller(downloadPlatform).catch((err) => {
      void themedAlert(readRecordVaultApiError(err, 'USB Bridge installer download failed'));
    });
  };

  const drives = (Array.isArray(driveLabels) ? driveLabels : [])
    .map((label) => String(label || '').trim())
    .filter(Boolean);
  const driveLine = drives.length ? `USB: ${drives.join(', ')}` : 'USB: (none)';
  const listenLine = `Listening on 127.0.0.1:${RECORD_VAULT_BRIDGE_PORT || 49201}`;
  const status = normalizeBridgeStatus({
    bridgeConnected,
    bridgeConnecting,
    driveLabels: drives,
    hasAnyUsb
  });

  let statusBody = null;
  if (status === 'ready') {
    statusBody = (
      <StatusCard
        bgcolor={BRIDGE_STATUS_BG.ready}
        statusLine="Status: USB Connected & Ready"
        driveLine={driveLine}
        listenLine={listenLine}
      />
    );
  } else if (status === 'notready') {
    statusBody = (
      <Stack spacing={1} sx={{ width: '100%' }}>
        <StatusCard
          bgcolor={BRIDGE_STATUS_BG.notready}
          statusLine="Status: USB Not Ready"
          driveLine={driveLine}
          listenLine={listenLine}
        />
        {showConnectButton && !bridgeConnected ? (
          <SliderControlButton
            type="button"
            disabled={bridgeConnecting}
            onClick={() => {
              if (typeof onConnectClick === 'function') onConnectClick();
            }}
            sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
          >
            {bridgeConnecting ? 'Connecting…' : 'Connect local USB'}
          </SliderControlButton>
        ) : null}
      </Stack>
    );
  } else if (status === 'nousb') {
    statusBody = (
      <StatusCard
        bgcolor={BRIDGE_STATUS_BG.nousb}
        statusLine="Status: USB not plugged in"
        driveLine={driveLine}
        listenLine={listenLine}
        textColor="#fff"
      />
    );
  } else {
    statusBody = (
      <Stack spacing={1} sx={{ width: '100%' }}>
        <Box sx={{ ...panelShellSx, bgcolor: BRIDGE_STATUS_BG.offline, textAlign: 'center' }}>
          <Typography sx={{ ...panelTextSx, color: '#fff', WebkitTextFillColor: '#fff', textAlign: 'center' }}>
            USB Bridge is not running. Use{' '}
            <Box component="span" sx={{ fontWeight: 900 }}>
              Download usbbridge zip
            </Box>{' '}
            above
            {downloadHref ? ` (${downloadLabel})` : ''}.
            {preferMac
              ? ' Then in Finder → Downloads: double-click the zip to unzip, open the folder, double-click “1-START-HERE-Read-Me-First.txt”, and follow the steps (Finder only — no Terminal).'
              : ''}
          </Typography>
        </Box>
        {showConnectButton ? (
          <SliderControlButton
            type="button"
            disabled={bridgeConnecting}
            onClick={() => {
              if (typeof onConnectClick === 'function') onConnectClick();
            }}
            sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
          >
            {bridgeConnecting ? 'Connecting…' : 'Connect local USB'}
          </SliderControlButton>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={1} sx={{ width: '100%' }}>
      <GreenButton
        type="button"
        singleLineLabel={false}
        onClick={handleInstallerDownload}
        aria-label="Download usbbridge zip"
        title={
          preferMac
            ? 'Download usbBridgeV3-mac.zip (from server STORAGE_FOLDER / USB_DMG_EXE)'
            : 'Download usbBridgeV3-win.zip (from server STORAGE_FOLDER / USB_DMG_EXE)'
        }
        {...guestDemoAllowProps()}
        sx={downloadBridgeButtonSx}
      >
        Download usbbridge zip
      </GreenButton>
      {statusBody}
    </Stack>
  );
}

RecordVaultUsbBridgeStatusPanel.propTypes = {
  bridgeConnected: PropTypes.bool,
  bridgeConnecting: PropTypes.bool,
  driveLabels: PropTypes.arrayOf(PropTypes.string),
  hasAnyUsb: PropTypes.bool,
  installerMacUrl: PropTypes.string,
  installerWinUrl: PropTypes.string,
  showConnectButton: PropTypes.bool,
  onConnectClick: PropTypes.func
};
