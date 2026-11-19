/**
 * PNOrderTab.
 *
 * Parenteral nutrition: one order is one 24 h compounded bag. Produces a
 * MedicationRequest with status='draft' (pended). The structured fields are
 * written to the `order-details` extension as JSON with the study's
 * nutrition vocabulary: route, volume_ml,
 * rate_ml_h, hours, amino_acids_g, dextrose_g, lipid_g, sodium_meq,
 * potassium_meq, calcium_meq, magnesium_meq, phosphate_mmol, mvi_ml,
 * trace_ml, insulin_units, thiamine_mg. Totals per day. An empty field is
 * "not entered" and is left out; 0 is written as 0.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, FormControl, Grid, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useDraftOrderBundle } from '../DraftOrderBundleProvider';

const EXT_BASE = 'http://wintehr.local/fhir/StructureDefinition';
const PN_SYSTEM = 'http://wintehr.local/fhir/CodeSystem/pn-order';

const FIELDS = [
  { key: 'volume_ml', label: 'Total volume (mL per day)' },
  { key: 'rate_ml_h', label: 'Rate (mL/h)' },
  { key: 'hours', label: 'Infuse over (hours)' },
  { key: 'amino_acids_g', label: 'Amino acids (g per day)' },
  { key: 'dextrose_g', label: 'Dextrose (g per day)' },
  { key: 'lipid_g', label: 'Lipid (g per day)' },
  { key: 'sodium_meq', label: 'Sodium (mEq per day)' },
  { key: 'potassium_meq', label: 'Potassium (mEq per day)' },
  { key: 'calcium_meq', label: 'Calcium (mEq per day)' },
  { key: 'magnesium_meq', label: 'Magnesium (mEq per day)' },
  { key: 'phosphate_mmol', label: 'Phosphate (mmol per day)' },
  { key: 'mvi_ml', label: 'Multivitamin (mL per day)' },
  { key: 'trace_ml', label: 'Trace elements (mL per day)' },
  { key: 'insulin_units', label: 'Regular insulin in bag (units)' },
  { key: 'thiamine_mg', label: 'Thiamine (mg per day)' },
];
const SHORT = {
  volume_ml: ['volume', 'mL'], rate_ml_h: ['rate', 'mL/h'], hours: ['over', 'h'], amino_acids_g: ['amino acids', 'g'],
  dextrose_g: ['dextrose', 'g'], lipid_g: ['lipid', 'g'], sodium_meq: ['sodium', 'mEq'], potassium_meq: ['potassium', 'mEq'],
  calcium_meq: ['calcium', 'mEq'], magnesium_meq: ['magnesium', 'mEq'], phosphate_mmol: ['phosphate', 'mmol'],
  mvi_ml: ['MVI', 'mL'], trace_ml: ['trace elements', 'mL'], insulin_units: ['insulin', 'units'], thiamine_mg: ['thiamine', 'mg'],
};
const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const PNOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();
  const [route, setRoute] = useState('');
  const [vals, setVals] = useState({});
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('routine');
  const [error, setError] = useState(null);

  const numeric = (k) => {
    const s = (vals[k] ?? '').toString().trim();
    return s === '' || Number.isNaN(Number(s)) ? null : Number(s);
  };
  const entered = FIELDS.filter((f) => numeric(f.key) !== null);
  const canAdd = useMemo(
    () => Boolean(route) && indication.trim().length >= 5
      && (numeric('amino_acids_g') !== null || numeric('dextrose_g') !== null || numeric('volume_ml') !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, indication, vals],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Choose central or peripheral, enter amino acids, dextrose or a volume, and give an indication (5+ chars).');
      return;
    }
    setError(null);
    const details = { route };
    entered.forEach((f) => { details[f.key] = numeric(f.key); });
    details.indication = indication.trim();
    const name = 'Parenteral nutrition, adult, compounded';
    const text = [`${route} line`, ...entered.map((f) => `${SHORT[f.key][0]} ${numeric(f.key)} ${SHORT[f.key][1]}`)].join('; ');
    addDraft({
      resourceType: 'MedicationRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      medicationCodeableConcept: {
        coding: [{ system: PN_SYSTEM, code: 'pn-adult-compounded', display: name }],
        text: name,
      },
      reasonCode: [{ text: indication.trim() }],
      dosageInstruction: [{ text, route: { text: route === 'central' ? 'IV (central)' : 'IV (peripheral)' } }],
      extension: [{ url: `${EXT_BASE}/order-details`, valueString: JSON.stringify(details) }],
    });
    setVals({}); setIndication(''); setRoute('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdd, route, vals, indication, priority, patientId, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="overline" color="text.secondary">Parenteral nutrition order (one 24 h bag)</Typography>
      <FormControl fullWidth size="small">
        <InputLabel id="pn-route-label">Route</InputLabel>
        <Select labelId="pn-route-label" label="Route" value={route} onChange={(e) => setRoute(e.target.value)}
          inputProps={{ 'aria-label': 'Route' }}>
          <MenuItem value="central">Central</MenuItem>
          <MenuItem value="peripheral">Peripheral</MenuItem>
        </Select>
      </FormControl>
      <Typography variant="caption" color="text.secondary">
        Totals per day. Leave a field empty if it is not part of this bag; enter 0 to state none.
      </Typography>
      <Grid container spacing={1.5}>
        {FIELDS.map((f) => (
          <Grid item xs={6} key={f.key}>
            <TextField label={f.label} type="number" size="small" fullWidth value={vals[f.key] ?? ''}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} inputProps={{ min: 0, step: 'any' }} />
          </Grid>
        ))}
      </Grid>
      <Typography variant="overline" color="text.secondary">Clinical context</Typography>
      <TextField label="Clinical indication" value={indication} onChange={(e) => setIndication(e.target.value)}
        placeholder="Why is PN needed?" multiline minRows={2} helperText="At least 5 characters." />
      <FormControl size="small" sx={{ maxWidth: 200 }}>
        <InputLabel id="pn-priority-label">Priority</InputLabel>
        <Select labelId="pn-priority-label" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}
          inputProps={{ 'aria-label': 'Priority' }}>
          {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </Select>
      </FormControl>
      <Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} disabled={!canAdd} aria-label="Add to draft list">
          Add to draft list
        </Button>
      </Box>
    </Stack>
  );
};

export default PNOrderTab;
