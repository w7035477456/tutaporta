import api from './axios';

export async function updateVetBioMatchingStatus({ memberId, rowKey, namePart, vettedStatus }) {
  const { data } = await api.post('/api/admin/vet-bio/matching-status', {
    memberId,
    rowKey,
    namePart,
    vettedStatus
  });
  return data;
}
