import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const SiteAudioContext = createContext(null);

export function SiteAudioProvider({ children }) {
  /** Master level for page media, mall hover, UI clicks; default 0 (muted), not persisted. */
  const [mediaVolume, setMediaVolumeState] = useState(0);

  const setMediaVolume = useCallback((next) => {
    setMediaVolumeState((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      const clamped = Math.min(1, Math.max(0, typeof v === 'number' && !Number.isNaN(v) ? v : prev));
      return clamped;
    });
  }, []);

  const value = useMemo(() => ({ mediaVolume, setMediaVolume }), [mediaVolume, setMediaVolume]);

  return <SiteAudioContext.Provider value={value}>{children}</SiteAudioContext.Provider>;
}

SiteAudioProvider.propTypes = { children: PropTypes.node };

export function useSiteAudio() {
  const ctx = useContext(SiteAudioContext);
  if (!ctx) {
    throw new Error('useSiteAudio must be used within SiteAudioProvider');
  }
  return ctx;
}
