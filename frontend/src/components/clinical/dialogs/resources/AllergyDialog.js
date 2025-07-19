/**
 * AllergyDialog Component
 * FHIR-compliant dialog for documenting allergies and intolerances
 * Integrates CDS hooks for medication-allergy checking and safety alerts
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
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  Divider,
  TextField,
  Autocomplete,
  useTheme,
  alpha
} from '@mui/material';
import {
  Warning as AllergyIcon,
  LocalHospital as ClinicalIcon,
  AccessTime as OnsetIcon,
  Assignment as ManifestationIcon,
  VerifiedUser as VerificationIcon,
  Medication as MedicationIcon,
  Restaurant as FoodIcon,
  Nature as EnvironmentalIcon,
  BugReport as BiologicIcon,
  ErrorOutline as CriticalIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import ClinicalDialog from '../base/ClinicalDialog';
import ClinicalTextField from '../fields/ClinicalTextField';
import ClinicalDatePicker from '../fields/ClinicalDatePicker';
import ClinicalCodeSelector from '../fields/ClinicalCodeSelector';
import CDSAlertPresenter, { ALERT_MODES } from '../../cds/CDSAlertPresenter';
import { fhirService } from '../../../../services/fhirService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { format } from 'date-fns';

// Allergy type options
const TYPE_OPTIONS = [
  { value: 'allergy', label: 'Allergy', icon: AllergyIcon, description: 'Immune-mediated reaction' },
  { value: 'intolerance', label: 'Intolerance', icon: ClinicalIcon, description: 'Non-immune mediated reaction' }
];

// Category options with icons
const CATEGORY_OPTIONS = [
  { value: 'food', label: 'Food', icon: FoodIcon },
  { value: 'medication', label: 'Medication', icon: MedicationIcon },
  { value: 'environment', label: 'Environment', icon: EnvironmentalIcon },
  { value: 'biologic', label: 'Biologic', icon: BiologicIcon }
];

// Clinical status options
const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'error' },
  { value: 'inactive', label: 'Inactive', color: 'default' },
  { value: 'resolved', label: 'Resolved', color: 'success' }
];

// Verification status options
const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed', description: 'Not yet verified' },
  { value: 'confirmed', label: 'Confirmed', description: 'Verified by testing or challenge' },
  { value: 'refuted', label: 'Refuted', description: 'Disproven by testing' },
  { value: 'entered-in-error', label: 'Entered in Error', description: 'Documentation error' }
];

// Criticality options
const CRITICALITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'success', description: 'Low risk of serious reaction' },
  { value: 'high', label: 'High', color: 'error', description: 'High risk of serious reaction' },
  { value: 'unable-to-assess', label: 'Unable to Assess', color: 'default', description: 'Risk unknown' }
];

// Common manifestations by category
const MANIFESTATION_PRESETS = {
  medication: [
    { code: '39579001', display: 'Anaphylaxis' },
    { code: '271807003', display: 'Skin rash' },
    { code: '62315008', display: 'Urticaria (hives)' },
    { code: '91175000', display: 'Angioedema' },
    { code: '49727002', display: 'Respiratory distress' },
    { code: '422587007', display: 'Nausea' },
    { code: '422400008', display: 'Vomiting' }
  ],
  food: [
    { code: '39579001', display: 'Anaphylaxis' },
    { code: '271807003', display: 'Skin rash' },
    { code: '62315008', display: 'Urticaria (hives)' },
    { code: '91175000', display: 'Angioedema' },
    { code: '23924001', display: 'Abdominal pain' },
    { code: '62315008', display: 'Diarrhea' },
    { code: '422587007', display: 'Nausea' }
  ],
  environment: [
    { code: '49727002', display: 'Respiratory distress' },
    { code: '267036007', display: 'Wheezing' },
    { code: '70076002', display: 'Rhinitis' },
    { code: '91175000', display: 'Conjunctivitis' },
    { code: '271807003', display: 'Contact dermatitis' }
  ]
};

// Severity options
const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: '#4caf50' },
  { value: 'moderate', label: 'Moderate', color: '#ff9800' },
  { value: 'severe', label: 'Severe', color: '#f44336' }
];

const AllergyDialog = ({
  open,
  onClose,
  mode = 'create',
  allergy = null,
  patient,
  onSave,
  clinicalContext = {}
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    clinicalStatus: 'active',
    verificationStatus: 'unconfirmed',
    type: 'allergy',
    category: [],
    criticality: 'low',
    code: null,
    patient: null,
    encounter: null,
    onsetDateTime: null,
    recordedDate: new Date().toISOString(),
    recorder: null,
    asserter: null,
    lastOccurrence: null,
    note: [],
    reaction: []
  });
  
  const [alerts, setAlerts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflictingMedications, setConflictingMedications] = useState([]);
  const [selectedManifestations, setSelectedManifestations] = useState([]);
  const [reactionSeverity, setReactionSeverity] = useState('moderate');

  // Initialize form data
  useEffect(() => {
    if (allergy && mode === 'edit') {
      setFormData({
        ...allergy,
        reaction: allergy.reaction || []
      });
      if (allergy.reaction?.length > 0) {
        setSelectedManifestations(allergy.reaction[0].manifestation || []);
        setReactionSeverity(allergy.reaction[0].severity || 'moderate');
      }
    }
  }, [allergy, mode]);

  // Check for medication conflicts when category includes medication
  useEffect(() => {
    if (formData.category?.includes('medication') && formData.code && patient) {
      checkMedicationConflicts();
    }
  }, [formData.category, formData.code, patient]);

  // Field change handler
  const handleFieldChange = useCallback(async (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Check CDS alerts when allergen changes
    if (field === 'code' && value) {
      checkClinicalAlerts(value);
    }
  }, []);

  // Check clinical alerts with CDS hooks
  const checkClinicalAlerts = async (allergen) => {
    if (!patient || !allergen) return;
    
    try {
      // Fire CDS hooks for allergy documentation
      const cdsResult = await clinicalCDSService.fireAllergyHooks({
        patient,
        allergy: {
          ...formData,
          code: allergen
        },
        operation: mode === 'create' ? 'create' : 'update',
        user: clinicalContext.user
      });
      
      // Update CDS alerts
      setCdsAlerts(cdsResult.alerts);
      
      // Set specific medication conflict alerts
      if (cdsResult.hasMedicationConflicts) {
        const medConflicts = cdsResult.alerts
          .filter(a => a.context === 'allergy-medication-interaction')
          .map(a => a.medications?.[0])
          .filter(Boolean);
        setConflictingMedications(medConflicts);
      }
      
      // Set form alerts based on CDS results
      if (cdsResult.hasCritical) {
        setAlerts([{
          severity: 'error',
          message: 'Critical safety alerts detected. Review before saving.'
        }]);
      }
      if (cdsResult.hasWarnings) {
        setWarnings([{
          severity: 'warning',
          message: 'Clinical warnings detected. Review recommendations below.'
        }]);
      }
    } catch (error) {
      console.error('Failed to check clinical alerts:', error);
    }
  };

  // Check for existing medication conflicts
  const checkMedicationConflicts = async () => {
    if (!patient?.id || !formData.code) return;
    
    try {
      // Get patient's current medications
      const medications = await fhirService.searchResources('MedicationRequest', {
        patient: patient.id,
        status: 'active'
      });
      
      // Simple conflict check - in production, use more sophisticated matching
      const conflicts = medications.filter(med => {
        const medName = med.medicationCodeableConcept?.text?.toLowerCase() || '';
        const allergenName = formData.code?.text?.toLowerCase() || '';
        
        // Check for exact or partial matches
        return allergenName && (
          medName.includes(allergenName) || 
          allergenName.includes(medName)
        );
      });
      
      setConflictingMedications(conflicts);
    } catch (error) {
      console.error('Failed to check medication conflicts:', error);
    }
  };

  // Add manifestation
  const handleAddManifestation = (manifestation) => {
    setSelectedManifestations(prev => {
      const exists = prev.some(m => m.code === manifestation.code);
      if (exists) return prev;
      return [...prev, manifestation];
    });
  };

  // Remove manifestation
  const handleRemoveManifestation = (code) => {
    setSelectedManifestations(prev => prev.filter(m => m.code !== code));
  };

  // Handle CDS alert actions
  const handleCDSAction = async (action, alert) => {
    console.log('CDS action:', action, alert);
    
    if (action.uuid === 'review-alternatives') {
      // Open medication alternatives
      // This would typically open another dialog or navigate
    } else if (action.uuid === 'discontinue-medication') {
      // Navigate to medication list to discontinue
      // This would typically trigger a workflow
    }
  };

  // Validation
  const handleValidate = async (data) => {
    const errors = [];
    
    if (!data.code) {
      errors.push({ field: 'code', message: 'Allergen is required' });
    }
    
    if (!data.category || data.category.length === 0) {
      errors.push({ field: 'category', message: 'At least one category is required' });
    }
    
    if (!data.type) {
      errors.push({ field: 'type', message: 'Type is required' });
    }
    
    // Warn about unconfirmed status
    const warnings = [];
    if (data.verificationStatus === 'unconfirmed') {
      warnings.push({
        field: 'verificationStatus',
        message: 'Allergy is unconfirmed. Consider verification testing.'
      });
    }
    
    // Warn about high criticality without manifestations
    if (data.criticality === 'high' && selectedManifestations.length === 0) {
      warnings.push({
        field: 'reaction',
        message: 'High criticality allergy should include reaction details.'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };

  // Save handler
  const handleSave = async (validatedData) => {
    setSaving(true);
    try {
      // Build reaction array
      const reactions = selectedManifestations.length > 0 ? [{
        substance: validatedData.code,
        manifestation: selectedManifestations.map(m => ({
          coding: [{
            system: 'http://snomed.info/sct',
            code: m.code,
            display: m.display
          }]
        })),
        severity: reactionSeverity,
        exposureRoute: validatedData.category?.includes('medication') ? {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '26643006',
            display: 'Oral route'
          }]
        } : undefined
      }] : [];
      
      // Build FHIR AllergyIntolerance resource
      const allergyResource = {
        resourceType: 'AllergyIntolerance',
        ...(allergy?.id && { id: allergy.id }),
        ...(allergy?.meta && { meta: allergy.meta }),
        
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: validatedData.clinicalStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: validatedData.verificationStatus
          }]
        },
        type: validatedData.type,
        category: validatedData.category,
        criticality: validatedData.criticality,
        code: validatedData.code,
        patient: {
          reference: `Patient/${patient.id}`,
          display: `${patient.name?.[0]?.family}, ${patient.name?.[0]?.given?.join(' ')}`
        },
        
        ...(validatedData.onsetDateTime && { onsetDateTime: validatedData.onsetDateTime }),
        recordedDate: validatedData.recordedDate,
        ...(validatedData.lastOccurrence && { lastOccurrence: validatedData.lastOccurrence }),
        
        ...(reactions.length > 0 && { reaction: reactions }),
        ...(validatedData.note?.length > 0 && { note: validatedData.note })
      };
      
      await onSave(allergyResource);
    } catch (error) {
      console.error('Failed to save allergy:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Tab panels
  const renderAllergenTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* CDS Alerts */}
        {cdsAlerts.length > 0 && (
          <CDSAlertPresenter
            alerts={cdsAlerts}
            mode={ALERT_MODES.INLINE}
            onAction={handleCDSAction}
            onDismiss={(alert) => {
              setCdsAlerts(prev => prev.filter(a => a.id !== alert.id));
            }}
            context={{
              userId: clinicalContext.user?.id,
              patientId: patient.id
            }}
            requireAcknowledgment={cdsAlerts.some(a => a.indicator === 'critical')}
          />
        )}
        
        {/* Medication conflicts warning */}
        {conflictingMedications.length > 0 && (
          <Alert severity="error">
            <AlertTitle>Active Medication Conflicts</AlertTitle>
            <Typography variant="body2" paragraph>
              The patient has active medications that may conflict with this allergy:
            </Typography>
            <List dense>
              {conflictingMedications.map((med, idx) => (
                <ListItem key={idx}>
                  <ListItemIcon>
                    <MedicationIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={med.medicationCodeableConcept?.text}
                    secondary={`Prescribed ${med.authoredOn ? 
                      format(new Date(med.authoredOn), 'MMM d, yyyy') : 
                      'Unknown date'}`}
                  />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}
        
        {/* Type selection */}
        <FormControl component="fieldset">
          <Typography variant="subtitle2" gutterBottom>
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
                control={<Radio />}
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
        
        {/* Category selection */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Category *
          </Typography>
          <Stack direction="row" spacing={1}>
            {CATEGORY_OPTIONS.map(option => {
              const Icon = option.icon;
              const isSelected = formData.category?.includes(option.value);
              
              return (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={<Icon />}
                  onClick={() => {
                    const newCategories = isSelected
                      ? formData.category.filter(c => c !== option.value)
                      : [...(formData.category || []), option.value];
                    handleFieldChange('category', newCategories);
                  }}
                  color={isSelected ? 'primary' : 'default'}
                  variant={isSelected ? 'filled' : 'outlined'}
                />
              );
            })}
          </Stack>
        </Box>
        
        {/* Allergen selection */}
        <ClinicalCodeSelector
          resource="AllergyIntolerance"
          field="code"
          label="Allergen"
          value={formData.code}
          onChange={(value) => handleFieldChange('code', value)}
          searchType={formData.category?.[0] || 'allergy'}
          required
          showFrequent
          clinicalContext={clinicalContext}
          helperText="Search for the specific allergen"
        />
        
        {/* Status fields */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Clinical Status</InputLabel>
              <Select
                value={formData.clinicalStatus}
                onChange={(e) => handleFieldChange('clinicalStatus', e.target.value)}
                label="Clinical Status"
              >
                {CLINICAL_STATUS_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    <Chip 
                      size="small" 
                      color={option.color} 
                      label={option.label}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Verification Status</InputLabel>
              <Select
                value={formData.verificationStatus}
                onChange={(e) => handleFieldChange('verificationStatus', e.target.value)}
                label="Verification Status"
              >
                {VERIFICATION_STATUS_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box>
                      <Typography variant="body2">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
        {/* Criticality */}
        <FormControl fullWidth>
          <InputLabel>Criticality</InputLabel>
          <Select
            value={formData.criticality}
            onChange={(e) => handleFieldChange('criticality', e.target.value)}
            label="Criticality"
          >
            {CRITICALITY_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    size="small" 
                    color={option.color} 
                    label={option.label}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {/* Notes */}
        <ClinicalTextField
          label="Additional Notes"
          value={formData.note?.[0]?.text || ''}
          onChange={(e) => handleFieldChange('note', [{
            text: e.target.value,
            time: new Date().toISOString()
          }])}
          multiline
          rows={2}
          enableVoiceInput
          placeholder="Any additional information about this allergy..."
        />
      </Stack>
    </Box>
  );

  const renderReactionTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        <Typography variant="subtitle2" gutterBottom>
          Reaction Details
        </Typography>
        
        {/* Onset date */}
        <ClinicalDatePicker
          label="First Occurrence"
          value={formData.onsetDateTime}
          onChange={(value) => handleFieldChange('onsetDateTime', value)}
          maxDate={new Date()}
          showRelativeTime
          helperText="When was this allergy first noticed?"
        />
        
        {/* Last occurrence */}
        <ClinicalDatePicker
          label="Last Occurrence"
          value={formData.lastOccurrence}
          onChange={(value) => handleFieldChange('lastOccurrence', value)}
          maxDate={new Date()}
          minDate={formData.onsetDateTime}
          showRelativeTime
          helperText="When was the most recent reaction?"
        />
        
        {/* Manifestations */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Manifestations
          </Typography>
          
          {/* Selected manifestations */}
          {selectedManifestations.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {selectedManifestations.map((manifestation) => (
                  <Chip
                    key={manifestation.code}
                    label={manifestation.display}
                    onDelete={() => handleRemoveManifestation(manifestation.code)}
                    color="primary"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          
          {/* Common manifestations */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Common manifestations for {formData.category?.join(', ') || 'this category'}:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {(MANIFESTATION_PRESETS[formData.category?.[0]] || MANIFESTATION_PRESETS.medication)
                .map((manifestation) => {
                  const isSelected = selectedManifestations.some(m => m.code === manifestation.code);
                  return (
                    <Chip
                      key={manifestation.code}
                      label={manifestation.display}
                      onClick={() => !isSelected && handleAddManifestation(manifestation)}
                      variant={isSelected ? 'filled' : 'outlined'}
                      disabled={isSelected}
                      size="small"
                      sx={{ mb: 1 }}
                    />
                  );
                })}
            </Stack>
          </Paper>
        </Box>
        
        {/* Severity */}
        {selectedManifestations.length > 0 && (
          <FormControl fullWidth>
            <InputLabel>Reaction Severity</InputLabel>
            <Select
              value={reactionSeverity}
              onChange={(e) => setReactionSeverity(e.target.value)}
              label="Reaction Severity"
            >
              {SEVERITY_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: option.color
                      }}
                    />
                    <span>{option.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        
        {/* Additional reaction notes */}
        <TextField
          label="Reaction Description"
          multiline
          rows={3}
          fullWidth
          placeholder="Describe the reaction in detail..."
          value={formData.reaction?.[0]?.description || ''}
          onChange={(e) => {
            const reactions = formData.reaction || [];
            reactions[0] = {
              ...reactions[0],
              description: e.target.value
            };
            handleFieldChange('reaction', reactions);
          }}
        />
      </Stack>
    </Box>
  );

  const renderSummaryTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Allergy Summary
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Allergen
              </Typography>
              <Typography variant="body1">
                {formData.code?.text || formData.code?.coding?.[0]?.display || 'Not specified'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type
              </Typography>
              <Typography variant="body1">
                {TYPE_OPTIONS.find(t => t.value === formData.type)?.label}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Category
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {formData.category?.map(cat => (
                  <Chip 
                    key={cat}
                    label={CATEGORY_OPTIONS.find(c => c.value === cat)?.label}
                    size="small"
                  />
                ))}
              </Stack>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Criticality
              </Typography>
              <Chip 
                label={CRITICALITY_OPTIONS.find(c => c.value === formData.criticality)?.label}
                color={CRITICALITY_OPTIONS.find(c => c.value === formData.criticality)?.color}
                size="small"
              />
            </Grid>
            
            {selectedManifestations.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Manifestations
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {selectedManifestations.map(m => (
                    <Chip key={m.code} label={m.display} size="small" />
                  ))}
                </Stack>
              </Grid>
            )}
          </Grid>
        </Paper>
        
        {/* Safety assessment */}
        <Alert 
          severity={
            formData.criticality === 'high' || conflictingMedications.length > 0 
              ? 'error' 
              : 'success'
          }
        >
          <AlertTitle>Safety Assessment</AlertTitle>
          {conflictingMedications.length > 0 ? (
            <Typography variant="body2">
              ⚠️ {conflictingMedications.length} active medication(s) may conflict with this allergy
            </Typography>
          ) : (
            <Typography variant="body2">
              ✓ No active medication conflicts detected
            </Typography>
          )}
          {formData.criticality === 'high' && (
            <Typography variant="body2">
              ⚠️ High criticality - ensure emergency protocols are in place
            </Typography>
          )}
        </Alert>
        
        {/* Action buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => {
              // Open allergy card/bracelet printing
              console.log('Print allergy card');
            }}
          >
            Print Allergy Card
          </Button>
          
          {formData.category?.includes('medication') && (
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                // Navigate to medication list
                console.log('Review medications');
              }}
            >
              Review Active Medications
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <ClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Document Allergy' : 'Edit Allergy'}
      subtitle="Record allergy or intolerance information"
      mode={mode}
      size="large"
      resource={formData}
      resourceType="AllergyIntolerance"
      onSave={handleSave}
      onValidate={handleValidate}
      clinicalContext={clinicalContext}
      alerts={alerts}
      warnings={warnings}
      loading={loading}
      saving={saving}
      showProgress={false}
      enableVoiceInput
      enableUndo
      autoSaveDraft
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab icon={<AllergyIcon />} label="Allergen" />
          <Tab icon={<ManifestationIcon />} label="Reaction" />
          <Tab icon={<VerificationIcon />} label="Summary" />
        </Tabs>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && renderAllergenTab()}
        {activeTab === 1 && renderReactionTab()}
        {activeTab === 2 && renderSummaryTab()}
      </Box>
    </ClinicalDialog>
  );
};

export default AllergyDialog;