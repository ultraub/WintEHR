/**
 * SettingsPanel — the managed settings with their tier, source, and an editor
 * per type (slice 5).
 *
 * Every row says WHEN a change takes effect (tier) and WHERE the current
 * value comes from (source: database override, environment variable, or
 * code default). Secrets are write-only: the API never returns their value.
 * Editing needs the `system` permission; admins can read.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { api, useAuth } from '../sdk';

export const TIER_HELP = {
  live: 'Takes effect on the next request',
  restart: 'Takes effect after emr-backend restarts',
  rebuild: 'Baked into the frontend image; needs a rebuild',
};

const TIER_COLOR = { live: 'success', restart: 'warning', rebuild: 'error' };
const SOURCE_LABEL = { database: 'override', environment: 'env var', default: 'default' };

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const coerce = (setting, raw) => {
  if (setting.type === 'int') return raw === '' ? raw : Number.parseInt(raw, 10);
  if (setting.type === 'float') return raw === '' ? raw : Number(raw);
  if (setting.type === 'bool') return Boolean(raw);
  return raw;
};

const TierChip = ({ tier }) => (
  <Tooltip title={TIER_HELP[tier] || ''}>
    <Chip size="small" label={tier} color={TIER_COLOR[tier] || 'default'} variant="outlined"
      sx={{ textTransform: 'uppercase', fontWeight: 600, borderRadius: 1 }} />
  </Tooltip>
);

const SourceChip = ({ source, envVar }) => (
  <Tooltip title={source === 'environment' && envVar ? `From ${envVar}` : source === 'database' ? 'Set in the Command Center' : 'Code default'}>
    <Chip size="small" label={SOURCE_LABEL[source] || source} variant={source === 'database' ? 'filled' : 'outlined'}
      color={source === 'database' ? 'primary' : 'default'} sx={{ borderRadius: 1 }} />
  </Tooltip>
);

const SettingRow = ({ setting, canEdit, onSaved, onError }) => {
  const [draft, setDraft] = useState(setting.is_secret ? '' : setting.value ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!setting.is_secret) setDraft(setting.value ?? '');
  }, [setting.value, setting.is_secret]);

  const dirty = setting.is_secret ? draft !== '' : String(draft) !== String(setting.value ?? '');
  const secretsBlocked = setting.is_secret && setting.secrets_enabled === false;

  const save = async () => {
    setBusy(true);
    try {
      const response = await api.put(`/api/command-center/settings/${setting.key}`, { value: coerce(setting, draft) });
      onSaved(response.data);
      if (setting.is_secret) setDraft('');
    } catch (err) {
      onError(detailOf(err, `Could not save ${setting.label}`));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const response = await api.delete(`/api/command-center/settings/${setting.key}`);
      onSaved(response.data);
    } catch (err) {
      onError(detailOf(err, `Could not reset ${setting.label}`));
    } finally {
      setBusy(false);
    }
  };

  let editor;
  if (setting.type === 'json') {
    editor = (
      <Typography variant="body2" color="text.secondary">
        Structured setting — edited on the <strong>{setting.key.startsWith('auth.') ? 'Roles' : 'Tabs'}</strong> tab.
      </Typography>
    );
  } else if (setting.type === 'bool') {
    editor = (
      <Switch checked={Boolean(draft)} onChange={(e) => setDraft(e.target.checked)}
        disabled={!canEdit || busy} inputProps={{ 'aria-label': setting.label }} />
    );
  } else if (setting.is_secret) {
    editor = (
      <Stack spacing={0.5}>
        <Chip size="small" label={setting.is_set ? 'Set' : 'Not set'} color={setting.is_set ? 'success' : 'default'}
          variant="outlined" sx={{ alignSelf: 'flex-start', borderRadius: 1 }} />
        <TextField size="small" type="password" placeholder={setting.is_set ? 'Enter a new value to replace' : 'Enter value'}
          value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!canEdit || busy || secretsBlocked}
          inputProps={{ 'aria-label': setting.label, autoComplete: 'new-password' }} />
      </Stack>
    );
  } else {
    editor = (
      <TextField size="small" type={setting.type === 'str' ? 'text' : 'number'} value={draft}
        onChange={(e) => setDraft(e.target.value)} disabled={!canEdit || busy}
        inputProps={{ 'aria-label': setting.label, step: setting.type === 'float' ? 'any' : 1 }} />
    );
  }

  return (
    <TableRow hover>
      <TableCell sx={{ verticalAlign: 'top', width: '40%' }}>
        <Typography variant="body2" fontWeight={600}>{setting.label}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">{setting.description}</Typography>
        <Typography variant="caption" color="text.disabled" display="block">
          Used by {setting.used_by}
          {setting.env_var && ` · env ${setting.env_var}`}
          {!setting.is_secret && setting.default != null && ` · default ${String(setting.default)}`}
        </Typography>
        {secretsBlocked && (
          <Alert severity="warning" variant="outlined" sx={{ mt: 1, py: 0 }}>
            Secrets cannot be saved until WINTEHR_SETTINGS_KEY is set on the backend.
          </Alert>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>{editor}</TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}><TierChip tier={setting.tier} /></TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <SourceChip source={setting.source} envVar={setting.env_var} />
        {setting.updated_by && (
          <Typography variant="caption" color="text.secondary" display="block">
            by {setting.updated_by}
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        {canEdit && setting.type !== 'json' && (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" onClick={save} disabled={!dirty || busy || secretsBlocked}
              aria-label={`Save ${setting.label}`}>
              Save
            </Button>
            {setting.source === 'database' && (
              <Button size="small" variant="outlined" onClick={reset} disabled={busy} aria-label={`Reset ${setting.label}`}>
                Reset
              </Button>
            )}
          </Stack>
        )}
      </TableCell>
    </TableRow>
  );
};

const SettingsPanel = () => {
  const { user } = useAuth();
  const canEdit = Array.isArray(user?.permissions) && user.permissions.includes('system');
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/api/command-center/settings');
      setSettings(response.data);
    } catch (err) {
      setError(detailOf(err, 'Could not load settings'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (view) => setSettings((rows) => rows.map((r) => (r.key === view.key ? view : r)));

  if (!settings && !error) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading settings…</Typography>;
  }

  return (
    <Box>
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Changing settings needs the <code>system</code> permission. Values are shown read-only.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">Tier:</Typography>
        {Object.entries(TIER_HELP).map(([tier, help]) => (
          <Stack key={tier} direction="row" spacing={0.5} alignItems="center">
            <TierChip tier={tier} />
            <Typography variant="caption" color="text.secondary">{help}</Typography>
          </Stack>
        ))}
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Setting</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Tier</TableCell>
              <TableCell>Source</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(settings || []).map((setting) => (
              <SettingRow key={setting.key} setting={setting} canEdit={canEdit} onSaved={replace} onError={setError} />
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default SettingsPanel;
