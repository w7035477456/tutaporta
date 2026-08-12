import { mutate as globalMutate } from 'swr';
import useSWR from 'swr';
import { useMemo } from 'react';

import { getApiBaseUrl } from 'config/apiBaseUrl';
import { notifyRateLimit429 } from 'utils/notifyRateLimit429';
import { buildProfilePhotoUrl } from 'utils/profilePhotoUrl';
import { parseBooleanEnumRaw } from 'utils/booleanEnum';
import { normalizeApprovalStatus } from 'utils/approvalStatusEnum';
import { galleryMediaUrlsFromRow, privateGalleryMediaUrlsFromRow, publicGalleryMediaUrlsFromRow } from 'utils/galleryMediaUrls';

const API_BASE_URL = getApiBaseUrl();
const REQUESTED_SINGLES_URL = `${API_BASE_URL}/api/requestedSingles`;

/** Refetch Acquaint. & Buddies list after admin status changes, etc. */
export function invalidateRequestedSinglesCache() {
  return globalMutate(REQUESTED_SINGLES_URL);
}

const fetcher = async (url) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    const httpErr = new Error(`Failed to fetch outgoing requests (${response.status})`);
    httpErr.status = response.status;
    throw httpErr;
  }
  return response.json();
};

export async function fetchRequestedSinglesPoem() {
  const response = await fetch(`${API_BASE_URL}/api/requestedSingles/poem`, { credentials: 'include' });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    const httpErr = new Error(`Failed to fetch poem (${response.status})`);
    httpErr.status = response.status;
    throw httpErr;
  }
  return response.json();
}

/** Tri-state strings for section bucketing and labels. */
const parseApprovalValue = (value) => normalizeApprovalStatus(value);

/**
 * Count fields that are fully done for vetting. DB often uses "Vetted" / booleans;
 * Interested list API uses "Completed" in some environments — accept both.
 */
function isCompletedStatus(value) {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'completed' || s === 'vetted';
}

function vettingCompletionFromRequestedRow(row) {
  const basicCompletedCount = [
    row?.name_verification_status,
    row?.photo_verification_status,
    row?.age_verification_status,
    row?.current_city_verification_status
  ].filter((v) => isCompletedStatus(v)).length;
  const detailCompletedCount = [
    row?.education_verification_status,
    row?.career_verification_status,
    row?.children_verification_status,
    row?.home_city_verification_status,
    row?.religion_verification_status,
    row?.hobbies_verification_status
  ].filter((v) => isCompletedStatus(v)).length;
  return { basicCompletedCount, detailCompletedCount };
}

function normalizeRequestState(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested' ? 'requested' : 'notrequested';
}

export function useGetRequestsSent() {
  const url = REQUESTED_SINGLES_URL;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  });

  const requestsSent = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
      const firstName = row.first_name ?? '';
      const lastName = row.last_name ?? '';
      const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
      const { basicCompletedCount, detailCompletedCount } = vettingCompletionFromRequestedRow(row);
      const publicGalleryUrls = publicGalleryMediaUrlsFromRow(row, API_BASE_URL);
      return {
      requests_id: row.requests_id,
      singles_id_from: Number(row.singles_id_from),
      singles_id_to: Number(row.singles_id_to),
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      alias: row.alias ?? null,
      profile_image_url: buildProfilePhotoUrl(row.singles_id_to, row.profile_image_fk),
      gallery_image_urls: publicGalleryUrls.length ? publicGalleryUrls : galleryMediaUrlsFromRow(row, API_BASE_URL),
      public_gallery_image_urls: publicGalleryUrls,
      friend_gallery_image_urls: privateGalleryMediaUrlsFromRow(row, API_BASE_URL),
      vetted_status:
        row?.vetted_status === true ||
        row?.vetted_status === 'true' ||
        row?.vetted_status === 1 ||
        row?.vetted_basic_status === true ||
        row?.vetted_basic_status === 'true' ||
        row?.vetted_basic_status === 1,
      brief_bio_request: normalizeRequestState(row.brief_bio_request),
      full_bio_request: normalizeRequestState(row.full_bio_request),
      brief_paid: parseBooleanEnumRaw(row.brief_paid),
      full_paid: parseBooleanEnumRaw(row.full_paid),
      brief_bio_request_approval: parseApprovalValue(row.brief_bio_request_approval),
      full_bio_request_approval: parseApprovalValue(row.full_bio_request_approval),
      block_user: parseBooleanEnumRaw(row.block_user),
      vetting_completion: {
        basicCompletedCount,
        detailCompletedCount
      },
      profile_info: {
        name: fullName || null,
        photo: buildProfilePhotoUrl(row.singles_id_to, row.profile_image_fk),
        age: row.age ?? null,
        currentCity: row.current_city ?? null,
        education: row.education ?? null,
        career: row.career ?? null,
        children: row.children ?? null,
        homeCity: row.home_city ?? null,
        countryOfBirth: row.country_of_birth ?? null,
        religion: row.religion ?? null,
        hobbies: row.hobbies ?? null
      },
      profile_vetting: {
        name: {
          status: row.name_verification_status ?? null,
          note: row.name_vetted_note ?? null,
          date: row.name_vetted_date ?? null
        },
        photo: {
          status: row.photo_verification_status ?? null,
          note: row.photo_vetted_note ?? null,
          date: row.photo_vetted_date ?? null
        },
        age: {
          status: row.age_verification_status ?? null,
          note: row.age_vetted_note ?? null,
          date: row.age_vetted_date ?? null
        },
        currentCity: {
          status: row.current_city_verification_status ?? null,
          note: row.current_city_vetted_note ?? null,
          date: row.current_city_vetted_date ?? null
        },
        education: {
          status: row.education_verification_status ?? null,
          note: row.education_vetted_note ?? null,
          date: row.education_vetted_date ?? null
        },
        career: {
          status: row.career_verification_status ?? null,
          note: row.career_vetted_note ?? null,
          date: row.career_vetted_date ?? null
        },
        children: {
          status: row.children_verification_status ?? null,
          note: row.children_vetted_note ?? null,
          date: row.children_vetted_date ?? null
        },
        homeCity: {
          status: row.home_city_verification_status ?? null,
          note: row.home_city_vetted_note ?? null,
          date: row.home_city_vetted_date ?? null
        },
        countryOfBirth: {
          status: row.country_of_birth_verification_status ?? null,
          note: row.country_of_birth_vetted_note ?? null,
          date: row.country_of_birth_vetted_date ?? null
        },
        religion: {
          status: row.religion_verification_status ?? null,
          note: row.religion_vetted_note ?? null,
          date: row.religion_vetted_date ?? null
        },
        hobbies: {
          status: row.hobbies_verification_status ?? null,
          note: row.hobbies_vetted_note ?? null,
          date: row.hobbies_vetted_date ?? null
        }
      }
    };
    });
  }, [data]);

  return useMemo(
    () => ({
      requestsSent,
      requestsSentLoading: isLoading,
      requestsSentError: error,
      refetch: mutate
    }),
    [requestsSent, isLoading, error, mutate]
  );
}

export async function postRequestSentBlock(singles_id_to, block) {
  const response = await fetch(`${API_BASE_URL}/api/requestedSingles/block`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      singles_id_to: Number(singles_id_to),
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
