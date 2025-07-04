import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  LocalPharmacy as PharmacyIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';

const PatientMedications = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0: Active, 1: All, 2: History
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    loadPatientAndMedications();
  }, [id]);

  const loadPatientAndMedications = async () => {
    try {
      setLoading(true);
      
      // Load patient data
      const patientData = await fhirClient.getPatient(id);
      setPatient(patientData);
      
      // Load medications
      const medicationsData = await fhirClient.getMedications(id);
      setMedications(medicationsData.resources || []);
      
      setError(null);
    } catch (err) {
      console.error('Error loading patient medications:', err);
      setError('Failed to load patient medications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'stopped': return 'warning';
      case 'on-hold': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckIcon fontSize="small" />;
      case 'stopped': return <CancelIcon fontSize="small" />;
      case 'on-hold': return <ScheduleIcon fontSize="small" />;
      default: return <InfoIcon fontSize="small" />;
    }
  };

  const filterMedications = () => {
    let filtered = medications;

    // Filter by tab
    if (activeTab === 0) {
      filtered = filtered.filter(med => med.status === 'active');
    } else if (activeTab === 2) {
      filtered = filtered.filter(med => ['completed', 'stopped', 'cancelled'].includes(med.status));
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(med => {
        const medicationCode = med.medicationCodeableConcept || med.code;
        const medicationName = medicationCode?.text || 
                              medicationCode?.coding?.[0]?.display || 
                              med.medication_name || '';
        return medicationName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.authoredOn || a.start_date || a.effectiveDateTime);
      const dateB = new Date(b.authoredOn || b.start_date || b.effectiveDateTime);
      return dateB - dateA;
    });
  };

  const getMedicationName = (medication) => {
    const medicationCode = medication.medicationCodeableConcept || medication.code;
    return medicationCode?.text || 
           medicationCode?.coding?.[0]?.display || 
           medication.medication_name || 
           'Unknown Medication';
  };

  const getDosageInstruction = (medication) => {
    if (medication.dosageInstruction && medication.dosageInstruction.length > 0) {
      const dosage = medication.dosageInstruction[0];
      return dosage.text || dosage.patientInstruction || '';
    }
    return medication.dosage || medication.instructions || '';
  };

  const getRequester = (medication) => {
    if (medication.requester && medication.requester.display) {
      return medication.requester.display;
    }
    return medication.prescriber || 'Unknown Prescriber';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/patients')}>
            Return to Patient List
          </Button>
        </Box>
      </Box>
    );
  }

  const filteredMedications = filterMedications();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate(`/patients/${id}`)}>
            <ArrowBackIcon />
          </IconButton>
          <MedicationIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Patient Medications
          </Typography>
        </Box>
        
        {patient && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6">
                {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                DOB: {patient.birthDate ? format(new Date(patient.birthDate), 'MM/dd/yyyy') : 'Unknown'} | 
                MRN: {patient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || 'Unknown'}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search medications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                New Prescription
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            label={`Active (${medications.filter(m => m.status === 'active').length})`} 
            icon={<CheckIcon />}
          />
          <Tab 
            label={`All (${medications.length})`} 
            icon={<MedicationIcon />}
          />
          <Tab 
            label={`History (${medications.filter(m => ['completed', 'stopped', 'cancelled'].includes(m.status)).length})`} 
            icon={<ScheduleIcon />}
          />
        </Tabs>
      </Box>

      {/* Medications List */}
      {filteredMedications.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <PharmacyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No medications found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {activeTab === 0 ? 'This patient has no active medications.' :
               activeTab === 2 ? 'This patient has no medication history.' :
               'No medications match your search criteria.'}
            </Typography>
            {activeTab === 0 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                Add First Medication
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Medication</TableCell>
                <TableCell>Dosage</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Prescriber</TableCell>
                <TableCell>Date Prescribed</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedications.map((medication) => (
                <TableRow key={medication.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {getMedicationName(medication)}
                      </Typography>
                      {medication.category && (
                        <Typography variant="caption" color="text.secondary">
                          {medication.category.text || medication.category.coding?.[0]?.display}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getDosageInstruction(medication) || 'No dosage specified'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(medication.status)}
                      label={medication.status || 'unknown'}
                      color={getStatusColor(medication.status)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getRequester(medication)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {medication.authoredOn || medication.start_date ? 
                        format(new Date(medication.authoredOn || medication.start_date), 'MM/dd/yyyy') : 
                        'Unknown'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="primary">
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* New Prescription Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Prescription</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Electronic prescribing functionality is not yet implemented. This would integrate with:
            <ul>
              <li>Drug databases for medication selection</li>
              <li>Drug interaction checking</li>
              <li>Allergy verification</li>
              <li>Pharmacy systems</li>
              <li>State prescription monitoring programs</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientMedications;