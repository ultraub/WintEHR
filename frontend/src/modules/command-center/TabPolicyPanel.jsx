/**
 * TabPolicyPanel — which chart tabs each role sees (slice 7).
 *
 * A matrix of tabs × (Organization, each role): a ticked cell means the tab
 * is visible; the Organization column applies to everyone and a role column
 * can only hide more. Each column also picks the default (first) tab. The
 * preview strip under the matrix is the exact result of the resolver the
 * workspace uses, so what you see here is what that role gets.
 *
 * Saves the whole `ui.tabs.policy` setting (live tier) and refreshes the
 * policy in this browser so an open chart updates without a reload.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
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
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ALWAYS_VISIBLE_TABS,
  EMPTY_TAB_POLICY,
  api,
  loadClinicalTabCatalog,
  refreshTabPolicy,
  resolveEffectiveTabs,
  useAuth,
} from '../sdk';

const POLICY_KEY = 'ui.tabs.policy';
const ORG = '__org__';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const emptyLayer = () => ({ hidden: [], order: [], default: null });

const normalize = (policy) => ({
  org: { ...emptyLayer(), ...(policy?.org || {}) },
  roles: Object.fromEntries(Object.entries(policy?.roles || {}).map(([r, l]) => [r, { ...emptyLayer(), ...l }])),
  contexts: policy?.contexts || {},
});

const TabPolicyPanel = () => {
  const { user } = useAuth();
  const canEdit = Array.isArray(user?.permissions) && user.permissions.includes('system');

  const [catalog, setCatalog] = useState(null);
  const [roles, setRoles] = useState([]);
  const [saved, setSaved] = useState(null);     // policy as last loaded/saved
  const [draft, setDraft] = useState(null);     // policy being edited
  const [meta, setMeta] = useState({});
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tabs, policyRes] = await Promise.all([loadClinicalTabCatalog(), api.get('/api/command-center/ui-policy')]);
      const policy = normalize(policyRes.data?.policy || EMPTY_TAB_POLICY);
      setCatalog(tabs);
      setRoles(policyRes.data?.roles || []);
      setSaved(policy);
      setDraft(policy);
      setMeta({ source: policyRes.data?.source, updated_by: policyRes.data?.updated_by, updated_at: policyRes.data?.updated_at });
    } catch (err) {
      setError(detailOf(err, 'Could not load the tab policy'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(() => [{ key: ORG, label: 'Organization', role: null }, ...roles.map((r) => ({ key: r, label: r, role: r }))], [roles]);

  const layerFor = (policy, key) => (key === ORG ? policy.org : policy.roles[key] || emptyLayer());

  const setLayer = (key, updater) =>
    setDraft((prev) => {
      const next = { ...prev, org: { ...prev.org }, roles: { ...prev.roles } };
      const current = { ...layerFor(prev, key) };
      const updated = updater(current);
      if (key === ORG) next.org = updated;
      else next.roles[key] = updated;
      return next;
    });

  const isHiddenAbove = (key, tabId) => key !== ORG && draft.org.hidden.includes(tabId);

  const toggle = (key, tabId) =>
    setLayer(key, (layer) => {
      const hidden = layer.hidden.includes(tabId) ? layer.hidden.filter((id) => id !== tabId) : [...layer.hidden, tabId];
      return { ...layer, hidden, default: hidden.includes(layer.default) ? null : layer.default };
    });

  const setDefault = (key, tabId) => setLayer(key, (layer) => ({ ...layer, default: tabId || null }));

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.put(`/api/command-center/settings/${POLICY_KEY}`, { value: draft });
      const policy = normalize(response.data.value);
      setSaved(policy);
      setDraft(policy);
      setMeta({ source: response.data.source, updated_by: response.data.updated_by, updated_at: response.data.updated_at });
      await refreshTabPolicy();
      setNotice('Saved. Open charts pick up the new tabs on their next render.');
    } catch (err) {
      setError(detailOf(err, 'Could not save the tab policy'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.delete(`/api/command-center/settings/${POLICY_KEY}`);
      const policy = normalize(response.data.value);
      setSaved(policy);
      setDraft(policy);
      setMeta({ source: response.data.source });
      await refreshTabPolicy();
      setNotice('Policy reset: every tab is visible for everyone.');
    } catch (err) {
      setError(detailOf(err, 'Could not reset the tab policy'));
    } finally {
      setBusy(false);
    }
  };

  if (error && !catalog) return <Alert severity="error">{error}</Alert>;
  if (!catalog || !draft) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading tab policy…</Typography>;
  }

  return (
    <Box>
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Changing the tab policy needs the <code>system</code> permission. Shown read-only.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tick a cell to show that tab. The Organization column applies to everyone; a role column can only hide
        more. <strong>Summary</strong> is always visible. Changes take effect on the next render of an open chart.
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tab</TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} align="center" sx={{ textTransform: c.role ? 'capitalize' : 'none' }}>
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {catalog.map((tab) => (
              <TableRow key={tab.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tab.color || 'grey.400' }} />
                    <span>{tab.label}</span>
                    <Typography variant="caption" color="text.disabled">{tab.id}</Typography>
                  </Stack>
                </TableCell>
                {columns.map((c) => {
                  const layer = layerFor(draft, c.key);
                  const locked = ALWAYS_VISIBLE_TABS.includes(tab.id);
                  const hiddenAbove = isHiddenAbove(c.key, tab.id);
                  const checked = !locked && !hiddenAbove ? !layer.hidden.includes(tab.id) : !hiddenAbove;
                  return (
                    <TableCell key={c.key} align="center">
                      <Tooltip title={locked ? 'Summary is always visible' : hiddenAbove ? 'Hidden for the whole organization' : ''}>
                        <span>
                          <Checkbox
                            size="small"
                            checked={checked}
                            disabled={!canEdit || locked || hiddenAbove || busy}
                            onChange={() => toggle(c.key, tab.id)}
                            inputProps={{ 'aria-label': `${tab.label} visible for ${c.label}` }}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow>
              <TableCell><strong>Opens on</strong></TableCell>
              {columns.map((c) => {
                const layer = layerFor(draft, c.key);
                const preview = resolveEffectiveTabs(catalog, draft, { role: c.role });
                const id = `default-${c.key}`;
                return (
                  <TableCell key={c.key} align="center">
                    <FormControl size="small" sx={{ minWidth: 150 }} disabled={!canEdit || busy}>
                      <InputLabel id={`${id}-label`}>Default</InputLabel>
                      <Select labelId={`${id}-label`} id={id} label="Default" value={layer.default || ''}
                        onChange={(e) => setDefault(c.key, e.target.value)}
                        inputProps={{ 'aria-label': `Default tab for ${c.label}` }}>
                        <MenuItem value="">{c.role ? 'Inherit' : 'First visible'}</MenuItem>
                        {preview.tabs.map((t) => (
                          <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Preview</Typography>
      <Stack spacing={1}>
        {columns.map((c) => {
          const preview = resolveEffectiveTabs(catalog, draft, { role: c.role });
          return (
            <Stack key={c.key} direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap"
              data-testid={`preview-${c.key}`}>
              <Typography variant="caption" sx={{ minWidth: 110, textTransform: c.role ? 'capitalize' : 'none' }}>
                {c.label}
              </Typography>
              {preview.tabs.map((t) => (
                <Chip key={t.id} size="small" label={t.label} variant={t.id === preview.defaultTab ? 'filled' : 'outlined'}
                  color={t.id === preview.defaultTab ? 'primary' : 'default'} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        {canEdit && (
          <>
            <Button variant="contained" onClick={save} disabled={!dirty || busy}>Save</Button>
            <Button variant="outlined" onClick={() => setDraft(saved)} disabled={!dirty || busy}>Discard</Button>
            {meta.source === 'database' && (
              <Button variant="text" color="warning" onClick={reset} disabled={busy}>Reset to show everything</Button>
            )}
          </>
        )}
        <Typography variant="caption" color="text.secondary">
          {meta.source === 'database' ? `Custom policy${meta.updated_by ? ` by ${meta.updated_by}` : ''}` : 'No policy set: every tab visible'}
        </Typography>
      </Stack>
    </Box>
  );
};

export default TabPolicyPanel;
