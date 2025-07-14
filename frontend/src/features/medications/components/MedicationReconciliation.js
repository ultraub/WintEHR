import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Compare as CompareIcon,
  CheckCircle as ApprovedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SwapHoriz as ReconcileIcon,
  Assignment as ReportIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon,
  PersonAdd as PrescribeIcon,
  Update as UpdateIcon,
  Flag as FlagIcon,
  Visibility as ViewIcon,
  Home as HomeIcon,
  LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { format, parseISO, isAfter, differenceInDays } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';

// Medication item component for reconciliation
const MedicationItem = ({ 
  medication, 
  source, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  showActions = true,
  comparisonMode = false
}) => {
  const [expanded, setExpanded] = useState(false);

  const getMedicationName = () => {
    return medication.medicationCodeableConcept?.text || 
           medication.medicationCodeableConcept?.coding?.[0]?.display ||
           medication.medicationReference?.display ||
           'Unknown Medication';
  };

  const getDosageInfo = () => {
    const dosage = medication.dosageInstruction?.[0];
    if (!dosage) return 'No dosage specified';

    const dose = dosage.doseAndRate?.[0]?.doseQuantity;
    const frequency = dosage.timing?.repeat?.frequency;
    const period = dosage.timing?.repeat?.period;
    const periodUnit = dosage.timing?.repeat?.periodUnit;
    const route = dosage.route?.text || dosage.route?.coding?.[0]?.display;

    let dosageText = '';
    if (dose) {
      dosageText += `${dose.value} ${dose.unit || dose.code}`;
    }
    if (frequency && period) {
      dosageText += ` ${frequency} times per ${period} ${periodUnit}`;
    }
    if (route) {
      dosageText += ` (${route})`;
    }

    return dosageText || dosage.text || 'See instructions';
  };

  const getStatusColor = () => {
    switch (medication.status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'stopped': return 'error';
      case 'on-hold': return 'warning';
      case 'draft': return 'default';
      default: return 'default';
    }
  };

  const getSourceIcon = () => {
    switch (source) {
      case 'home': return <HomeIcon color="primary" />;
      case 'hospital': return <HospitalIcon color="secondary" />;
      case 'discharge': return <UpdateIcon color="info" />;
      case 'current': return <MedicationIcon color="action" />;
      default: return <MedicationIcon />;
    }
  };

  const getSourceLabel = () => {
    switch (source) {
      case 'home': return 'Home Medications';
      case 'hospital': return 'Hospital Medications';
      case 'discharge': return 'Discharge Medications';
      case 'current': return 'Current Medications';
      default: return 'Unknown Source';
    }
  };

  return (
    <Card 
      sx={{ 
        mb: 1, 
        border: isSelected ? 2 : 1, 
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: comparisonMode ? 'grey.50' : 'background.paper'
      }}
    >
      <CardContent sx={{ pb: showActions ? 1 : 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1 }}>
            {showActions && (
              <Checkbox
                checked={isSelected}
                onChange={(e) => onSelect?.(medication.id, e.target.checked)}
                color="primary"
              />
            )}
            <Avatar sx={{ bgcolor: 'primary.light' }}>
              {getSourceIcon()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {getMedicationName()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getDosageInfo()}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Chip 
                  label={medication.status}
                  size="small"
                  color={getStatusColor()}
                />
                <Chip 
                  label={getSourceLabel()}
                  size="small"
                  variant="outlined"
                />
                {medication.authoredOn && (
                  <Typography variant="caption" color="text.secondary">
                    {format(parseISO(medication.authoredOn), 'MM/dd/yyyy')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pl: showActions ? 7 : 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Prescription Details</Typography>
                <Typography variant="body2">
                  Prescriber: {medication.requester?.display || 'Unknown'}
                </Typography>
                {medication.reasonCode && (
                  <Typography variant="body2">
                    Indication: {medication.reasonCode[0]?.text || medication.reasonCode[0]?.coding?.[0]?.display}
                  </Typography>
                )}
                {medication.dispenseRequest && (
                  <Typography variant="body2">
                    Quantity: {medication.dispenseRequest.quantity?.value} {medication.dispenseRequest.quantity?.unit}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Additional Information</Typography>
                {medication.note && (
                  <Typography variant="body2">
                    Notes: {medication.note[0]?.text}
                  </Typography>
                )}
                {medication.category && (
                  <Typography variant="body2">
                    Category: {medication.category[0]?.coding?.[0]?.display}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>

      {showActions && (
        <CardActions>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Edit Medication">
              <IconButton size="small" onClick={() => onEdit?.(medication)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Details">
              <IconButton size="small">
                <ViewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Flag for Review">
              <IconButton size="small">
                <FlagIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove">
              <IconButton size="small" color="error" onClick={() => onDelete?.(medication.id)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardActions>
      )}
    </Card>
  );
};

// Reconciliation workflow stepper
const ReconciliationStepper = ({ activeStep, steps, onStepClick }) => {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Medication Reconciliation Workflow
      </Typography>
      <Stepper activeStep={activeStep} orientation="horizontal">
        {steps.map((step, index) => (
          <Step key={step.label} completed={index < activeStep}>
            <StepLabel 
              onClick={() => onStepClick?.(index)}
              sx={{ cursor: 'pointer' }}
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Paper>
  );
};

// Medication comparison view
const MedicationComparison = ({ homeMeds, hospitalMeds, dischargeMeds, onReconcile }) => {
  const [selectedComparisons, setSelectedComparisons] = useState([]);

  const findSimilarMedications = (med, targetList) => {
    const medName = med.medicationCodeableConcept?.text?.toLowerCase() || '';
    return targetList.filter(target => {
      const targetName = target.medicationCodeableConcept?.text?.toLowerCase() || '';
      return targetName.includes(medName.split(' ')[0]) || medName.includes(targetName.split(' ')[0]);
    });
  };

  const allComparisons = useMemo(() => {
    const comparisons = [];
    
    homeMeds.forEach(homeMed => {
      const hospitalMatches = findSimilarMedications(homeMed, hospitalMeds);
      const dischargeMatches = findSimilarMedications(homeMed, dischargeMeds);
      
      comparisons.push({
        id: `comp_${homeMed.id}`,
        home: homeMed,
        hospital: hospitalMatches[0] || null,
        discharge: dischargeMatches[0] || null,
        status: 'pending'
      });
    });

    return comparisons;
  }, [homeMeds, hospitalMeds, dischargeMeds]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Medication Comparison</Typography>
        <Button 
          variant="contained" 
          startIcon={<ReconcileIcon />}
          onClick={() => onReconcile?.(selectedComparisons)}
          disabled={selectedComparisons.length === 0}
        >
          Reconcile Selected ({selectedComparisons.length})
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox />
              </TableCell>
              <TableCell>Home Medications</TableCell>
              <TableCell>Hospital Medications</TableCell>
              <TableCell>Discharge Medications</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allComparisons.map((comparison) => (
              <TableRow key={comparison.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedComparisons.includes(comparison.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedComparisons([...selectedComparisons, comparison.id]);
                      } else {
                        setSelectedComparisons(selectedComparisons.filter(id => id !== comparison.id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  {comparison.home && (
                    <MedicationItem 
                      medication={comparison.home} 
                      source="home" 
                      showActions={false}
                      comparisonMode={true}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {comparison.hospital ? (
                    <MedicationItem 
                      medication={comparison.hospital} 
                      source="hospital" 
                      showActions={false}
                      comparisonMode={true}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No matching hospital medication
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {comparison.discharge ? (
                    <MedicationItem 
                      medication={comparison.discharge} 
                      source="discharge" 
                      showActions={false}
                      comparisonMode={true}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No discharge medication
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack spacing={1}>
                    <Button size="small" variant="outlined" color="success">
                      Continue
                    </Button>
                    <Button size="small" variant="outlined" color="warning">
                      Modify
                    </Button>
                    <Button size="small" variant="outlined" color="error">
                      Discontinue
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// Main MedicationReconciliation Component
const MedicationReconciliation = ({ patientId, encounterId, mode = 'admission' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [homeMedications, setHomeMedications] = useState([]);
  const [hospitalMedications, setHospitalMedications] = useState([]);
  const [dischargeMedications, setDischargeMedications] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedMedications, setSelectedMedications] = useState({});
  const [reconciliationComplete, setReconciliationComplete] = useState(false);

  const reconciliationSteps = [
    { label: 'Collect Home Medications', description: 'Gather patient\'s home medication list' },
    { label: 'Review Hospital Medications', description: 'Review medications administered during stay' },
    { label: 'Compare & Reconcile', description: 'Compare lists and reconcile differences' },
    { label: 'Create Discharge List', description: 'Generate final medication list' },
    { label: 'Complete & Document', description: 'Finalize reconciliation and document' }
  ];

  useEffect(() => {
    if (!patientId) return;
    fetchMedications();
  }, [patientId, encounterId]);

  const fetchMedications = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all medication requests for the patient
      const medicationRequests = await fhirClient.search('MedicationRequest', {
        patient: patientId,
        _sort: '-_lastUpdated',
        _count: 100
      });

      // Fetch medication statements (patient-reported medications)
      const medicationStatements = await fhirClient.search('MedicationStatement', {
        subject: patientId,
        _sort: '-_lastUpdated',
        _count: 100
      });

      const allMedications = [
        ...(medicationRequests.resources || []),
        ...(medicationStatements.resources || [])
      ];

      // Categorize medications based on context and encounter
      const categorized = categorizeMedications(allMedications);
      
      setHomeMedications(categorized.home);
      setHospitalMedications(categorized.hospital);
      setDischargeMedications(categorized.discharge);

    } catch (err) {
      
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const categorizeMedications = (medications) => {
    const now = new Date();
    const categorized = {
      home: [],
      hospital: [],
      discharge: []
    };

    medications.forEach(med => {
      // Determine category based on context, category, or encounter
      const category = med.category?.[0]?.coding?.[0]?.code;
      const context = med.encounter?.reference;
      const intent = med.intent;

      if (med.resourceType === 'MedicationStatement') {
        // Patient-reported medications are typically home medications
        categorized.home.push(med);
      } else if (intent === 'order' && context === `Encounter/${encounterId}`) {
        // Orders during current encounter are hospital medications
        categorized.hospital.push(med);
      } else if (intent === 'plan' && category === 'discharge') {
        // Discharge planning medications
        categorized.discharge.push(med);
      } else if (med.status === 'active' && !context) {
        // Active medications without encounter context are likely home medications
        categorized.home.push(med);
      } else {
        // Default to home medications for reconciliation
        categorized.home.push(med);
      }
    });

    return categorized;
  };

  const handleMedicationSelect = (medicationId, isSelected, category) => {
    setSelectedMedications(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [medicationId]: isSelected
      }
    }));
  };

  const handleReconcile = async (selectedComparisons) => {
    try {
      setLoading(true);
      
      // Here you would implement the actual reconciliation logic
      // Create new MedicationRequest resources for the reconciled list
      // Update existing medications as needed
      // Create documentation of the reconciliation process
      
      
      // For demo purposes, just mark as complete
      setReconciliationComplete(true);
      setActiveStep(4);
      
    } catch (err) {
      setError('Failed to complete reconciliation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = (stepIndex) => {
    setActiveStep(stepIndex);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Home Medications</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button startIcon={<AddIcon />} variant="outlined">
                        Add Medication
                      </Button>
                      <Button startIcon={<RefreshIcon />} onClick={fetchMedications}>
                        Refresh
                      </Button>
                    </Stack>
                  </Stack>
                  
                  {homeMedications.length > 0 ? (
                    homeMedications.map(med => (
                      <MedicationItem
                        key={med.id}
                        medication={med}
                        source="home"
                        isSelected={selectedMedications.home?.[med.id] || false}
                        onSelect={(id, selected) => handleMedicationSelect(id, selected, 'home')}
                      />
                    ))
                  ) : (
                    <Alert severity="info">
                      No home medications found. Please add patient's home medications.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Hospital Medications
                  </Typography>
                  
                  {hospitalMedications.length > 0 ? (
                    hospitalMedications.map(med => (
                      <MedicationItem
                        key={med.id}
                        medication={med}
                        source="hospital"
                        isSelected={selectedMedications.hospital?.[med.id] || false}
                        onSelect={(id, selected) => handleMedicationSelect(id, selected, 'hospital')}
                      />
                    ))
                  ) : (
                    <Alert severity="info">
                      No hospital medications found for this encounter.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <MedicationComparison
            homeMeds={homeMedications}
            hospitalMeds={hospitalMedications}
            dischargeMeds={dischargeMedications}
            onReconcile={handleReconcile}
          />
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Discharge Medication List
                  </Typography>
                  
                  {dischargeMedications.length > 0 ? (
                    dischargeMedications.map(med => (
                      <MedicationItem
                        key={med.id}
                        medication={med}
                        source="discharge"
                        isSelected={selectedMedications.discharge?.[med.id] || false}
                        onSelect={(id, selected) => handleMedicationSelect(id, selected, 'discharge')}
                      />
                    ))
                  ) : (
                    <Alert severity="warning">
                      No discharge medications have been created yet. Please complete reconciliation first.
                    </Alert>
                  )}
                </CardContent>
                <CardActions>
                  <Button variant="contained" startIcon={<PrintIcon />}>
                    Print Discharge List
                  </Button>
                  <Button variant="outlined" startIcon={<SaveIcon />}>
                    Save Draft
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                    <ApprovedIcon color="success" sx={{ fontSize: 40 }} />
                    <Box>
                      <Typography variant="h6">
                        Medication Reconciliation Complete
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Reconciliation completed on {format(new Date(), 'MM/dd/yyyy HH:mm')}
                      </Typography>
                    </Box>
                  </Stack>

                  <Alert severity="success" sx={{ mb: 2 }}>
                    Medication reconciliation has been successfully completed and documented.
                  </Alert>

                  <Stack direction="row" spacing={2}>
                    <Button variant="contained" startIcon={<ReportIcon />}>
                      View Reconciliation Report
                    </Button>
                    <Button variant="outlined" startIcon={<PrintIcon />}>
                      Print Final List
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading medication data: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5">
              Medication Reconciliation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === 'admission' ? 'Admission' : 'Discharge'} Medication Reconciliation
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Chip 
              label={`${homeMedications.length} Home Meds`}
              color="primary"
              variant="outlined"
            />
            <Chip 
              label={`${hospitalMedications.length} Hospital Meds`}
              color="secondary"
              variant="outlined"
            />
            <Chip 
              label={`${dischargeMedications.length} Discharge Meds`}
              color="info"
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Stepper */}
      <ReconciliationStepper
        activeStep={activeStep}
        steps={reconciliationSteps}
        onStepClick={handleStepClick}
      />

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Stack direction="row" justifyContent="space-between">
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep(activeStep - 1)}
          >
            Previous
          </Button>
          <Button
            variant="contained"
            disabled={activeStep === reconciliationSteps.length - 1}
            onClick={() => setActiveStep(activeStep + 1)}
          >
            {activeStep === reconciliationSteps.length - 2 ? 'Complete' : 'Next'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default MedicationReconciliation;