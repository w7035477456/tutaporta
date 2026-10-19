import { useEffect, useState } from 'react';
import { fetchRaffleRelationships } from 'api/raffleFe';

/** Map singlesId → raffle relationship ({ events, isMyReferrer, isMyReferee }) for the logged-in member. */
export default function useRaffleRelationships() {
  const [byId, setById] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    fetchRaffleRelationships()
      .then((list) => {
        if (cancelled) return;
        setById(new Map(list.map((r) => [Number(r.singlesId), r])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return byId;
}
