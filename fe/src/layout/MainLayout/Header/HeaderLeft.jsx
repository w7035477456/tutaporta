import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import LogoSection from '../LogoSection';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import useVettingMobileTopCluster from 'hooks/useVettingMobileTopCluster';
import { MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import { MY_PHOTO_ALBUMS_PATH } from 'constants/myPhotoAlbumsRoute';
import {
  isRecordVaultRoute,
  MY_NOTE_HEADER_LOGO_IMAGE,
  myNoteHeaderLogoImgSx,
  myNoteHeaderLogoSlotSx,
  myNoteHeaderLogoWrapSx
} from 'config/recordVaultLayout';
import {
  isPhotoAlbumsRoute,
  MY_PHOTO_ALBUMS_HEADER_LOGO_IMAGE,
  myPhotoAlbumsHeaderLogoImgSx,
  myPhotoAlbumsHeaderLogoSlotSx,
  myPhotoAlbumsHeaderLogoWrapSx
} from 'config/photoAlbumsLayout';
import { IconMenu2 } from '@tabler/icons-react';

/** Region 2 left — logo (+ mobile menu toggle). */
export default function HeaderLeft({ iconsOnly = false }) {
  const location = useLocation();
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const vettingMobileTopCluster = useVettingMobileTopCluster();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;
  const iconSize = downSM ? '40px' : '20px';
  const avatarSx = downSM ? { width: 68, height: 68, minWidth: 68, fontSize: '1.2rem' } : { ...theme.typography.mediumAvatar };

  if (iconsOnly) return null;

  if (isPhotoAlbumsRoute(location.pathname)) {
    return (
      <Box sx={myPhotoAlbumsHeaderLogoSlotSx}>
        <Box
          component={RouterLink}
          to={MY_PHOTO_ALBUMS_PATH}
          aria-label="Photo Albums home"
          sx={myPhotoAlbumsHeaderLogoWrapSx}
        >
          <Box
            component="img"
            src={MY_PHOTO_ALBUMS_HEADER_LOGO_IMAGE}
            alt="OnlineMall.Website"
            sx={myPhotoAlbumsHeaderLogoImgSx}
          />
        </Box>
      </Box>
    );
  }

  if (isRecordVaultRoute(location.pathname)) {
    return (
      <Box sx={myNoteHeaderLogoSlotSx}>
        <Box
          component={RouterLink}
          to={MY_RECORD_VAULT_PATH}
          aria-label="MyNote home"
          sx={myNoteHeaderLogoWrapSx}
        >
          <Box
            component="img"
            src={MY_NOTE_HEADER_LOGO_IMAGE}
            alt="OnlineMall.Website"
            sx={myNoteHeaderLogoImgSx}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: downMD ? 'auto' : 180, display: 'flex' }}>
      <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1 }}>
        <LogoSection />
      </Box>
      {downMD && !vettingMobileTopCluster ? (
        <Avatar
          variant="rounded"
          sx={{
            ...theme.typography.commonAvatar,
            ...avatarSx,
            overflow: 'hidden',
            transition: 'all .2s ease-in-out',
            color: '#fff',
            background: 'var(--theme-primary-color)',
            borderRadius: '12px',
            boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
            '&:hover': {
              color: '#fff',
              background: 'var(--theme-primary-color)',
              filter: 'brightness(0.92)',
              boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)'
            }
          }}
          onClick={() => handlerDrawerOpen(!drawerOpen)}
        >
          <IconMenu2 stroke={1.5} size={iconSize} />
        </Avatar>
      ) : null}
    </Box>
  );
}
