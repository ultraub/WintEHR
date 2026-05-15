/**
 * NursingOrderTab — composes nursing care orders (#116, Phase 4.3).
 *
 * Nursing orders are the things "the nurse will be told to do":
 * vital-sign frequency, fall precautions, I/O monitoring, line care,
 * positioning, dressing changes, etc. They look different from coded
 * orders because the unit of work is usually a recurring instruction
 * rather than a one-shot lab/imaging/procedure event.
 *
 * Produces a ServiceRequest with:
 * - `category` = SNOMED 103735009 (Nursing diagnostic procedure) — the
 *   closest single SNOMED concept that maps cleanly to "things the
 *   nurse does on a schedule". A few clinical CDS pipelines also
 *   accept HL7 ActCode "NURSE" for this category; we stick with SNOMED
 *   to match the rest of the composer's pattern.
 * - `code.text` carrying the human-readable instruction. The catalog
 *   for nursing orders is largely free-text + a small palette of
 *   common templates, not a comprehensive SNOMED ValueSet.
 * - `occurrenceTiming.repeat.frequency` if a frequency was picked.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import { useDraftOrderBundle } from '../DraftOrderBundleProvider';
import DiagnosisPicker, { toReasonReference } from '../DiagnosisPicker';

// Small, opinionated palette of common nursing instructions. Not a
// formal SNOMED ValueSet — we're optimizing for the "I want to add a
// realistic nursing order in 5 seconds" path, not a comprehensive
// catalog browse. Free-text remains available alongside the palette.
const NURSING_TEMPLATES = [
  { label: 'Vital signs', detail: 'BP, HR, RR, SpO2, temp' },
  { label: 'Strict intake and output', detail: 'Track every PO/IV/UO event' },
  { label: 'Fall precautions', detail: 'Bed in low position, side rails up, call bell within reach' },
  { label: 'Seizure precautions', detail: 'Padded side rails, suction at bedside' },
  { label: 'Aspiration precautions', detail: 'HOB elevated >=30°, oral care q4h' },
  { label: 'Foley catheter care', detail: 'Daily peri-care, document output q shift' },
  { label: 'Daily weights', detail: 'Weigh same time, same scale, same garments' },
  { label: 'Telemetry monitoring', detail: 'Continuous ECG, document rhythm q shift' },
  { label: 'Glucose checks (AC + HS)', detail: 'Fingerstick before meals and at bedtime' },
  { label: 'Wound dressing change', detail: 'Daily, document appearance + drainage' },
  { label: 'Patient education', detail: 'Disease-specific teaching, document understanding' },
];

const FREQUENCIES = [
  { value: '', label: 'No fixed schedule' },
  { value: 'q15min', label: 'Every 15 minutes', period: 15, periodUnit: 'min' },
  { value: 'q30min', label: 'Every 30 minutes', period: 30, periodUnit: 'min' },
  { value: 'q1h', label: 'Every 1 hour', period: 1, periodUnit: 'h' },
  { value: 'q2h', label: 'Every 2 hours', period: 2, periodUnit: 'h' },
  { value: 'q4h', label: 'Every 4 hours', period: 4, periodUnit: 'h' },
  { value: 'q8h', label: 'Every 8 hours', period: 8, periodUnit: 'h' },
  { value: 'q shift', label: 'Once per shift', period: 8, periodUnit: 'h' },
  { value: 'qd', label: 'Once daily', period: 1, periodUnit: 'd' },
  { value: 'continuous', label: 'Continuous' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const NURSING_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '103735009',
  display: 'Nursing diagnostic procedure',
};

const NursingOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [template, setTemplate] = useState(null);
  const [customText, setCustomText] = useState('');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [priority, setPriority] = useState('routine');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState(null);

  // Display = template label OR custom free-text. If both are set, the
  // template wins (it's the more explicit signal — student picked it
  // intentionally). The custom text falls through into instructions.
  const orderText = template?.label || customText.trim();

  const canAdd = useMemo(() => orderText.length >= 3, [orderText]);

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a template or write a nursing instruction (3+ chars).');
      return;
    }
    setError(null);

    const freqRow = FREQUENCIES.find((f) => f.value === frequency);
    const occurrenceTiming = freqRow && freqRow.period
      ? {
          repeat: {
            frequency: 1,
            period: freqRow.period,
            periodUnit: freqRow.periodUnit,
          },
        }
      : undefined;

    // Combined patient/practitioner instruction body. Template detail +
    // user-supplied notes are stitched together so the nurse sees the
    // full picture without flipping between fields.
    const detail = [
      template?.detail || null,
      instructions.trim() || null,
      freqRow && !freqRow.period ? freqRow.label : null,
    ].filter(Boolean).join(' · ');

    const draft = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [NURSING_CATEGORY_CODING] }],
      code: { text: orderText },
      ...(detail ? { patientInstruction: detail } : {}),
      ...(occurrenceTiming ? { occurrenceTiming } : {}),
      ...(toReasonReference(diagnoses) ? { reasonReference: toReasonReference(diagnoses) } : {}),
    };

    addDraft(draft);

    setTemplate(null);
    setCustomText('');
    setFrequency('');
    setInstructions('');
  }, [canAdd, patientId, template, orderText, frequency, instructions, priority, diagnoses, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <Autocomplete
        options={NURSING_TEMPLATES}
        value={template}
        onChange={(_e, v) => setTemplate(v)}
        getOptionLabel={(o) => o?.label || ''}
        isOptionEqualToValue={(a, b) => a?.label === b?.label}
        renderOption={(props, opt) => {
          const { key, ...rest } = props;
          return (
            <li key={key} {...rest}>
              <Stack>
                <Typography variant="body2">{opt.label}</Typography>
                <Typography variant="caption" color="text.secondary">{opt.detail}</Typography>
              </Stack>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField {...params} label="Common nursing orders" placeholder="e.g., Vital signs, Fall precautions" />
        )}
      />

      <Typography variant="overline" color="text.secondary">Or write a custom instruction</Typography>

      <TextField
        label="Custom nursing instruction"
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        placeholder="e.g., Elevate left arm on two pillows continuously"
        disabled={Boolean(template)}
        size="small"
        helperText={template ? 'Template selected — clear to enter custom text' : ' '}
      />

      <Typography variant="overline" color="text.secondary">Schedule &amp; clinical context</Typography>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Frequency</InputLabel>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)} label="Frequency">
              {FREQUENCIES.map((f) => (
                <MenuItem key={f.value || 'none'} value={f.value}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TextField
        label="Additional notes"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Anything the nurse needs to know that isn't in the template"
        multiline
        rows={2}
        size="small"
      />

      <DiagnosisPicker value={diagnoses} onChange={setDiagnoses} />

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

export default NursingOrderTab;
