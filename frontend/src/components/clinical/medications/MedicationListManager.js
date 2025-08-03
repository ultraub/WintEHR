/**
 * Medication List Manager Component
 * Manages FHIR List-based medication organization with tabs for different list types
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
  useTheme,
  alpha,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Home as HomeIcon,
  LocalHospital as HospitalIcon,
  ExitToApp as DischargeIcon,
  CompareArrows as ReconcileIcon,
  MoreVert as MoreVertIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

// Services
import { medicationCRUDService } from '../../../services/MedicationCRUDService';
import { medicationWorkflowService } from '../../../services/MedicationWorkflowService';
import { fhirClient } from '../../../core/fhir/services/fhirClient';

// Utils
import {
  getMedicationName,
  getMedicationDosageDisplay,
  getMedicationStatus
} from '../../../core/fhir/utils/medicationDisplayUtils';

// Tab configuration
const LIST_TABS = [
  { 
    id: 'current', 
    label: 'Current Medications', 
    icon: <MedicationIcon />,
    description: 'Active medications the patient is currently taking'
  },
  { 
    id: 'home', 
    label: 'Home Medications', 
    icon: <HomeIcon />,
    description: 'Medications the patient manages at home'
  },
  { 
    id: 'discharge', 
    label: 'Discharge Medications', 
    icon: <DischargeIcon />,
    description: 'Medications prescribed at discharge'
  },
  { 
    id: 'reconciliation', 
    label: 'Reconciliation', 
    icon: <ReconcileIcon />,
    description: 'Medication reconciliation results'
  }
];

const MedicationListManager = ({ 
  patientId, 
  onMedicationClick,
  onAddMedication,
  height = '600px'
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState({});
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get current list type
  const currentListType = LIST_TABS[activeTab].id;

  // Load medication lists
  const loadMedicationLists = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    try {
      // Initialize lists if needed
      await medicationCRUDService.initializePatientMedicationLists(patientId);
      
      // Get all lists
      const patientLists = await medicationCRUDService.getPatientMedicationLists(patientId);
      
      // Organize by type
      const listsByType = {};
      patientLists.forEach(list => {
        const listType = medicationCRUDService.getListTypeFromCode(
          list.code?.coding?.[0]?.code
        );
        if (listType) {
          listsByType[listType] = list;
        }
      });

      // Load medication details for each entry
      for (const listType in listsByType) {
        const list = listsByType[listType];
        if (list.entry && list.entry.length > 0) {
          const enrichedEntries = await Promise.all(
            list.entry.map(async (entry) => {
              if (entry.deleted) return entry;
              
              try {
                const medRequestId = entry.item?.reference?.split('/').pop();
                if (medRequestId) {
                  const medRequest = await fhirClient.read('MedicationRequest', medRequestId);
                  return {
                    ...entry,
                    medication: medRequest
                  };
                }
              } catch (error) {
                console.error('Error loading medication:', error);
              }
              return entry;
            })
          );
          listsByType[listType].entry = enrichedEntries;
        }
      }

      setLists(listsByType);
    } catch (error) {
      console.error('Error loading medication lists:', error);
      enqueueSnackbar('Failed to load medication lists', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [patientId, enqueueSnackbar]);

  // Load lists on mount and patient change
  useEffect(() => {
    loadMedicationLists();
  }, [loadMedicationLists]);

  // Subscribe to list updates
  useEffect(() => {
    if (!patientId) return;

    const unsubscribe = medicationCRUDService.subscribeToListUpdates(
      patientId,
      'global',
      (update) => {
        // Refresh lists when updated
        loadMedicationLists();
      }
    );

    return unsubscribe;
  }, [patientId, loadMedicationLists]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle add medication
  const handleAddMedication = () => {
    if (onAddMedication) {
      onAddMedication(currentListType);
    }
  };

  // Handle remove medication
  const handleRemoveMedication = async (medicationRequestId) => {
    try {
      await medicationCRUDService.removeMedicationFromList(
        patientId,
        currentListType,
        medicationRequestId
      );
      enqueueSnackbar('Medication removed from list', { variant: 'success' });
      loadMedicationLists();
    } catch (error) {
      console.error('Error removing medication:', error);
      enqueueSnackbar('Failed to remove medication', { variant: 'error' });
    }
  };

  // Handle reconciliation
  const handleReconciliation = async () => {
    setReconciling(true);
    try {
      // Get medication data for reconciliation
      const medicationData = await medicationWorkflowService.getMedicationReconciliation(
        patientId
      );

      // Categorize medications
      const categorized = medicationWorkflowService.categorizeMedicationsBySource(medicationData);
      
      // Analyze reconciliation needs
      const analysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);

      // Get list IDs for reconciliation
      const listIds = [];
      if (lists.current?.id) listIds.push(lists.current.id);
      if (lists.home?.id) listIds.push(lists.home.id);
      if (lists.discharge?.id) listIds.push(lists.discharge.id);

      if (listIds.length > 0) {
        // Perform reconciliation
        const result = await medicationCRUDService.reconcileMedicationLists(
          patientId,
          listIds
        );

        enqueueSnackbar(
          `Reconciliation complete: ${result.medications_reviewed} medications reviewed, ${result.conflicts_found} conflicts found`,
          { variant: 'success' }
        );

        // Switch to reconciliation tab
        setActiveTab(3);
        
        // Reload lists
        loadMedicationLists();
      } else {
        enqueueSnackbar('No medication lists available for reconciliation', { variant: 'warning' });
      }
    } catch (error) {
      console.error('Error performing reconciliation:', error);
      enqueueSnackbar('Failed to perform reconciliation', { variant: 'error' });
    } finally {
      setReconciling(false);
      setReconcileDialogOpen(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMedicationLists();
    setRefreshing(false);
  };

  // Get current list
  const currentList = lists[currentListType];
  const activeEntries = currentList?.entry?.filter(e => !e.deleted) || [];

  // Get list statistics
  const listStats = useMemo(() => {
    const stats = {};
    LIST_TABS.forEach(tab => {
      const list = lists[tab.id];
      stats[tab.id] = {
        total: list?.entry?.filter(e => !e.deleted).length || 0,
        hasConflicts: tab.id === 'reconciliation' && 
          list?.entry?.some(e => e.flag?.coding?.[0]?.code === 'review-needed')
      };
    });
    return stats;
  }, [lists]);

  // Render medication item
  const renderMedicationItem = (entry) => {
    const medication = entry.medication;
    if (!medication) return null;

    const name = getMedicationName(medication);
    const dosage = getMedicationDosageDisplay(medication);
    const status = getMedicationStatus(medication);
    const isActive = status === 'active';

    return (
      <ListItem 
        key={entry.item?.reference}
        divider
        sx={{
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.04)
          }
        }}
      >
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1">
                {name}
              </Typography>
              <Chip
                label={status}
                size="small"
                color={isActive ? 'success' : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
              />
              {entry.flag && (
                <Chip
                  icon={entry.flag.coding?.[0]?.code === 'review-needed' ? 
                    <WarningIcon /> : <CheckCircleIcon />
                  }
                  label={entry.flag.coding?.[0]?.display || entry.flag.coding?.[0]?.code}
                  size="small"
                  color={entry.flag.coding?.[0]?.code === 'review-needed' ? 'warning' : 'success'}
                />
              )}
            </Stack>
          }
          secondary={
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {dosage && (
                <Typography variant="body2" color="text.secondary">
                  {dosage}
                </Typography>
              )}
              {entry.note && (
                <Typography variant="caption" color="text.secondary">
                  Note: {entry.note}
                </Typography>
              )}
              {entry.date && (
                <Typography variant="caption" color="text.secondary">
                  Added: {format(new Date(entry.date), 'MMM d, yyyy')}
                </Typography>
              )}
            </Stack>
          }
        />
        <ListItemSecondaryAction>
          <Stack direction="row" spacing={1}>
            {onMedicationClick && (
              <IconButton
                edge="end"
                size="small"
                onClick={() => onMedicationClick(medication)}
              >
                <InfoIcon />
              </IconButton>
            )}
            {currentListType !== 'reconciliation' && (
              <IconButton
                edge="end"
                size="small"
                onClick={() => handleRemoveMedication(medication.id)}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Stack>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: theme.palette.background.paper
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Medication Lists
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<ReconcileIcon />}
              onClick={() => setReconcileDialogOpen(true)}
              variant="outlined"
              size="small"
              disabled={reconciling}
            >
              Reconcile
            </Button>
            <IconButton
              size="small"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <SyncIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Loading indicator */}
      {(loading || refreshing || reconciling) && <LinearProgress />}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {LIST_TABS.map((tab, index) => (
          <Tab
            key={tab.id}
            icon={
              <Badge 
                badgeContent={listStats[tab.id]?.total || 0} 
                color={listStats[tab.id]?.hasConflicts ? 'warning' : 'primary'}
              >
                {tab.icon}
              </Badge>
            }
            label={tab.label}
            sx={{ minHeight: 64 }}
          />
        ))}
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} variant="rectangular" height={80} />
            ))}
          </Stack>
        ) : activeEntries.length === 0 ? (
          <Stack 
            spacing={2} 
            alignItems="center" 
            justifyContent="center"
            sx={{ height: '100%' }}
          >
            <MedicationIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">
              No medications in this list
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              {LIST_TABS[activeTab].description}
            </Typography>
            {currentListType !== 'reconciliation' && (
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddMedication}
                variant="contained"
              >
                Add Medication
              </Button>
            )}
          </Stack>
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0 }}>
              <List sx={{ py: 0 }}>
                {activeEntries.map(renderMedicationItem)}
              </List>
            </CardContent>
            {currentListType !== 'reconciliation' && (
              <CardActions>
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddMedication}
                  size="small"
                >
                  Add Medication
                </Button>
              </CardActions>
            )}
          </Card>
        )}
      </Box>

      {/* Reconciliation Dialog */}
      <Dialog
        open={reconcileDialogOpen}
        onClose={() => setReconcileDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Medication Reconciliation
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1 }}>
            Medication reconciliation will compare medications across all lists 
            and identify any discrepancies, duplications, or conflicts that need review.
          </Alert>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Lists to reconcile:
            </Typography>
            <Stack spacing={1} sx={{ ml: 2 }}>
              {LIST_TABS.slice(0, 3).map(tab => {
                const count = listStats[tab.id]?.total || 0;
                return (
                  <Typography key={tab.id} variant="body2" color="text.secondary">
                    • {tab.label}: {count} medication{count !== 1 ? 's' : ''}
                  </Typography>
                );
              })}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setReconcileDialogOpen(false)}
            disabled={reconciling}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleReconciliation}
            variant="contained"
            disabled={reconciling}
            startIcon={reconciling ? <SyncIcon /> : <ReconcileIcon />}
          >
            {reconciling ? 'Reconciling...' : 'Start Reconciliation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MedicationListManager;