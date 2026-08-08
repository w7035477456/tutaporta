import useSWR from 'swr';
import api from './axios';

const fetcher = ([url]) => api.get(url).then((res) => res.data);

export function useMyAlbumVideos(singlesId) {
  const ownerId = Number(singlesId);
  const key = Number.isFinite(ownerId) && ownerId > 0 ? ['/api/myAlbumVideos', ownerId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: false
  });
  return {
    albumVideos: key && Array.isArray(data) ? data : [],
    myAlbumVideosLoading: Boolean(key) && isLoading,
    myAlbumVideosError: error,
    refetchMyAlbumVideos: mutate
  };
}

export async function updateMyVideoType(videoId, type) {
  const { data } = await api.patch(`/api/myVideos/${videoId}/type`, { type });
  return data;
}

export async function deleteMyVideo(videoId) {
  const { data } = await api.delete(`/api/myVideos/${videoId}`);
  return data;
}
