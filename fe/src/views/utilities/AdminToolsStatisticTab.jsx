import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { fetchAdminStatistics } from 'api/adminStatisticsFe';

function totalsItems(totals) {
  return [
    { label: 'Total Users', key: 'usersCount' },
    { label: 'Total Photos', key: 'photosCount' },
    { label: 'Total Messages', key: 'messagesCount' },
    { label: 'Total Postings', key: 'postingsCount' },
    { label: 'Identification Search Runs', key: 'identificationSearchCount' },
    { label: 'Work Email Domain Search Runs', key: 'workEmailDomainSearchCount' },
    { label: 'Academic Record Search Runs', key: 'academicRecordSearchCount' }
  ];
}

export default function AdminToolsStatisticTab({ onError }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminStatistics();
      setStats(data);
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to load admin statistics');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ColorTemplate9TableData.Table topHorizontalScrollbar minTableWidth={980}>
        <ColorTemplate9TableData.HeaderRow gridTemplateColumns="1.5fr repeat(6, 132px)">
          <ColorTemplate9TableData.HeaderCell>Metric</ColorTemplate9TableData.HeaderCell>
          {(stats?.totalsWindows || []).map((w) => (
            <ColorTemplate9TableData.HeaderCell key={w.key}>{w.label}</ColorTemplate9TableData.HeaderCell>
          ))}
        </ColorTemplate9TableData.HeaderRow>
        {totalsItems(stats?.totals).map((item, index) => (
          <ColorTemplate9TableData.BodyRow key={item.label} rowIndex={index} gridTemplateColumns="1.5fr repeat(6, 132px)">
            <ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyText>{item.label}</ColorTemplate9TableData.BodyText>
            </ColorTemplate9TableData.BodyCell>
            {(stats?.totalsWindows || []).map((w) => (
              <ColorTemplate9TableData.BodyCell key={`${item.key}-${w.key}`}>
                <ColorTemplate9TableData.BodyText sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {stats?.totalsHistoryDisplay?.[item.key]?.[w.key] ??
                    stats?.totalsHistory?.[item.key]?.[w.key] ??
                    0}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
            ))}
          </ColorTemplate9TableData.BodyRow>
        ))}
      </ColorTemplate9TableData.Table>
      {stats?.storageEstimateNote ? (
        <ColorTemplate9TableData.BodyText sx={{ opacity: 0.85, fontSize: '0.85rem' }}>
          {stats.storageEstimateNote} Tune via STATS_BYTES_PER_* in backend env.
        </ColorTemplate9TableData.BodyText>
      ) : null}

      <ColorTemplate9TableData.Table topHorizontalScrollbar minTableWidth={720}>
        <ColorTemplate9TableData.HeaderRow gridTemplateColumns="70px 110px 1fr 170px">
          <ColorTemplate9TableData.HeaderCell>#</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>User ID</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>User</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>Refers</ColorTemplate9TableData.HeaderCell>
        </ColorTemplate9TableData.HeaderRow>
        {(stats?.topReferrers || []).map((row, index) => (
          <ColorTemplate9TableData.BodyRow key={`refer-${row.singlesId}-${index}`} rowIndex={index} gridTemplateColumns="70px 110px 1fr 170px">
            <ColorTemplate9TableData.BodyCell><ColorTemplate9TableData.BodyText>{index + 1}</ColorTemplate9TableData.BodyText></ColorTemplate9TableData.BodyCell>
            <ColorTemplate9TableData.BodyCell><ColorTemplate9TableData.BodyText>{row.singlesId}</ColorTemplate9TableData.BodyText></ColorTemplate9TableData.BodyCell>
            <ColorTemplate9TableData.BodyCell><ColorTemplate9TableData.BodyText>{row.userLabel}</ColorTemplate9TableData.BodyText></ColorTemplate9TableData.BodyCell>
            <ColorTemplate9TableData.BodyCell><ColorTemplate9TableData.BodyText sx={{ fontWeight: 700 }}>{row.referCount}</ColorTemplate9TableData.BodyText></ColorTemplate9TableData.BodyCell>
          </ColorTemplate9TableData.BodyRow>
        ))}
      </ColorTemplate9TableData.Table>
    </Box>
  );
}
