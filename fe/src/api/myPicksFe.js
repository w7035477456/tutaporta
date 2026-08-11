import useSWR, { mutate as globalMutate } from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { notifyRateLimit429 } from 'utils/notifyRateLimit429';
import { getPhotosAlbumCacheBust, subscribePhotosAlbumCacheBust, withPhotoApiCacheBust } from './photoCacheBust';
import { normalizeApprovalStatus } from 'utils/approvalStatusEnum';
import { galleryMediaUrlsFromRow } from 'utils/galleryMediaUrls';

const API_BASE_URL = getApiBaseUrl();

function normalizePostingVisibility(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'friends') return 'friends';
  if (raw === 'myself' || raw === 'me_only' || raw === 'me-only' || raw === 'private') return 'mySelf';
  return 'public';
}

const fetcher = async (url) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    const httpErr = new Error(`Failed to fetch My Picks (${response.status})`);
    httpErr.status = response.status;
    throw httpErr;
  }
  return response.json();
};

export async function postMyPosting(payload) {
  const response = await fetch(`${API_BASE_URL}/api/myPicks/posting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload ?? {})
  });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    let message = `Failed to save posting (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function patchMyPostingVisibility(postId, postingVisibility) {
  const response = await fetch(`${API_BASE_URL}/api/myPicks/posting/${postId}/visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ posting_visibility: postingVisibility })
  });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    let message = `Failed to update posting visibility (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function patchMyPostingContent(postId, content) {
  const response = await fetch(`${API_BASE_URL}/api/myPicks/posting/${postId}/content`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content: content ?? '' })
  });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    let message = `Failed to update posting (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function deleteJson(path) {
  console.info('[myPicksFe][deleteJson] request:start', { path });
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  console.info('[myPicksFe][deleteJson] request:response', { path, status: response.status, ok: response.ok });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    let message = `Delete failed (${response.status})`;
    let responseData = null;
    try {
      const data = await response.json();
      responseData = data;
      if (data?.error) message = data.error;
    } catch {
      // ignore parse error
    }
    console.error('[myPicksFe][deleteJson] request:error', { path, status: response.status, responseData, message });
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  console.info('[myPicksFe][deleteJson] request:success', { path, payload });
  return payload;
}

export function deleteMyPosting(postId) {
  return deleteJson(`/api/myPicks/posting/${postId}`);
}

export function deleteMyPostingPhoto(photoId) {
  return deleteJson(`/api/myPicks/postingPhoto/${photoId}`);
}

export function deletePostingComment(commentId) {
  return deleteJson(`/api/myPicks/postingComments/${commentId}`);
}

async function postingCommentsJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    notifyRateLimit429(response.status);
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export function fetchPostingComments(postId) {
  return postingCommentsJson(`/api/myPicks/posting/${postId}/comments`);
}

export function createPostingComment(photoId, postingText) {
  return postingCommentsJson(`/api/myPicks/postingPhoto/${photoId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ posting_text: postingText })
  });
}

