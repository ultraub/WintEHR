/**
 * Add Problem Dialog Component
 * Allows adding new problems/conditions to patient chart
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Chip,
  Stack,
  Autocomplete,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';

// Common ICD-10 codes for problems
const COMMON_PROBLEMS = [
  { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
  { code: 'I10', display: 'Essential hypertension' },
  { code: 'E78.5', display: 'Hyperlipidemia' },
  { code: 'J44.1', display: 'Chronic obstructive pulmonary disease with acute exacerbation' },
  { code: 'M25.50', display: 'Pain in unspecified joint' },
  { code: 'R06.02', display: 'Shortness of breath' },
  { code: 'R50.9', display: 'Fever' },
  { code: 'K59.00', display: 'Constipation' },
  { code: 'R51', display: 'Headache' },
  { code: 'M79.3', display: 'Panniculitis' }
];

const AddProblemDialog = ({ open, onClose, onAdd, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    problemText: '',
    selectedProblem: null,
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: '',
    onsetDate: null,
    category: 'problem-list-item',
    notes: ''
  });

  const handleReset = () => {
    setFormData({
      problemText: '',
      selectedProblem: null,
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: '',
      onsetDate: null,
      category: 'problem-list-item',
      notes: ''
    });
    setError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate required fields
      if (!formData.problemText && !formData.selectedProblem) {
        setError('Please specify a problem description or select from the list');
        return;
      }

      // Create FHIR Condition resource
      const condition = {
        resourceType: 'Condition',
        id: `condition-${Date.now()}`,
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: formData.clinicalStatus,
            display: formData.clinicalStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: formData.verificationStatus,
            display: formData.verificationStatus
          }]
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: formData.category,
            display: 'Problem List Item'
          }]
        }],
        code: formData.selectedProblem ? {
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: formData.selectedProblem.code,
            display: formData.selectedProblem.display
          }],
          text: formData.selectedProblem.display
        } : {
          text: formData.problemText
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        recordedDate: new Date().toISOString(),
        ...(formData.onsetDate && {
          onsetDateTime: formData.onsetDate.toISOString()
        }),
        ...(formData.severity && {
          severity: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: formData.severity === 'mild' ? '255604002' : 
                    formData.severity === 'moderate' ? '6736007' : '24484000',
              display: formData.severity
            }],
            text: formData.severity
          }
        }),
        ...(formData.notes && {
          note: [{
            text: formData.notes,
            time: new Date().toISOString()
          }]
        })
      };

      // Call the onAdd callback with the new condition
      await onAdd(condition);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to add problem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          <Typography variant="h6">Add New Problem</Typography>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Problem Description
                </Typography>
                <Autocomplete
                  options={COMMON_PROBLEMS}
                  getOptionLabel={(option) => option.display}
                  value={formData.selectedProblem}
                  onChange={(event, newValue) => {
                    setFormData(prev => ({
                      ...prev,
                      selectedProblem: newValue,
                      problemText: newValue ? newValue.display : prev.problemText
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select from common problems"
                      placeholder="Type to search..."
                      variant="outlined"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack>
                        <Typography variant="body2">{option.display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.code}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Or enter a custom problem description:
                </Typography>
                <TextField
                  fullWidth
                  label="Custom Problem Description"
                  value={formData.problemText}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    problemText: e.target.value,
                    selectedProblem: null
                  }))}
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Clinical Status</InputLabel>
                  <Select
                    value={formData.clinicalStatus}
                    label="Clinical Status"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      clinicalStatus: e.target.value
                    }))}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="recurrence">Recurrence</MenuItem>
                    <MenuItem value="relapse">Relapse</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="remission">Remission</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Verification Status</InputLabel>
                  <Select
                    value={formData.verificationStatus}
                    label="Verification Status"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      verificationStatus: e.target.value
                    }))}
                  >
                    <MenuItem value="confirmed">Confirmed</MenuItem>
                    <MenuItem value="provisional">Provisional</MenuItem>
                    <MenuItem value="differential">Differential</MenuItem>
                    <MenuItem value="unconfirmed">Unconfirmed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={formData.severity}
                    label="Severity"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      severity: e.target.value
                    }))}
                  >
                    <MenuItem value="">Not specified</MenuItem>
                    <MenuItem value="mild">Mild</MenuItem>
                    <MenuItem value="moderate">Moderate</MenuItem>
                    <MenuItem value="severe">Severe</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Onset Date"
                  value={formData.onsetDate}
                  onChange={(newValue) => setFormData(prev => ({
                    ...prev,
                    onsetDate: newValue
                  }))}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth />
                  )}
                  maxDate={new Date()}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Clinical Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Additional notes about this problem..."
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {(formData.problemText || formData.selectedProblem) && (
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview:
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    {formData.selectedProblem ? formData.selectedProblem.display : formData.problemText}
                  </Typography>
                  <Chip 
                    label={formData.clinicalStatus} 
                    size="small" 
                    color={formData.clinicalStatus === 'active' ? 'warning' : 'default'}
                  />
                  {formData.severity && (
                    <Chip 
                      label={formData.severity} 
                      size="small" 
                      color={formData.severity === 'severe' ? 'error' : 'default'}
                    />
                  )}
                </Stack>
                {formData.onsetDate && (
                  <Typography variant="caption" color="text.secondary">
                    Onset: {format(formData.onsetDate, 'MMM d, yyyy')}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || (!formData.problemText && !formData.selectedProblem)}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Adding...' : 'Add Problem'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddProblemDialog;