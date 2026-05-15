/**
 * ImmunizationAdminDialog — record an Immunization against its order (#116 Phase 5.2).
 *
 * The lean nurse-side recording dialog for the MAR Tasks pane. The vaccine
 * is fixed by the ordering ServiceRequest (shown read-only); this dialog
 * only captures the administration facts — lot, route, site, dose, performer,
 * reaction. Posts to `POST /api/clinical/administration/record/immunization`,
 * which creates an `Immunization` with `basedOn` → the order and refuses
 * unsigned (draft) orders.
 *
 * This is NOT the full ImmunizationDialogEnhanced (the 3-step stepper used
 * for standalone/historical immunization editing) — Phase 5.3 retires that.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { buildUrl } from '../../../../../config/apiConfig';
import { useClinicalWorkflow } from '../../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../../constants/clinicalEvents';

const ROUTES = ['IM', 'SC', 'ID', 'IN', 'PO'];
const SITES = [
  'Left deltoid', 'Right deltoid',
  'Left thigh', 'Right thigh',
  'Left gluteus', 'Right gluteus',
];

/** Format a Date as the value a `datetime-local` input expects (local time). */
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.task — the immunization task (service_request_id, code_display, ...)
 * @param {string} [props.patientId]
 * @param {() => void} props.onClose
 * @param {() => void} props.onRecorded — fired after a successful save
 */
const ImmunizationAdminDialog = ({ open, task, patientId, onClose, onRecorded }) => {
  const { publish } = useClinicalWorkflow();

  const [status, setStatus] = useState('completed');
  const [occurrence, setOccurrence] = useState(() => toLocalInput(new Date()));
  const [lotNumber, setLotNumber] = useState('');
  const [expiration, setExpiration] = useState('');
  const [route, setRoute] = useState('IM');
  const [site, setSite] = useState('Left deltoid');
  const [doseValue, setDoseValue] = useState('0.5');
  const [doseUnit, setDoseUnit] = useState('mL');
  const [reaction, setReaction] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStatus('completed');
    setOccurrence(toLocalInput(new Date()));
    setLotNumber('');
    setExpiration('');
    setRoute('IM');
    setSite('Left deltoid');
    setDoseValue('0.5');
    setDoseUnit('mL');
    setReaction('');
    setStatusReason('');
    setNotes('');
    setError(null);
  }, [open, task]);

  const notDone = status === 'not-done';
  const vaccineName = useMemo(() => task?.code_display || 'Vaccine', [task]);

  const handleSubmit = async () => {
    if (!task) return;
    if (notDone && !statusReason.trim()) {
      setError('A reason is required when the vaccine was not given.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        service_request_id: task.service_request_id,
        status,
        occurrence_datetime: new Date(occurrence).toISOString(),
        ...(lotNumber ? { lot_number: lotNumber } : {}),
        ...(expiration ? { expiration_date: expiration } : {}),
        ...(!notDone && route ? { route } : {}),
        ...(!notDone && site ? { site } : {}),
        ...(!notDone && doseValue ? { dose_value: parseFloat(doseValue), dose_unit: doseUnit } : {}),
        ...(reaction ? { reaction } : {}),
        ...(notDone ? { status_reason: statusReason } : {}),
        ...(notes ? { notes } : {}),
      };
      const res = await fetch(
        buildUrl('backend', '/api/clinical/administration/record/immunization'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || `Server returned ${res.status}`);
      }
      const created = await res.json().catch(() => ({}));
      publish?.(CLINICAL_EVENTS.IMMUNIZATION_ADMINISTERED, {
        patientId,
        immunizationId: created.resource_id,
        serviceRequestId: task.service_request_id,
      });
      onRecorded?.();
      onClose?.();
    } catch (err) {
      console.error('ImmunizationAdminDialog: submit failed', err);
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record immunization</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{vaccineName}</Typography>
            <Typography variant="caption" color="text.secondary">
              Recording against the signed immunization order.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <RadioGroup row value={status} onChange={(e) => setStatus(e.target.value)}>
            <FormControlLabel value="completed" control={<Radio size="small" />} label="Given" />
            <FormControlLabel value="not-done" control={<Radio size="small" />} label="Not given" />
          </RadioGroup>

          <TextField
            label="Occurrence"
            type="datetime-local"
            value={occurrence}
            onChange={(e) => setOccurrence(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          {notDone ? (
            <TextField
              label="Reason not given"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              size="small"
              required
            />
          ) : (
            <>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Lot number"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Lot expiration"
                  type="date"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Route</InputLabel>
                  <Select value={route} label="Route" onChange={(e) => setRoute(e.target.value)}>
                    {ROUTES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 2 }}>
                  <InputLabel>Site</InputLabel>
                  <Select value={site} label="Site" onChange={(e) => setSite(e.target.value)}>
                    {SITES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Dose"
                  value={doseValue}
                  onChange={(e) => setDoseValue(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Unit"
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Stack>
              <TextField
                label="Adverse reaction (if any)"
                value={reaction}
                onChange={(e) => setReaction(e.target.value)}
                size="small"
              />
            </>
          )}

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

export default ImmunizationAdminDialog;