export function togglePostingLike(postId) {
  return postingCommentsJson(`/api/myPicks/posting/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function fetchPostingLikes(postId) {
  return postingCommentsJson(`/api/myPicks/posting/${postId}/likes`);
}

export function fetchApprovedCheckrBioReview(targetSinglesId) {
  const id = Number(targetSinglesId);
  if (!Number.isFinite(id) || id < 1) {
    return Promise.reject(new Error('Invalid member'));
  }
  return postingCommentsJson(`/api/checkr/bio-review/member/${id}`);
}

/** Masked bio rows (hasData + matching status) for Vetted Friends before approval. */
export function fetchMemberCheckrBioReviewPreview(targetSinglesId) {
  const id = Number(targetSinglesId);
  if (!Number.isFinite(id) || id < 1) {
    return Promise.reject(new Error('Invalid member'));
  }
  return postingCommentsJson(`/api/checkr/bio-review/member/${id}/preview`);
}

const MY_PICKS_LIST_URL = `${API_BASE_URL}/api/myPicks/list`;
const MY_PICKS_NOTIFICATIONS_URL = `${API_BASE_URL}/api/myPicks/notifications`;

/** Refetch Picks & Posts list (e.g. after marking interested on All Singles). */
export function invalidateMyPicksListCache() {
  return globalMutate(MY_PICKS_LIST_URL);
}

/** Refetch all cached My Picks feed pages across screens (/myPicks, /vettedFriends). */
export function invalidateMyPicksFeedCache() {
  return globalMutate((key) => typeof key === 'string' && key.includes('/api/myPicks/feed/'));
}

const parseApprovalValue = (value) => normalizeApprovalStatus(value);

function normalizeRequestState(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested' ? 'requested' : 'notrequested';
}

export function useGetMyPicksList() {
  const { data, error, isLoading, mutate } = useSWR(MY_PICKS_LIST_URL, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const myPicksList = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
      const profileVersion = Number(row?.profile_image_fk);
      const profileVersionQuery = Number.isFinite(profileVersion) && profileVersion > 0 ? `?v=${profileVersion}` : '';
      const profilePhotoUrl = row?.singles_id ? `${API_BASE_URL}/api/profile-photo/${row.singles_id}${profileVersionQuery}` : '';
      const firstName = row.first_name ?? '';
      const lastName = row.last_name ?? '';
      const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
      return {
        gallery_image_urls: galleryMediaUrlsFromRow(row, API_BASE_URL),
        singles_id: Number(row.singles_id),
        prefix: row.prefix ?? null,
        member_id: row.member_id ?? null,
        alias: row.alias ?? null,
        brief_bio_request: normalizeRequestState(row.brief_bio_request),
        full_bio_request: normalizeRequestState(row.full_bio_request),
        brief_bio_request_approval: parseApprovalValue(row.brief_bio_request_approval),
        full_bio_request_approval: parseApprovalValue(row.full_bio_request_approval),
        vetting_status: String(row.vetting_status ?? 'unverified').trim().toLowerCase(),
        can_view_full_bio: row.can_view_full_bio === true || row.can_view_full_bio === 1 || String(row.can_view_full_bio).toLowerCase() === 'true',
        profile_image_url: profilePhotoUrl,
        profile_info: {
          name: fullName || null,
          photo: profilePhotoUrl || null,
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
      myPicksList,
      myPicksListLoading: isLoading,
      myPicksListError: error,
      refetchMyPicksList: mutate
    }),
    [myPicksList, isLoading, error, mutate]
  );
}

/**
 * Bell post notifications — no interval polling.
 * @param {boolean} enabled — hook active
 * @param {{ autoFetch?: boolean }} options — autoFetch false: only fetch on mutate (Refresh Posts / bell open)
 */
export function useGetMyPicksPostNotifications(enabled = true, options = {}) {
  const autoFetch = options.autoFetch !== false;
  const url = enabled ? MY_PICKS_NOTIFICATIONS_URL : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: autoFetch,
    refreshInterval: 0
  });

  const postNotifications = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.notifications)) return [];
    return data.notifications.map((row) => ({
      post_id: Number(row.post_id),
      content: row.content ?? '',
      created_at: row.created_at ?? null,
      author_singles_id: Number(row.author_singles_id),
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      alias: row.alias ?? null
    }));
  }, [data]);

  return useMemo(
    () => ({
      postNotifications,
      postNotificationsLoading: isLoading,
      postNotificationsError: error,
      refetchPostNotifications: mutate
    }),
    [postNotifications, isLoading, error, mutate]
  );
}

export function dismissMyPicksPostNotification(postId) {
  return postingCommentsJson('/api/myPicks/notifications/dismiss', {
    method: 'POST',
    body: JSON.stringify({ postId })
  });
}

export function dismissAllMyPicksPostNotifications(postIds) {
  return postingCommentsJson('/api/myPicks/notifications/dismissAll', {
    method: 'POST',
    body: JSON.stringify({ postIds: Array.isArray(postIds) ? postIds : [] })
  });
}

export function fetchMyPicksFeedPage(targetSinglesId, options = {}) {
  const targetId = Number(targetSinglesId);
  if (!Number.isFinite(targetId) || targetId < 1) {
    return Promise.reject(new Error('Invalid target singles id'));
  }
  const params = new URLSearchParams();
  const limit = Number(options?.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.trunc(limit)));
  }
  const beforeCreatedAt = String(options?.beforeCreatedAt ?? '').trim();
  if (beforeCreatedAt) {
    params.set('beforeCreatedAt', beforeCreatedAt);
  }
  const beforePostId = Number(options?.beforePostId);
  if (Number.isFinite(beforePostId) && beforePostId > 0) {
    params.set('beforePostId', String(Math.trunc(beforePostId)));
  }
  const visibilityFeed = String(options?.visibilityFeed ?? '').trim().toLowerCase();
  if (visibilityFeed === 'public' || visibilityFeed === 'friends') {
    params.set('visibilityFeed', visibilityFeed);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetcher(`${API_BASE_URL}/api/myPicks/feed/${targetId}${suffix}`).then((payload) => normalizeMyPicksFeedPayload(payload));
}

function normalizePhotoUrl(value, photoId) {
  const raw = String(value ?? '').trim();
  const fallback = Number.isFinite(Number(photoId)) && Number(photoId) > 0 ? `${API_BASE_URL}/api/photo/${Number(photoId)}` : '';
  let resolved = '';
  if (!raw) resolved = fallback;
  else {
    const photoApi = raw.match(/^https?:\/\/[^/]+(\/api\/photo\/\d+)/i);
    if (photoApi) resolved = `${API_BASE_URL}${photoApi[1]}`;
    else if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const parsed = new URL(raw);
        if (/^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) {
          resolved = `${API_BASE_URL}${parsed.pathname}${parsed.search}`;
        } else {
          resolved = raw;
        }
      } catch {
        resolved = fallback;
      }
    } else if (raw.startsWith('/api/photo/')) resolved = `${API_BASE_URL}${raw}`;
    else if (/^api\/photo\/\d+$/i.test(raw)) resolved = `${API_BASE_URL}/${raw}`;
    else if (!raw.startsWith('/')) resolved = fallback;
    else resolved = `${API_BASE_URL}${raw}`;
  }
  return withPhotoApiCacheBust(resolved);
}

function normalizeMyPicksFeedPayload(data) {
  if (!data || typeof data !== 'object') return null;
  const posts = Array.isArray(data.posts)
    ? data.posts.map((post) => ({
        post_id: Number(post.post_id),
        content: post.content ?? '',
        created_at: post.created_at ?? null,
        posting_visibility: normalizePostingVisibility(post.posting_visibility),
        photos: Array.isArray(post.photos)
          ? post.photos.map((photo) => ({
              photo_id: Number(photo.photo_id),
              sort_order: Number(photo.sort_order ?? 0),
              photo_url: normalizePhotoUrl(photo.photo_url, photo.photo_id),
              comment_count: Number(photo.comment_count ?? 0),
              like_count: Number(photo.like_count ?? 0)
            }))
          : [],
        post_owner_id: post.post_owner_id == null ? null : Number(post.post_owner_id),
        reposted_from_singles_id:
          post.reposted_from_singles_id == null ? null : Number(post.reposted_from_singles_id),
        reposted_from_alias: post.reposted_from_alias ?? null,
        reposted_from_member_id:
          post.reposted_from_member_id == null ? null : Number(post.reposted_from_member_id),
        reposted_from_prefix: post.reposted_from_prefix ?? null,
        posting_comment_count: Number(post.posting_comment_count ?? 0),
        posting_like_count: Number(post.posting_like_count ?? 0),
        viewer_has_liked: post.viewer_has_liked === true || post.viewer_has_liked === 1,
        comments: Array.isArray(post.comments)
          ? post.comments.map((comment) => ({
              comment_id: Number(comment.comment_id),
              singles_id: Number(comment.singles_id),
              comment_text: comment.comment_text ?? '',
              created_at: comment.created_at ?? null
            }))
          : []
      }))
    : [];
  return {
    target_singles_id: Number(data.target_singles_id),
    can_view_full_bio: Boolean(data.can_view_full_bio),
    can_view_private_posts: Boolean(data.can_view_private_posts),
    message: data.message ?? '',
    has_more: data.has_more === true || data.has_more === 1,
    next_cursor:
      data?.next_cursor && typeof data.next_cursor === 'object'
        ? {
            created_at: data.next_cursor.created_at ?? null,
            post_id: Number(data.next_cursor.post_id)
          }
        : null,
    posts
  };
}

export function useGetMyPicksFeed(targetSinglesId, options = {}) {
  const targetId = Number(targetSinglesId);
  const canQuery = Number.isFinite(targetId) && targetId > 0;
  const [photosCacheBust, setPhotosCacheBust] = useState(() => getPhotosAlbumCacheBust());
  useEffect(() => subscribePhotosAlbumCacheBust(setPhotosCacheBust), []);
  const params = new URLSearchParams();
  const limit = Number(options?.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.trunc(limit)));
  }
  const visibilityFeed = String(options?.visibilityFeed ?? '').trim().toLowerCase();
  if (visibilityFeed === 'public' || visibilityFeed === 'friends') {
    params.set('visibilityFeed', visibilityFeed);
  }
  const queryString = params.toString();
  const url = canQuery ? `${API_BASE_URL}/api/myPicks/feed/${targetId}${queryString ? `?${queryString}` : ''}` : null;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });

  const myPicksFeed = useMemo(() => normalizeMyPicksFeedPayload(data), [data, photosCacheBust]);

  return useMemo(
    () => ({
      myPicksFeed,
      myPicksFeedLoading: isLoading,
      myPicksFeedError: error,
      refetchMyPicksFeed: mutate
    }),
    [myPicksFeed, isLoading, error, mutate]
  );
}
