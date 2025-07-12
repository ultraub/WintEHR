/**
 * Prescribe Medication Dialog Component
 * Allows prescribing new medications to patient
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
import { format } from 'date-fns';
import { searchService } from '../../../../services/searchService';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';

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

const PrescribeMedicationDialog = ({ open, onClose, onPrescribe, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [medicationOptions, setMedicationOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [cdsLoading, setCdsLoading] = useState(false);
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
    genericSubstitution: true,
    notes: ''
  });

  // Trigger CDS hooks when medication selection changes
  useEffect(() => {
    if (formData.selectedMedication) {
      checkCDSHooks(formData.selectedMedication);
    } else if (formData.customMedication && formData.customMedication.length > 2) {
      checkCDSHooks({ display: formData.customMedication, name: formData.customMedication });
    } else {
      setCdsAlerts([]);
    }
  }, [formData.selectedMedication, formData.customMedication, patientId]);

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

  // Check for CDS alerts when medication selection changes
  const checkCDSHooks = async (medication) => {
    if (!medication || !patientId) {
      setCdsAlerts([]);
      return;
    }

    setCdsLoading(true);
    try {
      // Get available medication-prescribe services
      const services = await cdsHooksClient.discoverServices();
      const medicationServices = services.filter(s => s.hook === 'medication-prescribe');
      
      const allAlerts = [];
      
      for (const service of medicationServices) {
        try {
          const response = await cdsHooksClient.callService(service.id, {
            hook: 'medication-prescribe',
            hookInstance: `prescribe-${Date.now()}`,
            context: {
              patientId: patientId,
              medications: {
                new: [{
                  resourceType: 'MedicationRequest',
                  medication: {
                    concept: {
                      text: medication.display || medication.name,
                      coding: medication.coding || []
                    }
                  }
                }]
              }
            }
          });
          
          if (response.cards) {
            allAlerts.push(...response.cards.map(card => ({
              ...card,
              serviceId: service.id,
              serviceName: service.title || service.id,
              timestamp: new Date()
            })));
          }
        } catch (serviceError) {
          
        }
      }
      
      setCdsAlerts(allAlerts);
    } catch (error) {
      
    } finally {
      setCdsLoading(false);
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
      genericSubstitution: true,
      notes: ''
    });
    setError('');
    setMedicationOptions([]);
    setSearchQuery('');
    setCdsAlerts([]);
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

      // Trigger final CDS hooks check before creating prescription
      await checkCDSHooks(formData.selectedMedication || { display: formData.customMedication, name: formData.customMedication });

      // Check for critical alerts that should block prescription
      const criticalAlerts = cdsAlerts.filter(alert => alert.indicator === 'critical');
      if (criticalAlerts.length > 0) {
        const shouldProceed = window.confirm(
          `⚠️ Critical Safety Alert!\n\n${criticalAlerts.map(alert => alert.summary).join('\n\n')}\n\nDo you want to proceed with this prescription anyway?`
        );
        if (!shouldProceed) {
          setLoading(false);
          return;
        }
      }

      // Create FHIR MedicationRequest resource
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        id: `medication-request-${Date.now()}`,
        status: 'active',
        intent: 'order',
        priority: formData.priority,
        medication: {
          concept: formData.selectedMedication ? {
            coding: [{
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: formData.selectedMedication.code.replace('RxNorm:', ''),
              display: formData.selectedMedication.display
            }],
            text: formData.selectedMedication.display
          } : {
            text: formData.customMedication
          }
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        authoredOn: new Date().toISOString(),
        dosageInstruction: [{
          text: formData.instructions || `${formData.dosage} ${formData.frequency}`,
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

      // Call the onPrescribe callback with the new medication request
      await onPrescribe(medicationRequest);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to prescribe medication');
    } finally {
      setLoading(false);
    }
  };

  const getMedicationDisplay = () => {
    if (formData.selectedMedication) {
      return formData.selectedMedication.display;
    }
    return formData.customMedication || 'No medication selected';
  };

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
        <DialogTitle>Prescribe Medication</DialogTitle>
        
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
                    // Check CDS hooks when medication is selected
                    if (newValue) {
                      checkCDSHooks(newValue);
                    } else {
                      setCdsAlerts([]);
                    }
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

              {/* CDS Alerts */}
              {(cdsLoading || cdsAlerts.length > 0) && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Clinical Decision Support
                  </Typography>
                  {cdsLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Checking for drug interactions and alerts...
                      </Typography>
                    </Box>
                  )}
                  {cdsAlerts.map((alert, index) => (
                    <Alert 
                      key={index}
                      severity={alert.indicator === 'critical' ? 'error' : alert.indicator === 'warning' ? 'warning' : 'info'}
                      sx={{ mb: 1 }}
                      action={
                        alert.suggestions && alert.suggestions.length > 0 && (
                          <Button size="small" variant="outlined">
                            View Actions
                          </Button>
                        )
                      }
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        {alert.summary}
                      </Typography>
                      <Typography variant="body2">
                        {alert.detail}
                      </Typography>
                      {alert.suggestions && alert.suggestions.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Suggested actions available
                          </Typography>
                        </Box>
                      )}
                    </Alert>
                  ))}
                </Grid>
              )}

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
                    <MenuItem value="routine">Routine</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                    <MenuItem value="asap">ASAP</MenuItem>
                    <MenuItem value="stat">STAT</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
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
                  Prescription Preview:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {getMedicationDisplay()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.dosage} {formData.route} {DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
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

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || ((!formData.selectedMedication && !formData.customMedication) || !formData.dosage || !formData.quantity)}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Prescribing...' : 'Prescribe'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default PrescribeMedicationDialog;