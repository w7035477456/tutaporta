import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBpmListings, startBpmInstance } from 'api/eClassifiedsBpmFe';
import MyStorybookTable from './MyStorybookTable';

export default function MyListingsStory() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchBpmListings()
      .then((rows) => {
        if (!cancelled) setListings(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Failed to load listings');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitForReview(listingId) {
    setBusyId(listingId);
    setError('');
    try {
      await startBpmInstance(listingId);
      navigate('/eClassifieds/pending');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Submit failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="ecsb-canvas-wrap">
      <div className="ecsb-canvas-card">
        <div className="ecsb-addon-title">My Listings (static demo)</div>
        <p className="ecsb-muted" style={{ marginTop: 0 }}>
          Fake classifieds. Submit starts the Classified Ad Moderation process and waits at Manual Review.
        </p>
        <MyStorybookTable listings={listings} busyId={busyId} onSubmitForReview={submitForReview} />
        {error ? <div className="ecsb-error">{error}</div> : null}
      </div>
    </div>
  );
}
