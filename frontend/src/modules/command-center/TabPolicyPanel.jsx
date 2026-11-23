/**
 * TabPolicyPanel — which chart tabs each role sees, which sections each
 * tab contains (slices 7 and 7b), and which PRIMARY navigation pages the
 * app shell offers (slice 19).
 *
 * A matrix of tabs × (Organization, each role, each workflow context): a
 * ticked cell means the tab is visible; the Organization column applies to
 * everyone, a role column can only hide more, and a context column (slice
 * 18: inpatient, surgical, … chosen by the user in the tab strip) narrows
 * further on top of the role. Each column also picks the default (first) tab. A tab
 * row expands to its SECTIONS (the panels inside it) with the same
 * per-column checkboxes, plus an "Add section" picker that places a
 * hostable section from another tab or module on it (Flowsheet inside
 * Chart Review for nurses).
 *
 * A second matrix, Primary navigation, does the same for the app shell's
 * menu (Dashboard, Patients, Population Health, developer and admin pages,
 * module pages) by nav item id: an unticked page leaves the sidebar, the
 * icon rail and the command palette, and its URL lands on the first
 * visible page. Patients and the Command Center can never be hidden.
 *
 * The preview under the matrices is the exact result of the resolvers the
 * workspace and the shell use. Saves the whole `ui.tabs.policy` setting
 * (live tier) and refreshes the policy in this browser so an open chart
 * and the menu update without a reload.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon, Close as CloseIcon } from '@mui/icons-material';
import {
  ALWAYS_VISIBLE_NAV,
  ALWAYS_VISIBLE_TABS,
  EMPTY_TAB_POLICY,
  api,
  loadClinicalSectionCatalog,
  loadClinicalTabCatalog,
  loadNavigationCatalog,
  refreshTabPolicy,
  resolveEffectiveNav,
  resolveEffectiveSections,
  resolveEffectiveTabs,
  useAuth,
} from '../sdk';

const POLICY_KEY = 'ui.tabs.policy';
const ORG = '__org__';

const detailOf = (err, fallback) => err?.response?.data?.detail || err?.message || fallback;

const emptyLayer = () => ({ hidden: [], order: [], default: null, sections: {}, nav: { hidden: [] } });
const emptySpec = () => ({ hidden: [], order: [], added: [] });

const normalizeLayer = (l) => ({
  ...emptyLayer(),
  ...(l || {}),
  sections: { ...(l?.sections || {}) },
  nav: { hidden: [...(l?.nav?.hidden || [])] },
});
const normalize = (policy) => ({
  org: normalizeLayer(policy?.org),
  roles: Object.fromEntries(Object.entries(policy?.roles || {}).map(([r, l]) => [r, normalizeLayer(l)])),
  contexts: Object.fromEntries(Object.entries(policy?.contexts || {}).map(([c, l]) => [c, normalizeLayer(l)])),
});

const CONTEXT_ID = /^[a-z0-9][a-z0-9-]{1,31}$/;

/** Drop empty section specs and an empty nav spec so the saved document stays small. */
const compact = (policy) => {
  const clean = (layer) => {
    const sections = Object.fromEntries(
      Object.entries(layer.sections || {}).filter(([, s]) => s.hidden?.length || s.order?.length || s.added?.length),
    );
    const { nav, ...rest } = layer;
    return nav?.hidden?.length ? { ...rest, sections, nav: { hidden: nav.hidden } } : { ...rest, sections };
  };
  return {
    org: clean(policy.org),
    roles: Object.fromEntries(Object.entries(policy.roles).map(([r, l]) => [r, clean(l)])),
    contexts: Object.fromEntries(Object.entries(policy.contexts).map(([c, l]) => [c, clean(l)])),
  };
};

