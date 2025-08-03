/**
 * Imaging Tab Component - Enhanced
 * Display and manage medical imaging studies with gallery view, body map, and DICOM viewer
 * Part of the Clinical UI Improvements Initiative
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CardMedia,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  ImageList,
  ImageListItem,
  Fade
} from '@mui/material';
import {
  Image as ImagingIcon,
  Scanner as CTIcon,
  MedicalServices as MRIcon,
  CameraAlt as XRayIcon,
  MonitorHeart as UltrasoundIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CalendarMonth as CalendarIcon,
  LocalHospital as ModalityIcon,
  Description as ReportIcon,
  PlayArrow as PlayIcon,
  Fullscreen as FullscreenIcon,
  ZoomIn as ZoomIcon,
  RotateRight as RotateIcon,
  GridView as SeriesIcon,
  PhotoLibrary as InstanceIcon,
  Warning as WarningIcon,
  CheckCircle as CompleteIcon,
  Timeline as TimelineIcon,
  ViewModule as GalleryIcon,
  ViewList as ListIcon,
  AccountCircle as BodyMapIcon,
  AccessTime as RecentIcon,
  Collections as CollectionsIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import axios from 'axios';
import DICOMViewer from '../../imaging/DICOMViewer';
import ImagingReportDialog from '../../imaging/ImagingReportDialog';
import DownloadDialog from '../../imaging/DownloadDialog';
import ShareDialog from '../../imaging/ShareDialog';
import { printDocument } from '../../../../core/export/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';
import ClinicalTabHeader from '../ClinicalTabHeader';

// Helper functions
const useDensity = () => {
  const [density, setDensity] = useState('comfortable');
  return [density, setDensity];
};

// Body regions map
const bodyRegions = {
  head: { x: 50, y: 10, label: 'Head/Neck', icon: '🧠' },
  chest: { x: 50, y: 30, label: 'Chest', icon: '🫁' },
  abdomen: { x: 50, y: 50, label: 'Abdomen', icon: '🫃' },
  pelvis: { x: 50, y: 65, label: 'Pelvis', icon: '🦴' },
  upperExtremity: { x: 25, y: 40, label: 'Upper Extremity', icon: '💪' },
  lowerExtremity: { x: 35, y: 80, label: 'Lower Extremity', icon: '🦵' },
  spine: { x: 50, y: 40, label: 'Spine', icon: '🦴' }
};

// Get body region from study
const getBodyRegion = (study) => {
  const bodySite = study.bodySite?.[0]?.display?.toLowerCase() || '';
  const description = (study.description || '').toLowerCase();
  
  if (bodySite.includes('head') || bodySite.includes('brain') || description.includes('head') || description.includes('brain')) {
    return 'head';
  } else if (bodySite.includes('chest') || bodySite.includes('thorax') || description.includes('chest')) {
    return 'chest';
  } else if (bodySite.includes('abdomen') || description.includes('abdomen')) {
    return 'abdomen';
  } else if (bodySite.includes('pelvis') || description.includes('pelvis')) {
    return 'pelvis';
  } else if (bodySite.includes('spine') || description.includes('spine')) {
    return 'spine';
  } else if (bodySite.includes('arm') || bodySite.includes('shoulder') || bodySite.includes('hand')) {
    return 'upperExtremity';
  } else if (bodySite.includes('leg') || bodySite.includes('knee') || bodySite.includes('foot')) {
    return 'lowerExtremity';
  }
  return null;
};

// Get modality icon
const getModalityIcon = (modality) => {
  switch (modality?.toUpperCase()) {
    case 'CT':
      return CTIcon;
    case 'MR':
    case 'MRI':
      return MRIcon;
    case 'CR':
    case 'DX':
    case 'XR':
      return XRayIcon;
    case 'US':
      return UltrasoundIcon;
    default:
      return ImagingIcon;
  }
};

// Get modality color
const getModalityColor = (modality) => {
  switch (modality?.toUpperCase()) {
    case 'CT':
      return 'primary';
    case 'MR':
    case 'MRI':
      return 'secondary';
    case 'CR':
    case 'DX':
    case 'XR':
      return 'info';
    case 'US':
      return 'success';
    default:
      return 'default';
  }
};

// Get study status color
const getStudyStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'available':
      return 'success';
    case 'pending':
      return 'warning';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

// Body Map Component
const BodyMap = React.memo(({ studies, selectedRegion, onRegionSelect }) => {
  const theme = useTheme();
  
  // Count studies by region
  const studiesByRegion = useMemo(() => {
    const regionMap = {};
    studies.forEach(study => {
      const region = getBodyRegion(study);
      if (region) {
        regionMap[region] = (regionMap[region] || 0) + 1;
      }
    });
    return regionMap;
  }, [studies]);
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: 400,
        position: 'relative',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
        border: 1,
        borderColor: 'divider',
        borderRadius: 0,
        overflow: 'hidden'
      }}
    >
      <Typography variant="h6" gutterBottom>
        Body Map View
      </Typography>
      
      {/* SVG Human Body Outline */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 'calc(100% - 40px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg viewBox="0 0 100 100" style={{ width: '60%', height: '100%' }}>
          {/* Simple human body outline */}
          <path
            d="M50,5 C54,5 57,8 57,12 C57,16 54,19 50,19 C46,19 43,16 43,12 C43,8 46,5 50,5 Z M45,20 L55,20 L55,35 L60,25 L62,27 L57,38 L57,50 L60,80 L55,80 L52,55 L48,55 L45,80 L40,80 L43,50 L43,38 L38,27 L40,25 L45,35 Z"
            fill={alpha(theme.palette.text.primary, 0.1)}
            stroke={theme.palette.divider}
            strokeWidth="0.5"
          />
        </svg>
        
        {/* Region hotspots */}
        {Object.entries(bodyRegions).map(([region, config]) => {
          const count = studiesByRegion[region] || 0;
          const isSelected = selectedRegion === region;
          
          return (
            <Tooltip key={region} title={`${config.label}: ${count} studies`}>
              <Box
                onClick={() => onRegionSelect(region)}
                sx={{
                  position: 'absolute',
                  left: `${config.x}%`,
                  top: `${config.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: count > 0 
                    ? alpha(theme.palette.primary.main, isSelected ? 0.8 : 0.6)
                    : alpha(theme.palette.action.disabled, 0.3),
                  border: 2,
                  borderColor: isSelected ? theme.palette.primary.main : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: count > 0 ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  fontSize: '1.2rem',
                  '&:hover': count > 0 ? {
                    transform: 'translate(-50%, -50%) scale(1.2)'
                  } : {},
                  '&:active': count > 0 ? {
                    transform: 'translate(-50%, -50%) scale(0.9)'
                  } : {}
                }}
              >
                {count > 0 ? (
                  <Badge badgeContent={count} color="primary" max={99}>
                    <span>{config.icon}</span>
                  </Badge>
                ) : (
                  <span style={{ opacity: 0.5 }}>{config.icon}</span>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Paper>
  );
});

// Enhanced Imaging Study Card Component
const ImagingStudyCard = React.memo(({ study, onView, onAction, density = 'comfortable', viewMode = 'card', isAlternate = false }) => {
  const theme = useTheme();

  const getStudyDescription = () => {
    return study.description || study.procedureCode?.[0]?.coding?.[0]?.display || 'Imaging Study';
  };

  const getBodySite = () => {
    const bodySite = study.bodySite?.[0];
    return bodySite?.display || bodySite?.coding?.[0]?.display || '';
  };

  const getModality = () => {
    const modality = study.modality?.[0];
    return modality?.display || modality?.code || 'Unknown';
  };

  const studyDate = study.started || study.performedDateTime;
  
  // Determine severity based on study urgency/status
  const severity = study.status === 'cancelled' ? 'high' : 
                   study.priority === 'urgent' ? 'critical' : 'normal';
  
  const details = [
    { 
      label: 'Modality', 
      value: getModality() 
    },
    { 
      label: 'Body Site', 
      value: getBodySite() || 'Not specified' 
    },
    { 
      label: 'Series', 
      value: `${study.numberOfSeries || 0} series` 
    },
    { 
      label: 'Images', 
      value: `${study.numberOfInstances || 0} images` 
    },
    { 
      label: 'Date', 
      value: studyDate ? format(parseISO(studyDate), 'MMM d, yyyy') : 'Unknown' 
    }
  ];
  
  const actions = [
    {
      label: 'View Study',
      onClick: () => onView(study),
      primary: true
    },
    {
      label: 'Report',
      onClick: () => onAction(study, 'report')
    },
    {
      label: 'Download',
      onClick: () => onAction(study, 'download')
    }
  ];
  
  // Gallery view mode
  if (viewMode === 'gallery') {
    return (
      <Card
        sx={{
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          borderRadius: 0,
          '&:hover': {
            boxShadow: theme.shadows[4],
            transform: 'scale(1.02)'
          },
          '&:active': {
            transform: 'scale(0.98)'
          }
        }}
        onClick={() => onView(study)}
      >
        <CardMedia
          sx={{
            height: 140,
            backgroundColor: alpha(
              getModalityColor(getModality()) === 'default' 
                ? theme.palette.action.selected 
                : theme.palette[getModalityColor(getModality())].main, 
              0.1
            ),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <Box sx={{ fontSize: 48, opacity: 0.3 }}>
            {React.createElement(getModalityIcon(getModality()), { sx: { fontSize: 'inherit' } })}
          </Box>
          <Chip
            label={getModality()}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              borderRadius: 1
            }}
            color={getModalityColor(getModality())}
          />
        </CardMedia>
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" noWrap gutterBottom>
            {getStudyDescription()}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {studyDate && format(parseISO(studyDate), 'MMM d, yyyy')}
          </Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Chip 
              label={`${study.numberOfSeries || 0} series`} 
              size="small" 
              variant="outlined"
              sx={{ borderRadius: 1 }}
            />
            <Chip 
              label={`${study.numberOfInstances || 0} images`} 
              size="small" 
              variant="outlined"
              sx={{ borderRadius: 1 }}
            />
          </Stack>
        </CardContent>
      </Card>
    );
  }
  
  // Standard card view using ClinicalResourceCard
  return (
    <ClinicalResourceCard
      title={getStudyDescription()}
      severity={severity}
      status={study.status || 'available'}
      statusColor={getStudyStatusColor(study.status)}
      icon={React.createElement(getModalityIcon(getModality()), { sx: { fontSize: 24 } })}
      details={details}
      onEdit={() => onView(study)}
      actions={actions}
      isAlternate={isAlternate}
    />
  );
});

ImagingStudyCard.displayName = 'ImagingStudyCard';

// DICOM Viewer Dialog with functional viewer
const DICOMViewerDialog = ({ open, onClose, study, onDownload }) => {
  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open || !study) return null;
  
  // Render directly without Dialog wrapper for better full-screen experience
  return (
    <DICOMViewer study={study} onClose={onClose} />
  );
};

const ImagingTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const theme = useTheme();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish, subscribe } = useClinicalWorkflow();
  const [density, setDensity] = useDensity();
  
  const [viewMode, setViewMode] = useState('timeline'); // timeline, gallery, cards, bodymap
  const [filterModality, setFilterModality] = useState('all');
  const [filterBodyRegion, setFilterBodyRegion] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [viewerDialog, setViewerDialog] = useState({ open: false, study: null });
  const [reportDialog, setReportDialog] = useState({ open: false, study: null });
  const [downloadDialog, setDownloadDialog] = useState({ open: false, study: null });
  const [shareDialog, setShareDialog] = useState({ open: false, study: null });
  const [studies, setStudies] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load imaging studies function with useCallback
  const loadImagingStudies = useCallback(async () => {
    if (!patientId) return;
    
    setLoading(true);
    try {
      // Try to get imaging studies from FHIR resources first
      const fhirStudies = getPatientResources(patientId, 'ImagingStudy') || [];
      
      // If no FHIR studies, try the API endpoint
      if (fhirStudies.length === 0) {
        try {
          const response = await axios.get(`/api/imaging/studies/${patientId}`);
          const apiStudies = response.data?.data || [];
          setStudies(apiStudies);
        } catch (error) {
          // Failed to load from API - fall back to FHIR data (empty in this case)
          setStudies([]);
        }
      } else {
        setStudies(fhirStudies);
      }
    } catch (error) {
      // Handle error - imaging studies failed to load
      setSnackbar({
        open: true,
        message: 'Failed to load imaging studies',
        severity: 'error'
      });
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, getPatientResources]);

  // Load imaging studies when patient changes (removed separate useEffect to avoid circular dependency)
  useEffect(() => {
    if (patientId) {
      loadImagingStudies();
    }
  }, [patientId, loadImagingStudies]); // Added loadImagingStudies to dependencies

  // Subscribe to imaging-related events
  useEffect(() => {
    const unsubscribers = [];

    // Subscribe to order placed events for imaging orders
    unsubscribers.push(
      subscribe(CLINICAL_EVENTS.ORDER_PLACED, (data) => {
        if (data.type === 'imaging' && data.patientId === patientId) {
          // Refresh imaging studies when a new imaging order is placed
          loadImagingStudies();
          
          setSnackbar({
            open: true,
            message: 'New imaging order placed',
            severity: 'info'
          });
        }
      })
    );

    // Subscribe to result received events for imaging results
    unsubscribers.push(
      subscribe(CLINICAL_EVENTS.RESULT_RECEIVED, (data) => {
        if (data.type === 'imaging' && data.patientId === patientId) {
          // Refresh imaging studies when results are available
          loadImagingStudies();
          
          setSnackbar({
            open: true,
            message: 'New imaging results available',
            severity: 'success'
          });
        }
      })
    );

    // Cleanup subscriptions
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [patientId, subscribe, loadImagingStudies]); // Added loadImagingStudies to dependencies

  // Filter studies - memoized for performance
  const filteredStudies = useMemo(() => {
    return studies.filter(study => {
    // Body region filter
    if (filterBodyRegion) {
      const studyRegion = getBodyRegion(study);
      if (studyRegion !== filterBodyRegion) {
        return false;
      }
    }
    
    // Modality filter
    if (filterModality !== 'all') {
      const modality = study.modality?.[0]?.code || study.modality;
      if (modality?.toLowerCase() !== filterModality.toLowerCase()) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== 'all' && study.status !== filterStatus) {
      return false;
    }

    // Period filter
    if (filterPeriod !== 'all') {
      const studyDate = study.started || study.performedDateTime;
      if (studyDate) {
        const date = parseISO(studyDate);
        const periodMap = {
          '7d': subDays(new Date(), 7),
          '30d': subDays(new Date(), 30),
          '3m': subMonths(new Date(), 3),
          '6m': subMonths(new Date(), 6),
          '1y': subMonths(new Date(), 12)
        };
        if (!isWithinInterval(date, {
          start: periodMap[filterPeriod],
          end: new Date()
        })) {
          return false;
        }
      }
    }

    // Search filter
    if (searchTerm) {
      const searchableText = [
        study.description,
        study.procedureCode?.[0]?.coding?.[0]?.display,
        study.bodySite?.[0]?.display,
        study.modality?.[0]?.display || study.modality?.[0]?.code
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    return true;
    });
  }, [studies, filterModality, filterBodyRegion, filterStatus, filterPeriod, searchTerm]);

  // Group studies by modality - memoized for performance
  const studiesByModality = useMemo(() => {
    return filteredStudies.reduce((acc, study) => {
      const modality = study.modality?.[0]?.code || study.modality || 'Unknown';
      if (!acc[modality]) acc[modality] = [];
      acc[modality].push(study);
      return acc;
    }, {});
  }, [filteredStudies]);

  const handleViewStudy = async (study) => {
    setViewerDialog({ open: true, study });
    
    // Publish imaging study viewed event
    await publish(CLINICAL_EVENTS.IMAGING_STUDY_VIEWED, {
      studyId: study.id,
      patientId,
      modality: study.modality?.code || 'Unknown',
      studyDate: study.started,
      description: study.description,
      timestamp: new Date().toISOString()
    });
  };

  const handlePrintStudy = (study) => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    let content = '<h2>Imaging Study Report</h2>';
    
    // Study details
    content += '<div class="section">';
    content += `<h3>${study.description || 'Imaging Study'}</h3>`;
    content += '<table>';
    content += `<tr><td><strong>Study Date:</strong></td><td>${study.started ? format(parseISO(study.started), 'MMMM d, yyyy HH:mm') : 'Unknown'}</td></tr>`;
    content += `<tr><td><strong>Modality:</strong></td><td>${study.modality?.[0]?.code || 'Unknown'}</td></tr>`;
    content += `<tr><td><strong>Body Part:</strong></td><td>${study.bodySite?.[0]?.display || 'Not specified'}</td></tr>`;
    content += `<tr><td><strong>Accession Number:</strong></td><td>${study.identifier?.[0]?.value || 'Not available'}</td></tr>`;
    content += `<tr><td><strong>Number of Series:</strong></td><td>${study.numberOfSeries || 0}</td></tr>`;
    content += `<tr><td><strong>Number of Images:</strong></td><td>${study.numberOfInstances || 0}</td></tr>`;
    content += '</table>';
    content += '</div>';
    
    // Series information
    if (study.series && study.series.length > 0) {
      content += '<h3>Series Information</h3>';
      content += '<table>';
      content += '<thead><tr><th>Series</th><th>Description</th><th>Images</th><th>Body Part</th></tr></thead>';
      content += '<tbody>';
      study.series.forEach((series, index) => {
        content += '<tr>';
        content += `<td>${index + 1}</td>`;
        content += `<td>${series.description || 'No description'}</td>`;
        content += `<td>${series.numberOfInstances || 0}</td>`;
        content += `<td>${series.bodySite?.display || '-'}</td>`;
        content += '</tr>';
      });
      content += '</tbody></table>';
    }
    
    // Notes section
    content += '<div class="section" style="margin-top: 30px;">';
    content += '<h3>Clinical Notes</h3>';
    content += '<div style="border: 1px solid #ddd; padding: 20px; min-height: 200px;">';
    content += '<p style="color: #666;">Space for clinical interpretation and notes</p>';
    content += '</div>';
    content += '</div>';
    
    printDocument({
      title: 'Imaging Study Report',
      patient: patientInfo,
      content
    });
  };

  const handlePrintAll = () => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    let content = '<h2>Imaging Studies Summary</h2>';
    
    // Group by modality
    Object.entries(studiesByModality).forEach(([modality, modalityStudies]) => {
      content += `<h3>${modality} Studies (${modalityStudies.length})</h3>`;
      content += '<table class="avoid-break">';
      content += '<thead><tr><th>Date</th><th>Description</th><th>Body Part</th><th>Series</th><th>Images</th></tr></thead>';
      content += '<tbody>';
      
      modalityStudies.forEach(study => {
        content += '<tr>';
        content += `<td>${study.started ? format(parseISO(study.started), 'MMM d, yyyy') : 'Unknown'}</td>`;
        content += `<td>${study.description || 'No description'}</td>`;
        content += `<td>${study.bodySite?.[0]?.display || '-'}</td>`;
        content += `<td>${study.numberOfSeries || 0}</td>`;
        content += `<td>${study.numberOfInstances || 0}</td>`;
        content += '</tr>';
      });
      
      content += '</tbody></table>';
    });
    
    printDocument({
      title: 'Imaging Studies Summary',
      patient: patientInfo,
      content
    });
  };

  const handleStudyAction = (study, action) => {
    switch (action) {
      case 'view':
        handleViewStudy(study);
        break;
      case 'report':
        setReportDialog({ open: true, study });
        break;
      case 'download':
        setDownloadDialog({ open: true, study });
        break;
      case 'share':
        setShareDialog({ open: true, study });
        break;
      case 'print':
        handlePrintStudy(study);
        break;
      default:
        break;
    }
  };

  // Extract unique modalities - memoized for performance
  const modalities = useMemo(() => {
    return [...new Set(studies.map(s => s.modality?.[0]?.code || s.modality).filter(Boolean))];
  }, [studies]);
  
  // Prepare timeline resources
  const timelineResources = useMemo(() => {
    return studies.map(study => ({
      ...study,
      resourceType: 'ImagingStudy',
      meta: {
        lastUpdated: study.started || study.performedDateTime
      }
    }));
  }, [studies]);
  
  // Calculate metrics for summary cards
  const metrics = useMemo(() => {
    const totalImages = studies.reduce((sum, study) => sum + (study.numberOfInstances || 0), 0);
    const recentStudies = studies.filter(study => {
      const studyDate = study.started || study.performedDateTime;
      if (!studyDate) return false;
      const daysSince = Math.floor((new Date() - parseISO(studyDate)) / (1000 * 60 * 60 * 24));
      return daysSince <= 30;
    }).length;
    
    return {
      totalStudies: studies.length,
      totalImages,
      recentStudies,
      modalityCounts: modalities.reduce((acc, modality) => {
        acc[modality] = studiesByModality[modality]?.length || 0;
        return acc;
      }, {})
    };
  }, [studies, modalities, studiesByModality]);

  const handleStudyDownload = async (study) => {
    try {
      // Extract study directory
      const studyDir = extractStudyDirectory(study);
      if (!studyDir) {
        // Unable to determine study directory
        setSnackbar({
          open: true,
          message: 'Unable to download study - missing directory information',
          severity: 'error'
        });
        return;
      }

      // Download study as ZIP
      const response = await axios.get(`/api/dicom/studies/${studyDir}/download`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${study.description || 'study'}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      // Handle download error
      setSnackbar({
        open: true,
        message: 'Failed to download study: ' + error.message,
        severity: 'error'
      });
    }
  };

  const extractStudyDirectory = (studyObj) => {
    // Same logic as in DICOMViewer
    if (studyObj.studyDirectory) {
      return studyObj.studyDirectory;
    }
    
    // Check for DICOM directory in extensions
    if (studyObj.extension) {
      const dicomDirExt = studyObj.extension.find(
        ext => ext.url === 'http://example.org/fhir/StructureDefinition/dicom-directory'
      );
      if (dicomDirExt && dicomDirExt.valueString) {
        return dicomDirExt.valueString;
      }
    }
    
    // Try to derive from study ID
    if (studyObj.id) {
      // Determine study type from modality or description
      let studyType = 'CT_CHEST'; // Default
      
      if (studyObj.modality && studyObj.modality.length > 0) {
        const modalityCode = studyObj.modality[0].code;
        if (modalityCode === 'CT') {
          studyType = studyObj.description?.toLowerCase().includes('head') ? 'CT_HEAD' : 'CT_CHEST';
        } else if (modalityCode === 'MR') {
          studyType = 'MR_BRAIN';
        } else if (modalityCode === 'US') {
          studyType = 'US_ABDOMEN';
        } else if (modalityCode === 'CR' || modalityCode === 'DX') {
          studyType = 'XR_CHEST';
        }
      }
      
      // Generate directory name based on our convention
      return `${studyType}_${studyObj.id.replace(/-/g, '')}`;
    }
    
    // Should not reach here
    // Unable to determine study directory - return null
    return null;
  };
  
  // Data grid columns configuration
  const tableColumns = [
    {
      field: 'modality',
      headerName: 'Type',
      width: 100,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={1} alignItems="center">
          {getModalityIcon(row.modality?.[0]?.code || row.modality)}
          <Typography variant="caption">
            {row.modality?.[0]?.code || row.modality || 'Unknown'}
          </Typography>
        </Stack>
      )
    },
    {
      field: 'description',
      headerName: 'Study Description',
      flex: 1,
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2">
            {row.description || 'Imaging Study'}
          </Typography>
          {row.bodySite?.[0]?.display && (
            <Typography variant="caption" color="text.secondary">
              {row.bodySite[0].display}
            </Typography>
          )}
        </Box>
      )
    },
    {
      field: 'started',
      headerName: 'Date',
      width: 150,
      renderCell: ({ row }) => {
        const date = row.started || row.performedDateTime;
        if (!date) return '-';
        return (
          <Box>
            <Typography variant="body2">
              {format(parseISO(date), 'MMM d, yyyy')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(parseISO(date), { addSuffix: true })}
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'numberOfSeries',
      headerName: 'Series',
      width: 100,
      renderCell: ({ value }) => (
        <Chip
          label={value || 0}
          size="small"
          variant="outlined"
          icon={<SeriesIcon />}
          sx={{ borderRadius: 1 }}
        />
      )
    },
    {
      field: 'numberOfInstances',
      headerName: 'Images',
      width: 100,
      renderCell: ({ value }) => (
        <Chip
          label={value || 0}
          size="small"
          variant="outlined"
          icon={<InstanceIcon />}
          sx={{ borderRadius: 1 }}
        />
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: ({ value }) => (
        <Chip
          label={value || 'available'}
          size="small"
          color={getStudyStatusColor(value)}
          sx={{ borderRadius: 1 }}
        />
      )
    }
  ];

  if (loading) {
    return <ClinicalLoadingState.ResourceCard count={6} />;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }} ref={scrollContainerRef}>
      {/* Header with Summary Cards */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Medical Imaging
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredStudies.length} studies found
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<ViewIcon />}
              onClick={loadImagingStudies}
              sx={{ borderRadius: 0 }}
            >
              Refresh
            </Button>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<PrintIcon />}
              onClick={handlePrintAll}
              sx={{ borderRadius: 0 }}
            >
              Print All
            </Button>
          </Stack>
        </Stack>
        
        {/* Summary Cards */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} md={3}>
            <ClinicalSummaryCard
              title="Total Studies"
              value={metrics.totalStudies}
              severity="normal"
              icon={<CollectionsIcon />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ClinicalSummaryCard
              title="Total Images"
              value={metrics.totalImages}
              severity="normal"
              icon={<ImagingIcon />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ClinicalSummaryCard
              title="Recent (30d)"
              value={metrics.recentStudies}
              severity={metrics.recentStudies > 0 ? 'normal' : 'low'}
              icon={<RecentIcon />}
              trend={metrics.recentStudies > 0 ? { direction: 'up', value: `+${metrics.recentStudies}` } : undefined}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ClinicalSummaryCard
              title="Modalities"
              value={modalities.length}
              severity="normal"
              icon={<ModalityIcon />}
              chips={modalities.slice(0, 2).map(mod => ({ 
                label: `${mod}: ${metrics.modalityCounts[mod]}`,
                color: getModalityColor(mod)
              }))}
            />
          </Grid>
        </Grid>

        {/* Filter Panel - only show when not in bodymap view */}
        {viewMode !== 'bodymap' && (
          <ClinicalFilterPanel
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onRefresh={loadImagingStudies}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Box>

      {/* Additional Filters */}
      {viewMode !== 'bodymap' && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Modality</InputLabel>
              <Select
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value)}
                label="Modality"
                sx={{ borderRadius: 0 }}
              >
                <MenuItem value="all">All Modalities</MenuItem>
                {modalities.map(modality => (
                  <MenuItem key={modality} value={modality}>{modality}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {filterBodyRegion && (
              <Chip
                label={`Body Region: ${bodyRegions[filterBodyRegion]?.label}`}
                onDelete={() => setFilterBodyRegion(null)}
                color="primary"
                icon={<span>{bodyRegions[filterBodyRegion]?.icon}</span>}
                sx={{ borderRadius: 1 }}
              />
            )}

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
                sx={{ borderRadius: 0 }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ flexGrow: 1 }} />
            
            <ToggleButtonGroup
              value={density}
              exclusive
              onChange={(e, newDensity) => newDensity && setDensity(newDensity)}
              size="small"
            >
              <ToggleButton value="compact" sx={{ borderRadius: 0 }}>
                Compact
              </ToggleButton>
              <ToggleButton value="comfortable" sx={{ borderRadius: 0 }}>
                Comfortable
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Box>
      )}

      {/* Content Views */}
      <Box sx={{ flex: 1, overflow: 'auto', p: density === 'compact' ? 2 : 3 }}>
        {viewMode === 'timeline' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Timeline View
            </Typography>
            <Stack spacing={2}>
              {filteredStudies
                .sort((a, b) => new Date(b.started || b.performedDateTime || 0) - new Date(a.started || a.performedDateTime || 0))
                .map((study, index) => (
                  <ImagingStudyCard
                    key={study.id}
                    study={study}
                    onView={handleViewStudy}
                    onAction={handleStudyAction}
                    density={density}
                    viewMode="card"
                    isAlternate={index % 2 === 1}
                  />
                ))}
            </Stack>
          </Box>
        )}
        
        {viewMode === 'gallery' && (
          <Box>
            <ImageList
              sx={{ width: '100%', height: 'auto' }}
              cols={density === 'compact' ? 4 : density === 'comfortable' ? 3 : 2}
              gap={density === 'compact' ? 8 : 16}
            >
              {filteredStudies.map((study) => (
                <ImageListItem key={study.id}>
                  <ImagingStudyCard
                    study={study}
                    onView={handleViewStudy}
                    onAction={handleStudyAction}
                    density={density}
                    viewMode="gallery"
                  />
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        )}
        
        {viewMode === 'cards' && (
          <Stack spacing={2}>
            {filteredStudies
              .sort((a, b) => new Date(b.started || b.performedDateTime || 0) - new Date(a.started || a.performedDateTime || 0))
              .map((study, index) => (
                <ImagingStudyCard
                  key={study.id}
                  study={study}
                  onView={handleViewStudy}
                  onAction={handleStudyAction}
                  density={density}
                  viewMode="card"
                  isAlternate={index % 2 === 1}
                />
              ))}
          </Stack>
        )}
        
        {viewMode === 'table' && (
          <ClinicalDataGrid
            columns={tableColumns}
            rows={filteredStudies.map(study => ({ ...study, id: study.id }))}
            onRowClick={({ row }) => handleViewStudy(row)}
            density={density === 'compact' ? 'compact' : 'standard'}
          />
        )}
        
        {viewMode === 'bodymap' && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <BodyMap
                  studies={studies}
                  selectedRegion={filterBodyRegion}
                  onRegionSelect={(region) => {
                    setFilterBodyRegion(region === filterBodyRegion ? null : region);
                    setViewMode('cards'); // Switch to cards view to show filtered results
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    height: 400,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 0,
                    overflow: 'auto'
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Studies by Body Region
                  </Typography>
                  <Stack spacing={1}>
                    {Object.entries(bodyRegions).map(([region, config]) => {
                      const regionStudies = studies.filter(s => getBodyRegion(s) === region);
                      if (regionStudies.length === 0) return null;
                      
                      return (
                        <Box
                          key={region}
                          onClick={() => {
                            setFilterBodyRegion(region);
                            setViewMode('cards');
                          }}
                          sx={{
                            p: 1.5,
                            borderRadius: 0,
                            border: 1,
                            borderColor: filterBodyRegion === region ? 'primary.main' : 'divider',
                            backgroundColor: filterBodyRegion === region ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.04),
                              transform: 'translateX(4px)'
                            }
                          }}
                        >
                          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="h6">{config.icon}</Typography>
                              <Typography variant="subtitle1">{config.label}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1}>
                              {[...new Set(regionStudies.map(s => s.modality?.[0]?.code || s.modality))]
                                .filter(Boolean)
                                .map(modality => (
                                  <Chip
                                    key={modality}
                                    label={`${regionStudies.filter(s => (s.modality?.[0]?.code || s.modality) === modality).length} ${modality}`}
                                    size="small"
                                    color={getModalityColor(modality)}
                                    variant="outlined"
                                    sx={{ borderRadius: 1 }}
                                  />
                                ))
                              }
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
      
      {/* Empty State */}
      {filteredStudies.length === 0 && viewMode !== 'bodymap' && (
        <Box sx={{ p: 3 }}>
          <ClinicalEmptyState
            title={studies.length === 0 ? "No imaging studies found" : "No matching studies"}
            message={
              studies.length === 0 
                ? "This patient has no imaging studies yet. Studies will appear when imaging orders are completed."
                : "No studies match the current filter criteria."
            }
            actions={
              studies.length > 0 
                ? [
                    { 
                      label: 'Clear Filters', 
                      onClick: () => {
                        setSearchTerm('');
                        setFilterModality('all');
                        setFilterStatus('all');
                        setFilterPeriod('all');
                        setFilterBodyRegion(null);
                      }
                    }
                  ]
                : [
                    {
                      label: 'Order Imaging',
                      onClick: () => publish(CLINICAL_EVENTS.ORDER_REQUESTED, { type: 'imaging', patientId })
                    }
                  ]
            }
          />
        </Box>
      )}

      {/* DICOM Viewer Dialog */}
      <DICOMViewerDialog
        open={viewerDialog.open}
        onClose={() => setViewerDialog({ open: false, study: null })}
        study={viewerDialog.study}
        onDownload={handleStudyDownload}
      />

      {/* Imaging Report Dialog */}
      <ImagingReportDialog
        open={reportDialog.open}
        onClose={() => setReportDialog({ open: false, study: null })}
        study={reportDialog.study}
        patientId={patientId}
      />

      {/* Download Dialog */}
      <DownloadDialog
        open={downloadDialog.open}
        onClose={() => setDownloadDialog({ open: false, study: null })}
        study={downloadDialog.study}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialog.open}
        onClose={() => setShareDialog({ open: false, study: null })}
        study={shareDialog.study}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 0 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(ImagingTab);