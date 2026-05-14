/**
 * CodeStatusOrderTab — composes code-status / advance-care orders
 * (#116, Phase 4.3).
 *
 * Code status is a single-select clinical declaration ("if your heart
 * stops, do we attempt resuscitation?") with high downstream impact:
 * MAR alerts, rapid-response protocols, ICU admission decisions all
 * key off it. The FHIR-correct path is a Consent resource with a
 * directive — but for educational use we model this as a
 * ServiceRequest with a constrained SNOMED code, consistent with the
 * rest of the composer. Students who want to learn the Consent path
 * find it in the advance-directives module of the chart.
 *
 * Single-status semantics: only one code-status can be active at a
 * time. The composer doesn't enforce this — adding a draft just
 * stages a new declaration; the clinician's expectation is that
 * signing it supersedes any prior. (A future MAR/registry pass would
 * auto-revoke the prior code-status order; out of scope here.)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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

const CODE_STATUSES = [
  {
    value: 'full',
    label: 'Full Code (attempt resuscitation)',
    code: '304251008',
    description: 'Full resuscitation including CPR, intubation, and ACLS protocols.',
  },
  {
    value: 'dnr',
    label: 'DNR — Do Not Resuscitate',
    code: '304253006',
    description: 'No CPR. Other supportive care (intubation, pressors) continues unless otherwise specified.',
  },
  {
    value: 'dni',
    label: 'DNI — Do Not Intubate',
    code: '304252001',
    description: 'No invasive airway. Other supportive care continues. May coexist with DNR.',
  },
  {
    value: 'dnar',
    label: 'DNAR — Do Not Attempt Resuscitation',
    code: '304253006',
    description: 'Equivalent to DNR; some institutions prefer this wording.',
  },
  {
    value: 'comfort',
    label: 'Comfort Care Only',
    code: '133918004',
    description: 'Goal is comfort, not cure. No CPR, no intubation, no aggressive interventions.',
  },
];

const DISCUSSED_WITH = [
  { value: 'patient', label: 'Patient (capacitated)' },
  { value: 'family', label: 'Family' },
  { value: 'surrogate', label: 'Designated surrogate / healthcare proxy' },
  { value: 'documented_prior', label: 'Per prior advance directive on file' },
  { value: 'pending', label: 'Pending discussion — provisional' },
];

const ADVANCE_CARE_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '385686007',
  display: 'Advance care planning',
};

const CodeStatusOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [status, setStatus] = useState('');
  const [effectiveDateTime, setEffectiveDateTime] = useState('');
  const [discussedWith, setDiscussedWith] = useState('patient');
  const [notes, setNotes] = useState('');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState(null);

  const statusRow = CODE_STATUSES.find((s) => s.value === status);
  const canAdd = useMemo(() => Boolean(statusRow), [statusRow]);

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError('Pick a code-status declaration.');
      return;
    }
    setError(null);

    const noteParts = [
      `Discussed with: ${DISCUSSED_WITH.find((d) => d.value === discussedWith)?.label || discussedWith}`,
      notes.trim() ? `Note: ${notes.trim()}` : null,
    ].filter(Boolean);

    const draft = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      // High-importance order — priority is always at least 'urgent'
      // because a code-status change affects every responder. Students
      // can still override but the default reflects clinical reality.
      intent: 'order',
      priority: 'urgent',
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [ADVANCE_CARE_CATEGORY_CODING] }],
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: statusRow.code,
          display: statusRow.label,
        }],
        text: statusRow.label,
      },
      ...(effectiveDateTime ? {
        occurrenceDateTime: new Date(effectiveDateTime).toISOString(),
      } : {}),
      note: noteParts.map((text) => ({ text })),
      ...(toReasonReference(diagnoses) ? { reasonReference: toReasonReference(diagnoses) } : {}),
    };

    addDraft(draft);

    // Don't reset status — students often want to glance at the same
    // declaration during the composing flow. Clearing risks the
    // double-add pattern. Notes/effectiveDateTime do reset.
    setEffectiveDateTime('');
    setNotes('');
  }, [canAdd, patientId, statusRow, effectiveDateTime, discussedWith, notes, diagnoses, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <Alert severity="warning" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.85rem' } }}>
        Code-status orders supersede prior declarations on signing. Confirm
        the patient/family discussion is documented before signing.
      </Alert>

      <FormControl size="small" fullWidth>
        <InputLabel>Code status declaration</InputLabel>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Code status declaration">
          {CODE_STATUSES.map((s) => (
            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {statusRow && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 1 }}>
          {statusRow.description}
        </Typography>
      )}

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField
            label="Effective date/time"
            type="datetime-local"
            value={effectiveDateTime}
            onChange={(e) => setEffectiveDateTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
            helperText="Blank = effective on signing"
          />
        </Grid>
        <Grid item xs={6}>
          <FormControl size="small" fullWidth>
            <InputLabel>Discussed with</InputLabel>
            <Select value={discussedWith} onChange={(e) => setDiscussedWith(e.target.value)} label="Discussed with">
              {DISCUSSED_WITH.map((d) => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TextField
        label="Discussion notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Brief summary of the goals-of-care discussion, surrogate present, etc."
        multiline
        rows={3}
        size="small"
      />

      <Typography variant="overline" color="text.secondary">Clinical context (optional)</Typography>

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

export default CodeStatusOrderTab;
