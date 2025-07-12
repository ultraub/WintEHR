/**
 * Chart Review Tab Component
 * Comprehensive view of patient's problems, medications, and allergies
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  Backdrop,
  Skeleton,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
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
import RefillManagement from '../../medications/RefillManagement';
import MedicationDiscontinuationDialog from '../../medications/MedicationDiscontinuationDialog';
import { fhirClient } from '../../../../services/fhirClient';
import { medicationDiscontinuationService } from '../../../../services/medicationDiscontinuationService';
import { intelligentCache } from '../../../../utils/intelligentCache';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../utils/exportUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { usePatientCDSAlerts } from '../../../../contexts/CDSContext';
import PrescriptionStatusDashboard from '../../prescribing/PrescriptionStatusDashboard';

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
                    <>
                      {condition.onsetDateTime ? 
                        `Onset: ${format(parseISO(condition.onsetDateTime), 'MMM d, yyyy')}` : 
                        'Onset date unknown'}
                      {condition.note?.[0]?.text && expandedItems[condition.id] && (
                        ` • ${condition.note[0].text}`
                      )}
                    </>
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
  const [showRefillDialog, setShowRefillDialog] = useState(false);
  const [showDiscontinuationDialog, setShowDiscontinuationDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  
  // Resolve medication references
  const { getMedicationDisplay, loading: resolvingMeds } = useMedicationResolver(medications);
  
  // Clinical workflow context for events
  const { publish } = useClinicalWorkflow();
  
  // FHIR resource context for refreshing data
  const { refreshPatientResources } = useFHIRResource();

  const handleEditMedication = (medication) => {
    // Ensure we're setting a fresh copy of the medication
    setSelectedMedication({...medication});
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
      // Error is thrown to be handled by the dialog component
      // Don't close the dialog on error so user can see the error message
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

  const handleReconciliation = async (reconciliationResults) => {
    try {
      // The reconciliation service has already applied the changes
      // reconciliationResults contains the results of each change
      
      const successfulChanges = reconciliationResults.filter(result => result.result.success);
      const failedChanges = reconciliationResults.filter(result => !result.result.success);
      
      // Refresh the medication list to reflect changes
      await refreshPatientResources(patientId);
      
      // Publish workflow event for successful reconciliation
      if (successfulChanges.length > 0) {
        await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          workflowType: 'medication-reconciliation',
          step: 'completed',
          data: {
            patientId,
            changesApplied: successfulChanges.length,
            changesFailed: failedChanges.length,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Close the dialog
      setShowReconciliationDialog(false);
      
      // Log summary for debugging
      console.log(`Medication reconciliation completed: ${successfulChanges.length} successful, ${failedChanges.length} failed`);
      
      // Medication reconciliation completed successfully
    } catch (error) {
      // Error during medication reconciliation
      throw error;
    }
  };

  const handleDiscontinuation = async (discontinuationData) => {
    try {
      const result = await medicationDiscontinuationService.discontinueMedication(discontinuationData);
      
      // Refresh the medication list to reflect changes
      await refreshPatientResources(patientId);
      
      // Publish workflow event for medication discontinuation
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'medication-discontinuation',
        step: 'completed',
        data: {
          medicationName: result.originalRequest.medicationCodeableConcept?.text || 'Unknown medication',
          reason: discontinuationData.reason.display,
          discontinuationType: discontinuationData.discontinuationType,
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Close the dialog
      setShowDiscontinuationDialog(false);
      setSelectedMedication(null);
      
      // Log success
      console.log(`Medication discontinued successfully: ${result.originalRequest.medicationCodeableConcept?.text}`);
      
    } catch (error) {
      console.error('Error discontinuing medication:', error);
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
            <Tooltip title="Refill Management">
              <IconButton 
                size="small" 
                onClick={() => setShowRefillDialog(true)}
              >
                <RefreshIcon />
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
                    <>
                      {med.dosageInstruction?.[0]?.text || 'No dosage information'}
                      {' • '}
                      Prescribed: {med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit Medication">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditMedication(med)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {med.status === 'active' && (
                      <Tooltip title="Discontinue Medication">
                        <IconButton 
                          size="small"
                          onClick={() => {
                            setSelectedMedication(med);
                            setShowDiscontinuationDialog(true);
                          }}
                          color="error"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
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
        key={selectedMedication?.id || 'new'}
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
      
      <Dialog
        open={showRefillDialog}
        onClose={() => setShowRefillDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          Medication Refill Management
        </DialogTitle>
        <DialogContent>
          <RefillManagement
            patientId={patientId}
            medications={medications}
            onRefresh={() => {
              // Refresh patient resources when refills are processed
              window.location.reload(); // Simple refresh for now
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRefillDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      <MedicationDiscontinuationDialog
        open={showDiscontinuationDialog}
        onClose={() => {
          setShowDiscontinuationDialog(false);
          setSelectedMedication(null);
        }}
        medicationRequest={selectedMedication}
        onDiscontinue={async (discontinuationData) => {
          try {
            const result = await medicationDiscontinuationService.discontinueMedication(discontinuationData);
            
            // Publish workflow event
            await publish(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, {
              medicationId: selectedMedication.id,
              patientId,
              status: 'discontinued',
              reason: discontinuationData.reason.display,
              timestamp: new Date().toISOString()
            });
            
            // Refresh patient resources to show updated medication status
            await refreshPatientResources(patientId);
            
            return result;
          } catch (error) {
            console.error('Error discontinuing medication:', error);
            throw error;
          }
        }}
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [loading, setLoading] = useState(true);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Removed refreshKey - now using unified resource system

  // Use centralized CDS alerts
  const { alerts: cdsAlerts, loading: cdsLoading } = usePatientCDSAlerts(patientId);

  useEffect(() => {
    // Data is already loaded by FHIRResourceContext
    setLoading(false);
  }, []);

  // Handle CDS alerts notification count
  useEffect(() => {
    if (cdsAlerts.length > 0 && onNotificationUpdate) {
      // Pass critical alert count to match what ClinicalWorkspaceV3 expects
      const criticalCount = cdsAlerts.filter(alert => alert.indicator === 'critical').length;
      onNotificationUpdate(criticalCount || cdsAlerts.length);
    }
  }, [cdsAlerts, onNotificationUpdate]);

  const handleAddProblem = async (condition) => {
    try {
      const result = await fhirClient.create('Condition', condition);
      const createdCondition = result.resource || condition;
      
      // Trigger refresh of the resources
      await refreshPatientResources(patientId);
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handlePrescribeMedication = async (medicationRequest) => {
    try {
      // Note: CDS hooks for medication prescribing are handled in PrescribeMedicationDialog
      // This provides real-time checking during the prescription creation process

      const result = await fhirClient.create('MedicationRequest', medicationRequest);
      const createdMedication = result.resource || medicationRequest;
      
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
      await refreshPatientResources(patientId);
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handleAddAllergy = async (allergyIntolerance) => {
    try {
      const result = await fhirClient.create('AllergyIntolerance', allergyIntolerance);
      const createdAllergy = result.resource || allergyIntolerance;
      
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
      await refreshPatientResources(patientId);
      
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
      // Update the condition on the server
      const result = await fhirClient.update('Condition', updatedCondition.id, updatedCondition);
      
      // Clear intelligent cache for this patient to force fresh data
      intelligentCache.clearPatient(patientId);
      
      // Clear the specific condition cache entries
      intelligentCache.clearResourceType('Condition');
      
      // Publish workflow event for condition update
      await publish(CLINICAL_EVENTS.CONDITION_UPDATED, {
        conditionId: updatedCondition.id,
        patientId,
        status: 'updated',
        conditionText: updatedCondition.code?.text || 
                      updatedCondition.code?.coding?.[0]?.display || 
                      'Unknown condition',
        timestamp: new Date().toISOString()
      });
      
      // Force refresh of patient resources to ensure UI updates
      await refreshPatientResources(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
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
      await fhirClient.delete('Condition', conditionId);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Publish event for condition deletion
      await publish(CLINICAL_EVENTS.CONDITION_UPDATED, {
        conditionId,
        patientId,
        status: 'deleted',
        timestamp: new Date().toISOString()
      });
      
      // Refresh patient resources to update condition list
      await refreshPatientResources(patientId);
      
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
      const result = await fhirClient.update('MedicationRequest', updatedMedicationRequest.id, updatedMedicationRequest);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      await refreshPatientResources(patientId);
      
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
      await fhirClient.delete('MedicationRequest', medicationId);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Trigger refresh of the resources
      await refreshPatientResources(patientId);
      
      // Publish event for medication deletion
      await publish(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, {
        medicationId,
        patientId,
        status: 'deleted',
        timestamp: new Date().toISOString()
      });
      
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
      const result = await fhirClient.update('AllergyIntolerance', updatedAllergyIntolerance.id, updatedAllergyIntolerance);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      await refreshPatientResources(patientId);
      
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
      await fhirClient.delete('AllergyIntolerance', allergyId);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Trigger refresh of the resources
      await refreshPatientResources(patientId);
      
      // Publish event for allergy deletion
      await publish(CLINICAL_EVENTS.ALLERGY_UPDATED, {
        allergyId,
        patientId,
        status: 'deleted',
        timestamp: new Date().toISOString()
      });
      
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

  // Get resources using unified resource system
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];
  const immunizations = getPatientResources(patientId, 'Immunization') || [];
  
  // Resources are now loaded automatically via getPatientResources hook

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show skeleton loading while data is loading
  if (isLoading || loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={isMobile ? 2 : 3}>
          {/* Skeleton for each section */}
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} md={6} key={item}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                  <Stack spacing={1}>
                    {[1, 2, 3].map((i) => (
                      <Box key={i}>
                        <Skeleton variant="text" width="100%" height={24} />
                        <Skeleton variant="text" width="80%" height={20} />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="text" width="70%" height={20} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
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
      <Grid container spacing={isMobile ? 2 : 3}>
        {/* Problem List */}
        <Grid item xs={12} md={6}>
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
        <Grid item xs={12} md={6}>
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
        <Grid item xs={12} md={6}>
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
        <Grid item xs={12} md={6}>
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

        {/* Prescription Status Dashboard */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <PrescriptionStatusDashboard patientId={patientId} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(ChartReviewTab);