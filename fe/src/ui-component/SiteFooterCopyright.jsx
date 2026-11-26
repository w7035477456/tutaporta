import Typography from '@mui/material/Typography';
import { siteFooterTextFontSize } from 'config/footerFontEnv';

export default function SiteFooterCopyright({ version = 'v2', sx = {} }) {
  return (
    <Typography
      variant="caption"
      component="span"
      sx={{
        fontSize: siteFooterTextFontSize,
        color: 'inherit',
        ...sx
      }}
    >
      © {version} 2026 TutaMall.com, San Francisco, CA
    </Typography>
  );
}
