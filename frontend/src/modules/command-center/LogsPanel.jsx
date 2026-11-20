/**
 * LogsPanel — the backend's own log lines, every worker merged (slice 6).
 *
 * Reads /api/command-center/logs with level / text / time-window filters,
 * optionally auto-refreshing, and exports a window as a text file. These
 * are the FastAPI process logs (per-worker files under ./logs); container
 * logs for nginx, HAPI, Postgres need the sidecar (slice 10).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { api, useAuth } from '../sdk';

const WINDOWS = [
  { key: '15m', label: 'Last 15 minutes', ms: 15 * 60 * 1000 },
  { key: '1h', label: 'Last hour', ms: 60 * 60 * 1000 },
  { key: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'all', label: 'Everything on disk', ms: null },
];
const LEVEL_COLOR = { DEBUG: 'default', INFO: 'info', WARNING: 'warning', ERROR: 'error', CRITICAL: 'error' };
const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const sinceFor = (windowKey) => {
  const w = WINDOWS.find((x) => x.key === windowKey);
  return w?.ms ? new Date(Date.now() - w.ms).toISOString() : undefined;
};

const LogsPanel = ({ pollMs = 5000 }) => {
  const { user } = useAuth();
  const canView = Array.isArray(user?.permissions) && user.permissions.includes('admin');
  const [level, setLevel] = useState('INFO');
  const [query, setQuery] = useState('');
  const [windowKey, setWindowKey] = useState('1h');
  const [auto, setAuto] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const boxRef = useRef(null);

  const params = useMemo(() => ({ level, q: query.trim() || undefined, since: sinceFor(windowKey), limit: 500 }), [level, query, windowKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/command-center/logs', { params });
      setData(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not load logs'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  useEffect(() => {
    if (!auto || !canView) return undefined;
    const timer = setInterval(() => load().catch(() => {}), pollMs);
    return () => clearInterval(timer);
  }, [auto, canView, load, pollMs]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [data]);

  const exportLogs = async () => {
    setExporting(true);
    setError(null);
    try {
      const response = await api.get('/api/command-center/logs/export', {
        params: { since: sinceFor(windowKey), level }, responseType: 'blob',
      });
      const disposition = response.headers?.['content-disposition'] || '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const name = match ? match[1] : 'wintehr-backend-logs.txt';
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(detailOf(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return <Alert severity="warning">Viewing backend logs needs the <code>admin</code> permission.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel id="log-level-label">Minimum level</InputLabel>
          <Select labelId="log-level-label" label="Minimum level" value={level} onChange={(e) => setLevel(e.target.value)}
            inputProps={{ 'aria-label': 'Minimum level' }}>
            {(data?.levels || ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="log-window-label">Window</InputLabel>
          <Select labelId="log-window-label" label="Window" value={windowKey} onChange={(e) => setWindowKey(e.target.value)}
            inputProps={{ 'aria-label': 'Time window' }}>
            {WINDOWS.map((w) => <MenuItem key={w.key} value={w.key}>{w.label}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Contains" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="logger name or message text" inputProps={{ 'aria-label': 'Contains' }} sx={{ minWidth: 220 }} />
        <FormControlLabel control={<Switch checked={auto} onChange={(e) => setAuto(e.target.checked)} inputProps={{ 'aria-label': 'Auto-refresh' }} />} label="Auto-refresh" />
        <Button size="small" variant="outlined" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
        <Button size="small" variant="outlined" onClick={exportLogs} disabled={exporting}>{exporting ? 'Exporting…' : 'Export window'}</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          {data.lines.length} of {data.total} matching lines from {data.files} file{data.files === 1 ? '' : 's'}
          {data.truncated && ' (showing the newest; narrow the window or filter to see earlier lines)'}
        </Typography>
      )}

      <Paper ref={boxRef} variant="outlined" data-testid="log-lines"
        sx={{ borderRadius: 1, maxHeight: 520, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, bgcolor: 'grey.900', color: 'grey.100', p: 1 }}>
        {!data && !error && <Typography variant="body2" sx={{ color: 'grey.400' }}>Loading…</Typography>}
        {data && data.lines.length === 0 && <Typography variant="body2" sx={{ color: 'grey.400' }}>No log lines match.</Typography>}
        {data && data.lines.map((line, i) => (
          <Box key={`${line.file}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.25, borderBottom: '1px solid', borderColor: 'grey.800' }}>
            <Typography component="span" sx={{ color: 'grey.500', whiteSpace: 'nowrap', fontFamily: 'inherit', fontSize: 'inherit' }}>
              {new Date(line.ts).toLocaleTimeString()}
            </Typography>
            <Chip size="small" label={line.level} color={LEVEL_COLOR[line.level] || 'default'} sx={{ height: 18, fontSize: 10, borderRadius: 1 }} />
            <Typography component="span" sx={{ color: 'grey.400', whiteSpace: 'nowrap', fontFamily: 'inherit', fontSize: 'inherit' }}>
              w{line.pid} {line.logger}
            </Typography>
            <Typography component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 'inherit' }}>
              {line.message}
            </Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  );
};

export default LogsPanel;
