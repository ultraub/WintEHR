/**
 * EncounterSigningDialog Component
 * Comprehensive encounter signing and closure workflow with digital signatures
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Paper,
  Divider,
  Chip,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  useTheme
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Assignment as NoteIcon,
  LocalPharmacy as MedicationIcon,
  Science as LabIcon,
  MedicalServices as DiagnosisIcon,
  Person as ProviderIcon,
  Schedule as TimeIcon,
  WarningAmber as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Draw as SignatureIcon,
  Lock as LockIcon,
  VerifiedUser as VerifiedIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

const SIGNING_STEPS = [
  {
    id: 'review',
    label: 'Review Encounter',
    description: 'Review all encounter details and documentation'
  },
  {
    id: 'diagnoses',
    label: 'Confirm Diagnoses',
    description: 'Verify and finalize diagnoses with ICD-10 codes'
  },
  {
    id: 'orders',
    label: 'Review Orders',
    description: 'Confirm all orders and prescriptions'
  },
  {
    id: 'billing',
    label: 'Billing Codes',
    description: 'Review and confirm billing codes'
  },
  {
    id: 'signature',
    label: 'Digital Signature',
    description: 'Provide digital signature and finalize encounter'
  }
];

const BILLING_CODES = {
  'office-visit': [
    { code: '99213', description: 'Office visit, established patient, low complexity' },
    { code: '99214', description: 'Office visit, established patient, moderate complexity' },
    { code: '99215', description: 'Office visit, established patient, high complexity' },
    { code: '99203', description: 'Office visit, new patient, low complexity' },
    { code: '99204', description: 'Office visit, new patient, moderate complexity' },
    { code: '99205', description: 'Office visit, new patient, high complexity' }
  ],
  'preventive': [
    { code: '99391', description: 'Preventive visit, new patient, 18-39 years' },
    { code: '99392', description: 'Preventive visit, new patient, 40-64 years' },
    { code: '99393', description: 'Preventive visit, new patient, 65+ years' },
    { code: '99401', description: 'Preventive counseling, 15 minutes' },
    { code: '99402', description: 'Preventive counseling, 30 minutes' }
  ]
};

const EncounterSigningDialog = ({ 
  open, 
  onClose, 
  encounter, 
  patientId,
  onEncounterSigned 
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { getPatientResources, refreshPatientResources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();

  // State management
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [signatureData, setSignatureData] = useState({
    pin: '',
    reason: '',
    timestamp: null
  });
  const [diagnosesData, setDiagnosesData] = useState([]);
  const [billingData, setBillingData] = useState({
    primaryCode: '',
    secondaryCodes: [],
    complexity: 'moderate'
  });
  const [reviewChecklist, setReviewChecklist] = useState({
    chiefComplaint: false,
    historyPresent: false,
    physicalExam: false,
    assessmentPlan: false,
    ordersReviewed: false,
    allergiesChecked: false
  });

  // Load encounter-related data
  useEffect(() => {
    if (encounter && patientId) {
      loadEncounterData();
    }
  }, [encounter, patientId]);

  const loadEncounterData = async () => {
    try {
      setLoading(true);
      
      // Load existing diagnoses (Conditions)
      const conditions = getPatientResources(patientId, 'Condition') || [];
      const encounterRef = `Encounter/${encounter.id}`;
      const encounterUrnRef = `urn:uuid:${encounter.id}`;
      
      const isEncounterMatch = (ref) => {
        return ref === encounterRef || ref === encounterUrnRef;
      };
      
      const encounterConditions = conditions.filter(c => 
        isEncounterMatch(c.encounter?.reference)
      );
      
      setDiagnosesData(encounterConditions);
      
      // Pre-populate billing codes based on encounter type
      const encounterType = encounter.type?.[0]?.coding?.[0]?.code;
      if (encounterType) {
        setBillingData(prev => ({
          ...prev,
          primaryCode: encounterType === 'preventive' ? '99391' : '99213'
        }));
      }

      // Check for any validation issues
      validateEncounterCompleteness();
      
    } catch (error) {
      setErrors([`Failed to load encounter data: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const validateEncounterCompleteness = () => {
    const newErrors = [];
    const newWarnings = [];

    // Check required fields
    if ((!encounter.reasonCode || encounter.reasonCode.length === 0) && (!encounter.reason || encounter.reason.length === 0)) {
      newErrors.push('Chief complaint/reason for visit is required');
    }

    if (!encounter.participant || encounter.participant.length === 0) {
      newErrors.push('Attending provider must be specified');
    }

    // Check for missing documentation
    const documentReferences = getPatientResources(patientId, 'DocumentReference') || [];
    const encounterRef = `Encounter/${encounter.id}`;
    const encounterUrnRef = `urn:uuid:${encounter.id}`;
    
    const isEncounterMatch = (ref) => {
      return ref === encounterRef || ref === encounterUrnRef;
    };
    
    const encounterDocs = documentReferences.filter(doc => {
      // Check if context.encounter is an array
      if (Array.isArray(doc.context?.encounter)) {
        return doc.context.encounter.some(enc => isEncounterMatch(enc.reference));
      }
      // Check if context.encounter is a single reference object
      if (doc.context?.encounter?.reference) {
        return isEncounterMatch(doc.context.encounter.reference);
      }
      return false;
    });
    
    if (encounterDocs.length === 0) {
      newWarnings.push('No clinical documentation found for this encounter');
    }

    // Check for unsigned orders
    const orders = [
      ...(getPatientResources(patientId, 'MedicationRequest') || []),
      ...(getPatientResources(patientId, 'ServiceRequest') || [])
    ];
    const encounterOrders = orders.filter(order => 
      isEncounterMatch(order.encounter?.reference)
    );
    const unsignedOrders = encounterOrders.filter(order => 
      order.status === 'draft' || !order.requester
    );
    
    if (unsignedOrders.length > 0) {
      newWarnings.push(`${unsignedOrders.length} unsigned orders require attention`);
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
  };

  const handleNext = () => {
    if (activeStep < SIGNING_STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleDiagnosisChange = (index, field, value) => {
    setDiagnosesData(prev => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = { resourceType: 'Condition' };
      }
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addDiagnosis = () => {
    setDiagnosesData(prev => [...prev, {
      resourceType: 'Condition',
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounter.id}` },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active'
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed'
        }]
      }
    }]);
  };

  const handleChecklistChange = (item) => {
    setReviewChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleSignEncounter = async () => {
    if (!signatureData.pin || !signatureData.reason) {
      setErrors(['PIN and signature reason are required']);
      return;
    }

    try {
      setLoading(true);
      
      // Create digital signature resource
      const signature = {
        resourceType: 'Provenance',
        target: [{ reference: `Encounter/${encounter.id}` }],
        recorded: new Date().toISOString(),
        agent: [{
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
              code: 'author'
            }]
          },
          who: {
            reference: `Practitioner/${currentUser.id}`,
            display: currentUser.name || currentUser.username
          }
        }],
        activity: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
            code: 'UPDATE',
            display: 'Updated'
          }]
        },
        reason: [{
          text: signatureData.reason
        }],
        signature: [{
          type: [{
            system: 'urn:iso-astm:E1762-95:2013',
            code: '1.2.840.10065.1.12.1.1',
            display: 'Author\'s Signature'
          }],
          when: new Date().toISOString(),
          who: {
            reference: `Practitioner/${currentUser.id}`
          },
          data: btoa(`${currentUser.id}:${signatureData.pin}:${Date.now()}`)
        }]
      };

      // Save signature
      const signatureResponse = await fhirClient.create('Provenance', signature);

      if (!signatureResponse) {
        throw new Error('Failed to create digital signature');
      }

      // Update encounter status to finished
      const updatedEncounter = {
        ...encounter,
        status: 'finished',
        period: {
          ...(encounter.actualPeriod || encounter.period),
          end: new Date().toISOString()
        }
      };

      const encounterResponse = await fhirClient.update('Encounter', encounter.id, updatedEncounter);

      if (!encounterResponse) {
        throw new Error('Failed to update encounter status');
      }

      // Save diagnoses
      for (const diagnosis of diagnosesData) {
        if (diagnosis.code && diagnosis.code.text) {
          if (diagnosis.id) {
            await fhirClient.update('Condition', diagnosis.id, diagnosis);
          } else {
            await fhirClient.create('Condition', diagnosis);
          }
        }
      }

      // Publish encounter signed event
      await publish(CLINICAL_EVENTS.ENCOUNTER_SIGNED, {
        encounterId: encounter.id,
        patientId,
        providerId: currentUser.id,
        billingCodes: [billingData.primaryCode, ...billingData.secondaryCodes],
        timestamp: new Date().toISOString()
      });

      // Refresh patient resources
      await refreshPatientResources(patientId);

      // Notify parent component
      if (onEncounterSigned) {
        onEncounterSigned(updatedEncounter);
      }

      onClose();

    } catch (error) {
      setErrors([`Failed to sign encounter: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0: // Review
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Encounter Review Checklist
            </Typography>
            <List>
              {Object.entries(reviewChecklist).map(([key, checked]) => (
                <ListItem key={key}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => handleChecklistChange(key)}
                      />
                    }
                    label={key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  />
                </ListItem>
              ))}
            </List>
            
            {errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Required items:</Typography>
                <ul>
                  {errors.map((error, idx) => (
                    <li key={`error-${error.substring(0, 30)}-${idx}`}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}
            
            {warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Warnings:</Typography>
                <ul>
                  {warnings.map((warning, idx) => (
                    <li key={`warning-${warning.substring(0, 30)}-${idx}`}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </Box>
        );

      case 1: // Diagnoses
        return (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Diagnoses</Typography>
              <Button startIcon={<DiagnosisIcon />} onClick={addDiagnosis}>
                Add Diagnosis
              </Button>
            </Stack>
            
            {diagnosesData.map((diagnosis, index) => (
              <Card key={`diagnosis-${diagnosis.code?.display || diagnosis.condition?.display || ''}-${index}`} sx={{ mb: 2 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Diagnosis"
                        value={diagnosis.code?.text || ''}
                        onChange={(e) => handleDiagnosisChange(index, 'code', { text: e.target.value })}
                        placeholder="Enter diagnosis"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="ICD-10 Code"
                        value={diagnosis.code?.coding?.[0]?.code || ''}
                        onChange={(e) => {
                          const coding = [{
                            system: 'http://hl7.org/fhir/sid/icd-10-cm',
                            code: e.target.value
                          }];
                          const updatedCode = { ...diagnosis.code, coding };
                          handleDiagnosisChange(index, 'code', updatedCode);
                        }}
                        placeholder="ICD-10"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={diagnosis.clinicalStatus?.coding?.[0]?.code || 'active'}
                          onChange={(e) => {
                            const clinicalStatus = {
                              coding: [{
                                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                                code: e.target.value
                              }]
                            };
                            handleDiagnosisChange(index, 'clinicalStatus', clinicalStatus);
                          }}
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="resolved">Resolved</MenuItem>
                          <MenuItem value="inactive">Inactive</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
          </Box>
        );

      case 2: // Orders
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Order Review
            </Typography>
            <Alert severity="info">
              Review all orders associated with this encounter. Unsigned orders will need to be addressed.
            </Alert>
            {/* Orders will be loaded and displayed here */}
          </Box>
        );

      case 3: // Billing
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Billing Codes
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Primary CPT Code</InputLabel>
                  <Select
                    value={billingData.primaryCode}
                    onChange={(e) => setBillingData({ ...billingData, primaryCode: e.target.value })}
                  >
                    {BILLING_CODES['office-visit'].map(code => (
                      <MenuItem key={code.code} value={code.code}>
                        {code.code} - {code.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Complexity</InputLabel>
                  <Select
                    value={billingData.complexity}
                    onChange={(e) => setBillingData({ ...billingData, complexity: e.target.value })}
                  >
                    <MenuItem value="low">Low Complexity</MenuItem>
                    <MenuItem value="moderate">Moderate Complexity</MenuItem>
                    <MenuItem value="high">High Complexity</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        );

      case 4: // Signature
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Digital Signature
            </Typography>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Provider PIN"
                type="password"
                value={signatureData.pin}
                onChange={(e) => setSignatureData({ ...signatureData, pin: e.target.value })}
                placeholder="Enter your PIN"
                InputProps={{
                  startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
              <TextField
                fullWidth
                label="Signature Reason"
                value={signatureData.reason}
                onChange={(e) => setSignatureData({ ...signatureData, reason: e.target.value })}
                placeholder="e.g., 'Encounter completion and billing authorization'"
                multiline
                rows={2}
              />
              <Alert severity="info" icon={<VerifiedIcon />}>
                By providing your PIN and reason, you are digitally signing this encounter and authorizing billing.
              </Alert>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return Object.values(reviewChecklist).every(checked => checked) && errors.length === 0;
      case 1:
        return diagnosesData.some(d => d.code?.text);
      case 2:
        return true; // Orders review is informational
      case 3:
        return billingData.primaryCode;
      case 4:
        return signatureData.pin && signatureData.reason;
      default:
        return false;
    }
  };

  if (!encounter) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Sign Encounter</Typography>
            <Typography variant="body2" color="text.secondary">
              {encounter.type?.[0]?.text || 'Clinical Encounter'} - {
                (encounter.actualPeriod || encounter.period)?.start && format(parseISO((encounter.actualPeriod || encounter.period).start), 'PPP')
              }
            </Typography>
          </Box>
          <Chip 
            label={encounter.status} 
            color={encounter.status === 'in-progress' ? 'warning' : 'default'}
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {SIGNING_STEPS.map((step, index) => (
            <Step key={step.id}>
              <StepLabel>
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {step.description}
                </Typography>
                {renderStepContent(index)}
                
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                  {index === SIGNING_STEPS.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleSignEncounter}
                      disabled={!canProceed() || loading}
                      startIcon={loading ? <CircularProgress size={20} /> : <SignatureIcon />}
                    >
                      {loading ? 'Signing...' : 'Sign Encounter'}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={!canProceed()}
                    >
                      Continue
                    </Button>
                  )}
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EncounterSigningDialog;