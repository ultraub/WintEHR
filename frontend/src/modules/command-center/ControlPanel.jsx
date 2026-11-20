/**
 * ControlPanel — the control-plane sidecar's view of the deployment (slice 10):
 * container state, docker logs of any allow-listed container, restarts of the
 * restartable ones (system permission, confirmed, audited), an update check
 * against origin, and a read-only view of the rendered nginx config, the
 * compose file, and the .env variable NAMES. Everything goes through
 * /api/command-center/control/...; the sidecar never faces the browser.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { api, useAuth } from '../sdk';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const STATE_COLOR = { running: 'success', exited: 'error', restarting: 'warning', paused: 'warning', absent: 'default' };
const HEALTH_COLOR = { healthy: 'success', unhealthy: 'error', 'health: starting': 'warning' };
const TAILS = [100, 300, 1000, 3000];

const ControlPanel = ({ pollMs = 5000 }) => {
  const { user } = useAuth();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const canView = perms.includes('admin');
  const canAct = perms.includes('system');
  const [control, setControl] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState('');
  const [tail, setTail] = useState(300);
  const [auto, setAuto] = useState(false);
  const [logs, setLogs] = useState(null);
  const [logsError, setLogsError] = useState(null);
  const [pendingRestart, setPendingRestart] = useState(null);
  const [notice, setNotice] = useState(null);
  const [update, setUpdate] = useState(null);
  const [checking, setChecking] = useState(false);
  const [config, setConfig] = useState(null);

  const loadControl = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/api/command-center/control');
      setControl(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not reach the control plane'));
    }
  }, []);

  const loadLogs = useCallback(async () => {
    if (!selected) return;
    setLogsError(null);
    try {
      const response = await api.get(`/api/command-center/control/containers/${encodeURIComponent(selected)}/logs`, { params: { tail } });
      setLogs(response.data);
    } catch (err) {
      setLogsError(detailOf(err, 'Could not load container logs'));
    }
  }, [selected, tail]);

  useEffect(() => {
    if (canView) loadControl();
  }, [canView, loadControl]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!auto || !selected) return undefined;
    const timer = setInterval(() => loadLogs().catch(() => {}), pollMs);
    return () => clearInterval(timer);
  }, [auto, selected, loadLogs, pollMs]);

  const restart = async () => {
    const name = pendingRestart;
    setPendingRestart(null);
    setNotice(null);
    try {
      await api.post(`/api/command-center/control/containers/${encodeURIComponent(name)}/restart`);
      setNotice(`Restart of ${name} accepted. It takes a few seconds; ${name === 'emr-backend' ? 'this page may briefly lose the backend.' : 'refresh to see the new state.'}`);
      setTimeout(() => loadControl().catch(() => {}), 4000);
    } catch (err) {
      setError(detailOf(err, `Restart of ${name} failed`));
    }
  };

  const checkUpdates = async () => {
    setChecking(true);
    try {
      const response = await api.get('/api/command-center/control/update-check');
      setUpdate(response.data);
    } catch (err) {
      setUpdate({ error: detailOf(err, 'Update check failed') });
    } finally {
      setChecking(false);
    }
  };

  const loadConfig = async () => {
    if (config) return;
    try {
      const response = await api.get('/api/command-center/control/config');
      setConfig(response.data);
    } catch (err) {
      setConfig({ error: detailOf(err, 'Could not load configuration') });
    }
  };

  if (!canView) return <Alert severity="warning">The control plane needs the <code>admin</code> permission.</Alert>;
  if (error && !control) return <Alert severity="error">{error}</Alert>;
  if (!control) return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Contacting the control plane…</Typography>;

  if (!control.configured) {
    return (
      <Alert severity="info" data-testid="control-not-configured">
        <strong>Control plane not configured.</strong> {control.how_to} Until then, container logs, restarts, the update check and the config view are unavailable; the backend's own logs are on the Logs tab.
      </Alert>
    );
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {!control.reachable && <Alert severity="warning" sx={{ mb: 1 }}>Sidecar unreachable: {control.error}</Alert>}

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">Containers</Typography>
        <Button size="small" variant="outlined" onClick={loadControl}>Refresh</Button>
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto', mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Container</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Image</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {control.containers.map((c) => (
              <TableRow key={c.name} hover data-testid={`container-${c.name}`}>
                <TableCell><Typography variant="body2" fontWeight={600}>{c.name}</Typography></TableCell>
                <TableCell>
                  <Chip size="small" label={c.state} color={STATE_COLOR[c.state] || 'default'} sx={{ borderRadius: 1, mr: 0.5 }} />
                  {c.health && <Chip size="small" variant="outlined" label={c.health} color={HEALTH_COLOR[c.health] || 'default'} sx={{ borderRadius: 1 }} />}
                </TableCell>
                <TableCell><Typography variant="caption">{c.status}</Typography></TableCell>
                <TableCell><Typography variant="caption" color="text.secondary">{c.image || '—'}</Typography></TableCell>
                <TableCell align="right">
                  <Button size="small" disabled={!c.present} onClick={() => { setSelected(c.name); setLogs(null); }}>Logs</Button>
                  <Button size="small" color="warning" disabled={!canAct || !c.restartable || !c.present}
                    title={!canAct ? 'Needs the system permission' : !c.restartable ? 'Not restartable from here' : undefined}
                    onClick={() => setPendingRestart(c.name)}>Restart</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {selected && (
        <Box sx={{ mb: 2 }} data-testid="container-logs">
          <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Logs: {selected}</Typography>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel id="tail-label">Tail</InputLabel>
              <Select labelId="tail-label" label="Tail" value={tail} onChange={(e) => setTail(Number(e.target.value))} inputProps={{ 'aria-label': 'Tail' }}>
                {TAILS.map((t) => <MenuItem key={t} value={t}>{t} lines</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel control={<Switch checked={auto} onChange={(e) => setAuto(e.target.checked)} inputProps={{ 'aria-label': 'Auto-refresh' }} />} label="Auto-refresh" />
            <Button size="small" variant="outlined" onClick={loadLogs}>Refresh</Button>
          </Stack>
          {logsError && <Alert severity="error" sx={{ mb: 1 }}>{logsError}</Alert>}
          <Paper variant="outlined" sx={{ borderRadius: 1, maxHeight: 420, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, bgcolor: 'grey.900', color: 'grey.100', p: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {!logs && !logsError && 'Loading…'}
            {logs && logs.lines.length === 0 && 'No output.'}
            {logs && logs.lines.join('\n')}
          </Paper>
        </Box>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Paper variant="outlined" sx={{ borderRadius: 1, p: 1.5, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Updates</Typography>
            <Button size="small" variant="outlined" onClick={checkUpdates} disabled={checking}>{checking ? 'Checking…' : 'Check for updates'}</Button>
          </Stack>
          {update && (
            <Box sx={{ mt: 1 }} data-testid="update-result">
              {update.error && <Alert severity="warning" sx={{ mb: 1 }}>{update.error}</Alert>}
              {update.branch && (
                <Typography variant="body2">
                  Branch <code>{update.branch}</code> at <code>{(update.local || '').slice(0, 10)}</code>
                  {update.local_subject ? ` — ${update.local_subject}` : ''}
                </Typography>
              )}
              {update.update_available === true && <Alert severity="info" sx={{ mt: 1 }}>Update available: origin is at <code>{(update.remote || '').slice(0, 10)}</code>. Pull and rebuild on the host (see docs/DEPLOYMENT.md); the sidecar does not deploy.</Alert>}
              {update.update_available === false && <Alert severity="success" sx={{ mt: 1 }}>Up to date with origin.</Alert>}
            </Box>
          )}
          {!update && <Typography variant="caption" color="text.secondary">Compares the checkout on the host with <code>origin</code> (read-only, no fetch).</Typography>}
        </Paper>
      </Stack>

      <Accordion variant="outlined" onChange={(_e, expanded) => expanded && loadConfig()} sx={{ borderRadius: 1 }}>
        <AccordionSummary>
          <Typography variant="subtitle1">Deployment configuration (read-only)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {!config && <Typography variant="body2" color="text.secondary">Loading…</Typography>}
          {config?.error && <Alert severity="warning">{config.error}</Alert>}
          {config && !config.error && (
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2">.env variables set on the host (names only)</Typography>
                <Box sx={{ mt: 0.5 }}>
                  {config.env_keys.length === 0 && <Typography variant="caption" color="text.secondary">none</Typography>}
                  {config.env_keys.map((k) => <Chip key={k} size="small" label={k} variant="outlined" sx={{ borderRadius: 1, mr: 0.5, mb: 0.5, fontFamily: 'monospace' }} />)}
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle2">{config.nginx_path || 'deploy/rendered/nginx.conf'}</Typography>
                <Paper component="pre" variant="outlined" sx={{ borderRadius: 1, p: 1, m: 0, maxHeight: 320, overflow: 'auto', fontSize: 11 }}>
                  {config.nginx ?? 'Not rendered on this host (dev profile, or deploy.sh has not run with --domain).'}
                </Paper>
              </Box>
              <Box>
                <Typography variant="subtitle2">docker-compose.yml</Typography>
                <Paper component="pre" variant="outlined" sx={{ borderRadius: 1, p: 1, m: 0, maxHeight: 320, overflow: 'auto', fontSize: 11 }}>
                  {config.compose ?? 'Not readable.'}
                </Paper>
              </Box>
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>

      <Dialog open={Boolean(pendingRestart)} onClose={() => setPendingRestart(null)}>
        <DialogTitle>Restart {pendingRestart}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Docker will stop and start the container (10 s grace). Requests in flight fail; sessions survive (Redis).
            {pendingRestart === 'emr-backend' && ' Restarting the backend also interrupts this page briefly.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRestart(null)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={restart}>Restart</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ControlPanel;