const TabPolicyPanel = () => {
  const { user } = useAuth();
  const canEdit = Array.isArray(user?.permissions) && user.permissions.includes('system');

  const [catalog, setCatalog] = useState(null);
  const [sections, setSections] = useState([]);
  const [navItems, setNavItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState({});
  const [expanded, setExpanded] = useState({});
  const [newContext, setNewContext] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tabs, sectionCatalog, navCatalog, policyRes] = await Promise.all([
        loadClinicalTabCatalog(),
        loadClinicalSectionCatalog(),
        loadNavigationCatalog(),
        api.get('/api/command-center/ui-policy'),
      ]);
      const policy = normalize(policyRes.data?.policy || EMPTY_TAB_POLICY);
      setCatalog(tabs);
      setSections(sectionCatalog);
      setNavItems(navCatalog);
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

  const contextNames = useMemo(() => Object.keys(draft?.contexts || {}).sort(), [draft]);
  const columns = useMemo(
    () => [
      { key: ORG, label: 'Organization', role: null, context: null },
      ...roles.map((r) => ({ key: r, label: r, role: r, context: null })),
      ...contextNames.map((c) => ({ key: `ctx:${c}`, label: c, role: null, context: c })),
    ],
    [roles, contextNames],
  );

  const layerFor = (policy, key) => {
    if (key === ORG) return policy.org;
    if (key.startsWith('ctx:')) return policy.contexts[key.slice(4)] || emptyLayer();
    return policy.roles[key] || emptyLayer();
  };

  const setLayer = (key, updater) =>
    setDraft((prev) => {
      const next = { ...prev, org: { ...prev.org }, roles: { ...prev.roles }, contexts: { ...prev.contexts } };
      const updated = updater({ ...layerFor(prev, key), sections: { ...layerFor(prev, key).sections } });
      if (key === ORG) next.org = updated;
      else if (key.startsWith('ctx:')) next.contexts[key.slice(4)] = updated;
      else next.roles[key] = updated;
      return next;
    });

  const addContext = () => {
    const name = newContext.trim().toLowerCase();
    if (!CONTEXT_ID.test(name) || draft.contexts[name]) return;
    setDraft((prev) => ({ ...prev, contexts: { ...prev.contexts, [name]: emptyLayer() } }));
    setNewContext('');
  };

  const removeContext = (name) =>
    setDraft((prev) => {
      const contexts = { ...prev.contexts };
      delete contexts[name];
      return { ...prev, contexts };
    });

  const setSectionSpec = (key, tabId, updater) =>
    setLayer(key, (layer) => ({
      ...layer,
      sections: { ...layer.sections, [tabId]: updater({ ...emptySpec(), ...(layer.sections[tabId] || {}) }) },
    }));

  const toggleTab = (key, tabId) =>
    setLayer(key, (layer) => {
      const hidden = layer.hidden.includes(tabId) ? layer.hidden.filter((id) => id !== tabId) : [...layer.hidden, tabId];
      return { ...layer, hidden, default: hidden.includes(layer.default) ? null : layer.default };
    });

  const setDefault = (key, tabId) => setLayer(key, (layer) => ({ ...layer, default: tabId || null }));

  const toggleNav = (key, navId) =>
    setLayer(key, (layer) => {
      const hidden = layer.nav.hidden.includes(navId) ? layer.nav.hidden.filter((id) => id !== navId) : [...layer.nav.hidden, navId];
      return { ...layer, nav: { hidden } };
    });

  const toggleSection = (key, tabId, sectionId) =>
    setSectionSpec(key, tabId, (spec) => ({
      ...spec,
      hidden: spec.hidden.includes(sectionId) ? spec.hidden.filter((id) => id !== sectionId) : [...spec.hidden, sectionId],
    }));

  const addSection = (key, tabId, sectionId) =>
    setSectionSpec(key, tabId, (spec) => ({ ...spec, added: spec.added.includes(sectionId) ? spec.added : [...spec.added, sectionId] }));

  const removeAdded = (key, tabId, sectionId) =>
    setSectionSpec(key, tabId, (spec) => ({ ...spec, added: spec.added.filter((id) => id !== sectionId) }));

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.put(`/api/command-center/settings/${POLICY_KEY}`, { value: compact(draft) });
      const policy = normalize(response.data.value);
      setSaved(policy);
      setDraft(policy);
      setMeta({ source: response.data.source, updated_by: response.data.updated_by, updated_at: response.data.updated_at });
      await refreshTabPolicy();
      setNotice('Saved. Open charts and the navigation pick up the change on their next render.');
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
      setNotice('Policy reset: every tab, section and navigation page is visible for everyone.');
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

  const sectionsById = Object.fromEntries(sections.map((s) => [s.id, s]));
  const navSections = Object.entries(
    navItems.reduce((acc, item) => ({ ...acc, [item.section]: [...(acc[item.section] || []), item] }), {}),
  );
  const ownSections = (tabId) => sections.filter((s) => s.host === tabId);
  const hostableFor = (tabId) => sections.filter((s) => s.hostable && s.host !== tabId);
  const hasSections = (tabId) => ownSections(tabId).length > 0 || hostableFor(tabId).length > 0;

  /** Sections a column shows on a tab: own + added (any layer), for checkbox rows. */
  const sectionRowsFor = (tabId) => {
    const ids = new Set(ownSections(tabId).map((s) => s.id));
    for (const c of columns) for (const id of layerFor(draft, c.key).sections?.[tabId]?.added || []) ids.add(id);
    return [...ids].map((id) => sectionsById[id]).filter(Boolean);
  };

  const renderSectionRows = (tab) =>
    sectionRowsFor(tab.id).map((section) => {
      const foreign = section.host !== tab.id;
      return (
        <TableRow key={`${tab.id}:${section.id}`} sx={{ bgcolor: 'action.hover' }}>
          <TableCell sx={{ pl: 6 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <span>{section.label}</span>
              {foreign && (
                <Chip size="small" label={`from ${catalog.find((t) => t.id === section.host)?.label || section.host}`} variant="outlined" sx={{ borderRadius: 1 }} />
              )}
            </Stack>
          </TableCell>
          {columns.map((c) => {
            const layer = layerFor(draft, c.key);
            const spec = { ...emptySpec(), ...(layer.sections[tab.id] || {}) };
            const orgSpec = { ...emptySpec(), ...(draft.org.sections[tab.id] || {}) };
            const addedHere = spec.added.includes(section.id);
            const addedByOrg = c.key !== ORG && orgSpec.added.includes(section.id);
            const hiddenAbove = c.key !== ORG && orgSpec.hidden.includes(section.id);
            if (foreign) {
              // A hosted section is "on" where some layer added it.
              const on = addedHere || addedByOrg;
              return (
                <TableCell key={c.key} align="center">
                  <Tooltip title={addedByOrg ? 'Added for the whole organization' : ''}>
                    <span>
                      <Checkbox size="small" checked={on} disabled={!canEdit || busy || addedByOrg}
                        onChange={() => (addedHere ? removeAdded(c.key, tab.id, section.id) : addSection(c.key, tab.id, section.id))}
                        inputProps={{ 'aria-label': `${section.label} on ${tab.label} for ${c.label}` }} />
                    </span>
                  </Tooltip>
                </TableCell>
              );
            }
            const checked = !hiddenAbove && !spec.hidden.includes(section.id);
            return (
              <TableCell key={c.key} align="center">
                <Tooltip title={hiddenAbove ? 'Hidden for the whole organization' : ''}>
                  <span>
                    <Checkbox size="small" checked={checked} disabled={!canEdit || busy || hiddenAbove}
                      onChange={() => toggleSection(c.key, tab.id, section.id)}
                      inputProps={{ 'aria-label': `${section.label} on ${tab.label} for ${c.label}` }} />
                  </span>
                </Tooltip>
              </TableCell>
            );
          })}
        </TableRow>
      );
    });

  const renderAddRow = (tab) => {
    const options = hostableFor(tab.id).filter((s) => !sectionRowsFor(tab.id).some((r) => r.id === s.id));
    if (!options.length || !canEdit) return null;
    const id = `add-section-${tab.id}`;
    return (
      <TableRow key={`${tab.id}:add`} sx={{ bgcolor: 'action.hover' }}>
        <TableCell sx={{ pl: 6 }} colSpan={columns.length + 1}>
          <FormControl size="small" sx={{ minWidth: 260 }} disabled={busy}>
            <InputLabel id={`${id}-label`}>Add a section to {tab.label} (organization)</InputLabel>
            <Select labelId={`${id}-label`} id={id} label={`Add a section to ${tab.label} (organization)`} value=""
              onChange={(e) => e.target.value && addSection(ORG, tab.id, e.target.value)}
              inputProps={{ 'aria-label': `Add a section to ${tab.label}` }}>
              {options.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>from {catalog.find((t) => t.id === s.host)?.label || s.host}</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            Adds it for everyone; untick it per role above to narrow.
          </Typography>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Changing the tab policy needs the <code>system</code> permission. Shown read-only.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Chart tabs</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tick a cell to show that tab. The Organization column applies to everyone; a role column can only hide
        more. <strong>Summary</strong> is always visible. Expand a tab to choose the sections inside it, or to add a
        section from another tab. Changes take effect on the next render of an open chart.
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tab</TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} align="center" sx={{ textTransform: c.role ? 'capitalize' : 'none' }}>
                  {c.context ? (
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                      <Tooltip title="Workflow context: applies on top of the role when a user picks it in the chart">
                        <Chip size="small" label={c.label} variant="outlined" sx={{ borderRadius: 1 }} />
                      </Tooltip>
                      {canEdit && (
                        <IconButton size="small" onClick={() => removeContext(c.context)} disabled={busy} aria-label={`Remove context ${c.context}`}>
                          <CloseIcon fontSize="inherit" />
                        </IconButton>
                      )}
                    </Stack>
                  ) : c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {catalog.map((tab) => (
              <React.Fragment key={tab.id}>
                <TableRow hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {hasSections(tab.id) ? (
                        <IconButton size="small" onClick={() => setExpanded((e) => ({ ...e, [tab.id]: !e[tab.id] }))}
                          aria-label={`${expanded[tab.id] ? 'Collapse' : 'Expand'} ${tab.label} sections`} aria-expanded={Boolean(expanded[tab.id])}>
                          {expanded[tab.id] ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                        </IconButton>
                      ) : (
                        <Box sx={{ width: 28 }} />
                      )}
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tab.color || 'grey.400' }} />
                      <span>{tab.label}</span>
                      <Typography variant="caption" color="text.disabled">{tab.id}</Typography>
                    </Stack>
                  </TableCell>
                  {columns.map((c) => {
                    const layer = layerFor(draft, c.key);
                    const locked = ALWAYS_VISIBLE_TABS.includes(tab.id);
                    const hiddenAbove = c.key !== ORG && draft.org.hidden.includes(tab.id);
                    const checked = !locked && !hiddenAbove ? !layer.hidden.includes(tab.id) : !hiddenAbove;
                    return (
                      <TableCell key={c.key} align="center">
                        <Tooltip title={locked ? 'Summary is always visible' : hiddenAbove ? 'Hidden for the whole organization' : ''}>
                          <span>
                            <Checkbox size="small" checked={checked} disabled={!canEdit || locked || hiddenAbove || busy}
                              onChange={() => toggleTab(c.key, tab.id)}
                              inputProps={{ 'aria-label': `${tab.label} visible for ${c.label}` }} />
                          </span>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
                {expanded[tab.id] && renderSectionRows(tab)}
                {expanded[tab.id] && renderAddRow(tab)}
              </React.Fragment>
            ))}
            <TableRow>
              <TableCell><strong>Opens on</strong></TableCell>
              {columns.map((c) => {
                const layer = layerFor(draft, c.key);
                const preview = resolveEffectiveTabs(catalog, draft, { role: c.role, context: c.context });
                const id = `default-${c.key}`;
                return (
                  <TableCell key={c.key} align="center">
                    <FormControl size="small" sx={{ minWidth: 150 }} disabled={!canEdit || busy}>
                      <InputLabel id={`${id}-label`}>Default</InputLabel>
                      <Select labelId={`${id}-label`} id={id} label="Default" value={layer.default || ''}
                        onChange={(e) => setDefault(c.key, e.target.value)}
                        inputProps={{ 'aria-label': `Default tab for ${c.label}` }}>
                        <MenuItem value="">{c.role || c.context ? 'Inherit' : 'First visible'}</MenuItem>
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

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 0.5 }}>Primary navigation</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        The pages in the app's menu, icon rail and command palette. An unticked page leaves the menu and its address
        lands on the first visible page. <strong>Patients</strong> is the landing page and the{' '}
        <strong>Command Center</strong> is how you undo this, so neither can be hidden.
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
        <Table size="small" aria-label="Primary navigation">
          <TableHead>
            <TableRow>
              <TableCell>Page</TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} align="center" sx={{ textTransform: c.role ? 'capitalize' : 'none' }}>{c.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {navSections.map(([section, items]) => (
              <React.Fragment key={section}>
                <TableRow>
                  <TableCell colSpan={columns.length + 1} sx={{ bgcolor: 'action.hover', py: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {items[0].sectionTitle}
                    </Typography>
                  </TableCell>
                </TableRow>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1 }}>
                        <span>{item.label}</span>
                        <Typography variant="caption" color="text.disabled">{item.path}</Typography>
                      </Stack>
                    </TableCell>
                    {columns.map((c) => {
                      const layer = layerFor(draft, c.key);
                      const locked = ALWAYS_VISIBLE_NAV.includes(item.id);
                      const hiddenAbove = c.key !== ORG && draft.org.nav.hidden.includes(item.id);
                      const checked = locked || (!hiddenAbove && !layer.nav.hidden.includes(item.id));
                      return (
                        <TableCell key={c.key} align="center">
                          <Tooltip title={locked ? `${item.label} is always in the navigation` : hiddenAbove ? 'Hidden for the whole organization' : ''}>
                            <span>
                              <Checkbox size="small" checked={checked} disabled={!canEdit || locked || hiddenAbove || busy}
                                onChange={() => toggleNav(c.key, item.id)}
                                inputProps={{ 'aria-label': `${item.label} page visible for ${c.label}` }} />
                            </span>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
        <Typography variant="subtitle2">Workflow contexts</Typography>
        <Typography variant="caption" color="text.secondary">
          A context (inpatient, surgical, clinic…) is a column a user can switch on from the chart's tab strip; it narrows what their role already shows.
          {contextNames.length === 0 && ' None defined yet.'}
        </Typography>
        {canEdit && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField size="small" label="New context" value={newContext} onChange={(e) => setNewContext(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContext(); } }}
              inputProps={{ 'aria-label': 'New context' }} helperText={newContext && !CONTEXT_ID.test(newContext.trim().toLowerCase()) ? 'lowercase letters, digits, dashes' : ' '} sx={{ minWidth: 180 }} />
            <Button size="small" variant="outlined" onClick={addContext} disabled={busy || !CONTEXT_ID.test(newContext.trim().toLowerCase()) || Boolean(draft.contexts[newContext.trim().toLowerCase()])} sx={{ mb: 2.5 }}>
              Add context
            </Button>
          </Stack>
        )}
      </Stack>

      <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Preview</Typography>
      <Stack spacing={1}>
        {columns.map((c) => {
          const preview = resolveEffectiveTabs(catalog, draft, { role: c.role, context: c.context });
          return (
            <Box key={c.key} data-testid={`preview-${c.key}`}>
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography variant="caption" sx={{ minWidth: 110, textTransform: c.role ? 'capitalize' : 'none' }}>
                  {c.context ? `context ${c.label}` : c.label}
                </Typography>
                {preview.tabs.map((t) => (
                  <Chip key={t.id} size="small" label={t.label} variant={t.id === preview.defaultTab ? 'filled' : 'outlined'}
                    color={t.id === preview.defaultTab ? 'primary' : 'default'} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ pl: 14, mt: 0.5 }}
                data-testid={`preview-${c.key}-nav`}>
                <Typography variant="caption" color="text.secondary">Navigation:</Typography>
                {resolveEffectiveNav(navItems, draft, { role: c.role, context: c.context }).items.map((i) => (
                  <Chip key={i.id} size="small" label={i.label} variant="outlined" sx={{ borderRadius: 1, height: 20, fontSize: 11 }} />
                ))}
              </Stack>
              {preview.tabs.filter((t) => expanded[t.id] && hasSections(t.id)).map((t) => {
                const sec = resolveEffectiveSections(t.id, sections, draft, { role: c.role, context: c.context });
                return (
                  <Stack key={t.id} direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ pl: 14, mt: 0.5 }}
                    data-testid={`preview-${c.key}-${t.id}`}>
                    <Typography variant="caption" color="text.secondary">{t.label}:</Typography>
                    {sec.sections.map((s) => (
                      <Chip key={s.id} size="small" label={s.label} variant="outlined" sx={{ borderRadius: 1, height: 20, fontSize: 11 }} />
                    ))}
                  </Stack>
                );
              })}
            </Box>
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
