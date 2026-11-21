/**
 * ConfigTransfer — export every override (settings, tab policy, roles) as one
 * JSON file and import such a file with a preview first (slice 13).
 *
 * Export is a GET the browser saves as a file. Import reads the chosen file,
 * asks the backend for a plan (nothing written), shows what would change key
 * by key, and only applies on confirmation. Secrets are never in the file;
 * the plan lists which ones the source had set so the admin re-enters them.
 */

import React, { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { api } from '../sdk';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;
const ACTION_COLOR = { set: 'primary', reset: 'warning', unchanged: 'default', skip: 'default' };
const show = (value) => (value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value));

export const saveJson = (text, filename) => {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const ConfigTransfer = ({ canEdit, onImported }) => {
  const fileInput = useRef(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [document_, setDocument] = useState(null);
  const [replace, setReplace] = useState(false);
  const [plan, setPlan] = useState(null);

  const exportConfig = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.get('/api/command-center/config/export');
      const doc = response.data;
      const stamp = String(doc.exported_at || new Date().toISOString()).replace(/[-:]/g, '').slice(0, 15);
      saveJson(JSON.stringify(doc, null, 2), `wintehr-config-${stamp}.json`);
      const n = Object.keys(doc.settings || {}).length;
      setNotice(`Exported ${n} override${n === 1 ? '' : 's'}${doc.secrets_set?.length ? ` (${doc.secrets_set.length} secret${doc.secrets_set.length === 1 ? '' : 's'} listed by name only)` : ''}.`);
    } catch (err) {
      setError(detailOf(err, 'Export failed'));
    } finally {
      setBusy(false);
    }
  };

  const preview = async (doc, nextReplace) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post('/api/command-center/config/import', { document: doc, replace: nextReplace, apply: false });
      setPlan(response.data);
    } catch (err) {
      setError(detailOf(err, 'This file could not be read as a WintEHR configuration'));
      setPlan(null);
      setDocument(null);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setNotice(null);
    let doc;
    try {
      doc = JSON.parse(await file.text());
    } catch {
      setError(`${file.name} is not valid JSON`);
      return;
    }
    setDocument(doc);
    await preview(doc, replace);
  };

  const toggleReplace = async (checked) => {
    setReplace(checked);
    if (document_) await preview(document_, checked);
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post('/api/command-center/config/import', { document: document_, replace, apply: true });
      const result = response.data;
      const failed = result.items.filter((i) => i.applied === false);
      const applied = result.items.filter((i) => i.applied === true).length;
      setPlan(null);
      setDocument(null);
      setNotice(
        `Imported ${applied} change${applied === 1 ? '' : 's'}.` +
          (failed.length ? ` ${failed.length} refused: ${failed.map((i) => `${i.key} (${i.reason})`).join('; ')}.` : '') +
          (result.restart_required ? ' A restart-tier setting changed: restart emr-backend.' : ''),
      );
      if (onImported) onImported();
    } catch (err) {
      setError(detailOf(err, 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  const changes = plan ? (plan.counts.set || 0) + (plan.counts.reset || 0) : 0;

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
        <Button size="small" variant="outlined" onClick={exportConfig} disabled={busy}>
          Export configuration
        </Button>
        {canEdit && (
          <>
            <Button size="small" variant="outlined" onClick={() => fileInput.current?.click()} disabled={busy}>
              Import configuration…
            </Button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} data-testid="config-file" />
          </>
        )}
        <Typography variant="caption" color="text.secondary">
          One JSON file with every override: settings, chart tabs, roles. Secrets are listed by name, never exported.
        </Typography>
      </Stack>
      {notice && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      <Dialog open={Boolean(plan)} onClose={() => { setPlan(null); setDocument(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Import configuration</DialogTitle>
        <DialogContent dividers>
          {plan && (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {plan.exported_at && <>Exported {new Date(plan.exported_at).toLocaleString()}</>}
                {plan.source?.git_commit && <> from commit <strong>{String(plan.source.git_commit).slice(0, 8)}</strong></>}
                {plan.source?.environment && <> ({plan.source.environment})</>}
                . {changes === 0 ? 'Nothing would change.' : `${changes} change${changes === 1 ? '' : 's'} would be made.`}
              </Typography>
              {(plan.restart_required || plan.rebuild_required) && (
                <Alert severity="warning" variant="outlined">
                  {plan.restart_required && 'A restart-tier setting changes: emr-backend must restart afterwards. '}
                  {plan.rebuild_required && 'A rebuild-tier setting changes: the frontend image must be rebuilt.'}
                </Alert>
              )}
              {plan.secrets_set?.length > 0 && (
                <Alert severity="info" variant="outlined">
                  The source had these secrets set; enter them by hand after importing: {plan.secrets_set.join(', ')}.
                </Alert>
              )}
              <FormControlLabel
                control={<Checkbox size="small" checked={replace} onChange={(e) => toggleReplace(e.target.checked)} disabled={busy} />}
                label={<Typography variant="body2">Replace: also reset overrides this file does not mention</Typography>}
              />
              <Table size="small" data-testid="import-plan">
                <TableHead>
                  <TableRow>
                    <TableCell>Setting</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell>Incoming</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plan.items.map((item) => (
                    <TableRow key={item.key} data-testid={`plan-${item.key}`}>
                      <TableCell>
                        <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace' }}>{item.key}</Typography>
                        {item.tier && item.tier !== 'live' && <Chip size="small" label={item.tier} variant="outlined" sx={{ ml: 1, borderRadius: 1 }} />}
                        {item.reason && <Typography variant="caption" color="text.secondary" display="block">{item.reason}</Typography>}
                      </TableCell>
                      <TableCell><Chip size="small" label={item.action} color={ACTION_COLOR[item.action]} variant={item.action === 'unchanged' || item.action === 'skip' ? 'outlined' : 'filled'} sx={{ borderRadius: 1 }} /></TableCell>
                      <TableCell sx={{ maxWidth: 240, overflowWrap: 'anywhere' }}><Typography variant="caption">{show(item.current)}</Typography></TableCell>
                      <TableCell sx={{ maxWidth: 240, overflowWrap: 'anywhere' }}><Typography variant="caption">{item.action === 'reset' ? '(reset to env / default)' : show(item.incoming)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPlan(null); setDocument(null); }} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={apply} disabled={busy || changes === 0}>
            Apply {changes > 0 ? `${changes} change${changes === 1 ? '' : 's'}` : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfigTransfer;
