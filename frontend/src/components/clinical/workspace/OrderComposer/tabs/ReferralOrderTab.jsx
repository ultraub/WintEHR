/**
 * ReferralOrderTab — composes referral/consult orders (#116, Phase 4.3).
 *
 * Real-world referrals always carry: (1) the receiving specialty, (2)
 * a clinical question for the consultant, and (3) the diagnosis
 * driving the consult. Payers require all three; the consultant needs
 * the question to know what answer to send back.
 *
 * Diagnosis association is REQUIRED on this tab — it's the one place
 * in the composer where "no diagnosis" is almost never clinically
 * valid AND directly blocks downstream claim filing. The rest of the
 * composer keeps diagnosis optional for student-flow friction
 * reasons; here we make it a hard gate.
 *
 * Produces a ServiceRequest with `category` = SNOMED 3457005
 * "Patient referral" and `intent` = "order".
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

// Outpatient specialty picklist. Codes are SNOMED specialty concepts
// (qualifier value: "<specialty name>"). The list is small on purpose
// — students who need a longer roster build one via the catalog.
const SPECIALTIES = [
  { value: 'cardiology', label: 'Cardiology', code: '394579002' },
  { value: 'dermatology', label: 'Dermatology', code: '394582007' },
  { value: 'endocrinology', label: 'Endocrinology', code: '394583002' },
  { value: 'gastroenterology', label: 'Gastroenterology', code: '394584008' },
  { value: 'hematology', label: 'Hematology', code: '394803006' },
  { value: 'infectious_disease', label: 'Infectious Disease', code: '394807007' },
  { value: 'nephrology', label: 'Nephrology', code: '394589003' },
  { value: 'neurology', label: 'Neurology', code: '394591006' },
  { value: 'oncology', label: 'Oncology (Medical)', code: '394593009' },
  { value: 'ophthalmology', label: 'Ophthalmology', code: '394594003' },
  { value: 'orthopedics', label: 'Orthopedics', code: '394801008' },
  { value: 'pulmonology', label: 'Pulmonology', code: '418112009' },
  { value: 'psychiatry', label: 'Psychiatry', code: '394587001' },
  { value: 'rheumatology', label: 'Rheumatology', code: '394810000' },
  { value: 'surgery_general', label: 'Surgery — General', code: '394609007' },
  { value: 'urology', label: 'Urology', code: '394612003' },
  { value: 'pt_ot', label: 'Physical / Occupational Therapy', code: '722414000' },
  { value: 'social_work', label: 'Social Work', code: '224608005' },
  { value: 'nutrition', label: 'Nutrition / Dietitian', code: '224608005' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

const REFERRAL_CATEGORY_CODING = {
  system: 'http://snomed.info/sct',
  code: '3457005',
  display: 'Patient referral',
};

const ReferralOrderTab = () => {
  const { patientId, addDraft } = useDraftOrderBundle();

  const [specialty, setSpecialty] = useState('');
  const [reason, setReason] = useState('');
  const [providerName, setProviderName] = useState('');
  const [priority, setPriority] = useState('routine');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState(null);

  const specialtyRow = SPECIALTIES.find((s) => s.value === specialty);
  const reasonRefs = toReasonReference(diagnoses);

  const canAdd = useMemo(
    () => Boolean(specialtyRow && reason.trim().length >= 5 && reasonRefs),
    [specialtyRow, reason, reasonRefs],
  );

  // Spell out the gate so the disabled button isn't a mystery.
  const helperText = useMemo(() => {
    if (!specialtyRow) return 'Pick a specialty.';
    if (reason.trim().length < 5) return 'Reason for consult must be at least 5 characters.';
    if (!reasonRefs) return 'Link at least one diagnosis — payers require it on referrals.';
    return null;
  }, [specialtyRow, reason, reasonRefs]);

  const handleAdd = useCallback(() => {
    if (!canAdd) {
      setError(helperText || 'Fill out specialty, reason, and diagnosis.');
      return;
    }
    setError(null);

    const draft = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      priority,
      subject: { reference: `Patient/${patientId}` },
      authoredOn: new Date().toISOString(),
      category: [{ coding: [REFERRAL_CATEGORY_CODING] }],
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: specialtyRow.code,
          display: specialtyRow.label,
        }],
        text: `Referral to ${specialtyRow.label}`,
      },
      reasonCode: [{ text: reason.trim() }],
      reasonReference: reasonRefs,
      ...(providerName.trim() ? {
        // No actual Practitioner FHIR id — student typed a name. Carry
        // it on an extension so downstream surfaces can show
        // "requested: Dr. So-and-so" without inventing a fake ref.
        extension: [{
          url: 'http://wintehr.local/fhir/StructureDefinition/requested-performer-name',
          valueString: providerName.trim(),
        }],
      } : {}),
    };

    addDraft(draft);

    setSpecialty('');
    setReason('');
    setProviderName('');
    // Keep diagnoses + priority — common to refer to multiple
    // specialties for the same problem.
  }, [canAdd, helperText, patientId, specialtyRow, reason, providerName, priority, reasonRefs, addDraft]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <FormControl size="small" fullWidth>
        <InputLabel>Specialty</InputLabel>
        <Select value={specialty} onChange={(e) => setSpecialty(e.target.value)} label="Specialty">
          {SPECIALTIES.map((s) => (
            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Reason for consult"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What clinical question are you asking the specialist?"
        multiline
        rows={3}
        helperText="At least 5 characters."
      />

      <Grid container spacing={2}>
        <Grid item xs={8}>
          <TextField
            label="Specific provider (optional)"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g., Dr. Aisha Khan"
            size="small"
            fullWidth
          />
        </Grid>
        <Grid item xs={4}>
          <FormControl size="small" fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Typography variant="overline" color="text.secondary">Required: diagnosis</Typography>

      <DiagnosisPicker value={diagnoses} onChange={setDiagnoses} />

      {helperText && (
        <Typography variant="caption" color="text.secondary">{helperText}</Typography>
      )}

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

export default ReferralOrderTab;
