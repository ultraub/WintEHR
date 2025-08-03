/**
 * Medication Ordering Example
 * Demonstrates integration of drug safety checking into medication ordering workflow
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Send as SendIcon,
  Security as SafetyIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import DrugSafetyIndicator from './DrugSafetyIndicator';
import MedicationSafetyDialog from './dialogs/MedicationSafetyDialog';
import { useDrugSafety } from '../../hooks/useDrugSafety';
import { useMedicationCatalog } from '../../hooks/useMedicationCatalog';

// Example medication routes
const MEDICATION_ROUTES = [
  { value: 'oral', label: 'Oral' },
  { value: 'iv', label: 'Intravenous' },
  { value: 'im', label: 'Intramuscular' },
  { value: 'sc', label: 'Subcutaneous' },
  { value: 'topical', label: 'Topical' }
];

// Example frequencies
const MEDICATION_FREQUENCIES = [
  { value: 'daily', label: 'Once daily' },
  { value: 'bid', label: 'Twice daily' },
  { value: 'tid', label: 'Three times daily' },
  { value: 'qid', label: 'Four times daily' },
  { value: 'prn', label: 'As needed' },
  { value: 'q4h', label: 'Every 4 hours' },
  { value: 'q6h', label: 'Every 6 hours' },
  { value: 'q8h', label: 'Every 8 hours' }
];

const MedicationOrderingExample = ({ patientId }) => {
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('oral');
  const [frequency, setFrequency] = useState('daily');
  const [instructions, setInstructions] = useState('');
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const { medications, loading: catalogLoading } = useMedicationCatalog();
  const {
    safetyData,
    loading: safetyLoading,
    checkSingleMedication,
    getSeverityLevel,
    isSafeToProceed
  } = useDrugSafety(patientId);

  // Check safety when medication changes
  useEffect(() => {
    if (selectedMedication && dose) {
      const medicationData = {
        ...selectedMedication,
        dose: `${dose} ${selectedMedication.unit || 'mg'}`,
        route,
        frequency
      };
      checkSingleMedication(medicationData);
    }
  }, [selectedMedication, dose, route, frequency, checkSingleMedication]);

  const handleMedicationSelect = (event, value) => {
    setSelectedMedication(value);
    if (value?.commonDose) {
      setDose(value.commonDose.toString());
    }
  };

  const handleSubmitOrder = () => {
    if (!selectedMedication || !dose) return;

    // Open safety dialog for review
    setSafetyDialogOpen(true);
  };

  const handleSafetyProceed = (result) => {
    console.log('Proceeding with order:', result);
    
    // In a real implementation, this would submit the order to the backend
    // Including any override reasons if safety alerts were overridden
    
    setOrderPlaced(true);
    
    // Reset form after a delay
    setTimeout(() => {
      setSelectedMedication(null);
      setDose('');
      setRoute('oral');
      setFrequency('daily');
      setInstructions('');
      setOrderPlaced(false);
    }, 3000);
  };

  const handleSafetyCancel = (result) => {
    console.log('Order cancelled:', result);
    setSafetyDialogOpen(false);
  };

  const canSubmit = selectedMedication && dose && !safetyLoading;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          New Medication Order
        </Typography>
        {safetyData && (
          <DrugSafetyIndicator
            safetyData={safetyData}
            loading={safetyLoading}
            onRefresh={() => checkSingleMedication({
              ...selectedMedication,
              dose: `${dose} ${selectedMedication?.unit || 'mg'}`,
              route,
              frequency
            })}
            expandable={true}
          />
        )}
      </Box>

      {orderPlaced && (
        <Alert 
          severity="success" 
          icon={<CheckIcon />}
          sx={{ mb: 3 }}
        >
          Medication order placed successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Autocomplete
            options={medications}
            getOptionLabel={(option) => 
              `${option.name} ${option.strength || ''} ${option.unit || ''}`
            }
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body1">
                    {option.name} {option.strength} {option.unit}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.form} • RxNorm: {option.rxnormCode}
                  </Typography>
                </Box>
              </Box>
            )}
            value={selectedMedication}
            onChange={handleMedicationSelect}
            loading={catalogLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Medication"
                placeholder="Search medications..."
                required
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {catalogLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            required
            type="number"
            InputProps={{
              endAdornment: selectedMedication?.unit || 'mg'
            }}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Route</InputLabel>
            <Select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              label="Route"
            >
              {MEDICATION_ROUTES.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              label="Frequency"
            >
              {MEDICATION_FREQUENCIES.map((f) => (
                <MenuItem key={f.value} value={f.value}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            multiline
            rows={2}
            placeholder="e.g., Take with food, avoid alcohol..."
          />
        </Grid>
      </Grid>

      {/* Safety Preview */}
      {safetyData && safetyData.total_alerts > 0 && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Alert 
            severity={getSeverityLevel() === 'critical' ? 'error' : 'warning'}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Drug Safety Check: {safetyData.total_alerts} alert{safetyData.total_alerts !== 1 ? 's' : ''} found
            </Typography>
            <Typography variant="body2">
              {safetyData.critical_alerts > 0 && (
                <strong>{safetyData.critical_alerts} critical alerts. </strong>
              )}
              Review safety information before proceeding.
            </Typography>
          </Alert>
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={() => {
            setSelectedMedication(null);
            setDose('');
            setInstructions('');
          }}
        >
          Clear
        </Button>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          onClick={handleSubmitOrder}
          disabled={!canSubmit}
        >
          Review & Order
        </Button>
      </Box>

      {/* Safety Review Dialog */}
      <MedicationSafetyDialog
        open={safetyDialogOpen}
        onClose={() => setSafetyDialogOpen(false)}
        medication={{
          name: selectedMedication?.name,
          display: `${selectedMedication?.name} ${dose}${selectedMedication?.unit || 'mg'}`,
          dose: `${dose} ${selectedMedication?.unit || 'mg'}`,
          route,
          frequency,
          code: selectedMedication?.rxnormCode,
          instructions
        }}
        patientId={patientId}
        onProceed={handleSafetyProceed}
        onCancel={handleSafetyCancel}
        requireOverrideReason={true}
      />
    </Paper>
  );
};

export default MedicationOrderingExample;