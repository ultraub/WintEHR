/**
 * Imaging Tab Component
 * Display and manage medical imaging studies with DICOM viewer integration
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
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import axios from 'axios';
import DICOMViewer from '../../imaging/DICOMViewer';

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
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            DICOM Viewer - {study?.description || 'Imaging Study'}
          </Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ p: 1 }}>
        <Box sx={{ height: '100%' }}>
          <DICOMViewer study={study} onClose={onClose} />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button 
          variant="contained" 
          startIcon={<DownloadIcon />}
          onClick={() => onDownload(study)}
        >
          Download Study
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ImagingTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterModality, setFilterModality] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewerDialog, setViewerDialog] = useState({ open: false, study: null });
  const [studies, setStudies] = useState([]);

  // Load imaging studies
  useEffect(() => {
    loadImagingStudies();
  }, [patientId]);

  const loadImagingStudies = async () => {
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
          console.warn('Failed to load from API, using FHIR data:', error);
          setStudies(fhirStudies);
        }
      } else {
        setStudies(fhirStudies);
      }
    } catch (error) {
      console.error('Failed to load imaging studies:', error);
      setStudies([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleViewStudy = (study) => {
    setViewerDialog({ open: true, study });
  };

  const handleStudyAction = (study, action) => {
    switch (action) {
      case 'view':
        handleViewStudy(study);
        break;
      case 'report':
        console.log('View report for study:', study.id);
        // TODO: Implement report viewing
        break;
      case 'download':
        console.log('Download study:', study.id);
        // TODO: Implement DICOM download
        break;
      case 'share':
        console.log('Share study:', study.id);
        // TODO: Implement study sharing
        break;
      case 'print':
        window.print();
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
        console.error('Unable to determine study directory for download');
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
      console.error('Failed to download study:', error);
    }
  };

  const extractStudyDirectory = (studyObj) => {
    // Same logic as in DICOMViewer
    if (studyObj.studyDirectory) {
      return studyObj.studyDirectory;
    }
    
    if (studyObj.id) {
      const studyTypes = ['CT_CHEST', 'CT_HEAD', 'XR_CHEST', 'US_ABDOMEN', 'MR_BRAIN'];
      for (const type of studyTypes) {
        if (studyObj.description?.toLowerCase().includes(type.toLowerCase().replace('_', ' '))) {
          return `${type}_${studyObj.id.replace(/-/g, '')}`;
        }
      }
    }
    
    return 'CT_CHEST_29704851426587647796832262840077538772';
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
    </Box>
  );
};

export default ImagingTab;