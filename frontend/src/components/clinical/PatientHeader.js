/**
 * Patient Header Component
 * Displays patient information and context across the clinical workspace
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  LocalHospital as HospitalIcon,
  EventNote as EventNoteIcon,
  Assignment as AssignmentIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import { format, differenceInYears } from 'date-fns';
import { useClinical } from '../../contexts/ClinicalContext';
import { useNavigate } from 'react-router-dom';
import { fhirClient } from '../../services/fhirClient';


const PatientHeader = ({ 
  onClose, 
  showEncounterInfo = true 
}) => {
  const navigate = useNavigate();
  const { currentPatient, currentEncounter, setCurrentEncounter, clearClinicalContext } = useClinical();
  const [encounters, setEncounters] = useState([]);
  const [loadingEncounters, setLoadingEncounters] = useState(false);

  useEffect(() => {
    if (currentPatient && showEncounterInfo) {
      loadEncounters();
    }
  }, [currentPatient?.id]);

  const loadEncounters = async () => {
    setLoadingEncounters(true);
    try {
      // Fetch encounters using FHIR
      const result = await fhirClient.getEncounters(currentPatient.id);
      
      // Transform and sort encounters
      const transformedEncounters = result.resources.map(enc => {
        const type = enc.type?.[0];
        const period = enc.period || {};
        return {
          id: enc.id,
          patient_id: currentPatient.id,
          encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
          encounter_date: period.start || enc.date,
          start_date: period.start || enc.date,
          status: enc.status,
          provider: enc.participant?.find(p => 
            p.type?.[0]?.coding?.[0]?.code === 'ATND'
          )?.individual?.display || 'Unknown Provider'
        };
      });
      
      // Sort by date descending and take top 10
      const encounterList = transformedEncounters
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
        .slice(0, 10);
      setEncounters(encounterList);
      
      // If no encounter is currently selected and we have encounters, select the most recent one
      if (!currentEncounter && encounterList.length > 0) {
        setCurrentEncounter(encounterList[0]);
      }
    } catch (error) {
      console.error('Error loading encounters:', error);
    } finally {
      setLoadingEncounters(false);
    }
  };

  const handleEncounterChange = async (encounterId) => {
    if (encounterId === 'new') {
      navigate(`/patients/${currentPatient.id}/encounters/new`);
      return;
    }
    
    const encounter = encounters.find(e => e.id === encounterId);
    if (encounter) {
      setCurrentEncounter(encounter);
    } else if (!encounterId) {
      setCurrentEncounter(null);
    }
  };

  if (!currentPatient) {
    return null;
  }

  const calculateAge = (dob) => {
    if (!dob) return 'Unknown';
    try {
      const date = new Date(dob);
      if (isNaN(date.getTime())) return 'Unknown';
      return differenceInYears(new Date(), date);
    } catch (error) {
      return 'Unknown';
    }
  };

  const formatDate = (dateString, formatStr = 'MM/dd/yyyy') => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      return format(date, formatStr);
    } catch (error) {
      return 'Unknown';
    }
  };

  const handleClose = () => {
    clearClinicalContext();
    if (onClose) {
      onClose();
    } else {
      navigate('/patients');
    }
  };

  const formatMRN = (mrn) => {
    if (!mrn) return 'No MRN';
    // Format MRN for display (e.g., XXX-XX-XXXX)
    try {
      return mrn.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
    } catch (error) {
      return mrn; // Return as-is if formatting fails
    }
  };

  const getAllergyCount = () => {
    return currentPatient.allergies?.filter(a => a.status === 'active').length || 0;
  };

  const getProblemCount = () => {
    return currentPatient.problems?.filter(p => p.clinicalStatus === 'active').length || 0;
  };

  const getMedicationCount = () => {
    return currentPatient.medications?.filter(m => m.status === 'active').length || 0;
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        mb: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2
      }}
    >
      <Grid container spacing={2} alignItems="center">
        {/* Patient Demographics */}
        <Grid item xs={12} md={4}>
          <Box display="flex" alignItems="center" gap={1}>
            <HospitalIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {currentPatient.lastName}, {currentPatient.firstName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                MRN: {formatMRN(currentPatient.mrn)} | 
                DOB: {formatDate(currentPatient.dateOfBirth)} | 
                Age: {calculateAge(currentPatient.dateOfBirth)} | 
                {currentPatient.gender}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Clinical Alerts */}
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={1} alignItems="center">
            {getAllergyCount() > 0 && (
              <Tooltip title={`${getAllergyCount()} active allergies`}>
                <Chip
                  icon={<WarningIcon />}
                  label={`Allergies: ${getAllergyCount()}`}
                  color="error"
                  size="small"
                  onClick={() => navigate(`/patients/${currentPatient.id}/allergies`)}
                />
              </Tooltip>
            )}
            
            {getProblemCount() > 0 && (
              <Tooltip title={`${getProblemCount()} active problems`}>
                <Chip
                  icon={<EventNoteIcon />}
                  label={`Problems: ${getProblemCount()}`}
                  color="warning"
                  size="small"
                  onClick={() => navigate(`/patients/${currentPatient.id}/problems`)}
                />
              </Tooltip>
            )}
            
            {getMedicationCount() > 0 && (
              <Tooltip title={`${getMedicationCount()} active medications`}>
                <Chip
                  icon={<AssignmentIcon />}
                  label={`Meds: ${getMedicationCount()}`}
                  color="info"
                  size="small"
                  onClick={() => navigate(`/patients/${currentPatient.id}/medications`)}
                />
              </Tooltip>
            )}
          </Stack>
        </Grid>

        {/* Encounter Info & Actions */}
        <Grid item xs={12} md={4}>
          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
            {showEncounterInfo && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={currentEncounter?.id || ''}
                  onChange={(e) => handleEncounterChange(e.target.value)}
                  displayEmpty
                  disabled={loadingEncounters}
                  IconComponent={ArrowDropDownIcon}
                  sx={{
                    '& .MuiSelect-select': {
                      py: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>No Encounter Selected</em>
                  </MenuItem>
                  {encounters.map((encounter) => (
                    <MenuItem key={encounter.id} value={encounter.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px' }}>
                          {encounter.encounter_type || 'Visit'} - {formatDate(encounter.encounter_date, 'MM/dd/yyyy')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
                          Status: {encounter.status || 'in-progress'} | Class: {encounter.encounter_class || 'AMB'}
                        </span>
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem value="new">
                    <Typography variant="body2" color="primary">
                      + Start New Encounter
                    </Typography>
                  </MenuItem>
                </Select>
              </FormControl>
            )}
            
            <IconButton 
              size="small" 
              onClick={handleClose}
              sx={{ ml: 1 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Grid>
      </Grid>

      {/* Additional Alerts */}
      {currentPatient.allergies?.some(a => a.severity === 'severe') && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          icon={<WarningIcon />}
        >
          <Typography variant="body2">
            <strong>Severe Allergies:</strong> {
              currentPatient.allergies
                .filter(a => a.severity === 'severe')
                .map(a => a.allergen)
                .join(', ')
            }
          </Typography>
        </Alert>
      )}

      {/* Code Status or other critical info */}
      {currentPatient.codeStatus && currentPatient.codeStatus !== 'full-code' && (
        <Alert 
          severity="warning" 
          sx={{ mt: 1 }}
          icon={<InfoIcon />}
        >
          <Typography variant="body2">
            <strong>Code Status:</strong> {currentPatient.codeStatus}
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};

export default PatientHeader;