/**
 * Prefetch Editor — review and edit CDS Hooks prefetch templates.
 *
 * For CQL services, students click "Re-derive from CQL" to auto-populate
 * the templates from `Library/$data-requirements`. They can then edit the
 * generated queries, add custom ones, or delete the irrelevant ones.
 *
 * For visual condition-based services, the table starts populated with the
 * defaults the visual builder backend produces (per service type) — students
 * usually leave these alone.
 *
 * The CDS Hooks prefetch is what an EHR pre-fetches and includes in the
 * /cds-services/{id} request. It mirrors what the CQL `dataRequirement[]`
 * declares; HAPI's `$apply` can use it directly via the `data` parameter
 * to skip re-fetching.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoFixHigh as DeriveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import cdsStudioApi from '../../services/cdsStudioApi';

/**
 * @param {object} props
 * @param {Record<string,string>} props.value — current prefetch dict
 *   ({key: queryTemplate}). May be empty.
 * @param {(next: Record<string,string>) => void} props.onChange
 * @param {string} [props.cqlSource] — the student's CQL. Required for the
 *   "Re-derive" button to work; if omitted (visual services) the button is hidden.
 */
const PrefetchEditor = ({ value = {}, onChange, cqlSource }) => {
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState(null);
  const [info, setInfo] = useState(null);

  // Internal "rows" state lets students edit keys (which become the dict
  // keys on save). We sync to the parent via onChange when rows are valid.
  const rowsFromValue = (dict) =>
    Object.entries(dict || {}).map(([key, query]) => ({ key, query }));
  const [rows, setRows] = useState(() => rowsFromValue(value));

  // Re-sync rows when value changes externally (e.g. wizard reset).
  useEffect(() => {
    setRows(rowsFromValue(value));
  }, [value]);

  const commitRows = useCallback(
    (next) => {
      setRows(next);
      // Skip rows with empty key — those are still being typed. Accept
      // duplicates here (users may transition through one); the backend
      // would reject obvious problems, but pure UI dup-detection would be
      // jumpy.
      const dict = {};
      for (const r of next) {
        const k = (r.key || '').trim();
        const q = (r.query || '').trim();
        if (!k) continue;
        dict[k] = q;
      }
      onChange?.(dict);
    },
    [onChange],
  );

  const updateRow = useCallback(
    (index, patch) => {
      const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
      commitRows(next);
    },
    [rows, commitRows],
  );

  const addRow = useCallback(() => {
    commitRows([...rows, { key: '', query: '' }]);
  }, [rows, commitRows]);

  const removeRow = useCallback(
    (index) => {
      commitRows(rows.filter((_, i) => i !== index));
    },
    [rows, commitRows],
  );

  /** Hit /cql/data-requirements and replace the table with the derived templates. */
  const deriveFromCQL = useCallback(async () => {
    if (!cqlSource || !cqlSource.trim()) {
      setDeriveError('CQL is empty — nothing to derive from');
      return;
    }
    setDeriving(true);
    setDeriveError(null);
    setInfo(null);
    try {
      const result = await cdsStudioApi.deriveDataRequirements(cqlSource);
      const derived = result.prefetch || {};
      const count = Object.keys(derived).length;
      if (count === 0) {
        setInfo(
          'HAPI returned no data requirements for this CQL. Either the CQL ' +
            'only uses the Patient context or HAPI couldn’t analyze it. ' +
            'Add prefetch entries manually if your rule needs FHIR resources.',
        );
        return;
      }
      commitRows(rowsFromValue(derived));
      setInfo(
        `Derived ${count} prefetch template${count === 1 ? '' : 's'} from your CQL’s ` +
          'data requirements. You can edit or remove any of them.',
      );
    } catch (err) {
      setDeriveError(err?.message || 'Failed to derive data requirements');
    } finally {
      setDeriving(false);
    }
  }, [cqlSource, commitRows]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        CDS Hooks prefetch
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        These templates tell the EHR which FHIR resources to pre-fetch and
        attach to each hook request. Variable substitutions like{' '}
        <code>{'{{context.patientId}}'}</code> are filled in at hook time.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        {cqlSource !== undefined && (
          <Tooltip title="Ask HAPI to compute prefetch templates from your CQL's data requirements">
            <span>
              <Button
                size="small"
                variant="outlined"
                onClick={deriveFromCQL}
                disabled={deriving}
                startIcon={deriving ? <CircularProgress size={14} /> : <DeriveIcon />}
              >
                Re-derive from CQL
              </Button>
            </span>
          </Tooltip>
        )}
        <Button size="small" variant="outlined" onClick={addRow} startIcon={<AddIcon />}>
          Add row
        </Button>
      </Stack>

      {deriveError && (
        <Alert severity="error" sx={{ mb: 1, borderRadius: 0 }}>
          {deriveError}
        </Alert>
      )}
      {info && (
        <Alert severity="info" sx={{ mb: 1, borderRadius: 0 }}>
          {info}
        </Alert>
      )}

      {rows.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          No prefetch templates yet. {cqlSource !== undefined
            ? 'Click "Re-derive from CQL" to auto-populate, or add rows manually.'
            : 'Add rows manually if your rule needs FHIR resources beyond the patient context.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={180}>Key</TableCell>
                <TableCell>FHIR query template</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="patient"
                      value={row.key}
                      onChange={(e) => updateRow(index, { key: e.target.value })}
                      InputProps={{
                        sx: { fontFamily: 'Monaco, Menlo, monospace', fontSize: 13 },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      placeholder="Patient/{{context.patientId}}"
                      value={row.query}
                      onChange={(e) => updateRow(index, { query: e.target.value })}
                      InputProps={{
                        sx: { fontFamily: 'Monaco, Menlo, monospace', fontSize: 13 },
                      }}
                    />
                  </TableCell>
                  <TableCell padding="none" sx={{ verticalAlign: 'top', pt: 1.5 }}>
                    <IconButton size="small" onClick={() => removeRow(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default PrefetchEditor;
