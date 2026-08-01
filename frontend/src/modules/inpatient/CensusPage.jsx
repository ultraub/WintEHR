/**
 * CensusPage — inpatient census board (module 'inpatient').
 *
 * Two clearly labeled lists from GET /api/inpatient/census: patients
 * admitted right now, and the most recent completed inpatient stays
 * (Synthea histories rarely leave encounters open, so an honest teaching
 * census needs both — an empty "currently admitted" list is real data,
 * not a bug, and the page says so).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Hotel as CensusIcon, Refresh as RefreshIcon } from '@mui/icons-material';

import { buildUrl } from '../../config/apiConfig';
import api from '../../services/api';

const CensusTable = ({ rows, showDischarge, onOpenChart }) => (
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Patient</TableCell>
        <TableCell>Location</TableCell>
        <TableCell>Type</TableCell>
        <TableCell>Admitted</TableCell>
        {showDischarge && <TableCell>Discharged</TableCell>}
        <TableCell align="right">LOS (days)</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((row) => (
        <TableRow
          key={row.encounter_id}
          hover
          sx={{ cursor: row.patient_id ? 'pointer' : 'default' }}
          onClick={() => row.patient_id && onOpenChart(row.patient_id)}
        >
          <TableCell>{row.patient_name || row.patient_id || '(unknown)'}</TableCell>
          <TableCell>{row.location_display || '—'}</TableCell>
          <TableCell>{row.encounter_type || row.encounter_class || '—'}</TableCell>
          <TableCell>
            {row.admitted_at ? new Date(row.admitted_at).toLocaleDateString() : '—'}
          </TableCell>
          {showDischarge && (
            <TableCell>
              {row.discharged_at ? new Date(row.discharged_at).toLocaleDateString() : '—'}
            </TableCell>
          )}
          <TableCell align="right">{row.length_of_stay_days ?? '—'}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const CensusPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCensus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(buildUrl('backend', '/api/inpatient/census'));
      setData(res.data);
    } catch (err) {
      console.error('CensusPage: fetch failed', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCensus(); }, [fetchCensus]);

  const openChart = (patientId) => navigate(`/patients/${patientId}/clinical?tab=summary`);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <CensusIcon color="primary" />
        <Typography variant="h5" sx={{ flex: 1 }}>Unit Census</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchCensus} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load census: {error}</Alert>
      )}

      {loading && !data && (
        <Stack direction="row" justifyContent="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {data && (
        <Stack spacing={3}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6">Currently admitted</Typography>
              <Chip size="small" label={data.current.length} color={data.current.length ? 'secondary' : 'default'} />
            </Stack>
            {data.current.length > 0 ? (
              <CensusTable rows={data.current} showDischarge={false} onOpenChart={openChart} />
            ) : (
              <Alert severity="info">
                No patients are currently admitted (no in-progress inpatient
                encounters in the record). Synthetic histories usually close
                every encounter — recent stays below show what an active
                census would contain.
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6">Recent inpatient stays</Typography>
              <Chip size="small" label={data.recent.length} />
            </Stack>
            {data.recent.length > 0 ? (
              <CensusTable rows={data.recent} showDischarge onOpenChart={openChart} />
            ) : (
              <Alert severity="info">No completed inpatient encounters found.</Alert>
            )}
          </Paper>
        </Stack>
      )}
    </Box>
  );
};

export default CensusPage;
