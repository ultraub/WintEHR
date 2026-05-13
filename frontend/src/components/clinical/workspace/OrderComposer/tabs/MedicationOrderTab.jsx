/**
 * MedicationOrderTab — RxNorm-backed med composition for the Order Composer
 * (#116, Phase 4.1.B).
 *
 * Mirrors the field set MedicationDialogEnhanced uses (dose / route /
 * frequency / duration / PRN / refills / indication / priority) but
 * trimmed to what students need for a draft. Auto-computes dispense
 * quantity from frequency × duration so students don't have to do the
 * math.
 *
 * Each "Add to draft list" click pushes a `MedicationRequest` with
 * `status='draft'` and `intent='order'` into the shared
 * `DraftOrderBundleProvider`. The shell's Sign All step flips draft →
 * active when the user confirms.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import catalogService from '../../../../../services/CatalogIntegrationService';
import { useDraftOrderBundle } from '../DraftOrderBundleProvider';

const ROUTES = [
  { value: 'PO', label: 'PO (by mouth)' },
  { value: 'IV', label: 'IV (intravenous)' },
  { value: 'IM', label: 'IM (intramuscular)' },
  { value: 'SC', label: 'SC (subcutaneous)' },
  { value: 'TOP', label: 'Topical' },
  { value: 'INH', label: 'Inhalation' },
  { value: 'PR', label: 'PR (rectal)' },
  { value: 'SL', label: 'Sublingual' },
];

// FHIR R4 Timing.code mapping for common frequencies. The value here is
// the dose-events-per-day count we use to compute dispense quantity;
// the label is what the user sees. Note PRN intentionally has 0 — PRN
// doses don't drive a fixed dispense count.
const FREQUENCIES = [
  { value: 'QD',  label: 'Once daily',    perDay: 1 },
  { value: 'BID', label: 'Twice daily',   perDay: 2 },
  { value: 'TID', label: 'Three times daily', perDay: 3 },
  { value: 'QID', label: 'Four times daily',  perDay: 4 },
  { value: 'Q4H', label: 'Every 4 hours',  perDay: 6 },
  { value: 'Q6H', label: 'Every 6 hours',  perDay: 4 },
  { value: 'Q8H', label: 'Every 8 hours',  perDay: 3 },
  { value: 'Q12H', label: 'Every 12 hours', perDay: 2 },
  { value: 'PRN',  label: 'As needed (PRN)', perDay: 0 },
];

const DOSE_UNITS = ['mg', 'mcg', 'g', 'mL', 'units', 'tablet(s)', 'capsule(s)'];
const DURATION_UNITS = [
  { value: 'd', label: 'days' },
  { value: 'wk', label: 'weeks' },
  { value: 'mo', label: 'months' },
];
const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm';

const MedicationOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  // Search / pick state
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  // Dosing fields
  const [doseQty, setDoseQty] = useState('');
  const [doseUnit, setDoseUnit] = useState('mg');
  const [route, setRoute] = useState('PO');
  const [frequency, setFrequency] = useState('BID');
  const [durationQty, setDurationQty] = useState('30');
  const [durationUnit, setDurationUnit] = useState('d');
  const [prn, setPrn] = useState(false);
  const [prnReason, setPrnReason] = useState('');
  const [refills, setRefills] = useState('0');

  // Workflow fields
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('routine');

  // UI state
  const [error, setError] = useState(null);

  // Debounced RxNorm search
  useEffect(() => {
    const handle = setTimeout(async () => {
      const q = search.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const items = await catalogService.getMedications(q, 25);
        setResults(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn('MedicationOrderTab: catalog search failed', e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  // Auto-compute dispense quantity from frequency × duration. Skip PRN
  // (the user manages PRN dispenses manually — there's no fixed per-day
  // count to multiply). The frequency code is mapped to events-per-day
  // via the FREQUENCIES table above.
  const dispenseQuantity = useMemo(() => {
    if (prn || frequency === 'PRN') return null;
    const freqRow = FREQUENCIES.find((f) => f.value === frequency);
    if (!freqRow || !freqRow.perDay) return null;
    const durDays = (() => {
      const n = parseFloat(durationQty);
      if (!Number.isFinite(n) || n <= 0) return null;
      if (durationUnit === 'd') return n;
      if (durationUnit === 'wk') return n * 7;
      if (durationUnit === 'mo') return n * 30;
      return null;
    })();
    if (!durDays) return null;
    return Math.ceil(freqRow.perDay * durDays);
  }, [prn, frequency, durationQty, durationUnit]);

  const canAdd = useMemo(
    () =>
      Boolean(
        selected
          && doseQty.trim()
          && indication.trim().length >= 5
          && (!prn || prnReason.trim().length >= 1),
      ),
    [selected, doseQty, indication, prn, prnReason],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a medication, set dose, and write an indication (5+ chars). PRN requires a reason.');
      return;
    }
    setError(null);

    const effectiveFrequency = prn ? 'PRN' : frequency;

    const draft = {
      resourceType: 'MedicationRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      medicationCodeableConcept: {
        coding: [
          {
            system: RXNORM_SYSTEM,
            code: selected.code,
            display: selected.display,
          },
        ],
        text: selected.display,
      },
      dosageInstruction: [
        {
          text: [
            `${doseQty} ${doseUnit}`,
            ROUTES.find((r) => r.value === route)?.label || route,
            FREQUENCIES.find((f) => f.value === effectiveFrequency)?.label || effectiveFrequency,
            prn && prnReason ? `PRN for ${prnReason.trim()}` : null,
          ].filter(Boolean).join(' · '),
          asNeededBoolean: prn,
          route: { text: route },
          timing: { code: { text: effectiveFrequency } },
          doseAndRate: [
            {
              doseQuantity: {
                value: parseFloat(doseQty),
                unit: doseUnit,
              },
            },
          ],
        },
      ],
      dispenseRequest: {
        quantity: dispenseQuantity
          ? { value: dispenseQuantity, unit: doseUnit === 'tablet(s)' || doseUnit === 'capsule(s)' ? doseUnit : 'doses' }
          : undefined,
        numberOfRepeatsAllowed: parseInt(refills, 10) || 0,
        expectedSupplyDuration: dispenseQuantity
          ? {
              value: parseFloat(durationQty),
              unit: DURATION_UNITS.find((u) => u.value === durationUnit)?.label || durationUnit,
            }
          : undefined,
      },
      reasonCode: [{ text: indication.trim() }],
    };

    addDraft(draft);

    // Reset code-related fields; keep dosing/priority for the common
    // "many meds with the same regimen" workflow (e.g. a series of meds
    // all routine, BID, 30 days).
    setSelected(null);
    setSearch('');
    setResults([]);
    setDoseQty('');
    setIndication('');
    setPrn(false);
    setPrnReason('');
  }, [
    canAdd, patientId, selected, doseQty, doseUnit, route, frequency,
    durationQty, durationUnit, prn, prnReason, refills, indication,
    priority, dispenseQuantity, addDraft,
  ]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <Autocomplete
        options={results}
        loading={searching}
        value={selected}
        onChange={(_e, v) => setSelected(v)}
        getOptionLabel={(opt) => opt?.display || ''}
        isOptionEqualToValue={(opt, val) => opt?.code === val?.code}
        filterOptions={(x) => x}
        renderOption={(props, opt) => {
          const { key, ...rest } = props;
          return (
            <li key={key} {...rest}>
              <Stack>
                <Typography variant="body2">{opt.display}</Typography>
                <Typography variant="caption" color="text.secondary">
                  RxNorm · {opt.code}
                </Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search medications (RxNorm)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {searching ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <Grid container spacing={2}>
        <Grid item xs={4}>
          <TextField
            label="Dose"
            value={doseQty}
            onChange={(e) => setDoseQty(e.target.value)}
            placeholder="500"
            fullWidth
          />
        </Grid>
        <Grid item xs={3}>
          <FormControl fullWidth>
            <InputLabel>Unit</InputLabel>
            <Select value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} label="Unit">
              {DOSE_UNITS.map((u) => (
                <MenuItem key={u} value={u}>{u}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={5}>
          <FormControl fullWidth>
            <InputLabel>Route</InputLabel>
            <Select value={route} onChange={(e) => setRoute(e.target.value)} label="Route">
              {ROUTES.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={5}>
          <FormControl fullWidth disabled={prn}>
            <InputLabel>Frequency</InputLabel>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)} label="Frequency">
              {FREQUENCIES.map((f) => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={3}>
          <TextField
            label="Duration"
            value={durationQty}
            onChange={(e) => setDurationQty(e.target.value)}
            placeholder="30"
            fullWidth
            disabled={prn}
          />
        </Grid>
        <Grid item xs={4}>
          <FormControl fullWidth disabled={prn}>
            <InputLabel>Unit</InputLabel>
            <Select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} label="Unit">
              {DURATION_UNITS.map((u) => (
                <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="center">
        <Grid item xs={5}>
          <FormControlLabel
            control={<Switch checked={prn} onChange={(e) => setPrn(e.target.checked)} />}
            label="As needed (PRN)"
          />
        </Grid>
        {prn && (
          <Grid item xs={7}>
            <TextField
              label="PRN reason"
              value={prnReason}
              onChange={(e) => setPrnReason(e.target.value)}
              placeholder="for pain"
              fullWidth
            />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={4}>
          <TextField
            label="Refills"
            value={refills}
            onChange={(e) => setRefills(e.target.value.replace(/[^0-9]/g, ''))}
            fullWidth
          />
        </Grid>
        <Grid item xs={8}>
          <TextField
            label="Dispense quantity (auto)"
            value={dispenseQuantity ?? ''}
            disabled
            helperText={prn ? 'PRN — set manually after sign' : 'Computed from frequency × duration'}
            fullWidth
          />
        </Grid>
      </Grid>

      <TextField
        label="Clinical indication"
        value={indication}
        onChange={(e) => setIndication(e.target.value)}
        placeholder="Why is this being prescribed?"
        multiline
        minRows={2}
        helperText="At least 5 characters."
      />

      <FormControl size="small" sx={{ maxWidth: 200 }}>
        <InputLabel>Priority</InputLabel>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
          {PRIORITIES.map((p) => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Add to draft list
        </Button>
      </Box>
    </Stack>
  );
};

export default MedicationOrderTab;
