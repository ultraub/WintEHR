/**
 * Enhanced Medication Search Component
 * Advanced medication search with dosing guidance and safety checks
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Paper,
  Typography,
  Chip,
  Stack,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  IconButton,
  Badge,
  Collapse
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  History as HistoryIcon,
  Star as FavoriteIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Schedule as DosingIcon,
  Security as SafetyIcon,
  LocalPharmacy as PharmacyIcon
} from '@mui/icons-material';

import { medicationSearchService } from '../../../services/medicationSearchService';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';

const EnhancedMedicationSearch = ({
  patientId,
  onMedicationSelect,
  currentMedications = [],
  defaultValue = '',
  showDosingGuidance = true,
  showSafetyChecks = true,
  showTemplates = true
}) => {
  const [searchQuery, setSearchQuery] = useState(defaultValue);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [dosingGuidance, setDosingGuidance] = useState(null);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [commonTemplates, setCommonTemplates] = useState([]);
  const [recentMedications, setRecentMedications] = useState([]);

  const { getPatientResources } = useFHIRResource();

  // Get patient data for safety checks
  const patientAllergies = useMemo(() => {
    if (!patientId) return [];
    return getPatientResources(patientId, 'AllergyIntolerance') || [];
  }, [patientId, getPatientResources]);

  const patientData = useMemo(() => {
    if (!patientId) return null;
    const patient = getPatientResources(patientId, 'Patient')?.[0];
    return patient ? {
      age: patient.birthDate ? 
        new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : null,
      gender: patient.gender
    } : null;
  }, [patientId, getPatientResources]);

  // Search medications
  const searchMedications = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await medicationSearchService.searchMedications(query, {
        limit: 15,
        includeDosingInfo: true
      });
      setSearchResults(results);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchMedications(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchMedications]);

  // Load common templates and recent medications
  useEffect(() => {
    const templates = medicationSearchService.getCommonPrescriptions();
    setCommonTemplates(Object.entries(templates).flatMap(([category, temps]) => 
      temps.map(temp => ({ ...temp, category }))
    ));

    // In a real implementation, this would load from user's prescription history
    setRecentMedications([
      'Lisinopril 10mg',
      'Metformin 500mg',
      'Ibuprofen 600mg'
    ]);
  }, []);

  // Handle medication selection
  const handleMedicationSelect = useCallback(async (medication) => {
    if (!medication) return;

    setSelectedMedication(medication);

    // Get dosing guidance if enabled
    if (showDosingGuidance && patientData) {
      const dosing = medicationSearchService.getDosingRecommendations(
        medication.id, 
        patientData
      );
      setDosingGuidance(dosing);
    }

    // Perform safety checks if enabled
    if (showSafetyChecks) {
      const alerts = [];

      // Check allergies
      if (patientAllergies.length > 0) {
        const allergyAlerts = medicationSearchService.checkAllergies(
          medication.id, 
          patientAllergies
        );
        alerts.push(...allergyAlerts);
      }

      // Check drug interactions
      if (currentMedications.length > 0) {
        const interactions = await medicationSearchService.checkDrugInteractions([
          medication,
          ...currentMedications
        ]);
        alerts.push(...interactions.map(interaction => ({
          ...interaction,
          type: 'interaction'
        })));
      }

      setSafetyAlerts(alerts);
    }

    setShowDetails(true);
  }, [showDosingGuidance, showSafetyChecks, patientData, patientAllergies, currentMedications]);

  // Handle prescription with selected medication
  const handlePrescribe = useCallback(() => {
    if (!selectedMedication) return;

    const prescriptionData = {
      medication: selectedMedication,
      dosing: dosingGuidance?.recommended || dosingGuidance?.adult || {},
      safetyAlerts: safetyAlerts,
      patientContext: patientData
    };

    onMedicationSelect(prescriptionData);
    setShowDetails(false);
    setSelectedMedication(null);
    setSearchQuery('');
  }, [selectedMedication, dosingGuidance, safetyAlerts, patientData, onMedicationSelect]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template) => {
    const templateData = {
      template: template,
      medications: template.medications.map(medTemplate => {
        const medication = medicationSearchService.getMedicationById(medTemplate.medicationId);
        return {
          medication,
          dosing: medTemplate.dosing,
          duration: medTemplate.duration,
          refills: medTemplate.refills
        };
      })
    };

    onMedicationSelect(templateData);
    setShowTemplatesDialog(false);
  }, [onMedicationSelect]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* Search Interface */}
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <Autocomplete
            sx={{ flexGrow: 1 }}
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body1">
                    {option.name} {option.strength}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.category} • {option.indication}
                  </Typography>
                </Box>
                {option.brandNames && option.brandNames.length > 0 && (
                  <Chip 
                    label={option.brandNames[0]} 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            )}
            inputValue={searchQuery}
            onInputChange={(event, newInputValue) => {
              setSearchQuery(newInputValue);
            }}
            onChange={(event, newValue) => {
              if (newValue && typeof newValue === 'object') {
                handleMedicationSelect(newValue);
              }
            }}
            loading={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Medications"
                placeholder="Type medication name, indication, or category"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          
          {showTemplates && (
            <Button
              variant="outlined"
              startIcon={<FavoriteIcon />}
              onClick={() => setShowTemplatesDialog(true)}
            >
              Templates
            </Button>
          )}
        </Box>

        {/* Quick Access */}
        {recentMedications.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Recent Medications:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {recentMedications.map((med, index) => (
                <Chip
                  key={index}
                  label={med}
                  size="small"
                  icon={<HistoryIcon />}
                  onClick={() => setSearchQuery(med)}
                  clickable
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Safety Alerts Preview */}
        {safetyAlerts.length > 0 && (
          <Alert 
            severity={safetyAlerts.some(alert => alert.severity === 'critical') ? 'error' : 'warning'}
            sx={{ mt: 1 }}
          >
            <Typography variant="body2">
              {safetyAlerts.length} safety alert(s) found. Review details before prescribing.
            </Typography>
          </Alert>
        )}
      </Stack>

      {/* Medication Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <MedicationIcon />
            <Box>
              <Typography variant="h6">
                {selectedMedication?.name} {selectedMedication?.strength}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedMedication?.category} • {selectedMedication?.form}
              </Typography>
            </Box>
            {safetyAlerts.length > 0 && (
              <Badge badgeContent={safetyAlerts.length} color="error">
                <WarningIcon />
              </Badge>
            )}
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {/* Basic Information */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Medication Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Generic Name</Typography>
                    <Typography variant="body1">{selectedMedication?.genericName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Brand Names</Typography>
                    <Typography variant="body1">
                      {selectedMedication?.brandNames?.join(', ') || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Indication</Typography>
                    <Typography variant="body1">{selectedMedication?.indication}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Dosing Guidance */}
            {dosingGuidance && (
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    <DosingIcon color="primary" />
                    <Typography variant="h6">Dosing Guidance</Typography>
                    {dosingGuidance.ageAdjustment && (
                      <Chip 
                        label={dosingGuidance.ageAdjustment} 
                        size="small" 
                        color="info" 
                      />
                    )}
                  </Stack>
                  
                  {dosingGuidance.recommended && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Recommended Dosing:
                      </Typography>
                      <Typography variant="body1">
                        Initial: {dosingGuidance.recommended.initial}
                      </Typography>
                      <Typography variant="body1">
                        Maintenance: {dosingGuidance.recommended.maintenance}
                      </Typography>
                      {dosingGuidance.recommended.maximum && (
                        <Typography variant="body1">
                          Maximum: {dosingGuidance.recommended.maximum}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {dosingGuidance.warnings && dosingGuidance.warnings.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Warnings:
                      </Typography>
                      <List dense>
                        {dosingGuidance.warnings.map((warning, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={warning} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Safety Alerts */}
            {safetyAlerts.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    <SafetyIcon color="error" />
                    <Typography variant="h6">Safety Alerts</Typography>
                    <Badge badgeContent={safetyAlerts.length} color="error" />
                  </Stack>
                  
                  <Stack spacing={2}>
                    {safetyAlerts.map((alert, index) => (
                      <Alert 
                        key={index} 
                        severity={getSeverityColor(alert.severity)}
                        variant="outlined"
                      >
                        <Typography variant="body2" gutterBottom>
                          <strong>
                            {alert.type === 'interaction' ? 'Drug Interaction' : 'Allergy Alert'}:
                          </strong>
                        </Typography>
                        <Typography variant="body2">
                          {alert.description || alert.reaction || 'Review medication safety'}
                        </Typography>
                        {alert.recommendation && (
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            <strong>Recommendation:</strong> {alert.recommendation}
                          </Typography>
                        )}
                      </Alert>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePrescribe}
            startIcon={<PharmacyIcon />}
            disabled={safetyAlerts.some(alert => alert.severity === 'critical')}
          >
            {safetyAlerts.some(alert => alert.severity === 'critical') ? 'Cannot Prescribe' : 'Prescribe'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog
        open={showTemplatesDialog}
        onClose={() => setShowTemplatesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Common Prescription Templates</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {commonTemplates.map((template, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {template.name}
                    </Typography>
                    <Chip label={template.category} size="small" sx={{ mb: 2 }} />
                    <List dense>
                      {template.medications.map((med, medIndex) => {
                        const medication = medicationSearchService.getMedicationById(med.medicationId);
                        return (
                          <ListItem key={medIndex}>
                            <ListItemIcon>
                              <MedicationIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={medication?.name || 'Unknown'}
                              secondary={`${med.dosing} • ${med.duration}`}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplatesDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnhancedMedicationSearch;