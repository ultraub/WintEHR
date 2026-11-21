/**
 * CommandCenterPage — deployment status dashboard (module 'command-center').
 *
 * The Status tab (docs/COMMAND_CENTER.md slices 1 and 11): reads
 * GET /api/command-center/status and shows the readiness checklist, every
 * probed component (incl. host and certificate via the sidecar), the router
 * registration state, and FHIR resource counts. The other tabs are the
 * sibling *Panel components.
 *
 * All four states are handled: loading, error, empty (not admin), success.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import {
  CheckCircle as OkIcon,
  Error as FailIcon,
  Info as InfoIcon,
  Warning as WarnIcon,
} from '@mui/icons-material';
import { api, useAuth } from '../sdk';
import JobsPanel from './JobsPanel';
import SettingsPanel from './SettingsPanel';
import TabPolicyPanel from './TabPolicyPanel';
import RolesPanel from './RolesPanel';
import AppsPanel from './AppsPanel';
import LogsPanel from './LogsPanel';
import ModulesPanel from './ModulesPanel';
import ControlPanel from './ControlPanel';

const STATUS_COLOR = {
  ok: 'success',
  degraded: 'warning',
  down: 'error',
  absent: 'default',
};

const COMPONENT_LABEL = {
  fhir: 'HAPI FHIR',
  database: 'PostgreSQL',
  redis: 'Redis',
  terminology: 'Terminology index',
  vna: 'Imaging VNA',
  host: 'Host',
  tls: 'HTTPS certificate',
};

const READINESS_ICON = {
  ok: <OkIcon color="success" fontSize="small" />,
  info: <InfoIcon color="info" fontSize="small" />,
  warn: <WarnIcon color="warning" fontSize="small" />,
  fail: <FailIcon color="error" fontSize="small" />,
};

const StatusChip = ({ status }) => (
  <Chip
    size="small"
    label={status}
    color={STATUS_COLOR[status] || 'default'}
    variant={status === 'absent' ? 'outlined' : 'filled'}
    sx={{ textTransform: 'uppercase', fontWeight: 600, borderRadius: 1 }}
  />
);

const ComponentCard = ({ component }) => {
  const { name, status, detail, data } = component;
  const facts = Object.entries(data || {}).filter(
    ([key, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value) && value !== '' && key !== 'url' && !key.endsWith('path'),
  );
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', borderRadius: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {COMPONENT_LABEL[name] || name}
        </Typography>
        <StatusChip status={status} />
      </Stack>
      {detail && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: facts.length ? 1 : 0 }}>
          {detail}
        </Typography>
      )}
      {facts.map(([key, value]) => (
        <Typography key={key} variant="caption" display="block" color="text.secondary">
          {key.replace(/_/g, ' ')}: <strong>{String(value)}</strong>
        </Typography>
      ))}
    </Paper>
  );
};

/**
 * The readiness checklist: what a class would trip over, with the fix. Items
 * the backend marks `skip` (not applicable to this profile) are not shown.
 */
