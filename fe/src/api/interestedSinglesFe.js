import useSWR from 'swr';
import { useMemo } from 'react';

import { getApiBaseUrl } from 'config/apiBaseUrl';
import { notifyRateLimit429 } from 'utils/notifyRateLimit429';
import { galleryMediaUrlsFromRow } from 'utils/galleryMediaUrls';

const API_BASE_URL = getApiBaseUrl();

const fetcher = async (url) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    const httpErr = new Error(`Failed to fetch interested singles (${response.status})`);
    httpErr.status = response.status;
    throw httpErr;
  }
  return response.json();
};

const endpoints = {
  key: 'api/interestedSingles',
  list: '/api/interestedSingles'
};

function isCompletedStatus(value) {
  return String(value ?? '').trim().toLowerCase() === 'completed';
}

function normalizeRequestState(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested' ? 'requested' : 'notrequested';
}

export async function postNotInterested(singlesIdTo) {
  const res = await fetch(`${API_BASE_URL}/api/notInterested`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ singles_id_to: singlesIdTo })
  });
  if (!res.ok) {
    notifyRateLimit429(res.status);
    let msg = `Failed to update interest (${res.status})`;
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
  return res.json();
}

export async function postInterestedRequestInfo(singlesIdTo, payload) {
  const res = await fetch(`${API_BASE_URL}/api/interested/requestInfo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      singles_id_to: singlesIdTo,
      ...payload
    })
  });
  if (!res.ok) {
    notifyRateLimit429(res.status);
    let msg = `Failed to update request info (${res.status})`;
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
  return res.json();
}

export function useGetInterestedSingles() {
  const url = `${API_BASE_URL}${endpoints.list}`;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });

  // Transform database fields to match component expectations
  const transformedData = useMemo(() => {
    if (!data) return [];
    // console.log('Raw API data:', JSON.stringify(data, null, 2));
    // if (data.length > 0) {
    //   console.log('First item keys:', Object.keys(data[0]));
    //   console.log('First item full:', data[0]);
    // }
    return data.map((single_EEEEEEEE, index_FFFFFFFF) => {
      // Ensure we're accessing the field correctly - check all possible variations
      // const singles_id_to = single_EEEEEEEE?.singles_id_to ?? 
      //                      single_EEEEEEEE?.singles_id ??
      //                      single_EEEEEEEE?.['singles_id_to'] ??
      //                      single_EEEEEEEE?.['singles_id'] ??
      //                      single_EEEEEEEE?.['SINGLES_ID_TO'] ??
      //                      `unknown_${index_FFFFFFFF}`;
      
      // Ensure we have a valid ID - if still null/undefined, use index as fallback
      // const validId = singles_id_to != null ? singles_id_to : `fallback_${index_FFFFFFFF}`;
      
      let gallery_image_urls = galleryMediaUrlsFromRow(single_EEEEEEEE, API_BASE_URL);
      if (gallery_image_urls.length === 0 && single_EEEEEEEE?.profile_image_fk) {
        gallery_image_urls = [`${API_BASE_URL}/api/photo/${Number(single_EEEEEEEE.profile_image_fk)}`];
      }
      const basicCompletedCount = [
        single_EEEEEEEE?.name_vetted,
        single_EEEEEEEE?.photo_vetted,
        single_EEEEEEEE?.age_vetted,
        single_EEEEEEEE?.city_vetted
      ].filter((v) => isCompletedStatus(v)).length;
      const detailCompletedCount = [
        single_EEEEEEEE?.education_vetted,
        single_EEEEEEEE?.career_vetted,
        single_EEEEEEEE?.children_vetted,
        single_EEEEEEEE?.home_city_vetted,
        single_EEEEEEEE?.religion_vetted,
        single_EEEEEEEE?.hobbies_vetted
      ].filter((v) => isCompletedStatus(v)).length;
      console.log(
        '[InterestedSingles] basic Completed count',
        { singles_id: single_EEEEEEEE.singles_id_to, completed: basicCompletedCount }
      );
      console.log(
        '[InterestedSingles] detail Completed count',
        { singles_id: single_EEEEEEEE.singles_id_to, completed: detailCompletedCount }
      );
      const result = {
        // singles_id_to: validId,
        singles_id_to: single_EEEEEEEE.singles_id_to,
        prefix: single_EEEEEEEE.prefix ?? null,
        member_id: single_EEEEEEEE.member_id ?? null,
        alias: single_EEEEEEEE.alias ?? null,
        profile_image_url: single_EEEEEEEE?.singles_id_to ? `${API_BASE_URL}/api/profile-photo/${single_EEEEEEEE.singles_id_to}` : 'profile.jpeg',
        gallery_image_urls,
        brief_bio_request: normalizeRequestState(single_EEEEEEEE?.brief_bio_request),
        full_bio_request: normalizeRequestState(single_EEEEEEEE?.full_bio_request),
        vetted_basic_status: single_EEEEEEEE?.vetted_basic_status === true || single_EEEEEEEE?.vetted_basic_status === 'true' || single_EEEEEEEE?.vetted_basic_status === 1,
        vetting_completion: {
          basicCompletedCount,
          detailCompletedCount
        }
      };
      // console.log('Original item:', single_EEEEEEEE);
      // console.log('Transformed item:', result);
      // console.log('singles_id_to found:', validId);
      return result;
    });
  }, [data]);

  const memoizedValue = useMemo(
    () => ({
      interestedSingles: transformedData,
      interestedSinglesLoading: isLoading,
      interestedSinglesError: error,
      refetch: mutate
    }),
    [transformedData, isLoading, error, mutate]
  );

  return memoizedValue;
}

 