/**
 * AllergyDialog Component
 * FHIR-compliant dialog for documenting allergies and intolerances
 * Integrates CDS hooks for medication-allergy checking and safety alerts
 * 
 * Updated 2025-01-21: Simplified UI with reduced icons and new fhirClient
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  TextField,
  Paper,
  Button,
  Autocomplete,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormGroup,
  Checkbox,
  useTheme
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import SimplifiedClinicalDialog from '../../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../../services/notificationService';
import { getClinicalCatalog } from '../../../../services/cdsClinicalDataService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { format, parseISO } from 'date-fns';
import type { AllergyIntolerance } from '../../../../core/fhir/types';

// Allergy type options
const TYPE_OPTIONS = [
  { value: 'allergy', label: 'Allergy', description: 'Immune-mediated reaction' },
  { value: 'intolerance', label: 'Intolerance', description: 'Non-immune mediated reaction' }
];

// Category options
const CATEGORY_OPTIONS = [
  { value: 'food', label: 'Food' },
  { value: 'medication', label: 'Medication' },
  { value: 'environment', label: 'Environment' },
  { value: 'biologic', label: 'Biologic' }
];

// Clinical status options
const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'resolved', label: 'Resolved' }
];

// Verification status options
const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'refuted', label: 'Refuted' },
  { value: 'entered-in-error', label: 'Entered in Error' }
];

// Criticality options
const CRITICALITY_OPTIONS = [
  { value: 'low', label: 'Low Risk' },
  { value: 'high', label: 'High Risk' },
  { value: 'unable-to-assess', label: 'Unable to Assess' }
];

// Common manifestations by category
const MANIFESTATION_OPTIONS = {
  food: [
    { code: '39579001', display: 'Anaphylaxis' },
    { code: '402387002', display: 'Allergic angioedema' },
    { code: '62315008', display: 'Diarrhea' },
    { code: '422587007', display: 'Nausea' },
    { code: '422400008', display: 'Vomiting' },
    { code: '247472004', display: 'Hives' },
    { code: '271807003', display: 'Rash' },
    { code: '267036007', display: 'Dyspnea' }
  ],
  medication: [
    { code: '39579001', display: 'Anaphylaxis' },
    { code: '126485001', display: 'Urticaria' },
    { code: '271807003', display: 'Rash' },
    { code: '62315008', display: 'Diarrhea' },
    { code: '25064002', display: 'Headache' },
    { code: '267036007', display: 'Dyspnea' },
    { code: '73879007', display: 'Hypotension' }
  ],
  environment: [
    { code: '21626009', display: 'Allergic rhinitis' },
    { code: '195967001', display: 'Asthma' },
    { code: '24079001', display: 'Atopic dermatitis' },
    { code: '126485001', display: 'Urticaria' },
    { code: '267036007', display: 'Dyspnea' },
    { code: '49727002', display: 'Cough' }
  ],
  biologic: [
    { code: '39579001', display: 'Anaphylaxis' },
    { code: '402387002', display: 'Allergic angioedema' },
    { code: '126485001', display: 'Urticaria' },
    { code: '73879007', display: 'Hypotension' },
    { code: '267036007', display: 'Dyspnea' }
  ]
};

const AllergyDialog = ({
  open,
  onClose,
  mode = 'create',
  allergy = null,
  patient,
  onSave,
  encounterId = null
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allergenCatalog, setAllergenCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    type: 'allergy',
    category: '',
    allergen: null,
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    criticality: 'low',
    manifestations: [],
    onsetDate: '',
    lastOccurrence: '',
    notes: ''
  });

  // Load allergen catalog based on category
  useEffect(() => {
    const loadCatalog = async () => {
      if (!formData.category || !open) return;

      try {
        setLoading(true);
        const catalogType = formData.category === 'medication' ? 'medications' : 
                           formData.category === 'food' ? 'allergens' : 
                           'allergens';
        const catalog = await getClinicalCatalog(catalogType);
        setAllergenCatalog(catalog.items || []);
      } catch (error) {
        console.error('Failed to load allergen catalog:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [formData.category, open]);

  // Initialize form for edit mode
  useEffect(() => {
    if (allergy && mode === 'edit') {
      setFormData({
        type: allergy.type || 'allergy',
        category: allergy.category?.[0] || '',
        allergen: {
          code: allergy.code?.coding?.[0]?.code,
          system: allergy.code?.coding?.[0]?.system,
          display: allergy.code?.text || allergy.code?.coding?.[0]?.display
        },
        clinicalStatus: allergy.clinicalStatus?.coding?.[0]?.code || 'active',
        verificationStatus: allergy.verificationStatus?.coding?.[0]?.code || 'confirmed',
        criticality: allergy.criticality || 'low',
        manifestations: allergy.reaction?.[0]?.manifestation?.map(m => ({
          code: m.coding?.[0]?.code,
          display: m.text || m.coding?.[0]?.display
        })) || [],
        onsetDate: allergy.onsetDateTime ? 
          format(parseISO(allergy.onsetDateTime), 'yyyy-MM-dd') : '',
        lastOccurrence: allergy.lastOccurrence ? 
          format(parseISO(allergy.lastOccurrence), 'yyyy-MM-dd') : '',
        notes: allergy.note?.[0]?.text || ''
      });
    }
  }, [allergy, mode]);

  // Check for CDS alerts when allergen changes
  useEffect(() => {
    const checkAllergyAlerts = async () => {
      if (!formData.allergen || !patient || formData.category !== 'medication') return;

      try {
        const cdsResult = await clinicalCDSService.fireAllergyHooks({
          patient,
          allergy: {
            code: {
              coding: [{
                code: formData.allergen.code,
                display: formData.allergen.display
              }]
            },
            category: ['medication']
          },
          operation: 'create'
        });

        if (cdsResult.alerts && cdsResult.alerts.length > 0) {
          setCdsAlerts(cdsResult.alerts);
        }
      } catch (error) {
        console.error('Failed to check allergy alerts:', error);
      }
    };

    checkAllergyAlerts();
  }, [formData.allergen, formData.category, patient]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleManifestationToggle = (manifestation) => {
    setFormData(prev => ({
      ...prev,
      manifestations: prev.manifestations.find(m => m.code === manifestation.code)
        ? prev.manifestations.filter(m => m.code !== manifestation.code)
        : [...prev.manifestations, manifestation]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setAlerts([]);

      // Validate required fields
      if (!formData.category) {
        setAlerts([{ severity: 'error', message: 'Please select a category' }]);
        return;
      }

      if (!formData.allergen) {
        setAlerts([{ severity: 'error', message: 'Please select an allergen' }]);
        return;
      }

      if (formData.manifestations.length === 0) {
        setAlerts([{ severity: 'error', message: 'Please select at least one manifestation' }]);
        return;
      }

      // Build FHIR AllergyIntolerance resource
      const allergyResource: Partial<AllergyIntolerance> = {
        resourceType: 'AllergyIntolerance',
        type: formData.type as 'allergy' | 'intolerance',
        category: [formData.category as any],
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: formData.clinicalStatus,
            display: CLINICAL_STATUS_OPTIONS.find(opt => opt.value === formData.clinicalStatus)?.label
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: formData.verificationStatus,
            display: VERIFICATION_STATUS_OPTIONS.find(opt => opt.value === formData.verificationStatus)?.label
          }]
        },
        criticality: formData.criticality as any,
        code: {
          coding: [{
            system: formData.allergen.system || 'http://snomed.info/sct',
            code: formData.allergen.code,
            display: formData.allergen.display
          }],
          text: formData.allergen.display
        },
        patient: {
          reference: `Patient/${patient.id}`,
          display: patient.name?.[0]?.given?.join(' ') + ' ' + patient.name?.[0]?.family
        },
        recordedDate: new Date().toISOString()
      };

      // Add reaction/manifestations
      if (formData.manifestations.length > 0) {
        allergyResource.reaction = [{
          manifestation: formData.manifestations.map(m => ({
            coding: [{
              system: 'http://snomed.info/sct',
              code: m.code,
              display: m.display
            }],
            text: m.display
          }))
        }];
      }

      // Add optional fields
      if (formData.onsetDate) {
        allergyResource.onsetDateTime = new Date(formData.onsetDate).toISOString();
      }

      if (formData.lastOccurrence) {
        allergyResource.lastOccurrence = new Date(formData.lastOccurrence).toISOString();
      }

      if (formData.notes) {
        allergyResource.note = [{
          text: formData.notes,
          time: new Date().toISOString()
        }];
      }

      if (encounterId) {
        allergyResource.encounter = {
          reference: `Encounter/${encounterId}`
        };
      }

      // Save allergy
      let result;
      if (mode === 'edit' && allergy?.id) {
        result = await fhirClient.update('AllergyIntolerance', allergy.id, {
          ...allergyResource,
          id: allergy.id
        } as AllergyIntolerance);
        notificationService.fhirSuccess('Updated', 'AllergyIntolerance', allergy.id);
      } else {
        result = await fhirClient.create('AllergyIntolerance', allergyResource);
        notificationService.fhirSuccess('Created', 'AllergyIntolerance', result.id);
      }

      // Call parent callback
      if (onSave) {
        onSave(result);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save allergy:', error);
      notificationService.fhirError(error, {
        operation: mode === 'edit' ? 'UPDATE' : 'CREATE',
        resourceType: 'AllergyIntolerance'
      });
      setAlerts([{ 
        severity: 'error', 
        message: 'Failed to save allergy. Please try again.' 
      }]);
    } finally {
      setSaving(false);
    }
  };

  // Convert CDS alerts to dialog alerts
  const dialogAlerts = [
    ...alerts,
    ...cdsAlerts.map(alert => ({
      severity: alert.indicator === 'critical' ? 'error' : 
                alert.indicator === 'warning' ? 'warning' : 'info',
      message: alert.summary
    }))
  ];

  // Get criticality color
  const getCriticalityColor = (criticality) => {
    switch (criticality) {
      case 'high':
        return theme.palette.error.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Allergy' : 'Add Allergy'}
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="allergy"
      loading={loading}
      alerts={dialogAlerts}
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'outlined'
        },
        {
          label: mode === 'edit' ? 'Update' : 'Add',
          onClick: handleSave,
          variant: 'contained',
          color: 'primary',
          disabled: saving || !formData.allergen || formData.manifestations.length === 0
        }
      ]}
    >
      <Stack spacing={3}>
        {/* Type and Category Selection */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Allergy Type & Category
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl component="fieldset" size="small">
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Type
                </Typography>
                <RadioGroup
                  row
                  value={formData.type}
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                >
                  {TYPE_OPTIONS.map(option => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio size="small" />}
                      label={
                        <Box>
                          <Typography variant="body2">{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => {
                    handleFieldChange('category', e.target.value);
                    handleFieldChange('allergen', null); // Reset allergen when category changes
                  }}
                  label="Category"
                >
                  {CATEGORY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Allergen Selection */}
        {formData.category && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Allergen
            </Typography>
            <Autocomplete
              options={allergenCatalog}
              getOptionLabel={(option) => option.display || option.name || ''}
              value={formData.allergen}
              onChange={(event, newValue) => handleFieldChange('allergen', newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`${formData.category.charAt(0).toUpperCase() + formData.category.slice(1)} Allergen`}
                  placeholder={`Search ${formData.category} allergens...`}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Stack>
                    <Typography variant="body2">{option.display || option.name}</Typography>
                    {option.code && (
                      <Typography variant="caption" color="text.secondary">
                        {option.code}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
            />
          </Paper>
        )}

        {/* Status and Criticality */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Status & Risk Assessment
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Clinical Status</InputLabel>
                <Select
                  value={formData.clinicalStatus}
                  onChange={(e) => handleFieldChange('clinicalStatus', e.target.value)}
                  label="Clinical Status"
                >
                  {CLINICAL_STATUS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Verification</InputLabel>
                <Select
                  value={formData.verificationStatus}
                  onChange={(e) => handleFieldChange('verificationStatus', e.target.value)}
                  label="Verification"
                >
                  {VERIFICATION_STATUS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Criticality</InputLabel>
                <Select
                  value={formData.criticality}
                  onChange={(e) => handleFieldChange('criticality', e.target.value)}
                  label="Criticality"
                >
                  {CRITICALITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: getCriticalityColor(option.value)
                          }}
                        />
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Manifestations */}
        {formData.category && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Reaction Manifestations *
            </Typography>
            <FormGroup>
              <Grid container spacing={1}>
                {MANIFESTATION_OPTIONS[formData.category]?.map(manifestation => (
                  <Grid item xs={6} key={manifestation.code}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={formData.manifestations.some(m => m.code === manifestation.code)}
                          onChange={() => handleManifestationToggle(manifestation)}
                        />
                      }
                      label={manifestation.display}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>
          </Paper>
        )}

        {/* Dates */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Timeline
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Onset Date"
                type="date"
                value={formData.onsetDate}
                onChange={(e) => handleFieldChange('onsetDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Occurrence"
                type="date"
                value={formData.lastOccurrence}
                onChange={(e) => handleFieldChange('lastOccurrence', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Notes */}
        <TextField
          label="Additional Notes"
          value={formData.notes}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          fullWidth
          multiline
          rows={3}
          size="small"
          placeholder="Additional notes about this allergy..."
        />
      </Stack>
    </SimplifiedClinicalDialog>
  );
};

export default AllergyDialog;