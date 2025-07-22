/**
 * Chart Review Tab - Split Layout
 * Clean professional medical UI with split view for problems and medications
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha
} from '@mui/material';
import {
  Warning as WarningIcon,
  LocalHospital as ConditionIcon,
  Medication as MedicationIcon,
  Vaccines as VaccinesIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  FiberManualRecord as DotIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import useChartReviewResources from '../../../../hooks/useChartReviewResources';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import ConditionDialog from '../dialogs/ConditionDialog';
import MedicationDialog from '../dialogs/MedicationDialog';
import AllergyDialog from '../dialogs/AllergyDialog';
import StatusChip from '../../common/StatusChip';
import ClinicalCard from '../../common/ClinicalCard';

const ChartReviewTabSplitLayout = ({ patient }) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const patientId = patient?.id || currentPatient?.id;
  
  // Use optimized hook for chart review resources
  const { 
    conditions, 
    medications, 
    allergies, 
    immunizations,
    loading, 
    error,
    refresh,
    stats
  } = useChartReviewResources(patientId, {
    includeInactive: false,
    realTimeUpdates: true
  });
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [openDialogs, setOpenDialogs] = useState({
    condition: false,
    medication: false,
    allergy: false
  });
  const [selectedResource, setSelectedResource] = useState(null);
  
  // Filter data
  const filteredConditions = useMemo(() => {
    let filtered = conditions;
    
    if (filterStatus === 'active') {
      filtered = filtered.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active');
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(c => c.clinicalStatus?.coding?.[0]?.code !== 'active');
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const display = c.code?.text || c.code?.coding?.[0]?.display || '';
        return display.toLowerCase().includes(query);
      });
    }
    
    return filtered;
  }, [conditions, filterStatus, searchQuery]);
  
  const filteredMedications = useMemo(() => {
    let filtered = medications;
    
    if (filterStatus === 'active') {
      filtered = filtered.filter(m => ['active', 'on-hold'].includes(m.status));
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(m => !['active', 'on-hold'].includes(m.status));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => {
        const display = m.medicationCodeableConcept?.text || 
                        m.medicationCodeableConcept?.coding?.[0]?.display || '';
        return display.toLowerCase().includes(query);
      });
    }
    
    return filtered;
  }, [medications, filterStatus, searchQuery]);
  
  // Handlers
  const handleOpenDialog = (type, resource = null) => {
    setSelectedResource(resource);
    setOpenDialogs(prev => ({ ...prev, [type]: true }));
  };
  
  const handleCloseDialog = (type) => {
    setOpenDialogs(prev => ({ ...prev, [type]: false }));
    setSelectedResource(null);
  };
  
  const handleResourceSaved = () => {
    refresh();
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Error loading chart data: {error.message}</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Controls */}
      <Box sx={{ p: 2, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search conditions, medications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: '#FFFFFF',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '4px'
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <ToggleButtonGroup
                value={filterStatus}
                exclusive
                onChange={(e, value) => value && setFilterStatus(value)}
                size="small"
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="active">Active</ToggleButton>
                <ToggleButton value="inactive">Inactive</ToggleButton>
              </ToggleButtonGroup>
              <IconButton onClick={refresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </Box>
      
      {/* Main Content - Split View */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Grid container spacing={2}>
          {/* Left Column - Problems */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              height: '400px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              borderRadius: '4px'
            }}>
              <CardHeader
                title="Problem List"
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                action={
                  <Button
                    startIcon={<AddIcon />}
                    size="small"
                    onClick={() => handleOpenDialog('condition')}
                  >
                    Add
                  </Button>
                }
                sx={{
                  borderBottom: '1px solid #E5E7EB',
                  backgroundColor: '#FAFBFC',
                  py: 1.5
                }}
              />
              <CardContent sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                {filteredConditions.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No problems found
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {filteredConditions.map((condition, index) => (
                      <ListItem
                        key={condition.id}
                        sx={{
                          borderBottom: '1px solid #E5E7EB',
                          '&:hover': {
                            backgroundColor: alpha('#2979FF', 0.04)
                          }
                        }}
                        secondaryAction={
                          <IconButton 
                            edge="end" 
                            size="small"
                            onClick={() => handleOpenDialog('condition', condition)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ConditionIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" fontWeight={500}>
                                {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
                              </Typography>
                              <StatusChip
                                status={condition.clinicalStatus?.coding?.[0]?.code || 'unknown'}
                                size="small"
                              />
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={2}>
                              {condition.onsetDateTime && (
                                <Typography variant="caption" color="text.secondary">
                                  Onset: {format(new Date(condition.onsetDateTime), 'MMM yyyy')}
                                </Typography>
                              )}
                              {condition.severity && (
                                <Typography variant="caption" color="text.secondary">
                                  Severity: {condition.severity.coding?.[0]?.display || condition.severity.text}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Right Column - Medications */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              height: '400px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              borderRadius: '4px'
            }}>
              <CardHeader
                title="Medications"
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                action={
                  <Button
                    startIcon={<AddIcon />}
                    size="small"
                    onClick={() => handleOpenDialog('medication')}
                  >
                    Add
                  </Button>
                }
                sx={{
                  borderBottom: '1px solid #E5E7EB',
                  backgroundColor: '#FAFBFC',
                  py: 1.5
                }}
              />
              <CardContent sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                {filteredMedications.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No medications found
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {filteredMedications.map((medication, index) => (
                      <ListItem
                        key={medication.id}
                        sx={{
                          borderBottom: '1px solid #E5E7EB',
                          '&:hover': {
                            backgroundColor: alpha('#2979FF', 0.04)
                          }
                        }}
                        secondaryAction={
                          <IconButton 
                            edge="end" 
                            size="small"
                            onClick={() => handleOpenDialog('medication', medication)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <MedicationIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" fontWeight={500}>
                                {medication.medicationCodeableConcept?.text || 
                                 medication.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown'}
                              </Typography>
                              <StatusChip
                                status={medication.status}
                                size="small"
                              />
                            </Stack>
                          }
                          secondary={
                            <Stack spacing={0.5}>
                              {medication.dosageInstruction?.[0] && (
                                <Typography variant="caption" color="text.secondary">
                                  {medication.dosageInstruction[0].text || 
                                   `${medication.dosageInstruction[0].doseAndRate?.[0]?.doseQuantity?.value} ${medication.dosageInstruction[0].doseAndRate?.[0]?.doseQuantity?.unit}`}
                                </Typography>
                              )}
                              {medication.authoredOn && (
                                <Typography variant="caption" color="text.secondary">
                                  Started: {format(new Date(medication.authoredOn), 'MMM d, yyyy')}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Bottom Section - Allergies */}
          <Grid item xs={12}>
            <ClinicalCard
              title="Allergies & Intolerances"
              severity={allergies.some(a => a.criticality === 'high') ? 'warning' : 'normal'}
              actions={[
                {
                  label: 'Add Allergy',
                  onClick: () => handleOpenDialog('allergy')
                }
              ]}
              sx={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              {allergies.length === 0 ? (
                <Alert severity="success" sx={{ borderRadius: '4px' }}>
                  No known allergies
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {allergies.map((allergy) => (
                    <Grid item xs={12} sm={6} md={4} key={allergy.id}>
                      <Box
                        sx={{
                          p: 2,
                          border: '1px solid',
                          borderColor: allergy.criticality === 'high' ? 'error.main' : 'divider',
                          borderRadius: '4px',
                          backgroundColor: allergy.criticality === 'high' ? 
                            alpha(theme.palette.error.main, 0.04) : 'transparent',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.action.hover, 0.04),
                            cursor: 'pointer'
                          }
                        }}
                        onClick={() => handleOpenDialog('allergy', allergy)}
                      >
                        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                          {allergy.criticality === 'high' && (
                            <WarningIcon color="error" fontSize="small" />
                          )}
                          <Typography variant="body2" fontWeight={600}>
                            {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'}
                          </Typography>
                          <Chip 
                            label={allergy.criticality || 'low'} 
                            size="small"
                            color={allergy.criticality === 'high' ? 'error' : 'default'}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Type: {allergy.type || 'Unknown'} | Category: {allergy.category?.[0] || 'Unknown'}
                        </Typography>
                        {allergy.reaction?.[0]?.manifestation && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Reactions: {allergy.reaction[0].manifestation.map(m => 
                              m.text || m.coding?.[0]?.display
                            ).join(', ')}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </ClinicalCard>
          </Grid>
          
          {/* Bottom Section - Immunizations */}
          <Grid item xs={12}>
            <ClinicalCard
              title="Immunizations"
              icon={<VaccinesIcon />}
              sx={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              {immunizations.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No immunization records found
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {immunizations.slice(0, 6).map((immunization) => (
                    <Grid item xs={12} sm={6} md={4} key={immunization.id}>
                      <Box
                        sx={{
                          p: 2,
                          border: '1px solid #E5E7EB',
                          borderRadius: '4px',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.action.hover, 0.04)
                          }
                        }}
                      >
                        <Typography variant="body2" fontWeight={500}>
                          {immunization.vaccineCode?.text || 
                           immunization.vaccineCode?.coding?.[0]?.display || 'Unknown vaccine'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {immunization.occurrenceDateTime && 
                            format(new Date(immunization.occurrenceDateTime), 'MMM d, yyyy')}
                        </Typography>
                        {immunization.status && (
                          <Chip 
                            label={immunization.status} 
                            size="small" 
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </ClinicalCard>
          </Grid>
        </Grid>
      </Box>
      
      {/* Dialogs */}
      <ConditionDialog
        open={openDialogs.condition}
        onClose={() => handleCloseDialog('condition')}
        condition={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
      
      <MedicationDialog
        open={openDialogs.medication}
        onClose={() => handleCloseDialog('medication')}
        medication={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
      
      <AllergyDialog
        open={openDialogs.allergy}
        onClose={() => handleCloseDialog('allergy')}
        allergy={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
    </Box>
  );
};

export default ChartReviewTabSplitLayout;