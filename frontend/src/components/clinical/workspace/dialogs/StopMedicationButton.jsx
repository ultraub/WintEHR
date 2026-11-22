/**
 * StopMedicationButton.
 *
 * Stock WintEHR has no way to discontinue a medication from the chart: the Chart Review pencil re-prescribes (it opens
 * "Prescribe Medication" with the dose blank and saves a fresh active order). This adds a "Stop medication" button on an active
 * medication row: a reason, then the MedicationRequest is updated in place to status "stopped", with the reason as
 * statusReason and as a dated note.
 */
import React, { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import { StopCircleOutlined as StopIcon } from '@mui/icons-material';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { useAuth } from '../../../../contexts/AuthContext';

const StopMedicationButton = ({ medication }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const name = medication?.medicationCodeableConcept?.text || medication?.medicationCodeableConcept?.coding?.[0]?.display || 'this medication';

  const save = async () => {
    if (reason.trim().length < 3) { setError('Give a reason (3+ characters).'); return; }
    setSaving(true); setError(null);
    try {
      const userRef = `Practitioner/${user?.id || user?.username || 'unknown'}`;
      const updated = {
        ...medication,
        status: 'stopped',
        statusReason: { text: reason.trim() },
        note: [...(medication.note || []), { text: `Stopped: ${reason.trim()}`, time: new Date().toISOString(), authorReference: { reference: userRef, ...(user?.name ? { display: user.name } : {}) } }],
      };
      await fhirClient.update('MedicationRequest', medication.id, updated);
      const pid = (medication.subject?.reference || '').split('/').pop();
      if (pid) window.dispatchEvent(new CustomEvent('fhir-resources-updated', { detail: { patientId: pid } }));
      setOpen(false); setReason('');
    } catch (e) {
      setError(e?.message || 'Could not stop the medication.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tooltip title="Stop medication">
        <IconButton size="small" aria-label={`Stop medication ${name}`} onClick={() => setOpen(true)}>
          <StopIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={saving ? undefined : () => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Stop medication</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{name}</Typography>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Reason for stopping" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2}
            helperText="Saved as the status reason and a dated note on the order." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving} aria-label="Confirm stop medication">Stop medication</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StopMedicationButton;
