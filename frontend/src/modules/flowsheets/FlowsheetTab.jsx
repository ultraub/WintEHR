/**
 * FlowsheetTab — nursing vitals flowsheet (the module-platform pilot,
 * docs/MODULES.md).
 *
 * A time × vital-sign grid over `GET /api/clinical/flowsheets/vitals/data`.
 * Columns are wall-clock buckets across the selected window; each cell shows
 * the bucket's LATEST value with the full list in the tooltip. "Chart vitals"
 * posts a set of values — each becomes a FHIR Observation — then refetches;
 * the grid never fabricates or locally mutates values (the server read is
 * the truth, same policy as the MAR).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

import { api, buildUrl, useAuth } from '../sdk';

const TEMPLATE_ID = 'vitals';
const ROW_HEADER_WIDTH = 170;

const WINDOW_PRESETS = [
  { id: '4h', label: '4h', hours: 4, stepMin: 30 },
  { id: '12h', label: '12h', hours: 12, stepMin: 60 },
  { id: '24h', label: '24h', hours: 24, stepMin: 120 },
  { id: '48h', label: '48h', hours: 48, stepMin: 240 },
];

/** Wall-clock-aligned column starts covering [start, end). */
function buildColumns(windowStart, windowEnd, stepMin) {
  const start = new Date(windowStart);
  start.setMinutes(Math.floor(start.getMinutes() / stepMin) * stepMin, 0, 0);
  const cols = [];
  for (let t = new Date(start); t < windowEnd; t = new Date(t.getTime() + stepMin * 60_000)) {
    cols.push(new Date(t));
  }
  return cols;
}

