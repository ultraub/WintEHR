/**
 * Patient Overview Component
 * Displays summary information about the patient
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  IconButton,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Warning as WarningIcon,
  Medication as MedicationIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon,
  EventNote as EventNoteIcon,
  Timeline as TimelineIcon,
  Vaccines as VaccinesIcon,
  MonitorHeart as VitalsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useClinical } from '../../contexts/ClinicalContext';
import api from '../../services/api';

const PatientOverview = () => {
  const { currentPatient, currentEncounter, setWorkspaceMode, refreshPatientData } = useClinical();
  
  // Dialog states
  const [allergiesDialog, setAllergiesDialog] = useState(false);
  const [medicationsDialog, setMedicationsDialog] = useState(false);
  const [problemsDialog, setProblemsDialog] = useState(false);
  const [recentVitals, setRecentVitals] = useState(null);
  
  // Form states
  const [newAllergy, setNewAllergy] = useState({ allergen: '', severity: 'mild', reaction: '' });
  const [newMedication, setNewMedication] = useState({ medication_name: '', dosage: '', frequency: '', status: 'active', source: 'prescribed' });
  const [newProblem, setNewProblem] = useState({ description: '', clinical_status: 'active', snomed_code: '', icd10_code: '' });
  
  // Edit/Delete states
  const [editingMedication, setEditingMedication] = useState(null);
  const [editingProblem, setEditingProblem] = useState(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, type: null, item: null });
  
  // Load recent vitals on mount
  useEffect(() => {
    const loadRecentVitals = async () => {
      if (!currentPatient?.id) return;
      
      try {
        const response = await api.get('/api/observations', {
          params: {
            patient_id: currentPatient.id,
            observation_type: 'vital-signs',
            limit: 10
          }
        });
        
        // Process vitals data
        const vitalsData = response.data;
        if (vitalsData.length > 0) {
          // Group by observation type and get most recent
          const vitalsMap = {};
          vitalsData.forEach(vital => {
            const displayName = vital.display || '';
            // Normalize display names for consistent mapping
            let type = displayName.toLowerCase();
            
            // Map common vital signs to standardized keys
            if (displayName.includes('Blood pressure panel')) {
              // Handle blood pressure separately as it contains multiple values
              // We'll need to look for systolic and diastolic separately
            } else if (displayName === 'Heart rate') {
              type = 'heart rate';
            } else if (displayName === 'Body Temperature' || displayName.includes('Temperature')) {
              type = 'body temperature';
            } else if (displayName.includes('Oxygen saturation')) {
              type = 'oxygen saturation';
            }
            
            if (!vitalsMap[type] || new Date(vital.observation_date) > new Date(vitalsMap[type].observation_date)) {
              vitalsMap[type] = vital;
            }
          });
          
          setRecentVitals({
            bloodPressure: vitalsMap['blood pressure']?.value || vitalsMap['systolic blood pressure']?.value_quantity && vitalsMap['diastolic blood pressure']?.value_quantity 
              ? `${vitalsMap['systolic blood pressure']?.value_quantity}/${vitalsMap['diastolic blood pressure']?.value_quantity}`
              : null,
            heartRate: vitalsMap['heart rate']?.value_quantity,
            temperature: vitalsMap['body temperature']?.value_quantity,
            oxygenSaturation: vitalsMap['oxygen saturation']?.value_quantity,
            recordedAt: vitalsData[0].observation_date
          });
        }
      } catch (error) {
        console.error('Error loading recent vitals:', error);
      }
    };
    
    loadRecentVitals();
  }, [currentPatient?.id]);

  // Handler functions
  const handleAddAllergy = async () => {
    try {
      await api.post('/api/allergies', {
        patient_id: currentPatient.id,
        ...newAllergy
      });
      setAllergiesDialog(false);
      setNewAllergy({ allergen: '', severity: 'mild', reaction: '' });
      refreshPatientData();
    } catch (error) {
      console.error('Error adding allergy:', error);
    }
  };

  const handleAddMedication = async () => {
    try {
      if (editingMedication) {
        // Update existing medication
        await api.put(`/api/medications/${editingMedication.id}`, {
          medication_name: newMedication.medication_name,
          dosage: newMedication.dosage,
          frequency: newMedication.frequency,
          status: newMedication.status
        });
      } else {
        // Create new medication
        await api.post('/api/medications', {
          patient_id: currentPatient.id,
          start_date: new Date().toISOString().split('T')[0],
          ...newMedication
        });
      }
      setMedicationsDialog(false);
      setNewMedication({ medication_name: '', dosage: '', frequency: '', status: 'active' });
      setEditingMedication(null);
      refreshPatientData();
    } catch (error) {
      console.error('Error saving medication:', error);
    }
  };
  
  const handleEditMedication = (medication) => {
    console.log('Editing medication:', medication);
    setEditingMedication(medication);
    setNewMedication({
      medication_name: medication.medication_name || medication.medication || '',
      dosage: medication.dosage || '',
      frequency: medication.frequency || '',
      status: medication.status || 'active',
      source: medication.source || 'prescribed'
    });
    setMedicationsDialog(true);
  };
  
  const handleDeleteMedication = async (medication) => {
    try {
      await api.delete(`/api/medications/${medication.id}`);
      refreshPatientData();
      setDeleteConfirmDialog({ open: false, type: null, item: null });
    } catch (error) {
      console.error('Error deleting medication:', error);
    }
  };

  const handleAddProblem = async () => {
    try {
      if (editingProblem) {
        // Update existing problem
        const updateData = {
          description: newProblem.description,
          clinical_status: newProblem.clinical_status
        };
        
        // Only add optional fields if they have values
        if (newProblem.snomed_code) updateData.snomed_code = newProblem.snomed_code;
        if (newProblem.icd10_code) updateData.icd10_code = newProblem.icd10_code;
        
        await api.put(`/api/conditions/${editingProblem.id}`, updateData);
      } else {
        // Create new problem
        const problemData = {
          patient_id: currentPatient.id,
          description: newProblem.description,
          clinical_status: newProblem.clinical_status,
          verification_status: "confirmed"
        };
        
        // Only add optional fields if they have values
        if (newProblem.snomed_code) problemData.snomed_code = newProblem.snomed_code;
        if (newProblem.icd10_code) problemData.icd10_code = newProblem.icd10_code;
        
        await api.post('/api/conditions', problemData);
      }
      setProblemsDialog(false);
      setNewProblem({ description: '', clinical_status: 'active', snomed_code: '', icd10_code: '' });
      setEditingProblem(null);
      refreshPatientData();
    } catch (error) {
      console.error('Error saving problem:', error);
      console.error('Error details:', error.response?.data);
      alert(`Error saving problem: ${error.response?.data?.detail || error.message}`);
    }
  };
  
  const handleEditProblem = (problem) => {
    setEditingProblem(problem);
    setNewProblem({
      description: problem.description || '',
      clinical_status: problem.clinical_status || problem.clinicalStatus || 'active',
      snomed_code: problem.snomed_code || '',
      icd10_code: problem.icd10_code || ''
    });
    setProblemsDialog(true);
  };
  
  const handleDeleteProblem = async (problem) => {
    try {
      await api.delete(`/api/conditions/${problem.id}`);
      refreshPatientData();
      setDeleteConfirmDialog({ open: false, type: null, item: null });
    } catch (error) {
      console.error('Error deleting problem:', error);
    }
  };
  
  const handleRenewMedication = (medication) => {
    // Store medication data in sessionStorage to pass to Orders tab
    const orderData = {
      medicationName: medication.medication_name || medication.medication,
      dosage: medication.dosage,
      frequency: medication.frequency,
      route: medication.route || 'oral', // Default to oral if not specified
      source: 'renewal',
      originalMedicationId: medication.id
    };
    
    sessionStorage.setItem('pendingMedicationOrder', JSON.stringify(orderData));
    setWorkspaceMode('orders');
  };

  if (!currentPatient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Loading patient data...</Alert>
      </Box>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'severe':
      case 'high':
        return 'error';
      case 'moderate':
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getStatusChip = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Chip label="Active" size="small" color="primary" />;
      case 'resolved':
        return <Chip label="Resolved" size="small" color="default" />;
      case 'inactive':
        return <Chip label="Inactive" size="small" color="default" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Allergies Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <WarningIcon color="error" />
                  <Typography variant="h6">Allergies</Typography>
                </Box>
                <Button 
                  size="small" 
                  startIcon={<AddIcon />}
                  onClick={() => setAllergiesDialog(true)}
                >
                  Add New
                </Button>
              </Box>
              
              {currentPatient.allergies && currentPatient.allergies.length > 0 ? (
                <List dense>
                  {currentPatient.allergies.slice(0, 5).map((allergy, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={
                          <>
                            <span style={{ marginRight: '8px' }}>{allergy.allergen}</span>
                            <Chip 
                              label={allergy.severity} 
                              size="small" 
                              color={getSeverityColor(allergy.severity)}
                              style={{ verticalAlign: 'middle' }}
                            />
                          </>
                        }
                        secondary={`Reaction: ${allergy.reaction || 'Not specified'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No known allergies
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Active Medications Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <MedicationIcon color="primary" />
                  <Typography variant="h6">Medications</Typography>
                  <Typography variant="caption" color="text.secondary">
                    (Prescribed & Self-Reported)
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button 
                    size="small" 
                    startIcon={<AddIcon />}
                    onClick={() => setMedicationsDialog(true)}
                  >
                    Add New
                  </Button>
                  <Tooltip title="Prescribe new medication">
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => setWorkspaceMode('orders')}
                    >
                      <AssignmentIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {currentPatient.medications && currentPatient.medications.filter(m => m.status === 'active').length > 0 ? (
                <List dense>
                  {currentPatient.medications
                    .filter(m => m.status === 'active')
                    .slice(0, 5)
                    .map((med, index) => (
                      <ListItem 
                        key={med.id || index}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Renew medication">
                              <IconButton 
                                size="small" 
                                onClick={() => handleRenewMedication(med)}
                                color="success"
                                edge="end"
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditMedication(med)}
                              color="primary"
                              edge="end"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={() => setDeleteConfirmDialog({ open: true, type: 'medication', item: med })}
                              color="error"
                              edge="end"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <>
                              <span style={{ marginRight: '8px' }}>
                                {med.medication_name || med.medication || 'Unknown medication'}
                              </span>
                              {med.source === 'self-reported' && (
                                <Chip label="Self-Reported" size="small" color="info" variant="outlined" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                              )}
                              {med.source === 'otc' && (
                                <Chip label="OTC" size="small" color="default" variant="outlined" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                              )}
                              {med.source === 'supplement' && (
                                <Chip label="Supplement" size="small" color="success" variant="outlined" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                              )}
                            </>
                          }
                          secondary={`${med.dosage || 'No dosage'} - ${med.frequency || 'No frequency'}`}
                        />
                      </ListItem>
                    ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active medications
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Problem List */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EventNoteIcon color="warning" />
                  <Typography variant="h6">Problem List</Typography>
                </Box>
                <Button 
                  size="small" 
                  startIcon={<AddIcon />}
                  onClick={() => setProblemsDialog(true)}
                >
                  Add New
                </Button>
              </Box>
              
              {currentPatient.problems && currentPatient.problems.length > 0 ? (
                <List dense>
                  {currentPatient.problems.slice(0, 5).map((problem, index) => (
                    <ListItem 
                      key={problem.id || index}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditProblem(problem)}
                            color="primary"
                            edge="end"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => setDeleteConfirmDialog({ open: true, type: 'problem', item: problem })}
                            color="error"
                            edge="end"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <>
                            <span style={{ marginRight: '8px' }}>{problem.description}</span>
                            {problem.snomed_code && (
                              <Chip 
                                label={`SNOMED: ${problem.snomed_code}`} 
                                size="small" 
                                variant="outlined"
                                color="info"
                                style={{ marginLeft: '4px', verticalAlign: 'middle' }}
                              />
                            )}
                            {problem.icd10_code && (
                              <Chip 
                                label={`ICD-10: ${problem.icd10_code}`} 
                                size="small" 
                                variant="outlined"
                                color="secondary"
                                style={{ marginLeft: '4px', verticalAlign: 'middle' }}
                              />
                            )}
                            <span style={{ marginLeft: '4px' }}>
                              {getStatusChip(problem.clinical_status || problem.clinicalStatus)}
                            </span>
                          </>
                        }
                        secondary={
                          <>
                            {problem.onset_date || problem.onset ? (
                              <span style={{ fontSize: '0.75rem' }}>
                                Onset: {format(new Date(problem.onset_date || problem.onset), 'MM/dd/yyyy')}
                              </span>
                            ) : null}
                            {problem.verification_status && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '8px' }}>
                                Status: {problem.verification_status}
                              </span>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active problems
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Vitals */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <VitalsIcon color="info" />
                  <Typography variant="h6">Recent Vitals</Typography>
                </Box>
                <Button 
                  size="small" 
                  onClick={() => {
                    // Switch to results tab to view vitals and observations
                    setWorkspaceMode('results');
                  }}
                >
                  View All
                </Button>
              </Box>
              
              {recentVitals ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Blood Pressure</Typography>
                      <Typography variant="body1">
                        {recentVitals.bloodPressure || '--/--'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Heart Rate</Typography>
                      <Typography variant="body1">
                        {recentVitals.heartRate || '--'} bpm
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Temperature</Typography>
                      <Typography variant="body1">
                        {recentVitals.temperature || '--'}°F
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">SpO2</Typography>
                      <Typography variant="body1">
                        {recentVitals.oxygenSaturation || '--'}%
                      </Typography>
                    </Grid>
                  </Grid>
                  {recentVitals.recordedAt && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Recorded: {format(new Date(recentVitals.recordedAt), 'MM/dd/yyyy h:mm a')}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent vitals recorded
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <HospitalIcon color="primary" />
                  <Typography variant="h6">Recent Encounters</Typography>
                </Box>
                <Button 
                  size="small" 
                  onClick={() => {
                    // Switch to documentation tab to view encounter history
                    setWorkspaceMode('documentation');
                  }}
                >
                  View All
                </Button>
              </Box>
              
              {currentPatient.recentEncounters && currentPatient.recentEncounters.length > 0 ? (
                <List>
                  {currentPatient.recentEncounters.slice(0, 3).map((encounter, index) => (
                    <React.Fragment key={encounter.id}>
                      <ListItem>
                        <ListItemIcon>
                          <HospitalIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <>
                              <span style={{ marginRight: '8px', fontSize: '1rem' }}>{encounter.type}</span>
                              <Chip 
                                label={encounter.status} 
                                size="small" 
                                color={encounter.status === 'in-progress' ? 'primary' : 'default'}
                                style={{ verticalAlign: 'middle' }}
                              />
                            </>
                          }
                          secondary={
                            <>
                              <span style={{ display: 'block', fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                                {format(new Date(encounter.date), 'MM/dd/yyyy h:mm a')}
                              </span>
                              {encounter.provider && (
                                <span style={{ display: 'block', fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                                  Provider: {encounter.provider}
                                </span>
                              )}
                              {encounter.chiefComplaint && (
                                <span style={{ display: 'block', fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                                  Chief Complaint: {encounter.chiefComplaint}
                                </span>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                      {index < currentPatient.recentEncounters.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent encounters
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Quick Actions</Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Button 
                variant="contained" 
                startIcon={<AssignmentIcon />}
                onClick={() => setWorkspaceMode('documentation')}
              >
                Create Note
              </Button>
              <Button 
                variant="contained" 
                startIcon={<MedicationIcon />}
                onClick={() => setWorkspaceMode('orders')}
              >
                Prescribe Medication
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<TimelineIcon />}
                onClick={() => setWorkspaceMode('results')}
              >
                View Timeline
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<VaccinesIcon />}
                onClick={() => setWorkspaceMode('results')}
              >
                Immunizations
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Allergy Management Dialog */}
      <Dialog open={allergiesDialog} onClose={() => setAllergiesDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Allergies</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Allergen"
              value={newAllergy.allergen}
              onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })}
              required
            />

            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={newAllergy.severity}
                label="Severity"
                onChange={(e) => setNewAllergy({ ...newAllergy, severity: e.target.value })}
              >
                <MenuItem value="mild">Mild</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="severe">Severe</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Reaction"
              value={newAllergy.reaction}
              onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })}
              placeholder="Describe the allergic reaction"
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllergiesDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddAllergy} 
            variant="contained"
            disabled={!newAllergy.allergen}
          >
            Add Allergy
          </Button>
        </DialogActions>
      </Dialog>

      {/* Medication Management Dialog */}
      <Dialog open={medicationsDialog} onClose={() => {
        setMedicationsDialog(false);
        setEditingMedication(null);
        setNewMedication({ medication_name: '', dosage: '', frequency: '', status: 'active', source: 'prescribed' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMedication ? 'Edit Medication' : 'Add New Medication'}</DialogTitle>
        <DialogContent>
          {!editingMedication && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Use this form to add self-reported medications, OTC drugs, or supplements. 
              To prescribe new medications, use the "Prescribe Medication" button or go to the Orders tab.
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Medication Name"
              value={newMedication.medication_name}
              onChange={(e) => setNewMedication({ ...newMedication, medication_name: e.target.value })}
              required
            />

            <TextField
              fullWidth
              label="Dosage"
              value={newMedication.dosage}
              onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
              placeholder="e.g., 10mg"
            />

            <TextField
              fullWidth
              label="Frequency"
              value={newMedication.frequency}
              onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
              placeholder="e.g., twice daily"
            />

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newMedication.status}
                label="Status"
                onChange={(e) => setNewMedication({ ...newMedication, status: e.target.value })}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="stopped">Stopped</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Source</InputLabel>
              <Select
                value={newMedication.source}
                label="Source"
                onChange={(e) => setNewMedication({ ...newMedication, source: e.target.value })}
              >
                <MenuItem value="prescribed">Prescribed by Provider</MenuItem>
                <MenuItem value="self-reported">Self-Reported</MenuItem>
                <MenuItem value="otc">Over-the-Counter</MenuItem>
                <MenuItem value="supplement">Supplement/Vitamin</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMedicationsDialog(false);
            setEditingMedication(null);
            setNewMedication({ medication_name: '', dosage: '', frequency: '', status: 'active', source: 'prescribed' });
          }}>Cancel</Button>
          <Button 
            onClick={handleAddMedication} 
            variant="contained"
            disabled={!newMedication.medication_name}
          >
            {editingMedication ? 'Update Medication' : 'Add Medication'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Problem Management Dialog */}
      <Dialog open={problemsDialog} onClose={() => {
        setProblemsDialog(false);
        setEditingProblem(null);
        setNewProblem({ description: '', clinical_status: 'active', snomed_code: '', icd10_code: '' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProblem ? 'Edit Problem' : 'Add New Problem'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Problem Description"
              value={newProblem.description}
              onChange={(e) => setNewProblem({ ...newProblem, description: e.target.value })}
              required
              multiline
              rows={2}
            />

            <FormControl fullWidth>
              <InputLabel>Clinical Status</InputLabel>
              <Select
                value={newProblem.clinical_status}
                label="Clinical Status"
                onChange={(e) => setNewProblem({ ...newProblem, clinical_status: e.target.value })}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="SNOMED Code"
              value={newProblem.snomed_code}
              onChange={(e) => setNewProblem({ ...newProblem, snomed_code: e.target.value })}
              placeholder="Optional SNOMED-CT code"
            />

            <TextField
              fullWidth
              label="ICD-10 Code"
              value={newProblem.icd10_code}
              onChange={(e) => setNewProblem({ ...newProblem, icd10_code: e.target.value })}
              placeholder="Optional ICD-10 code"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setProblemsDialog(false);
            setEditingProblem(null);
            setNewProblem({ description: '', clinical_status: 'active', snomed_code: '', icd10_code: '' });
          }}>Cancel</Button>
          <Button 
            onClick={handleAddProblem} 
            variant="contained"
            disabled={!newProblem.description}
          >
            {editingProblem ? 'Update Problem' : 'Add Problem'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmDialog.open} 
        onClose={() => setDeleteConfirmDialog({ open: false, type: null, item: null })}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this {deleteConfirmDialog.type}?
            {deleteConfirmDialog.item && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  {deleteConfirmDialog.type === 'medication' 
                    ? `${deleteConfirmDialog.item.medication_name || deleteConfirmDialog.item.medication} - ${deleteConfirmDialog.item.dosage}`
                    : deleteConfirmDialog.item.description
                  }
                </Typography>
              </Box>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmDialog({ open: false, type: null, item: null })}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (deleteConfirmDialog.type === 'medication') {
                handleDeleteMedication(deleteConfirmDialog.item);
              } else if (deleteConfirmDialog.type === 'problem') {
                handleDeleteProblem(deleteConfirmDialog.item);
              }
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientOverview;