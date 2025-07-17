/**
 * Optimized Chart Review Tab - Uses specialized hooks for efficient resource loading
 * This is an example of how to update clinical tabs to use the new performance optimizations
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useChartReviewResources } from '../../../../hooks/useClinicalResources';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import ResourceDataGrid from '../../../common/ResourceDataGrid';
import ConditionDialog from '../dialogs/ConditionDialog';
import MedicationDialog from '../dialogs/MedicationDialog';
import AllergyDialog from '../dialogs/AllergyDialog';
import ImmunizationDialog from '../dialogs/ImmunizationDialog';

const ChartReviewTabOptimized = ({ patient }) => {
  const { currentPatient } = useFHIRResource();
  const patientId = patient?.id || currentPatient?.id;
  
  // Use optimized hook for chart review resources
  const { 
    conditions, 
    medications, 
    allergies, 
    immunizations, 
    loading, 
    refresh 
  } = useChartReviewResources(patientId);
  
  // Dialog states
  const [openDialogs, setOpenDialogs] = useState({
    condition: false,
    medication: false,
    allergy: false,
    immunization: false
  });
  
  const [selectedResource, setSelectedResource] = useState(null);
  
  // Process data for display
  const activeConditions = useMemo(() => 
    conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active'),
    [conditions]
  );
  
  const inactiveConditions = useMemo(() => 
    conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code !== 'active'),
    [conditions]
  );
  
  const activeMedications = useMemo(() => 
    medications.filter(m => m.status === 'active' || m.status === 'on-hold'),
    [medications]
  );
  
  const inactiveMedications = useMemo(() => 
    medications.filter(m => m.status !== 'active' && m.status !== 'on-hold'),
    [medications]
  );
  
  // Handler functions
  const handleOpenDialog = (type, resource = null) => {
    setSelectedResource(resource);
    setOpenDialogs(prev => ({ ...prev, [type]: true }));
  };
  
  const handleCloseDialog = (type) => {
    setOpenDialogs(prev => ({ ...prev, [type]: false }));
    setSelectedResource(null);
  };
  
  const handleResourceSaved = async () => {
    // Refresh data after save
    await refresh();
  };
  
  if (loading && conditions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Header with refresh button */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Chart Review</Typography>
        <Tooltip title="Refresh chart data">
          <IconButton onClick={refresh} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Conditions Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Conditions</Typography>
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => handleOpenDialog('condition')}
            >
              Add Condition
            </Button>
          </Box>
          
          {activeConditions.length === 0 && inactiveConditions.length === 0 ? (
            <Alert severity="info">No conditions documented</Alert>
          ) : (
            <>
              {/* Active Conditions */}
              {activeConditions.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Active Conditions ({activeConditions.length})
                  </Typography>
                  <Stack spacing={1} mb={2}>
                    {activeConditions.slice(0, 10).map(condition => (
                      <ConditionCard
                        key={condition.id}
                        condition={condition}
                        onEdit={() => handleOpenDialog('condition', condition)}
                      />
                    ))}
                  </Stack>
                  {activeConditions.length > 10 && (
                    <Typography variant="caption" color="text.secondary">
                      +{activeConditions.length - 10} more active conditions
                    </Typography>
                  )}
                </>
              )}
              
              {/* Inactive Conditions */}
              {inactiveConditions.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Resolved/Inactive ({inactiveConditions.length})
                  </Typography>
                  <Stack spacing={1}>
                    {inactiveConditions.slice(0, 5).map(condition => (
                      <ConditionCard
                        key={condition.id}
                        condition={condition}
                        onEdit={() => handleOpenDialog('condition', condition)}
                        inactive
                      />
                    ))}
                  </Stack>
                  {inactiveConditions.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      +{inactiveConditions.length - 5} more resolved conditions
                    </Typography>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Medications Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Medications</Typography>
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => handleOpenDialog('medication')}
            >
              Add Medication
            </Button>
          </Box>
          
          {activeMedications.length === 0 && inactiveMedications.length === 0 ? (
            <Alert severity="info">No medications documented</Alert>
          ) : (
            <>
              {/* Active Medications */}
              {activeMedications.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Active Medications ({activeMedications.length})
                  </Typography>
                  <Stack spacing={1} mb={2}>
                    {activeMedications.slice(0, 10).map(medication => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        onEdit={() => handleOpenDialog('medication', medication)}
                      />
                    ))}
                  </Stack>
                  {activeMedications.length > 10 && (
                    <Typography variant="caption" color="text.secondary">
                      +{activeMedications.length - 10} more active medications
                    </Typography>
                  )}
                </>
              )}
              
              {/* Discontinued Medications */}
              {inactiveMedications.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Discontinued ({inactiveMedications.length})
                  </Typography>
                  <Stack spacing={1}>
                    {inactiveMedications.slice(0, 5).map(medication => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        onEdit={() => handleOpenDialog('medication', medication)}
                        inactive
                      />
                    ))}
                  </Stack>
                  {inactiveMedications.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      +{inactiveMedications.length - 5} more discontinued medications
                    </Typography>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Allergies Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Allergies & Intolerances</Typography>
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => handleOpenDialog('allergy')}
            >
              Add Allergy
            </Button>
          </Box>
          
          {allergies.length === 0 ? (
            <Alert severity="success">No known allergies</Alert>
          ) : (
            <Stack spacing={1}>
              {allergies.map(allergy => (
                <AllergyCard
                  key={allergy.id}
                  allergy={allergy}
                  onEdit={() => handleOpenDialog('allergy', allergy)}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
      
      {/* Immunizations Section */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Immunizations</Typography>
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => handleOpenDialog('immunization')}
            >
              Add Immunization
            </Button>
          </Box>
          
          {immunizations.length === 0 ? (
            <Alert severity="info">No immunizations documented</Alert>
          ) : (
            <Stack spacing={1}>
              {immunizations.slice(0, 10).map(immunization => (
                <ImmunizationCard
                  key={immunization.id}
                  immunization={immunization}
                  onEdit={() => handleOpenDialog('immunization', immunization)}
                />
              ))}
              {immunizations.length > 10 && (
                <Typography variant="caption" color="text.secondary">
                  +{immunizations.length - 10} more immunizations
                </Typography>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>
      
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
      
      <ImmunizationDialog
        open={openDialogs.immunization}
        onClose={() => handleCloseDialog('immunization')}
        immunization={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
    </Box>
  );
};

// Lightweight card components for display
const ConditionCard = ({ condition, onEdit, inactive = false }) => (
  <Box
    sx={{
      p: 1.5,
      border: 1,
      borderColor: inactive ? 'divider' : 'primary.light',
      borderRadius: 1,
      opacity: inactive ? 0.7 : 1,
      '&:hover': { bgcolor: 'action.hover' }
    }}
  >
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Box flex={1}>
        <Typography variant="body2" fontWeight={500}>
          {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Onset: {condition.onsetDateTime ? 
            format(new Date(condition.onsetDateTime), 'MMM d, yyyy') : 
            'Unknown'}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onEdit}>
        <EditIcon fontSize="small" />
      </IconButton>
    </Box>
  </Box>
);

const MedicationCard = ({ medication, onEdit, inactive = false }) => {
  const medicationDisplay = medication.medicationCodeableConcept?.text || 
                          medication.medicationCodeableConcept?.coding?.[0]?.display || 
                          'Unknown medication';
  
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: inactive ? 'divider' : 'success.light',
        borderRadius: 1,
        opacity: inactive ? 0.7 : 1,
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box flex={1}>
          <Typography variant="body2" fontWeight={500}>
            {medicationDisplay}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {medication.dosageInstruction?.[0]?.text || 'No dosage information'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip 
            label={medication.status} 
            size="small" 
            color={medication.status === 'active' ? 'success' : 'default'}
          />
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
};

const AllergyCard = ({ allergy, onEdit }) => {
  const severity = allergy.criticality || 'low';
  const severityColor = severity === 'high' ? 'error' : severity === 'low' ? 'success' : 'warning';
  
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: `${severityColor}.light`,
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            {severity === 'high' && <WarningIcon color="error" fontSize="small" />}
            <Typography variant="body2" fontWeight={500}>
              {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown allergen'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Type: {allergy.type || 'Unknown'} | Severity: {severity}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};

const ImmunizationCard = ({ immunization, onEdit }) => (
  <Box
    sx={{
      p: 1.5,
      border: 1,
      borderColor: 'info.light',
      borderRadius: 1,
      '&:hover': { bgcolor: 'action.hover' }
    }}
  >
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Box flex={1}>
        <Typography variant="body2" fontWeight={500}>
          {immunization.vaccineCode?.text || 
           immunization.vaccineCode?.coding?.[0]?.display || 
           'Unknown vaccine'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Date: {immunization.occurrenceDateTime ? 
            format(new Date(immunization.occurrenceDateTime), 'MMM d, yyyy') : 
            'Unknown'}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onEdit}>
        <EditIcon fontSize="small" />
      </IconButton>
    </Box>
  </Box>
);

export default ChartReviewTabOptimized;