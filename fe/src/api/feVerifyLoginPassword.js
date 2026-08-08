import useSWR from 'swr';
import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

const fetcher = async (url) => {
  console.log('[feVerifyLoginPassword.js] fetcher called, url:', url);
  const response = await fetch(url);
  console.log('[feVerifyLoginPassword.js] response:', { ok: response.ok, status: response.status, statusText: response.statusText });
  if (!response.ok) {
    const text = await response.text();
    console.log('[feVerifyLoginPassword.js] non-ok body:', text?.slice(0, 300));
    throw new Error('Failed to fetch singles');
  }
  return response.json();
};

const endpoints = {
  key: 'api/verifyPassword',
  list: '/api/verifyPassword'
};

export function feVerifyLoginPassword() {
  console.log('######## [feVerifyLoginPassword.js] verifyLoginPassword hook called');
  const navigate = useNavigate();
  const url = `${API_BASE_URL}${endpoints.list}`;
  console.log('[feVerifyLoginPassword.js] hook init, API_BASE_URL:', API_BASE_URL, 'url:', url);
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });
  console.log('[feVerifyLoginPassword.js] SWR state:', { hasData: !!data, error: error?.message, isLoading });

  // Redirect to login page if there's an error (e.g., 500 status)
  useEffect(() => {
    if (error) {
      console.log('[feVerifyLoginPassword.js] error effect → redirect to /pages/login', error?.message);
      navigate('/pages/login');
    }
  }, [error, navigate]);

  // Transform database fields to match component expectations
  const transformedData = useMemo(() => {
    if (!data) return [];
    return data.map((single_EEEEEEEE) => ({
      //id: single.id,
      singles_id: single_EEEEEEEE.singles_id,
      profile_image_url: single_EEEEEEEE.profile_image_fk ? `${API_BASE_URL}/api/photo/${single_EEEEEEEE.profile_image_fk}` : 'profile.jpeg'
    }));
  }, [data]);

  const memoizedValue = useMemo(
    () => ({
      singles: transformedData,
      singlesLoading: isLoading,
      singlesError: error,
      refetch: mutate
    }),
    [transformedData, isLoading, error, mutate]
  );

  return memoizedValue;
}

 