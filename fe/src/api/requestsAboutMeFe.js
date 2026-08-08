import useSWR from 'swr';
import { useMemo } from 'react';

import { getApiBaseUrl } from 'config/apiBaseUrl';
import { notifyRateLimit429 } from 'utils/notifyRateLimit429';
import { ALL_VET_BIO_MATCH_FIELDS } from 'utils/receivedBioRequestDisplay';
import { parseBooleanEnumRaw } from 'utils/booleanEnum';
import { normalizeApprovalStatus } from 'utils/approvalStatusEnum';
import { galleryMediaUrlsFromRow } from 'utils/galleryMediaUrls';

const API_BASE_URL = getApiBaseUrl();

const fetcher = async (url) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    const httpErr = new Error(`Failed to fetch requests about me (${response.status})`);
    httpErr.status = response.status;
    throw httpErr;
  }
  return response.json();
};

/** Matches DB `brief_bio_request_approval` / `full_bio_request_approval` values. */
export function normalizeRequestApproval(value) {
  return normalizeApprovalStatus(value);
}

const normalizeRequestFlag = (value) => {
  return String(value ?? '').trim().toLowerCase() === 'requested' ? 'requested' : 'notrequested';
};

export function useGetRequestsAboutMe() {
  const url = `${API_BASE_URL}/api/requestsAboutMe`;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });

  const requestsAboutMe = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((row) => ({
      requests_id: row.requests_id,
      singles_id_from: Number(row.singles_id_from),
      singles_id_to: Number(row.singles_id_to),
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      alias: row.alias ?? null,
      profile_image_url: row?.singles_id_from ? `${API_BASE_URL}/api/profile-photo/${row.singles_id_from}` : 'profile.jpeg',
      gallery_image_urls: galleryMediaUrlsFromRow(row, API_BASE_URL),
      vetted_status: row?.vetted_basic_status === true || row?.vetted_basic_status === 'true' || row?.vetted_basic_status === 1,
      brief_bio_request: normalizeRequestFlag(row.brief_bio_request),
      full_bio_request: normalizeRequestFlag(row.full_bio_request),
      brief_bio_request_approval: normalizeRequestApproval(row.brief_bio_request_approval),
      full_bio_request_approval: normalizeRequestApproval(row.full_bio_request_approval),
      brief_approval_date: row.brief_approval_date ?? null,
      full_approval_date: row.full_approval_date ?? null,
      block_user: parseBooleanEnumRaw(row.block_user),
      ...ALL_VET_BIO_MATCH_FIELDS.reduce((vetFields, field) => {
        vetFields[field] = row[field] ?? null;
        return vetFields;
      }, {})
    }));
  }, [data]);

  return useMemo(
    () => ({
      requestsAboutMe,
      requestsAboutMeLoading: isLoading,
      requestsAboutMeError: error,
      refetch: mutate
    }),
    [requestsAboutMe, isLoading, error, mutate]
  );
}

export async function postRequestAboutMeBlock(singles_id_from, block) {
  const response = await fetch(`${API_BASE_URL}/api/requestsAboutMe/block`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      singles_id_from: Number(singles_id_from),
      block: Boolean(block)
    })
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Failed to update block status (${response.status}) ${text}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export function useGetRequestsAboutMeSettings() {
  const url = `${API_BASE_URL}/api/requestsAboutMe/settings`;
  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });

  return useMemo(
    () => ({
      approvedViewingDurationMonths: Number.isFinite(Number(data?.approved_viewing_duration_months))
        ? Number(data.approved_viewing_duration_months)
        : 12,
      approvalStayDurationDays: Number.isFinite(Number(data?.approval_stay_duration_days))
        ? Number(data.approval_stay_duration_days)
        : 90,
      settingsLoading: isLoading,
      settingsError: error
    }),
    [data, isLoading, error]
  );
}

export async function postRequestAboutMeRequestFlag(singles_id_from, requestType, requestValue) {
  const body =
    requestType === 'basic'
      ? { singles_id_from: Number(singles_id_from), request_type: 'basic', brief_bio_request: requestValue }
      : { singles_id_from: Number(singles_id_from), request_type: 'details', full_bio_request: requestValue };

  const response = await fetch(`${API_BASE_URL}/api/requestsAboutMe/requestFlag`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Failed to update request flag (${response.status}) ${text}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function postRequestAboutMeApproval(singles_id_from, approvalType, approval) {
  const response = await fetch(`${API_BASE_URL}/api/requestsAboutMe/approval`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      singles_id_from: Number(singles_id_from),
      approval_type: approvalType,
      approval
    })
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Failed to update approval (${response.status}) ${text}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}
