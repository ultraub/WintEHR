/**
 * QuickAdminPopover — the click-to-document popover (#116 Phase 5.1).
 *
 * Modal-quality popover (not a dialog — keeps the grid context visible
 * underneath) anchored to the cell the user clicked. Switches its field
 * set based on the chosen action:
 *
 *   given        dose / time / route / site / notes
 *   late-given   dose / time / route / site / late reason / notes
 *   held         hold reason (required) / notes
 *   refused      refusal reason (required) / alternative / notes
 *
 * Posts to `POST /api/clinical/administration/record`, which is the
 * gate-protected endpoint that refuses draft orders. We surface the 409
 * inline (not a global snackbar) so the user gets the feedback where the
 * mistake happened.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Popover,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { buildUrl } from '../../../../config/apiConfig';
import api from '../../../../services/api';

const HOLD_REASONS = [
  'NPO for procedure',
  'Patient unavailable',
  'Awaiting clarification',
  'Vital signs out of range',
  'Other (see notes)',
];

const REFUSAL_REASONS = [
  'Patient refused',
  'Patient unable to swallow',
  'Adverse effect concern',
  'Other (see notes)',
];

const ACTIONS = [
  { value: 'given', label: 'Give' },
  { value: 'late-given', label: 'Late-charted give' },
  { value: 'held', label: 'Hold' },
  { value: 'refused', label: 'Refuse' },
];

/**
 * @param {object} props
 * @param {Element|null} props.anchorEl
 * @param {object|null} props.scheduledRow  — what the user clicked, or null for "give now" on a PRN
 * @param {object|null} props.prnOrder     — set when invoked from PRNPane
 * @param {() => void} props.onClose
 * @param {(rxId: string) => void} props.onSubmitStart  — fire optimistic pending state
 * @param {() => void} props.onSubmitDone               — server confirmed; trigger refetch
 */
const QuickAdminPopover = ({
  anchorEl,
  scheduledRow,
  prnOrder,
  onClose,
  onSubmitStart,
  onSubmitDone,
}) => {
  const target = scheduledRow || prnOrder;

  const defaultAction = useMemo(() => {
    if (!scheduledRow) return 'given';
    // If the cell is past-due, default to "late-given" so the nurse doesn't
    // have to flip the radio. If it's due-now or future, default "given".
    const sched = new Date(scheduledRow.scheduled_time);
    const deltaMin = (sched - new Date()) / 60_000;
    return deltaMin < -30 ? 'late-given' : 'given';
  }, [scheduledRow]);

  const [action, setAction] = useState(defaultAction);
  const [doseValue, setDoseValue] = useState('');
  const [doseUnit, setDoseUnit] = useState('mg');
  const [route, setRoute] = useState('');
  const [site, setSite] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when popover opens with a different cell
  useEffect(() => {
    if (!target) return;
    setAction(defaultAction);
    setDoseValue('');
    setDoseUnit('mg');
    setRoute(target.route_text || '');
    setSite('');
    setReason('');
    setNotes('');
    setError(null);
  }, [target, defaultAction]);

  const needsReason = action === 'held' || action === 'refused';
  const showDoseFields = action === 'given' || action === 'late-given';

  const handleSubmit = async () => {
    if (!target) return;
    if (needsReason && !reason.trim()) {
      setError('A reason is required for hold / refuse.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onSubmitStart?.(target.medication_request_id);
      const url = buildUrl('backend', '/api/clinical/administration/record');
      const body = {
        medication_request_id: target.medication_request_id,
        action,
        effective_datetime: new Date().toISOString(),
        ...(scheduledRow ? { scheduled_time: scheduledRow.scheduled_time } : {}),
        ...(showDoseFields && doseValue ? {
          dose_value: parseFloat(doseValue),
          dose_unit: doseUnit,
        } : {}),
        ...(route ? { route } : {}),
        ...(site ? { site } : {}),
        ...(reason ? { reason } : {}),
        ...(notes ? { notes } : {}),
      };
      await api.post(url, body).catch((err) => {
        throw new Error(err.response?.data?.detail || err.message);
      });
      onSubmitDone?.();
      onClose?.();
    } catch (err) {
      console.error('QuickAdminPopover: submit failed', err);
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!target) return null;

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={submitting ? undefined : onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{ paper: { sx: { width: 360, p: 2 } } }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {target.medication_display}
          </Typography>
          {scheduledRow && (
            <Typography variant="caption" color="text.secondary">
              Scheduled {new Date(scheduledRow.scheduled_time).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Typography>
          )}
          {prnOrder && prnOrder.prn_reason && (
            <Typography variant="caption" color="text.secondary">
              PRN {prnOrder.prn_reason}
            </Typography>
          )}
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <RadioGroup
          row
          value={action}
          onChange={(e) => setAction(e.target.value)}
          sx={{ '& .MuiFormControlLabel-root': { mr: 1, '& .MuiTypography-root': { fontSize: '0.8rem' } } }}
        >
          {ACTIONS.map((a) => (
            // PRN doesn't make sense as "hold" — disable for PRN context
            <FormControlLabel
              key={a.value}
              value={a.value}
              control={<Radio size="small" />}
              label={a.label}
              disabled={!!prnOrder && a.value === 'held'}
            />
          ))}
        </RadioGroup>

        {showDoseFields && (
          <Stack direction="row" spacing={1}>
            <TextField
              label="Dose"
              value={doseValue}
              onChange={(e) => setDoseValue(e.target.value)}
              placeholder={target.dose_text || '500'}
              size="small"
              sx={{ flex: 2 }}
            />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Unit</InputLabel>
              <Select value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} label="Unit">
                {['mg', 'mcg', 'g', 'mL', 'units', 'tablet'].map((u) => (
                  <MenuItem key={u} value={u}>{u}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}

        {showDoseFields && (
          <Stack direction="row" spacing={1}>
            <TextField
              label="Route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              placeholder="L deltoid, etc."
            />
          </Stack>
        )}

        {needsReason && (
          <FormControl size="small">
            <InputLabel>{action === 'held' ? 'Hold reason' : 'Refusal reason'}</InputLabel>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              label={action === 'held' ? 'Hold reason' : 'Refusal reason'}
            >
              {(action === 'held' ? HOLD_REASONS : REFUSAL_REASONS).map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          size="small"
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} size="small" disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
};

export default QuickAdminPopover;
