/**
 * AuditPanel — the audit trail (slice 12): who changed what, logins,
 * restarts, app registrations, newest first.
 *
 * Reads /api/command-center/audit. The time window and exact event type
 * filter in HAPI; user, category and text filters apply within the fetched
 * page, and the caption says so when the window held more. Rows expand to
 * show the event's details (the JSON the writer attached).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
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
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { api, useAuth } from '../sdk';

const WINDOWS = [
  { key: '1h', label: 'Last hour', ms: 60 * 60 * 1000 },
  { key: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];
const CATEGORIES = [
  { key: '', label: 'All categories' },
  { key: 'system', label: 'System (settings, jobs, restarts)' },
  { key: 'auth', label: 'Auth (logins, logouts)' },
  { key: 'smart', label: 'SMART apps' },
  { key: 'external', label: 'External services' },
  { key: 'security', label: 'Security' },
  { key: 'fhir', label: 'FHIR resources' },
  { key: 'medication', label: 'Medication' },
  { key: 'order', label: 'Orders' },
];
const CATEGORY_COLOR = { system: 'primary', auth: 'info', smart: 'secondary', external: 'secondary', security: 'error', fhir: 'default', medication: 'success', order: 'success' };
const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const sinceFor = (windowKey) => {
  const w = WINDOWS.find((x) => x.key === windowKey);
  return w?.ms ? new Date(Date.now() - w.ms).toISOString() : undefined;
};

const Row = ({ event }) => {
  const [open, setOpen] = useState(false);
  const hasDetails = event.details && Object.keys(event.details).length > 0;
  const target = event.patient || event.entity;
  return (
    <>
      <TableRow hover data-testid={`audit-row-${event.id}`}>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{event.recorded ? new Date(event.recorded).toLocaleString() : '—'}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" label={event.category} color={CATEGORY_COLOR[event.category] || 'default'} sx={{ borderRadius: 1, height: 20, fontSize: 11 }} />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{event.event_type}</Typography>
          </Stack>
        </TableCell>
        <TableCell>{event.user || <Typography variant="caption" color="text.secondary">system</Typography>}</TableCell>
        <TableCell>
          <Chip size="small" label={event.outcome} color={event.outcome === 'success' ? 'success' : 'error'} variant="outlined" sx={{ borderRadius: 1, height: 20, fontSize: 11 }} />
        </TableCell>
        <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={target || ''}>
          {target || ''}
        </TableCell>
        <TableCell align="right" sx={{ width: 40 }}>
          {hasDetails && (
            <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label={`${open ? 'Hide' : 'Show'} details for ${event.event_type}`}
              aria-expanded={open} sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {hasDetails && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
            <Collapse in={open} unmountOnExit>
              <Box component="pre" sx={{ m: 0, py: 1, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} data-testid={`audit-details-${event.id}`}>
                {event.ip && `from ${event.ip}\n`}
                {JSON.stringify(event.details, null, 2)}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const AuditPanel = () => {
  const { user } = useAuth();
  const canView = Array.isArray(user?.permissions) && user.permissions.includes('admin');
  const [windowKey, setWindowKey] = useState('7d');
  const [category, setCategory] = useState('');
  const [eventType, setEventType] = useState('');
  const [who, setWho] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const params = useMemo(() => ({
    since: sinceFor(windowKey),
    category: category || undefined,
    event_type: eventType || undefined,
    user: who.trim() || undefined,
    q: query.trim() || undefined,
    limit: 200,
  }), [windowKey, category, eventType, who, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/command-center/audit', { params });
      setData(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not load the audit trail'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  if (!canView) {
    return <Alert severity="warning">Viewing the audit trail needs the <code>admin</code> permission.</Alert>;
  }

  const eventTypes = data?.event_types || [];

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="audit-window-label">Window</InputLabel>
          <Select labelId="audit-window-label" label="Window" value={windowKey} onChange={(e) => setWindowKey(e.target.value)} inputProps={{ 'aria-label': 'Time window' }}>
            {WINDOWS.map((w) => <MenuItem key={w.key} value={w.key}>{w.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="audit-category-label">Category</InputLabel>
          <Select labelId="audit-category-label" label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setEventType(''); }} inputProps={{ 'aria-label': 'Category' }}>
            {CATEGORIES.map((c) => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="audit-type-label">Event type</InputLabel>
          <Select labelId="audit-type-label" label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)} inputProps={{ 'aria-label': 'Event type' }}>
            <MenuItem value="">Any</MenuItem>
            {(eventType && !eventTypes.includes(eventType) ? [eventType, ...eventTypes] : eventTypes).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="User" value={who} onChange={(e) => setWho(e.target.value)} inputProps={{ 'aria-label': 'User' }} sx={{ minWidth: 140 }} />
        <TextField size="small" label="Contains" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="setting key, container, patient…" inputProps={{ 'aria-label': 'Contains' }} sx={{ minWidth: 220 }} />
        <Button size="small" variant="outlined" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          {data.events.length} event{data.events.length === 1 ? '' : 's'}
          {data.events.length !== data.fetched && ` matching, within the newest ${data.fetched}`}
          {data.truncated && ` — the window holds more${typeof data.total === 'number' ? ` (${data.total} in total)` : ''}; narrow it or pick an event type`}
        </Typography>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'auto' }}>
        <Table size="small" data-testid="audit-table">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Outcome</TableCell>
              <TableCell>Target</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {!data && !error && (
              <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">Loading…</Typography></TableCell></TableRow>
            )}
            {data && data.events.length === 0 && (
              <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No audit events match.</Typography></TableCell></TableRow>
            )}
            {data && data.events.map((event) => <Row key={event.id} event={event} />)}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default AuditPanel;
