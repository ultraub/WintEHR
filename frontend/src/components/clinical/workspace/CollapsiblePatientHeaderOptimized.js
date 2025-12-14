/**
 * Optimized Collapsible Patient Header Component
 * Enhanced version with better space utilization and progressive collapse states
 * Consolidates action buttons and provides smooth scroll-based transitions
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Avatar,
  Badge,
  Chip,
  Stack,
  Button,
  Grid,
  Divider,
  Tooltip,
  Collapse,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  MoreVert as MoreIcon,
  FiberManualRecord as ActiveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Favorite as PulseIcon,
  Thermostat as TempIcon,
  Speed as BPIcon,
  MonitorHeart as VitalsIcon,
  VerifiedUser as CodeStatusIcon,
  NearMe as LocationIcon,
  CloseFullscreen as CollapseIcon,
  OpenInFull as ExpandIcon
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { usePatientCDSAlerts } from '../../../contexts/CDSContext';
import { useNavigate } from 'react-router-dom';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';
import websocketService from '../../../services/websocket';
import { useDataQualityLogger } from '../../../core/fhir/utils/dataQualityLogger';
import { fhirClient } from '../../../core/fhir/services/fhirClient';

// Collapse states for progressive compression
const COLLAPSE_STATES = {
  EXPANDED: 'expanded',     // Full header with all details
  COMPACT: 'compact',       // Medium size with key info
  MINIMAL: 'minimal'        // Single line with just name/MRN
};

const CollapsiblePatientHeaderOptimized = ({ 
  patientId, 
  onPrint, 
  onNavigateToTab,
  dataLoading = false,
  scrollContainerRef // Reference to the scrollable container
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const { currentPatient, getPatientResources, refreshPatientData } = useFHIRResource();
  const { alerts } = usePatientCDSAlerts(patientId);
  const { subscribe } = useClinicalWorkflow();
  const dataQuality = useDataQualityLogger('CollapsiblePatientHeader');
  
  const [collapseState, setCollapseState] = useState(COLLAPSE_STATES.EXPANDED);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const headerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const lastStateChangeRef = useRef(0);

  // State for freshly fetched vital signs (more reliable than cached data)
  const [vitalSignsObservations, setVitalSignsObservations] = useState([]);

  // Get patient resources - already memoized in FHIRResourceContext
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];

  // Fetch vital signs directly for accurate header display
  useEffect(() => {
    if (!patientId) return;

    const fetchVitalSigns = async () => {
      try {
        const result = await fhirClient.search('Observation', {
          patient: patientId,
          category: 'vital-signs',
          _sort: '-date',
          _count: 50
        });
        setVitalSignsObservations(result.resources || []);
      } catch (err) {
        console.error('Failed to fetch vital signs for header:', err);
        // Fallback to cached observations if fetch fails
        setVitalSignsObservations(observations.filter(obs =>
          obs.category?.some(cat =>
            cat.coding?.some(c => c.code === 'vital-signs')
          )
        ));
      }
    };

    fetchVitalSigns();
  }, [patientId]); // Only re-fetch when patient changes
  
  // Calculate active counts - memoized to prevent re-filtering on every render
  const activeAllergies = useMemo(() => 
    allergies.filter(a => 
      a.clinicalStatus?.coding?.[0]?.code === 'active'
    ), [allergies]
  );
  
  const activeConditions = useMemo(() => 
    conditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code === 'active'
    ), [conditions]
  );
  
  const activeMedications = useMemo(() => 
    medications.filter(m => 
      m.status === 'active'
    ), [medications]
  );
  
  // Critical alerts - memoized
  const criticalAlerts = useMemo(() => 
    alerts.filter(a => a.indicator === 'critical'), 
    [alerts]
  );
  
  const warningAlerts = useMemo(() => 
    alerts.filter(a => a.indicator === 'warning'), 
    [alerts]
  );

  // Handle header updates
  const handleHeaderUpdate = useCallback((eventType, eventData) => {
    console.log('[PatientHeader] Handling header update:', eventType, eventData);
    
    // Refresh relevant data based on event type
    switch (eventType) {
      case CLINICAL_EVENTS.ALLERGY_ADDED:
      case CLINICAL_EVENTS.ALLERGY_UPDATED:
      case CLINICAL_EVENTS.ALLERGY_REMOVED:
        // Refresh patient data to get updated allergies
        if (refreshPatientData) {
          refreshPatientData(patientId);
        }
        break;
        
      case CLINICAL_EVENTS.ALERT_ADDED:
      case CLINICAL_EVENTS.ALERT_UPDATED:
      case CLINICAL_EVENTS.ALERT_REMOVED:
        // Refresh patient data to trigger CDS alerts refresh
        if (refreshPatientData) {
          refreshPatientData(patientId);
        }
        break;
        
      case CLINICAL_EVENTS.CONDITION_DIAGNOSED:
      case CLINICAL_EVENTS.CONDITION_UPDATED:
      case CLINICAL_EVENTS.MEDICATION_PRESCRIBED:
      case CLINICAL_EVENTS.MEDICATION_DISCONTINUED:
        // Refresh patient data for conditions and medications
        if (refreshPatientData) {
          refreshPatientData(patientId);
        }
        break;
    }
  }, [patientId, refreshPatientData]);

  // Real-time updates subscription
  useEffect(() => {
    if (!patientId) return;

    console.log('[PatientHeader] Setting up real-time subscriptions for patient:', patientId);

    const subscriptions = [];

    // Subscribe to allergy and alert events
    const headerEvents = [
      CLINICAL_EVENTS.ALLERGY_ADDED,
      CLINICAL_EVENTS.ALLERGY_UPDATED,
      CLINICAL_EVENTS.ALLERGY_REMOVED,
      CLINICAL_EVENTS.ALERT_ADDED,
      CLINICAL_EVENTS.ALERT_UPDATED,
      CLINICAL_EVENTS.ALERT_REMOVED,
      CLINICAL_EVENTS.CONDITION_DIAGNOSED,
      CLINICAL_EVENTS.CONDITION_UPDATED,
      CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
      CLINICAL_EVENTS.MEDICATION_DISCONTINUED
    ];

    headerEvents.forEach(eventType => {
      const unsubscribe = subscribe(eventType, (event) => {
        console.log('[PatientHeader] Event received:', {
          eventType,
          eventPatientId: event.patientId,
          currentPatientId: patientId,
          event
        });
        
        // Handle update if the event is for the current patient
        if (event.patientId === patientId) {
          console.log('[PatientHeader] Updating header for event:', eventType);
          handleHeaderUpdate(eventType, event);
        }
      });
      subscriptions.push(unsubscribe);
    });

    return () => {
      console.log('[PatientHeader] Cleaning up subscriptions');
      subscriptions.forEach(unsub => unsub());
    };
  }, [patientId, subscribe, handleHeaderUpdate]);

  // WebSocket patient room subscription for multi-user sync
  useEffect(() => {
    if (!patientId || !websocketService.isConnected) return;

    console.log('[PatientHeader] Setting up WebSocket patient room subscription for:', patientId);

    let subscriptionId = null;

    const setupPatientSubscription = async () => {
      try {
        // Subscribe to patient room for allergy and condition resources
        const resourceTypes = [
          'AllergyIntolerance',
          'Condition',
          'MedicationRequest',
          'Flag' // For clinical alerts
        ];

        subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
        console.log('[PatientHeader] Successfully subscribed to patient room:', subscriptionId);
      } catch (error) {
        console.error('[PatientHeader] Failed to subscribe to patient room:', error);
      }
    };

    setupPatientSubscription();

    return () => {
      if (subscriptionId) {
        console.log('[PatientHeader] Unsubscribing from patient room:', subscriptionId);
        websocketService.unsubscribeFromPatient(subscriptionId);
      }
    };
  }, [patientId]);

  // Progressive scroll handling with debouncing and hysteresis
  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef?.current || window;
      const scrollTop = container === window 
        ? window.pageYOffset || document.documentElement.scrollTop
        : container.scrollTop;
      
      setScrollY(scrollTop);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Debounce the state change to prevent flickering
      scrollTimeoutRef.current = setTimeout(() => {
        const currentState = collapseState;
        const scrollDirection = scrollTop > lastScrollTopRef.current ? 'down' : 'up';
        const scrollDistance = Math.abs(scrollTop - lastStateChangeRef.current);
        lastScrollTopRef.current = scrollTop;
        
        // Only change state if we've scrolled enough distance (prevents micro-movements)
        if (scrollDistance < 10) return;
        
        // Apply hysteresis to prevent flickering at boundaries
        // Different thresholds for expanding vs collapsing
        let newState = currentState;
        
        if (currentState === COLLAPSE_STATES.EXPANDED) {
          // Collapsing from expanded state
          if (scrollTop > 70) { // Higher threshold to start collapsing
            newState = COLLAPSE_STATES.COMPACT;
            if (isDetailsExpanded) setIsDetailsExpanded(false);
          }
        } else if (currentState === COLLAPSE_STATES.COMPACT) {
          // From compact state
          if (scrollDirection === 'up' && scrollTop < 40) { // Lower threshold to expand
            newState = COLLAPSE_STATES.EXPANDED;
          } else if (scrollDirection === 'down' && scrollTop > 170) { // Higher threshold to minimize
            newState = COLLAPSE_STATES.MINIMAL;
          }
        } else if (currentState === COLLAPSE_STATES.MINIMAL) {
          // Expanding from minimal state
          if (scrollTop < 130) { // Lower threshold to expand to compact
            newState = COLLAPSE_STATES.COMPACT;
          }
        }
        
        // Only update if state actually changed
        if (newState !== currentState) {
          setCollapseState(newState);
          lastStateChangeRef.current = scrollTop;
        }
      }, 50); // 50ms debounce delay
    };

    const container = scrollContainerRef?.current || window;
    
    // Add scroll listener
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    // Initial state check
    handleScroll();
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollContainerRef, isDetailsExpanded, collapseState]);

  // Helper functions with data quality logging
  const calculateAge = (birthDate) => {
    if (!birthDate) {
      dataQuality.logFallback('patient.birthDate', birthDate, 'Unknown', {
        reason: 'Missing birth date',
        patientId
      });
      return 'Unknown';
    }
    const date = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
    if (!isValid(date)) {
      dataQuality.logFallback('patient.birthDate', birthDate, 'Unknown', {
        reason: 'Invalid date format',
        patientId
      });
      return 'Unknown';
    }
    return differenceInYears(new Date(), date);
  };

  const formatDate = (date) => {
    if (!date) {
      dataQuality.logFallback('patient.date', date, 'Unknown', {
        reason: 'Missing date value'
      });
      return 'Unknown';
    }
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(parsed)) {
      dataQuality.logFallback('patient.date', date, 'Unknown', {
        reason: 'Invalid date format',
        originalValue: date
      });
      return 'Unknown';
    }
    return format(parsed, 'MMM d, yyyy');
  };

  const formatMRN = (patient) => {
    const mrn = patient?.identifier?.find(id =>
      id.type?.coding?.[0]?.code === 'MR' ||
      id.system?.includes('mrn')
    );
    if (!mrn?.value) {
      if (patient?.id) {
        dataQuality.logFallback('patient.identifier.MRN', mrn?.value, patient.id, {
          reason: 'No MRN identifier, using patient ID',
          patientId: patient.id
        });
        return patient.id;
      }
      dataQuality.logFallback('patient.identifier.MRN', undefined, 'Unknown', {
        reason: 'No MRN or patient ID available'
      });
      return 'Unknown';
    }
    return mrn.value;
  };

  const getAddress = (patient) => {
    const addr = patient?.address?.[0];
    if (!addr) return 'No address';
    const parts = [
      addr.line?.join(' '),
      addr.city,
      addr.state,
      addr.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getPhone = (patient) => {
    const phone = patient?.telecom?.find(t => t.system === 'phone');
    return phone?.value || 'No phone';
  };

  // Get most recent vitals - memoized, using freshly fetched vital signs data
  const latestVitals = useMemo(() => {
    // Use freshly fetched vital signs, fallback to cached observations if empty
    const vitalsData = vitalSignsObservations.length > 0 ? vitalSignsObservations : observations;

    const getLatestVital = (type) => {
      const vitals = vitalsData.filter(obs => {
        const codings = obs.code?.coding || [];
        const hasCode = (targetCode) => codings.some(c => c.code === targetCode);
        const hasDisplayMatch = (term) => codings.some(c => c.display?.toLowerCase().includes(term));

        switch(type) {
          case 'bp':
            // 85354-9 is the BP panel code (composite with systolic/diastolic components)
            return hasCode('85354-9') || hasDisplayMatch('blood pressure');
          case 'pulse':
            return hasCode('8867-4') || hasDisplayMatch('heart rate');
          case 'temp':
            return hasCode('8310-5') || hasDisplayMatch('temperature');
          default:
            return false;
        }
      });

      // Sort by date descending (most recent first) - data from FHIR is already sorted
      // but we sort again to ensure proper ordering across data sources
      const sorted = vitals.sort((a, b) =>
        new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0)
      );

      return sorted[0];
    };

    return {
      bp: getLatestVital('bp'),
      pulse: getLatestVital('pulse'),
      temp: getLatestVital('temp')
    };
  }, [vitalSignsObservations, observations]);

  // Format vital values
  const formatVital = (obs) => {
    if (!obs) return null;

    // Blood pressure (has systolic and diastolic components)
    if (obs.component?.length >= 2) {
      const systolic = obs.component.find(c =>
        c.code?.coding?.some(coding => coding.code === '8480-6')
      );
      const diastolic = obs.component.find(c =>
        c.code?.coding?.some(coding => coding.code === '8462-4')
      );
      if (systolic && diastolic) {
        return `${systolic.valueQuantity?.value}/${diastolic.valueQuantity?.value}`;
      }
    }

    // Single value vitals
    if (obs.valueQuantity) {
      return `${obs.valueQuantity.value}${obs.valueQuantity.unit ? ' ' + obs.valueQuantity.unit : ''}`;
    }

    return null;
  };

  // Memoized patient name with data quality logging
  const patientName = useMemo(() => {
    if (!currentPatient) {
      dataQuality.logFallback('patient', currentPatient, 'Unknown Patient', {
        reason: 'No patient data available'
      });
      return 'Unknown Patient';
    }
    const names = currentPatient.name?.[0];
    if (!names) {
      dataQuality.logFallback('patient.name', names, 'Unknown Patient', {
        reason: 'Patient has no name array',
        patientId: currentPatient.id
      });
      return 'Unknown Patient';
    }
    const fullName = `${names.given?.join(' ') || ''} ${names.family || ''}`.trim();
    if (!fullName) {
      dataQuality.logFallback('patient.name', names, 'Unknown Patient', {
        reason: 'Name parts are empty',
        patientId: currentPatient.id,
        nameData: names
      });
      return 'Unknown Patient';
    }
    return fullName;
  }, [currentPatient, dataQuality]);

  // Menu handlers
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleShare = () => {
    // Implement share functionality
    handleMenuClose();
  };

  const handleEdit = () => {
    // Navigate to patient edit
    navigate(`/patients/${patientId}/edit`);
    handleMenuClose();
  };
  
  if (!currentPatient) return null;

  // Recent vitals - using memoized values
  const latestBP = latestVitals.bp;
  const latestPulse = latestVitals.pulse;
  const latestTemp = latestVitals.temp;

  // Render minimal header (single line)
  const renderMinimalHeader = () => (
    <Box sx={{ 
      p: 1, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1.5,
      minHeight: 48
    }}>
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: 'primary.main',
          fontSize: '0.875rem'
        }}
      >
        {patientName.charAt(0)}
      </Avatar>
      
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {patientName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {currentPatient.gender}, {calculateAge(currentPatient.birthDate)}y • MRN: {formatMRN(currentPatient)}
        </Typography>
        
        {/* Critical info badges */}
        {(activeAllergies.length > 0 || activeMedications.length >= 5) && (
          <Stack direction="row" spacing={0.5}>
            {activeAllergies.length > 0 && (
              <Badge badgeContent={activeAllergies.length} color="error" variant="dot">
                <WarningIcon sx={{ fontSize: 16 }} color="error" />
              </Badge>
            )}
            {activeMedications.length >= 5 && (
              <Badge badgeContent={activeMedications.length} color="warning" variant="dot">
                <MedicationIcon sx={{ fontSize: 16 }} color="warning" />
              </Badge>
            )}
          </Stack>
        )}
      </Stack>

      {/* Minimal actions */}
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Expand header">
          <IconButton 
            size="small"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <ExpandIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onPrint}>
          <PrintIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>
    </Box>
  );

  // Render compact header
  const renderCompactHeader = () => (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: 'primary.main',
            fontSize: '1.125rem'
          }}
        >
          {patientName.charAt(0)}
        </Avatar>
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {patientName}
            </Typography>
            <Chip
              icon={<ActiveIcon sx={{ fontSize: 10 }} />}
              label="Active"
              size="small"
              color="success"
              sx={{ height: 20 }}
            />
            <Typography variant="body2" color="text.secondary">
              {currentPatient.gender}, {calculateAge(currentPatient.birthDate)}y
            </Typography>
          </Stack>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              MRN: {formatMRN(currentPatient)}
            </Typography>
            {!isMobile && (
              <>
                <Chip
                  size="small"
                  icon={<AssignmentIcon sx={{ fontSize: 14 }} />}
                  label={`${activeConditions.length}`}
                  onClick={() => onNavigateToTab?.('chart-review')}
                  sx={{ height: 22, cursor: 'pointer' }}
                />
                <Chip
                  size="small"
                  icon={<MedicationIcon sx={{ fontSize: 14 }} />}
                  label={`${activeMedications.length}`}
                  color={activeMedications.length >= 5 ? 'warning' : 'default'}
                  onClick={() => onNavigateToTab?.('chart-review')}
                  sx={{ height: 22, cursor: 'pointer' }}
                />
                {activeAllergies.length > 0 && (
                  <Chip
                    size="small"
                    icon={<WarningIcon sx={{ fontSize: 14 }} />}
                    label={`${activeAllergies.length}`}
                    color="error"
                    onClick={() => onNavigateToTab?.('chart-review')}
                    sx={{ height: 22, cursor: 'pointer' }}
                  />
                )}
              </>
            )}
          </Stack>
        </Box>

        {/* Compact actions */}
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={onPrint}>
            <PrintIcon fontSize="small" />
          </IconButton>
          <Tooltip title="More actions">
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );

  // Render expanded header (full details)
  const renderExpandedHeader = () => (
    <>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Patient Identity Section */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: 'primary.main',
                fontSize: '1.5rem'
              }}
            >
              {patientName.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {patientName}
                </Typography>
                <Chip
                  icon={<ActiveIcon sx={{ fontSize: 12 }} />}
                  label="Active"
                  size="small"
                  color="success"
                  sx={{ height: 22 }}
                />
                {/* Action buttons integrated into header */}
                <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
                  <Tooltip title="Print Patient Summary">
                    <IconButton size="small" onClick={onPrint}>
                      <PrintIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Share Chart">
                    <IconButton size="small" onClick={handleShare}>
                      <ShareIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={isDetailsExpanded ? "Hide Details" : "Show Details"}>
                    <IconButton 
                      size="small"
                      onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                    >
                      {isDetailsExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="More actions">
                    <IconButton size="small" onClick={handleMenuOpen}>
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  {currentPatient.gender || 'Unknown'}, {calculateAge(currentPatient.birthDate)} years
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  DOB: {formatDate(currentPatient.birthDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  MRN: {formatMRN(currentPatient)}
                </Typography>
              </Stack>
              
              {/* Clinical Summary Chips - Same line */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Tooltip title="Active Conditions">
                  <Chip
                    size="small"
                    icon={<AssignmentIcon sx={{ fontSize: 16 }} />}
                    label={`${activeConditions.length} Conditions`}
                    color={activeConditions.length > 0 ? 'warning' : 'default'}
                    onClick={() => onNavigateToTab?.('chart-review')}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
                <Tooltip title="Active Medications">
                  <Chip
                    size="small"
                    icon={<MedicationIcon sx={{ fontSize: 16 }} />}
                    label={`${activeMedications.length} Medications`}
                    color={activeMedications.length >= 5 ? 'warning' : activeMedications.length > 0 ? 'info' : 'default'}
                    onClick={() => onNavigateToTab?.('chart-review')}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
                {activeAllergies.length > 0 && (
                  <Tooltip title="Active Allergies">
                    <Chip
                      size="small"
                      icon={<WarningIcon sx={{ fontSize: 16 }} />}
                      label={`${activeAllergies.length} Allergies`}
                      color="error"
                      onClick={() => onNavigateToTab?.('chart-review')}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                )}
                {!isMobile && latestBP && (
                  <Chip
                    size="small"
                    icon={<BPIcon sx={{ fontSize: 16 }} />}
                    label={`BP: ${formatVital(latestBP)}`}
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </Box>
      
      {/* Expandable Detailed Information */}
      <Collapse in={isDetailsExpanded}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
          <Grid container spacing={3}>
            {/* Contact Information */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Contact Information
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getPhone(currentPatient)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {getAddress(currentPatient)}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
            
            {/* Recent Vitals */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Vitals
              </Typography>
              <Stack spacing={1}>
                {latestBP && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BPIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      BP: {formatVital(latestBP)}
                    </Typography>
                  </Stack>
                )}
                {latestPulse && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PulseIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      Pulse: {formatVital(latestPulse)}
                    </Typography>
                  </Stack>
                )}
                {latestTemp && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TempIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      Temp: {formatVital(latestTemp)}
                    </Typography>
                  </Stack>
                )}
                {!latestBP && !latestPulse && !latestTemp && (
                  <Typography variant="body2" color="text.secondary">
                    No recent vitals
                  </Typography>
                )}
              </Stack>
            </Grid>
            
            {/* Clinical Alerts Summary */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Clinical Alerts
              </Typography>
              <Stack spacing={1}>
                {criticalAlerts.length > 0 && (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''}
                  </Alert>
                )}
                {warningAlerts.length > 0 && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''}
                  </Alert>
                )}
                {criticalAlerts.length === 0 && warningAlerts.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No active alerts
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </>
  );

  // Main render logic based on collapse state
  const renderHeader = () => {
    switch (collapseState) {
      case COLLAPSE_STATES.MINIMAL:
        return renderMinimalHeader();
      case COLLAPSE_STATES.COMPACT:
        return renderCompactHeader();
      case COLLAPSE_STATES.EXPANDED:
      default:
        return renderExpandedHeader();
    }
  };

  return (
    <>
      <Paper
        ref={headerRef}
        elevation={collapseState === COLLAPSE_STATES.MINIMAL ? 3 : 1}
        sx={{
          backgroundColor: 'background.paper',
          transition: theme.transitions.create(['height', 'box-shadow'], {
            duration: theme.transitions.duration.standard, // Slower transition for smoother effect
            easing: theme.transitions.easing.easeInOut,
          }),
          borderRadius: 0,
          borderBottom: `1px solid ${theme.palette.divider}`,
          // Dynamic height based on collapse state
          minHeight: collapseState === COLLAPSE_STATES.MINIMAL ? 48 : 
                     collapseState === COLLAPSE_STATES.COMPACT ? 72 : 
                     'auto',
          overflow: 'hidden'
        }}
      >
        {dataLoading && (
          <LinearProgress 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0,
              height: 2
            }} 
          />
        )}
        
        {renderHeader()}
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleShare}>
          <ShareIcon fontSize="small" sx={{ mr: 1 }} />
          Share Chart
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Patient
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          onPrint();
          handleMenuClose();
        }}>
          <PrintIcon fontSize="small" sx={{ mr: 1 }} />
          Print Summary
        </MenuItem>
      </Menu>
    </>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(CollapsiblePatientHeaderOptimized, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these props change
  return (
    prevProps.patientId === nextProps.patientId &&
    prevProps.dataLoading === nextProps.dataLoading &&
    prevProps.onPrint === nextProps.onPrint &&
    prevProps.onNavigateToTab === nextProps.onNavigateToTab &&
    prevProps.scrollContainerRef === nextProps.scrollContainerRef
  );
});