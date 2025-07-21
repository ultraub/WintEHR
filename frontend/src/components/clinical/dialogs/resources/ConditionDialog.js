/**
 * ConditionDialog Component
 * FHIR-compliant dialog for creating/editing clinical conditions (problems)
 * Uses the enhanced ClinicalDialog base with progressive disclosure
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
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  useTheme,
  alpha
} from '@mui/material';
import {
  LocalHospital as DiagnosisIcon,
  Timeline as OnsetIcon,
  Assessment as SeverityIcon,
  Verified as VerificationIcon,
  LocationOn as BodySiteIcon,
  Science as EvidenceIcon,
  Link as RelatedIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import ClinicalDialog from '../base/ClinicalDialog';
import ClinicalTextField from '../fields/ClinicalTextField';
import ClinicalDatePicker from '../fields/ClinicalDatePicker';
import ClinicalCodeSelector from '../fields/ClinicalCodeSelector';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import CDSAlertPresenter, { ALERT_MODES } from '../../cds/CDSAlertPresenter';
import { format, differenceInDays } from 'date-fns';

// FHIR clinical status options
const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'error' },
  { value: 'recurrence', label: 'Recurrence', color: 'warning' },
  { value: 'relapse', label: 'Relapse', color: 'warning' },
  { value: 'inactive', label: 'Inactive', color: 'default' },
  { value: 'remission', label: 'Remission', color: 'success' },
  { value: 'resolved', label: 'Resolved', color: 'success' }
];

// FHIR verification status options
const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed', icon: '❓' },
  { value: 'provisional', label: 'Provisional', icon: '🔍' },
  { value: 'differential', label: 'Differential', icon: '🤔' },
  { value: 'confirmed', label: 'Confirmed', icon: '✅' },
  { value: 'refuted', label: 'Refuted', icon: '❌' },
  { value: 'entered-in-error', label: 'Entered in Error', icon: '⚠️' }
];

// Severity levels
const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: '#4caf50' },
  { value: 'moderate', label: 'Moderate', color: '#ff9800' },
  { value: 'severe', label: 'Severe', color: '#f44336' }
];

// Common condition templates
const CONDITION_TEMPLATES = {
  'diabetes-type2': {
    code: { 
      system: 'http://snomed.info/sct',
      code: '44054006',
      display: 'Type 2 diabetes mellitus'
    },
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: 'moderate',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: 'problem-list-item'
      }]
    }],
    note: 'Newly diagnosed based on HbA1c > 6.5%'
  },
  'hypertension': {
    code: {
      system: 'http://snomed.info/sct',
      code: '38341003',
      display: 'Essential hypertension'
    },
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: 'mild',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: 'problem-list-item'
      }]
    }]
  }
};

const ConditionDialog = ({
  open,
  onClose,
  mode = 'create',
  condition = null,
  patient,
  onSave,
  clinicalContext = {}
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    code: null,
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: null,
    onsetDateTime: null,
    onsetPeriod: null,
    abatementDateTime: null,
    recordedDate: new Date().toISOString(),
    recorder: null,
    asserter: null,
    bodySite: [],
    evidence: [],
    note: [],
    stage: null,
    relatedConditions: []
  });
  
  const [alerts, setAlerts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [relatedConditions, setRelatedConditions] = useState([]);
  const [supportingEvidence, setSupportingEvidence] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);

  // Initialize form data
  useEffect(() => {
    if (condition && mode === 'edit') {
      setFormData({
        ...condition,
        relatedConditions: condition.relatedConditions || []
      });
      loadRelatedData();
    }
  }, [condition, mode]);

  // Load related conditions and evidence
  const loadRelatedData = async () => {
    if (!patient?.id) return;
    
    try {
      // Load patient's other conditions for relationship suggestions
      const conditionsResult = await fhirClient.search('Condition', {
        patient: patient.id,
        _sort: '-onset-date'
      });
      
      setRelatedConditions((conditionsResult.resources || []).filter(c => c.id !== condition?.id));
      
      // Load recent observations as potential evidence
      const observationsResult = await fhirClient.search('Observation', {
        patient: patient.id,
        _count: 20,
        _sort: '-date'
      });
      
      setSupportingEvidence(observationsResult.resources || []);
    } catch (error) {
      console.error('Failed to load related data:', error);
    }
  };

  // Field change handler
  const handleFieldChange = useCallback(async (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Check for clinical alerts when diagnosis changes
    if (field === 'code' && value) {
      checkClinicalAlerts(value);
    }
  }, []);

  // Clinical alert checking with CDS hooks
  const checkClinicalAlerts = async (diagnosis) => {
    if (!patient || !diagnosis) return;
    
    try {
      // Fire CDS hooks for condition entry
      const cdsResult = await clinicalCDSService.fireConditionHooks({
        patient,
        condition: {
          ...formData,
          code: diagnosis
        },
        operation: mode === 'create' ? 'create' : 'update',
        user: clinicalContext.user
      });
      
      // Update CDS alerts
      setCdsAlerts(cdsResult.alerts);
      
      // Set form alerts and warnings based on CDS results
      if (cdsResult.hasCritical) {
        setAlerts([{
          severity: 'error',
          message: 'Critical alerts detected. Please review CDS recommendations.'
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

  // Add evidence
  const handleAddEvidence = (observation) => {
    setFormData(prev => ({
      ...prev,
      evidence: [...(prev.evidence || []), {
        code: [{
          coding: observation.code.coding
        }],
        detail: [{
          reference: `Observation/${observation.id}`,
          display: observation.code.text || observation.code.coding[0]?.display
        }]
      }]
    }));
  };

  // Remove evidence
  const handleRemoveEvidence = (index) => {
    setFormData(prev => ({
      ...prev,
      evidence: prev.evidence.filter((_, i) => i !== index)
    }));
  };

  // Add related condition
  const handleAddRelatedCondition = (relatedCondition, relationship) => {
    setFormData(prev => ({
      ...prev,
      relatedConditions: [...prev.relatedConditions, {
        target: {
          reference: `Condition/${relatedCondition.id}`,
          display: relatedCondition.code?.text || relatedCondition.code?.coding?.[0]?.display
        },
        relationship: relationship
      }]
    }));
  };

  // Validation
  const handleValidate = async (data) => {
    const errors = [];
    
    if (!data.code) {
      errors.push({ field: 'code', message: 'Diagnosis is required' });
    }
    
    if (!data.clinicalStatus) {
      errors.push({ field: 'clinicalStatus', message: 'Clinical status is required' });
    }
    
    if (!data.verificationStatus) {
      errors.push({ field: 'verificationStatus', message: 'Verification status is required' });
    }
    
    // Check for duplicate active conditions
    if (data.clinicalStatus === 'active' && mode === 'create') {
      const existingConditionsResult = await fhirClient.search('Condition', {
        patient: patient.id,
        code: data.code?.code,
        'clinical-status': 'active'
      });
      
      if (existingConditionsResult.resources && existingConditionsResult.resources.length > 0) {
        return {
          valid: false,
          warnings: [{
            field: 'code',
            message: 'Patient already has an active condition with this diagnosis'
          }]
        };
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.map(w => ({ field: 'general', message: w.message }))
    };
  };

  // Save handler
  const handleSave = async (validatedData) => {
    setSaving(true);
    try {
      // Build FHIR Condition resource
      const conditionResource = {
        resourceType: 'Condition',
        ...(condition?.id && { id: condition.id }),
        ...(condition?.meta && { meta: condition.meta }),
        
        // Core fields
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: validatedData.clinicalStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: validatedData.verificationStatus
          }]
        },
        ...(validatedData.severity && {
          severity: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: validatedData.severity,
              display: SEVERITY_OPTIONS.find(s => s.value === validatedData.severity)?.label
            }]
          }
        }),
        code: validatedData.code,
        subject: {
          reference: `Patient/${patient.id}`,
          display: `${patient.name?.[0]?.family}, ${patient.name?.[0]?.given?.join(' ')}`
        },
        
        // Onset/abatement
        ...(validatedData.onsetDateTime && { onsetDateTime: validatedData.onsetDateTime }),
        ...(validatedData.abatementDateTime && { abatementDateTime: validatedData.abatementDateTime }),
        
        // Additional fields
        recordedDate: validatedData.recordedDate,
        ...(validatedData.bodySite?.length > 0 && { bodySite: validatedData.bodySite }),
        ...(validatedData.evidence?.length > 0 && { evidence: validatedData.evidence }),
        ...(validatedData.note?.length > 0 && { note: validatedData.note }),
        
        // Extensions for related conditions
        ...(validatedData.relatedConditions?.length > 0 && {
          extension: validatedData.relatedConditions.map(rel => ({
            url: 'http://hl7.org/fhir/StructureDefinition/condition-related',
            valueReference: rel.target
          }))
        })
      };
      
      await onSave(conditionResource);
    } catch (error) {
      console.error('Failed to save condition:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Handle CDS alert actions
  const handleCDSAction = async (action, alert) => {
    console.log('CDS action:', action, alert);
    
    // Handle different action types
    if (action.uuid === 'review-alternatives') {
      // Open alternative suggestions
      // This would typically open another dialog or navigate to a specific view
    } else if (action.uuid === 'review-guidelines') {
      // Open clinical guidelines
      if (action.resource?.url) {
        window.open(action.resource.url, '_blank');
      }
    }
  };

  // Tab panels
  const renderEssentialTab = () => (
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
            allowSnooze={true}
            requireAcknowledgment={cdsAlerts.some(a => a.indicator === 'critical')}
          />
        )}
        {/* Diagnosis */}
        <ClinicalCodeSelector
          resource="Condition"
          field="code"
          label="Diagnosis"
          value={formData.code}
          onChange={(value) => handleFieldChange('code', value)}
          searchType="diagnosis"
          required
          showFrequent
          showTemplates
          templates={CONDITION_TEMPLATES}
          clinicalContext={clinicalContext}
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
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        size="small" 
                        color={option.color} 
                        label={option.label}
                      />
                    </Stack>
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
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
        {/* Onset and severity */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <ClinicalDatePicker
              label="Onset Date"
              value={formData.onsetDateTime}
              onChange={(value) => handleFieldChange('onsetDateTime', value)}
              maxDate={new Date()}
              showRelativeTime
              helperText="When did this condition start?"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={formData.severity || ''}
                onChange={(e) => handleFieldChange('severity', e.target.value)}
                label="Severity"
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
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
          </Grid>
        </Grid>
        
        {/* Clinical notes */}
        <ClinicalTextField
          label="Clinical Notes"
          value={formData.note?.[0]?.text || ''}
          onChange={(e) => handleFieldChange('note', [{
            text: e.target.value,
            time: new Date().toISOString()
          }])}
          multiline
          rows={3}
          enableVoiceInput
          placeholder="Additional clinical details about this condition..."
        />
      </Stack>
    </Box>
  );

  const renderClinicalTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Body site */}
        <ClinicalCodeSelector
          resource="BodyStructure"
          field="bodySite"
          label="Body Site"
          value={formData.bodySite?.[0]}
          onChange={(value) => handleFieldChange('bodySite', [value])}
          searchType="body-site"
          multiple
          helperText="Anatomical location affected by this condition"
        />
        
        {/* Stage */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Disease Stage
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Stage information can be added for conditions like cancer
            </Typography>
          </Paper>
        </Box>
        
        {/* Abatement */}
        {formData.clinicalStatus !== 'active' && (
          <ClinicalDatePicker
            label="Resolution Date"
            value={formData.abatementDateTime}
            onChange={(value) => handleFieldChange('abatementDateTime', value)}
            minDate={formData.onsetDateTime}
            maxDate={new Date()}
            helperText="When was this condition resolved?"
          />
        )}
      </Stack>
    </Box>
  );

  const renderEvidenceTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Current evidence */}
        {formData.evidence?.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Supporting Evidence
            </Typography>
            <List dense>
              {formData.evidence.map((evidence, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemoveEvidence(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <EvidenceIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={evidence.detail?.[0]?.display}
                    secondary={`Evidence ${index + 1}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {/* Available evidence */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Add Supporting Evidence
          </Typography>
          <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List>
              {supportingEvidence.map((obs) => {
                const isAdded = formData.evidence?.some(
                  e => e.detail?.[0]?.reference === `Observation/${obs.id}`
                );
                
                return (
                  <ListItem
                    key={obs.id}
                    button
                    disabled={isAdded}
                    onClick={() => !isAdded && handleAddEvidence(obs)}
                  >
                    <ListItemIcon>
                      <Science color={isAdded ? 'disabled' : 'primary'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={obs.code?.text || obs.code?.coding?.[0]?.display}
                      secondary={
                        <Stack spacing={0.5}>
                          <Typography variant="caption">
                            {obs.valueQuantity 
                              ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`
                              : obs.valueCodeableConcept?.text
                            }
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {obs.effectiveDateTime && 
                              format(new Date(obs.effectiveDateTime), 'MMM d, yyyy')
                            }
                          </Typography>
                        </Stack>
                      }
                    />
                    {isAdded && (
                      <Chip label="Added" size="small" color="success" />
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );

  const renderRelationshipsTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Current relationships */}
        {formData.relatedConditions?.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Related Conditions
            </Typography>
            <List dense>
              {formData.relatedConditions.map((rel, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <Link />
                  </ListItemIcon>
                  <ListItemText
                    primary={rel.target.display}
                    secondary={rel.relationship}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {/* Suggested relationships */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Suggested Related Conditions
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            These conditions may be related based on clinical guidelines
          </Alert>
          <List>
            {relatedConditions
              .filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active')
              .slice(0, 5)
              .map((condition) => (
                <ListItem
                  key={condition.id}
                  button
                  onClick={() => handleAddRelatedCondition(condition, 'related-to')}
                >
                  <ListItemIcon>
                    <LocalHospital />
                  </ListItemIcon>
                  <ListItemText
                    primary={condition.code?.text || condition.code?.coding?.[0]?.display}
                    secondary={`Since ${condition.onsetDateTime ? 
                      format(new Date(condition.onsetDateTime), 'MMM yyyy') : 
                      'Unknown'
                    }`}
                  />
                </ListItem>
              ))
            }
          </List>
        </Box>
      </Stack>
    </Box>
  );

  return (
    <ClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add Problem' : 'Edit Problem'}
      subtitle="Document a clinical condition or diagnosis"
      mode={mode}
      size="large"
      resource={formData}
      resourceType="Condition"
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
          <Tab icon={<DiagnosisIcon />} label="Essential" />
          <Tab icon={<Assessment />} label="Clinical Details" />
          <Tab icon={<EvidenceIcon />} label="Evidence" />
          <Tab icon={<Link />} label="Relationships" />
        </Tabs>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && renderEssentialTab()}
        {activeTab === 1 && renderClinicalTab()}
        {activeTab === 2 && renderEvidenceTab()}
        {activeTab === 3 && renderRelationshipsTab()}
      </Box>
    </ClinicalDialog>
  );
};

export default ConditionDialog;