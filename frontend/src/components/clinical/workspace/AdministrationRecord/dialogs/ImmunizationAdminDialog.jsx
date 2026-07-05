/**
 * ImmunizationAdminDialog — record or edit an Immunization (#116 Phase 5.2/5.3).
 *
 * Two modes, one lean dialog:
 *
 * - **Record mode** (`task` prop) — used by the MAR Tasks pane. The vaccine
 *   is fixed by the ordering ServiceRequest (shown read-only); the dialog
 *   captures the administration facts and POSTs to
 *   `POST /api/clinical/administration/record/immunization`, which creates
 *   an `Immunization` linked back to the order and refuses draft orders.
 *
 * - **Edit mode** (`immunization` prop, Phase 5.3) — used by Chart Review to
 *   correct an existing `Immunization`. The form pre-fills from the resource
 *   and submit hands a merged resource to `onSave` (Chart Review's
 *   `fhirClient.update` path). The merge spreads the original first, so
 *   fields this lean form doesn't manage — `performer`, `location`,
 *   `protocolApplied`, `reaction` — are preserved untouched.
 *
 * This replaces the retired 1,569-line `ImmunizationDialogEnhanced` stepper:
 * immunization *ordering* now lives in the Order Composer, so all that
 * dialog's CDS / schedule-forecast / contraindication machinery is obsolete.
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
import api from '../../../../../services/api';
import { useClinicalWorkflow } from '../../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../../constants/clinicalEvents';

const ROUTES = ['IM', 'SC', 'ID', 'IN', 'PO'];
const SITES = [
  'Left deltoid', 'Right deltoid',
  'Left thigh', 'Right thigh',
  'Left gluteus', 'Right gluteus',
];
const EDIT_STATUSES = [
  { value: 'completed', label: 'Completed (given)' },
  { value: 'not-done', label: 'Not given' },
  { value: 'entered-in-error', label: 'Entered in error' },
];

/** Format a Date as the value a `datetime-local` input expects (local time). */
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Read a CodeableConcept's display text. */
const conceptText = (cc) =>
  cc?.text || cc?.coding?.[0]?.display || cc?.coding?.[0]?.code || '';

/** A Select needs the current value among its options or it renders blank. */
const withCurrent = (options, current) =>
  (current && !options.includes(current)) ? [current, ...options] : options;

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} [props.task] — record mode: the immunization task (service_request_id, code_display)
 * @param {object|null} [props.immunization] — edit mode: an existing Immunization resource
 * @param {string} [props.patientId]
 * @param {() => void} props.onClose
 * @param {() => void} [props.onRecorded] — record mode: fired after a successful POST
 * @param {(resource: object) => Promise<any>} [props.onSave] — edit mode: persists the merged resource
 */
