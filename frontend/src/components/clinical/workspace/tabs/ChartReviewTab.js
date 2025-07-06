/**
 * Chart Review Tab Component
 * Comprehensive view of patient's problems, medications, and allergies
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
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
  Button,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  LocalPharmacy as PharmacyIcon,
  Vaccines as ImmunizationIcon,
  FamilyRestroom as FamilyIcon,
  SmokingRooms as SmokingIcon,
  LocalBar as AlcoholIcon,
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Timeline as TimelineIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  ErrorOutline as SeverityIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import AddProblemDialog from '../dialogs/AddProblemDialog';
import EditProblemDialog from '../dialogs/EditProblemDialog';
import PrescribeMedicationDialog from '../dialogs/PrescribeMedicationDialog';
import EditMedicationDialog from '../dialogs/EditMedicationDialog';
import AddAllergyDialog from '../dialogs/AddAllergyDialog';
import EditAllergyDialog from '../dialogs/EditAllergyDialog';
import MedicationReconciliationDialog from '../dialogs/MedicationReconciliationDialog';
import fhirService from '../../../../services/fhirService';

// Problem List Component
const ProblemList = ({ conditions, patientId, onAddProblem, onEditProblem, onDeleteProblem }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditProblem = (condition) => {
    setSelectedCondition(condition);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedCondition(null);
  };

  const handleSaveProblem = async (updatedCondition) => {
    try {
      await onEditProblem(updatedCondition);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error updating problem:', error);
      throw error;
    }
  };

  const handleDeleteProblem = async (conditionId) => {
    try {
      await onDeleteProblem(conditionId);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error deleting problem:', error);
      throw error;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return 'error';
      case 'moderate': return 'warning';
      case 'mild': return 'info';
      default: return 'default';
    }
  };

  const filteredConditions = conditions.filter(condition => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && condition.clinicalStatus?.coding?.[0]?.code === 'active') ||
      (filter === 'resolved' && condition.clinicalStatus?.coding?.[0]?.code === 'resolved');
    
    const matchesSearch = !searchTerm || 
      (condition.code?.text || condition.code?.coding?.[0]?.display || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const activeCount = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active').length;
  const resolvedCount = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved').length;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>Problem List</Typography>
            <Stack direction="row" spacing={1}>
              <Chip 
                label={`${activeCount} Active`} 
                size="small" 
                color="primary" 
                variant={filter === 'active' ? 'filled' : 'outlined'}
                onClick={() => setFilter('active')}
              />
              <Chip 
                label={`${resolvedCount} Resolved`} 
                size="small" 
                variant={filter === 'resolved' ? 'filled' : 'outlined'}
                onClick={() => setFilter('resolved')}
              />
              <Chip 
                label="All" 
                size="small" 
                variant={filter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setFilter('all')}
              />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Problem">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => setShowAddDialog(true)}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View History">
              <IconButton size="small">
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <TextField
          fullWidth
          size="small"
          placeholder="Search problems..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredConditions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No problems found
            </Typography>
          ) : (
            filteredConditions.map((condition) => (
              <ListItem
                key={condition.id}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: expandedItems[condition.id] ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <ListItemIcon>
                  <ProblemIcon color={condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'warning' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
                      </Typography>
                      {condition.severity && (
                        <Chip 
                          label={condition.severity.text || condition.severity.coding?.[0]?.display} 
                          size="small" 
                          color={getSeverityColor(condition.severity.text)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {condition.onsetDateTime ? 
                          `Onset: ${format(parseISO(condition.onsetDateTime), 'MMM d, yyyy')}` : 
                          'Onset date unknown'}
                      </Typography>
                      {condition.note?.[0]?.text && expandedItems[condition.id] && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {condition.note[0].text}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit Problem">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditProblem(condition)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton 
                      size="small"
                      onClick={() => toggleExpanded(condition.id)}
                    >
                      {expandedItems[condition.id] ? <ExpandMoreIcon /> : <ExpandMoreIcon sx={{ transform: 'rotate(-90deg)' }} />}
                    </IconButton>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </CardContent>
      
      <AddProblemDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={onAddProblem}
        patientId={patientId}
      />
      
      <EditProblemDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        onSave={handleSaveProblem}
        onDelete={handleDeleteProblem}
        condition={selectedCondition}
        patientId={patientId}
      />
    </Card>
  );
};

// Medication List Component
const MedicationList = ({ medications, patientId, onPrescribeMedication, onEditMedication, onDeleteMedication }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const [expandedItems, setExpandedItems] = useState({});
  const [showPrescribeDialog, setShowPrescribeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  
  // Resolve medication references
  const { getMedicationDisplay, loading: resolvingMeds } = useMedicationResolver(medications);

  const handleEditMedication = (medication) => {
    setSelectedMedication(medication);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedMedication(null);
  };

  const handleSaveMedication = async (updatedMedication) => {
    try {
      await onEditMedication(updatedMedication);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      await onDeleteMedication(medicationId);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  };

  const handleReconciliation = async (reconciliationChanges) => {
    try {
      console.log('Applying medication reconciliation changes:', reconciliationChanges);
      
      // Apply each reconciliation change
      for (const change of reconciliationChanges) {
        if (change.type === 'add') {
          // Create new medication request from external source
          const newMedRequest = {
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            priority: 'routine',
            medicationCodeableConcept: {
              text: change.medication.name
            },
            subject: {
              reference: `Patient/${patientId}`
            },
            authoredOn: new Date().toISOString(),
            dosageInstruction: [{
              text: change.medication.dosage
            }],
            note: [{
              text: `Added via medication reconciliation from ${change.source}`
            }]
          };
          await onPrescribeMedication(newMedRequest);
        } else if (change.type === 'discontinue') {
          // Mark medication as stopped
          const updatedMed = {
            ...change.medication,
            status: 'stopped',
            note: [
              ...(change.medication.note || []),
              {
                text: `Discontinued via medication reconciliation from ${change.source}`,
                time: new Date().toISOString()
              }
            ]
          };
          await onEditMedication(updatedMed);
        } else if (change.type === 'modify') {
          // Update dosage
          const updatedMed = {
            ...change.medication,
            dosageInstruction: [{
              text: change.newDosage
            }],
            note: [
              ...(change.medication.note || []),
              {
                text: `Dosage updated via medication reconciliation from ${change.source}`,
                time: new Date().toISOString()
              }
            ]
          };
          await onEditMedication(updatedMed);
        }
      }
      
      console.log('Medication reconciliation completed successfully');
    } catch (error) {
      console.error('Error during medication reconciliation:', error);
      throw error;
    }
  };

  const filteredMedications = medications.filter(med => {
    return filter === 'all' || med.status === filter;
  });

  const activeCount = medications.filter(m => m.status === 'active').length;
  const stoppedCount = medications.filter(m => m.status === 'stopped' || m.status === 'completed').length;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>Medications</Typography>
            <Stack direction="row" spacing={1}>
              <Chip 
                label={`${activeCount} Active`} 
                size="small" 
                color="primary" 
                variant={filter === 'active' ? 'filled' : 'outlined'}
                onClick={() => setFilter('active')}
              />
              <Chip 
                label={`${stoppedCount} Stopped`} 
                size="small" 
                variant={filter === 'stopped' ? 'filled' : 'outlined'}
                onClick={() => setFilter('stopped')}
              />
              <Chip 
                label="All" 
                size="small" 
                variant={filter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setFilter('all')}
              />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Prescribe Medication">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => setShowPrescribeDialog(true)}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Medication Reconciliation">
              <IconButton 
                size="small" 
                onClick={() => setShowReconciliationDialog(true)}
              >
                <PharmacyIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <List sx={{ maxHeight: 400, overflow: 'auto', position: 'relative' }}>
          {resolvingMeds && (
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1
            }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {filteredMedications.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No medications found
            </Typography>
          ) : (
            filteredMedications.map((med) => (
              <ListItem
                key={med.id}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: med.status === 'active' ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <ListItemIcon>
                  <MedicationIcon color={med.status === 'active' ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box>
                      <Typography variant="body1">
                        {getMedicationDisplay(med)}
                      </Typography>
                      {med.status !== 'active' && (
                        <Chip label={med.status} size="small" sx={{ ml: 1 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption">
                        {med.dosageInstruction?.[0]?.text || 'No dosage information'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Prescribed: {med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit Medication">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => handleEditMedication(med)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </CardContent>
      
      <PrescribeMedicationDialog
        open={showPrescribeDialog}
        onClose={() => setShowPrescribeDialog(false)}
        onPrescribe={onPrescribeMedication}
        patientId={patientId}
      />
      
      <EditMedicationDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        onSave={handleSaveMedication}
        onDelete={handleDeleteMedication}
        medicationRequest={selectedMedication}
        patientId={patientId}
      />
      
      <MedicationReconciliationDialog
        open={showReconciliationDialog}
        onClose={() => setShowReconciliationDialog(false)}
        patientId={patientId}
        currentMedications={medications}
        onReconcile={handleReconciliation}
      />
    </Card>
  );
};

// Allergy List Component
const AllergyList = ({ allergies, patientId, onAddAllergy, onEditAllergy, onDeleteAllergy }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState(null);

  const getSeverityColor = (criticality) => {
    switch (criticality?.toLowerCase()) {
      case 'high': return 'error';
      case 'low': return 'warning';
      default: return 'info';
    }
  };

  const handleEditAllergy = (allergy) => {
    setSelectedAllergy(allergy);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedAllergy(null);
  };

  const handleSaveAllergy = async (updatedAllergy) => {
    try {
      await onEditAllergy(updatedAllergy);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error updating allergy:', error);
      throw error;
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    try {
      await onDeleteAllergy(allergyId);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error deleting allergy:', error);
      throw error;
    }
  };

  const activeAllergies = allergies.filter(a => a.clinicalStatus?.coding?.[0]?.code === 'active');

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>Allergies & Intolerances</Typography>
            <Chip 
              icon={<WarningIcon />}
              label={`${activeAllergies.length} Active`} 
              size="small" 
              color={activeAllergies.length > 0 ? 'error' : 'default'}
            />
          </Box>
          <Tooltip title="Add Allergy">
            <IconButton 
              size="small" 
              color="primary" 
              onClick={() => setShowAddDialog(true)}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {allergies.length === 0 ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              No known allergies
            </Alert>
          ) : (
            allergies.map((allergy) => (
              <ListItem
                key={allergy.id}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.1) }
                }}
              >
                <ListItemIcon>
                  <WarningIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'}
                      </Typography>
                      {allergy.criticality && (
                        <Chip 
                          label={allergy.criticality} 
                          size="small" 
                          color={getSeverityColor(allergy.criticality)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {allergy.reaction?.[0]?.manifestation?.map((m, idx) => (
                        <Chip 
                          key={idx}
                          label={m.text || m.coding?.[0]?.display} 
                          size="small" 
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      <Typography variant="caption" color="text.secondary" display="block">
                        Recorded: {allergy.recordedDate ? format(parseISO(allergy.recordedDate), 'MMM d, yyyy') : 'Unknown'}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit Allergy">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => handleEditAllergy(allergy)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </CardContent>
      
      <AddAllergyDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={onAddAllergy}
        patientId={patientId}
      />
      
      <EditAllergyDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        onSave={handleSaveAllergy}
        onDelete={handleDeleteAllergy}
        allergyIntolerance={selectedAllergy}
        patientId={patientId}
      />
    </Card>
  );
};

// Social History Component
const SocialHistory = ({ observations, patientId }) => {
  const socialObs = observations.filter(o => 
    o.category?.[0]?.coding?.[0]?.code === 'social-history'
  );

  const smokingStatus = socialObs.find(o => o.code?.coding?.[0]?.code === '72166-2');
  const alcoholUse = socialObs.find(o => o.code?.coding?.[0]?.code === '74013-4');

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Social History</Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <SmokingIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Smoking Status"
              secondary={smokingStatus?.valueCodeableConcept?.text || 'Not documented'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <AlcoholIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Alcohol Use"
              secondary={alcoholUse?.valueCodeableConcept?.text || 'Not documented'}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

const ChartReviewTab = ({ patientId, onNotificationUpdate }) => {
  const { 
    getPatientResources, 
    searchResources, 
    isLoading 
  } = useFHIRResource();
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Data is already loaded by FHIRResourceContext
    setLoading(false);
  }, []);

  const handleAddProblem = async (condition) => {
    try {
      console.log('Adding new problem:', condition);
      const createdCondition = await fhirService.createCondition(condition);
      console.log('Problem created successfully:', createdCondition);
      
      // Refresh the patient resources to show the new condition
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Problem added successfully'
        });
      }
    } catch (error) {
      console.error('Error adding problem:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to add problem: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handlePrescribeMedication = async (medicationRequest) => {
    try {
      console.log('Prescribing new medication:', medicationRequest);
      const createdMedication = await fhirService.createMedicationRequest(medicationRequest);
      console.log('Medication prescribed successfully:', createdMedication);
      
      // Refresh the patient resources to show the new medication
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Medication prescribed successfully'
        });
      }
    } catch (error) {
      console.error('Error prescribing medication:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to prescribe medication: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleAddAllergy = async (allergyIntolerance) => {
    try {
      console.log('Adding new allergy:', allergyIntolerance);
      const createdAllergy = await fhirService.createAllergyIntolerance(allergyIntolerance);
      console.log('Allergy added successfully:', createdAllergy);
      
      // Refresh the patient resources to show the new allergy
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Allergy added successfully'
        });
      }
    } catch (error) {
      console.error('Error adding allergy:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to add allergy: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleEditProblem = async (updatedCondition) => {
    try {
      console.log('Updating problem:', updatedCondition);
      const result = await fhirService.updateCondition(updatedCondition.id, updatedCondition);
      console.log('Problem updated successfully:', result);
      
      // Refresh the patient resources to show the updated condition
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Problem updated successfully'
        });
      }
    } catch (error) {
      console.error('Error updating problem:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to update problem: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleDeleteProblem = async (conditionId) => {
    try {
      console.log('Deleting problem:', conditionId);
      await fhirService.deleteCondition(conditionId);
      console.log('Problem deleted successfully');
      
      // Refresh the patient resources to remove the deleted condition
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Problem deleted successfully'
        });
      }
    } catch (error) {
      console.error('Error deleting problem:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to delete problem: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleEditMedication = async (updatedMedicationRequest) => {
    try {
      console.log('Updating medication:', updatedMedicationRequest);
      const result = await fhirService.updateMedicationRequest(updatedMedicationRequest.id, updatedMedicationRequest);
      console.log('Medication updated successfully:', result);
      
      // Refresh the patient resources to show the updated medication
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Medication updated successfully'
        });
      }
    } catch (error) {
      console.error('Error updating medication:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to update medication: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      console.log('Deleting medication:', medicationId);
      await fhirService.deleteMedicationRequest(medicationId);
      console.log('Medication deleted successfully');
      
      // Refresh the patient resources to remove the deleted medication
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Medication deleted successfully'
        });
      }
    } catch (error) {
      console.error('Error deleting medication:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to delete medication: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleEditAllergy = async (updatedAllergyIntolerance) => {
    try {
      console.log('Updating allergy:', updatedAllergyIntolerance);
      const result = await fhirService.updateAllergyIntolerance(updatedAllergyIntolerance.id, updatedAllergyIntolerance);
      console.log('Allergy updated successfully:', result);
      
      // Refresh the patient resources to show the updated allergy
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Allergy updated successfully'
        });
      }
    } catch (error) {
      console.error('Error updating allergy:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to update allergy: ${error.message}`
        });
      }
      throw error;
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    try {
      console.log('Deleting allergy:', allergyId);
      await fhirService.deleteAllergyIntolerance(allergyId);
      console.log('Allergy deleted successfully');
      
      // Refresh the patient resources to remove the deleted allergy
      await fhirService.refreshPatientResources(patientId);
      
      // Optionally show a success message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'success',
          message: 'Allergy deleted successfully'
        });
      }
    } catch (error) {
      console.error('Error deleting allergy:', error);
      
      // Show error message
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: `Failed to delete allergy: ${error.message}`
        });
      }
      throw error;
    }
  };

  // Get resources
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];
  const immunizations = getPatientResources(patientId, 'Immunization') || [];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Problem List */}
        <Grid item xs={12} lg={6}>
          <ProblemList 
            conditions={conditions} 
            patientId={patientId} 
            onAddProblem={handleAddProblem}
            onEditProblem={handleEditProblem}
            onDeleteProblem={handleDeleteProblem}
          />
        </Grid>

        {/* Medications */}
        <Grid item xs={12} lg={6}>
          <MedicationList 
            medications={medications} 
            patientId={patientId} 
            onPrescribeMedication={handlePrescribeMedication}
            onEditMedication={handleEditMedication}
            onDeleteMedication={handleDeleteMedication}
          />
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} lg={6}>
          <AllergyList 
            allergies={allergies} 
            patientId={patientId} 
            onAddAllergy={handleAddAllergy}
            onEditAllergy={handleEditAllergy}
            onDeleteAllergy={handleDeleteAllergy}
          />
        </Grid>

        {/* Social History */}
        <Grid item xs={12} lg={6}>
          <SocialHistory observations={observations} patientId={patientId} />
        </Grid>

        {/* Immunizations Summary */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Immunizations</Typography>
                <Chip 
                  icon={<ImmunizationIcon />}
                  label={`${immunizations.length} recorded`} 
                  size="small" 
                  color="success"
                />
              </Stack>
              {immunizations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No immunization records found
                </Typography>
              ) : (
                <Typography variant="body2">
                  Last immunization: {
                    immunizations[0]?.occurrenceDateTime ? 
                    format(parseISO(immunizations[0].occurrenceDateTime), 'MMM d, yyyy') : 
                    'Unknown'
                  }
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ChartReviewTab;