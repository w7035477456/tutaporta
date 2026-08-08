import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { BUSY_HOURGLASS_IMAGE } from 'config/busyHourglassEnv';
import { getFontAwesome5ObjectIconDefinition } from 'utils/fontAwesome5ObjectIcons';

export const RECORD_VAULT_HOURGLASS_ICON_NAME = 'hourglass';

/** Security icon glyph — hourglass uses colorful hourglass4.png; others use Font Awesome. */
export default function RecordVaultSecurityIconGlyph({ iconName, sizePx }) {
  const name = String(iconName ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');

  if (name === RECORD_VAULT_HOURGLASS_ICON_NAME) {
    return (
      <Box
        component="img"
        src={BUSY_HOURGLASS_IMAGE}
        alt=""
        aria-hidden
        sx={{
          width: sizePx,
          height: sizePx,
          objectFit: 'contain',
          display: 'block'
        }}
      />
    );
  }

  const definition = getFontAwesome5ObjectIconDefinition(name);
  if (!definition) {
    return (
      <Box
        aria-hidden
        sx={{
          width: sizePx,
          height: sizePx,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: Math.max(10, Math.round(sizePx * 0.45)),
          lineHeight: 1,
          color: 'inherit',
          textTransform: 'uppercase'
        }}
      >
        {(name || '?').slice(0, 2)}
      </Box>
    );
  }

  return (
    <FontAwesomeIcon
      icon={definition}
      color="currentColor"
      style={{ width: sizePx, height: sizePx, fontSize: sizePx, color: 'currentColor' }}
    />
  );
}

RecordVaultSecurityIconGlyph.propTypes = {
  iconName: PropTypes.string,
  sizePx: PropTypes.number.isRequired
};
