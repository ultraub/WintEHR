/**
 * HistoryCard — the deployment's status over time (slice 17).
 *
 * Reads GET /api/command-center/status/history?hours=N: every status sample in
 * the window (one per Status-tab visit plus the backend's sampler), uptime per
 * component, and incidents (runs of a component being degraded or down).
 *
 * The strip is one block per sample coloured by the overall state with a
 * tooltip; the legend, the uptime table and the incident list carry the same
 * information in text, so nothing is colour-alone.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { api } from '../sdk';

const WINDOWS = [{ hours: 6, label: 'Last 6 hours' }, { hours: 24, label: 'Last 24 hours' }, { hours: 72, label: 'Last 3 days' }, { hours: 168, label: 'Last 7 days' }];
const STATE_COLOR = { ok: 'success.main', degraded: 'warning.main', down: 'error.main' };
const STATE_LABEL = { ok: 'ok', degraded: 'degraded', down: 'down' };
const COMPONENT_LABEL = { fhir: 'HAPI FHIR', database: 'PostgreSQL', redis: 'Redis', terminology: 'Terminology index', vna: 'Imaging VNA', host: 'Host', tls: 'HTTPS certificate' };
const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const when = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const describeSample = (s) => {
  const bad = Object.entries(s.components || {}).filter(([, v]) => v === 'degraded' || v === 'down').map(([k, v]) => `${COMPONENT_LABEL[k] || k} ${v}`);
  return `${when(s.t)} · ${STATE_LABEL[s.overall] || s.overall}${bad.length ? ` (${bad.join(', ')})` : ''} · ${s.source}`;
};

const HistoryCard = ({ refreshKey }) => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/api/command-center/status/history', { params: { hours } });
      setData(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not load the status history'));
    }
  }, [hours]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const samples = data?.samples || [];
  const uptime = Object.entries(data?.uptime || {});

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }} data-testid="history">
      <Stack direction="row" justifyContent="space-between" alignItems="center" useFlexGap flexWrap="wrap" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          History
          {data?.overall_uptime !== null && data?.overall_uptime !== undefined && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>{data.overall_uptime}% of samples fully ok</Typography>
          )}
        </Typography>
        <TextField select size="small" value={hours} onChange={(e) => setHours(Number(e.target.value))} inputProps={{ 'aria-label': 'History window' }} sx={{ minWidth: 150 }}>
          {WINDOWS.map((w) => <MenuItem key={w.hours} value={w.hours}>{w.label}</MenuItem>)}
        </TextField>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {data && samples.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No samples in this window yet. The backend records one every {Math.round((data.sample_seconds || 300) / 60)} minutes and on every Status refresh.
        </Typography>
      )}
      {samples.length > 0 && (
        <>
          <Box sx={{ display: 'flex', gap: '2px', height: 28, alignItems: 'stretch' }} role="img" aria-label={`${samples.length} status samples, oldest left`} data-testid="history-strip">
            {samples.map((s, i) => (
              <Tooltip key={`${s.t}-${i}`} title={describeSample(s)} placement="top" arrow>
                <Box sx={{ flex: 1, minWidth: 2, bgcolor: STATE_COLOR[s.overall] || 'grey.500', borderRadius: 0.5, cursor: 'default' }} data-state={s.overall} />
              </Tooltip>
            ))}
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5, mb: 1.5 }} useFlexGap flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">{when(samples[0].t)} → {when(samples[samples.length - 1].t)} · {samples.length} samples</Typography>
            {Object.entries(STATE_COLOR).map(([state, color]) => (
              <Stack key={state} direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: 0.5 }} />
                <Typography variant="caption">{STATE_LABEL[state]}</Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Uptime by component (share of samples ok or not applicable)</Typography>
              <Table size="small" data-testid="history-uptime">
                <TableBody>
                  {uptime.map(([name, pct]) => (
                    <TableRow key={name}>
                      <TableCell sx={{ py: 0.25 }}>{COMPONENT_LABEL[name] || name}</TableCell>
                      <TableCell align="right" sx={{ py: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                        <Typography component="span" variant="body2" color={pct < 100 ? 'text.primary' : 'text.secondary'}>{pct}%</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Incidents</Typography>
              {(data.incidents || []).length === 0 && <Typography variant="body2" color="text.secondary">None in this window.</Typography>}
              {(data.incidents || []).length > 0 && (
                <Table size="small" data-testid="history-incidents">
                  <TableHead>
                    <TableRow>
                      <TableCell>Component</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>Until</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.incidents.slice(0, 12).map((inc) => (
                      <TableRow key={`${inc.component}-${inc.first_seen}`}>
                        <TableCell sx={{ py: 0.25 }}>{COMPONENT_LABEL[inc.component] || inc.component}</TableCell>
                        <TableCell sx={{ py: 0.25 }}><Chip size="small" label={inc.ongoing ? `${inc.status} · ongoing` : inc.status} color={inc.status === 'down' ? 'error' : 'warning'} variant={inc.ongoing ? 'filled' : 'outlined'} sx={{ borderRadius: 1 }} /></TableCell>
                        <TableCell sx={{ py: 0.25 }}><Typography variant="caption">{when(inc.first_seen)}</Typography></TableCell>
                        <TableCell sx={{ py: 0.25 }}><Typography variant="caption">{inc.ongoing ? 'now' : when(inc.last_seen)} · {inc.samples} sample{inc.samples === 1 ? '' : 's'}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Stack>
        </>
      )}
    </Paper>
  );
};

export default HistoryCard;
