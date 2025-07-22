/**
 * PatientSummaryV4 Component
 * Beautiful, modern patient summary with clinical workspace integration
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
  Fab,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  Assignment as WorkspaceIcon,
  LocalHospital as ConditionIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  Science as LabIcon,
  MonitorHeart as VitalsIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as AddressIcon,
  Edit as EditIcon,
  Timeline as TimelineIcon,
  EventNote as EncounterIcon,
  CalendarToday as CalendarIcon,
  Star as StarIcon,
  Launch as LaunchIcon,
  Psychology as CDSIcon,
  Info as InfoIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInYears } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import { useInitializationGuard } from '../../../hooks/useStableReferences';
import { getClinicalContext } from '../../../themes/clinicalThemeUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';

const PatientSummaryV4 = ({ patientId, department = 'general' }) => {
  
  const theme = useTheme();
  const navigate = useNavigate();
  const { 
    currentPatient, 
    setCurrentPatient, 
    getPatientResources, 
    isLoading, 
    getError,
    warmPatientCache,
    refreshPatientResources,
    fetchPatientEverything
  } = useFHIRResource();
  const { subscribe } = useClinicalWorkflow();
  
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [cdsLoading, setCdsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Get clinical context
  const clinicalContext = useMemo(() => 
    getClinicalContext(window.location.pathname, new Date().getHours(), department),
    [department]
  );
  
  // Initialization guard to prevent multiple loads
  const { isInitialized, isInitializing, markInitialized, markInitializing } = useInitializationGuard();

  // Load patient data using centralized FHIRResourceContext - prevent infinite loops
  useEffect(() => {
    const loadPatientData = async () => {
      if (!patientId || isInitializing) return;
      
      try {
        markInitializing();
        // Only set current patient if it's different
        if (!currentPatient || currentPatient.id !== patientId) {
          await setCurrentPatient(patientId);
          
          // Use the optimized batch request for summary view
          // $everything can return too many observations, limiting other important resources
          try {
            // Use batch request to get exactly what we need for the summary
            await warmPatientCache(patientId, 'summary');
          } catch (cacheError) {
            // If batch fails, try $everything with higher count
            try {
              await fetchPatientEverything(patientId, {
                types: ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation', 'Encounter'],
                count: 200, // Higher count to ensure we get all critical resources
                autoSince: true, // Auto-calculate _since for 3 months
                forceRefresh: false
              });
            } catch (everythingError) {
              // Both methods failed, but continue anyway
            }
          }
        }
        setIsInitialLoad(false);
        markInitialized();
      } catch (err) {
        // Error setting patient - continuing with initialization
        console.error('Error loading patient data:', err);
        setIsInitialLoad(false);
        markInitialized();
      }
    };

    // Only load if not already initialized for this patient
    if (!isInitialized || currentPatient?.id !== patientId) {
      loadPatientData();
    }
  }, [patientId]); // Minimal dependencies - no functions

  // Load CDS alerts for patient-view hooks
  const loadCDSAlerts = async () => {
    if (!patientId) return;
    
    setCdsLoading(true);
    try {
      // Get available services for patient-view hook
      const services = await cdsHooksClient.discoverServices();
      const patientViewServices = services.filter(s => s.hook === 'patient-view');
      
      const allAlerts = [];
      
      for (const service of patientViewServices) {
        try {
          const response = await cdsHooksClient.callService(service.id, {
            hook: 'patient-view',
            hookInstance: `dashboard-${Date.now()}`,
            context: {
              patientId: patientId
            }
          });
          
          if (response.cards) {
            allAlerts.push(...response.cards.map(card => ({
              ...card,
              serviceId: service.id,
              serviceName: service.title || service.id,
              timestamp: new Date()
            })));
          }
        } catch (serviceError) {
          
        }
      }
      
      setCdsAlerts(allAlerts);
    } catch (error) {
      
    } finally {
      setCdsLoading(false);
    }
  };

  // Load CDS alerts after patient data is loaded
  useEffect(() => {
    if (currentPatient && !isInitialLoad) {
      loadCDSAlerts();
    }
  }, [currentPatient, isInitialLoad]);

  // Subscribe to clinical workflow events for real-time updates
  useEffect(() => {
    if (!patientId) return;

    const unsubscribers = [];

    // Subscribe to condition changes
    const unsubCondition = subscribe(CLINICAL_EVENTS.CONDITION_ADDED, (data) => {
      if (data.patientId === patientId) {
        refreshPatientResources(patientId, 'Condition');
      }
    });
    unsubscribers.push(unsubCondition);

    // Subscribe to medication changes
    const unsubMedAdd = subscribe(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, (data) => {
      if (data.patientId === patientId) {
        refreshPatientResources(patientId, 'MedicationRequest');
      }
    });
    unsubscribers.push(unsubMedAdd);

    const unsubMedDisc = subscribe(CLINICAL_EVENTS.MEDICATION_DISCONTINUED, (data) => {
      if (data.patientId === patientId) {
        refreshPatientResources(patientId, 'MedicationRequest');
      }
    });
    unsubscribers.push(unsubMedDisc);

    // Subscribe to allergy changes
    const unsubAllergy = subscribe(CLINICAL_EVENTS.ALLERGY_ADDED, (data) => {
      if (data.patientId === patientId) {
        refreshPatientResources(patientId, 'AllergyIntolerance');
      }
    });
    unsubscribers.push(unsubAllergy);

    // Subscribe to observation changes
    const unsubObs = subscribe(CLINICAL_EVENTS.RESULT_ADDED, (data) => {
      if (data.patientId === patientId) {
        refreshPatientResources(patientId, 'Observation');
      }
    });
    unsubscribers.push(unsubObs);

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, [patientId, subscribe, refreshPatientResources]);

  // Get patient resources using centralized context - try to get data even if cache isn't fully warm
  const conditions = useMemo(() => {
    const resources = getPatientResources(patientId, 'Condition') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const medications = useMemo(() => {
    const resources = getPatientResources(patientId, 'MedicationRequest') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const observations = useMemo(() => {
    const resources = getPatientResources(patientId, 'Observation') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const encounters = useMemo(() => {
    const resources = getPatientResources(patientId, 'Encounter') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const allergies = useMemo(() => {
    const resources = getPatientResources(patientId, 'AllergyIntolerance') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const procedures = useMemo(() => {
    const resources = getPatientResources(patientId, 'Procedure') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const diagnosticReports = useMemo(() => {
    const resources = getPatientResources(patientId, 'DiagnosticReport') || [];
    return resources;
  }, [patientId, getPatientResources]);
  
  const immunizations = useMemo(() => {
    const resources = getPatientResources(patientId, 'Immunization') || [];
    return resources;
  }, [patientId, getPatientResources]);

  // Processed patient info
  const patientInfo = useMemo(() => {
    if (!currentPatient) return null;
    
    const patient = currentPatient;
    const name = patient.name?.[0];
    const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown Patient';
    const age = patient.birthDate ? differenceInYears(new Date(), new Date(patient.birthDate)) : null;
    const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
    const email = patient.telecom?.find(t => t.system === 'email')?.value;
    const address = patient.address?.[0];
    
    return {
      id: patient.id,
      fullName,
      firstName: name?.given?.[0] || '',
      lastName: name?.family || '',
      age,
      gender: patient.gender || 'unknown',
      birthDate: patient.birthDate,
      phone,
      email,
      address: address ? `${address.line?.join(' ') || ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim() : null
    };
  }, [currentPatient]);

  // Active conditions
  const activeConditions = useMemo(() => {
    return conditions
      .filter(condition => 
        condition.clinicalStatus?.coding?.[0]?.code === 'active' ||
        !condition.clinicalStatus
      )
      .slice(0, 5);
  }, [conditions]);

  // Current medications
  const currentMedications = useMemo(() => {
    return medications
      .filter(med => 
        med.status === 'active' || 
        med.status === 'completed' ||
        !med.status
      )
      .slice(0, 5);
  }, [medications]);

  // Recent vitals
  const recentVitals = useMemo(() => {
    const vitalsCodes = ['8480-6', '8462-4', '8310-5', '39156-5', '3141-9', '29463-7'];
    return observations
      .filter(obs => 
        obs.category?.[0]?.coding?.[0]?.code === 'vital-signs' ||
        vitalsCodes.some(code => obs.code?.coding?.[0]?.code === code)
      )
      .slice(0, 4);
  }, [observations]);

  // Active allergies
  const activeAllergies = useMemo(() => {
    return allergies
      .filter(allergy => 
        allergy.clinicalStatus?.coding?.[0]?.code === 'active' ||
        !allergy.clinicalStatus
      )
      .slice(0, 3);
  }, [allergies]);

  // Recent procedures
  const recentProcedures = useMemo(() => {
    return procedures
      .sort((a, b) => {
        const dateA = new Date(a.performedDateTime || a.performedPeriod?.start || 0);
        const dateB = new Date(b.performedDateTime || b.performedPeriod?.start || 0);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [procedures]);

  // Recent lab results
  const recentLabResults = useMemo(() => {
    return diagnosticReports
      .filter(report => 
        report.category?.some(cat => 
          cat.coding?.some(code => code.code === 'LAB')
        )
      )
      .sort((a, b) => {
        const dateA = new Date(a.effectiveDateTime || a.effectivePeriod?.start || 0);
        const dateB = new Date(b.effectiveDateTime || b.effectivePeriod?.start || 0);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [diagnosticReports]);

  // Recent immunizations
  const recentImmunizations = useMemo(() => {
    return immunizations
      .sort((a, b) => {
        const dateA = new Date(a.occurrenceDateTime || a.occurrenceString || 0);
        const dateB = new Date(b.occurrenceDateTime || b.occurrenceString || 0);
        return dateB - dateA;
      })
      .slice(0, 3);
  }, [immunizations]);

  // Most recent encounter
  const lastEncounter = useMemo(() => {
    if (encounters.length === 0) return null;
    return encounters
      .sort((a, b) => {
        const dateA = new Date(a.period?.start || 0);
        const dateB = new Date(b.period?.start || 0);
        return dateB - dateA;
      })[0];
  }, [encounters]);

  // Calculate clinical risk factors
  const clinicalRiskFactors = useMemo(() => {
    const risks = [];
    
    // Check for diabetes
    const hasDiabetes = conditions.some(c => 
      c.code?.coding?.some(code => 
        code.code?.includes('44054006') || // Diabetes mellitus
        code.display?.toLowerCase().includes('diabetes')
      )
    );
    if (hasDiabetes) risks.push({ type: 'Diabetes', level: 'high' });
    
    // Check for hypertension
    const hasHypertension = conditions.some(c => 
      c.code?.coding?.some(code => 
        code.code?.includes('38341003') || // Hypertension
        code.display?.toLowerCase().includes('hypertension')
      )
    );
    if (hasHypertension) risks.push({ type: 'Hypertension', level: 'medium' });
    
    // Check for cardiovascular disease
    const hasCardiovascular = conditions.some(c => 
      c.code?.coding?.some(code => 
        code.display?.toLowerCase().includes('coronary') ||
        code.display?.toLowerCase().includes('cardiac') ||
        code.display?.toLowerCase().includes('heart')
      )
    );
    if (hasCardiovascular) risks.push({ type: 'Cardiovascular Disease', level: 'high' });
    
    // Check age-related risks
    if (patientInfo?.age >= 65) {
      risks.push({ type: 'Age 65+', level: 'medium' });
    }
    
    return risks;
  }, [conditions, patientInfo]);

  const handleLaunchWorkspace = () => {
    navigate(`/patients/${patientId}/clinical`);
  };

  // Show loading only during initial load or when actively loading
  if (isInitialLoad || (isLoading && !currentPatient)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const error = getError('Patient');
  if (error || !patientInfo) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error || 'Patient not found'}
      </Alert>
    );
  }

  return (
    <Box sx={{ backgroundColor: 'background.default', minHeight: '100vh' }}>
      {/* Modern Layered Header */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.appBar - 1,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {/* Top Bar */}
        <Box 
          sx={{ 
            backgroundColor: theme.palette.grey[50],
            borderBottom: 1,
            borderColor: 'divider',
            px: 3,
            py: 1
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="overline" color="text.secondary">
              Patient Summary
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip 
                label="Patient View" 
                size="small" 
                sx={{ borderRadius: 0 }}
              />
              <Chip 
                label={`ID: ${patientId}`} 
                size="small" 
                variant="outlined"
                sx={{ borderRadius: 0 }}
              />
            </Stack>
          </Stack>
        </Box>

        {/* Main Patient Information */}
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  fontSize: '1.5rem',
                  bgcolor: theme.palette.primary.main,
                  borderRadius: 1,
                  boxShadow: '0 3px 6px rgba(0,0,0,0.16)'
                }}
              >
                {patientInfo.firstName.charAt(0)}{patientInfo.lastName.charAt(0)}
              </Avatar>
            </Grid>
            
            <Grid item xs>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                {patientInfo.fullName}
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  {patientInfo.age ? `${patientInfo.age} years` : 'Age unknown'} • {patientInfo.gender}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  DOB: {patientInfo.birthDate ? format(new Date(patientInfo.birthDate), 'MMM d, yyyy') : 'Unknown'}
                </Typography>
                {patientInfo.phone && (
                  <Typography variant="body2" color="text.secondary">
                    {patientInfo.phone}
                  </Typography>
                )}
                {patientInfo.email && (
                  <Typography variant="body2" color="text.secondary">
                    {patientInfo.email}
                  </Typography>
                )}
              </Stack>
            </Grid>

            <Grid item>
              <Stack spacing={1} alignItems="flex-end">
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<WorkspaceIcon />}
                  onClick={handleLaunchWorkspace}
                  sx={{
                    borderRadius: 1,
                    fontWeight: 600,
                    px: 3,
                    textTransform: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.25)'
                    }
                  }}
                >
                  Open Clinical Workspace
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    sx={{ borderRadius: 0.5 }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    startIcon={<TimelineIcon />}
                    onClick={() => navigate(`/patients/${patientId}/timeline`)}
                    sx={{ borderRadius: 0.5 }}
                  >
                    Timeline
                  </Button>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>

        {/* Quick Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Active Problems */}
          <Grid item xs={12} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.warning.main, 0.02)} 100%)`,
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => navigate(`/patients/${patientId}/clinical?tab=chart`)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary" display="block">
                    Active Problems
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: activeConditions.length > 0 ? theme.palette.warning.main : 'text.primary' }}>
                    {activeConditions.length}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <ConditionIcon sx={{ color: theme.palette.warning.main }} />
                </Avatar>
              </Stack>
              
              {activeConditions.length > 0 ? (
                <Box>
                  {activeConditions.slice(0, 3).map((condition, index) => (
                    <Box key={condition.id} sx={{ py: 0.5 }}>
                      <Typography variant="body2" noWrap>
                        {condition.code?.text || 'Unknown condition'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {condition.onsetDateTime ? format(parseISO(condition.onsetDateTime), 'MMM yyyy') : 'Unknown onset'}
                      </Typography>
                    </Box>
                  ))}
                  {activeConditions.length > 3 && (
                    <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                      +{activeConditions.length - 3} more
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active problems recorded
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Current Medications */}
          <Grid item xs={12} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => navigate(`/patients/${patientId}/clinical?tab=chart`)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary" display="block">
                    Current Medications
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: currentMedications.length > 5 ? theme.palette.info.main : 'text.primary' }}>
                    {currentMedications.length}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <MedicationIcon sx={{ color: theme.palette.info.main }} />
                </Avatar>
              </Stack>
              
              {currentMedications.length > 0 ? (
                <Box>
                  {currentMedications.slice(0, 3).map((med, index) => (
                    <Box key={med.id} sx={{ py: 0.5 }}>
                      <Typography variant="body2" noWrap>
                        {med.medicationCodeableConcept?.text ||
                         med.medicationCodeableConcept?.coding?.[0]?.display ||
                         med.medication?.concept?.text ||
                         med.medication?.concept?.coding?.[0]?.display ||
                         med.medication?.display ||
                         'Unknown medication'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {med.dosageInstruction?.[0]?.text || 'See instructions'}
                      </Typography>
                    </Box>
                  ))}
                  {currentMedications.length > 3 && (
                    <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                      +{currentMedications.length - 3} more
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No current medications
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Recent Vitals */}
          <Grid item xs={12} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.success.main, 0.02)} 100%)`,
                '&:hover': {
                  boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => navigate(`/patients/${patientId}/clinical?tab=results`)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary" display="block">
                    Recent Vitals
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 600 }}>
                    {recentVitals.length}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <VitalsIcon sx={{ color: theme.palette.success.main }} />
                </Avatar>
              </Stack>
              
              {recentVitals.length > 0 ? (
                <Box>
                  {recentVitals.slice(0, 3).map((vital, index) => (
                    <Box key={vital.id} sx={{ py: 0.5 }}>
                      <Typography variant="body2" noWrap>
                        {vital.code?.text || 'Unknown vital'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {vital.valueQuantity?.value || '--'} {vital.valueQuantity?.unit || ''}
                      </Typography>
                    </Box>
                  ))}
                  {recentVitals.length > 3 && (
                    <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                      +{recentVitals.length - 3} more
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent vitals
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Allergies */}
          <Grid item xs={12} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: activeAllergies.length > 0 ? '0 1px 3px rgba(244,67,54,0.3)' : '0 1px 3px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeAllergies.length > 0 
                  ? `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.error.main, 0.03)} 100%)`
                  : `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.grey[200], 0.3)} 100%)`,
                '&:hover': {
                  boxShadow: activeAllergies.length > 0 ? '0 4px 6px rgba(244,67,54,0.4)' : '0 4px 6px rgba(0,0,0,0.15)',
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => navigate(`/patients/${patientId}/clinical?tab=chart`)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary" display="block">
                    Allergies
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: activeAllergies.length > 0 ? theme.palette.error.main : 'text.primary' }}>
                    {activeAllergies.length}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <WarningIcon sx={{ color: theme.palette.error.main }} />
                </Avatar>
              </Stack>
              
              {activeAllergies.length > 0 ? (
                <Box>
                  {activeAllergies.slice(0, 3).map((allergy, index) => (
                    <Box key={allergy.id} sx={{ py: 0.5 }}>
                      <Typography variant="body2" noWrap>
                        {allergy.code?.text || 'Unknown allergen'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {allergy.criticality || 'Unknown'} severity
                      </Typography>
                    </Box>
                  ))}
                  {activeAllergies.length > 3 && (
                    <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                      +{activeAllergies.length - 3} more
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  NKDA - No known allergies
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Clinical Risk Factors */}
        {clinicalRiskFactors.length > 0 && (
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: 1, 
              mb: 3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.error.main, 0.02)} 100%)`
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Clinical Risk Factors
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {clinicalRiskFactors.map((risk, index) => (
                <Chip
                  key={index}
                  label={risk.type}
                  color={risk.level === 'high' ? 'error' : 'warning'}
                  size="small"
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Paper>
        )}

        {/* Additional Clinical Data */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Recent Procedures */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Procedures
              </Typography>
              {recentProcedures.length > 0 ? (
                <List dense>
                  {recentProcedures.slice(0, 3).map((procedure, index) => (
                    <ListItem key={procedure.id} divider={index < recentProcedures.length - 1}>
                      <ListItemText
                        primary={procedure.code?.text || procedure.code?.coding?.[0]?.display || 'Unknown procedure'}
                        secondary={procedure.performedDateTime ? 
                          format(parseISO(procedure.performedDateTime), 'MMM d, yyyy') : 
                          'Date unknown'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent procedures
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Recent Lab Results */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Lab Results
              </Typography>
              {recentLabResults.length > 0 ? (
                <List dense>
                  {recentLabResults.slice(0, 3).map((report, index) => (
                    <ListItem key={report.id} divider={index < recentLabResults.length - 1}>
                      <ListItemText
                        primary={report.code?.text || report.code?.coding?.[0]?.display || 'Lab Report'}
                        secondary={
                          <Stack direction="row" spacing={1}>
                            <Typography variant="caption">
                              {report.effectiveDateTime ? 
                                format(parseISO(report.effectiveDateTime), 'MMM d, yyyy') : 
                                'Date unknown'
                              }
                            </Typography>
                            {report.status && (
                              <Chip 
                                label={report.status} 
                                size="small" 
                                color={report.status === 'final' ? 'success' : 'default'}
                                sx={{ height: 16, fontSize: '0.7rem' }}
                              />
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent lab results
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Immunizations */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Immunizations
              </Typography>
              {recentImmunizations.length > 0 ? (
                <List dense>
                  {recentImmunizations.map((immunization, index) => (
                    <ListItem key={immunization.id} divider={index < recentImmunizations.length - 1}>
                      <ListItemText
                        primary={immunization.vaccineCode?.text || immunization.vaccineCode?.coding?.[0]?.display || 'Vaccine'}
                        secondary={immunization.occurrenceDateTime ? 
                          format(parseISO(immunization.occurrenceDateTime), 'MMM d, yyyy') : 
                          'Date unknown'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent immunizations recorded
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Last Encounter */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                background: lastEncounter ? 
                  `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)` :
                  theme.palette.background.paper
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Last Encounter
              </Typography>
              {lastEncounter ? (
                <Box>
                  <Typography variant="body1" gutterBottom>
                    {lastEncounter.type?.[0]?.text || lastEncounter.class?.display || 'Encounter'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {lastEncounter.period?.start ? 
                      format(parseISO(lastEncounter.period.start), 'MMM d, yyyy h:mm a') : 
                      'Date unknown'
                    }
                  </Typography>
                  {lastEncounter.reasonCode?.[0] && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Reason: {lastEncounter.reasonCode[0].text || lastEncounter.reasonCode[0].coding?.[0]?.display}
                    </Typography>
                  )}
                  <Chip 
                    label={lastEncounter.status || 'unknown'} 
                    size="small" 
                    color={lastEncounter.status === 'finished' ? 'success' : 'default'}
                    sx={{ mt: 1 }}
                  />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent encounters
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* CDS Alerts */}
        {(cdsLoading || cdsAlerts.length > 0) && (
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: 1, 
              mb: 3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.warning.main, 0.02)} 100%)`
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <CDSIcon color="warning" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Clinical Decision Support
              </Typography>
              {cdsLoading && <CircularProgress size={20} />}
              {cdsAlerts.length > 0 && (
                <Chip 
                  label={`${cdsAlerts.length} Alert${cdsAlerts.length > 1 ? 's' : ''}`}
                  color="warning"
                  size="small"
                  sx={{ borderRadius: 0.5 }}
                />
              )}
            </Stack>
            
            {cdsLoading && (
              <Alert 
                severity="info"
                sx={{ borderRadius: 0.5 }}
              >
                Evaluating clinical decision support rules...
              </Alert>
            )}
            
            {cdsAlerts.map((alert, index) => (
              <Alert 
                key={index}
                severity={alert.indicator === 'critical' ? 'error' : alert.indicator === 'warning' ? 'warning' : 'info'}
                sx={{ 
                  mb: index < cdsAlerts.length - 1 ? 1 : 0,
                  borderRadius: 0.5
                }}
                action={
                  <Button 
                    size="small" 
                    variant="outlined"
                    sx={{ borderRadius: 0.5 }}
                    onClick={() => navigate('/cds-studio')}
                  >
                    View Details
                  </Button>
                }
              >
                <Typography variant="subtitle2" gutterBottom>
                  {alert.summary}
                </Typography>
                <Typography variant="body2">
                  {alert.detail}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Source: {alert.serviceName}
                </Typography>
              </Alert>
            ))}
          </Paper>
        )}

        {/* Quick Actions */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 3, 
            borderRadius: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
            }
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button 
              variant="outlined" 
              startIcon={<EncounterIcon />}
              sx={{ borderRadius: 0 }}
              onClick={() => navigate(`/patients/${patientId}/encounters`)}
            >
              View Encounters
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<LabIcon />}
              sx={{ borderRadius: 0 }}
              onClick={() => navigate(`/patients/${patientId}/lab-results`)}
            >
              Lab Results
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<MedicationIcon />}
              sx={{ borderRadius: 0 }}
              onClick={() => navigate(`/patients/${patientId}/medications`)}
            >
              Medication History
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<TimelineIcon />}
              sx={{ borderRadius: 0 }}
              onClick={() => navigate(`/patients/${patientId}/timeline`)}
            >
              Clinical Timeline
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default PatientSummaryV4;