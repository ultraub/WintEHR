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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  LocalHospital as MedicalIcon,
  Restaurant as FoodIcon,
  Nature as EnvironmentalIcon,
  Block as NoAllergiesIcon,
  HighlightOff as RemoveIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';

const PatientAllergies = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    loadPatientAndAllergies();
  }, [id]);

  const loadPatientAndAllergies = async () => {
    try {
      setLoading(true);
      
      // Load patient data
      const patientData = await fhirClient.getPatient(id);
      setPatient(patientData);
      
      // Load allergies
      const allergiesData = await fhirClient.getAllergies(id);
      setAllergies(allergiesData.resources || []);
      
      setError(null);
    } catch (err) {
      console.error('Error loading patient allergies:', err);
      setError('Failed to load patient allergies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return 'error';
      case 'moderate': return 'warning';
      case 'mild': return 'info';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('medication') || cat.includes('drug')) return <MedicalIcon fontSize="small" />;
    if (cat.includes('food')) return <FoodIcon fontSize="small" />;
    if (cat.includes('environmental')) return <EnvironmentalIcon fontSize="small" />;
    return <WarningIcon fontSize="small" />;
  };

  const getAllergenName = (allergy) => {
    const code = allergy.code;
    return code?.text || code?.coding?.[0]?.display || allergy.allergen || 'Unknown Allergen';
  };

  const getReactionDescription = (allergy) => {
    if (allergy.reaction && allergy.reaction.length > 0) {
      const reaction = allergy.reaction[0];
      const manifestations = reaction.manifestation || [];
      if (manifestations.length > 0) {
        return manifestations.map(m => m.text || m.coding?.[0]?.display).join(', ');
      }
      return reaction.description || '';
    }
    return allergy.reaction_description || '';
  };

  const getSeverity = (allergy) => {
    if (allergy.reaction && allergy.reaction.length > 0) {
      return allergy.reaction[0].severity || '';
    }
    return allergy.severity || '';
  };

  const getCriticality = (allergy) => {
    return allergy.criticality || '';
  };

  const filterAllergies = () => {
    let filtered = allergies;

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(allergy => {
        const category = allergy.category?.[0]?.toLowerCase() || '';
        return category === filterCategory;
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(allergy => {
        const allergenName = getAllergenName(allergy).toLowerCase();
        const reaction = getReactionDescription(allergy).toLowerCase();
        return allergenName.includes(searchTerm.toLowerCase()) ||
               reaction.includes(searchTerm.toLowerCase());
      });
    }

    return filtered.sort((a, b) => {
      // Sort by severity (severe first), then by date
      const severityOrder = { 'severe': 0, 'moderate': 1, 'mild': 2 };
      const aSeverity = getSeverity(a)?.toLowerCase();
      const bSeverity = getSeverity(b)?.toLowerCase();
      
      if (severityOrder[aSeverity] !== severityOrder[bSeverity]) {
        return (severityOrder[aSeverity] || 99) - (severityOrder[bSeverity] || 99);
      }
      
      const dateA = new Date(a.recordedDate || a.onset || a.assertedDate);
      const dateB = new Date(b.recordedDate || b.onset || b.assertedDate);
      return dateB - dateA;
    });
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

  const filteredAllergies = filterAllergies();
  const hasActiveAllergies = allergies.some(allergy => 
    allergy.clinicalStatus?.coding?.[0]?.code === 'active' || 
    allergy.clinical_status === 'active' ||
    !allergy.clinicalStatus
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate(`/patients/${id}`)}>
            <ArrowBackIcon />
          </IconButton>
          <WarningIcon sx={{ fontSize: 32, color: 'error.main' }} />
          <Typography variant="h4" component="h1">
            Patient Allergies & Intolerances
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
              {hasActiveAllergies && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>ALLERGY ALERT:</strong> This patient has documented allergies. Review carefully before prescribing medications.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search allergies..."
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
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={filterCategory}
                label="Category"
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <MenuItem value="all">All Categories</MenuItem>
                <MenuItem value="medication">Medication</MenuItem>
                <MenuItem value="food">Food</MenuItem>
                <MenuItem value="environment">Environmental</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                Add Allergy
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Allergies List */}
      {filteredAllergies.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <NoAllergiesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No allergies found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {allergies.length === 0 ? 
                'This patient has no documented allergies.' :
                'No allergies match your search criteria.'
              }
            </Typography>
            {allergies.length === 0 && (
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenDialog(true)}
                >
                  Add Allergy
                </Button>
                <Button variant="outlined">
                  Mark as "No Known Allergies"
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Allergen</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Reaction</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date Recorded</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAllergies.map((allergy) => (
                <TableRow 
                  key={allergy.id} 
                  hover
                  sx={{
                    backgroundColor: getSeverity(allergy)?.toLowerCase() === 'severe' ? 
                      'error.light' : 'transparent'
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getCategoryIcon(allergy.category?.[0])}
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {getAllergenName(allergy)}
                        </Typography>
                        {allergy.note && (
                          <Typography variant="caption" color="text.secondary">
                            {allergy.note}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={allergy.category?.[0] || 'Unknown'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getReactionDescription(allergy) || 'No reaction details'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getSeverity(allergy) || 'Unknown'}
                      color={getSeverityColor(getSeverity(allergy))}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={allergy.clinicalStatus?.coding?.[0]?.code || 
                            allergy.clinical_status || 
                            'active'}
                      color={
                        (allergy.clinicalStatus?.coding?.[0]?.code || allergy.clinical_status) === 'active' ? 
                        'error' : 'default'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {allergy.recordedDate || allergy.assertedDate ? 
                        format(new Date(allergy.recordedDate || allergy.assertedDate), 'MM/dd/yyyy') : 
                        'Unknown'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <IconButton size="small" color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <RemoveIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Allergy Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Allergy</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Allergy documentation functionality is not yet fully implemented. This would include:
            <ul>
              <li>Allergen search with coding systems (RxNorm, SNOMED CT)</li>
              <li>Reaction severity assessment</li>
              <li>Onset date tracking</li>
              <li>Verification status workflow</li>
              <li>Cross-reactivity checking</li>
              <li>Integration with prescribing systems</li>
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

export default PatientAllergies;