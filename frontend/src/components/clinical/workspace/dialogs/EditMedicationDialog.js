/**
 * Edit Medication Dialog Component
 * Allows editing existing medication requests in patient chart
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
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { searchService } from '../../../../services/searchService';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';

const DOSING_FREQUENCIES = [
  { value: 'once-daily', display: 'Once daily' },
  { value: 'twice-daily', display: 'Twice daily' },
  { value: 'three-times-daily', display: 'Three times daily' },
  { value: 'four-times-daily', display: 'Four times daily' },
  { value: 'every-other-day', display: 'Every other day' },
  { value: 'weekly', display: 'Weekly' },
  { value: 'as-needed', display: 'As needed' }
];

const ROUTES = [
  { value: 'oral', display: 'Oral' },
  { value: 'topical', display: 'Topical' },
  { value: 'injection', display: 'Injection' },
  { value: 'inhalation', display: 'Inhalation' },
  { value: 'sublingual', display: 'Sublingual' },
  { value: 'rectal', display: 'Rectal' }
];

const MEDICATION_STATUS = [
  { value: 'active', display: 'Active' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'completed', display: 'Completed' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'stopped', display: 'Stopped' }
];

const PRIORITIES = [
  { value: 'routine', display: 'Routine' },
  { value: 'urgent', display: 'Urgent' },
  { value: 'asap', display: 'ASAP' },
  { value: 'stat', display: 'STAT' }
];

const EditMedicationDialog = ({ open, onClose, onSave, onDelete, medicationRequest, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [medicationOptions, setMedicationOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Use medication resolver for format detection and conversion
  const { getMedicationDisplay } = useMedicationResolver([]);
  
  const [formData, setFormData] = useState({
    selectedMedication: null,
    customMedication: '',
    dosage: '',
    route: 'oral',
    frequency: 'once-daily',
    duration: '',
    quantity: '',
    refills: 0,
    startDate: new Date(),
    endDate: null,
    instructions: '',
    indication: '',
    priority: 'routine',
    status: 'active',
    genericSubstitution: true,
    notes: ''
  });

  // Initialize form with existing medication request data
  useEffect(() => {
    if (medicationRequest && open) {
      const status = medicationRequest.status || 'active';
      const priority = medicationRequest.priority || 'routine';
      const startDate = medicationRequest.authoredOn ? parseISO(medicationRequest.authoredOn) : new Date();
      const endDate = medicationRequest.dispenseRequest?.validityPeriod?.end ? 
        parseISO(medicationRequest.dispenseRequest.validityPeriod.end) : null;
      
      // Extract medication information using format-aware approach
      let selectedMedication = null;
      let customMedication = '';
      
      // Handle R5 format (medication.concept)
      if (medicationRequest.medication?.concept) {
        const concept = medicationRequest.medication.concept;
        if (concept.coding && concept.coding.length > 0) {
          const coding = concept.coding[0];
          selectedMedication = {
            code: coding.code,
            display: coding.display || concept.text,
            system: coding.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
            source: 'existing'
          };
        } else if (concept.text) {
          customMedication = concept.text;
        }
      }
      // Handle R4 format (medicationCodeableConcept) for backward compatibility
      else if (medicationRequest.medicationCodeableConcept) {
        const med = medicationRequest.medicationCodeableConcept;
        if (med.coding && med.coding.length > 0) {
          const coding = med.coding[0];
          selectedMedication = {
            code: coding.code,
            display: coding.display || med.text,
            system: coding.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
            source: 'existing-r4'
          };
        } else if (med.text) {
          customMedication = med.text;
        }
      } 
      // Handle medication reference
      else if (medicationRequest.medicationReference) {
        customMedication = 'Referenced Medication';
      }
      // Fallback: try to get display name using medication resolver
      else {
        const displayName = getMedicationDisplay(medicationRequest);
        if (displayName && displayName !== 'Unknown medication') {
          customMedication = displayName;
        }
      }

      // Extract dosage information
      const dosageInstruction = medicationRequest.dosageInstruction?.[0] || {};
      
      // Extract dosage - handle both doseAndRate and doseQuantity formats
      let dosage = '';
      if (dosageInstruction.doseAndRate?.[0]?.doseQuantity) {
        const doseQty = dosageInstruction.doseAndRate[0].doseQuantity;
        dosage = `${doseQty.value} ${doseQty.unit || ''}`.trim();
      } else if (dosageInstruction.doseQuantity) {
        const doseQty = dosageInstruction.doseQuantity;
        dosage = `${doseQty.value} ${doseQty.unit || ''}`.trim();
      }
      
      // Extract route - check both coding and text
      const route = dosageInstruction.route?.coding?.[0]?.code || 
                   dosageInstruction.route?.text?.toLowerCase() || 
                   'oral';
      
      // Extract frequency - check multiple possible locations
      let frequency = 'once-daily';
      if (dosageInstruction.timing?.code?.coding?.[0]?.code) {
        frequency = dosageInstruction.timing.code.coding[0].code;
      } else if (dosageInstruction.timing?.repeat?.frequency === 1 && dosageInstruction.timing?.repeat?.period === 1) {
        const periodUnit = dosageInstruction.timing.repeat.periodUnit;
        if (periodUnit === 'd') frequency = 'once-daily';
        else if (periodUnit === 'wk') frequency = 'weekly';
      } else if (dosageInstruction.timing?.repeat?.frequency === 2 && dosageInstruction.timing?.repeat?.period === 1 && dosageInstruction.timing?.repeat?.periodUnit === 'd') {
        frequency = 'twice-daily';
      } else if (dosageInstruction.timing?.repeat?.frequency === 3 && dosageInstruction.timing?.repeat?.period === 1 && dosageInstruction.timing?.repeat?.periodUnit === 'd') {
        frequency = 'three-times-daily';
      } else if (dosageInstruction.timing?.repeat?.frequency === 4 && dosageInstruction.timing?.repeat?.period === 1 && dosageInstruction.timing?.repeat?.periodUnit === 'd') {
        frequency = 'four-times-daily';
      }
      
      const instructions = dosageInstruction.text || dosageInstruction.patientInstruction || '';

      // Extract dispense information
      const dispenseRequest = medicationRequest.dispenseRequest || {};
      
      // Extract quantity with unit
      let quantity = '';
      if (dispenseRequest.quantity) {
        quantity = `${dispenseRequest.quantity.value} ${dispenseRequest.quantity.unit || ''}`.trim();
      }
      
      const refills = dispenseRequest.numberOfRepeatsAllowed || 0;
      
      // Extract duration with unit
      let duration = '';
      if (dispenseRequest.expectedSupplyDuration) {
        duration = `${dispenseRequest.expectedSupplyDuration.value} ${dispenseRequest.expectedSupplyDuration.unit || 'days'}`.trim();
      }

      // Extract other fields
      const indication = medicationRequest.reasonCode?.[0]?.text || '';
      const genericSubstitution = medicationRequest.substitution?.allowedBoolean !== false;
      const notes = medicationRequest.note?.[0]?.text || '';

      setFormData({
        selectedMedication,
        customMedication,
        dosage,
        route,
        frequency,
        duration,
        quantity,
        refills,
        startDate,
        endDate,
        instructions,
        indication,
        priority,
        status,
        genericSubstitution,
        notes
      });
    }
  }, [medicationRequest, open]);

  // Search for medications as user types
  const handleSearchMedications = async (query) => {
    if (!query || query.length < 2) {
      setMedicationOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchService.searchMedications(query, 20);
      setMedicationOptions(results.map(searchService.formatMedication));
    } catch (error) {
      
      setMedicationOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      selectedMedication: null,
      customMedication: '',
      dosage: '',
      route: 'oral',
      frequency: 'once-daily',
      duration: '',
      quantity: '',
      refills: 0,
      startDate: new Date(),
      endDate: null,
      instructions: '',
      indication: '',
      priority: 'routine',
      status: 'active',
      genericSubstitution: true,
      notes: ''
    });
    setError('');
    setMedicationOptions([]);
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
      if (!formData.selectedMedication && !formData.customMedication) {
        setError('Please select a medication or enter a custom medication');
        return;
      }

      if (!formData.dosage) {
        setError('Please specify the dosage');
        return;
      }

      if (!formData.quantity) {
        setError('Please specify the quantity to dispense');
        return;
      }

      // Ensure we have the resource ID
      if (!medicationRequest.id) {
        setError('Cannot update medication: missing resource ID');
        return;
      }

      // Create updated FHIR MedicationRequest resource
      // Always convert to R5 format for backend consistency
      const updatedMedicationRequest = {
        ...medicationRequest, // Start with original resource
        // Only update specific fields that the user changed
        status: formData.status,
        priority: formData.priority,
        // Always use R5 format for consistency with backend validation
        medication: {
          concept: formData.selectedMedication ? {
            coding: [{
              system: formData.selectedMedication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: formData.selectedMedication.code,
              display: formData.selectedMedication.display
            }],
            text: formData.selectedMedication.display
          } : {
            text: formData.customMedication
          }
        },
        // Remove any R4 format fields to ensure clean R5 structure
        medicationCodeableConcept: undefined,
        medicationReference: undefined,
        authoredOn: formData.startDate.toISOString(),
        dosageInstruction: [{
          text: formData.instructions || `${formData.dosage} ${DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display}`,
          timing: {
            code: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                code: formData.frequency,
                display: DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display
              }]
            }
          },
          route: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: formData.route,
              display: ROUTES.find(r => r.value === formData.route)?.display
            }]
          },
          doseAndRate: [{
            doseQuantity: {
              value: parseFloat(formData.dosage) || 1,
              unit: 'dose'
            }
          }]
        }],
        dispenseRequest: {
          numberOfRepeatsAllowed: formData.refills,
          quantity: {
            value: parseFloat(formData.quantity) || 30,
            unit: 'dose'
          },
          ...(formData.duration && {
            expectedSupplyDuration: {
              value: parseFloat(formData.duration),
              unit: 'days'
            }
          }),
          ...(formData.endDate && {
            validityPeriod: {
              end: formData.endDate.toISOString()
            }
          })
        },
        substitution: {
          allowedBoolean: formData.genericSubstitution
        },
        ...(formData.indication && {
          reasonCode: [{
            text: formData.indication
          }]
        }),
        ...(formData.notes && {
          note: [{
            text: formData.notes,
            time: new Date().toISOString()
          }]
        })
      };

      // Call the onSave callback with the updated medication request
      await onSave(updatedMedicationRequest);
      
      // Close dialog on success
      handleClose();
    } catch (err) {
      
      // Ensure we always set a string error message
      const errorMessage = typeof err === 'string' ? err : 
                          err?.message || 
                          err?.response?.data?.message || 
                          err?.response?.data?.detail || 
                          'Failed to update medication';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this medication? This action cannot be undone.')) {
      try {
        setLoading(true);
        await onDelete(medicationRequest.id);
        handleClose();
      } catch (err) {
        
        // Ensure we always set a string error message
        const errorMessage = typeof err === 'string' ? err : 
                            err?.message || 
                            err?.response?.data?.message || 
                            err?.response?.data?.detail || 
                            'Failed to delete medication';
        setError(errorMessage);
        setLoading(false);
      }
    }
  };

  const getFormMedicationDisplay = () => {
    if (formData.selectedMedication) {
      return formData.selectedMedication.display;
    }
    return formData.customMedication || 'No medication selected';
  };

  if (!medicationRequest) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '700px' }
        }}
      >
        <DialogTitle>
          Edit Medication
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Medication Request ID: {medicationRequest.id}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              {/* Medication Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Medication
                </Typography>
                <Autocomplete
                  options={medicationOptions}
                  getOptionLabel={(option) => option.display}
                  value={formData.selectedMedication}
                  loading={searchLoading}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  onInputChange={(event, value) => {
                    setSearchQuery(value);
                    handleSearchMedications(value);
                  }}
                  onChange={(event, newValue) => {
                    setFormData(prev => ({
                      ...prev,
                      selectedMedication: newValue,
                      customMedication: '',
                      route: newValue?.route || 'oral'
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search for medication"
                      placeholder="Type to search medications..."
                      variant="outlined"
                      fullWidth
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
                          {option.code} • Route: {option.route} • Form: {option.form || 'N/A'}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  noOptionsText={
                    searchQuery.length < 2 ? 
                    "Type at least 2 characters to search" : 
                    searchLoading ? "Searching..." : "No medications found"
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Or enter a custom medication:
                </Typography>
                <TextField
                  fullWidth
                  label="Custom Medication"
                  value={formData.customMedication}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customMedication: e.target.value,
                    selectedMedication: null
                  }))}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Status and Priority */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Status & Priority
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      status: e.target.value
                    }))}
                  >
                    {MEDICATION_STATUS.map(status => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      priority: e.target.value
                    }))}
                  >
                    {PRIORITIES.map(priority => (
                      <MenuItem key={priority.value} value={priority.value}>
                        {priority.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Dosing Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Dosing & Administration
                </Typography>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Dosage"
                  value={formData.dosage}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dosage: e.target.value
                  }))}
                  placeholder="e.g., 10 mg, 1 tablet"
                  variant="outlined"
                  required
                />
              </Grid>

              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Route</InputLabel>
                  <Select
                    value={formData.route}
                    label="Route"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      route: e.target.value
                    }))}
                  >
                    {ROUTES.map(route => (
                      <MenuItem key={route.value} value={route.value}>
                        {route.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Frequency</InputLabel>
                  <Select
                    value={formData.frequency}
                    label="Frequency"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      frequency: e.target.value
                    }))}
                  >
                    {DOSING_FREQUENCIES.map(freq => (
                      <MenuItem key={freq.value} value={freq.value}>
                        {freq.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Special Instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    instructions: e.target.value
                  }))}
                  placeholder="e.g., Take with food, Take in the morning"
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Prescription Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Prescription Details
                </Typography>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    quantity: e.target.value
                  }))}
                  placeholder="e.g., 30, 90"
                  variant="outlined"
                  required
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Refills"
                  type="number"
                  value={formData.refills}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    refills: parseInt(e.target.value) || 0
                  }))}
                  variant="outlined"
                  inputProps={{ min: 0, max: 12 }}
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Duration (days)"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    duration: e.target.value
                  }))}
                  placeholder="e.g., 30, 90"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(newValue) => setFormData(prev => ({
                    ...prev,
                    startDate: newValue
                  }))}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                />
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="End Date (Optional)"
                  value={formData.endDate}
                  onChange={(newValue) => setFormData(prev => ({
                    ...prev,
                    endDate: newValue
                  }))}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                  minDate={formData.startDate}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Indication"
                  value={formData.indication}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    indication: e.target.value
                  }))}
                  placeholder="Reason for prescription"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.genericSubstitution}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        genericSubstitution: e.target.checked
                      }))}
                    />
                  }
                  label="Allow generic substitution"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Provider Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Additional notes for pharmacy or patient..."
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {(formData.selectedMedication || formData.customMedication) && formData.dosage && (
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Updated Prescription Preview:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {getFormMedicationDisplay()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.dosage} {formData.route} {DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip 
                    label={formData.status} 
                    size="small" 
                    color={formData.status === 'active' ? 'success' : formData.status === 'cancelled' ? 'error' : 'default'}
                  />
                  <Chip label={`Qty: ${formData.quantity || 'Not specified'}`} size="small" />
                  <Chip label={`Refills: ${formData.refills}`} size="small" />
                  {formData.duration && <Chip label={`${formData.duration} days`} size="small" />}
                  <Chip 
                    label={formData.priority} 
                    size="small" 
                    color={formData.priority === 'stat' ? 'error' : formData.priority === 'urgent' ? 'warning' : 'default'}
                  />
                </Stack>
                {formData.instructions && (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                    Instructions: {formData.instructions}
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
            Delete Medication
          </Button>
          
          <Stack direction="row" spacing={1}>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={loading || ((!formData.selectedMedication && !formData.customMedication) || !formData.dosage || !formData.quantity)}
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

export default EditMedicationDialog;