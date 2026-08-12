import useSWR, { mutate as globalMutate } from 'swr';
import { useMemo } from 'react';

import { getApiBaseUrl } from 'config/apiBaseUrl';
import { invalidateMyPicksListCache } from 'api/myPicksFe';
import { notifyRateLimit429 } from 'utils/notifyRateLimit429';
import { galleryMediaUrlsFromRow } from 'utils/galleryMediaUrls';

const API_BASE_URL = getApiBaseUrl();

const fetcher = async (url) => {
  console.log('[allSinglesFe] fetcher: starting fetch', { url, credentials: 'include' });
  const fetchOptions = { credentials: 'include' }; // send cookies (JWT) - required for requireAuth
  let response;
  try {
    response = await fetch(url, fetchOptions);
    console.log('[allSinglesFe] fetcher: response received', {
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
  } catch (fetchErr) {
    console.error('[allSinglesFe] fetcher: fetch() threw', {
      url,
      errorName: fetchErr?.name,
      errorMessage: fetchErr?.message,
      errorStack: fetchErr?.stack,
      fullError: fetchErr
    });
    if (fetchErr && typeof fetchErr === 'object') {
      fetchErr.status = 0;
    }
    throw fetchErr;
  }
  if (!response.ok) {
    notifyRateLimit429(response.status);
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch (_) {
      bodyText = '(could not read body)';
    }
    console.error('[allSinglesFe] fetcher: response not ok', {
      url,
      status: response.status,
      statusText: response.statusText,
      bodyPreview: bodyText?.slice?.(0, 500)
    });
    const httpErr = new Error(`Failed to fetch singles (${response.status} ${response.statusText})`);
    httpErr.status = response.status;
    throw httpErr;
  }
  try {
    const data = await response.json();
    console.log('[allSinglesFe] fetcher: parsed JSON successfully', { url, count: data?.length ?? 'N/A' });
    return data;
  } catch (parseErr) {
    console.error('[allSinglesFe] fetcher: JSON parse failed', {
      url,
      errorMessage: parseErr?.message,
      errorStack: parseErr?.stack
    });
    throw parseErr;
  }
};

const endpoints = {
  key: 'api/allSingles',
  list: '/api/allSingles'
};

/** Refetch All Singles list (e.g. after removing a pick on My Picks). */
export function invalidateAllSinglesCache() {
  return globalMutate(`${API_BASE_URL}${endpoints.list}`);
}

export async function postMarkInterested(singlesIdTo) {
  const res = await fetch(`${API_BASE_URL}/api/markInterested`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ singles_id_to: singlesIdTo })
  });
  if (!res.ok) {
    notifyRateLimit429(res.status);
    let msg = `Failed to mark interested (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const payload = await res.json();
  await invalidateMyPicksListCache();
  return payload;
}

export function useGetAllSingles() {
  const url = `${API_BASE_URL}${endpoints.list}`;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  });

  // Transform database fields to match component expectations
  const transformedData = useMemo(() => {
    if (!data) return [];
    return data.map((single_EEEEEEEE) => {
      const vs = single_EEEEEEEE.vetted_basic_status;
      const vetted_basic_status =
        vs === true || vs === 'true' || vs === 't' || vs === 1 || vs === '1';
      let gallery_image_urls = galleryMediaUrlsFromRow(single_EEEEEEEE, API_BASE_URL);
      if (gallery_image_urls.length === 0 && single_EEEEEEEE.profile_image_fk) {
        gallery_image_urls = [`${API_BASE_URL}/api/photo/${Number(single_EEEEEEEE.profile_image_fk)}`];
      }
      return {
        singles_id: single_EEEEEEEE.singles_id,
        prefix: single_EEEEEEEE.prefix ?? null,
        member_id: single_EEEEEEEE.member_id ?? null,
        alias: single_EEEEEEEE.alias ?? null,
        profile_image_url: single_EEEEEEEE.singles_id ? `${API_BASE_URL}/api/profile-photo/${single_EEEEEEEE.singles_id}` : 'profile.jpeg',
        gallery_image_urls,
        vetted_basic_status
      };
    });
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

 