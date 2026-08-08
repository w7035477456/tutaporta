import useSWR, { mutate as globalMutate } from 'swr';
import { useMemo } from 'react';
import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { calcSelfReportBioAverageCompletedPercent } from 'utils/receivedBioRequestDisplay';

const API_BASE_URL = getApiBaseUrl();
export const CHECKR_BIO_REVIEW_SWR_KEY = `${API_BASE_URL}/api/checkr/bio-review`;

async function fetcher(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
}

export function revalidateCheckrBioReviewCache() {
  return globalMutate(CHECKR_BIO_REVIEW_SWR_KEY);
}

/** Push latest bio-review payload into the sidebar SWR cache (no extra GET). */
export function seedCheckrBioReviewCache(data) {
  return globalMutate(CHECKR_BIO_REVIEW_SWR_KEY, data, { revalidate: false });
}

export async function saveCheckrBioReviewDraft(draft) {
  const { data } = await api.post('/api/checkr/bio-review/save', { draft });
  void revalidateCheckrBioReviewCache();
  return data;
}

export async function saveCheckrBioReviewField({ draftKey, value, resetVetting = true }) {
  const { data } = await api.post('/api/checkr/bio-review/field-save', {
    draftKey,
    value,
    resetVetting
  });
  void revalidateCheckrBioReviewCache();
  return data;
}

/** Reset profilephoto_vetted to Not Started and clear match date/note. */
export async function resetProfilePhotoVetting() {
  return saveCheckrBioReviewField({
    draftKey: 'briefBio.profilePhotoVettingReset',
    value: '',
    resetVetting: true
  });
}

/** Sidebar: Brief+Full bio average completion % for My Self-Report-Bio. */
export function useSelfReportBioCompletedPercent(enabled = true) {
  const url = enabled ? CHECKR_BIO_REVIEW_SWR_KEY : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateOnMount: true,
    refreshInterval: 0
  });

  const completedPercent = useMemo(() => {
    if (!data) return null;
    return calcSelfReportBioAverageCompletedPercent(data);
  }, [data]);

  return useMemo(
    () => ({
      completedPercent,
      completedPercentLoading: isLoading,
      completedPercentError: error,
      refetchCompletedPercent: mutate
    }),
    [completedPercent, isLoading, error, mutate]
  );
}
