/**
 * LabOrderTab — Phase 4.1.C rich lab order entry.
 *
 * Replaces the generic OrderEntryForm-backed lab tab with type-specific
 * fields lifted from the existing LabOrderFields.js:
 * - Specimen type (blood/serum/urine/CSF/...)
 * - Fasting required flag
 * - STAT collection flag
 * - Preferred collection time
 * - Special collection instructions
 *
 * Plus the cross-tab additions:
 * - Clinical indication (required, 5+ chars)
 * - Priority
 * - Diagnosis association (multi-select active Conditions → reasonReference)
 *
 * Each "Add to draft list" produces a `ServiceRequest` with
 * `status='draft'`, `category=laboratory`. The intended specimen rides
 * along on an extension so the order's intent is preserved through Sign
 * All; the actual `Specimen` resource gets created at collection time
 * (Phase 5 MAR work).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import catalogService from '../../../../../services/CatalogIntegrationService';
import { useDraftOrderBundle } from '../DraftOrderBundleProvider';
import DiagnosisPicker, { toReasonReference } from '../DiagnosisPicker';

const SPECIMEN_TYPES = [
  { value: '', label: '(not specified)' },
  { value: 'blood', label: 'Blood', code: '119297000' },
  { value: 'serum', label: 'Serum', code: '119364003' },
  { value: 'plasma', label: 'Plasma', code: '119361006' },
  { value: 'urine', label: 'Urine', code: '122575003' },
  { value: 'stool', label: 'Stool', code: '119339001' },
  { value: 'csf', label: 'Cerebrospinal Fluid (CSF)', code: '258450006' },
  { value: 'sputum', label: 'Sputum', code: '119334006' },
  { value: 'swab', label: 'Swab', code: '257261003' },
  { value: 'tissue', label: 'Tissue', code: '119376003' },
  { value: 'saliva', label: 'Saliva', code: '256897009' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const LAB_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '108252007',
  display: 'Laboratory procedure',
};

const LabOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [specimenType, setSpecimenType] = useState('');
  const [fastingRequired, setFastingRequired] = useState(false);
  const [statCollection, setStatCollection] = useState(false);
  const [collectionTime, setCollectionTime] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('routine');
  const [diagnoses, setDiagnoses] = useState([]);

  const [error, setError] = useState(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const q = search.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const items = await catalogService.getLabTests(q, null, 25);
        setResults(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn('LabOrderTab: catalog search failed', e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const canAdd = useMemo(
    () => Boolean(selected && indication.trim().length >= 5),
    [selected, indication],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a lab test and provide a clinical indication (5+ chars).');
      return;
    }
    setError(null);

    // STAT-collection checkbox bumps priority to 'stat' if not already
    // higher. FHIR doesn't model "STAT collection" as a distinct
    // concept; the closest signal is the priority field. The two
    // controls coexist on the form for students used to legacy
    // LabOrderFields' separate controls.
    const effectivePriority = statCollection && priority === 'routine' ? 'stat' : priority;

    const specimenRow = SPECIMEN_TYPES.find((s) => s.value === specimenType);

    // Fasting + special instructions go into patientInstruction so the
    // order summary downstream renders them as part of the order text.
    const patientInstruction = [
      fastingRequired ? 'Patient must fast for at least 8 hours prior to collection.' : null,
      specialInstructions.trim() || null,
    ].filter(Boolean).join(' ');

    // Intended specimen rides on an extension. A real Specimen
    // resource gets created at collection time (Phase 5 MAR). This
    // preserves the order's intent across the Sign All path.
    const extensions = specimenRow && specimenRow.value
      ? [
          {
            url: 'http://wintehr.local/fhir/StructureDefinition/intended-specimen',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: specimenRow.code,
                  display: specimenRow.label,
                },
              ],
              text: specimenRow.label,
            },
          },
        ]
      : [];

    const draft = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority: effectivePriority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [LAB_CATEGORY_CODING] }],
      code: {
        coding: [
          {
            system: selected.system || 'http://loinc.org',
            code: selected.code,
            display: selected.display,
          },
        ],
        text: selected.display,
      },
      reasonCode: [{ text: indication.trim() }],
      ...(toReasonReference(diagnoses) ? { reasonReference: toReasonReference(diagnoses) } : {}),
      ...(extensions.length ? { extension: extensions } : {}),
      ...(patientInstruction ? { patientInstruction } : {}),
      ...(collectionTime ? { occurrenceDateTime: new Date(collectionTime).toISOString() } : {}),
    };

    addDraft(draft);

    // Keep priority + diagnoses for the common "batch from same
    // encounter" pattern; reset everything else.
    setSelected(null);
    setSearch('');
    setResults([]);
    setIndication('');
    setSpecimenType('');
    setFastingRequired(false);
    setStatCollection(false);
    setCollectionTime('');
    setSpecialInstructions('');
  }, [
    canAdd, patientId, selected, specimenType, fastingRequired, statCollection,
    collectionTime, specialInstructions, indication, priority, diagnoses, addDraft,
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
                  LOINC · {opt.code}
                </Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search lab tests (LOINC)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
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

      <Typography variant="overline" color="text.secondary">Specimen</Typography>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Specimen type</InputLabel>
            <Select value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} label="Specimen type">
              {SPECIMEN_TYPES.map((s) => (
                <MenuItem key={s.value || 'none'} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Preferred collection time"
            type="datetime-local"
            value={collectionTime}
            onChange={(e) => setCollectionTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
            helperText="Leave blank for routine"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControlLabel
            control={<Checkbox checked={fastingRequired} onChange={(e) => setFastingRequired(e.target.checked)} />}
            label="Fasting required"
          />
        </Grid>
        <Grid item xs={6}>
          <FormControlLabel
            control={<Checkbox checked={statCollection} onChange={(e) => setStatCollection(e.target.checked)} />}
            label="STAT collection"
          />
        </Grid>
      </Grid>

      <TextField
        label="Special collection instructions"
        value={specialInstructions}
        onChange={(e) => setSpecialInstructions(e.target.value)}
        placeholder="e.g., Collect on ice, avoid hemolysis"
        multiline
        rows={2}
        size="small"
      />

      <Typography variant="overline" color="text.secondary">Clinical context</Typography>

      <TextField
        label="Clinical indication"
        value={indication}
        onChange={(e) => setIndication(e.target.value)}
        placeholder="Why is this test being ordered?"
        multiline
        minRows={2}
        helperText="At least 5 characters."
      />

      <DiagnosisPicker value={diagnoses} onChange={setDiagnoses} />

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

export default LabOrderTab;
