import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

export const RECORD_VAULT_ZERO_KNOWLEDGE_TITLE =
  'State-of-the-art protection, Zero-Knowledge Architecture';

export const RECORD_VAULT_ZERO_KNOWLEDGE_BODY =
  'Our advanced security architecture is designed to keep your notes completely safe and impossible for anyone other than you to access or decrypt. TutaNotes uses modern 2026-grade cryptography with layered protection: your account login, a Encrypt Password that seals your OneDrive or USB vault, and an optional 6-digit PIN for an additional inner encryption layer on selected notes. Critically, neither your Encrypt Password nor your PIN is stored on our servers. We retain only non-secret cryptographic metadata required for client-side unlocking. Encryption and decryption only run on your end for your maximum privacy; our systems never hold the keys needed to read your content. That means neither an outside attacker with access to our infrastructure, nor OnlineMall administrators, can decrypt your vault. Your data becomes readable only when you are present and enter the Encrypt Password—and, when enabled, the PIN—from memory. Once unlocked, content is visible to you in that session; locking again returns it to ciphertext. Important: If you forget your Encrypt Password or PIN, we cannot recover your data. There is no backdoor and no reset path. By not storing the Encrypt Password or PIN on our system, our choice of architecture makes it impossible for anyone to ever hack or compromise your data. Please store these secrets safely—your privacy depends on them remaining known only to you.';

const defaultNoticeSx = {
  px: 1.5,
  py: 1.35,
  borderRadius: 1,
  border: '2px solid #000',
  bgcolor: '#000',
  color: '#fff',
  WebkitTextFillColor: '#fff',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '0.88rem', sm: '0.95rem' },
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap'
};

const titleSx = {
  display: 'block',
  textAlign: 'center',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '1.05rem', sm: '1.25rem' },
  lineHeight: 1.3,
  // Popup templates force MuiTypography to dark text — plain element + !important yellow title.
  color: 'var(--theme-yellow-color) !important',
  WebkitTextFillColor: 'var(--theme-yellow-color) !important',
  mb: 1.25
};

/**
 * Black Zero-Knowledge security notice used on Encrypt Password + encrypt/decrypt PIN screens.
 */
export default function RecordVaultZeroKnowledgeNotice({ sx }) {
  return (
    <Box component="aside" role="note" sx={{ ...defaultNoticeSx, ...(sx || null) }}>
      <Box component="strong" sx={titleSx}>
        {RECORD_VAULT_ZERO_KNOWLEDGE_TITLE}
      </Box>
      {RECORD_VAULT_ZERO_KNOWLEDGE_BODY}
    </Box>
  );
}

RecordVaultZeroKnowledgeNotice.propTypes = {
  sx: PropTypes.object
};
