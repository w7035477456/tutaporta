import api from './axios';

/** AI profile paragraph from picked words (+ optional custom line). Pass `previous` for a different version. */
export async function generateProfileParagraph({ words, custom = '', previous = '' }) {
  const { data } = await api.post('/api/myStory/profileWriter', { words, custom, previous });
  return String(data?.paragraph || '');
}
