import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import {
  fetchAdminCloudflareAsnList,
  fetchAdminGithubAsnList,
  fetchAdminPostgresAsnList,
  syncAdminCloudflareFromPostgres,
  syncAdminPostgresFromGithub
} from 'api/adminBlockedAsnFe';

const columnShellSx = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 420,
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 0,
  overflow: 'hidden',
  bgcolor: '#fff'
};

const columnHeaderSx = {
  bgcolor: 'var(--theme-primary-color)',
  color: '#fff',
  textAlign: 'center',
  fontWeight: 700,
  py: 1,
  px: 1,
  fontSize: '1rem'
};

const listBodySx = {
  flex: 1,
  minHeight: 280,
  overflow: 'auto',
  p: 1.5,
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
};

function formatAsnLines(asns) {
  if (!Array.isArray(asns) || asns.length === 0) return '';
  return asns.map((n) => `AS${n}`).join('\n');
}

function AsnColumn({ title, asns, meta, busy, onFetch, onSync, showSync }) {
  return (
    <Box sx={columnShellSx}>
      <Box sx={{ display: 'flex', gap: 1, p: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        <ColorTemplate9TableData.Button type="button" disabled={busy} onClick={onFetch}>
          {busy ? '…' : 'Fetch'}
        </ColorTemplate9TableData.Button>
        {showSync ? (
          <ColorTemplate9TableData.Button type="button" disabled={busy} onClick={onSync}>
            {busy ? '…' : 'Sync'}
          </ColorTemplate9TableData.Button>
        ) : null}
      </Box>
      <Box sx={listBodySx}>
        {busy ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : asns.length ? (
          formatAsnLines(asns)
        ) : (
          <ColorTemplate9TableData.BodyText sx={{ opacity: 0.7 }}>
            Click Fetch to load ASNs.
          </ColorTemplate9TableData.BodyText>
        )}
      </Box>
      {meta ? (
        <ColorTemplate9TableData.BodyText sx={{ px: 1, pb: 0.5, fontSize: '0.75rem', opacity: 0.85 }}>
          {meta}
        </ColorTemplate9TableData.BodyText>
      ) : null}
      <Box sx={columnHeaderSx}>{title}</Box>
    </Box>
  );
}

export default function AdminToolsAsnTab({ onError }) {
  const [githubAsns, setGithubAsns] = useState([]);
  const [githubMeta, setGithubMeta] = useState('');
  const [postgresAsns, setPostgresAsns] = useState([]);
  const [postgresMeta, setPostgresMeta] = useState('');
  const [cloudflareAsns, setCloudflareAsns] = useState([]);
  const [cloudflareMeta, setCloudflareMeta] = useState('');
  const [busyGithub, setBusyGithub] = useState(false);
  const [busyPostgres, setBusyPostgres] = useState(false);
  const [busyCloudflare, setBusyCloudflare] = useState(false);

  const handleErr = useCallback(
    (err, fallback) => {
      onError?.(err?.response?.data?.error || err?.message || fallback);
    },
    [onError]
  );

  const fetchGithub = useCallback(async () => {
    setBusyGithub(true);
    onError?.('');
    try {
      const data = await fetchAdminGithubAsnList();
      setGithubAsns(Array.isArray(data?.asns) ? data.asns : []);
      setGithubMeta(`${data?.count ?? 0} ASNs${data?.url ? ` · ${data.url}` : ''}`);
    } catch (err) {
      handleErr(err, 'Failed to fetch GitHub ASN list');
      setGithubAsns([]);
      setGithubMeta('');
    } finally {
      setBusyGithub(false);
    }
  }, [handleErr, onError]);

  const fetchPostgres = useCallback(async () => {
    setBusyPostgres(true);
    onError?.('');
    try {
      const data = await fetchAdminPostgresAsnList();
      setPostgresAsns(Array.isArray(data?.asns) ? data.asns : []);
      setPostgresMeta(`${data?.count ?? 0} ASNs · global.blocked_asn_vpn`);
    } catch (err) {
      handleErr(err, 'Failed to fetch Postgres ASN list');
      setPostgresAsns([]);
      setPostgresMeta('');
    } finally {
      setBusyPostgres(false);
    }
  }, [handleErr, onError]);

  const syncPostgres = useCallback(async () => {
    setBusyPostgres(true);
    onError?.('');
    try {
      const data = await syncAdminPostgresFromGithub();
      setPostgresAsns(Array.isArray(data?.asns) ? data.asns : []);
      setPostgresMeta(`Synced ${data?.count ?? 0} ASNs from GitHub → Postgres`);
    } catch (err) {
      handleErr(err, 'Failed to sync Postgres from GitHub');
    } finally {
      setBusyPostgres(false);
    }
  }, [handleErr, onError]);

  const fetchCloudflare = useCallback(async () => {
    setBusyCloudflare(true);
    onError?.('');
    try {
      const data = await fetchAdminCloudflareAsnList();
      setCloudflareAsns(Array.isArray(data?.asns) ? data.asns : []);
      const extra = Array.isArray(data?.extraAsns) && data.extraAsns.length ? ` · +${data.extraAsns.length} extra in env` : '';
      setCloudflareMeta(
        `${data?.count ?? 0} ASNs${data?.ruleId ? ` · rule ${data.ruleId}` : ''}${extra}`
      );
    } catch (err) {
      handleErr(err, 'Failed to fetch Cloudflare ASN list');
      setCloudflareAsns([]);
      setCloudflareMeta('');
    } finally {
      setBusyCloudflare(false);
    }
  }, [handleErr, onError]);

  const syncCloudflare = useCallback(async () => {
    setBusyCloudflare(true);
    onError?.('');
    try {
      const data = await syncAdminCloudflareFromPostgres();
      setCloudflareAsns(Array.isArray(data?.cloudflare?.asns) ? data.cloudflare.asns : data?.asns ?? []);
      const cf = data?.cloudflare;
      if (cf?.unchanged) {
        setCloudflareMeta(`Unchanged · ${cf.count ?? 0} ASNs on Cloudflare`);
      } else {
        setCloudflareMeta(
          `Synced from Postgres · ${cf?.count ?? data?.count ?? 0} ASNs` +
            (cf?.added?.length ? ` · +${cf.added.length}` : '') +
            (cf?.removed?.length ? ` · -${cf.removed.length}` : '')
        );
      }
    } catch (err) {
      handleErr(err, 'Failed to sync Cloudflare from Postgres');
    } finally {
      setBusyCloudflare(false);
    }
  }, [handleErr, onError]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        gap: 2,
        alignItems: 'stretch'
      }}
    >
      <AsnColumn
        title="Github ASN"
        asns={githubAsns}
        meta={githubMeta}
        busy={busyGithub}
        onFetch={() => void fetchGithub()}
      />
      <AsnColumn
        title="Postgres ASN"
        asns={postgresAsns}
        meta={postgresMeta}
        busy={busyPostgres}
        onFetch={() => void fetchPostgres()}
        onSync={() => void syncPostgres()}
        showSync
      />
      <AsnColumn
        title="CloudFlares ASN"
        asns={cloudflareAsns}
        meta={cloudflareMeta}
        busy={busyCloudflare}
        onFetch={() => void fetchCloudflare()}
        onSync={() => void syncCloudflare()}
        showSync
      />
    </Box>
  );
}
