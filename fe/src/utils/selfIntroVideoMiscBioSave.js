import {
  SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS,
  SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS
} from 'constants/selfIntroVideoFavoriteFields';

const MISC_BIO_SAVE_FIELD_KEYS = [
  ...SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS.filter(({ key }) => key !== 'city_state').map(({ key }) => key),
  ...SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS.map(({ key }) => key)
];

/** Build checkr bio-review draft keys for POST /api/checkr/bio-review/save. */
export function buildSelfIntroMiscBioDraft(favorites = {}) {
  const draft = {};
  for (const key of MISC_BIO_SAVE_FIELD_KEYS) {
    draft[`miscBio.${key}`] = String(favorites[key] ?? '');
  }
  const cityState = String(favorites.city_state ?? '').trim();
  if (cityState) {
    draft['briefBio.current_city'] = cityState;
  }
  return draft;
}
