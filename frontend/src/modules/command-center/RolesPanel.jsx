/**
 * RolesPanel — roles × permissions (slice 8).
 *
 * The built-in roles come from the training users; ticking a cell changes
 * that role's permission list through the `auth.roles` setting (live
 * tier: applied on the user's next request, no re-login). The admin role's
 * `admin` and `system` cells are locked so the Command Center cannot lock
 * out the only role that can undo a change. `system` is required to edit.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { api, refreshTabPolicy, useAuth } from '../sdk';

const SETTING_KEY = 'auth.roles';
const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const RolesPanel = () => {
  const { user } = useAuth();
  const canEdit = Array.isArray(user?.permissions) && user.permissions.includes('system');
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);   // { role: [permissions] }
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/api/command-center/roles');
      setData(response.data);
      setDraft(Object.fromEntries(response.data.roles.map((r) => [r.role, [...r.permissions]])));
    } catch (err) {
      setError(detailOf(err, 'Could not load roles'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saved = useMemo(() => (data ? Object.fromEntries(data.roles.map((r) => [r.role, r.permissions])) : null), [data]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const toggle = (role, perm) =>
    setDraft((prev) => {
      const current = prev[role] || [];
      const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
      return { ...prev, [role]: next };
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // Only roles that differ from their defaults are stored as overrides.
      const overrides = {};
      for (const r of data.roles) {
        const perms = draft[r.role] || [];
        const differs = JSON.stringify([...perms].sort()) !== JSON.stringify([...r.default_permissions].sort());
        if (differs) overrides[r.role] = { permissions: perms };
      }
      if (Object.keys(overrides).length === 0) {
        await api.delete(`/api/command-center/settings/${SETTING_KEY}`);
      } else {
        await api.put(`/api/command-center/settings/${SETTING_KEY}`, { value: overrides });
      }
      await load();
      await refreshTabPolicy();
      setNotice('Saved. Users get the new permissions on their next request.');
    } catch (err) {
      setError(detailOf(err, 'Could not save roles'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/command-center/settings/${SETTING_KEY}`);
      await load();
      setNotice('Roles reset to the built-in permissions.');
    } catch (err) {
      setError(detailOf(err, 'Could not reset roles'));
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <Alert severity="error">{error}</Alert>;
  if (!data || !draft) return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading roles…</Typography>;

  return (
    <Box>
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Changing roles needs the <code>system</code> permission. Shown read-only.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tick a cell to grant that permission to a role. Changes apply on each user's next request. Only
        <code> admin</code> and <code>system</code> gate endpoints today; the others are assigned and shown to users.
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Permission</TableCell>
              {data.roles.map((r) => (
                <TableCell key={r.role} align="center" sx={{ textTransform: 'capitalize' }}>
                  {r.role}
                  {r.overridden && <Chip size="small" label="override" color="primary" sx={{ ml: 0.5, borderRadius: 1, height: 18 }} />}
                  {r.users.length > 0 && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ textTransform: 'none' }}>
                      {r.users.join(', ')}
                    </Typography>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.permissions.map((p) => (
              <TableRow key={p.key} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{p.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.description} <code>{p.key}</code></Typography>
                </TableCell>
                {data.roles.map((r) => {
                  const locked = r.locked.includes(p.key);
                  const checked = locked || (draft[r.role] || []).includes(p.key);
                  return (
                    <TableCell key={r.role} align="center">
                      <Tooltip title={locked ? `${r.role} always keeps ${p.key}` : ''}>
                        <span>
                          <Checkbox size="small" checked={checked} disabled={!canEdit || locked || busy}
                            onChange={() => toggle(r.role, p.key)}
                            inputProps={{ 'aria-label': `${p.label} for ${r.role}` }} />
                        </span>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        {canEdit && (
          <>
            <Button variant="contained" onClick={save} disabled={!dirty || busy}>Save</Button>
            <Button variant="outlined" onClick={() => setDraft(saved)} disabled={!dirty || busy}>Discard</Button>
            {data.source === 'database' && (
              <Button variant="text" color="warning" onClick={reset} disabled={busy}>Reset to built-in</Button>
            )}
          </>
        )}
        <Typography variant="caption" color="text.secondary">
          {data.source === 'database' ? `Custom roles${data.updated_by ? ` by ${data.updated_by}` : ''}` : 'Built-in permissions'}
        </Typography>
      </Stack>
    </Box>
  );
};

export default RolesPanel;
