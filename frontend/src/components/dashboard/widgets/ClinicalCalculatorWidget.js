/**
 * Clinical Calculator Widget
 * Interactive medical calculators for common clinical assessments
 */

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Alert,
  Collapse,
  IconButton,
  InputAdornment,
  useTheme,
  alpha,
  Card,
  CardContent,
  CardActionArea,
  Tabs,
  Tab,
  InputLabel
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Favorite as HeartIcon,
  LocalHospital as KidneyIcon,
  Psychology as BrainIcon,
  AirlineSeatFlat as LungIcon,
  ExpandMore,
  ExpandLess,
  Info as InfoIcon,
  MenuBook as ReferenceIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';

import { ClinicalCalculators, getCalculatorsByCategory } from '../../../services/dashboard/clinicalCalculators';

const categoryIcons = {
  Cardiovascular: <HeartIcon />,
  Renal: <KidneyIcon />,
  Respiratory: <LungIcon />,
  Hepatic: <BrainIcon />,
  General: <CalculateIcon />
};

function ClinicalCalculatorWidget() {
  const theme = useTheme();
  const [selectedCalculator, setSelectedCalculator] = useState(null);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const [showReference, setShowReference] = useState(false);
  const [showCalculatorList, setShowCalculatorList] = useState(true);

  const calculatorsByCategory = getCalculatorsByCategory();

  const handleCalculatorSelect = (calculatorId) => {
    setSelectedCalculator(calculatorId);
    setInputs({});
    setResult(null);
    setShowCalculatorList(false);
  };

  const handleBackToList = () => {
    setShowCalculatorList(true);
    setSelectedCalculator(null);
    setInputs({});
    setResult(null);
  };

  const handleInputChange = (inputId, value) => {
    setInputs(prev => ({
      ...prev,
      [inputId]: value
    }));
  };

  const handleCalculate = () => {
    const calculator = ClinicalCalculators[selectedCalculator];
    if (calculator) {
      const calculationResult = calculator.calculate(inputs);
      setResult(calculationResult);
    }
  };


  const calculator = selectedCalculator ? ClinicalCalculators[selectedCalculator] : null;

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* Calculator Selection View */}
      {showCalculatorList && (
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Select a Clinical Calculator
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Choose from our evidence-based clinical calculators to support your decision-making
          </Typography>
          
          {Object.entries(calculatorsByCategory).map(([category, calculators]) => (
            <Box key={category} sx={{ mb: 4 }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                {categoryIcons[category]}
                <Typography variant="h6" fontWeight="medium">
                  {category}
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {calculators.map((calc) => (
                  <Grid item xs={12} sm={6} md={4} key={calc.id}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4
                        }
                      }}
                    >
                      <CardActionArea onClick={() => handleCalculatorSelect(calc.id)} sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            {calc.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {calc.description}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      {/* Calculator Interface View */}
      {!showCalculatorList && calculator && (
        <Box sx={{ p: 3 }}>
          <>
            <Box mb={3}>
              <Button
                startIcon={<BackIcon />}
                onClick={handleBackToList}
                size="small"
                sx={{ mb: 2 }}
              >
                Back to Calculators
              </Button>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {calculator.name}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {calculator.description}
                  </Typography>
                </Box>
                <Button
                  startIcon={<ReferenceIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => setShowReference(!showReference)}
                >
                  Quick Reference
                </Button>
              </Box>
            </Box>

            <Grid container spacing={3}>
              {/* Input Fields */}
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Input Parameters
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Box>
                    {calculator.inputs.map((input) => (
                      <Box key={input.id} sx={{ mb: 3 }}>
                        {input.type === 'boolean' ? (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={inputs[input.id] || false}
                                onChange={(e) => handleInputChange(input.id, e.target.checked)}
                              />
                            }
                            label={input.label}
                          />
                        ) : input.type === 'number' ? (
                          <TextField
                            fullWidth
                            label={input.label}
                            type="number"
                            value={inputs[input.id] || ''}
                            onChange={(e) => handleInputChange(input.id, parseFloat(e.target.value))}
                            inputProps={{
                              min: input.min,
                              max: input.max,
                              step: input.step
                            }}
                            InputProps={
                              input.unit ? {
                                endAdornment: <InputAdornment position="end">{input.unit}</InputAdornment>
                              } : {}
                            }
                          />
                        ) : input.type === 'select' ? (
                          <FormControl fullWidth size="small">
                            <InputLabel>{input.label}</InputLabel>
                            <Select
                              value={inputs[input.id] || ''}
                              onChange={(e) => handleInputChange(input.id, e.target.value)}
                              label={input.label}
                            >
                              {input.options.map((option) => (
                                <MenuItem key={option} value={option}>
                                  {option}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleCalculate}
                    startIcon={<CalculateIcon />}
                    sx={{ mt: 3 }}
                    size="large"
                  >
                    Calculate
                  </Button>
                </Paper>
              </Grid>

              {/* Results */}
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Results
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  {result ? (
                    <>
                      {result.error ? (
                        <Alert severity="error">{result.error}</Alert>
                      ) : (
                        <>
                          {result.score !== undefined && (
                            <Box mb={2}>
                              <Typography variant="h3" color="primary" fontWeight="bold">
                                {result.score}
                              </Typography>
                              <Typography variant="subtitle2" color="text.secondary">
                                Score
                              </Typography>
                            </Box>
                          )}
                          
                          {result.bmi !== undefined && (
                            <Box mb={2}>
                              <Typography variant="h3" color="primary" fontWeight="bold">
                                {result.bmi} {result.units}
                              </Typography>
                              <Typography variant="subtitle2" color="text.secondary">
                                BMI
                              </Typography>
                            </Box>
                          )}
                          
                          {result.gfr !== undefined && (
                            <Box mb={2}>
                              <Typography variant="h3" color="primary" fontWeight="bold">
                                {result.gfr} {result.units}
                              </Typography>
                              <Typography variant="subtitle2" color="text.secondary">
                                eGFR
                              </Typography>
                            </Box>
                          )}
                          
                          {result.risk && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Risk Assessment
                              </Typography>
                              <Typography>{result.risk}</Typography>
                            </Box>
                          )}
                          
                          {result.category && (
                            <Box mb={2}>
                              <Chip
                                label={result.category}
                                color={
                                  result.category.includes('Normal') ? 'success' :
                                  result.category.includes('High') ? 'error' : 'warning'
                                }
                              />
                            </Box>
                          )}
                          
                          {result.stage && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Stage
                              </Typography>
                              <Chip label={`${result.stage}: ${result.description}`} />
                            </Box>
                          )}
                          
                          {result.recommendation && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                Recommendation
                              </Typography>
                              <Typography variant="body2">
                                {result.recommendation}
                              </Typography>
                            </Alert>
                          )}
                          
                          {result.mortality && (
                            <Box mt={2}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Mortality Risk
                              </Typography>
                              <Typography>{result.mortality}</Typography>
                            </Box>
                          )}
                          
                          {result.priority && (
                            <Box mt={2}>
                              <Alert severity={result.score >= 25 ? 'error' : 'warning'}>
                                {result.priority}
                              </Alert>
                            </Box>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CalculateIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                      <Typography color="text.secondary">
                        Enter values and click Calculate to see results
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>

            {/* Clinical Note */}
            <Grid item xs={12}>
              <Alert severity="info" icon={<InfoIcon />}>
                <Typography variant="body2">
                  These calculators are for educational purposes and clinical decision support only. 
                  Always use clinical judgment and consider the full clinical context when making patient care decisions.
                </Typography>
              </Alert>
            </Grid>

            {/* Quick Reference Section */}
            <Grid item xs={12}>
              <Collapse in={showReference}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Quick Reference Guides
                  </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Common Lab Values
                      </Typography>
                      <Typography variant="body2" component="div">
                        • Creatinine: 0.7-1.3 mg/dL<br />
                        • BUN: 7-20 mg/dL<br />
                        • Glucose: 70-100 mg/dL<br />
                        • Hemoglobin: M:13.5-17.5, F:12.0-15.5 g/dL
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Drug Dosing
                      </Typography>
                      <Typography variant="body2" component="div">
                        • Warfarin: Start 5-10mg daily<br />
                        • Apixaban: 5mg BID (reduce if criteria met)<br />
                        • Metformin: Start 500mg daily/BID<br />
                        • Always check renal function
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Clinical Guidelines
                      </Typography>
                      <Typography variant="body2" component="div">
                        • BP Goal: &lt;140/90 (most adults)<br />
                        • A1C Goal: &lt;7% (most adults)<br />
                        • LDL Goal: Variable by risk<br />
                        • Screen colonoscopy: Age 45+
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                </Box>
              </Collapse>
            </Grid>
          </Grid>
          </>
        </Box>
      )}
    </Box>
  );
}

export default ClinicalCalculatorWidget;