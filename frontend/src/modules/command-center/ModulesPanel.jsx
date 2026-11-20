/**
 * ModulesPanel — every pluggable module, backend and frontend halves joined
 * by key (slice 9). Read-only: enabling or disabling is a deploy-time
 * decision, and the panel says exactly which env var and which tier.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { api, loadModuleSummaries, useAuth } from '../sdk';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const Count = ({ n, word }) => (n ? <Chip size="small" variant="outlined" label={`${n} ${word}${n === 1 ? '' : 's'}`} sx={{ borderRadius: 1, mr: 0.5, mb: 0.5 }} /> : null);

const ModulesPanel = () => {
  const { user } = useAuth();
  const canView = Array.isArray(user?.permissions) && user.permissions.includes('admin');
  const [backend, setBackend] = useState(null);
  const [frontend, setFrontend] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [be, fe] = await Promise.all([api.get('/api/command-center/modules'), loadModuleSummaries()]);
      setBackend(be.data);
      setFrontend(fe);
    } catch (err) {
      setError(detailOf(err, 'Could not load modules'));
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  if (!canView) return <Alert severity="warning">Viewing modules needs the <code>admin</code> permission.</Alert>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!backend || !frontend) return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading modules…</Typography>;

  const feById = Object.fromEntries(frontend.map((m) => [m.id, m]));
  const beById = Object.fromEntries(backend.modules.map((m) => [m.key, m]));
  const keys = [...new Set([...backend.modules.map((m) => m.key), ...frontend.map((m) => m.id)])].sort();

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        One key names both halves of a module. Backend routers switch off with <code>WINTEHR_DISABLED_MODULES</code>
        (restart); frontend tabs and pages with <code>REACT_APP_DISABLED_MODULES</code> (rebuild). External modules are
        composed at build time from <code>wintehr.modules.json</code>.
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              <TableCell>Backend</TableCell>
              <TableCell>Frontend</TableCell>
              <TableCell>Needs</TableCell>
              <TableCell>Settings</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.map((key) => {
              const be = beById[key];
              const fe = feById[key];
              return (
                <TableRow key={key} hover data-testid={`module-${key}`}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{key}</Typography>
                    <Chip size="small" label={be?.source === 'external' || fe?.external ? 'external' : 'builtin'} variant="outlined" sx={{ borderRadius: 1, mt: 0.5 }} />
                  </TableCell>
                  <TableCell>
                    {!be && <Chip size="small" label="no backend half" sx={{ borderRadius: 1 }} />}
                    {be && be.disabled && <Chip size="small" label="disabled" color="default" sx={{ borderRadius: 1 }} />}
                    {be && !be.disabled && be.registered && <Chip size="small" label="registered" color="success" sx={{ borderRadius: 1 }} />}
                    {be && !be.disabled && !be.registered && <Chip size="small" label="failed" color="error" sx={{ borderRadius: 1 }} />}
                    {be && (
                      <Typography variant="caption" display="block" color="text.secondary">{be.backend_routers.join(', ')}</Typography>
                    )}
                    {be?.failed?.map((f) => (
                      <Alert key={f.router} severity="error" variant="outlined" sx={{ mt: 0.5, py: 0 }}><strong>{f.router}</strong>: {f.error}</Alert>
                    ))}
                  </TableCell>
                  <TableCell>
                    {!fe && <Chip size="small" label="no frontend half" sx={{ borderRadius: 1 }} />}
                    {fe && !fe.enabled && <Chip size="small" label="disabled in this build" sx={{ borderRadius: 1, mb: 0.5 }} />}
                    {fe && fe.enabled && <Chip size="small" label="enabled" color="success" sx={{ borderRadius: 1, mb: 0.5 }} />}
                    {fe && (
                      <Box>
                        <Count n={fe.tabs.length} word="tab" />
                        <Count n={fe.pages.length} word="page" />
                        <Count n={fe.sections.length} word="section" />
                        <Count n={fe.slots.length} word="slot" />
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {fe?.permissions?.length ? fe.permissions.map((p) => <Chip key={p} size="small" label={p} variant="outlined" sx={{ borderRadius: 1, mr: 0.5 }} />) : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>
                    {be?.settings?.length ? be.settings.map((k) => <Typography key={k} variant="caption" display="block"><code>{k}</code></Typography>) : <Typography variant="caption" color="text.disabled">none declared</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
      <Stack spacing={0.5} sx={{ mt: 1.5 }}>
        {backend.disabled_backend.length > 0 && (
          <Typography variant="caption" color="text.secondary">Backend disabled on this deployment: {backend.disabled_backend.join(', ')}</Typography>
        )}
        <Typography variant="caption" color="text.secondary">{backend.how_to.backend}</Typography>
        <Typography variant="caption" color="text.secondary">{backend.how_to.frontend}</Typography>
        <Typography variant="caption" color="text.secondary">{backend.how_to.external}</Typography>
      </Stack>
    </Box>
  );
};

export default ModulesPanel;
