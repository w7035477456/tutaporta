import useSWR from 'swr';
import { useMemo } from 'react';
import { getApiBaseUrl } from 'config/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();
const PAYMENT_NOTIFICATIONS_URL = `${API_BASE_URL}/api/settings/payment/notifications`;

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

/** Bell balance-history notifications — fetch on bell open / manual refresh. */
export function useGetPaymentBalanceNotifications(enabled = true, options = {}) {
  const autoFetch = options.autoFetch !== false;
  const url = enabled ? PAYMENT_NOTIFICATIONS_URL : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: autoFetch,
    refreshInterval: 0
  });

  const balanceNotifications = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.notifications)) return [];
    return data.notifications.map((row) => ({
      payment_id: Number(row.payment_id),
      description: row.description ?? '',
      created_at: row.created_at ?? null
    }));
  }, [data]);

  return useMemo(
    () => ({
      balanceNotifications,
      balanceNotificationsLoading: isLoading,
      balanceNotificationsError: error,
      refetchBalanceNotifications: mutate
    }),
    [balanceNotifications, isLoading, error, mutate]
  );
}

export function dismissPaymentBalanceNotification(paymentId) {
  return postJson('/api/settings/payment/notifications/dismiss', { paymentId });
}

export function dismissAllPaymentBalanceNotifications(paymentIds) {
  return postJson('/api/settings/payment/notifications/dismissAll', {
    paymentIds: Array.isArray(paymentIds) ? paymentIds : []
  });
}
