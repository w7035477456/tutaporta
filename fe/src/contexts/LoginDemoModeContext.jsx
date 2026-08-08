import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { GUEST_DEMO_LOGIN_MESSAGE, isDemoGuestLoginAliasCredentials } from 'utils/guestDemoLogin';

const LoginDemoModeContext = createContext({
  demoMode: false,
  setLoginCredentials: () => {},
  blockDemoAction: () => false
});

/**
 * Login page: restrict non–Sign In actions only when credentials are exactly
 * demo/demo or guest/guest. Otherwise Email, Password, Sign In, and signup stay allowed.
 */
export function LoginDemoModeProvider({ children }) {
  const [credentials, setCredentials] = useState({ loginId: '', password: '' });
  const [popupOpen, setPopupOpen] = useState(false);
  const demoMode = isDemoGuestLoginAliasCredentials(credentials.loginId, credentials.password);

  const setLoginCredentials = useCallback((loginId, password) => {
    setCredentials({
      loginId: String(loginId ?? ''),
      password: String(password ?? '')
    });
  }, []);

  const blockDemoAction = useCallback(
    (event) => {
      if (!demoMode) return false;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      setPopupOpen(true);
      return true;
    },
    [demoMode]
  );

  const value = useMemo(
    () => ({
      demoMode,
      setLoginCredentials,
      blockDemoAction
    }),
    [demoMode, setLoginCredentials, blockDemoAction]
  );

  return (
    <LoginDemoModeContext.Provider value={value}>
      {children}
      <ColorTemplate16PopupCenterWide
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        closeOnBackdrop
        bodyTextAlignLeft={false}
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <ColorTemplate16PopupCenterWide.BodyText
            sx={{ whiteSpace: 'pre-wrap', textAlign: 'center', width: '100%' }}
          >
            {GUEST_DEMO_LOGIN_MESSAGE}
          </ColorTemplate16PopupCenterWide.BodyText>
          <ColorTemplate16PopupCenterWide.ActionButton type="button" onClick={() => setPopupOpen(false)}>
            OK
          </ColorTemplate16PopupCenterWide.ActionButton>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </LoginDemoModeContext.Provider>
  );
}

LoginDemoModeProvider.propTypes = {
  children: PropTypes.node
};

export function useLoginDemoMode() {
  return useContext(LoginDemoModeContext);
}