const ImmunizationAdminDialog = ({
  open,
  task,
  immunization,
  patientId,
  onClose,
  onRecorded,
  onSave,
}) => {
  const { publish } = useClinicalWorkflow();
  const editMode = Boolean(immunization);

  // Event publishing is best-effort telemetry — a publish failure must never
  // break the clinical save the user just performed.
  const safePublish = (eventName, payload) => {
    try {
      publish?.(eventName, payload);
    } catch (err) {
      console.warn('ImmunizationAdminDialog: publish failed', err);
    }
  };

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
    setError(null);
    if (immunization) {
      // Edit mode — pre-fill from the existing resource.
      setStatus(immunization.status || 'completed');
      const occ = immunization.occurrenceDateTime;
      const occDate = occ ? new Date(occ) : new Date();
      setOccurrence(toLocalInput(Number.isNaN(occDate.getTime()) ? new Date() : occDate));
      setLotNumber(immunization.lotNumber || '');
      setExpiration(immunization.expirationDate || '');
      setRoute(conceptText(immunization.route) || 'IM');
      setSite(conceptText(immunization.site) || 'Left deltoid');
      setDoseValue(immunization.doseQuantity?.value != null ? String(immunization.doseQuantity.value) : '');
      setDoseUnit(immunization.doseQuantity?.unit || 'mL');
      setStatusReason(conceptText(immunization.statusReason));
      setNotes(immunization.note?.[0]?.text || '');
      setReaction('');
    } else {
      // Record mode — fresh defaults.
      setStatus('completed');
      setOccurrence(toLocalInput(new Date()));
      setLotNumber('');
      setExpiration('');
      setRoute('IM');
      setSite('Left deltoid');
      setDoseValue('0.5');
      setDoseUnit('mL');
      setStatusReason('');
      setNotes('');
      setReaction('');
    }
  }, [open, immunization, task]);

  const notDone = status === 'not-done';
  const vaccineName = useMemo(() => {
    if (editMode) return conceptText(immunization?.vaccineCode) || 'Vaccine';
    return task?.code_display || 'Vaccine';
  }, [editMode, immunization, task]);

  const routeOptions = withCurrent(ROUTES, route);
  const siteOptions = withCurrent(SITES, site);

  const submitEdit = async () => {
    // Spread the original first so fields this form doesn't manage —
    // performer, location, protocolApplied, reaction, vaccineCode — survive.
    const merged = { ...immunization, status };
    const setOrDelete = (key, value) => {
      if (value === undefined || value === null || value === '') delete merged[key];
      else merged[key] = value;
    };
    setOrDelete('occurrenceDateTime', new Date(occurrence).toISOString());
    setOrDelete('lotNumber', lotNumber || '');
    setOrDelete('expirationDate', expiration || '');
    setOrDelete('route', route ? { text: route } : '');
    setOrDelete('site', site ? { text: site } : '');
    setOrDelete(
      'doseQuantity',
      doseValue ? { value: parseFloat(doseValue), unit: doseUnit } : '',
    );
    setOrDelete('statusReason', notDone && statusReason ? { text: statusReason } : '');
    setOrDelete('note', notes ? [{ text: notes }] : '');
    await onSave?.(merged);
    safePublish(CLINICAL_EVENTS.IMMUNIZATION_UPDATED, {
      patientId,
      immunizationId: immunization.id,
    });
  };

  const submitRecord = async () => {
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
    const res = await api
      .post(buildUrl('backend', '/api/clinical/administration/record/immunization'), body)
      .catch((err) => {
        throw new Error(err.response?.data?.detail || err.message);
      });
    const created = res.data ?? {};
    safePublish(CLINICAL_EVENTS.IMMUNIZATION_ADMINISTERED, {
      patientId,
      immunizationId: created.resource_id,
      serviceRequestId: task.service_request_id,
    });
  };

  const handleSubmit = async () => {
    if (!editMode && !task) return;
    if (notDone && !statusReason.trim()) {
      setError('A reason is required when the vaccine was not given.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editMode) await submitEdit();
      else await submitRecord();
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
      <DialogTitle>{editMode ? 'Edit immunization' : 'Record immunization'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{vaccineName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {editMode
                ? 'Editing an existing immunization record.'
                : 'Recording against the signed immunization order.'}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {editMode ? (
            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
                {EDIT_STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          ) : (
            <RadioGroup row value={status} onChange={(e) => setStatus(e.target.value)}>
              <FormControlLabel value="completed" control={<Radio size="small" />} label="Given" />
              <FormControlLabel value="not-done" control={<Radio size="small" />} label="Not given" />
            </RadioGroup>
          )}

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
                    {routeOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 2 }}>
                  <InputLabel>Site</InputLabel>
                  <Select value={site} label="Site" onChange={(e) => setSite(e.target.value)}>
                    {siteOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
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
              {/* Reaction is a record-time observation — captured only when
                  recording. In edit mode an existing reaction is preserved
                  untouched by the resource spread. */}
              {!editMode && (
                <TextField
                  label="Adverse reaction (if any)"
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  size="small"
                />
              )}
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
          {editMode ? 'Save' : 'Record'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImmunizationAdminDialog;
