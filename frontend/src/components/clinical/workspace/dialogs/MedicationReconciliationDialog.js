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
  Paper
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Medication as MedicationIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  Visibility as ReviewIcon
} from '@mui/icons-material';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';

const MedicationReconciliationDialog = ({ 
  open, 
  onClose, 
  patientId, 
  currentMedications = [],
  onReconcile 
}) => {
  const [loading, setLoading] = useState(false);
  const [reconciliationChanges, setReconciliationChanges] = useState([]);
  const [selectedChanges, setSelectedChanges] = useState(new Set());
  
  // Mock external medication sources (in real implementation, these would come from APIs)
  const [externalSources] = useState([
    {
      source: 'Hospital Discharge Summary',
      date: '2024-01-15',
      medications: [
        {
          id: 'ext-1',
          name: 'Lisinopril 10mg',
          dosage: 'Take 1 tablet by mouth daily',
          status: 'active',
          source: 'discharge'
        },
        {
          id: 'ext-2', 
          name: 'Metformin 500mg',
          dosage: 'Take 1 tablet by mouth twice daily with meals',
          status: 'active',
          source: 'discharge'
        }
      ]
    },
    {
      source: 'Pharmacy Records',
      date: '2024-01-20',
      medications: [
        {
          id: 'ext-3',
          name: 'Atorvastatin 20mg',
          dosage: 'Take 1 tablet by mouth at bedtime',
          status: 'active',
          source: 'pharmacy'
        },
        {
          id: 'ext-4',
          name: 'Lisinopril 10mg',
          dosage: 'Take 1 tablet by mouth daily',
          status: 'discontinued',
          source: 'pharmacy'
        }
      ]
    }
  ]);

  const { getMedicationDisplay } = useMedicationResolver(currentMedications);

  useEffect(() => {
    if (open) {
      analyzeDiscrepancies();
    }
  }, [open, currentMedications]);

  const analyzeDiscrepancies = () => {
    const changes = [];
    const currentMedNames = new Set(
      currentMedications.map(med => 
        getMedicationDisplay(med).toLowerCase()
      )
    );

    // Find medications in external sources not in current list
    externalSources.forEach(source => {
      source.medications.forEach(extMed => {
        const medName = extMed.name.toLowerCase();
        if (!currentMedNames.has(medName) && extMed.status === 'active') {
          changes.push({
            id: `add-${extMed.id}`,
            type: 'add',
            medication: extMed,
            reason: `Found in ${source.source} but not in current medications`,
            source: source.source
          });
        }
      });
    });

    // Find medications that should be discontinued
    externalSources.forEach(source => {
      source.medications.forEach(extMed => {
        if (extMed.status === 'discontinued') {
          const currentMed = currentMedications.find(med => 
            getMedicationDisplay(med).toLowerCase().includes(extMed.name.toLowerCase())
          );
          if (currentMed && currentMed.status === 'active') {
            changes.push({
              id: `discontinue-${currentMed.id}`,
              type: 'discontinue',
              medication: currentMed,
              reason: `Marked as discontinued in ${source.source}`,
              source: source.source
            });
          }
        }
      });
    });

    // Find potential duplicates or dosage changes
    currentMedications.forEach(currentMed => {
      externalSources.forEach(source => {
        source.medications.forEach(extMed => {
          const currentName = getMedicationDisplay(currentMed).toLowerCase();
          const extName = extMed.name.toLowerCase();
          
          if (currentName.includes(extName.split(' ')[0]) || extName.includes(currentName.split(' ')[0])) {
            const currentDosage = currentMed.dosageInstruction?.[0]?.text || '';
            if (currentDosage !== extMed.dosage && extMed.status === 'active') {
              changes.push({
                id: `modify-${currentMed.id}`,
                type: 'modify',
                medication: currentMed,
                newDosage: extMed.dosage,
                reason: `Dosage discrepancy with ${source.source}`,
                source: source.source
              });
            }
          }
        });
      });
    });

    setReconciliationChanges(changes);
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
    if (selectedChanges.size === reconciliationChanges.length) {
      setSelectedChanges(new Set());
    } else {
      setSelectedChanges(new Set(reconciliationChanges.map(c => c.id)));
    }
  };

  const handleReconcile = async () => {
    setLoading(true);
    try {
      const changesToApply = reconciliationChanges.filter(change => 
        selectedChanges.has(change.id)
      );
      
      await onReconcile(changesToApply);
      onClose();
    } catch (error) {
      console.error('Error during reconciliation:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (type) => {
    switch (type) {
      case 'add': return <AddIcon color="success" />;
      case 'discontinue': return <RemoveIcon color="error" />;
      case 'modify': return <EditIcon color="warning" />;
      default: return <ReviewIcon />;
    }
  };

  const getChangeColor = (type) => {
    switch (type) {
      case 'add': return 'success';
      case 'discontinue': return 'error';
      case 'modify': return 'warning';
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
        <Typography variant="h6">Medication Reconciliation</Typography>
        <Typography variant="body2" color="text.secondary">
          Review and reconcile medications from multiple sources
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="info">
            Medication reconciliation helps ensure accuracy by comparing current medications 
            with external sources like discharge summaries and pharmacy records.
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
                      secondary={med.dosageInstruction?.[0]?.text || 'No dosage information'}
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
          {externalSources.map((source, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  {source.source} ({source.medications.length} medications)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {source.date}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {source.medications.map((med) => (
                    <ListItem key={med.id}>
                      <ListItemIcon>
                        <MedicationIcon color={med.status === 'active' ? 'primary' : 'disabled'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={med.name}
                        secondary={med.dosage}
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
          ))}

          <Divider />

          {/* Reconciliation Changes */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Recommended Changes ({reconciliationChanges.length})
              </Typography>
              <Button 
                onClick={handleSelectAll}
                size="small"
                variant="outlined"
              >
                {selectedChanges.size === reconciliationChanges.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Stack>

            {reconciliationChanges.length === 0 ? (
              <Alert severity="success" icon={<CheckIcon />}>
                No discrepancies found. Current medications are reconciled with external sources.
              </Alert>
            ) : (
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List>
                  {reconciliationChanges.map((change, index) => (
                    <ListItem key={change.id} divider={index < reconciliationChanges.length - 1}>
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
                        {getChangeIcon(change.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body1">
                              {change.type === 'add' && `Add: ${change.medication.name}`}
                              {change.type === 'discontinue' && `Discontinue: ${getMedicationDisplay(change.medication)}`}
                              {change.type === 'modify' && `Modify: ${getMedicationDisplay(change.medication)}`}
                            </Typography>
                            <Chip 
                              label={change.type.toUpperCase()} 
                              size="small" 
                              color={getChangeColor(change.type)}
                            />
                          </Stack>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {change.reason}
                            </Typography>
                            {change.type === 'modify' && (
                              <Typography variant="body2" color="warning.main">
                                New dosage: {change.newDosage}
                              </Typography>
                            )}
                            {change.type === 'add' && (
                              <Typography variant="body2" color="success.main">
                                Dosage: {change.medication.dosage}
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
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleReconcile} 
          variant="contained" 
          disabled={loading || selectedChanges.size === 0}
        >
          {loading ? 'Applying Changes...' : `Apply ${selectedChanges.size} Changes`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MedicationReconciliationDialog;