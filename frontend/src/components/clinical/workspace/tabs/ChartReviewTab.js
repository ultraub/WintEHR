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
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  useTheme,
  alpha,
  Snackbar,
  Backdrop
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
import fhirClient from '../../../../services/fhirClient';
import { intelligentCache } from '../../../../utils/intelligentCache';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../utils/exportUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

// Problem List Component
const ProblemList = ({ conditions, patientId, onAddProblem, onEditProblem, onDeleteProblem, onExport }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

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
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleDeleteProblem = async (conditionId) => {
    try {
      await onDeleteProblem(conditionId);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
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
            <Tooltip title="Export">
              <IconButton 
                size="small"
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
              >
                <ExportIcon />
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
      
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { onExport('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { onExport('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { onExport('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
    </Card>
  );
};

// Medication List Component
const MedicationList = ({ medications, patientId, onPrescribeMedication, onEditMedication, onDeleteMedication, onExport }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const [expandedItems, setExpandedItems] = useState({});
  const [showPrescribeDialog, setShowPrescribeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  
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
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      await onDeleteMedication(medicationId);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleReconciliation = async (reconciliationChanges) => {
    try {
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
      
      // Medication reconciliation completed successfully
    } catch (error) {
      // Error during medication reconciliation
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
            <Tooltip title="Export">
              <IconButton 
                size="small"
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
              >
                <ExportIcon />
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
      
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { onExport('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { onExport('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { onExport('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
    </Card>
  );
};

// Allergy List Component
const AllergyList = ({ allergies, patientId, onAddAllergy, onEditAllergy, onDeleteAllergy, onExport }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

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
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    try {
      await onDeleteAllergy(allergyId);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
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
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Allergy">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => setShowAddDialog(true)}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton 
                size="small"
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
              >
                <ExportIcon />
              </IconButton>
            </Tooltip>
          </Stack>
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
      
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { onExport('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { onExport('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { onExport('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
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
    isLoading,
    refreshPatientResources,
    currentPatient 
  } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [loading, setLoading] = useState(true);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render after updates

  useEffect(() => {
    // Data is already loaded by FHIRResourceContext
    setLoading(false);
  }, []);

  const handleAddProblem = async (condition) => {
    try {
      const createdCondition = await fhirClient.createCondition(condition);
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handlePrescribeMedication = async (medicationRequest) => {
    try {
      const createdMedication = await fhirClient.createMedicationRequest(medicationRequest);
      
      // Publish workflow event
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'created',
        data: {
          ...createdMedication,
          medicationName: createdMedication.medicationCodeableConcept?.text ||
                         createdMedication.medicationCodeableConcept?.coding?.[0]?.display ||
                         'Unknown medication',
          patientId
        }
      });
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handleAddAllergy = async (allergyIntolerance) => {
    try {
      const createdAllergy = await fhirClient.createAllergyIntolerance(allergyIntolerance);
      
      // Publish workflow event for new allergy
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'allergy-notification',
        step: 'created',
        data: {
          ...createdAllergy,
          allergenName: createdAllergy.code?.text || 
                       createdAllergy.code?.coding?.[0]?.display || 
                       'Unknown allergen',
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handleEditProblem = async (updatedCondition) => {
    setSaveInProgress(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const result = await fhirClient.updateCondition(updatedCondition.id, updatedCondition);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      return result;
    } catch (error) {
      setSaveError(error.message || 'Failed to update problem');
      throw error;
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleDeleteProblem = async (conditionId) => {
    try {
      await fhirClient.deleteCondition(conditionId);
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      // Refresh completed successfully
    } catch (error) {
      throw error;
    }
  };

  const handleEditMedication = async (updatedMedicationRequest) => {
    setSaveInProgress(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const result = await fhirClient.updateMedicationRequest(updatedMedicationRequest.id, updatedMedicationRequest);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      return result;
    } catch (error) {
      setSaveError(error.message || 'Failed to update medication');
      throw error;
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      await fhirClient.deleteMedicationRequest(medicationId);
      
      // Refresh the patient resources to remove the deleted medication
      await refreshPatientResources(patientId);
      
      // Refresh completed successfully
    } catch (error) {
      throw error;
    }
  };

  const handleEditAllergy = async (updatedAllergyIntolerance) => {
    setSaveInProgress(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const result = await fhirClient.updateAllergyIntolerance(updatedAllergyIntolerance.id, updatedAllergyIntolerance);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      setRefreshKey(prev => prev + 1);
      
      return result;
    } catch (error) {
      setSaveError(error.message || 'Failed to update allergy');
      throw error;
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    try {
      await fhirClient.deleteAllergyIntolerance(allergyId);
      
      // Refresh the patient resources to remove the deleted allergy
      await refreshPatientResources(patientId);
      
      // Refresh completed successfully
    } catch (error) {
      throw error;
    }
  };

  // Export handlers
  const handleExportProblems = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: conditions,
      columns: EXPORT_COLUMNS.conditions,
      format,
      title: 'Problem_List',
      formatForPrint: (data) => {
        let html = '<h2>Problem List</h2>';
        data.forEach(condition => {
          html += `
            <div class="section">
              <h3>${condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}</h3>
              <p><strong>Status:</strong> ${condition.clinicalStatus?.coding?.[0]?.code || 'Unknown'}</p>
              ${condition.severity ? `<p><strong>Severity:</strong> ${condition.severity.text}</p>` : ''}
              <p><strong>Onset:</strong> ${condition.onsetDateTime ? format(parseISO(condition.onsetDateTime), 'MMM d, yyyy') : 'Unknown'}</p>
              ${condition.note?.[0]?.text ? `<p><strong>Notes:</strong> ${condition.note[0].text}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  };

  const handleExportMedications = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: medications,
      columns: EXPORT_COLUMNS.medications,
      format,
      title: 'Medication_List',
      formatForPrint: (data) => {
        let html = '<h2>Medication List</h2>';
        data.forEach(med => {
          html += `
            <div class="section">
              <h3>${med.medicationCodeableConcept?.text || med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown'}</h3>
              <p><strong>Status:</strong> ${med.status}</p>
              ${med.dosageInstruction?.[0]?.text ? `<p><strong>Dosage:</strong> ${med.dosageInstruction[0].text}</p>` : ''}
              <p><strong>Prescribed:</strong> ${med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}</p>
              ${med.requester?.display ? `<p><strong>Prescriber:</strong> ${med.requester.display}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  };

  const handleExportAllergies = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: allergies,
      columns: EXPORT_COLUMNS.allergies,
      format,
      title: 'Allergy_List',
      formatForPrint: (data) => {
        let html = '<h2>Allergy List</h2>';
        data.forEach(allergy => {
          html += `
            <div class="section">
              <h3>${allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'}</h3>
              <p><strong>Type:</strong> ${allergy.type || 'Unknown'}</p>
              <p><strong>Criticality:</strong> ${allergy.criticality || 'Unknown'}</p>
              ${allergy.reaction?.[0]?.manifestation?.[0]?.text ? 
                `<p><strong>Reaction:</strong> ${allergy.reaction[0].manifestation[0].text}</p>` : ''}
              <p><strong>Recorded:</strong> ${allergy.recordedDate ? format(parseISO(allergy.recordedDate), 'MMM d, yyyy') : 'Unknown'}</p>
            </div>
          `;
        });
        return html;
      }
    });
  };

  // Get resources - with refreshKey to force updates
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const observations = getPatientResources(patientId, 'Observation') || [];
  const immunizations = getPatientResources(patientId, 'Immunization') || [];
  
  // Load conditions, medications, and allergies with refresh capability
  useEffect(() => {
    const loadResources = async () => {
      try {
        // Force refresh only when refreshKey changes (after updates)
        const forceRefresh = refreshKey > 0;
        
        // Clear intelligent cache when force refreshing
        if (forceRefresh) {
          // Clear the intelligent cache for this patient's conditions
          const conditionParams = { patient: patientId, _count: 1000, _sort: '-recorded-date' };
          const conditionCacheKey = `searches:Condition_${JSON.stringify(conditionParams)}`;
          intelligentCache.delete(conditionCacheKey);
          
          const medicationParams = { patient: patientId, _count: 1000, _sort: '-authored' };
          const medicationCacheKey = `searches:MedicationRequest_${JSON.stringify(medicationParams)}`;
          intelligentCache.delete(medicationCacheKey);
          
          const allergyParams = { patient: patientId, _count: 1000, _sort: '-date' };
          const allergyCacheKey = `searches:AllergyIntolerance_${JSON.stringify(allergyParams)}`;
          intelligentCache.delete(allergyCacheKey);
        }
        
        // Load conditions
        const conditionsResult = await searchResources('Condition', { 
          patient: patientId, 
          _count: 1000, 
          _sort: '-recorded-date' 
        }, forceRefresh);
        // Set conditions from result
        setConditions(conditionsResult.resources || []);
        
        // Load medications
        const medicationsResult = await searchResources('MedicationRequest', { 
          patient: patientId, 
          _count: 1000, 
          _sort: '-authored' 
        }, forceRefresh);
        setMedications(medicationsResult.resources || []);
        
        // Load allergies
        const allergiesResult = await searchResources('AllergyIntolerance', { 
          patient: patientId, 
          _count: 1000, 
          _sort: '-date' 
        }, forceRefresh);
        setAllergies(allergiesResult.resources || []);
      } catch (error) {
        // Error loading resources - UI will show appropriate message
      }
    };
    
    if (patientId) {
      loadResources();
    }
  }, [patientId, refreshKey]); // Remove searchResources from dependencies to prevent loops

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {/* Save Progress Overlay */}
      <Backdrop
        sx={{ 
          position: 'absolute',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(255, 255, 255, 0.7)'
        }}
        open={saveInProgress}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      {/* Success/Error Notifications */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Changes saved successfully!
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!saveError}
        autoHideDuration={6000}
        onClose={() => setSaveError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveError(null)} severity="error" sx={{ width: '100%' }}>
          {saveError || 'Failed to save changes'}
        </Alert>
      </Snackbar>
      <Grid container spacing={3}>
        {/* Problem List */}
        <Grid item xs={12} lg={6}>
          <ProblemList 
            conditions={conditions} 
            patientId={patientId} 
            onAddProblem={handleAddProblem}
            onEditProblem={handleEditProblem}
            onDeleteProblem={handleDeleteProblem}
            onExport={handleExportProblems}
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
            onExport={handleExportMedications}
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
            onExport={handleExportAllergies}
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