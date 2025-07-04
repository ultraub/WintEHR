/**
 * Results Tab Component
 * Lab and imaging results display
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button
} from '@mui/material';
import {
  Science as LabIcon,
  Camera as ImagingIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NormalIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  FileUpload as UploadIcon
} from '@mui/icons-material';
import { useClinical } from '../../../contexts/ClinicalContext';
import { fhirClient } from '../../../services/fhirClient';
import api from '../../../services/api';
// Temporarily use simplified viewer to avoid cornerstone-tools issues
import ImageViewerV2 from '../../ImageViewerV2_Simple';
import RealTimeResultsIndicator from './RealTimeResultsIndicator';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`results-tabpanel-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const ResultsTab = () => {
  const { currentPatient, currentEncounter } = useClinical();
  const [activeTab, setActiveTab] = useState(0);
  const [labResults, setLabResults] = useState([]);
  const [imagingResults, setImagingResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState(null);

  useEffect(() => {
    if (currentPatient) {
      loadResults();
      setHasLoadedInitial(true);
    } else {
      // Reset state when no patient is selected
      setHasLoadedInitial(false);
      setLabResults([]);
      setImagingResults([]);
    }
  }, [currentPatient?.id]); // Use currentPatient.id to ensure it triggers on patient change

  useEffect(() => {
    if (currentPatient && hasLoadedInitial) {
      loadResults();
    }
  }, [currentEncounter?.id]);

  const loadResults = async () => {
    setLoading(true);
    try {
      // Load lab results using FHIR
      const labResult = await fhirClient.getLabResults(currentPatient.id);
      
      // Transform FHIR observations to expected format
      let results = (labResult.resources || []).map(obs => ({
        id: obs.id,
        patient_id: currentPatient.id,
        observation_date: obs.effectiveDateTime || obs.issued,
        display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
        value: obs.valueQuantity?.value || obs.valueString || '',
        unit: obs.valueQuantity?.unit || '',
        status: obs.status,
        encounter_id: obs.encounter ? fhirClient.extractId(obs.encounter) : null,
        interpretation: obs.interpretation?.[0]?.coding?.[0]?.code,
        reference_range: obs.referenceRange?.[0]?.text
      }));
      
      // Load imaging studies (don't filter by encounter for imaging)
      try {
        const imagingResponse = await api.get(`/api/imaging/studies/${currentPatient.id}`);
        const imagingData = imagingResponse.data?.data || [];
        setImagingResults(imagingData);
      } catch (imagingError) {
        console.error('Error loading imaging studies:', imagingError);
        setImagingResults([]);
      }
      
      if (currentEncounter && currentEncounter.encounter_date) {
        // Filter to only show results up to and including the encounter date
        const encounterDate = new Date(currentEncounter.encounter_date || currentEncounter.startDate);
        results = results.filter(result => {
          const resultDate = new Date(result.observation_date);
          return resultDate <= encounterDate;
        });
        
        // Sort so results from current encounter appear first
        results.sort((a, b) => {
          const aIsCurrentEncounter = a.encounter_id === currentEncounter.id;
          const bIsCurrentEncounter = b.encounter_id === currentEncounter.id;
          
          if (aIsCurrentEncounter && !bIsCurrentEncounter) return -1;
          if (!aIsCurrentEncounter && bIsCurrentEncounter) return 1;
          
          // Secondary sort by date (most recent first)
          return new Date(b.observation_date) - new Date(a.observation_date);
        });
        
      } else {
        // Just sort by date if no encounter selected (show all results)
        results.sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date));
      }
      
      setLabResults(results);

      // Imaging results are already loaded above, don't clear them
      // setImagingResults([]);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInterpretationIcon = (interpretation) => {
    switch (interpretation?.toLowerCase()) {
      case 'high':
        return <TrendingUpIcon color="error" />;
      case 'low':
        return <TrendingDownIcon color="warning" />;
      case 'normal':
        return <NormalIcon color="success" />;
      default:
        return <NormalIcon />;
    }
  };

  const getInterpretationColor = (interpretation) => {
    switch (interpretation?.toLowerCase()) {
      case 'high':
        return 'error';
      case 'low':
        return 'warning';
      case 'normal':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatValue = (result) => {
    if (result.value_quantity && result.value_unit) {
      return `${result.value_quantity} ${result.value_unit}`;
    }
    return result.value || 'N/A';
  };

  const formatReferenceRange = (result) => {
    if (result.reference_range_low && result.reference_range_high) {
      return `${result.reference_range_low} - ${result.reference_range_high} ${result.value_unit || ''}`;
    }
    return 'N/A';
  };

  const formatDate = (dateString, formatStr = 'MM/dd/yyyy') => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  };

  const handleDicomUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('patient_id', currentPatient.id);
      
      // Add all selected files
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await api.post('/api/imaging/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        // Show what was uploaded
        if (response.data.data?.studies) {
        }
        
        // Force reload of imaging studies
        const imagingResponse = await api.get(`/api/imaging/studies/${currentPatient.id}`);
        const studies = imagingResponse.data?.data || [];
        setImagingResults(studies);
        
        alert(`Successfully uploaded ${files.length} DICOM file(s)`);
        
        // Reset the file input
        event.target.value = '';
        
        // Also reload all results to ensure sync
        setTimeout(() => {
          loadResults();
        }, 500);
      }
    } catch (error) {
      console.error('Error uploading DICOM files:', error);
      alert('Error uploading DICOM files: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">
          Results Review
        </Typography>
        <RealTimeResultsIndicator patientId={currentPatient?.id} />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            icon={<LabIcon />} 
            label="Laboratory" 
            iconPosition="start"
          />
          <Tab 
            icon={<ImagingIcon />} 
            label="Imaging" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {/* Laboratory Results */}
        {currentEncounter ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Showing lab results up to {formatDate(currentEncounter.encounter_date || currentEncounter.startDate, 'MM/dd/yyyy')} ({currentEncounter.encounter_type || 'Visit'})
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            Showing all laboratory results for this patient
          </Alert>
        )}

        <Paper sx={{ overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Loading laboratory results...
              </Typography>
            </Box>
          ) : labResults.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Reference Range</TableCell>
                    <TableCell>Interpretation</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {labResults.map((result, index) => {
                    const isCurrentEncounter = currentEncounter && result.encounter_id === currentEncounter.id;
                    return (
                      <TableRow 
                        key={index} 
                        hover
                        sx={{ 
                          backgroundColor: isCurrentEncounter ? 'action.hover' : 'inherit',
                          borderLeft: isCurrentEncounter ? '4px solid' : 'none',
                          borderLeftColor: isCurrentEncounter ? 'primary.main' : 'transparent'
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2">
                              {result.display}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {result.loinc_code && (
                                <Typography variant="caption" color="text.secondary">
                                  LOINC: {result.loinc_code}
                                </Typography>
                              )}
                              {isCurrentEncounter && (
                                <Chip 
                                  label="Current Visit" 
                                  size="small" 
                                  color="primary" 
                                  sx={{ height: 18, fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getInterpretationIcon(result.interpretation)}
                          <Typography variant="body2">
                            {formatValue(result)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatReferenceRange(result)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={result.interpretation || 'Normal'} 
                          size="small"
                          color={getInterpretationColor(result.interpretation)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(result.observation_date).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Alert severity="info">
                No laboratory results available for this patient.
              </Alert>
            </Box>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* Imaging Results */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Imaging Studies</Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              size="small"
              component="label"
            >
              Upload DICOM
              <input
                type="file"
                hidden
                multiple
                accept=".dcm,.DCM"
                onChange={handleDicomUpload}
              />
            </Button>
          </Box>
          
          {imagingResults.length > 0 ? (
            <List>
              {imagingResults.map((study) => (
                <Card key={study.id} sx={{ mb: 2 }}>
                  <ListItem>
                    <ListItemIcon>
                      <ImagingIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <>
                          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 500 }}>
                            {study.study_description || 'Imaging Study'}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                            {study.modality} • {study.number_of_series} series • {study.number_of_instances} images
                          </span>
                        </>
                      }
                      secondary={
                        <>
                          <span style={{ display: 'block', fontSize: '0.75rem' }}>
                            Study Date: {study.study_date ? new Date(study.study_date).toLocaleDateString() : 'N/A'}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem' }}>
                            Accession: {study.accession_number || 'N/A'}
                          </span>
                          <span style={{ 
                            display: 'inline-block', 
                            marginTop: '4px',
                            padding: '0 8px',
                            borderRadius: '16px',
                            backgroundColor: study.upload_status === 'complete' ? '#4caf50' : '#e0e0e0',
                            color: study.upload_status === 'complete' ? 'white' : 'rgba(0, 0, 0, 0.87)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            lineHeight: '20px'
                          }}>
                            {study.upload_status}
                          </span>
                        </>
                      }
                    />
                    <Box>
                      <Button
                        variant="outlined"
                        startIcon={<ViewIcon />}
                        size="small"
                        onClick={() => {
                          setSelectedStudy(study);
                          setShowImageViewer(true);
                        }}
                        disabled={study.upload_status !== 'complete'}
                      >
                        View Images
                      </Button>
                    </Box>
                  </ListItem>
                </Card>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Alert severity="info">
                No imaging studies available for this patient.
              </Alert>
            </Box>
          )}
        </Paper>
      </TabPanel>

      {/* Image Viewer Dialog */}
      <Dialog
        open={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {selectedStudy?.study_description || 'Image Viewer'}
            </Typography>
            <IconButton onClick={() => setShowImageViewer(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedStudy ? (
            <>
              <ImageViewerV2
                studyId={selectedStudy.id}
                seriesId={selectedStudy.series?.[0]?.series_instance_uid}
                onClose={() => setShowImageViewer(false)}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ResultsTab;