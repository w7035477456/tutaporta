import { useState, useEffect } from 'react';

// project imports
import Loader from 'ui-component/Loader';
import ServiceNoticeModal from 'ui-component/ServiceNoticeModal';

// ==============================|| DATABASE CONNECTION GUARD ||============================== //

import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

export default function DatabaseConnectionGuard({ children }) {
  const [dbOk, setDbOk] = useState(null); // null = checking, true = ok, false = failed

  const [healthError, setHealthError] = useState(null); // { errorCode, message } when health returns E4 etc.

  useEffect(() => {
    let cancelled = false;

    const checkDb = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.dbConnected) {
          setDbOk(true);
          setHealthError(null);
        } else {
          setDbOk(false);
          setHealthError(data.errorCode != null ? { errorCode: data.errorCode, message: data.message } : null);
        }
      } catch {
        if (cancelled) return;
        setDbOk(false);
        setHealthError(null);
      }
    };

    checkDb();
    return () => { cancelled = true; };
  }, []);

  const handleExit = () => {
    window.close();
  };

  if (dbOk === null) {
    return <Loader />;
  }

  if (dbOk === false) {
    return <ServiceNoticeModal onExit={handleExit} errorCode={healthError?.errorCode} message={healthError?.message} />;
  }

  return children;
}
