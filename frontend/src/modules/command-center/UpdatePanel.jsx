/**
 * UpdatePanel — the Updates card on the Control tab (slices 10 and 14).
 *
 * Check: local HEAD vs origin (ls-remote, instant). Preview: the sidecar
 * fetches origin in a helper container and reports the commits, files by
 * area and whether a fast-forward is possible. Apply (system permission,
 * confirmed): the helper fast-forwards the host checkout to the previewed
 * commit, rebuilds the configured images and recreates the containers.
 * Images only: nginx config and .env are never touched.
 *
 * While the update runs this page polls /control/update/status. The backend
 * and the sidecar are themselves recreated along the way, so failed polls
 * are expected and shown as "restarting", not as errors; the helper is a
 * separate container and its state survives both.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { api } from '../sdk';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const short = (sha) => (sha ? String(sha).slice(0, 10) : '');
const STEP = /^STEP (\d+)\/(\d+)/;

export const progressOf = (message) => {
  const m = STEP.exec(message || '');
  if (!m) return null;
  return ((Number(m[1]) - 1) / Number(m[2])) * 100;
};

const UpdatePanel = ({ canAct, pollMs = 3000 }) => {
  const [update, setUpdate] = useState(null);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [error, setError] = useState(null);
  const polling = useRef(false);

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

  const loadPreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const response = await api.get('/api/command-center/control/update/preview');
      setPreview(response.data);
      if (response.data?.updater?.present) setStatus(response.data.updater);
    } catch (err) {
      setError(detailOf(err, 'Preview failed'));
    } finally {
      setPreviewing(false);
    }
  };

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get('/api/command-center/control/update/status');
      setStatus(response.data);
      setPollError(null);
      return response.data;
    } catch (err) {
      setPollError(detailOf(err, 'unreachable'));
      return null;
    }
  }, []);

  // Resume the view of an update that is running or just finished (page reload mid-update).
  useEffect(() => {
    loadStatus().catch(() => {});
  }, [loadStatus]);

  const running = Boolean(status?.running);
  useEffect(() => {
    if (!running) {
      polling.current = false;
      return undefined;
    }
    polling.current = true;
    const timer = setInterval(() => {
      loadStatus().catch(() => {});
    }, pollMs);
    return () => clearInterval(timer);
  }, [running, loadStatus, pollMs]);

  const apply = async () => {
    setConfirm(false);
    setError(null);
    try {
      await api.post('/api/command-center/control/update/apply', { commit: preview.remote });
      setStatus({ present: true, running: true, lines: [], message: 'STEP 1/4: starting the update helper', commit: preview.remote });
      setPreview(null);
    } catch (err) {
      setError(detailOf(err, 'The update could not be started'));
    }
  };

  const progress = progressOf(status?.message);
  const finished = status?.present && !status.running;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 1.5, flex: 1 }} data-testid="updates">
      <Stack direction="row" alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap" spacing={1}>
        <Typography variant="subtitle1">Updates</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={checkUpdates} disabled={checking}>{checking ? 'Checking…' : 'Check for updates'}</Button>
          <Button size="small" variant="outlined" onClick={loadPreview} disabled={previewing || running}>{previewing ? 'Fetching origin…' : 'Preview update'}</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      {update && !preview && (
        <Box sx={{ mt: 1 }} data-testid="update-result">
          {update.error && <Alert severity="warning" sx={{ mb: 1 }}>{update.error}</Alert>}
          {update.branch && (
            <Typography variant="body2">
              Branch <code>{update.branch}</code> at <code>{short(update.local)}</code>
              {update.local_subject ? ` — ${update.local_subject}` : ''}
            </Typography>
          )}
          {update.update_available === true && <Alert severity="info" sx={{ mt: 1 }}>Update available: origin is at <code>{short(update.remote)}</code>. Preview it to see what changed.</Alert>}
          {update.update_available === false && <Alert severity="success" sx={{ mt: 1 }}>Up to date with origin.</Alert>}
        </Box>
      )}
      {!update && !preview && !status?.present && (
        <Typography variant="caption" color="text.secondary">Check compares the host checkout with <code>origin</code> (no fetch). Preview fetches and lists the change; Apply fast-forwards and rebuilds the app images.</Typography>
      )}

      {preview && (
        <Box sx={{ mt: 1 }} data-testid="update-preview">
          {preview.error && <Alert severity="warning" sx={{ mb: 1 }}>{preview.error}</Alert>}
          <Typography variant="body2">
            Branch <code>{preview.branch}</code>: <code>{short(preview.local)}</code>
            {preview.update_available ? <> → <code>{short(preview.remote)}</code>, {preview.commits.length} commit{preview.commits.length === 1 ? '' : 's'}, {preview.files} file{preview.files === 1 ? '' : 's'} (+{preview.insertions} −{preview.deletions})</> : ' is up to date with origin.'}
          </Typography>
          {preview.update_available && (
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              {Object.entries(preview.areas || {}).map(([area, n]) => <Chip key={area} size="small" variant="outlined" label={`${area}: ${n}`} sx={{ borderRadius: 1 }} />)}
            </Stack>
          )}
          {preview.commits.length > 0 && (
            <Paper component="ul" variant="outlined" sx={{ borderRadius: 1, mt: 1, p: 1, pl: 2, m: 0, maxHeight: 220, overflow: 'auto', fontSize: 12 }}>
              {preview.commits.map((c) => (
                <li key={c.sha}>
                  <code>{short(c.sha).slice(0, 8)}</code> {c.subject}
                  <Typography component="span" variant="caption" color="text.secondary"> — {c.author}{c.date ? `, ${new Date(c.date).toLocaleDateString()}` : ''}</Typography>
                </li>
              ))}
            </Paper>
          )}
          {preview.dirty?.length > 0 && <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>Locally modified on the host: {preview.dirty.join(', ')}.</Alert>}
          {preview.blockers?.length > 0 && <Alert severity="warning" sx={{ mt: 1 }} data-testid="update-blockers">Cannot apply: {preview.blockers.join('; ')}.</Alert>}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
            <Button size="small" variant="contained" color="warning" disabled={!canAct || !preview.can_apply}
              title={!canAct ? 'Needs the system permission' : undefined} onClick={() => setConfirm(true)}>
              Apply update
            </Button>
            <Typography variant="caption" color="text.secondary">
              Rebuilds {(preview.services || []).join(', ')} (profile {preview.profile}) and recreates them. nginx and .env untouched.
            </Typography>
          </Stack>
        </Box>
      )}

      {status?.present && (
        <Box sx={{ mt: 1.5 }} data-testid="update-status">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">{running ? 'Updating' : finished && status.succeeded ? 'Update complete' : 'Update failed'}</Typography>
            {status.commit && <Chip size="small" variant="outlined" label={`to ${short(status.commit)}`} sx={{ borderRadius: 1 }} />}
            {finished && <Chip size="small" color={status.succeeded ? 'success' : 'error'} label={status.succeeded ? 'succeeded' : `exit ${status.exit_code}`} sx={{ borderRadius: 1 }} />}
          </Stack>
          {running && <LinearProgress variant={progress === null ? 'indeterminate' : 'determinate'} value={progress ?? 0} sx={{ my: 1 }} />}
          {status.message && <Typography variant="body2" sx={{ mb: 0.5 }}>{status.message}</Typography>}
          {pollError && running && <Alert severity="info" variant="outlined" sx={{ mb: 1, py: 0 }}>Backend restarting ({pollError}); will keep polling.</Alert>}
          <Paper variant="outlined" sx={{ borderRadius: 1, maxHeight: 240, overflow: 'auto', fontFamily: 'monospace', fontSize: 11, bgcolor: 'grey.900', color: 'grey.100', p: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {(status.lines || []).slice(-60).join('\n') || 'Waiting for output…'}
          </Paper>
          {finished && status.succeeded && (
            <Button size="small" variant="contained" sx={{ mt: 1 }} onClick={() => window.location.reload()}>Reload to use the new build</Button>
          )}
          {finished && !status.succeeded && <Alert severity="error" sx={{ mt: 1 }}>The update did not complete. The host checkout and containers are as the log left them; finish by hand (docs/DEPLOYMENT.md) or fix and apply again.</Alert>}
        </Box>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Apply update?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Fast-forwards <code>{preview?.branch}</code> on the host from <code>{short(preview?.local)}</code> to <code>{short(preview?.remote)}</code>
            {' '}({preview?.commits?.length} commit{preview?.commits?.length === 1 ? '' : 's'}), rebuilds {(preview?.services || []).join(', ')} and recreates those containers.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Image builds take several minutes. The backend, and with it this page, are unavailable while the containers are recreated;
            sessions survive (Redis). nginx configuration and .env are not touched. There is no automatic rollback: the previous
            commit is recorded in the audit trail.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={apply}>Apply update</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default UpdatePanel;
