import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  Tab,
  Tabs,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  LocalHospital as HospitalIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../core/fhir/services/fhirClient';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`encounter-tabpanel-${index}`}
      aria-labelledby={`encounter-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const EncounterDetail = ({ 
  open, 
  onClose, 
  encounter, 
  patient,
  onEdit,
  onUpdate 
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [encounterData, setEncounterData] = useState({
    medications: [],
    observations: [],
    conditions: [],
    procedures: [],
    provider: null
  });
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (open && encounter) {
      fetchEncounterData();
    }
  }, [open, encounter]);

  const fetchEncounterData = async () => {
    if (!encounter) return;

    try {
      setLoading(true);
      
      // Fetch all data for the patient and filter by encounter
      const patientId = patient?.id || encounter.patient_id;
      
      const [
        medicationsResult,
        observationsResult,
        conditionsResult
      ] = await Promise.all([
        fhirClient.getMedications(patientId),
        fhirClient.getObservations(patientId),
        fhirClient.getConditions(patientId)
      ]);
      
      // Filter resources by encounter reference
      const encounterRef = `Encounter/${encounter.id}`;
      
      const medicationsResponse = {
        data: medicationsResult.resources
          .filter(med => med.encounter?.reference === encounterRef)
          .map(med => ({
            id: med.id,
            medication_name: med.medicationCodeableConcept?.text || 
                           med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
            dosage: med.dosageInstruction?.[0]?.text || '',
            status: med.status,
            start_date: med.authoredOn
          }))
      };
      
      const observationsResponse = {
        data: observationsResult.resources
          .filter(obs => obs.encounter?.reference === encounterRef)
          .map(obs => ({
            id: obs.id,
            display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
            value: obs.valueQuantity?.value || obs.valueString || '',
            unit: obs.valueQuantity?.unit || '',
            observation_date: obs.effectiveDateTime || obs.issued,
            status: obs.status
          }))
      };
      
      const conditionsResponse = {
        data: conditionsResult.resources
          .filter(cond => cond.encounter?.reference === encounterRef)
          .map(cond => ({
            id: cond.id,
            description: cond.code?.text || cond.code?.coding?.[0]?.display || 'Unknown',
            clinical_status: cond.clinicalStatus?.coding?.[0]?.code || 'active',
            onset_date: cond.onsetDateTime || cond.onsetPeriod?.start
          }))
      };
      
      // Provider info is in the encounter itself
      const providerResponse = { data: null };

      setEncounterData({
        medications: medicationsResponse.data || [],
        observations: observationsResponse.data || [],
        conditions: conditionsResponse.data || [],
        procedures: [], // TODO: Add procedures API
        provider: providerResponse.data
      });
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'stopped': return 'error';
      case 'finished': return 'success';
      case 'in-progress': return 'info';
      default: return 'default';
    }
  };

  if (!encounter) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <HospitalIcon color="primary" />
            <Box>
              <Typography variant="h6">
                {encounter.encounter_type} - {format(new Date(encounter.encounter_date), 'MMM dd, yyyy')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {patient?.first_name} {patient?.last_name} - MRN: {patient?.mrn}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => onEdit('encounter', encounter)}
              size="small"
            >
              Edit Encounter
            </Button>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Encounter Summary Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="h6">Encounter Details</Typography>
                </Box>
                <Typography variant="body2"><strong>Date:</strong> {format(new Date(encounter.encounter_date), 'MMM dd, yyyy h:mm a')}</Typography>
                <Typography variant="body2"><strong>Type:</strong> {encounter.encounter_type}</Typography>
                <Typography variant="body2"><strong>Status:</strong> 
                  <Chip 
                    label={encounter.status} 
                    color={getStatusColor(encounter.status)} 
                    size="small" 
                    sx={{ ml: 1 }}
                  />
                </Typography>
                {encounterData.provider && (
                  <Typography variant="body2"><strong>Provider:</strong> Dr. {encounterData.provider.first_name} {encounterData.provider.last_name}</Typography>
                )}
              </Grid>
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssignmentIcon color="primary" />
                  <Typography variant="h6">Chief Complaint & Notes</Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Chief Complaint:</strong> {encounter.chief_complaint}
                </Typography>
                {encounter.notes && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                      {encounter.notes}
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Related Data Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="encounter data tabs">
              <Tab label={`Medications (${encounterData.medications.length})`} />
              <Tab label={`Lab Results (${encounterData.observations.filter(obs => {
                const display = obs.display?.toLowerCase() || '';
                return !display.includes('blood pressure') && !display.includes('heart rate') && 
                       !display.includes('temperature') && !display.includes('weight') && 
                       !display.includes('height') && !display.includes('oxygen') && 
                       !display.includes('respiratory') && !display.includes('bmi') && 
                       !display.includes('pulse') && !display.includes('bp');
              }).length})`} />
              <Tab label={`Vital Signs (${encounterData.observations.filter(obs => {
                const display = obs.display?.toLowerCase() || '';
                return display.includes('blood pressure') || display.includes('heart rate') || 
                       display.includes('temperature') || display.includes('weight') || 
                       display.includes('height') || display.includes('oxygen') || 
                       display.includes('respiratory') || display.includes('bmi') || 
                       display.includes('pulse') || display.includes('bp');
              }).length})`} />
              <Tab label={`Diagnoses (${encounterData.conditions.length})`} />
            </Tabs>
          </Box>

          {/* Medications Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Medications Prescribed</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onEdit('medication', null)}
                size="small"
              >
                Add Medication
              </Button>
            </Box>
            {encounterData.medications.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Medication</TableCell>
                      <TableCell>Dosage</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {encounterData.medications.map((medication) => (
                      <TableRow key={medication.id}>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {medication.medication_name}
                          </Typography>
                        </TableCell>
                        <TableCell>{medication.dosage}</TableCell>
                        <TableCell>{medication.frequency}</TableCell>
                        <TableCell>
                          {format(new Date(medication.start_date), 'MM/dd/yyyy')}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={medication.status} 
                            color={getStatusColor(medication.status)} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Edit medication">
                            <IconButton 
                              size="small" 
                              onClick={() => onEdit('medication', medication)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No medications prescribed during this encounter</Alert>
            )}
          </TabPanel>

          {/* Lab Results Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Laboratory Results</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onEdit('observation', null)}
                size="small"
              >
                Add Lab Result
              </Button>
            </Box>
            {encounterData.observations.filter(obs => {
              const display = obs.display?.toLowerCase() || '';
              return !display.includes('blood pressure') && !display.includes('heart rate') && 
                     !display.includes('temperature') && !display.includes('weight') && 
                     !display.includes('height') && !display.includes('oxygen') && 
                     !display.includes('respiratory') && !display.includes('bmi') && 
                     !display.includes('pulse') && !display.includes('bp');
            }).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Test</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {encounterData.observations
                      .filter(obs => {
                        const display = obs.display?.toLowerCase() || '';
                        return !display.includes('blood pressure') && !display.includes('heart rate') && 
                               !display.includes('temperature') && !display.includes('weight') && 
                               !display.includes('height') && !display.includes('oxygen') && 
                               !display.includes('respiratory') && !display.includes('bmi') && 
                               !display.includes('pulse') && !display.includes('bp');
                      })
                      .map((observation) => (
                        <TableRow key={observation.id}>
                          <TableCell>
                            {format(new Date(observation.observation_date), 'MM/dd/yyyy')}
                          </TableCell>
                          <TableCell>{observation.display}</TableCell>
                          <TableCell>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {observation.value}
                            </Typography>
                          </TableCell>
                          <TableCell>{observation.value_unit}</TableCell>
                          <TableCell>
                            <Tooltip title="Edit lab result">
                              <IconButton 
                                size="small" 
                                onClick={() => onEdit('observation', observation)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No lab results recorded for this encounter</Alert>
            )}
          </TabPanel>

          {/* Vital Signs Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Vital Signs</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onEdit('observation', null)}
                size="small"
              >
                Add Vital Signs
              </Button>
            </Box>
            {encounterData.observations.filter(obs => {
              const display = obs.display?.toLowerCase() || '';
              return display.includes('blood pressure') || display.includes('heart rate') || 
                     display.includes('temperature') || display.includes('weight') || 
                     display.includes('height') || display.includes('oxygen') || 
                     display.includes('respiratory') || display.includes('bmi') || 
                     display.includes('pulse') || display.includes('bp');
            }).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Vital Sign</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {encounterData.observations
                      .filter(obs => {
                        const display = obs.display?.toLowerCase() || '';
                        return display.includes('blood pressure') || display.includes('heart rate') || 
                               display.includes('temperature') || display.includes('weight') || 
                               display.includes('height') || display.includes('oxygen') || 
                               display.includes('respiratory') || display.includes('bmi') || 
                               display.includes('pulse') || display.includes('bp');
                      })
                      .map((observation) => (
                        <TableRow key={observation.id}>
                          <TableCell>
                            {format(new Date(observation.observation_date), 'MM/dd/yyyy')}
                          </TableCell>
                          <TableCell>{observation.display}</TableCell>
                          <TableCell>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {observation.value}
                            </Typography>
                          </TableCell>
                          <TableCell>{observation.value_unit}</TableCell>
                          <TableCell>
                            <Tooltip title="Edit vital signs">
                              <IconButton 
                                size="small" 
                                onClick={() => onEdit('observation', observation)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No vital signs recorded for this encounter</Alert>
            )}
          </TabPanel>

          {/* Diagnoses Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Diagnoses & Conditions</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onEdit('condition', null)}
                size="small"
              >
                Add Diagnosis
              </Button>
            </Box>
            {encounterData.conditions.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ICD-10 Code</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Onset Date</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {encounterData.conditions.map((condition) => (
                      <TableRow key={condition.id}>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {condition.icd10_code}
                          </Typography>
                        </TableCell>
                        <TableCell>{condition.description}</TableCell>
                        <TableCell>
                          <Chip 
                            label={condition.clinical_status} 
                            color={getStatusColor(condition.clinical_status)} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          {format(new Date(condition.onset_date), 'MM/dd/yyyy')}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Edit condition">
                            <IconButton 
                              size="small" 
                              onClick={() => onEdit('condition', condition)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No diagnoses recorded for this encounter</Alert>
            )}
          </TabPanel>
        </Paper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EncounterDetail;