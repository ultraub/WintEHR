/**
 * AppsPanel — registrations (slice 8a).
 *
 * External services (CDS Hooks, subscriptions, CQL libraries) have a full
 * backend registry at /api/external-services; this is its first admin UI:
 * list, register, activate / deactivate, health-check, delete. SMART apps
 * are listed read-only from /api/smart/apps — the authorization server
 * registers them in memory at startup; persisted registration is slice 8b.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
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
import { api, useAuth } from '../sdk';

const SERVICE_TYPES = [
  { value: 'cds_hooks', label: 'CDS Hooks service' },
  { value: 'subscription', label: 'FHIR subscription webhook' },
  { value: 'cql_library', label: 'CQL library' },
  { value: 'smart_app', label: 'SMART app (external record)' },
];
const AUTH_TYPES = ['none', 'api_key', 'oauth2', 'hmac'];
const STATUS_COLOR = { active: 'success', pending: 'info', inactive: 'default', suspended: 'warning', error: 'error' };
const HEALTH_COLOR = { healthy: 'success', degraded: 'warning', unhealthy: 'error', unknown: 'default' };

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const EMPTY_FORM = { name: '', service_type: 'cds_hooks', base_url: '', auth_type: 'none', description: '' };

const AppsPanel = () => {
  const { user } = useAuth();
  const canEdit = Array.isArray(user?.permissions) && user.permissions.includes('system');
  const [services, setServices] = useState(null);
  const [smartApps, setSmartApps] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [svc, smart] = await Promise.all([
        api.get('/api/external-services', { params: { page_size: 200 } }),
        api.get('/api/smart/apps').catch(() => ({ data: [] })),
      ]);
      const body = svc.data || {};
      setServices(body.services || body.items || (Array.isArray(body) ? body : []));
      setSmartApps(smart.data || []);
    } catch (err) {
      setError(detailOf(err, 'Could not load registrations'));
      setServices([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (label, fn) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice(label);
    } catch (err) {
      setError(detailOf(err, `${label} failed`));
    } finally {
      setBusy(false);
    }
  };

  const register = () =>
    run('Service registered.', async () => {
      await api.post('/api/external-services/register', {
        name: form.name.trim(),
        service_type: form.service_type,
        base_url: form.base_url.trim() || null,
        auth_type: form.auth_type,
        description: form.description.trim() || null,
      });
      setForm(EMPTY_FORM);
    });

  const setStatus = (service, status) =>
    run(`${service.name} ${status === 'active' ? 'activated' : 'deactivated'}.`, () =>
      api.put(`/api/external-services/${service.id}`, { status }));

  const healthCheck = (service) =>
    run(`Health check ran for ${service.name}.`, () => api.post(`/api/external-services/${service.id}/health-check`));

  const remove = (service) =>
    run(`${service.name} deleted.`, async () => {
      await api.delete(`/api/external-services/${service.id}`);
      setConfirmDelete(null);
    });

  if (services === null && !error) return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading registrations…</Typography>;

  return (
    <Box>
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>Registering or changing services needs the <code>system</code> permission. Shown read-only.</Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>External services</Typography>
            {services.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No external services registered.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Health</TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.base_url || s.description || ''}</Typography>
                      </TableCell>
                      <TableCell>{SERVICE_TYPES.find((t) => t.value === s.service_type)?.label || s.service_type}</TableCell>
                      <TableCell><Chip size="small" label={s.status} color={STATUS_COLOR[s.status] || 'default'} sx={{ borderRadius: 1 }} /></TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={s.health_status || 'unknown'} color={HEALTH_COLOR[s.health_status] || 'default'} sx={{ borderRadius: 1 }} />
                        {s.auto_disabled && <Chip size="small" label="auto-disabled" color="warning" sx={{ ml: 0.5, borderRadius: 1 }} />}
                      </TableCell>
                      {canEdit && (
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" onClick={() => healthCheck(s)} disabled={busy}>Check</Button>
                            {s.status === 'active' ? (
                              <Button size="small" onClick={() => setStatus(s, 'inactive')} disabled={busy}>Deactivate</Button>
                            ) : (
                              <Button size="small" onClick={() => setStatus(s, 'active')} disabled={busy}>Activate</Button>
                            )}
                            {confirmDelete === s.id ? (
                              <Button size="small" color="error" variant="contained" onClick={() => remove(s)} disabled={busy}>Confirm delete</Button>
                            ) : (
                              <Button size="small" color="error" onClick={() => setConfirmDelete(s.id)} disabled={busy}>Delete</Button>
                            )}
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mt: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>SMART on FHIR apps</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Registered with the authorization server at startup (demo apps). Registering new apps from here, with
              client secrets, is the next slice.
            </Typography>
            {smartApps.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No SMART apps registered.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>App</TableCell><TableCell>Client ID</TableCell><TableCell>Scopes</TableCell><TableCell>Active</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {smartApps.map((a) => (
                    <TableRow key={a.client_id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.launch_uri || a.description || ''}</Typography>
                      </TableCell>
                      <TableCell><code>{a.client_id}</code></TableCell>
                      <TableCell><Typography variant="caption">{(a.scopes || []).join(' ')}</Typography></TableCell>
                      <TableCell><Chip size="small" label={a.is_active ? 'active' : 'inactive'} color={a.is_active ? 'success' : 'default'} sx={{ borderRadius: 1 }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        {canEdit && (
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Register an external service</Typography>
              <Stack spacing={2}>
                <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  inputProps={{ 'aria-label': 'Service name' }} />
                <FormControl size="small">
                  <InputLabel id="svc-type-label">Type</InputLabel>
                  <Select labelId="svc-type-label" label="Type" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                    inputProps={{ 'aria-label': 'Service type' }}>
                    {SERVICE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label="Base URL" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder="https://cds.example.org" inputProps={{ 'aria-label': 'Base URL' }} />
                <FormControl size="small">
                  <InputLabel id="svc-auth-label">Authentication</InputLabel>
                  <Select labelId="svc-auth-label" label="Authentication" value={form.auth_type} onChange={(e) => setForm({ ...form, auth_type: e.target.value })}
                    inputProps={{ 'aria-label': 'Authentication type' }}>
                    {AUTH_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  multiline minRows={2} inputProps={{ 'aria-label': 'Description' }} />
                <Button variant="contained" onClick={register} disabled={busy || !form.name.trim()}>Register</Button>
                <Typography variant="caption" color="text.secondary">
                  URLs must match <code>EXTERNAL_SERVICES_URL_ALLOWLIST</code> when it is set.
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AppsPanel;
