/**
 * Imaging Tab Component
 * Display and manage medical imaging studies with DICOM viewer integration
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Button,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  useTheme,
  alpha
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
  Brightness6 as WindowIcon,
  GridView as SeriesIcon,
  PhotoLibrary as InstanceIcon,
  Warning as WarningIcon,
  CheckCircle as CompleteIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import axios from 'axios';
import DICOMViewer from '../../imaging/DICOMViewer';
import ImagingReportDialog from '../../imaging/ImagingReportDialog';
import DownloadDialog from '../../imaging/DownloadDialog';
import ShareDialog from '../../imaging/ShareDialog';
import { printDocument } from '../../../../utils/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

// Get modality icon
const getModalityIcon = (modality) => {
  switch (modality?.toUpperCase()) {
    case 'CT':
      return <CTIcon color="primary" />;
    case 'MR':
    case 'MRI':
      return <MRIcon color="secondary" />;
    case 'CR':
    case 'DX':
    case 'XR':
      return <XRayIcon color="info" />;
    case 'US':
      return <UltrasoundIcon color="success" />;
    default:
      return <ImagingIcon color="action" />;
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
const getStatusColor = (status) => {
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

// Imaging Study Card Component
const ImagingStudyCard = ({ study, onView, onAction }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  
  const handleMenuClose = () => setAnchorEl(null);

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

  return (
    <Card sx={{ mb: 2, '&:hover': { elevation: 3 } }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              {getModalityIcon(getModality())}
              <Typography variant="h6">
                {getStudyDescription()}
              </Typography>
              <Chip 
                label={getModality()} 
                size="small" 
                color={getModalityColor(getModality())}
              />
              <Chip 
                label={study.status || 'available'} 
                size="small" 
                color={getStatusColor(study.status)}
              />
            </Stack>

            {getBodySite() && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Body Part: {getBodySite()}
              </Typography>
            )}

            <Stack direction="row" spacing={3} alignItems="center" mt={1}>
              {studyDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {format(parseISO(studyDate), 'MMM d, yyyy HH:mm')}
                  </Typography>
                </Stack>
              )}
              
              <Stack direction="row" spacing={0.5} alignItems="center">
                <SeriesIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {study.numberOfSeries || 0} series
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} alignItems="center">
                <InstanceIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {study.numberOfInstances || 0} images
                </Typography>
              </Stack>

              {study.identifier?.[0]?.value && (
                <Typography variant="caption" color="text.secondary">
                  Accession: {study.identifier[0].value}
                </Typography>
              )}
            </Stack>
          </Box>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ModalityIcon />
          </IconButton>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          startIcon={<ViewIcon />}
          onClick={() => onView(study)}
        >
          View Images
        </Button>
        <Button 
          size="small" 
          startIcon={<ReportIcon />}
          onClick={() => onAction(study, 'report')}
        >
          Report
        </Button>
        <Button 
          size="small" 
          startIcon={<DownloadIcon />}
          onClick={() => onAction(study, 'download')}
        >
          Download
        </Button>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); onAction(study, 'view'); }}>
          <ViewIcon sx={{ mr: 1 }} />
          View Study
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); onAction(study, 'report'); }}>
          <ReportIcon sx={{ mr: 1 }} />
          View Report
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); onAction(study, 'share'); }}>
          <ShareIcon sx={{ mr: 1 }} />
          Share Study
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); onAction(study, 'print'); }}>
          <PrintIcon sx={{ mr: 1 }} />
          Print Images
        </MenuItem>
      </Menu>
    </Card>
  );
};

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

const ImagingTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish, subscribe } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterModality, setFilterModality] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
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

  // Load imaging studies
  useEffect(() => {
    loadImagingStudies();
  }, [loadImagingStudies]);

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
  }, [patientId, subscribe, loadImagingStudies]);

  // Filter studies
  const filteredStudies = studies.filter(study => {
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

  // Group studies by modality
  const studiesByModality = filteredStudies.reduce((acc, study) => {
    const modality = study.modality?.[0]?.code || study.modality || 'Unknown';
    if (!acc[modality]) acc[modality] = [];
    acc[modality].push(study);
    return acc;
  }, {});

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

  const modalities = [...new Set(studies.map(s => s.modality?.[0]?.code || s.modality).filter(Boolean))];

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Medical Imaging
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintAll}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<ImagingIcon />}
            onClick={loadImagingStudies}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${studies.length} Total Studies`} 
          color="primary" 
          icon={<ImagingIcon />}
        />
        {modalities.map(modality => (
          <Chip 
            key={modality}
            label={`${studiesByModality[modality]?.length || 0} ${modality}`} 
            color={getModalityColor(modality)}
            variant="outlined"
          />
        ))}
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search studies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Modality</InputLabel>
            <Select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              label="Modality"
            >
              <MenuItem value="all">All Modalities</MenuItem>
              {modalities.map(modality => (
                <MenuItem key={modality} value={modality}>{modality}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Studies List */}
      {filteredStudies.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>No imaging studies found</Typography>
          {studies.length === 0 ? (
            <>
              <Typography variant="body2">
                This patient has no imaging studies yet. Imaging studies will appear here when:
              </Typography>
              <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                <li>New imaging orders are completed</li>
                <li>DICOM files are uploaded to the system</li>
                <li>External studies are imported</li>
              </Box>
            </>
          ) : (
            <Typography variant="body2">
              No studies match the current filter criteria. Try adjusting your search or filters.
            </Typography>
          )}
        </Alert>
      ) : (
        <Box>
          {filteredStudies
            .sort((a, b) => new Date(b.started || b.performedDateTime || 0) - new Date(a.started || a.performedDateTime || 0))
            .map((study) => (
              <ImagingStudyCard
                key={study.id}
                study={study}
                onView={handleViewStudy}
                onAction={handleStudyAction}
              />
            ))}
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
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ImagingTab;