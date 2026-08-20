import { useCallback, useEffect, useState } from 'react';
import ClassifiedBpmnViewer from './ClassifiedBpmnViewer';
import {
  completeBpmInstance,
  fetchBpmDiagram,
  fetchBpmInstance,
  fetchBpmListings,
  fetchBpmPending,
  startBpmInstance
} from 'api/eClassifiedsBpmFe';

const EMPTY_IDS = [];

export default function BpmDemoStory() {
  const [xml, setXml] = useState('');
  const [listings, setListings] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [instance, setInstance] = useState(null);
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshPending = useCallback(async () => {
    const rows = await fetchBpmPending();
    setPending(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [diagram, list] = await Promise.all([fetchBpmDiagram(), fetchBpmListings()]);
        if (cancelled) return;
        setXml(diagram?.xml || '');
        setListings(list);
        if (list[0]?.id) setSelectedListingId(list[0].id);
        await refreshPending();
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Failed to load demo');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPending]);

  async function onStart() {
    if (!selectedListingId) return;
    setBusy(true);
    setError('');
    try {
      const snap = await startBpmInstance(selectedListingId);
      setInstance(snap);
      await refreshPending();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Start failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(decision) {
    if (!instance?.instanceId) return;
    setBusy(true);
    setError('');
    try {
      const snap = await completeBpmInstance(instance.instanceId, decision);
      setInstance(snap);
      await refreshPending();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Complete failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSelectPending(instanceId) {
    setBusy(true);
    setError('');
    try {
      const snap = await fetchBpmInstance(instanceId);
      setInstance(snap);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Load failed');
    } finally {
      setBusy(false);
    }
  }

  const waitingReview = instance?.status === 'waiting' && instance?.waitingOn === 'ManualReview';

  return (
    <>
      <div className="ecsb-canvas-wrap">
        <div className="ecsb-canvas-card">
          <ClassifiedBpmnViewer
            xml={xml}
            currentActivityIds={instance?.currentActivityIds || EMPTY_IDS}
            completedActivityIds={instance?.completedActivityIds || EMPTY_IDS}
          />
        </div>
      </div>
      <div className="ecsb-addon">
        <div className="ecsb-addon-title">Controls</div>
        <div className="ecsb-row">
          <label className="ecsb-muted" htmlFor="ecsb-listing">
            Fake listing
          </label>
          <select
            id="ecsb-listing"
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            disabled={busy}
            style={{ font: 'inherit', padding: '6px 8px', borderRadius: 4, border: '1px solid #e3e6eb' }}
          >
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} — {l.title} (${l.price})
              </option>
            ))}
          </select>
          <button type="button" className="ecsb-btn ecsb-btn-primary" disabled={busy || !selectedListingId} onClick={onStart}>
            Start moderation
          </button>
          <button type="button" className="ecsb-btn ecsb-btn-success" disabled={busy || !waitingReview} onClick={() => onDecide('approve')}>
            Approve
          </button>
          <button type="button" className="ecsb-btn ecsb-btn-danger" disabled={busy || !waitingReview} onClick={() => onDecide('reject')}>
            Reject
          </button>
        </div>

        {instance ? (
          <div className="ecsb-row ecsb-muted">
            <span>
              Instance <span className="ecsb-code">{instance.instanceId}</span>
            </span>
            <span
              className={`ecsb-badge${
                instance.status === 'completed' ? ' ecsb-badge-done' : instance.status === 'waiting' ? ' ecsb-badge-wait' : ''
              }`}
            >
              {instance.status}
              {instance.waitingOn ? ` · ${instance.waitingOn}` : ''}
              {instance.decision ? ` · ${instance.decision}` : ''}
            </span>
          </div>
        ) : (
          <p className="ecsb-muted">Start a process to highlight the current step on the diagram.</p>
        )}

        {pending.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <div className="ecsb-addon-title">Waiting on ManualReview</div>
            <div className="ecsb-row">
              {pending.map((p) => (
                <button key={p.instanceId} type="button" className="ecsb-btn" disabled={busy} onClick={() => onSelectPending(p.instanceId)}>
                  {p.listingId} · {p.listing?.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="ecsb-error">{error}</div> : null}
      </div>
    </>
  );
}
