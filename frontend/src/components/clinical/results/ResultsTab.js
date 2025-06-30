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
  Divider,
  Card,
  CardContent
} from '@mui/material';
import {
  Science as LabIcon,
  Camera as ImagingIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NormalIcon
} from '@mui/icons-material';
import { useClinical } from '../../../contexts/ClinicalContext';
import api from '../../../services/api';

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

  useEffect(() => {
    if (currentPatient && !hasLoadedInitial) {
      console.log('ResultsTab - Initial load for patient:', currentPatient.id);
      loadResults();
      setHasLoadedInitial(true);
    }
  }, [currentPatient]);

  useEffect(() => {
    if (currentPatient && hasLoadedInitial) {
      console.log('ResultsTab - Reloading due to encounter change:', currentEncounter?.id);
      loadResults();
    }
  }, [currentEncounter?.id]);

  const loadResults = async () => {
    console.log('Loading results for patient:', currentPatient?.id, 'encounter:', currentEncounter?.id);
    setLoading(true);
    try {
      // Load ALL lab results for the patient
      const params = {
        patient_id: currentPatient.id,
        observation_type: 'laboratory'
      };
      
      // Don't filter by encounter - instead we'll show all results
      // and highlight/sort the ones from the current encounter
      const labResponse = await api.get('/api/observations', { params });
      console.log('Lab results loaded:', labResponse.data?.length || 0, 'results');
      
      // Filter and sort results based on encounter context
      let results = labResponse.data || [];
      
      if (currentEncounter && currentEncounter.encounter_date) {
        // Filter to only show results up to and including the encounter date
        const encounterDate = new Date(currentEncounter.encounter_date || currentEncounter.startDate);
        console.log('Filtering results up to encounter date:', encounterDate);
        
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
        
        console.log('Filtered to', results.length, 'results for encounter context');
      } else {
        // Just sort by date if no encounter selected (show all results)
        console.log('No encounter selected, showing all results');
        results.sort((a, b) => new Date(b.observation_date) - new Date(a.observation_date));
      }
      
      setLabResults(results);

      // Load imaging results would go here when available
      setImagingResults([]);
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Results Review
      </Typography>

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
          {imagingResults.length > 0 ? (
            <List>
              {imagingResults.map((result, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    <ImagingIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={result.studyDescription}
                    secondary={`Date: ${new Date(result.studyDate).toLocaleDateString()} | Status: ${result.status}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Alert severity="info">
                No imaging results available for this patient.
              </Alert>
            </Box>
          )}
        </Paper>
      </TabPanel>
    </Box>
  );
};

export default ResultsTab;