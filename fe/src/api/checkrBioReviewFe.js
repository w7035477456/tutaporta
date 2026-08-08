import api from './axios';

export async function saveCheckrBioReviewDraft(draft) {
  const { data } = await api.post('/api/checkr/bio-review/save', { draft });
  return data;
}

export async function saveCheckrBioReviewField({ draftKey, value, resetVetting = true }) {
  const { data } = await api.post('/api/checkr/bio-review/field-save', {
    draftKey,
    value,
    resetVetting
  });
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
