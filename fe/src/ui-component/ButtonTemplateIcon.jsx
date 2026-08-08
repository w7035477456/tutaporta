import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import {
  buttonTemplateIconSizeResponsive,
  buttonTemplateIconSx,
  SIDEBAR_MENU_ICON_CLASS
} from 'config/selectedUnselectedButtonTemplate';

/** PNG icon for SelectedButtonTemplate / UnSelectedButtonTemplate — default size from fe/.env DESKTOP_FONT_SIZE_ICON. */
export default function ButtonTemplateIcon({ sx, size = buttonTemplateIconSizeResponsive, className, ...rest }) {
  const mergedClassName = className ? `${SIDEBAR_MENU_ICON_CLASS} ${className}` : SIDEBAR_MENU_ICON_CLASS;
  return (
    <Box
      component="img"
      className={mergedClassName}
      sx={{
        ...buttonTemplateIconSx(
          size != null && size !== buttonTemplateIconSizeResponsive ? { width: size, height: size } : undefined
        ),
        ...(sx || {})
      }}
      {...rest}
    />
  );
}

ButtonTemplateIcon.propTypes = {
  sx: PropTypes.object,
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  className: PropTypes.string,
  src: PropTypes.string,
  alt: PropTypes.string
};

ButtonTemplateIcon.defaultSize = buttonTemplateIconSizeResponsive;
ButtonTemplateIcon.sx = buttonTemplateIconSx;
