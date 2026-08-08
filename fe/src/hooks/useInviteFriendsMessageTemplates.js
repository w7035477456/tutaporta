import { useCallback, useEffect, useState } from 'react';
import { fetchPromotionalMessages } from 'api/promotionalMessagesFe';
import { pickRandomInviteFriendsTemplateIndex } from 'constants/inviteFriendsMessages';

export function useInviteFriendsMessageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [templateIndex, setTemplateIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const list = await fetchPromotionalMessages();
        if (cancelled) return;
        setTemplates(list);
        setTemplateIndex(pickRandomInviteFriendsTemplateIndex(list));
      } catch (err) {
        if (!cancelled) {
          setTemplates([]);
          setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load message templates.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickAnother = useCallback(() => {
    setTemplateIndex((prev) => pickRandomInviteFriendsTemplateIndex(templates, prev));
  }, [templates]);

  const template = templates[templateIndex] ?? templates[0] ?? '';

  return { templates, template, templateIndex, loading, error, pickAnother };
}
