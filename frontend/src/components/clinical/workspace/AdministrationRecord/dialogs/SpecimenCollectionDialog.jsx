/**
 * SpecimenCollectionDialog — record a Specimen against its lab order (#116 Phase 5.2).
 *
 * Nurse/phlebotomist-side dialog for the MAR Tasks pane: documents that a
 * specimen was collected for a signed laboratory ServiceRequest. Posts to
 * `POST /api/clinical/administration/record/specimen`, which creates a
 * `Specimen` with `request` → the order and refuses unsigned (draft) orders.
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
import { useClinicalWorkflow } from '../../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../../constants/clinicalEvents';

const CONTAINERS = [
  'EDTA tube (lavender)',
  'Serum separator tube (gold)',
  'Sodium citrate tube (blue)',
  'Lithium heparin tube (green)',
  'Sterile urine cup',
  'Other (see notes)',
];

const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.task — the specimen task (service_request_id, code_display, ...)
 * @param {string} [props.patientId]
 * @param {() => void} props.onClose
 * @param {() => void} props.onRecorded
 */
const SpecimenCollectionDialog = ({ open, task, patientId, onClose, onRecorded }) => {
  const { publish } = useClinicalWorkflow();

  const [specimenType, setSpecimenType] = useState('');
  const [collected, setCollected] = useState(() => toLocalInput(new Date()));
  const [container, setContainer] = useState(CONTAINERS[0]);
  const [bodySite, setBodySite] = useState('');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('mL');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSpecimenType(task?.code_display && task.code_display !== '(unspecified)' ? task.code_display : '');
    setCollected(toLocalInput(new Date()));
    setContainer(CONTAINERS[0]);
    setBodySite('');
    setQuantityValue('');
    setQuantityUnit('mL');
    setNotes('');
    setError(null);
  }, [open, task]);

  const handleSubmit = async () => {
    if (!task) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        service_request_id: task.service_request_id,
        collected_datetime: new Date(collected).toISOString(),
        ...(specimenType ? { specimen_type: specimenType } : {}),
        ...(container ? { container } : {}),
        ...(bodySite ? { body_site: bodySite } : {}),
        ...(quantityValue ? { quantity_value: parseFloat(quantityValue), quantity_unit: quantityUnit } : {}),
        ...(notes ? { notes } : {}),
      };
      const res = await fetch(
        buildUrl('backend', '/api/clinical/administration/record/specimen'),
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
      publish?.(CLINICAL_EVENTS.SPECIMEN_COLLECTED, {
        patientId,
        specimenId: created.resource_id,
        serviceRequestId: task.service_request_id,
      });
      onRecorded?.();
      onClose?.();
    } catch (err) {
      console.error('SpecimenCollectionDialog: submit failed', err);
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record specimen collection</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {task?.code_display || 'Lab order'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recording collection against the signed lab order.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Specimen type"
            value={specimenType}
            onChange={(e) => setSpecimenType(e.target.value)}
            size="small"
            placeholder="e.g. Whole blood, Urine"
          />
          <TextField
            label="Collected"
            type="datetime-local"
            value={collected}
            onChange={(e) => setCollected(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small">
            <InputLabel>Container</InputLabel>
            <Select value={container} label="Container" onChange={(e) => setContainer(e.target.value)}>
              {CONTAINERS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="Collection body site"
            value={bodySite}
            onChange={(e) => setBodySite(e.target.value)}
            size="small"
            placeholder="e.g. Left antecubital fossa"
          />
          <Stack direction="row" spacing={1}>
            <TextField
              label="Quantity"
              value={quantityValue}
              onChange={(e) => setQuantityValue(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Unit"
              value={quantityUnit}
              onChange={(e) => setQuantityUnit(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
          </Stack>
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

export default SpecimenCollectionDialog;
