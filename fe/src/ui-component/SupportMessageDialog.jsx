import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { postSupportMessage } from 'api/supportMessageFe';
import { useAuth } from 'contexts/AuthContext';
import { formatAliasWithMemberCode } from 'utils/memberLabel';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';

const MAX_FILES = 2;
const MAX_FILE_BYTES = 7 * 1024 * 1024;
const MAX_FILE_ERROR = '7mb max per file';

function isImageFile(file) {
  if (file?.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(String(file?.name ?? ''));
}

function readFileAsAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : '';
      resolve({
        filename: file.name,
        contentBase64: base64,
        mimeType: file.type || 'application/octet-stream'
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function SupportMessageDialog({ open, onClose }) {
  const { user } = useAuth() ?? {};
  const fileInputRef = useRef(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const imagePreviewUrls = useMemo(
    () => files.map((file) => (isImageFile(file) ? URL.createObjectURL(file) : null)),
    [files]
  );

  useEffect(
    () => () => {
      imagePreviewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    [imagePreviewUrls]
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    const defaultName =
      formatAliasWithMemberCode({
        alias: user?.alias ?? user?.nickname,
        prefix: user?.prefix,
        memberId: user?.member_id,
        singlesId: user?.singles_id,
        fallback: ''
      }) || fullName;
    setName((prev) => prev || defaultName);
    setEmail((prev) => prev || String(user?.email ?? '').trim());
  }, [open, user]);

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleFilesSelected = (event) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!picked.length) return;

    const next = [...files];
    let fileError = '';
    let addedCount = 0;
    for (const file of picked) {
      if (next.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_BYTES) {
        fileError = MAX_FILE_ERROR;
        continue;
      }
      next.push(file);
      addedCount += 1;
    }
    setFiles(next);
    setError(fileError);
    if (addedCount > 0) {
      setMessage('');
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setError('');
    setSuccess('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError('Please fill in your name, email, and message.');
      return;
    }

    setSending(true);
    try {
      const attachments = await Promise.all(files.map((file) => readFileAsAttachment(file)));
      const data = await postSupportMessage({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
        attachments
      });
      setSuccess(data?.message || 'Your message was sent.');
      setMessage('');
      setFiles([]);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={sending ? undefined : handleClose}
      closeOnBackdrop={!sending}
      showCloseButton={!sending}
      closeButtonAriaLabel="Close support message"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title id="support-message-dialog-title">
          Leave us a message (To: support@onlinemall.website)
        </ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label="Your name">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={sending}
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <ColorTemplate7PopupLargeDark.FormRow label="From Email &amp; CC Email">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              type="email"
              placeholder="From Email & CC Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </ColorTemplate7PopupLargeDark.FormRow>
        </ColorTemplate7PopupLargeDark.FormRows>

        <Box sx={{ width: '100%' }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: 'var(--theme-primary-color)', mb: 0.75 }}
          >
            How can we help you?
          </Typography>
          <ColorTemplate7PopupLargeDark.Input
            fullWidth
            multiline
            minRows={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sending}
            inputProps={{ maxLength: 10000 }}
          />
        </Box>

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label="Attachments">
            <ColorTemplate7PopupLargeDark.ActionButton
              type="button"
              onClick={handlePickFiles}
              disabled={sending || files.length >= MAX_FILES}
            >
              <AttachFileIcon />
              {files.length} Add up to {MAX_FILES} files
            </ColorTemplate7PopupLargeDark.ActionButton>
          </ColorTemplate7PopupLargeDark.FormRow>
        </ColorTemplate7PopupLargeDark.FormRows>

        <input ref={fileInputRef} type="file" hidden multiple onChange={handleFilesSelected} />

        {files.length > 0 ? (
          <Stack spacing={0.5}>
            {files.map((file, index) => (
              <Stack key={`${file.name}-${file.size}-${index}`} direction="row" alignItems="center" spacing={1}>
                {imagePreviewUrls[index] ? (
                  <Box component="img" src={imagePreviewUrls[index]} alt="" />
                ) : null}
                <ColorTemplate7PopupLargeDark.BodyText>{file.name}</ColorTemplate7PopupLargeDark.BodyText>
                <ColorTemplate7PopupLargeDark.ActionButton
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  disabled={sending}
                >
                  Remove
                </ColorTemplate7PopupLargeDark.ActionButton>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        {success ? <ColorTemplate7PopupLargeDark.BodyText>{success}</ColorTemplate7PopupLargeDark.BodyText> : null}

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
          <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={handleSend} disabled={sending}>
            {sending ? 'Sending…' : 'Send'}
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SupportMessageDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
