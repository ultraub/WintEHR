/**
 * Medication Condition Builder Component
 * Visual interface for building medication-based conditions
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Stack,
  Alert,
  Chip,
  Autocomplete,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import { 
  Info as InfoIcon,
  Medication as MedicationIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { cdsClinicalDataService } from '../../../../../services/cdsClinicalDataService';
import { debounce } from 'lodash';

const MEDICATION_OPERATORS = [
  { value: 'taking', label: 'Is Taking', description: 'Patient has active prescription' },
  { value: 'not_taking', label: 'Is Not Taking', description: 'Patient does not have active prescription' },
  { value: 'taking_any', label: 'Is Taking Any Of', description: 'Patient takes at least one medication from list' },
  { value: 'taking_all', label: 'Is Taking All Of', description: 'Patient takes all medications from list' },
  { value: 'taking_class', label: 'Is Taking Drug Class', description: 'Patient takes any drug in class' },
  { value: 'contraindicated', label: 'Has Contraindication', description: 'Medication is contraindicated' }
];

const COMMON_DRUG_CLASSES = [
  { code: 'C0003232', display: 'Antibiotics' },
  { code: 'C0003364', display: 'Antihypertensive Agents' },
  { code: 'C0003367', display: 'Antipsychotic Agents' },
  { code: 'C0013227', display: 'Pharmaceutical Preparations' },
  { code: 'C0002771', display: 'Analgesics' },
  { code: 'C0001645', display: 'Beta Blockers' },
  { code: 'C0003015', display: 'ACE Inhibitors' },
  { code: 'C0360714', display: 'HMG-CoA Reductase Inhibitors (Statins)' },
  { code: 'C0304351', display: 'Proton Pump Inhibitors' },
  { code: 'C0013162', display: 'Diuretics' }
];

const MedicationConditionBuilder = ({ condition, onChange }) => {
  const [medicationOptions, setMedicationOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize default values
  useEffect(() => {
    if (!condition.operator) {
      onChange({
        operator: 'taking',
        medication: null,
        medications: [],
        drugClass: null
      });
    }
  }, []);

  // Search for medications
  const searchMedications = debounce(async (query) => {
    if (!query || query.length < 2) {
      setMedicationOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await cdsClinicalDataService.getDynamicMedicationCatalog(query, 20);
      setMedicationOptions(results.map(med => ({
        code: med.code,
        display: med.display,
        system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
        frequency: med.frequency_count
      })));
    } catch (error) {
      setMedicationOptions([]);
    } finally {
      setSearchLoading(false);
    }
  }, 300);

  useEffect(() => {
    searchMedications(searchTerm);
  }, [searchTerm]);

  const handleFieldChange = (field, value) => {
    onChange({ [field]: value });
  };

  const addMedication = (medication) => {
    if (!medication) return;
    const currentMeds = condition.medications || [];
    if (!currentMeds.find(m => m.code === medication.code)) {
      handleFieldChange('medications', [...currentMeds, medication]);
    }
  };

  const removeMedication = (index) => {
    const currentMeds = condition.medications || [];
    handleFieldChange('medications', currentMeds.filter((_, i) => i !== index));
  };

  const isMultiMedication = ['taking_any', 'taking_all'].includes(condition.operator);
  const isDrugClass = condition.operator === 'taking_class';
  const isContraindicated = condition.operator === 'contraindicated';

  const getConditionSummary = () => {
    const operator = MEDICATION_OPERATORS.find(op => op.value === condition.operator);
    
    if (isMultiMedication) {
      if (!condition.medications || condition.medications.length === 0) return null;
      const medNames = condition.medications.map(m => m.display).join(', ');
      return `Patient ${operator?.label.toLowerCase()} ${medNames}`;
    } else if (isDrugClass) {
      if (!condition.drugClass) return null;
      return `Patient ${operator?.label.toLowerCase()} ${condition.drugClass.display}`;
    } else {
      if (!condition.medication) return null;
      return `Patient ${operator?.label.toLowerCase()} ${condition.medication.display}`;
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Alert severity="info" icon={<InfoIcon />}>
          Define medication-based conditions using active prescriptions from the patient's medication list.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Medication Condition</InputLabel>
              <Select
                value={condition.operator || 'taking'}
                label="Medication Condition"
                onChange={(e) => handleFieldChange('operator', e.target.value)}
              >
                {MEDICATION_OPERATORS.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    <Stack>
                      <Typography variant="body1">{op.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {op.description}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Single Medication Selection */}
          {!isMultiMedication && !isDrugClass && (
            <Grid item xs={12}>
              <Autocomplete
                options={medicationOptions}
                getOptionLabel={(option) => option.display || ''}
                value={condition.medication || null}
                onChange={(e, value) => handleFieldChange('medication', value)}
                onInputChange={(e, value) => setSearchTerm(value)}
                loading={searchLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Medication"
                    placeholder="Type to search medications..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Stack sx={{ width: '100%' }}>
                      <Typography variant="body2">{option.display}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          RxNorm: {option.code}
                        </Typography>
                        {option.frequency > 0 && (
                          <Chip 
                            label={`${option.frequency} patients`} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                )}
              />
            </Grid>
          )}

          {/* Multiple Medication Selection */}
          {isMultiMedication && (
            <Grid item xs={12}>
              <Stack spacing={2}>
                <Autocomplete
                  options={medicationOptions}
                  getOptionLabel={(option) => option.display || ''}
                  value={null}
                  onChange={(e, value) => {
                    if (value) addMedication(value);
                  }}
                  onInputChange={(e, value) => setSearchTerm(value)}
                  loading={searchLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Add Medications"
                      placeholder="Search and add medications..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                
                {condition.medications && condition.medications.length > 0 && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Selected Medications ({condition.medications.length})
                      </Typography>
                      <List dense>
                        {condition.medications.map((med, index) => (
                          <ListItem 
                            key={index}
                            secondaryAction={
                              <IconButton edge="end" onClick={() => removeMedication(index)}>
                                <DeleteIcon />
                              </IconButton>
                            }
                          >
                            <ListItemIcon>
                              <MedicationIcon />
                            </ListItemIcon>
                            <ListItemText 
                              primary={med.display}
                              secondary={`RxNorm: ${med.code}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </Grid>
          )}

          {/* Drug Class Selection */}
          {isDrugClass && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Drug Class</InputLabel>
                <Select
                  value={condition.drugClass?.code || ''}
                  label="Drug Class"
                  onChange={(e) => {
                    const drugClass = COMMON_DRUG_CLASSES.find(dc => dc.code === e.target.value);
                    handleFieldChange('drugClass', drugClass);
                  }}
                >
                  {COMMON_DRUG_CLASSES.map(drugClass => (
                    <MenuItem key={drugClass.code} value={drugClass.code}>
                      {drugClass.display}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        {/* Condition Summary */}
        {getConditionSummary() && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Condition Summary:
            </Typography>
            <Chip 
              label={getConditionSummary()} 
              color="primary" 
              variant="outlined"
              size="small"
              sx={{ ml: 1 }}
            />
          </Box>
        )}

        {/* Contraindication Warning */}
        {isContraindicated && (
          <Alert severity="warning" icon={<WarningIcon />}>
            This condition will check for contraindications based on the patient's allergies, 
            conditions, and other medications. The CDS service must implement the contraindication logic.
          </Alert>
        )}
      </Stack>
    </Box>
  );
};

export default MedicationConditionBuilder;