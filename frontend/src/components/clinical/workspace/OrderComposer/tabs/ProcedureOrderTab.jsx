/**
 * ProcedureOrderTab — Phase 4.1.C rich procedure order entry.
 *
 * Replaces the OrderEntryForm shim with type-specific fields:
 * - Body site (with laterality)
 * - Pre-procedure orders (free text, e.g. "NPO after midnight, hold
 *   anticoagulation")
 * - Anesthesia requirement (none / local / sedation / general / regional)
 * - Preferred scheduling
 * - Clinical history / context blurb for the proceduralist
 *
 * Cross-tab additions:
 * - Clinical indication (required, 5+ chars)
 * - Priority
 * - Diagnosis association → reasonReference
 *
 * Produces a `ServiceRequest` with `status='draft'`,
 * `category=procedure`. Anesthesia + pre-procedure orders sit on
 * extensions because FHIR ServiceRequest doesn't model them as first-
 * class slots. The actual `Procedure` (with performed-at, performer,
 * complications) is created during Phase 5 MAR work when the procedure
 * is performed.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
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

const BODY_SITES = [
  { value: '', label: '(not specified)', code: null },
  { value: 'head', label: 'Head', code: '69536005' },
  { value: 'neck', label: 'Neck', code: '45048000' },
  { value: 'chest', label: 'Chest', code: '51185008' },
  { value: 'abdomen', label: 'Abdomen', code: '113345001' },
  { value: 'pelvis', label: 'Pelvis', code: '12921003' },
  { value: 'back', label: 'Back', code: '123961009' },
  { value: 'shoulder', label: 'Shoulder', code: '16982005' },
  { value: 'arm', label: 'Arm', code: '53120007' },
  { value: 'hand', label: 'Hand', code: '85562004' },
  { value: 'hip', label: 'Hip', code: '29836001' },
  { value: 'leg', label: 'Leg', code: '61685007' },
  { value: 'foot', label: 'Foot', code: '56459004' },
];

const LATERALITY = [
  { value: 'na', label: 'N/A (Midline)' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Bilateral' },
];

const ANESTHESIA_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'local', label: 'Local anesthesia' },
  { value: 'sedation', label: 'Moderate sedation' },
  { value: 'regional', label: 'Regional anesthesia' },
  { value: 'general', label: 'General anesthesia' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const PROCEDURE_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '387713003',
  display: 'Surgical procedure',
};

const EXT_BASE = 'http://wintehr.local/fhir/StructureDefinition';

const ProcedureOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [bodySite, setBodySite] = useState('');
  const [laterality, setLaterality] = useState('na');
  const [anesthesia, setAnesthesia] = useState('none');
  const [preProcedureOrders, setPreProcedureOrders] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');

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
        const items = await catalogService.getProcedures(q, null, 25);
        setResults(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn('ProcedureOrderTab: catalog search failed', e);
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
      setError('Pick a procedure and provide a clinical indication (5+ chars).');
      return;
    }
    setError(null);

    const bodySiteRow = BODY_SITES.find((s) => s.value === bodySite);
    const bodySiteCC = bodySiteRow && bodySiteRow.code
      ? [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: bodySiteRow.code,
            display: bodySiteRow.label,
          }],
          text: laterality !== 'na' ? `${bodySiteRow.label} (${laterality})` : bodySiteRow.label,
        }]
      : undefined;

    const extensions = [];
    if (anesthesia && anesthesia !== 'none') {
      extensions.push({
        url: `${EXT_BASE}/anesthesia`,
        valueCode: anesthesia,
      });
    }
    if (preProcedureOrders.trim()) {
      extensions.push({
        url: `${EXT_BASE}/pre-procedure-orders`,
        valueString: preProcedureOrders.trim(),
      });
    }
    if (clinicalHistory.trim()) {
      extensions.push({
        url: `${EXT_BASE}/clinical-history`,
        valueString: clinicalHistory.trim(),
      });
    }

    const draft = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [PROCEDURE_CATEGORY_CODING] }],
      code: {
        coding: [
          {
            system: selected.system || 'http://snomed.info/sct',
            code: selected.code,
            display: selected.display,
          },
        ],
        text: selected.display,
      },
      reasonCode: [{ text: indication.trim() }],
      ...(toReasonReference(diagnoses) ? { reasonReference: toReasonReference(diagnoses) } : {}),
      ...(bodySiteCC ? { bodySite: bodySiteCC } : {}),
      ...(extensions.length ? { extension: extensions } : {}),
      ...(scheduledDateTime
        ? { occurrenceDateTime: new Date(scheduledDateTime).toISOString() }
        : {}),
    };

    addDraft(draft);

    setSelected(null);
    setSearch('');
    setResults([]);
    setIndication('');
    setBodySite('');
    setLaterality('na');
    setAnesthesia('none');
    setPreProcedureOrders('');
    setScheduledDateTime('');
    setClinicalHistory('');
  }, [
    canAdd, patientId, selected, bodySite, laterality, anesthesia,
    preProcedureOrders, scheduledDateTime, clinicalHistory, indication,
    priority, diagnoses, addDraft,
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
                  {opt.system?.includes('snomed') ? 'SNOMED' : opt.system?.split('/').pop()} · {opt.code}
                </Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search procedures"
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

      <Typography variant="overline" color="text.secondary">Procedure details</Typography>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Body site</InputLabel>
            <Select value={bodySite} onChange={(e) => setBodySite(e.target.value)} label="Body site">
              {BODY_SITES.map((s) => (
                <MenuItem key={s.value || 'none'} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Laterality</InputLabel>
            <Select value={laterality} onChange={(e) => setLaterality(e.target.value)} label="Laterality">
              {LATERALITY.map((l) => (
                <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <FormControl fullWidth size="small">
        <InputLabel>Anesthesia</InputLabel>
        <Select value={anesthesia} onChange={(e) => setAnesthesia(e.target.value)} label="Anesthesia">
          {ANESTHESIA_OPTIONS.map((a) => (
            <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Pre-procedure orders"
        value={preProcedureOrders}
        onChange={(e) => setPreProcedureOrders(e.target.value)}
        placeholder="e.g., NPO after midnight, hold anticoagulation x 5 days, antibiotic prophylaxis 1h pre-op"
        multiline
        rows={2}
        size="small"
      />

      <TextField
        label="Preferred scheduling"
        type="datetime-local"
        value={scheduledDateTime}
        onChange={(e) => setScheduledDateTime(e.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
        helperText="Leave blank for routine scheduling"
      />

      <Typography variant="overline" color="text.secondary">Clinical context</Typography>

      <TextField
        label="Clinical indication"
        value={indication}
        onChange={(e) => setIndication(e.target.value)}
        placeholder="Why is this procedure being ordered?"
        multiline
        minRows={2}
        helperText="At least 5 characters."
      />

      <TextField
        label="Clinical history for proceduralist"
        value={clinicalHistory}
        onChange={(e) => setClinicalHistory(e.target.value)}
        placeholder="Brief relevant clinical history (prior procedures, current symptoms, exam findings)"
        multiline
        rows={2}
        size="small"
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

export default ProcedureOrderTab;
