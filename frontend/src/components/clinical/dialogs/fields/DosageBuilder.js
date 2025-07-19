/**
 * DosageBuilder Component
 * Interactive dosage builder with calculations, common presets, and safety checks
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  ButtonGroup,
  Chip,
  Typography,
  Alert,
  AlertTitle,
  Divider,
  Stack,
  Paper,
  Tooltip,
  IconButton,
  Collapse,
  InputAdornment,
  useTheme,
  alpha
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Science as LabIcon
} from '@mui/icons-material';
import { dosageCalculator } from '../../../../services/dosageCalculatorService';
import { medicationService } from '../../../../services/medicationService';

// Common dosage frequencies
const FREQUENCIES = [
  { value: 'QD', label: 'Once daily', display: 'QD', timesPerDay: 1 },
  { value: 'BID', label: 'Twice daily', display: 'BID', timesPerDay: 2 },
  { value: 'TID', label: 'Three times daily', display: 'TID', timesPerDay: 3 },
  { value: 'QID', label: 'Four times daily', display: 'QID', timesPerDay: 4 },
  { value: 'Q4H', label: 'Every 4 hours', display: 'Q4H', timesPerDay: 6 },
  { value: 'Q6H', label: 'Every 6 hours', display: 'Q6H', timesPerDay: 4 },
  { value: 'Q8H', label: 'Every 8 hours', display: 'Q8H', timesPerDay: 3 },
  { value: 'Q12H', label: 'Every 12 hours', display: 'Q12H', timesPerDay: 2 },
  { value: 'PRN', label: 'As needed', display: 'PRN', timesPerDay: null },
  { value: 'AC', label: 'Before meals', display: 'AC', timesPerDay: 3 },
  { value: 'PC', label: 'After meals', display: 'PC', timesPerDay: 3 },
  { value: 'HS', label: 'At bedtime', display: 'HS', timesPerDay: 1 },
  { value: 'STAT', label: 'Immediately', display: 'STAT', timesPerDay: 1 }
];

// Common routes
const ROUTES = [
  { value: 'PO', label: 'By mouth', icon: '💊' },
  { value: 'IV', label: 'Intravenous', icon: '💉' },
  { value: 'IM', label: 'Intramuscular', icon: '💉' },
  { value: 'SC', label: 'Subcutaneous', icon: '💉' },
  { value: 'TOP', label: 'Topical', icon: '🧴' },
  { value: 'INH', label: 'Inhalation', icon: '🫁' },
  { value: 'PR', label: 'Per rectum', icon: '🔵' },
  { value: 'SL', label: 'Sublingual', icon: '👅' }
];

// Duration units
const DURATION_UNITS = [
  { value: 'd', label: 'days' },
  { value: 'wk', label: 'weeks' },
  { value: 'mo', label: 'months' }
];

const DosageBuilder = ({
  medication,
  patientWeight,
  patientAge,
  patientConditions = [],
  currentMedications = [],
  recentLabs = {},
  value = {},
  onChange,
  showCalculator = true,
  showCommonDosages = true,
  checkInteractions = true,
  required = false,
  disabled = false
}) => {
  const theme = useTheme();
  const [dosage, setDosage] = useState({
    dose: '',
    unit: 'mg',
    frequency: 'BID',
    route: 'PO',
    duration: '',
    durationUnit: 'd',
    instructions: '',
    asNeeded: false,
    asNeededReason: '',
    ...value
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCalculatorPanel, setShowCalculatorPanel] = useState(false);
  const [calculatedDose, setCalculatedDose] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [commonDosages, setCommonDosages] = useState([]);

  // Load common dosages for medication
  useEffect(() => {
    if (medication && showCommonDosages) {
      loadCommonDosages();
    }
  }, [medication, showCommonDosages]);

  // Check for warnings
  useEffect(() => {
    if (checkInteractions && dosage.dose) {
      checkDosageWarnings();
    }
  }, [dosage, checkInteractions]);

  const loadCommonDosages = async () => {
    try {
      const dosages = await medicationService.getCommonDosages(medication.id, {
        patientAge,
        conditions: patientConditions
      });
      setCommonDosages(dosages);
    } catch (error) {
      console.error('Failed to load common dosages:', error);
    }
  };

  const checkDosageWarnings = async () => {
    const newWarnings = [];

    // Check dose range
    if (medication.dosageRange) {
      const dose = parseFloat(dosage.dose);
      if (dose < medication.dosageRange.min) {
        newWarnings.push({
          type: 'dose',
          severity: 'warning',
          message: `Dose below usual range (${medication.dosageRange.min}-${medication.dosageRange.max} ${dosage.unit})`
        });
      } else if (dose > medication.dosageRange.max) {
        newWarnings.push({
          type: 'dose',
          severity: 'error',
          message: `Dose exceeds maximum (${medication.dosageRange.max} ${dosage.unit})`
        });
      }
    }

    // Check renal dosing if applicable
    if (recentLabs.creatinine && medication.renalAdjustment) {
      const eGFR = calculateEGFR(recentLabs.creatinine, patientAge, patientWeight);
      if (eGFR < 60) {
        newWarnings.push({
          type: 'renal',
          severity: 'warning',
          message: `Consider dose adjustment for eGFR ${eGFR} mL/min`
        });
      }
    }

    // Check hepatic dosing if applicable
    if ((recentLabs.alt || recentLabs.ast) && medication.hepaticAdjustment) {
      if (recentLabs.alt > 100 || recentLabs.ast > 100) {
        newWarnings.push({
          type: 'hepatic',
          severity: 'warning',
          message: 'Consider dose adjustment for elevated liver enzymes'
        });
      }
    }

    setWarnings(newWarnings);
  };

  const calculateEGFR = (creatinine, age, weight) => {
    // Simplified CKD-EPI equation
    return Math.round(175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203) * 0.742);
  };

  const handleCalculateDose = () => {
    if (!patientWeight) {
      setCalculatedDose({ error: 'Patient weight required for calculation' });
      return;
    }

    const result = dosageCalculator.calculate({
      medication,
      weight: patientWeight,
      age: patientAge,
      indication: patientConditions[0], // Primary condition
      renalFunction: recentLabs.creatinine ? calculateEGFR(recentLabs.creatinine, patientAge, patientWeight) : null
    });

    setCalculatedDose(result);
    if (result.dose) {
      updateDosage({ dose: result.dose.toString(), unit: result.unit });
    }
  };

  const handlePresetClick = (preset) => {
    updateDosage({
      dose: preset.dose,
      unit: preset.unit,
      frequency: preset.frequency,
      route: preset.route,
      duration: preset.duration,
      durationUnit: preset.durationUnit,
      instructions: preset.instructions
    });
  };

  const updateDosage = (updates) => {
    const newDosage = { ...dosage, ...updates };
    setDosage(newDosage);
    onChange?.(newDosage);
  };

  const getDosageDisplay = () => {
    if (!dosage.dose) return 'Not specified';
    
    const freq = FREQUENCIES.find(f => f.value === dosage.frequency);
    const route = ROUTES.find(r => r.value === dosage.route);
    
    let display = `${dosage.dose} ${dosage.unit} ${route?.label || dosage.route} ${freq?.display || dosage.frequency}`;
    
    if (dosage.duration) {
      display += ` for ${dosage.duration} ${dosage.durationUnit}`;
    }
    
    if (dosage.asNeeded) {
      display += ` PRN${dosage.asNeededReason ? ` for ${dosage.asNeededReason}` : ''}`;
    }
    
    return display;
  };

  return (
    <Box>
      {/* Common dosages */}
      {showCommonDosages && commonDosages.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Common Dosages
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {commonDosages.map((preset, index) => (
              <Chip
                key={index}
                label={`${preset.dose} ${preset.unit} ${preset.frequency}`}
                onClick={() => handlePresetClick(preset)}
                variant={
                  dosage.dose === preset.dose && 
                  dosage.frequency === preset.frequency 
                    ? 'filled' 
                    : 'outlined'
                }
                size="small"
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Main dosage form */}
      <Grid container spacing={2}>
        {/* Dose */}
        <Grid item xs={12} sm={4}>
          <TextField
            label="Dose"
            value={dosage.dose}
            onChange={(e) => updateDosage({ dose: e.target.value })}
            fullWidth
            required={required}
            disabled={disabled}
            type="number"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Select
                    value={dosage.unit}
                    onChange={(e) => updateDosage({ unit: e.target.value })}
                    variant="standard"
                    disabled={disabled}
                  >
                    <MenuItem value="mg">mg</MenuItem>
                    <MenuItem value="g">g</MenuItem>
                    <MenuItem value="mcg">mcg</MenuItem>
                    <MenuItem value="mL">mL</MenuItem>
                    <MenuItem value="units">units</MenuItem>
                    <MenuItem value="tablets">tablets</MenuItem>
                  </Select>
                </InputAdornment>
              )
            }}
          />
        </Grid>

        {/* Route */}
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth required={required} disabled={disabled}>
            <InputLabel>Route</InputLabel>
            <Select
              value={dosage.route}
              onChange={(e) => updateDosage({ route: e.target.value })}
              label="Route"
            >
              {ROUTES.map(route => (
                <MenuItem key={route.value} value={route.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{route.icon}</span>
                    {route.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Frequency */}
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth required={required} disabled={disabled}>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={dosage.frequency}
              onChange={(e) => updateDosage({ frequency: e.target.value })}
              label="Frequency"
            >
              {FREQUENCIES.map(freq => (
                <MenuItem key={freq.value} value={freq.value}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>{freq.label}</span>
                    <Typography variant="caption" color="text.secondary">
                      {freq.display}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Duration */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Duration"
            value={dosage.duration}
            onChange={(e) => updateDosage({ duration: e.target.value })}
            fullWidth
            disabled={disabled}
            type="number"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Select
                    value={dosage.durationUnit}
                    onChange={(e) => updateDosage({ durationUnit: e.target.value })}
                    variant="standard"
                    disabled={disabled}
                  >
                    {DURATION_UNITS.map(unit => (
                      <MenuItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </MenuItem>
                    ))}
                  </Select>
                </InputAdornment>
              )
            }}
          />
        </Grid>

        {/* Instructions */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Additional Instructions"
            value={dosage.instructions}
            onChange={(e) => updateDosage({ instructions: e.target.value })}
            fullWidth
            disabled={disabled}
            placeholder="e.g., Take with food"
          />
        </Grid>
      </Grid>

      {/* Calculator */}
      {showCalculator && (
        <Box sx={{ mt: 2 }}>
          <Button
            startIcon={<CalculateIcon />}
            onClick={() => setShowCalculatorPanel(!showCalculatorPanel)}
            size="small"
          >
            Dose Calculator
          </Button>

          <Collapse in={showCalculatorPanel}>
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                border: 1,
                borderColor: 'divider'
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Weight-Based Dosing
              </Typography>
              
              {patientWeight ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Patient weight: {patientWeight} kg
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleCalculateDose}
                    startIcon={<CalculateIcon />}
                  >
                    Calculate Dose
                  </Button>
                  
                  {calculatedDose && (
                    <Alert 
                      severity={calculatedDose.error ? 'error' : 'info'}
                      sx={{ mt: 2 }}
                    >
                      {calculatedDose.error || (
                        <>
                          Recommended dose: <strong>{calculatedDose.dose} {calculatedDose.unit}</strong>
                          {calculatedDose.range && (
                            <Typography variant="caption" display="block">
                              Range: {calculatedDose.range.min}-{calculatedDose.range.max} {calculatedDose.unit}
                            </Typography>
                          )}
                        </>
                      )}
                    </Alert>
                  )}
                </Box>
              ) : (
                <Alert severity="warning">
                  Patient weight required for dose calculation
                </Alert>
              )}
            </Paper>
          </Collapse>
        </Box>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {warnings.map((warning, index) => (
            <Alert 
              key={index}
              severity={warning.severity}
              sx={{ mb: 1 }}
              icon={warning.type === 'renal' ? <LabIcon /> : <WarningIcon />}
            >
              {warning.message}
            </Alert>
          ))}
        </Box>
      )}

      {/* Display */}
      <Paper
        elevation={0}
        sx={{
          mt: 2,
          p: 2,
          backgroundColor: alpha(theme.palette.success.main, 0.04),
          border: 1,
          borderColor: 'success.main'
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Dosage Instructions
        </Typography>
        <Typography variant="body1">
          {getDosageDisplay()}
        </Typography>
      </Paper>
    </Box>
  );
};

export default DosageBuilder;