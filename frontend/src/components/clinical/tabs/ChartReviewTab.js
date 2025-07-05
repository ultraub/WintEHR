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
  InputLabel
} from '@mui/material';
import {
  Healing as ConditionIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  LocalPharmacy as PharmacyIcon,
  VaccinesOutlined as ImmunizationIcon,
  FamilyRestroom as FamilyIcon,
  SmokingRooms as SmokingIcon,
  LocalBar as AlcoholIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';

// Problem List Component
const ProblemList = ({ conditions, patientId, onRefresh }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getConditionSeverityColor = (severity) => {
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

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Problem List</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Problem">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View History">
              <IconButton size="small">
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print">
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack spacing={2} mb={2}>
          <TextField
            size="small"
            placeholder="Search problems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          <FormControl size="small">
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Status Filter"
            >
              <MenuItem value="all">All Problems</MenuItem>
              <MenuItem value="active">Active Only</MenuItem>
              <MenuItem value="resolved">Resolved Only</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <List>
          {filteredConditions.map((condition, index) => {
            const display = condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition';
            const code = condition.code?.coding?.[0]?.code;
            const system = condition.code?.coding?.[0]?.system;
            const isExpanded = expandedItems[condition.id];

            return (
              <React.Fragment key={condition.id}>
                <ListItem>
                  <ListItemIcon>
                    <ConditionIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">{display}</Typography>
                        {condition.severity && (
                          <Chip 
                            label={condition.severity.text || condition.severity.coding?.[0]?.display}
                            size="small"
                            color={getConditionSeverityColor(condition.severity.text)}
                          />
                        )}
                        <Chip 
                          label={condition.clinicalStatus?.coding?.[0]?.code}
                          size="small"
                          color={condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'success' : 'default'}
                        />
                      </Stack>
                    }
                    secondary={
                      <>
                        {code && system && `${system.includes('snomed') ? 'SNOMED' : 'ICD-10'}: ${code}`}
                        {condition.onsetDateTime && ` • Onset: ${format(parseISO(condition.onsetDateTime), 'MMM dd, yyyy')}`}
                      </>
                    }
                  />
                  <IconButton size="small" onClick={() => toggleExpanded(condition.id)}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </ListItem>
                <Collapse in={isExpanded}>
                  <Box pl={9} pr={2} pb={2}>
                    <Stack spacing={1}>
                      {condition.note?.map((note, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary">
                          {note.text}
                        </Typography>
                      ))}
                      {condition.evidence?.map((evidence, idx) => (
                        <Typography key={idx} variant="caption" color="text.secondary">
                          Evidence: {evidence.detail?.[0]?.display}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                </Collapse>
                {index < filteredConditions.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>

        {filteredConditions.length === 0 && (
          <Alert severity="info">
            {searchTerm ? 'No problems match your search' : 'No problems recorded'}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Medication List Component
const MedicationList = ({ medications, patientId, onRefresh }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('active');

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredMedications = medications.filter(med => {
    return filter === 'all' || med.status === filter;
  });

  const getMedicationStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'stopped': return 'error';
      case 'on-hold': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Medications</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Prescribe Medication">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Medication Reconciliation">
              <IconButton size="small">
                <PharmacyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print Medication List">
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            label="Status Filter"
          >
            <MenuItem value="all">All Medications</MenuItem>
            <MenuItem value="active">Active Only</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="stopped">Stopped</MenuItem>
            <MenuItem value="on-hold">On Hold</MenuItem>
          </Select>
        </FormControl>

        <List>
          {filteredMedications.map((med, index) => {
            const medName = med.medication?.concept?.text || 
                           med.medication?.concept?.coding?.[0]?.display ||
                           med.medication?.reference?.display ||
                           'Unknown Medication';
            const dosage = med.dosageInstruction?.[0];
            const isExpanded = expandedItems[med.id];

            return (
              <React.Fragment key={med.id}>
                <ListItem>
                  <ListItemIcon>
                    <MedicationIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">{medName}</Typography>
                        <Chip 
                          label={med.status}
                          size="small"
                          color={getMedicationStatusColor(med.status)}
                        />
                        {med.category?.coding?.[0]?.code && (
                          <Chip 
                            label={med.category.coding[0].display || med.category.coding[0].code}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <>
                        {dosage?.text && `Sig: ${dosage.text} • `}
                        Prescribed: {med.authoredOn ? format(parseISO(med.authoredOn), 'MM/dd/yyyy') : 'Unknown'}
                        {med.requester?.display && ` by ${med.requester.display}`}
                      </>
                    }
                  />
                  <IconButton size="small" onClick={() => toggleExpanded(med.id)}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </ListItem>
                <Collapse in={isExpanded}>
                  <Box pl={9} pr={2} pb={2}>
                    <Stack spacing={1}>
                      {dosage && (
                        <>
                          {dosage.route && (
                            <Typography variant="body2">
                              Route: {dosage.route.text || dosage.route.coding?.[0]?.display}
                            </Typography>
                          )}
                          {dosage.timing && (
                            <Typography variant="body2">
                              Frequency: {dosage.timing.repeat?.frequency} times per {dosage.timing.repeat?.period} {dosage.timing.repeat?.periodUnit}
                            </Typography>
                          )}
                          {med.dispenseRequest && (
                            <>
                              <Typography variant="body2">
                                Quantity: {med.dispenseRequest.quantity?.value} {med.dispenseRequest.quantity?.unit}
                              </Typography>
                              <Typography variant="body2">
                                Refills: {med.dispenseRequest.numberOfRepeatsAllowed || 0}
                              </Typography>
                            </>
                          )}
                        </>
                      )}
                      {med.note?.map((note, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary">
                          Note: {note.text}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                </Collapse>
                {index < filteredMedications.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>

        {filteredMedications.length === 0 && (
          <Alert severity="info">
            No medications found for the selected filter
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Allergy List Component
const AllergyList = ({ allergies, patientId, onRefresh }) => {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCriticalityColor = (criticality) => {
    switch (criticality) {
      case 'high': return 'error';
      case 'low': return 'success';
      case 'unable-to-assess': return 'warning';
      default: return 'default';
    }
  };

  const activeAllergies = allergies.filter(a => a.clinicalStatus?.coding?.[0]?.code === 'active');

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Allergies & Intolerances</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Allergy">
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print Allergy List">
              <IconButton size="small">
                <PrintIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <List>
          {activeAllergies.map((allergy, index) => {
            const display = allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown Allergen';
            const isExpanded = expandedItems[allergy.id];

            return (
              <React.Fragment key={allergy.id}>
                <ListItem>
                  <ListItemIcon>
                    <WarningIcon color={getCriticalityColor(allergy.criticality)} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">{display}</Typography>
                        <Chip 
                          label={allergy.type || 'allergy'}
                          size="small"
                          variant="outlined"
                        />
                        {allergy.criticality && (
                          <Chip 
                            label={allergy.criticality}
                            size="small"
                            color={getCriticalityColor(allergy.criticality)}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption">
                        Recorded: {allergy.recordedDate ? format(parseISO(allergy.recordedDate), 'MM/dd/yyyy') : 'Unknown'}
                      </Typography>
                    }
                  />
                  <IconButton size="small" onClick={() => toggleExpanded(allergy.id)}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </ListItem>
                <Collapse in={isExpanded}>
                  <Box pl={9} pr={2} pb={2}>
                    <Stack spacing={1}>
                      {allergy.reaction?.map((reaction, idx) => (
                        <Box key={idx}>
                          <Typography variant="body2" fontWeight="medium">
                            Reaction {idx + 1}:
                          </Typography>
                          <Stack spacing={0.5} pl={2}>
                            {reaction.manifestation?.map((manifestation, mIdx) => (
                              <Typography key={mIdx} variant="body2">
                                • {manifestation.concept?.text || manifestation.concept?.coding?.[0]?.display}
                              </Typography>
                            ))}
                            {reaction.severity && (
                              <Typography variant="body2" color="text.secondary">
                                Severity: {reaction.severity}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      ))}
                      {allergy.note?.map((note, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary">
                          Note: {note.text}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                </Collapse>
                {index < activeAllergies.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>

        {activeAllergies.length === 0 && (
          <Alert severity="success">
            No known allergies (NKDA)
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Main Chart Review Tab Component
const ChartReviewTab = ({ patientId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [immunizations, setImmunizations] = useState([]);
  const [socialHistory, setSocialHistory] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);

  useEffect(() => {
    if (!patientId) return;
    fetchChartData();
  }, [patientId]);

  const fetchChartData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        conditionsResult,
        medicationsResult,
        allergiesResult,
        immunizationsResult,
        observationsResult
      ] = await Promise.all([
        fhirClient.getConditions(patientId),
        fhirClient.getMedications(patientId),
        fhirClient.getAllergies(patientId),
        fhirClient.getImmunizations(patientId),
        fhirClient.getObservations(patientId)
      ]);

      setConditions(conditionsResult.resources || []);
      setMedications(medicationsResult.resources || []);
      setAllergies(allergiesResult.resources || []);
      setImmunizations(immunizationsResult.resources || []);

      // Extract social history from observations
      const socialHistoryObs = observationsResult.resources.filter(obs => 
        obs.category?.[0]?.coding?.[0]?.code === 'social-history'
      );
      setSocialHistory(socialHistoryObs);

    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading chart data: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Problem List */}
        <Grid item xs={12} lg={6}>
          <ProblemList 
            conditions={conditions} 
            patientId={patientId}
            onRefresh={fetchChartData}
          />
        </Grid>

        {/* Medications */}
        <Grid item xs={12} lg={6}>
          <MedicationList 
            medications={medications}
            patientId={patientId}
            onRefresh={fetchChartData}
          />
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} lg={6}>
          <AllergyList 
            allergies={allergies}
            patientId={patientId}
            onRefresh={fetchChartData}
          />
        </Grid>

        {/* Immunizations */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Immunization History</Typography>
                <Tooltip title="Add Immunization">
                  <IconButton size="small" color="primary">
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
              
              <List>
                {immunizations.slice(0, 5).map((immunization, index) => (
                  <React.Fragment key={immunization.id}>
                    <ListItem>
                      <ListItemIcon>
                        <ImmunizationIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={immunization.vaccineCode?.text || immunization.vaccineCode?.coding?.[0]?.display}
                        secondary={
                          <>
                            Date: {immunization.occurrenceDateTime ? format(parseISO(immunization.occurrenceDateTime), 'MM/dd/yyyy') : 'Unknown'}
                            {immunization.lotNumber && ` • Lot #: ${immunization.lotNumber}`}
                          </>
                        }
                      />
                    </ListItem>
                    {index < immunizations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              {immunizations.length === 0 && (
                <Alert severity="info">
                  No immunization records found
                </Alert>
              )}

              {immunizations.length > 5 && (
                <Box mt={2} textAlign="center">
                  <Button size="small">
                    View All {immunizations.length} Immunizations
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Social History */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Social History
              </Typography>
              
              <Grid container spacing={2}>
                {socialHistory.map((obs) => (
                  <Grid item xs={12} sm={6} md={4} key={obs.id}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {obs.code?.text || obs.code?.coding?.[0]?.display}
                      </Typography>
                      <Typography variant="body1">
                        {obs.valueString || obs.valueCodeableConcept?.text || 
                         `${obs.valueQuantity?.value} ${obs.valueQuantity?.unit}` || 'N/A'}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {socialHistory.length === 0 && (
                <Alert severity="info">
                  No social history recorded
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ChartReviewTab;