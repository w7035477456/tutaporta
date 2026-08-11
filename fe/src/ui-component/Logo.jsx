// material-ui
import { useTheme, useColorScheme } from '@mui/material/styles';

import logo from 'assets/images/vettedSingleLogoText.jpeg';
import logoDark from 'assets/images/vettedSingleLogoText.jpeg'; // optional
import welcomeMall from 'assets/images/welcomeMall.png';

// ==============================|| LOGO SVG ||============================== //

export default function Logo({ authBranding = false, width = 120 }) {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();

  if (authBranding) {
    return (
      <img
        src={welcomeMall}
        alt="Welcome to our Shopping Mall"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    );
  }

  return (
    <img
      src={colorScheme === 'dark' ? logoDark : logo}
      alt="Vetted"
      width={width}
      style={{ width, maxWidth: '100%', height: 'auto', display: 'block' }}
    />
  );
}