const FlowsheetTab = ({ patientId, currentPatient }) => {
  const theme = useTheme();
  const { user } = useAuth();
  const effectivePatientId = patientId || currentPatient?.id;

  const [presetId, setPresetId] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const preset = WINDOW_PRESETS.find((p) => p.id === presetId) || WINDOW_PRESETS[2];
  // Window end pins to "now at fetch time"; refetch moves it.
  const [windowEnd, setWindowEnd] = useState(() => new Date());
  const windowStart = useMemo(
    () => new Date(windowEnd.getTime() - preset.hours * 3600_000),
    [windowEnd, preset],
  );

  const fetchData = useCallback(async () => {
    if (!effectivePatientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        buildUrl('backend', `/api/clinical/flowsheets/${TEMPLATE_ID}/data`),
        {
          params: {
            patient_id: effectivePatientId,
            window_start: windowStart.toISOString(),
            window_end: windowEnd.toISOString(),
          },
        },
      );
      setData(res.data);
    } catch (err) {
      console.error('FlowsheetTab: fetch failed', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [effectivePatientId, windowStart, windowEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(
    () => buildColumns(windowStart, windowEnd, preset.stepMin),
    [windowStart, windowEnd, preset.stepMin],
  );

  // row key -> column index -> [entries in that bucket, time-ascending]
  const cellMap = useMemo(() => {
    const map = new Map();
    if (!data?.rows) return map;
    for (const row of data.rows) {
      const byCol = new Map();
      for (const entry of row.entries) {
        const t = new Date(entry.time);
        const idx = columns.findIndex(
          (c, i) => t >= c && (i + 1 >= columns.length || t < columns[i + 1]),
        );
        if (idx < 0) continue;
        if (!byCol.has(idx)) byCol.set(idx, []);
        byCol.get(idx).push(entry);
      }
      map.set(row.key, byCol);
    }
    return map;
  }, [data, columns]);

  const hasAnyEntry = useMemo(
    () => (data?.rows || []).some((row) => row.entries.length > 0),
    [data],
  );

  const openDialog = () => {
    setDraft({});
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const entries = (data?.rows || [])
      .filter((row) => String(draft[row.key] ?? '').trim() !== '')
      .map((row) => ({ row_key: row.key, value: parseFloat(draft[row.key]) }));
    if (entries.length === 0) {
      setSaveError('Enter at least one value.');
      return;
    }
    if (entries.some((e) => Number.isNaN(e.value))) {
      setSaveError('Values must be numeric.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.post(buildUrl('backend', '/api/clinical/flowsheets/entries'), {
        patient_id: effectivePatientId,
        template_id: TEMPLATE_ID,
        entries,
        ...(user?.id ? { performer_reference: `Practitioner/${user.id}` } : {}),
      });
      setDialogOpen(false);
      setWindowEnd(new Date()); // re-pin the window; triggers refetch
    } catch (err) {
      console.error('FlowsheetTab: save failed', err);
      setSaveError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!effectivePatientId) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Pick a patient to load the flowsheet.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Vital Signs Flowsheet</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={presetId}
          onChange={(_, v) => { if (v) { setPresetId(v); setWindowEnd(new Date()); } }}
        >
          {WINDOW_PRESETS.map((p) => (
            <ToggleButton key={p.id} value={p.id}>{p.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => setWindowEnd(new Date())}>
          Refresh
        </Button>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
          Chart vitals
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load flowsheet: {error.message}
        </Alert>
      )}

      {loading && !data && (
        <Stack direction="row" justifyContent="center" alignItems="center" sx={{ py: 6, gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading flowsheet…</Typography>
        </Stack>
      )}

      {data && (
        <>
          {!hasAnyEntry && (
            <Alert severity="info" sx={{ mb: 1 }}>
              No observations in this window — widen the window or chart a set.
            </Alert>
          )}
          <Box sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)', border: `1px solid ${theme.palette.divider}` }}>
            {/* Header row */}
            <Box sx={{ display: 'flex', position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', borderBottom: `2px solid ${theme.palette.divider}` }}>
              <Box sx={{ width: ROW_HEADER_WIDTH, flexShrink: 0, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 3, px: 1, py: 0.5, borderRight: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Vital</Typography>
              </Box>
              {columns.map((c, i) => (
                <Box key={i} sx={{ flex: '0 0 auto', width: 64, px: 0.5, py: 0.5, textAlign: 'center', borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500 }}>
                    {c.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  {preset.hours > 24 && (
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', display: 'block', color: 'text.disabled' }}>
                      {c.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
            {/* Body rows */}
            {(data.rows || []).map((row) => {
              const byCol = cellMap.get(row.key) || new Map();
              return (
                <Box key={row.key} sx={{ display: 'flex', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                  <Box sx={{ width: ROW_HEADER_WIDTH, flexShrink: 0, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, px: 1, py: 0.5, borderRight: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
                    <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {row.label}
                    </Typography>
                    {row.unit && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {row.unit}
                      </Typography>
                    )}
                  </Box>
                  {columns.map((_, i) => {
                    const entries = byCol.get(i) || [];
                    const latest = entries[entries.length - 1];
                    return (
                      <Tooltip
                        key={i}
                        title={entries.length > 1
                          ? entries.map((e) => `${new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${e.value}`).join(' · ')
                          : (latest ? new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                        disableHoverListener={!latest}
                      >
                        <Box sx={{
                          flex: '0 0 auto',
                          width: 64,
                          minHeight: 34,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                          bgcolor: latest ? alpha(theme.palette.success.main, 0.06) : undefined,
                        }}>
                          {latest && (
                            <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                              {latest.value}
                              {entries.length > 1 && (
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                  {' '}×{entries.length}
                                </Typography>
                              )}
                            </Typography>
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* Chart-vitals dialog */}
      <Dialog open={dialogOpen} onClose={saving ? undefined : () => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Chart vitals</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            {(data?.rows || []).map((row) => (
              <TextField
                key={row.key}
                label={`${row.label}${row.unit ? ` (${row.unit})` : ''}`}
                value={draft[row.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                size="small"
                inputProps={{ inputMode: 'decimal' }}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              Leave fields blank to skip them. Each value is recorded as a FHIR
              Observation timestamped now.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FlowsheetTab;
