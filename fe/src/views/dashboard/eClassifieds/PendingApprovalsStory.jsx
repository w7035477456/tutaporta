import { useCallback, useEffect, useState } from 'react';
import { completeBpmInstance, fetchBpmPending } from 'api/eClassifiedsBpmFe';

export default function PendingApprovalsStory() {
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const rows = await fetchBpmPending();
    setPending(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Failed to load pending');
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function decide(instanceId, decision) {
    setBusyId(instanceId);
    setError('');
    try {
      await completeBpmInstance(instanceId, decision);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Decision failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="ecsb-canvas-wrap">
      <div className="ecsb-canvas-card">
        <div className="ecsb-addon-title">Pending Approvals</div>
        <p className="ecsb-muted" style={{ marginTop: 0 }}>
          Instances waiting on the <strong>Moderator review</strong> user task.
        </p>
        {pending.length === 0 ? (
          <p className="ecsb-muted">No pending reviews. Submit a listing from My Listings or BPM Demo.</p>
        ) : (
          <table className="ecsb-table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Listing</th>
                <th>Seller</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.instanceId}>
                  <td>
                    <span className="ecsb-code">{p.instanceId}</span>
                  </td>
                  <td>
                    {p.listingId} — {p.listing?.title} (${p.listing?.price})
                  </td>
                  <td>{p.listing?.seller}</td>
                  <td>{p.startedAt ? new Date(p.startedAt).toLocaleString() : '—'}</td>
                  <td>
                    <div className="ecsb-row" style={{ marginBottom: 0 }}>
                      <button
                        type="button"
                        className="ecsb-btn ecsb-btn-success"
                        disabled={Boolean(busyId)}
                        onClick={() => decide(p.instanceId, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ecsb-btn ecsb-btn-danger"
                        disabled={Boolean(busyId)}
                        onClick={() => decide(p.instanceId, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error ? <div className="ecsb-error">{error}</div> : null}
      </div>
    </div>
  );
}
