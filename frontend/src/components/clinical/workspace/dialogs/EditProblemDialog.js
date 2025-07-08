/**
 * Edit Problem Dialog Component
 * Allows editing existing problems/conditions in patient chart
 */
import React, { useState, useEffect } from 'react';
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
import { format, parseISO } from 'date-fns';
import { searchService } from '../../../../services/searchService';

const EditProblemDialog = ({ open, onClose, onSave, onDelete, condition, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Initialize form with existing condition data
  useEffect(() => {
    if (condition && open) {
      // Extract clinical status - handle both coding array and direct code
      const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code || 
                           condition.clinicalStatus?.code || 
                           'active';
      
      // Extract verification status - handle both coding array and direct code
      const verificationStatus = condition.verificationStatus?.coding?.[0]?.code || 
                               condition.verificationStatus?.code || 
                               'confirmed';
      
      // Extract onset date - check multiple possible fields
      let onsetDate = null;
      if (condition.onsetDateTime) {
        onsetDate = parseISO(condition.onsetDateTime);
      } else if (condition.onsetPeriod?.start) {
        onsetDate = parseISO(condition.onsetPeriod.start);
      } else if (condition.onsetAge) {
        // Could calculate approximate date from age if needed
        onsetDate = null;
      }
      
      // Extract notes
      const notes = condition.note?.[0]?.text || '';
      
      // Extract condition code and display
      const code = condition.code?.coding?.[0];
      const problemText = condition.code?.text || code?.display || '';
      
      // Create selected problem object if we have coded data
      const selectedProblem = code ? {
        code: code.code,
        display: code.display || problemText,
        system: code.system || 'http://snomed.info/sct',
        source: 'existing'
      } : null;

      // Extract severity
      let severity = '';
      if (condition.severity?.coding?.[0]?.code) {
        const severityCode = condition.severity.coding[0].code;
        // Map SNOMED severity codes to our simple values
        if (severityCode === '255604002') severity = 'mild';
        else if (severityCode === '6736007') severity = 'moderate';
        else if (severityCode === '24484000') severity = 'severe';
        else severity = condition.severity.coding[0].display || '';
      } else if (condition.severity?.text) {
        severity = condition.severity.text.toLowerCase();
      }

      // Extract category - default to problem-list-item
      const categoryCode = condition.category?.[0]?.coding?.[0]?.code || 'problem-list-item';

      setFormData({
        problemText,
        selectedProblem,
        clinicalStatus,
        verificationStatus,
        severity,
        onsetDate,
        category: categoryCode,
        notes
      });
    }
  }, [condition, open]);

  // Search for conditions as user types
  const handleSearchConditions = async (query) => {
    if (!query || query.length < 2) {
      setConditionOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchService.searchConditions(query, 20);
      setConditionOptions(results.map(searchService.formatCondition));
    } catch (error) {
      
      setConditionOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

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
    setConditionOptions([]);
    setSearchQuery('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate required fields
      if (!formData.problemText && !formData.selectedProblem) {
        setError('Please specify a problem description or select from the list');
        return;
      }

      // Ensure we have the resource ID
      if (!condition.id) {
        setError('Cannot update problem: missing resource ID');
        return;
      }

      // Create updated FHIR Condition resource
      const updatedCondition = {
        ...condition, // Preserve existing fields like id, meta, etc.
        resourceType: 'Condition', // Ensure resourceType is set
        id: condition.id, // Explicitly set ID
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
            system: formData.selectedProblem.system || 'http://snomed.info/sct',
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

      // Call the onSave callback with the updated condition
      await onSave(updatedCondition);
      handleClose();
    } catch (err) {
      
      // Ensure we always set a string error message
      const errorMessage = typeof err === 'string' ? err : 
                          err?.message || 
                          err?.response?.data?.message || 
                          err?.response?.data?.detail || 
                          'Failed to update problem';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this problem? This action cannot be undone.')) {
      try {
        setLoading(true);
        await onDelete(condition.id);
        handleClose();
      } catch (err) {
        
        // Ensure we always set a string error message
        const errorMessage = typeof err === 'string' ? err : 
                            err?.message || 
                            err?.response?.data?.message || 
                            err?.response?.data?.detail || 
                            'Failed to delete problem';
        setError(errorMessage);
        setLoading(false);
      }
    }
  };

  if (!condition) {
    return null;
  }

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
          Edit Problem
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Condition ID: {condition.id}
          </Typography>
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
                  options={conditionOptions}
                  getOptionLabel={(option) => option.display}
                  value={formData.selectedProblem}
                  loading={searchLoading}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  onInputChange={(event, value) => {
                    setSearchQuery(value);
                    handleSearchConditions(value);
                  }}
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
                      label="Search for conditions/problems"
                      placeholder="Type to search conditions..."
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack>
                        <Typography variant="body2">{option.display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.code} • {option.system?.split('/').pop()?.toUpperCase()} • Source: {option.source}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  noOptionsText={
                    searchQuery.length < 2 ? 
                    "Type at least 2 characters to search" : 
                    searchLoading ? "Searching..." : "No conditions found"
                  }
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
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
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
                  Updated Problem Preview:
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

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={loading}
            variant="outlined"
          >
            Delete Problem
          </Button>
          
          <Stack direction="row" spacing={1}>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={loading || (!formData.problemText && !formData.selectedProblem)}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default EditProblemDialog;