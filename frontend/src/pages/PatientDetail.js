import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Avatar,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  Emergency as EmergencyIcon,
  LocalHospital as HospitalIcon,
  Medication as MedicationIcon,
  Science as ScienceIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { format, differenceInYears } from 'date-fns';
import { useClinical } from '../contexts/ClinicalContext';
import { fhirClient } from '../services/fhirClient';
import EditableModal from '../components/EditableModal';
import PatientSummary from '../components/PatientSummary';
import VitalSignsTab from '../components/VitalSignsTab';
import LaboratoryTab from '../components/LaboratoryTab';
import EncounterDetail from '../components/EncounterDetail';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-tabpanel-${index}`}
      aria-labelledby={`patient-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentPatient, loadPatient, isLoading: contextLoading } = useClinical();
  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Modal state for editing
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalData, setModalData] = useState(null);
  
  // Encounter detail modal state
  const [encounterDetailOpen, setEncounterDetailOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState(null);

  useEffect(() => {
    if (currentPatient && currentPatient.id === id) {
      // Use data from context
      setPatient(currentPatient);
      setConditions(currentPatient.problems || []);
      setMedications(currentPatient.medications || []);
      fetchAdditionalData();
    } else {
      // Load patient data
      loadPatientData();
    }
  }, [id, currentPatient]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      await loadPatient(id);
    } catch (err) {
      console.error('Error loading patient:', err);
      setError('Failed to load patient data');
    }
  };

  const fetchAdditionalData = async () => {
    try {
      setLoading(true);
      
      // Fetch encounters and observations using FHIR
      const [encountersResult, observationsResult] = await Promise.all([
        fhirClient.getEncounters(id),
        fhirClient.getObservations(id)
      ]);
      
      // Transform encounters
      const transformedEncounters = encountersResult.resources.map(enc => {
        const type = enc.type?.[0];
        const period = enc.period || {};
        return {
          id: enc.id,
          patient_id: id,
          encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
          encounter_date: period.start || enc.date,
          status: enc.status,
          provider: enc.participant?.find(p => 
            p.type?.[0]?.coding?.[0]?.code === 'ATND'
          )?.individual?.display || 'Unknown Provider'
        };
      });
      
      // Transform observations
      const transformedObservations = observationsResult.resources.map(obs => ({
        id: obs.id,
        patient_id: id,
        observation_type: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
        value: obs.valueQuantity?.value || obs.valueString || '',
        unit: obs.valueQuantity?.unit || '',
        date: obs.effectiveDateTime || obs.issued,
        status: obs.status
      }));
      
      setEncounters(transformedEncounters);
      setObservations(transformedObservations);
      setError(null);
    } catch (err) {
      console.error('Error fetching additional data:', err);
      setError('Failed to load complete patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const calculateAge = (birthDate) => {
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'stopped': return 'error';
      case 'inactive': return 'warning';
      default: return 'default';
    }
  };

  // Modal handling functions
  const handleOpenModal = (type, data = null) => {
    setModalType(type);
    setModalData(data);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalType('');
    setModalData(null);
  };

  const handleSaveModal = (savedData) => {
    // Refresh the appropriate data
    switch (modalType) {
      case 'medication':
        if (modalData) {
          // Update existing
          setMedications(prev => prev.map(med => med.id === savedData.id ? savedData : med));
        } else {
          // Add new
          setMedications(prev => [...prev, savedData]);
        }
        break;
      case 'condition':
        if (modalData) {
          setConditions(prev => prev.map(cond => cond.id === savedData.id ? savedData : cond));
        } else {
          setConditions(prev => [...prev, savedData]);
        }
        break;
      case 'observation':
        if (modalData) {
          setObservations(prev => prev.map(obs => obs.id === savedData.id ? savedData : obs));
        } else {
          setObservations(prev => [...prev, savedData]);
        }
        break;
      case 'encounter':
        if (modalData) {
          setEncounters(prev => prev.map(enc => enc.id === savedData.id ? savedData : enc));
        } else {
          setEncounters(prev => [...prev, savedData]);
        }
        break;
    }
  };

  // Encounter detail functions
  const handleEncounterClick = (encounter) => {
    setSelectedEncounter(encounter);
    setEncounterDetailOpen(true);
  };

  const handleEncounterDetailClose = () => {
    setEncounterDetailOpen(false);
    setSelectedEncounter(null);
  };

  const handleEncounterUpdate = () => {
    // Refresh patient data after encounter update
    fetchPatientData();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!patient) {
    return (
      <Box p={3}>
        <Alert severity="warning">Patient not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Back Button */}
      <Box sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/patients')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="span">
          Back to Patient List
        </Typography>
      </Box>

      {/* Patient Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar
                sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'primary.main',
                  fontSize: '2rem'
                }}
              >
                {getInitials(patient.first_name, patient.last_name)}
              </Avatar>
            </Grid>
            <Grid item xs>
              <Typography variant="h4" gutterBottom>
                {patient.last_name}, {patient.first_name}
              </Typography>
              <Grid container spacing={2}>
                <Grid item>
                  <Typography variant="body2" color="text.secondary">
                    MRN: <strong>{patient.mrn}</strong>
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2" color="text.secondary">
                    DOB: <strong>{format(new Date(patient.date_of_birth), 'MM/dd/yyyy')}</strong>
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2" color="text.secondary">
                    Age: <strong>{calculateAge(patient.date_of_birth)} years</strong>
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2" color="text.secondary">
                    Gender: <strong>{patient.gender}</strong>
                  </Typography>
                </Grid>
              </Grid>
            </Grid>
            <Grid item>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <PhoneIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {patient.phone}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <EmailIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {patient.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <HomeIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {patient.city}, {patient.state}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <HospitalIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{encounters.length}</Typography>
              <Typography variant="body2" color="text.secondary">Encounters</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssignmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{conditions.length}</Typography>
              <Typography variant="body2" color="text.secondary">Active Conditions</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <MedicationIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{medications.length}</Typography>
              <Typography variant="body2" color="text.secondary">Medications</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ScienceIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{observations.length}</Typography>
              <Typography variant="body2" color="text.secondary">Lab Results</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabbed Interface */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="patient chart tabs">
            <Tab label="Overview" />
            <Tab label="Encounters" />
            <Tab label="Medications" />
            <Tab label="Vital Signs" />
            <Tab label="Laboratory" />
            <Tab label="Problem List" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <PatientSummary
            patient={patient}
            encounters={encounters}
            conditions={conditions}
            medications={medications}
            observations={observations}
          />
        </TabPanel>

        {/* Encounters Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Encounter History</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal('encounter')}
              size="small"
            >
              New Encounter
            </Button>
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Click on any encounter row to view detailed information including medications, lab results, vital signs, and diagnoses for that visit.
          </Alert>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Chief Complaint</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {encounters.map((encounter) => (
                  <TableRow 
                    key={encounter.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleEncounterClick(encounter)}
                  >
                    <TableCell>
                      {format(new Date(encounter.encounter_date), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell>{encounter.encounter_type}</TableCell>
                    <TableCell>{encounter.chief_complaint}</TableCell>
                    <TableCell>
                      <Chip label={encounter.status} color="success" size="small" />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit encounter notes">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenModal('encounter', encounter)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Medications Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Current Medications</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal('medication')}
              size="small"
            >
              Add Medication
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Medication</TableCell>
                  <TableCell>Dosage</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {medications.map((medication) => (
                  <TableRow key={medication.id}>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {medication.medication_name}
                      </Typography>
                    </TableCell>
                    <TableCell>{medication.dosage}</TableCell>
                    <TableCell>{medication.frequency}</TableCell>
                    <TableCell>
                      {format(new Date(medication.start_date), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={medication.status} 
                        color={getStatusColor(medication.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit medication">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenModal('medication', medication)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Vital Signs Tab */}
        <TabPanel value={tabValue} index={3}>
          <VitalSignsTab 
            observations={observations}
            onOpenModal={handleOpenModal}
          />
        </TabPanel>

        {/* Laboratory Tab */}
        <TabPanel value={tabValue} index={4}>
          <LaboratoryTab 
            observations={observations}
            onOpenModal={handleOpenModal}
          />
        </TabPanel>

        {/* Problem List Tab */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Active Problem List</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal('condition')}
              size="small"
            >
              Add Diagnosis
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ICD-10 Code</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Onset Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {conditions.map((condition) => (
                  <TableRow key={condition.id}>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {condition.icd10_code}
                      </Typography>
                    </TableCell>
                    <TableCell>{condition.description}</TableCell>
                    <TableCell>
                      {format(new Date(condition.onset_date), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={condition.clinical_status} 
                        color={getStatusColor(condition.clinical_status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit condition">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenModal('condition', condition)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Editable Modal */}
      <EditableModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveModal}
        type={modalType}
        data={modalData}
        patientId={id}
        encounterId={encounters.length > 0 ? encounters[0].id : null}
      />

      {/* Encounter Detail Modal */}
      <EncounterDetail
        open={encounterDetailOpen}
        onClose={handleEncounterDetailClose}
        encounter={selectedEncounter}
        patient={patient}
        onEdit={handleOpenModal}
        onUpdate={handleEncounterUpdate}
      />
    </Box>
  );
}

export default PatientDetail;