/**
 * UsersPanel — logins for this deployment (slice 16).
 *
 * The four built-in training users come from code and can only be disabled
 * here; custom users (name, role, department, bcrypt password) are added,
 * edited, reset, disabled and deleted through the `auth.users` setting
 * (live tier: disabling ends the user's access on their next request).
 * `admin` can never be disabled or deleted. Editing needs `system`.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { api, useAuth } from '../sdk';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const EMPTY = { username: '', name: '', role: 'physician', department: '', email: '', password: '', confirm: '' };

const UserDialog = ({ open, editing, roles, onClose, onSaved, onError }) => {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(editing ? { ...EMPTY, username: editing.username, name: editing.name, role: editing.role, department: editing.department || '', email: editing.email || '' } : EMPTY);
  }, [open, editing]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const passwordMismatch = form.password !== form.confirm;
  // A built-in user's name and role live in code; here it can only be given
  // a password of its own (or go back to the shared training password).
  const builtin = editing?.source === 'builtin';
  const valid = builtin
    ? form.password.length >= 4 && !passwordMismatch
    : form.name.trim() && form.role.trim() && (editing ? !form.password || !passwordMismatch : form.username.trim() && form.password.length >= 4 && !passwordMismatch);

  const removePassword = async () => {
    setBusy(true);
    try {
      const response = await api.put(`/api/command-center/users/${encodeURIComponent(editing.username)}`, { remove_password: true });
      onSaved(response.data, 'updated');
    } catch (err) {
      onError(detailOf(err, 'Could not remove the password'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      let response;
      if (builtin) {
        response = await api.put(`/api/command-center/users/${encodeURIComponent(editing.username)}`, { password: form.password });
      } else if (editing) {
        const body = { name: form.name.trim(), role: form.role.trim(), department: form.department.trim() || null, email: form.email.trim() || null };
        if (form.password) body.password = form.password;
        response = await api.put(`/api/command-center/users/${encodeURIComponent(editing.username)}`, body);
      } else {
        const body = { username: form.username.trim(), name: form.name.trim(), role: form.role.trim(), password: form.password };
        if (form.department.trim()) body.department = form.department.trim();
        if (form.email.trim()) body.email = form.email.trim();
        response = await api.post('/api/command-center/users', body);
      }
      onSaved(response.data, editing ? 'updated' : 'created');
    } catch (err) {
      onError(detailOf(err, editing ? 'Could not update the user' : 'Could not create the user'));
    } finally {
      setBusy(false);
    }
  };

  const roleOptions = roles.includes(form.role) || !form.role ? roles : [...roles, form.role];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{builtin ? `Password for ${editing.username}` : editing ? `Edit ${editing.username}` : 'Add user'}</DialogTitle>
      <DialogContent dividers>
        {builtin ? (
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {editing.credential === 'own'
                ? `${editing.username} has its own password. Set a new one, or remove it to go back to the shared training password.`
                : editing.credential === 'server'
                  ? `${editing.username} logs in with the password set on the server (WINTEHR_ADMIN_PASSWORD). A password set here works as well.`
                  : `${editing.username} uses the shared training password and logs in with one click. Giving it a password makes the login page ask for it.`}
            </Typography>
            <TextField size="small" type="password" label="New password" value={form.password} onChange={set('password')}
              inputProps={{ 'aria-label': 'Password', autoComplete: 'new-password' }} helperText="At least 4 characters; stored as a bcrypt hash" />
            <TextField size="small" type="password" label="Confirm password" value={form.confirm} onChange={set('confirm')} error={Boolean(form.password) && passwordMismatch}
              inputProps={{ 'aria-label': 'Confirm password', autoComplete: 'new-password' }} />
          </Stack>
        ) : (
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Username" value={form.username} onChange={set('username')} disabled={Boolean(editing)}
            helperText={editing ? undefined : 'Lowercase letters, digits, . _ -'} inputProps={{ 'aria-label': 'Username' }} />
          <TextField size="small" label="Display name" value={form.name} onChange={set('name')} inputProps={{ 'aria-label': 'Display name' }} />
          <TextField size="small" select label="Role" value={form.role} onChange={set('role')} inputProps={{ 'aria-label': 'Role' }}
            helperText="Permissions follow the role (Roles tab)">
            {roleOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Department" value={form.department} onChange={set('department')} inputProps={{ 'aria-label': 'Department' }} />
          <TextField size="small" label="Email" value={form.email} onChange={set('email')} placeholder={form.username ? `${form.username}@wintehr.example.com` : ''} inputProps={{ 'aria-label': 'Email' }} />
          <TextField size="small" type="password" label={editing ? 'New password (leave blank to keep)' : 'Password'} value={form.password} onChange={set('password')}
            inputProps={{ 'aria-label': 'Password', autoComplete: 'new-password' }} helperText="At least 4 characters; stored as a bcrypt hash" />
          <TextField size="small" type="password" label="Confirm password" value={form.confirm} onChange={set('confirm')} error={Boolean(form.password) && passwordMismatch}
            inputProps={{ 'aria-label': 'Confirm password', autoComplete: 'new-password' }} />
        </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {builtin && editing.credential === 'own' && (
          <Button color="error" onClick={removePassword} disabled={busy} sx={{ mr: 'auto' }}>Remove password</Button>
        )}
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!valid || busy}>{builtin ? 'Set password' : editing ? 'Save' : 'Create'}</Button>
      </DialogActions>
    </Dialog>
  );
};

const UsersPanel = () => {
  const { user } = useAuth();
  const canEdit = Array.isArray(user?.permissions) && user.permissions.includes('system');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);     // { editing: UserView | null }
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/api/command-center/users');
      setUsers(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not load users'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (view) => setUsers((rows) => (rows.some((r) => r.username === view.username) ? rows.map((r) => (r.username === view.username ? view : r)) : [...rows, view]));

  const toggleDisabled = async (u) => {
    setError(null);
    try {
      const response = await api.put(`/api/command-center/users/${encodeURIComponent(u.username)}`, { disabled: !u.disabled });
      replace(response.data);
      setNotice(`${u.username} ${u.disabled ? 'enabled' : 'disabled'}.${u.disabled ? '' : ' Their open sessions end on their next request.'}`);
    } catch (err) {
      setError(detailOf(err, `Could not change ${u.username}`));
    }
  };

  const remove = async () => {
    const u = pendingDelete;
    setPendingDelete(null);
    try {
      await api.delete(`/api/command-center/users/${encodeURIComponent(u.username)}`);
      setUsers((rows) => rows.filter((r) => r.username !== u.username));
      setNotice(`${u.username} deleted.`);
    } catch (err) {
      setError(detailOf(err, `Could not delete ${u.username}`));
    }
  };

  if (!users && !error) return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading users…</Typography>;

  const roles = Array.from(new Set(['physician', 'nurse', 'pharmacist', 'admin', ...(users || []).map((u) => u.role)]));

  return (
    <Box>
      {!canEdit && <Alert severity="info" sx={{ mb: 1 }}>Changing users needs the <code>system</code> permission.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Built-in users share the training password until given one of their own; custom users always have their own. Disabling ends access on the next request. To require a password for every login, see Settings.
        </Typography>
        {canEdit && <Button size="small" variant="contained" onClick={() => setDialog({ editing: null })}>Add user</Button>}
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Password</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(users || []).map((u) => (
              <TableRow key={u.username} hover data-testid={`user-${u.username}`} sx={{ opacity: u.disabled ? 0.6 : 1 }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{u.username}{u.username === user?.username ? ' (you)' : ''}</Typography>
                  <Typography variant="caption" color="text.secondary">{u.name} · {u.email}</Typography>
                </TableCell>
                <TableCell><Chip size="small" label={u.role} variant="outlined" sx={{ borderRadius: 1 }} /></TableCell>
                <TableCell><Typography variant="caption">{u.department || '—'}</Typography></TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {u.permissions.map((p) => <Chip key={p} size="small" label={p} sx={{ borderRadius: 1, fontSize: 11 }} />)}
                  </Stack>
                </TableCell>
                <TableCell><Typography variant="caption">{u.source}</Typography></TableCell>
                <TableCell>
                  <Typography variant="caption" color={u.credential === 'training' ? 'text.secondary' : 'text.primary'}>
                    {{ own: 'Its own', server: 'Set on the server', training: 'Shared training password' }[u.credential] || 'Its own'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <FormControlLabel sx={{ m: 0 }} label="" control={
                    <Switch size="small" checked={!u.disabled} disabled={!canEdit || u.protected || u.username === user?.username}
                      onChange={() => toggleDisabled(u)} inputProps={{ 'aria-label': `${u.username} enabled` }} />
                  } />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {u.source === 'custom' && (
                    <>
                      <Button size="small" disabled={!canEdit} onClick={() => setDialog({ editing: u })} aria-label={`Edit ${u.username}`}>Edit</Button>
                      <Button size="small" color="error" disabled={!canEdit || u.username === user?.username} onClick={() => setPendingDelete(u)} aria-label={`Delete ${u.username}`}>Delete</Button>
                    </>
                  )}
                  {u.source === 'builtin' && (
                    <Button size="small" disabled={!canEdit} onClick={() => setDialog({ editing: u })} aria-label={`Set password for ${u.username}`}>
                      {u.credential === 'own' ? 'Change password' : 'Set password'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <UserDialog open={Boolean(dialog)} editing={dialog?.editing || null} roles={roles} onClose={() => setDialog(null)}
        onSaved={(view, verb) => { replace(view); setDialog(null); setNotice(`${view.username} ${verb}.`); }} onError={setError} />

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete {pendingDelete?.username}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">The login is removed and any open session ends on its next request. Nothing clinical is deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={remove}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPanel;
