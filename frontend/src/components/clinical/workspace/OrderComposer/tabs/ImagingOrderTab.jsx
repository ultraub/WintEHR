/**
 * ImagingOrderTab — Phase 4.1.C rich imaging order entry.
 *
 * Replaces the OrderEntryForm shim with type-specific fields lifted
 * from ImagingOrderFields.js:
 * - Modality (XR/CT/MRI/US/...)
 * - Body site + laterality
 * - Contrast required + notes
 * - Transport mode (ambulatory/wheelchair/stretcher/portable bed)
 * - Isolation precautions flag
 * - Preferred scheduling time
 * - Clinical history blurb for the radiologist (separate from the
 *   `reasonCode` indication — radiologists read this when prepping the
 *   read)
 *
 * Cross-tab additions:
 * - Clinical indication (required, 5+ chars)
 * - Priority
 * - Diagnosis association → reasonReference
 *
 * Produces a `ServiceRequest` with `status='draft'`,
 * `category=imaging`. Body site + laterality go on the standard
 * `bodySite` element; transport/isolation/scheduling sit on extensions
 * so the order's intent survives Sign All without inventing new fields
 * on the standard ServiceRequest schema.
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

const MODALITIES = [
  { value: '', label: '(not specified)' },
  { value: 'XR', label: 'X-Ray (XR)' },
  { value: 'CT', label: 'CT Scan' },
  { value: 'MRI', label: 'MRI' },
  { value: 'US', label: 'Ultrasound (US)' },
  { value: 'NM', label: 'Nuclear Medicine (NM)' },
  { value: 'PET', label: 'PET Scan' },
  { value: 'MG', label: 'Mammography (MG)' },
  { value: 'FL', label: 'Fluoroscopy (FL)' },
  { value: 'DX', label: 'Digital Radiography (DX)' },
  { value: 'CR', label: 'Computed Radiography (CR)' },
];

const BODY_SITES = [
  { value: '', label: '(not specified)', code: null },
  { value: 'head', label: 'Head', code: '69536005' },
  { value: 'neck', label: 'Neck', code: '45048000' },
  { value: 'chest', label: 'Chest', code: '51185008' },
  { value: 'abdomen', label: 'Abdomen', code: '113345001' },
  { value: 'pelvis', label: 'Pelvis', code: '12921003' },
  { value: 'spine_cervical', label: 'Spine — Cervical', code: '122494005' },
  { value: 'spine_thoracic', label: 'Spine — Thoracic', code: '122495006' },
  { value: 'spine_lumbar', label: 'Spine — Lumbar', code: '122496007' },
  { value: 'shoulder', label: 'Shoulder', code: '16982005' },
  { value: 'elbow', label: 'Elbow', code: '76248009' },
  { value: 'wrist', label: 'Wrist', code: '8205005' },
  { value: 'hand', label: 'Hand', code: '85562004' },
  { value: 'hip', label: 'Hip', code: '29836001' },
  { value: 'knee', label: 'Knee', code: '72696002' },
  { value: 'ankle', label: 'Ankle', code: '344001' },
  { value: 'foot', label: 'Foot', code: '56459004' },
  { value: 'extremity_upper', label: 'Upper Extremity', code: '53120007' },
  { value: 'extremity_lower', label: 'Lower Extremity', code: '61685007' },
];

const LATERALITY = [
  { value: 'na', label: 'N/A (Midline)' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Bilateral' },
];

const TRANSPORT_MODES = [
  { value: 'ambulatory', label: 'Ambulatory (Walking)' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'stretcher', label: 'Stretcher' },
  { value: 'bed', label: 'In Bed (Portable)' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const IMAGING_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '363679005',
  display: 'Imaging',
};

const EXT_BASE = 'http://wintehr.local/fhir/StructureDefinition';

const ImagingOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [modality, setModality] = useState('');
  const [bodySite, setBodySite] = useState('');
  const [laterality, setLaterality] = useState('na');
  const [contrastRequired, setContrastRequired] = useState(false);
  const [contrastNotes, setContrastNotes] = useState('');
  const [transportMode, setTransportMode] = useState('ambulatory');
  const [isolationRequired, setIsolationRequired] = useState(false);
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
        const items = await catalogService.getImagingStudies(q, null, 25);
        setResults(Array.isArray(items) ? items : []);
      } catch (e) {
        console.warn('ImagingOrderTab: catalog search failed', e);
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
      setError('Pick an imaging study and provide a clinical indication (5+ chars).');
      return;
    }
    setError(null);

    const bodySiteRow = BODY_SITES.find((s) => s.value === bodySite);

    // Body site uses the standard FHIR `bodySite` element with the
    // laterality code as a qualifier. Off-the-shelf radiology systems
    // can read this without understanding our laterality enum.
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

    // Modality/transport/isolation/contrast/clinical-history all ride
    // on extensions. Modality is sometimes encoded on the order's
    // `code` slot — we keep it separate so a single procedure code
    // (e.g. "CT chest with contrast") can still be selected from the
    // catalog without forcing the user to also type "CT".
    const extensions = [];
    if (modality) {
      extensions.push({
        url: `${EXT_BASE}/imaging-modality`,
        valueCode: modality,
      });
    }
    if (contrastRequired) {
      extensions.push({
        url: `${EXT_BASE}/contrast-required`,
        valueBoolean: true,
      });
      if (contrastNotes.trim()) {
        extensions.push({
          url: `${EXT_BASE}/contrast-notes`,
          valueString: contrastNotes.trim(),
        });
      }
    }
    extensions.push({
      url: `${EXT_BASE}/transport-mode`,
      valueCode: transportMode,
    });
    if (isolationRequired) {
      extensions.push({
        url: `${EXT_BASE}/isolation-required`,
        valueBoolean: true,
      });
    }
    if (clinicalHistory.trim()) {
      // Clinical history is for the radiologist, NOT the patient
      // (which is what `patientInstruction` is for). FHIR doesn't have
      // a first-class slot for this so it sits on an extension.
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
      category: [{ coding: [IMAGING_CATEGORY_CODING] }],
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
      ...(bodySiteCC ? { bodySite: bodySiteCC } : {}),
      ...(extensions.length ? { extension: extensions } : {}),
      ...(scheduledDateTime
        ? { occurrenceDateTime: new Date(scheduledDateTime).toISOString() }
        : {}),
    };

    addDraft(draft);

    // Reset code-specific fields; keep priority + diagnoses for
    // batch-from-same-encounter pattern.
    setSelected(null);
    setSearch('');
    setResults([]);
    setIndication('');
    setModality('');
    setBodySite('');
    setLaterality('na');
    setContrastRequired(false);
    setContrastNotes('');
    setIsolationRequired(false);
    setScheduledDateTime('');
    setClinicalHistory('');
  }, [
    canAdd, patientId, selected, modality, bodySite, laterality, contrastRequired,
    contrastNotes, transportMode, isolationRequired, scheduledDateTime, clinicalHistory,
    indication, priority, diagnoses, addDraft,
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
                  {opt.system?.includes('snomed') ? 'SNOMED' : 'LOINC'} · {opt.code}
                </Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search imaging studies"
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

      <Typography variant="overline" color="text.secondary">Imaging details</Typography>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Modality</InputLabel>
            <Select value={modality} onChange={(e) => setModality(e.target.value)} label="Modality">
              {MODALITIES.map((m) => (
                <MenuItem key={m.value || 'none'} value={m.value}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
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
      </Grid>

      <Grid container spacing={2}>
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
        <Grid item xs={6}>
          <FormControlLabel
            control={<Checkbox checked={contrastRequired} onChange={(e) => setContrastRequired(e.target.checked)} />}
            label="Contrast required"
          />
        </Grid>
      </Grid>

      {contrastRequired && (
        <TextField
          label="Contrast type / notes"
          value={contrastNotes}
          onChange={(e) => setContrastNotes(e.target.value)}
          placeholder="e.g., IV contrast, oral contrast, with and without"
          size="small"
        />
      )}

      <Typography variant="overline" color="text.secondary">Transport &amp; scheduling</Typography>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Transport mode</InputLabel>
            <Select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} label="Transport mode">
              {TRANSPORT_MODES.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControlLabel
            control={<Checkbox checked={isolationRequired} onChange={(e) => setIsolationRequired(e.target.checked)} />}
            label="Isolation precautions"
          />
        </Grid>
      </Grid>

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
        placeholder="Why is this study being ordered?"
        multiline
        minRows={2}
        helperText="At least 5 characters."
      />

      <TextField
        label="Clinical history for radiologist"
        value={clinicalHistory}
        onChange={(e) => setClinicalHistory(e.target.value)}
        placeholder="Brief relevant clinical history (visible to reading radiologist)"
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

export default ImagingOrderTab;
