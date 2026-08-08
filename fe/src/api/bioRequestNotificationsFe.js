import useSWR from 'swr';
import { useMemo } from 'react';
import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();
const BIO_REQUEST_NOTIFICATIONS_URL = `${API_BASE_URL}/api/bioRequests/notifications`;
const BIO_REQUEST_PENDING_COUNT_URL = `${API_BASE_URL}/api/bioRequests/pendingCount`;
const BIO_RESPONSE_PENDING_COUNT_URL = `${API_BASE_URL}/api/bioResponses/pendingCount`;

async function fetcher(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
}

/** Incoming brief/full bio request notifications for the bell. */
export function useGetBioRequestNotifications(enabled = true, options = {}) {
  const autoFetch = options.autoFetch !== false;
  const url = enabled ? BIO_REQUEST_NOTIFICATIONS_URL : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: autoFetch,
    refreshInterval: 0
  });

  const bioRequestNotifications = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.notifications)) return [];
    return data.notifications.map((row) => ({
      requester_singles_id: Number(row.requester_singles_id),
      created_at: row.created_at ?? null,
      alias: row.alias ?? null,
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      brief_bio_request: row.brief_bio_request ?? 'notrequested',
      full_bio_request: row.full_bio_request ?? 'notrequested',
      message: row.message ?? ''
    }));
  }, [data]);

  return useMemo(
    () => ({
      bioRequestNotifications,
      bioRequestNotificationsLoading: isLoading,
      bioRequestNotificationsError: error,
      refetchBioRequestNotifications: mutate
    }),
    [bioRequestNotifications, isLoading, error, mutate]
  );
}

export function dismissBioRequestNotification(requesterSinglesId) {
  return postJson('/api/bioRequests/notifications/dismiss', { requesterSinglesId });
}

export function dismissAllBioRequestNotifications(requesterSinglesIds) {
  return postJson('/api/bioRequests/notifications/dismissAll', {
    requesterSinglesIds: Array.isArray(requesterSinglesIds) ? requesterSinglesIds : []
  });
}

/** Sidebar badge: pending brief/full requests awaiting approve/deny. */
export function useGetReceivedBioRequestsPendingCount(enabled = true, options = {}) {
  const autoFetch = options.autoFetch !== false;
  const url = enabled ? BIO_REQUEST_PENDING_COUNT_URL : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateOnMount: autoFetch,
    refreshInterval: 0
  });

  const pendingCount = useMemo(() => {
    const raw = Number(data?.pending_count);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [data]);

  return useMemo(
    () => ({
      pendingCount,
      pendingCountLoading: isLoading,
      pendingCountError: error,
      refetchPendingCount: mutate
    }),
    [pendingCount, isLoading, error, mutate]
  );
}

/** Sidebar badge: unread brief/full bio responses on Vetted Friends (requester view). */
export function useGetVettedFriendsBioResponsePendingCount(enabled = true, options = {}) {
  const autoFetch = options.autoFetch !== false;
  const url = enabled ? BIO_RESPONSE_PENDING_COUNT_URL : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateOnMount: autoFetch,
    refreshInterval: 0
  });

  const responsePendingCount = useMemo(() => {
    const raw = Number(data?.pending_count);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [data]);

  return useMemo(
    () => ({
      responsePendingCount,
      bioResponsePendingCountLoading: isLoading,
      bioResponsePendingCountError: error,
      refetchBioResponsePendingCount: mutate
    }),
    [responsePendingCount, isLoading, error, mutate]
  );
}

export function dismissBioResponseNotification(recipientSinglesId, bioKinds) {
  return postJson('/api/bioResponses/notifications/dismiss', {
    recipientSinglesId,
    bioKinds: Array.isArray(bioKinds) ? bioKinds : undefined
  });
}

export function dismissAllBioResponseNotifications() {
  return postJson('/api/bioResponses/notifications/dismissAll', {});
}
