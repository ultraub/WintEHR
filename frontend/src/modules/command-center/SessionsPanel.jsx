/**
 * SessionsPanel — who is logged in right now (slice 15).
 *
 * Reads GET /api/command-center/sessions: every live training / practitioner
 * session from the shared store (never a token; rows carry a digest id),
 * newest first, with the caller's own session marked. Revoking one session
 * or every session of a user needs the `system` permission, is confirmed,
 * and is audited; the revoked user's next request is a 401 and the client
 * sends them back to login. Revoking your own session logs you out.
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
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { api, useAuth } from '../sdk';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

const minutesLeft = (iso) => {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
};

const SessionsPanel = ({ pollMs = 15000 }) => {
  const { user } = useAuth();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const canAct = perms.includes('system');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(null); // { kind: 'one' | 'user', session }

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/api/command-center/sessions');
      setData(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not load sessions'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const timer = setInterval(() => load().catch(() => {}), pollMs);
    return () => clearInterval(timer);
  }, [load, pollMs]);

  const revoke = async () => {
    const { kind, session } = pending;
    setPending(null);
    setNotice(null);
    try {
      const response = kind === 'user'
        ? await api.delete('/api/command-center/sessions', { params: { user_id: session.user_id } })
        : await api.delete(`/api/command-center/sessions/${encodeURIComponent(session.id)}`);
      const n = response.data?.revoked ?? 0;
      setNotice(`Revoked ${n} session${n === 1 ? '' : 's'}${kind === 'user' ? ` of ${session.username}` : ''}.`);
      if (session.current || (kind === 'user' && session.user_id === user?.id)) {
        setNotice('Your own session was revoked; you will be sent to login.');
      }
      await load();
    } catch (err) {
      setError(detailOf(err, 'Revoke failed'));
    }
  };

  if (!data && !error) return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading sessions…</Typography>;

  const sessions = data?.sessions || [];
  const byUser = sessions.reduce((acc, s) => ({ ...acc, [s.user_id]: (acc[s.user_id] || 0) + 1 }), {});

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {data?.note && <Alert severity="info" variant="outlined" sx={{ mb: 1 }} data-testid="sessions-note">{data.note}</Alert>}
      {!canAct && data?.mode === 'training' && (
        <Alert severity="info" sx={{ mb: 1 }}>Revoking sessions needs the <code>system</code> permission.</Alert>
      )}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">
          {sessions.length} active session{sessions.length === 1 ? '' : 's'}
          {data?.shared === true && <Chip size="small" variant="outlined" label="shared store" sx={{ ml: 1, borderRadius: 1 }} />}
        </Typography>
        <Button size="small" variant="outlined" onClick={load}>Refresh</Button>
      </Stack>
      {data?.mode === 'training' && sessions.length === 0 && (
        <Typography variant="body2" color="text.secondary">No one is logged in.</Typography>
      )}
      {sessions.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Signed in</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>From</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => {
                const left = minutesLeft(s.expires_at);
                return (
                  <TableRow key={s.id} hover data-testid={`session-${s.id}`} selected={s.current}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{s.username || s.user_id || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.name}{s.current ? ' · this session' : ''}</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={s.role || '—'} variant="outlined" sx={{ borderRadius: 1 }} /></TableCell>
                    <TableCell><Typography variant="caption">{s.kind}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{when(s.created_at)}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="caption">{when(s.expires_at)}</Typography>
                      {left !== null && <Typography variant="caption" color={left < 60 ? 'warning.main' : 'text.secondary'} display="block">{left > 0 ? `${left} min left` : 'expired'}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{s.ip || '—'}</Typography>
                      {s.user_agent && <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.user_agent}>{s.user_agent}</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" color="warning" disabled={!canAct} onClick={() => setPending({ kind: 'one', session: s })}
                        title={!canAct ? 'Needs the system permission' : undefined} aria-label={`Revoke session ${s.id}`}>
                        Revoke
                      </Button>
                      {byUser[s.user_id] > 1 && (
                        <Button size="small" color="warning" disabled={!canAct} onClick={() => setPending({ kind: 'user', session: s })} aria-label={`Revoke all sessions of ${s.username}`}>
                          Revoke all ({byUser[s.user_id]})
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={Boolean(pending)} onClose={() => setPending(null)}>
        <DialogTitle>{pending?.kind === 'user' ? `Revoke all sessions of ${pending.session.username}?` : `Revoke session of ${pending?.session?.username}?`}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {pending?.kind === 'user' ? `Every login of ${pending.session.username} ends now.` : 'This login ends now.'} Their next request is refused and the app sends them back to the login page. Unsaved work in open dialogs is lost.
            {(pending?.session?.current || (pending?.kind === 'user' && pending.session.user_id === user?.id)) && <strong> This includes your own session: you will be logged out.</strong>}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={revoke}>Revoke</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SessionsPanel;
