import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { fetchBpmInstances, resetBpmAll, startBpmInstance } from 'api/eClassifiedsBpmFe';

export default function ProcessHistoryStory() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const rows = await fetchBpmInstances();
    setInstances(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Failed to load history');
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function resubmit(listingId, rowInstanceId) {
    if (!listingId) return;
    setBusyId(rowInstanceId);
    setError('');
    try {
      // Completed BPMN instances are finished — start a new run so it waits at ManualReview again.
      await startBpmInstance(listingId);
      await refresh();
      navigate('/eClassifieds/pending');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Resubmit failed');
    } finally {
      setBusyId('');
    }
  }

  async function onResetAll() {
    setResetting(true);
    setError('');
    try {
      await resetBpmAll();
      setInstances([]);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="ecsb-canvas-wrap">
      <div className="ecsb-canvas-card">
        <div className="ecsb-addon-title">Process History</div>
        <p className="ecsb-muted" style={{ marginTop: 0 }}>
          In-memory demo instances (resets on BE restart). A completed run cannot be rewound — use{' '}
          <strong>Resubmit for review</strong> to start a new process that appears under Pending Approvals.
        </p>
        {instances.length === 0 ? (
          <p className="ecsb-muted">
            No runs yet.{' '}
            <RouterLink to="/eClassifieds/bpm-demo" style={{ color: '#029cfd', fontWeight: 700 }}>
              Open BPM Demo
            </RouterLink>
          </p>
        ) : (
          <table className="ecsb-table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Listing</th>
                <th>Status</th>
                <th>Decision</th>
                <th>Started</th>
                <th>Finished</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {instances.map((row) => (
                <tr key={row.instanceId}>
                  <td>
                    <span className="ecsb-code">{row.instanceId}</span>
                  </td>
                  <td>
                    {row.listingId} — {row.listing?.title}
                  </td>
                  <td>
                    <span
                      className={`ecsb-badge${
                        row.status === 'completed' ? ' ecsb-badge-done' : row.status === 'waiting' ? ' ecsb-badge-wait' : ''
                      }`}
                    >
                      {row.status}
                      {row.waitingOn ? ` · ${row.waitingOn}` : ''}
                    </span>
                  </td>
                  <td>{row.decision || '—'}</td>
                  <td>{row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'}</td>
                  <td>{row.finishedAt ? new Date(row.finishedAt).toLocaleString() : '—'}</td>
                  <td>
                    {row.status === 'completed' ? (
                      <button
                        type="button"
                        className="ecsb-btn ecsb-btn-primary"
                        disabled={Boolean(busyId) || resetting}
                        onClick={() => resubmit(row.listingId, row.instanceId)}
                      >
                        {busyId === row.instanceId ? 'Starting…' : 'Resubmit for review'}
                      </button>
                    ) : (
                      <span className="ecsb-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error ? <div className="ecsb-error">{error}</div> : null}
        <div className="ecsb-row" style={{ marginTop: 16, marginBottom: 0 }}>
          <button
            type="button"
            className="ecsb-btn ecsb-btn-danger"
            disabled={resetting || Boolean(busyId)}
            onClick={onResetAll}
          >
            {resetting ? 'Resetting…' : 'Reset All'}
          </button>
          <span className="ecsb-muted">Wipe all demo instances and start over (same as a fresh BE start).</span>
        </div>
      </div>
    </div>
  );
}
