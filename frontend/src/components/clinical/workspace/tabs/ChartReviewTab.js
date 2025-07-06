/**
 * Chart Review Tab Component
 * Comprehensive view of patient's problems, medications, and allergies
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
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  Button,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  LocalPharmacy as PharmacyIcon,
  Vaccines as ImmunizationIcon,
  FamilyRestroom as FamilyIcon,
  SmokingRooms as SmokingIcon,
  LocalBar as AlcoholIcon,
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Timeline as TimelineIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  ErrorOutline as SeverityIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

// Problem List Component
const ProblemList = ({ conditions, patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return 'error';
      case 'moderate': return 'warning';
      case 'mild': return 'info';
      default: return 'default';
    }
  };

  const filteredConditions = conditions.filter(condition => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && condition.clinicalStatus?.coding?.[0]?.code === 'active') ||
      (filter === 'resolved' && condition.clinicalStatus?.coding?.[0]?.code === 'resolved');
    
    const matchesSearch = !searchTerm || 
      (condition.code?.text || condition.code?.coding?.[0]?.display || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const activeCount = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active').length;
  const resolvedCount = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved').length;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>Problem List</Typography>
            <Stack direction="row" spacing={1}>
              <Chip 
                label={`${activeCount} Active`} 
                size="small" 
                color="primary" 
                variant={filter === 'active' ? 'filled' : 'outlined'}
                onClick={() => setFilter('active')}
              />
              <Chip 
                label={`${resolvedCount} Resolved`} 
                size="small" 
                variant={filter === 'resolved' ? 'filled' : 'outlined'}
                onClick={() => setFilter('resolved')}
              />
              <Chip 
                label="All" 
                size="small" 
                variant={filter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setFilter('all')}
              />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Problem">
              <IconButton size="small" color="primary" onClick={() => navigate(`/patients/${patientId}/problems/new`)}>
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View History">
              <IconButton size="small">
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <TextField
          fullWidth
          size="small"
          placeholder="Search problems..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredConditions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No problems found
            </Typography>
          ) : (
            filteredConditions.map((condition) => (
              <ListItem
                key={condition.id}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: expandedItems[condition.id] ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <ListItemIcon>
                  <ProblemIcon color={condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'warning' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
                      </Typography>
                      {condition.severity && (
                        <Chip 
                          label={condition.severity.text || condition.severity.coding?.[0]?.display} 
                          size="small" 
                          color={getSeverityColor(condition.severity.text)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {condition.onsetDateTime ? 
                          `Onset: ${format(parseISO(condition.onsetDateTime), 'MMM d, yyyy')}` : 
                          'Onset date unknown'}
                      </Typography>
                      {condition.note?.[0]?.text && expandedItems[condition.id] && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {condition.note[0].text}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    size="small"
                    onClick={() => toggleExpanded(condition.id)}
                  >
                    {expandedItems[condition.id] ? <ExpandMoreIcon /> : <ExpandMoreIcon sx={{ transform: 'rotate(-90deg)' }} />}
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </CardContent>
    </Card>
  );
};

// Medication List Component
const MedicationList = ({ medications, patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const [expandedItems, setExpandedItems] = useState({});

  const filteredMedications = medications.filter(med => {
    return filter === 'all' || med.status === filter;
  });

  const activeCount = medications.filter(m => m.status === 'active').length;
  const stoppedCount = medications.filter(m => m.status === 'stopped' || m.status === 'completed').length;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>Medications</Typography>
            <Stack direction="row" spacing={1}>
              <Chip 
                label={`${activeCount} Active`} 
                size="small" 
                color="primary" 
                variant={filter === 'active' ? 'filled' : 'outlined'}
                onClick={() => setFilter('active')}
              />
              <Chip 
                label={`${stoppedCount} Stopped`} 
                size="small" 
                variant={filter === 'stopped' ? 'filled' : 'outlined'}
                onClick={() => setFilter('stopped')}
              />
              <Chip 
                label="All" 
                size="small" 
                variant={filter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setFilter('all')}
              />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Prescribe Medication">
              <IconButton size="small" color="primary" onClick={() => navigate(`/patients/${patientId}/medications/prescribe`)}>
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Medication Reconciliation">
              <IconButton size="small" onClick={() => navigate(`/patients/${patientId}/medication-reconciliation`)}>
                <PharmacyIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredMedications.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No medications found
            </Typography>
          ) : (
            filteredMedications.map((med) => (
              <ListItem
                key={med.id}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: med.status === 'active' ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <ListItemIcon>
                  <MedicationIcon color={med.status === 'active' ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box>
                      <Typography variant="body1">
                        {med.medicationCodeableConcept?.text || 
                         med.medicationCodeableConcept?.coding?.[0]?.display ||
                         'Unknown medication'}
                      </Typography>
                      {med.status !== 'active' && (
                        <Chip label={med.status} size="small" sx={{ ml: 1 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption">
                        {med.dosageInstruction?.[0]?.text || 'No dosage information'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Prescribed: {med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </CardContent>
    </Card>
  );
};

// Allergy List Component
const AllergyList = ({ allergies, patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const getSeverityColor = (criticality) => {
    switch (criticality?.toLowerCase()) {
      case 'high': return 'error';
      case 'low': return 'warning';
      default: return 'info';
    }
  };

  const activeAllergies = allergies.filter(a => a.clinicalStatus?.coding?.[0]?.code === 'active');

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>Allergies & Intolerances</Typography>
            <Chip 
              icon={<WarningIcon />}
              label={`${activeAllergies.length} Active`} 
              size="small" 
              color={activeAllergies.length > 0 ? 'error' : 'default'}
            />
          </Box>
          <Tooltip title="Add Allergy">
            <IconButton size="small" color="primary" onClick={() => navigate(`/patients/${patientId}/allergies/new`)}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {allergies.length === 0 ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              No known allergies
            </Alert>
          ) : (
            allergies.map((allergy) => (
              <ListItem
                key={allergy.id}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.1) }
                }}
              >
                <ListItemIcon>
                  <WarningIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'}
                      </Typography>
                      {allergy.criticality && (
                        <Chip 
                          label={allergy.criticality} 
                          size="small" 
                          color={getSeverityColor(allergy.criticality)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {allergy.reaction?.[0]?.manifestation?.map((m, idx) => (
                        <Chip 
                          key={idx}
                          label={m.text || m.coding?.[0]?.display} 
                          size="small" 
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      <Typography variant="caption" color="text.secondary" display="block">
                        Recorded: {allergy.recordedDate ? format(parseISO(allergy.recordedDate), 'MMM d, yyyy') : 'Unknown'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))
          )}
        </List>
      </CardContent>
    </Card>
  );
};

// Social History Component
const SocialHistory = ({ observations, patientId }) => {
  const socialObs = observations.filter(o => 
    o.category?.[0]?.coding?.[0]?.code === 'social-history'
  );

  const smokingStatus = socialObs.find(o => o.code?.coding?.[0]?.code === '72166-2');
  const alcoholUse = socialObs.find(o => o.code?.coding?.[0]?.code === '74013-4');

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Social History</Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <SmokingIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Smoking Status"
              secondary={smokingStatus?.valueCodeableConcept?.text || 'Not documented'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <AlcoholIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Alcohol Use"
              secondary={alcoholUse?.valueCodeableConcept?.text || 'Not documented'}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

const ChartReviewTab = ({ patientId, onNotificationUpdate }) => {
  const { 
    getPatientResources, 
    searchResources, 
    isLoading 
  } = useFHIRResource();
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Data is already loaded by FHIRResourceContext
    setLoading(false);
  }, []);

  // Get resources
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];
  const immunizations = getPatientResources(patientId, 'Immunization') || [];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Problem List */}
        <Grid item xs={12} lg={6}>
          <ProblemList conditions={conditions} patientId={patientId} />
        </Grid>

        {/* Medications */}
        <Grid item xs={12} lg={6}>
          <MedicationList medications={medications} patientId={patientId} />
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} lg={6}>
          <AllergyList allergies={allergies} patientId={patientId} />
        </Grid>

        {/* Social History */}
        <Grid item xs={12} lg={6}>
          <SocialHistory observations={observations} patientId={patientId} />
        </Grid>

        {/* Immunizations Summary */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Immunizations</Typography>
                <Chip 
                  icon={<ImmunizationIcon />}
                  label={`${immunizations.length} recorded`} 
                  size="small" 
                  color="success"
                />
              </Stack>
              {immunizations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No immunization records found
                </Typography>
              ) : (
                <Typography variant="body2">
                  Last immunization: {
                    immunizations[0]?.occurrenceDateTime ? 
                    format(parseISO(immunizations[0].occurrenceDateTime), 'MMM d, yyyy') : 
                    'Unknown'
                  }
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ChartReviewTab;