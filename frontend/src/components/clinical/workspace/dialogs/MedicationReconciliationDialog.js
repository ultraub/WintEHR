/**
 * Medication Reconciliation Dialog Component
 * Allows clinicians to reconcile patient medications across different sources
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Divider,
  Alert,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Paper,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Medication as MedicationIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  Visibility as ReviewIcon,
  Refresh as RefreshIcon,
  Assessment as AnalysisIcon
} from '@mui/icons-material';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { medicationReconciliationService } from '../../../../services/medicationReconciliationService';
import { format, parseISO } from 'date-fns';
import { getMedicationDosageDisplay } from '../../../../utils/medicationDisplayUtils';

const MedicationReconciliationDialog = ({ 
  open, 
  onClose, 
  patientId, 
  currentMedications = [],
  encounterId = null,
  onReconcile 
}) => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [selectedChanges, setSelectedChanges] = useState(new Set());
  const [error, setError] = useState(null);

  const { getMedicationDisplay } = useMedicationResolver(currentMedications);

  useEffect(() => {
    if (open && patientId) {
      fetchReconciliationData();
    }
  }, [open, patientId, encounterId]);

  const fetchReconciliationData = async () => {
    setAnalyzing(true);
    setError(null);
    setReconciliationData(null);
    
    try {
      const data = await medicationReconciliationService.getMedicationReconciliationData(
        patientId, 
        encounterId
      );
      setReconciliationData(data);
      
      // Auto-select high priority recommendations
      const highPriorityChanges = data.analysis.recommendations
        .filter(rec => rec.priority === 'high')
        .map(rec => rec.id);
      setSelectedChanges(new Set(highPriorityChanges));
      
    } catch (error) {
      setError(error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const refreshAnalysis = () => {
    // Clear cache and refetch
    medicationReconciliationService.clearCache(patientId);
    fetchReconciliationData();
  };

  const handleToggleChange = (changeId) => {
    setSelectedChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(changeId)) {
        newSet.delete(changeId);
      } else {
        newSet.add(changeId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (!reconciliationData?.analysis?.recommendations) return;
    
    if (selectedChanges.size === reconciliationData.analysis.recommendations.length) {
      setSelectedChanges(new Set());
    } else {
      setSelectedChanges(new Set(reconciliationData.analysis.recommendations.map(c => c.id)));
    }
  };

  const handleReconcile = async () => {
    if (!reconciliationData?.analysis?.recommendations) return;
    
    setLoading(true);
    try {
      const changesToApply = reconciliationData.analysis.recommendations.filter(change => 
        selectedChanges.has(change.id)
      );
      
      // Execute reconciliation through the service
      const results = await medicationReconciliationService.executeReconciliation(
        patientId, 
        changesToApply, 
        encounterId
      );
      
      // Call the parent's onReconcile callback with the results
      if (onReconcile) {
        await onReconcile(results);
      }
      
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (action) => {
    switch (action) {
      case 'add': return <AddIcon color="success" />;
      case 'discontinue': return <RemoveIcon color="error" />;
      case 'modify': return <EditIcon color="warning" />;
      case 'continue': return <CheckIcon color="info" />;
      case 'hold': return <WarningIcon color="warning" />;
      default: return <ReviewIcon />;
    }
  };

  const getChangeColor = (action) => {
    switch (action) {
      case 'add': return 'success';
      case 'discontinue': return 'error';
      case 'modify': return 'warning';
      case 'continue': return 'info';
      case 'hold': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" component="div">Medication Reconciliation</Typography>
              <Typography variant="body2" color="text.secondary">
                Review and reconcile medications from multiple sources
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <IconButton 
                onClick={refreshAnalysis} 
                disabled={analyzing}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
              {reconciliationData?.lastReconciled && (
                <Tooltip title={`Last reconciled: ${format(parseISO(reconciliationData.lastReconciled), 'MMM d, yyyy h:mm a')}`}>
                  <IconButton size="small">
                    <AnalysisIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {analyzing && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Analyzing medication sources and generating reconciliation recommendations...
            </Typography>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Stack spacing={3}>
          <Alert severity="info">
            Medication reconciliation helps ensure accuracy by comparing current medications 
            with external sources like discharge summaries and pharmacy records.
            {reconciliationData?.analysis && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Found {reconciliationData.analysis.totalDiscrepancies} discrepancies requiring review.
                </Typography>
              </Box>
            )}
          </Alert>

          {/* Current Medications Summary */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                Current Medications ({currentMedications.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {currentMedications.map((med) => (
                  <ListItem key={med.id}>
                    <ListItemIcon>
                      <MedicationIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={getMedicationDisplay(med)}
                      secondary={getMedicationDosageDisplay(med)}
                    />
                    <Chip 
                      label={med.status} 
                      size="small" 
                      color={med.status === 'active' ? 'success' : 'default'}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* External Sources */}
          {reconciliationData && Object.entries(reconciliationData.medications).map(([sourceType, medications]) => {
            if (medications.length === 0) return null;
            
            const sourceLabels = {
              home: 'Home Medications',
              hospital: 'Hospital Medications', 
              discharge: 'Discharge Summary',
              pharmacy: 'Pharmacy Records',
              external: 'External Sources'
            };
            
            return (
              <Accordion key={sourceType}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    {sourceLabels[sourceType]} ({medications.length} medications)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {medications.map((med) => (
                      <ListItem key={med.id}>
                        <ListItemIcon>
                          <MedicationIcon color={med.status === 'active' ? 'primary' : 'disabled'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={med.medicationDisplay}
                          secondary={
                            <Box>
                              <Typography variant="body2">
                                {med.dosageDisplay}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Source: {med.sourceType} | {med.source}
                              </Typography>
                            </Box>
                          }
                        />
                        <Chip 
                          label={med.status} 
                          size="small" 
                          color={med.status === 'active' ? 'success' : 'default'}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}

          <Divider />

          {/* Reconciliation Changes */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Recommended Changes ({reconciliationData?.analysis?.recommendations?.length || 0})
              </Typography>
              <Button 
                onClick={handleSelectAll}
                size="small"
                variant="outlined"
                disabled={!reconciliationData?.analysis?.recommendations?.length}
              >
                {selectedChanges.size === (reconciliationData?.analysis?.recommendations?.length || 0) ? 'Deselect All' : 'Select All'}
              </Button>
            </Stack>

            {(!reconciliationData?.analysis?.recommendations?.length) ? (
              <Alert severity="success" icon={<CheckIcon />}>
                {analyzing ? 'Analyzing...' : 'No discrepancies found. Current medications are reconciled with external sources.'}
              </Alert>
            ) : (
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List>
                  {reconciliationData.analysis.recommendations.map((change, index) => (
                    <ListItem key={change.id} divider={index < reconciliationData.analysis.recommendations.length - 1}>
                      <ListItemIcon>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedChanges.has(change.id)}
                              onChange={() => handleToggleChange(change.id)}
                            />
                          }
                          label=""
                        />
                      </ListItemIcon>
                      <ListItemIcon>
                        {getChangeIcon(change.action)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body1">
                              {change.action === 'add' && `Add: ${change.medication.medicationDisplay}`}
                              {change.action === 'discontinue' && `Discontinue: ${change.medication.medicationDisplay}`}
                              {change.action === 'modify' && `Modify: ${change.medication.medicationDisplay}`}
                            </Typography>
                            <Chip 
                              label={change.action.toUpperCase()} 
                              size="small" 
                              color={getChangeColor(change.action)}
                            />
                            <Chip 
                              label={change.priority.toUpperCase()} 
                              size="small" 
                              variant="outlined"
                              color={change.priority === 'high' ? 'error' : change.priority === 'medium' ? 'warning' : 'default'}
                            />
                          </Stack>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {change.reason}
                            </Typography>
                            {change.action === 'modify' && change.newDosage && (
                              <Typography variant="body2" color="warning.main">
                                New dosage: {change.newDosage}
                              </Typography>
                            )}
                            {change.action === 'add' && (
                              <Typography variant="body2" color="success.main">
                                Dosage: {change.medication.dosageDisplay}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Source: {change.source}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
            
            {/* Duplicates and Conflicts */}
            {reconciliationData?.analysis?.duplicates?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning" icon={<WarningIcon />}>
                  <Typography variant="subtitle2">
                    {reconciliationData.analysis.duplicates.length} potential duplicate medications found
                  </Typography>
                  {reconciliationData.analysis.duplicates.map((duplicate, index) => (
                    <Typography key={index} variant="body2" sx={{ mt: 0.5 }}>
                      • {duplicate.medicationName} ({duplicate.count} entries from: {duplicate.sources.join(', ')})
                    </Typography>
                  ))}
                </Alert>
              </Box>
            )}
            
            {reconciliationData?.analysis?.conflicts?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="error">
                  <Typography variant="subtitle2">
                    {reconciliationData.analysis.conflicts.length} medication conflicts detected
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading || analyzing}>
          Cancel
        </Button>
        <Button 
          onClick={handleReconcile} 
          variant="contained" 
          disabled={loading || analyzing || selectedChanges.size === 0 || !reconciliationData?.analysis?.recommendations?.length}
        >
          {loading ? 'Applying Changes...' : `Apply ${selectedChanges.size} Changes`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MedicationReconciliationDialog;