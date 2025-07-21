/**
 * MedicationDialog Component
 * FHIR-compliant dialog for prescribing medications
 * Integrates CDS hooks for drug interactions, dosing guidance, and safety checks
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
  CircularProgress,
  TextField,
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
  Button,
  Divider,
  LinearProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Medication as MedicationIcon,
  LocalPharmacy as PharmacyIcon,
  Science as LabIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Print as PrintIcon,
  Send as SendIcon,
  History as HistoryIcon,
  Favorite as FavoriteIcon,
  Security as SafetyIcon
} from '@mui/icons-material';
import ClinicalDialog from '../base/ClinicalDialog';
import ClinicalTextField from '../fields/ClinicalTextField';
import ClinicalDatePicker from '../fields/ClinicalDatePicker';
import ClinicalCodeSelector from '../fields/ClinicalCodeSelector';
import DosageBuilder from '../fields/DosageBuilder';
import CDSAlertPresenter, { ALERT_MODES } from '../../cds/CDSAlertPresenter';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { medicationService } from '../../../../services/medicationService';
import { addDays, format } from 'date-fns';

// Medication status options
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
  { value: 'cancelled', label: 'Cancelled', color: 'error' },
  { value: 'completed', label: 'Completed', color: 'default' },
  { value: 'entered-in-error', label: 'Entered in Error', color: 'error' },
  { value: 'stopped', label: 'Stopped', color: 'error' },
  { value: 'draft', label: 'Draft', color: 'info' },
  { value: 'unknown', label: 'Unknown', color: 'default' }
];

// Intent options
const INTENT_OPTIONS = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'plan', label: 'Plan' },
  { value: 'order', label: 'Order' },
  { value: 'original-order', label: 'Original Order' },
  { value: 'reflex-order', label: 'Reflex Order' },
  { value: 'filler-order', label: 'Filler Order' },
  { value: 'instance-order', label: 'Instance Order' },
  { value: 'option', label: 'Option' }
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'default' },
  { value: 'urgent', label: 'Urgent', color: 'warning' },
  { value: 'asap', label: 'ASAP', color: 'error' },
  { value: 'stat', label: 'STAT', color: 'error' }
];

const MedicationDialog = ({
  open,
  onClose,
  mode = 'prescribe',
  medication = null,
  patient,
  onSave,
  onSendToPharmacy,
  clinicalContext = {}
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    status: 'active',
    intent: 'order',
    priority: 'routine',
    medicationCodeableConcept: null,
    authoredOn: new Date().toISOString(),
    requester: null,
    dosageInstruction: {},
    dispenseRequest: {
      quantity: null,
      expectedSupplyDuration: null,
      numberOfRepeatsAllowed: 0,
      validityPeriod: {
        start: new Date().toISOString(),
        end: null
      }
    },
    substitution: {
      allowedBoolean: true,
      reason: null
    },
    priorPrescription: null,
    note: [],
    reasonCode: [],
    reasonReference: []
  });
  
  const [alerts, setAlerts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [recentMedications, setRecentMedications] = useState([]);
  const [interactions, setInteractions] = useState([]);

  // Initialize form data
  useEffect(() => {
    if (medication && mode === 'edit') {
      setFormData(medication);
    }
    loadMedicationData();
  }, [medication, mode]);

  // Load favorites and recent medications
  const loadMedicationData = async () => {
    try {
      // Load provider's favorite medications
      const favs = await medicationService.getFavoriteMedications(clinicalContext.user?.id);
      setFavorites(favs);
      
      // Load recent prescriptions
      const recent = await medicationService.getRecentPrescriptions(clinicalContext.user?.id);
      setRecentMedications(recent);
    } catch (error) {
      console.error('Failed to load medication data:', error);
    }
  };

  // Field change handler
  const handleFieldChange = useCallback(async (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Check for drug interactions when medication changes
    if (field === 'medicationCodeableConcept' && value) {
      checkDrugInteractions(value);
    }
  }, []);

  // Check drug interactions and fire CDS hooks
  const checkDrugInteractions = async (medicationCode) => {
    if (!patient || !medicationCode) return;
    
    setChecking(true);
    try {
      // Get patient's current medications
      const currentMeds = clinicalContext.medications || [];
      
      // Fire CDS hooks for medication prescribing
      const cdsResult = await clinicalCDSService.fireMedicationHooks({
        patient,
        medications: [{
          ...formData,
          medicationCodeableConcept: medicationCode
        }],
        operation: 'prescribe',
        user: clinicalContext.user
      });
      
      // Update CDS alerts
      setCdsAlerts(cdsResult.alerts);
      
      // Set specific interaction alerts
      if (cdsResult.hasInteractions) {
        setInteractions(cdsResult.alerts.filter(a => 
          a.summary?.toLowerCase().includes('interaction')
        ));
      }
      
      // Set form alerts based on CDS results
      if (cdsResult.hasCritical) {
        setAlerts([{
          severity: 'error',
          message: 'Critical drug safety alerts detected. Review before prescribing.'
        }]);
      }
      if (cdsResult.hasWarnings) {
        setWarnings([{
          severity: 'warning',
          message: 'Clinical warnings detected. Review recommendations below.'
        }]);
      }
    } catch (error) {
      console.error('Failed to check drug interactions:', error);
    } finally {
      setChecking(false);
    }
  };

  // Handle dosage change
  const handleDosageChange = (dosage) => {
    setFormData(prev => ({
      ...prev,
      dosageInstruction: [{
        text: `${dosage.dose} ${dosage.unit} ${dosage.route} ${dosage.frequency}`,
        timing: {
          repeat: {
            frequency: dosage.frequency,
            period: 1,
            periodUnit: 'd'
          }
        },
        route: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: dosage.route,
            display: dosage.route
          }]
        },
        doseAndRate: [{
          doseQuantity: {
            value: parseFloat(dosage.dose),
            unit: dosage.unit,
            system: 'http://unitsofmeasure.org',
            code: dosage.unit
          }
        }],
        additionalInstruction: dosage.instructions ? [{
          text: dosage.instructions
        }] : []
      }],
      dispenseRequest: {
        ...prev.dispenseRequest,
        expectedSupplyDuration: dosage.duration ? {
          value: parseFloat(dosage.duration),
          unit: dosage.durationUnit,
          system: 'http://unitsofmeasure.org',
          code: dosage.durationUnit
        } : null
      }
    }));
  };

  // Handle CDS alert actions
  const handleCDSAction = async (action, alert) => {
    console.log('CDS action:', action, alert);
    
    if (action.uuid === 'adjust-dosage') {
      // Switch to dosage tab
      setActiveTab(1);
    } else if (action.uuid === 'find-alternative') {
      // Open alternative medication search
      // This would typically open another dialog
    } else if (action.uuid === 'review-interaction') {
      // Open interaction details
      if (action.resource?.url) {
        window.open(action.resource.url, '_blank');
      }
    }
  };

  // Add to favorites
  const handleAddToFavorites = async () => {
    if (formData.medicationCodeableConcept) {
      await medicationService.addToFavorites(
        clinicalContext.user?.id,
        formData.medicationCodeableConcept
      );
      loadMedicationData();
    }
  };

  // Use favorite medication
  const handleUseFavorite = (favorite) => {
    setFormData(prev => ({
      ...prev,
      medicationCodeableConcept: favorite.medication,
      dosageInstruction: favorite.defaultDosage || prev.dosageInstruction
    }));
    checkDrugInteractions(favorite.medication);
  };

  // Validation
  const handleValidate = async (data) => {
    const errors = [];
    
    if (!data.medicationCodeableConcept) {
      errors.push({ field: 'medication', message: 'Medication is required' });
    }
    
    if (!data.dosageInstruction || data.dosageInstruction.length === 0) {
      errors.push({ field: 'dosage', message: 'Dosage instructions are required' });
    }
    
    if (!data.status) {
      errors.push({ field: 'status', message: 'Status is required' });
    }
    
    // Check for critical CDS alerts
    const criticalAlerts = cdsAlerts.filter(a => a.indicator === 'critical');
    if (criticalAlerts.length > 0 && !criticalAlerts.every(a => a.acknowledged)) {
      return {
        valid: false,
        warnings: [{
          field: 'general',
          message: 'Critical alerts must be acknowledged before prescribing'
        }]
      };
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
      // Build FHIR MedicationRequest resource
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        ...(medication?.id && { id: medication.id }),
        ...(medication?.meta && { meta: medication.meta }),
        
        status: validatedData.status,
        intent: validatedData.intent,
        priority: validatedData.priority,
        
        medicationCodeableConcept: validatedData.medicationCodeableConcept,
        
        subject: {
          reference: `Patient/${patient.id}`,
          display: `${patient.name?.[0]?.family}, ${patient.name?.[0]?.given?.join(' ')}`
        },
        
        authoredOn: validatedData.authoredOn,
        requester: {
          reference: `Practitioner/${clinicalContext.user?.id || 'current-user'}`,
          display: clinicalContext.user?.name || 'Current User'
        },
        
        dosageInstruction: validatedData.dosageInstruction,
        dispenseRequest: validatedData.dispenseRequest,
        substitution: validatedData.substitution,
        
        ...(validatedData.note?.length > 0 && { note: validatedData.note }),
        ...(validatedData.reasonCode?.length > 0 && { reasonCode: validatedData.reasonCode }),
        ...(validatedData.reasonReference?.length > 0 && { reasonReference: validatedData.reasonReference })
      };
      
      await onSave(medicationRequest);
    } catch (error) {
      console.error('Failed to save medication request:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Tab panels
  const renderMedicationTab = () => (
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
            onAcknowledge={(alert) => {
              // Mark as acknowledged
              setCdsAlerts(prev => prev.map(a => 
                a.id === alert.id ? { ...a, acknowledged: true } : a
              ));
            }}
            context={{
              userId: clinicalContext.user?.id,
              patientId: patient.id
            }}
            requireAcknowledgment={cdsAlerts.some(a => a.indicator === 'critical')}
          />
        )}
        
        {/* Checking indicator */}
        {checking && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
            Checking drug interactions and clinical guidelines...
          </Alert>
        )}
        
        {/* Medication selection */}
        <ClinicalCodeSelector
          resource="Medication"
          field="medicationCodeableConcept"
          label="Medication"
          value={formData.medicationCodeableConcept}
          onChange={(value) => handleFieldChange('medicationCodeableConcept', value)}
          searchType="medication"
          required
          showFrequent
          clinicalContext={clinicalContext}
          helperText="Start typing to search medications"
        />
        
        {/* Favorites */}
        {favorites.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Favorite Medications
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {favorites.slice(0, 5).map((fav, idx) => (
                <Chip
                  key={idx}
                  label={fav.medication.text || fav.medication.coding?.[0]?.display}
                  icon={<FavoriteIcon />}
                  onClick={() => handleUseFavorite(fav)}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Status and priority */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth required>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                label="Status"
              >
                {STATUS_OPTIONS.map(option => (
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
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth required>
              <InputLabel>Intent</InputLabel>
              <Select
                value={formData.intent}
                onChange={(e) => handleFieldChange('intent', e.target.value)}
                label="Intent"
              >
                {INTENT_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => handleFieldChange('priority', e.target.value)}
                label="Priority"
              >
                {PRIORITY_OPTIONS.map(option => (
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
        </Grid>
        
        {/* Reason for prescription */}
        <ClinicalCodeSelector
          resource="Condition"
          field="reasonCode"
          label="Indication (Reason for Prescription)"
          value={formData.reasonCode?.[0]}
          onChange={(value) => handleFieldChange('reasonCode', [value])}
          searchType="condition"
          helperText="Select the condition being treated"
        />
        
        {/* Prescription notes */}
        <ClinicalTextField
          label="Prescription Notes"
          value={formData.note?.[0]?.text || ''}
          onChange={(e) => handleFieldChange('note', [{
            text: e.target.value,
            time: new Date().toISOString()
          }])}
          multiline
          rows={2}
          enableVoiceInput
          placeholder="Additional instructions or notes..."
        />
      </Stack>
    </Box>
  );

  const renderDosageTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Drug interaction warnings specific to dosage */}
        {interactions.length > 0 && (
          <Alert severity="warning">
            <AlertTitle>Drug Interactions Detected</AlertTitle>
            {interactions.map((interaction, idx) => (
              <Typography key={idx} variant="body2">
                • {interaction.detail}
              </Typography>
            ))}
          </Alert>
        )}
        
        {/* Dosage builder */}
        <DosageBuilder
          medication={formData.medicationCodeableConcept}
          patientWeight={patient.weight}
          patientAge={patient.age}
          patientConditions={clinicalContext.conditions}
          currentMedications={clinicalContext.medications}
          recentLabs={clinicalContext.labs}
          value={formData.dosageInstruction?.[0]}
          onChange={handleDosageChange}
          showCalculator
          showCommonDosages
          checkInteractions
        />
      </Stack>
    </Box>
  );

  const renderDispenseTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        <Typography variant="subtitle2" gutterBottom>
          Dispensing Instructions
        </Typography>
        
        {/* Quantity to dispense */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Quantity"
              type="number"
              value={formData.dispenseRequest?.quantity?.value || ''}
              onChange={(e) => handleFieldChange('dispenseRequest', {
                ...formData.dispenseRequest,
                quantity: {
                  value: parseFloat(e.target.value),
                  unit: formData.dispenseRequest?.quantity?.unit || 'tablets'
                }
              })}
              fullWidth
              InputProps={{
                endAdornment: (
                  <Select
                    value={formData.dispenseRequest?.quantity?.unit || 'tablets'}
                    onChange={(e) => handleFieldChange('dispenseRequest', {
                      ...formData.dispenseRequest,
                      quantity: {
                        ...formData.dispenseRequest?.quantity,
                        unit: e.target.value
                      }
                    })}
                    variant="standard"
                  >
                    <MenuItem value="tablets">tablets</MenuItem>
                    <MenuItem value="capsules">capsules</MenuItem>
                    <MenuItem value="mL">mL</MenuItem>
                    <MenuItem value="bottles">bottles</MenuItem>
                    <MenuItem value="inhalers">inhalers</MenuItem>
                  </Select>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Day Supply"
              type="number"
              value={formData.dispenseRequest?.expectedSupplyDuration?.value || ''}
              onChange={(e) => handleFieldChange('dispenseRequest', {
                ...formData.dispenseRequest,
                expectedSupplyDuration: {
                  value: parseFloat(e.target.value),
                  unit: 'd',
                  system: 'http://unitsofmeasure.org',
                  code: 'd'
                }
              })}
              fullWidth
              helperText="Number of days this supply should last"
            />
          </Grid>
        </Grid>
        
        {/* Refills */}
        <TextField
          label="Number of Refills"
          type="number"
          value={formData.dispenseRequest?.numberOfRepeatsAllowed || 0}
          onChange={(e) => handleFieldChange('dispenseRequest', {
            ...formData.dispenseRequest,
            numberOfRepeatsAllowed: parseInt(e.target.value)
          })}
          fullWidth
          inputProps={{ min: 0, max: 11 }}
          helperText="Maximum 11 refills (1 year supply)"
        />
        
        {/* Validity period */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <ClinicalDatePicker
              label="Valid From"
              value={formData.dispenseRequest?.validityPeriod?.start}
              onChange={(value) => handleFieldChange('dispenseRequest', {
                ...formData.dispenseRequest,
                validityPeriod: {
                  ...formData.dispenseRequest?.validityPeriod,
                  start: value
                }
              })}
              maxDate={new Date()}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <ClinicalDatePicker
              label="Valid Until"
              value={formData.dispenseRequest?.validityPeriod?.end}
              onChange={(value) => handleFieldChange('dispenseRequest', {
                ...formData.dispenseRequest,
                validityPeriod: {
                  ...formData.dispenseRequest?.validityPeriod,
                  end: value
                }
              })}
              minDate={formData.dispenseRequest?.validityPeriod?.start}
              helperText="Leave blank for no expiration"
            />
          </Grid>
        </Grid>
        
        {/* Substitution */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.substitution?.allowedBoolean !== false}
                onChange={(e) => handleFieldChange('substitution', {
                  ...formData.substitution,
                  allowedBoolean: e.target.checked
                })}
              />
            }
            label="Allow generic substitution"
          />
          
          {formData.substitution?.allowedBoolean === false && (
            <TextField
              label="Reason for No Substitution"
              value={formData.substitution?.reason?.text || ''}
              onChange={(e) => handleFieldChange('substitution', {
                ...formData.substitution,
                reason: {
                  coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
                    code: 'PAT',
                    display: 'Patient request'
                  }],
                  text: e.target.value
                }
              })}
              fullWidth
              multiline
              rows={2}
              sx={{ mt: 2 }}
            />
          )}
        </Paper>
      </Stack>
    </Box>
  );

  const renderReviewTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Prescription Summary
        </Typography>
        
        {/* Medication details */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Medication
              </Typography>
              <Typography variant="body1">
                {formData.medicationCodeableConcept?.text || 
                 formData.medicationCodeableConcept?.coding?.[0]?.display || 
                 'Not specified'}
              </Typography>
            </Box>
            
            <Divider />
            
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Dosage Instructions
              </Typography>
              <Typography variant="body1">
                {formData.dosageInstruction?.[0]?.text || 'Not specified'}
              </Typography>
            </Box>
            
            <Divider />
            
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Dispense
              </Typography>
              <Typography variant="body1">
                {formData.dispenseRequest?.quantity ? 
                  `${formData.dispenseRequest.quantity.value} ${formData.dispenseRequest.quantity.unit}` :
                  'Not specified'
                }
                {formData.dispenseRequest?.numberOfRepeatsAllowed > 0 && 
                  ` with ${formData.dispenseRequest.numberOfRepeatsAllowed} refills`
                }
              </Typography>
            </Box>
            
            {formData.reasonCode?.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Indication
                  </Typography>
                  <Typography variant="body1">
                    {formData.reasonCode[0].text || formData.reasonCode[0].coding?.[0]?.display}
                  </Typography>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
        
        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
          >
            Print Prescription
          </Button>
          
          {onSendToPharmacy && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => onSendToPharmacy(formData)}
              color="primary"
            >
              Send to Pharmacy
            </Button>
          )}
        </Stack>
        
        {/* Safety summary */}
        <Alert severity={cdsAlerts.some(a => a.indicator === 'critical') ? 'error' : 'success'}>
          <AlertTitle>Safety Check Summary</AlertTitle>
          {cdsAlerts.length === 0 ? (
            <Typography variant="body2">
              No drug interactions or safety concerns identified.
            </Typography>
          ) : (
            <Typography variant="body2">
              {cdsAlerts.filter(a => a.indicator === 'critical').length} critical alerts,{' '}
              {cdsAlerts.filter(a => a.indicator === 'warning').length} warnings
            </Typography>
          )}
        </Alert>
      </Stack>
    </Box>
  );

  return (
    <ClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'prescribe' ? 'Prescribe Medication' : 'Edit Prescription'}
      subtitle="Create or modify a medication prescription"
      mode={mode}
      size="large"
      resource={formData}
      resourceType="MedicationRequest"
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
          <Tab icon={<MedicationIcon />} label="Medication" />
          <Tab icon={<Science />} label="Dosage" />
          <Tab icon={<PharmacyIcon />} label="Dispense" />
          <Tab icon={<SafetyIcon />} label="Review" />
        </Tabs>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && renderMedicationTab()}
        {activeTab === 1 && renderDosageTab()}
        {activeTab === 2 && renderDispenseTab()}
        {activeTab === 3 && renderReviewTab()}
      </Box>
    </ClinicalDialog>
  );
};

export default MedicationDialog;