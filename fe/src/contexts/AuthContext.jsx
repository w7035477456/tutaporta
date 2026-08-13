import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mutate as mutateSwrCache } from 'swr';
import api, { cancelPendingSessionEndRedirect } from '../api/axios';
import { clearSessionEndNotices } from '../utils/sessionEndNotice';
import { applyThemeByName, DEFAULT_NEW_USER_THEME_NAME } from '../utils/themeConfig';
import { syncClientApiRateLimitBypass } from '../utils/adminSession';
import { clearClientApiCooldownState } from '../utils/clientApiCooldown';
import { clearSignupIdentificationVerificationRequired } from '../utils/signupIdentificationVerification';

function clearSwrCacheForNewSession() {
  void mutateSwrCache(() => true, undefined, { revalidate: false });
}

/** Drop tab-local onboarding locks when switching accounts (login / impersonate / logout). */
function clearSessionLocalOnboardingLocks() {
  clearSignupIdentificationVerificationRequired();
}
const AuthContext = createContext(null);

function toNullableInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeUserShape(rawUser, authMeta = {}) {
  if (!rawUser || typeof rawUser !== 'object') return null;
  const impersonatedRaw = rawUser.impersonated_by_admin_id ?? authMeta.impersonated_by_admin_id;
  const impersonatedByAdminId =
    impersonatedRaw == null
      ? null
      : Number.isFinite(Number(impersonatedRaw))
        ? Math.trunc(Number(impersonatedRaw))
        : null;

  return {
    ...rawUser,
    singles_id: toNullableInteger(rawUser.singles_id ?? rawUser.singlesId),
    member_id: toNullableInteger(rawUser.member_id ?? rawUser.memberId ?? rawUser.memberid),
    prefix: toNullableInteger(rawUser.prefix ?? rawUser.member_prefix ?? rawUser.memberPrefix),
    profile_image_fk: toNullableInteger(rawUser.profile_image_fk ?? rawUser.profileImageFk),
    role: String(rawUser.role ?? authMeta.role ?? 'user').trim() || 'user',
    tools_only: Boolean(rawUser.tools_only ?? authMeta.tools_only),
    impersonated_by_admin_id: impersonatedByAdminId,
    guest_demo_login: Boolean(rawUser.guest_demo_login ?? authMeta.guest_demo_login)
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordUpgrade, setRequiresPasswordUpgrade] = useState(false);
  /** Bumps ?v= on profile photo URLs so header updates after crop / Make this Profile */
  const [profilePhotoCacheBust, setProfilePhotoCacheBust] = useState(0);
  const bumpProfilePhotoCache = useCallback(() => {
    setProfilePhotoCacheBust((n) => n + 1);
  }, []);

  /** After POST /api/profilePhoto succeeds: sync `user.profile_image_fk` so header avatar URL updates (no full /api/me round-trip). */
  const updateSessionProfilePhoto = useCallback((photosId) => {
    const id = toNullableInteger(photosId);
    if (photosId == null || id == null || id < 1) {
      if (photosId == null) {
        setUser((prev) => {
          if (!prev) return prev;
          return normalizeUserShape({ ...prev, profile_image_fk: null });
        });
      }
    } else {
      setUser((prev) => {
        if (!prev) return prev;
        return normalizeUserShape({ ...prev, profile_image_fk: id });
      });
    }
    setProfilePhotoCacheBust((n) => n + 1);
  }, []);

  const updateSessionNickname = useCallback((nickname) => {
    const next = String(nickname ?? '').trim();
    setUser((prev) => {
      if (!prev) return prev;
      return normalizeUserShape({ ...prev, alias: next || null });
    });
  }, []);

  const updateSessionDemoBuddyFlags = useCallback(({ gender_self_report, seeded_demo_buddies_boolean } = {}) => {
    setUser((prev) => {
      if (!prev) return prev;
      return normalizeUserShape({
        ...prev,
        ...(gender_self_report !== undefined ? { gender_self_report } : {}),
        ...(seeded_demo_buddies_boolean !== undefined ? { seeded_demo_buddies_boolean } : {})
      });
    });
  }, []);

  useEffect(() => {
    if (!user) {
      applyThemeByName(DEFAULT_NEW_USER_THEME_NAME);
    }
  }, [user]);

  useEffect(() => {
    if (syncClientApiRateLimitBypass(user)) {
      clearClientApiCooldownState();
    }
  }, [user]);

  const mergeAuthUser = (rawUser, payload) =>
    normalizeUserShape(rawUser, {
      role: payload?.role ?? rawUser?.role,
      tools_only: payload?.tools_only ?? rawUser?.tools_only,
      impersonated_by_admin_id: payload?.impersonated_by_admin_id ?? rawUser?.impersonated_by_admin_id
    });

  /** Sync profile_image_fk from server after Make this Profile / phone upload (enables sidebar immediately). */
  const refreshAuthProfilePhoto = useCallback(async () => {
    try {
      const response = await api.get('/api/me');
      if (!response.data?.authenticated || !response.data?.user) return;
      const nextFk = toNullableInteger(response.data.user.profile_image_fk);
      setUser((prev) => {
        if (!prev) return mergeAuthUser(response.data.user, response.data);
        if (prev.profile_image_fk === nextFk) return prev;
        return mergeAuthUser({ ...prev, profile_image_fk: nextFk }, response.data);
      });
      if (nextFk != null && nextFk >= 1) {
        setProfilePhotoCacheBust((n) => n + 1);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/api/me');
      if (!response.data?.authenticated || !response.data?.user) {
        setUser(null);
        setRequiresPasswordUpgrade(false);
        clearSwrCacheForNewSession();
        return;
      }
      let nextUser = mergeAuthUser(response.data.user, response.data);
      if (
        nextUser &&
        !nextUser.tools_only &&
        (nextUser.member_id == null || nextUser.prefix == null || !String(nextUser.alias ?? '').trim())
      ) {
        try {
          const profileRes = await api.get('/api/settings/profile');
          const profile = normalizeUserShape(profileRes?.data);
          nextUser = mergeAuthUser(
            {
              ...nextUser,
              member_id: nextUser.member_id ?? profile?.member_id,
              prefix: nextUser.prefix ?? profile?.prefix,
              alias: nextUser.alias ?? profile?.alias
            },
            response.data
          );
        } catch (profileError) {
          console.warn('[AuthContext] Failed to hydrate member info', profileError?.message ?? profileError);
        }
      }
      setUser(nextUser);
      setRequiresPasswordUpgrade(Boolean(response.data.requiresPasswordUpgrade));
    } catch (error) {
      const status = error?.response?.status;
      // Keep the current session on transient backend/network failures.
      // Only clear auth state when server confirms the session is invalid.
      if (status === 401 || status === 403) {
        setUser(null);
        setRequiresPasswordUpgrade(false);
        clearSwrCacheForNewSession();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password, rememberMe = false) => {
    const response = await api.post('/api/verifyPassword', {
      email,
      password,
      rememberMe: Boolean(rememberMe)
    });
    if (response.data.success) {
      let nextUser = mergeAuthUser(response.data.user, response.data);
      if (
        nextUser &&
        !nextUser.tools_only &&
        (nextUser.member_id == null || nextUser.prefix == null || !String(nextUser.alias ?? '').trim())
      ) {
        try {
          const profileRes = await api.get('/api/settings/profile');
          const profile = normalizeUserShape(profileRes?.data);
          nextUser = mergeAuthUser(
            {
              ...nextUser,
              member_id: nextUser.member_id ?? profile?.member_id,
              prefix: nextUser.prefix ?? profile?.prefix,
              alias: nextUser.alias ?? profile?.alias
            },
            response.data
          );
        } catch (profileError) {
          console.warn('[AuthContext] Failed to hydrate member info after login', profileError?.message ?? profileError);
        }
      }
      setUser(nextUser);
      setRequiresPasswordUpgrade(Boolean(response.data.requiresPasswordUpgrade));
      clearSessionLocalOnboardingLocks();
      clearSwrCacheForNewSession();
      cancelPendingSessionEndRedirect();
      clearSessionEndNotices();
      sessionStorage.removeItem('logoutBlockBack');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-customization-reload'));
      }
      return response.data;
    } else {
      throw new Error(response.data.error || 'Login failed');
    }
  };

  const impersonateMember = async ({ targetSinglesId, password }) => {
    const { postAdminImpersonate } = await import('../api/adminImpersonateFe.js');
    const response = await postAdminImpersonate({ targetSinglesId, password });
    if (!response?.success) {
      throw new Error(response?.error || 'Impersonation failed');
    }
    let nextUser = mergeAuthUser(response.user, response);
    if (
      nextUser &&
      (nextUser.member_id == null || nextUser.prefix == null || !String(nextUser.alias ?? '').trim())
    ) {
      try {
        const profileRes = await api.get('/api/settings/profile');
        const profile = normalizeUserShape(profileRes?.data);
        nextUser = mergeAuthUser(
          {
            ...nextUser,
            member_id: nextUser.member_id ?? profile?.member_id,
            prefix: nextUser.prefix ?? profile?.prefix,
            alias: nextUser.alias ?? profile?.alias
          },
          response
        );
      } catch (profileError) {
        console.warn('[AuthContext] Failed to hydrate member info after impersonation', profileError?.message ?? profileError);
      }
    }
    setUser(nextUser);
    setRequiresPasswordUpgrade(false);
    clearSessionLocalOnboardingLocks();
    clearSwrCacheForNewSession();
    cancelPendingSessionEndRedirect();
    clearSessionEndNotices();
    sessionStorage.removeItem('logoutBlockBack');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('user-customization-reload'));
    }
    return response;
  };

  const returnToAdmin = async () => {
    const { postAdminReturnAdmin } = await import('../api/adminImpersonateFe.js');
    const response = await postAdminReturnAdmin();
    if (!response?.success) {
      throw new Error(response?.error || 'Return to admin failed');
    }
    const nextUser = mergeAuthUser(response.user, response);
    setUser(nextUser);
    setRequiresPasswordUpgrade(false);
    clearSessionLocalOnboardingLocks();
    clearSwrCacheForNewSession();
    cancelPendingSessionEndRedirect();
    clearSessionEndNotices();
    sessionStorage.removeItem('logoutBlockBack');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('user-customization-reload'));
    }
    return response;
  };

  const upgradeLegacyPassword = async ({ newPassword, confirmPassword }) => {
    const { upgradeLegacyPassword: upgradeLegacyPasswordApi } = await import('../api/upgradeLegacyPasswordFe.js');
    const data = await upgradeLegacyPasswordApi({ newPassword, confirmPassword });
    setRequiresPasswordUpgrade(false);
    return data;
  };

  const logout = async () => {
    try {
      const { flushRecordVaultSessionsOnLeave } = await import('../api/recordVaultFe.js');
      await flushRecordVaultSessionsOnLeave();
      const { flushPhotoAlbumsSessionsOnLeave } = await import('../api/photoAlbumsFe.js');
      await flushPhotoAlbumsSessionsOnLeave();
    } catch (err) {
      console.error('Vault flush before logout', err);
    }
    try {
      await api.post('/api/logout');
    } catch (err) {
      console.error('Logout error', err);
    }
    setUser(null);
    setRequiresPasswordUpgrade(false);
    clearSessionLocalOnboardingLocks();
    clearSwrCacheForNewSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        requiresPasswordUpgrade,
        login,
        logout,
        impersonateMember,
        returnToAdmin,
        checkAuth,
        upgradeLegacyPassword,
        profilePhotoCacheBust,
        bumpProfilePhotoCache,
        updateSessionProfilePhoto,
        refreshAuthProfilePhoto,
        updateSessionNickname,
        updateSessionDemoBuddyFlags
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
