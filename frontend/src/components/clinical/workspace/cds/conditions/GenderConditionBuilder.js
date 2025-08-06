/**
 * Gender Condition Builder Component
 * Visual interface for building gender-based conditions
 */
import React from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Stack,
  Alert,
  Chip,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox,
  FormGroup
} from '@mui/material';
import { 
  Info as InfoIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Transgender as OtherIcon
} from '@mui/icons-material';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male', icon: <MaleIcon />, color: '#1976d2' },
  { value: 'female', label: 'Female', icon: <FemaleIcon />, color: '#d32f2f' },
  { value: 'other', label: 'Other', icon: <OtherIcon />, color: '#9c27b0' },
  { value: 'unknown', label: 'Unknown', icon: null, color: '#757575' }
];

const GENDER_OPERATORS = [
  { value: 'equals', label: 'Is' },
  { value: 'not_equals', label: 'Is Not' },
  { value: 'in', label: 'Is One Of' },
  { value: 'not_in', label: 'Is Not One Of' }
];

const GenderConditionBuilder = ({ condition, onChange }) => {
  const handleFieldChange = (field, value) => {
    onChange({ [field]: value });
  };

  // Initialize default values
  React.useEffect(() => {
    if (!condition.operator) {
      onChange({
        operator: 'equals',
        value: '',
        values: []
      });
    }
  }, []);

  const isMultiSelect = condition.operator === 'in' || condition.operator === 'not_in';

  const handleMultiSelectChange = (gender) => {
    const currentValues = condition.values || [];
    const newValues = currentValues.includes(gender)
      ? currentValues.filter(v => v !== gender)
      : [...currentValues, gender];
    
    handleFieldChange('values', newValues);
  };

  const getConditionSummary = () => {
    const operator = GENDER_OPERATORS.find(op => op.value === condition.operator);
    
    if (isMultiSelect) {
      if (!condition.values || condition.values.length === 0) return null;
      const genderLabels = condition.values.map(v => 
        GENDER_OPTIONS.find(g => g.value === v)?.label || v
      ).join(', ');
      return `Gender ${operator?.label.toLowerCase()} ${genderLabels}`;
    } else {
      if (!condition.value) return null;
      const gender = GENDER_OPTIONS.find(g => g.value === condition.value);
      return `Gender ${operator?.label.toLowerCase()} ${gender?.label}`;
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Alert severity="info" icon={<InfoIcon />}>
          Define gender-based conditions for triggering this CDS hook. Gender is based on the patient's administrative gender in their FHIR resource.
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Gender Operator</InputLabel>
              <Select
                value={condition.operator || 'equals'}
                label="Gender Operator"
                onChange={(e) => handleFieldChange('operator', e.target.value)}
              >
                {GENDER_OPERATORS.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {!isMultiSelect ? (
            <Grid item xs={12} md={8}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={condition.value || ''}
                  label="Gender"
                  onChange={(e) => handleFieldChange('value', e.target.value)}
                >
                  {GENDER_OPTIONS.map(gender => (
                    <MenuItem key={gender.value} value={gender.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {gender.icon && (
                          <Box sx={{ color: gender.color, display: 'flex' }}>
                            {gender.icon}
                          </Box>
                        )}
                        <Typography>{gender.label}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ) : (
            <Grid item xs={12} md={8}>
              <Typography variant="body2" gutterBottom>
                Select Genders:
              </Typography>
              <FormGroup row>
                {GENDER_OPTIONS.map(gender => (
                  <FormControlLabel
                    key={gender.value}
                    control={
                      <Checkbox
                        checked={(condition.values || []).includes(gender.value)}
                        onChange={() => handleMultiSelectChange(gender.value)}
                        sx={{ color: gender.color, '&.Mui-checked': { color: gender.color } }}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {gender.icon && (
                          <Box sx={{ color: gender.color, display: 'flex', fontSize: '1.2rem' }}>
                            {gender.icon}
                          </Box>
                        )}
                        <Typography variant="body2">{gender.label}</Typography>
                      </Stack>
                    }
                  />
                ))}
              </FormGroup>
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

        {/* Gender-Specific Clinical Considerations */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Clinical Considerations by Gender
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="primary">
                    Male-Specific:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    • Prostate screening (PSA)
                    <br />
                    • Testicular exam reminders
                    <br />
                    • Male pattern baldness medications
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="error">
                    Female-Specific:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    • Mammography screening
                    <br />
                    • Pregnancy-related alerts
                    <br />
                    • Contraceptive considerations
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default GenderConditionBuilder;