/**
 * ProcedurePerformanceDialog — record a Procedure against its order (#116 Phase 5.2).
 *
 * Nurse/clinician-side dialog for the MAR Tasks pane: documents that a
 * procedure was performed for a signed procedure ServiceRequest. Posts to
 * `POST /api/clinical/administration/record/procedure`, which creates a
 * `Procedure` with `basedOn` → the order and refuses unsigned (draft) orders.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { buildUrl } from '../../../../../config/apiConfig';
import api from '../../../../../services/api';
import { useClinicalWorkflow } from '../../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../../constants/clinicalEvents';

const STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'not-done', label: 'Not done' },
];

const OUTCOMES = ['Successful', 'Partially successful', 'Unsuccessful'];

const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.task — the procedure task (service_request_id, code_display, ...)
 * @param {string} [props.patientId]
 * @param {() => void} props.onClose
 * @param {() => void} props.onRecorded
 */
const ProcedurePerformanceDialog = ({ open, task, patientId, onClose, onRecorded }) => {
  const { publish } = useClinicalWorkflow();

  const [status, setStatus] = useState('completed');
  const [performed, setPerformed] = useState(() => toLocalInput(new Date()));
  const [performer, setPerformer] = useState('');
  const [outcome, setOutcome] = useState('Successful');
  const [complication, setComplication] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStatus('completed');
    setPerformed(toLocalInput(new Date()));
    setPerformer('');
    setOutcome('Successful');
    setComplication('');
    setStatusReason('');
    setNotes('');
    setError(null);
  }, [open, task]);

  const notDone = status === 'not-done';

  const handleSubmit = async () => {
    if (!task) return;
    if (notDone && !statusReason.trim()) {
      setError('A reason is required when the procedure was not done.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        service_request_id: task.service_request_id,
        status,
        performed_datetime: new Date(performed).toISOString(),
        ...(performer ? { performer_reference: `Practitioner/${performer}` } : {}),
        ...(!notDone && outcome ? { outcome } : {}),
        ...(complication ? { complication } : {}),
        ...(notDone ? { status_reason: statusReason } : {}),
        ...(notes ? { notes } : {}),
      };
      const res = await api
        .post(buildUrl('backend', '/api/clinical/administration/record/procedure'), body)
        .catch((err) => {
          throw new Error(err.response?.data?.detail || err.message);
        });
      const created = res.data ?? {};
      publish?.(CLINICAL_EVENTS.PROCEDURE_PERFORMED, {
        patientId,
        procedureId: created.resource_id,
        serviceRequestId: task.service_request_id,
      });
      onRecorded?.();
      onClose?.();
    } catch (err) {
      console.error('ProcedurePerformanceDialog: submit failed', err);
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record procedure</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {task?.code_display || 'Procedure'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recording performance against the signed procedure order.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <FormControl size="small">
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField
            label="Performed"
            type="datetime-local"
            value={performed}
            onChange={(e) => setPerformed(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Performed by (Practitioner id)"
            value={performer}
            onChange={(e) => setPerformer(e.target.value)}
            size="small"
            placeholder="Optional — defaults to current user"
          />

          {notDone ? (
            <TextField
              label="Reason not done"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              size="small"
              required
            />
          ) : (
            <FormControl size="small">
              <InputLabel>Outcome</InputLabel>
              <Select value={outcome} label="Outcome" onChange={(e) => setOutcome(e.target.value)}>
                {OUTCOMES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Complication (if any)"
            value={complication}
            onChange={(e) => setComplication(e.target.value)}
            size="small"
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            size="small"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
        >
          Record
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcedurePerformanceDialog;