const ReadinessCard = ({ items }) => {
  const visible = (items || []).filter((i) => i.status !== 'skip');
  const fails = visible.filter((i) => i.status === 'fail').length;
  const warns = visible.filter((i) => i.status === 'warn').length;
  const summary = fails ? { label: `${fails} to fix`, color: 'error' } : warns ? { label: `${warns} to review`, color: 'warning' } : { label: 'Ready', color: 'success' };
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }} data-testid="readiness">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Readiness
        </Typography>
        <Chip size="small" label={summary.label} color={summary.color} sx={{ fontWeight: 600, borderRadius: 1 }} />
      </Stack>
      <Grid container columnSpacing={2}>
        {visible.map((item) => (
          <Grid item xs={12} md={6} key={item.id}>
            <List dense disablePadding>
              <ListItem disableGutters alignItems="flex-start" sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>{READINESS_ICON[item.status] || READINESS_ICON.info}</ListItemIcon>
                <ListItemText
                  primary={
                    <>
                      <strong>{item.label}</strong>
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}— {item.detail}
                      </Typography>
                    </>
                  }
                  secondary={item.fix && item.status !== 'ok' ? `Fix: ${item.fix}` : null}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            </List>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

const RoutersCard = ({ routers }) => (
  <Paper variant="outlined" sx={{ p: 2, height: '100%', borderRadius: 1 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        Backend routers
      </Typography>
      <StatusChip status={routers.failed.length ? 'degraded' : 'ok'} />
    </Stack>
    <Typography variant="body2" color="text.secondary">
      {routers.registered} registered
      {routers.failed.length > 0 && `, ${routers.failed.length} failed`}
    </Typography>
    {routers.failed.map((f) => (
      <Alert key={f.router || f.module} severity="error" variant="outlined" sx={{ mt: 1 }}>
        <strong>{f.router}</strong>
        {f.error ? `: ${f.error}` : ''}
      </Alert>
    ))}
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        Modules
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
        {routers.modules.map((key) => {
          const disabled = routers.disabled_modules.includes(key);
          return (
            <Chip
              key={key}
              size="small"
              label={key}
              variant={disabled ? 'outlined' : 'filled'}
              color={disabled ? 'default' : 'primary'}
              sx={{ borderRadius: 1, textDecoration: disabled ? 'line-through' : 'none' }}
            />
          );
        })}
      </Stack>
    </Box>
  </Paper>
);

const ResourceCountsTable = ({ counts }) => {
  const rows = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No FHIR resources loaded yet.
      </Typography>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Resource type</TableCell>
          <TableCell align="right">Count</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(([type, n]) => (
          <TableRow key={type}>
            <TableCell>{type}</TableCell>
            <TableCell align="right">{n.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const CommandCenterPage = () => {
  const { user } = useAuth();
  const isAdmin = Array.isArray(user?.permissions) && user.permissions.includes('admin');

  const [tab, setTab] = useState('status');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/command-center/status');
      setReport(response.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || err?.message || 'Could not load deployment status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Administrator access is required for the Command Center.</Alert>
      </Box>
    );
  }

  const database = report?.components?.find((c) => c.name === 'database');

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Command Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {{ status: 'Deployment status', jobs: 'Jobs', settings: 'Settings', tabs: 'Chart tabs by role', roles: 'Roles and permissions', apps: 'Registered services and apps', logs: 'Backend logs', modules: 'Modules', control: 'Containers and host' }[tab]}
            {tab === 'status' && report?.checked_at && ` · checked ${new Date(report.checked_at).toLocaleString()}`}
            {report?.build?.version && ` · v${report.build.version}`}
            {report?.build?.git_commit && ` (${String(report.build.git_commit).slice(0, 8)})`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {report && <StatusChip status={report.status} />}
          {tab === 'status' && (
            <Button size="small" variant="outlined" onClick={load} disabled={loading}>
              {loading ? 'Checking…' : 'Refresh'}
            </Button>
          )}
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_e, value) => setTab(value)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="status" label="Status" />
        <Tab value="jobs" label="Jobs" />
        <Tab value="settings" label="Settings" />
        <Tab value="tabs" label="Tabs" />
        <Tab value="roles" label="Roles" />
        <Tab value="apps" label="Apps" />
        <Tab value="logs" label="Logs" />
        <Tab value="modules" label="Modules" />
        <Tab value="control" label="Control" />
      </Tabs>

      {tab === 'jobs' && <JobsPanel />}
      {tab === 'settings' && <SettingsPanel />}
      {tab === 'tabs' && <TabPolicyPanel />}
      {tab === 'roles' && <RolesPanel />}
      {tab === 'apps' && <AppsPanel />}
      {tab === 'logs' && <LogsPanel />}
      {tab === 'modules' && <ModulesPanel />}
      {tab === 'control' && <ControlPanel />}

      {tab === 'status' && loading && !report && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Probing the deployment…
          </Typography>
        </Box>
      )}

      {tab === 'status' && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {tab === 'status' && report && (
        <Grid container spacing={2}>
          {report.readiness?.length > 0 && (
            <Grid item xs={12}>
              <ReadinessCard items={report.readiness} />
            </Grid>
          )}
          <Grid item xs={12} md={6} lg={4}>
            <RoutersCard routers={report.routers} />
          </Grid>
          {report.components.map((component) => (
            <Grid item xs={12} md={6} lg={4} key={component.name}>
              <ComponentCard component={component} />
            </Grid>
          ))}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                FHIR resources
              </Typography>
              <ResourceCountsTable counts={database?.data?.resource_counts} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                About this deployment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                WintEHR, an educational EHR for learning FHIR R4, clinical workflows, and CDS Hooks.
                React 18 + MUI on the front, FastAPI over HAPI FHIR JPA and PostgreSQL behind it.
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                Environment: <strong>{report.build?.environment || 'unknown'}</strong>
                {report.build?.version && <> · version <strong>{report.build.version}</strong></>}
                {report.build?.git_commit && <> · commit <strong>{String(report.build.git_commit).slice(0, 8)}</strong></>}
              </Typography>
              <Alert severity="warning" variant="outlined" sx={{ mt: 1.5 }}>
                Educational use only. Never load real Protected Health Information; all patient data is
                synthetic (Synthea).
              </Alert>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default CommandCenterPage;
