// material-ui
import { styled } from '@mui/material/styles';

// project imports
import onlineMallParkinglot from 'assets/images/onlineMallParkinglot.png';

// ==============================|| AUTHENTICATION 1 WRAPPER ||============================== //

const AuthWrapper1 = styled('div')(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100dvh',
  minHeight: '100dvh',
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.vars.palette.grey[100],
  backgroundImage: `url(${onlineMallParkinglot})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat'
}));

export default AuthWrapper1;
