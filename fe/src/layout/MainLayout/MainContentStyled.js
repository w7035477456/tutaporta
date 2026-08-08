import { styled } from '@mui/material/styles';
import {
  COLOR_TEMPLATE15_APPLICATION_FRAME_MAIN_BOTTOM_PADDING,
  colorTemplate15ApplicationFrameMainPanelEdgeToEdgeSx,
  colorTemplate15ApplicationFrameMainPanelSx
} from 'config/colorTemplate15ApplicationFrame';

/** Region 7 — legacy styled main for mobile zoom / landing paths; tokens live in ColorTemplate15ApplicationFrame config. */
const MainContentStyled = styled('main', {
  shouldForwardProp: (prop) =>
    prop !== 'open' && prop !== 'borderRadius' && prop !== 'noTopMargin' && prop !== 'stretch' && prop !== 'edgeToEdge'
})(({ theme, open, borderRadius, noTopMargin, stretch, edgeToEdge }) => ({
  ...colorTemplate15ApplicationFrameMainPanelSx(
    { borderRadius, stretch },
    noTopMargin ? { marginTop: 0, minHeight: stretch ? '100%' : undefined } : { marginTop: 88 }
  ),
  ...(edgeToEdge ? colorTemplate15ApplicationFrameMainPanelEdgeToEdgeSx() : {}),
  transition: theme.transitions.create(['margin', 'width'], {
    easing: open ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
    duration: theme.transitions.duration.shorter + 200
  }),
  [theme.breakpoints.down('md')]: edgeToEdge
    ? { marginLeft: 0, marginRight: 0, padding: 0 }
    : {
        marginLeft: 20,
        padding: 16,
        paddingBottom: COLOR_TEMPLATE15_APPLICATION_FRAME_MAIN_BOTTOM_PADDING,
        marginRight: 0
      },
  [theme.breakpoints.down('sm')]: edgeToEdge
    ? { marginLeft: 0, marginRight: 0, padding: 0 }
    : { marginLeft: 10, marginRight: 0 }
}));

export default MainContentStyled;
