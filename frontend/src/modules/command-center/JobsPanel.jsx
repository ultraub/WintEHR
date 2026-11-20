/**
 * JobsPanel — start, watch, and cancel Command Center jobs (slice 4).
 *
 * Talks to /api/command-center/jobs*. Polls rather than listening on the
 * websocket: the backend's websocket manager is per uvicorn worker, so a
 * broadcast from the worker running a job would miss most clients.
 *
 * Starting and cancelling need the `system` permission; everyone with
 * `admin` can watch. Forms are generated from each kind's param_schema.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { api, useAuth } from '../sdk';

const ACTIVE = new Set(['queued', 'running']);

const STATUS_COLOR = {
  queued: 'info',
  running: 'info',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'warning',
  lost: 'warning',
};

export const StatusChip = ({ status }) => (
  <Chip
    size="small"
    label={status}
    color={STATUS_COLOR[status] || 'default'}
    sx={{ textTransform: 'uppercase', fontWeight: 600, borderRadius: 1 }}
  />
);

const defaultsFor = (schema = {}) =>
  Object.fromEntries(Object.entries(schema).map(([key, field]) => [key, field.default ?? '']));

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const formatWhen = (iso) => (iso ? new Date(iso).toLocaleString() : '');

const durationOf = (job) => {
  if (!job.started_at) return '';
  const end = job.finished_at ? new Date(job.finished_at) : new Date();
  const seconds = Math.max(0, Math.round((end - new Date(job.started_at)) / 1000));
  return seconds < 90 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
};

/** One form field from a param_schema entry. */
const ParamField = ({ name, field, value, onChange, disabled }) => {
  if (field.type === 'bool') {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={Boolean(value)}
            onChange={(e) => onChange(name, e.target.checked)}
            disabled={disabled}
            inputProps={{ 'aria-label': field.label }}
          />
        }
        label={field.label}
      />
    );
  }
  if (field.type === 'enum') {
    const id = `job-param-${name}`;
    return (
      <FormControl size="small" fullWidth disabled={disabled}>
        <InputLabel id={`${id}-label`}>{field.label}</InputLabel>
        <Select
          labelId={`${id}-label`}
          id={id}
          label={field.label}
          value={value ?? ''}
          onChange={(e) => onChange(name, e.target.value)}
        >
          {(field.options || []).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }
  return (
    <TextField
      size="small"
      fullWidth
      type={field.type === 'int' ? 'number' : 'text'}
      label={field.label}
      value={value ?? ''}
      onChange={(e) => onChange(name, e.target.value)}
      inputProps={{ min: field.min, max: field.max, 'aria-label': field.label }}
      disabled={disabled}
    />
  );
};

const JobsPanel = ({ pollMs = 2000 }) => {
  const { user } = useAuth();
  const canRun = Array.isArray(user?.permissions) && user.permissions.includes('system');

  const [kinds, setKinds] = useState([]);
  const [settings, setSettings] = useState({});
  const [jobs, setJobs] = useState([]);
  const [kindKey, setKindKey] = useState('');
  const [params, setParams] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [log, setLog] = useState({ text: '', offset: 0, jobId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const logRef = useRef(null);

  const kind = useMemo(() => kinds.find((k) => k.key === kindKey), [kinds, kindKey]);
  const activeJob = useMemo(() => jobs.find((j) => ACTIVE.has(j.status)), [jobs]);
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedId) || activeJob || jobs[0],
    [jobs, selectedId, activeJob],
  );

  const loadJobs = useCallback(async () => {
    const response = await api.get('/api/command-center/jobs');
    setJobs(response.data);
    return response.data;
  }, []);

  // Initial load: kinds, settings (to warn about unset secrets), jobs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [kindsRes, settingsRes] = await Promise.all([
          api.get('/api/command-center/jobs/kinds'),
          api.get('/api/command-center/settings'),
        ]);
        if (cancelled) return;
        setKinds(kindsRes.data);
        setSettings(Object.fromEntries(settingsRes.data.map((s) => [s.key, s])));
        if (kindsRes.data.length) {
          setKindKey(kindsRes.data[0].key);
          setParams(defaultsFor(kindsRes.data[0].param_schema));
        }
        await loadJobs();
      } catch (err) {
        if (!cancelled) setError(detailOf(err, 'Could not load jobs'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadJobs]);

  // Poll the job list while something is active.
  useEffect(() => {
    if (!activeJob) return undefined;
    const timer = setInterval(() => {
      loadJobs().catch(() => {});
    }, pollMs);
    return () => clearInterval(timer);
  }, [activeJob, loadJobs, pollMs]);

  // Tail the selected job's log incrementally.
  useEffect(() => {
    if (!selectedJob) return undefined;
    let cancelled = false;
    let offset = log.jobId === selectedJob.id ? log.offset : 0;
    if (log.jobId !== selectedJob.id) setLog({ text: '', offset: 0, jobId: selectedJob.id });

    const tick = async () => {
      try {
        const response = await api.get(`/api/command-center/jobs/${selectedJob.id}/log`, {
          params: { offset },
        });
        if (cancelled) return;
        const chunk = response.data;
        if (chunk.text) {
          offset = chunk.next_offset;
          setLog((prev) => ({
            jobId: selectedJob.id,
            offset: chunk.next_offset,
            text: (prev.jobId === selectedJob.id ? prev.text : '') + chunk.text,
          }));
        }
        return chunk.finished;
      } catch {
        return false;
      }
    };

    tick();
    if (!ACTIVE.has(selectedJob.status)) return () => { cancelled = true; };
    const timer = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.id, selectedJob?.status, pollMs]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.text]);

  const chooseKind = (key) => {
    setKindKey(key);
    const next = kinds.find((k) => k.key === key);
    setParams(defaultsFor(next?.param_schema));
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await api.post('/api/command-center/jobs', { kind: kindKey, params });
      setSelectedId(response.data.id);
      await loadJobs();
    } catch (err) {
      setError(detailOf(err, 'Could not start the job'));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async (job) => {
    setError(null);
    try {
      await api.post(`/api/command-center/jobs/${job.id}/cancel`);
      await loadJobs();
    } catch (err) {
      setError(detailOf(err, 'Could not cancel the job'));
    }
  };

  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        Loading jobs…
      </Typography>
    );
  }

  const missingSettings = (kind?.required_settings || []).filter((key) => !settings[key]?.is_set);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Start a job
          </Typography>
          {!canRun && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Starting jobs needs the <code>system</code> permission. You can watch jobs here.
            </Alert>
          )}
          <Stack spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="job-kind-label">Job</InputLabel>
              <Select
                labelId="job-kind-label"
                id="job-kind"
                label="Job"
                value={kindKey}
                onChange={(e) => chooseKind(e.target.value)}
              >
                {kinds.map((k) => (
                  <MenuItem key={k.key} value={k.key}>
                    {k.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {kind && (
              <Typography variant="body2" color="text.secondary">
                {kind.description}
              </Typography>
            )}
            {kind?.notes && (
              <Alert severity="info" variant="outlined">
                {kind.notes}
              </Alert>
            )}
            {missingSettings.length > 0 && (
              <Alert severity="warning">
                This job needs {missingSettings.map((k) => settings[k]?.label || k).join(', ')} to be set
                first (Settings).
              </Alert>
            )}
            {kind &&
              Object.entries(kind.param_schema || {}).map(([name, field]) => (
                <ParamField
                  key={name}
                  name={name}
                  field={field}
                  value={params[name]}
                  onChange={(n, v) => setParams((p) => ({ ...p, [n]: v }))}
                  disabled={!canRun || Boolean(activeJob)}
                />
              ))}
            <Button
              variant="contained"
              onClick={start}
              disabled={!canRun || !kind || Boolean(activeJob) || starting}
            >
              {activeJob ? 'A job is already running' : starting ? 'Starting…' : 'Start'}
            </Button>
          </Stack>
        </Paper>
      </Grid>

      <Grid item xs={12} md={7}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {selectedJob ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {kinds.find((k) => k.key === selectedJob.kind)?.label || selectedJob.kind}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {selectedJob.id}
                  </Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedJob.message || ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <StatusChip status={selectedJob.status} />
                {ACTIVE.has(selectedJob.status) && canRun && (
                  <Button size="small" color="warning" variant="outlined" onClick={() => cancel(selectedJob)}
                    disabled={selectedJob.cancel_requested}>
                    {selectedJob.cancel_requested ? 'Cancelling…' : 'Cancel'}
                  </Button>
                )}
              </Stack>
            </Stack>
            <LinearProgress
              variant={selectedJob.progress == null && ACTIVE.has(selectedJob.status) ? 'indeterminate' : 'determinate'}
              value={Math.round((selectedJob.progress || 0) * 100)}
              sx={{ mb: 1, height: 8, borderRadius: 1 }}
              aria-label="job progress"
            />
            <Box
              ref={logRef}
              component="pre"
              data-testid="job-log"
              sx={{
                m: 0,
                p: 1.5,
                maxHeight: 360,
                overflow: 'auto',
                fontSize: 12,
                lineHeight: 1.4,
                bgcolor: 'grey.900',
                color: 'grey.100',
                borderRadius: 1,
                whiteSpace: 'pre-wrap',
              }}
            >
              {log.jobId === selectedJob.id && log.text ? log.text : '(no output yet)'}
            </Box>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No jobs have run on this deployment yet.
            </Typography>
          </Paper>
        )}
      </Grid>

      {jobs.length > 0 && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              History
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Started by</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    hover
                    selected={selectedJob?.id === job.id}
                    onClick={() => setSelectedId(job.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      {kinds.find((k) => k.key === job.kind)?.label || job.kind}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {job.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={job.status} />
                    </TableCell>
                    <TableCell>{job.started_by || ''}</TableCell>
                    <TableCell>{formatWhen(job.created_at)}</TableCell>
                    <TableCell align="right">{durationOf(job)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default JobsPanel;
