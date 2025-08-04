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
  alpha
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
  MenuBook as ReferenceIcon
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
  const [selectedCalculator, setSelectedCalculator] = useState('bmi');
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const [showReference, setShowReference] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    Cardiovascular: true,
    Renal: true,
    General: true
  });

  const calculatorsByCategory = getCalculatorsByCategory();

  const handleCalculatorSelect = (calculatorId) => {
    setSelectedCalculator(calculatorId);
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

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const calculator = ClinicalCalculators[selectedCalculator];

  return (
    <Paper sx={{ height: 600, display: 'flex' }}>
      {/* Calculator List Sidebar */}
      <Box
        sx={{
          width: 240,
          borderRight: 1,
          borderColor: 'divider',
          overflow: 'auto',
          bgcolor: alpha(theme.palette.background.default, 0.5)
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Clinical Calculators
          </Typography>
        </Box>
        <List dense>
          {Object.entries(calculatorsByCategory).map(([category, calculators]) => (
            <React.Fragment key={category}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => toggleCategory(category)} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {categoryIcons[category] || <CalculateIcon />}
                  </ListItemIcon>
                  <ListItemText primary={category} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                  {expandedCategories[category] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>
              <Collapse in={expandedCategories[category]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {calculators.map((calc) => (
                    <ListItem key={calc.id} sx={{ pl: 3 }} disablePadding>
                      <ListItemButton
                        selected={selectedCalculator === calc.id}
                        onClick={() => handleCalculatorSelect(calc.id)}
                        sx={{
                          py: 0.5,
                          borderRadius: 1,
                          '&.Mui-selected': {
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            '&:hover': {
                              bgcolor: 'primary.dark'
                            }
                          }
                        }}
                      >
                        <ListItemText
                          primary={calc.name}
                          primaryTypographyProps={{ fontSize: '0.813rem' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </React.Fragment>
          ))}
        </List>
      </Box>

      {/* Calculator Interface */}
      <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
        {calculator && (
          <>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {calculator.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calculator.description}
                </Typography>
              </Box>
              <Button
                startIcon={<ReferenceIcon />}
                size="small"
                onClick={() => setShowReference(!showReference)}
              >
                Quick Reference
              </Button>
            </Box>

            <Grid container spacing={2}>
              {/* Input Fields */}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Input Parameters
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {calculator.inputs.map((input) => (
                      <Box key={input.id} sx={{ mb: 2 }}>
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
                          <FormControl fullWidth>
                            <FormLabel>{input.label}</FormLabel>
                            <Select
                              value={inputs[input.id] || input.options[0]}
                              onChange={(e) => handleInputChange(input.id, e.target.value)}
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
                    sx={{ mt: 2 }}
                  >
                    Calculate
                  </Button>
                </Box>
              </Grid>

              {/* Results */}
              <Grid item xs={12} md={6}>
                {result && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Results
                    </Typography>
                    <Paper
                      sx={{
                        p: 3,
                        mt: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                      }}
                    >
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
                    </Paper>
                  </Box>
                )}
                
                {/* Clinical Note */}
                <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 3 }}>
                  <Typography variant="body2">
                    These calculators are for educational purposes and clinical decision support only. 
                    Always use clinical judgment and consider the full clinical context when making patient care decisions.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>

            {/* Quick Reference Section */}
            <Collapse in={showReference}>
              <Box mt={3}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
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
          </>
        )}
      </Box>
    </Paper>
  );
}

export default ClinicalCalculatorWidget;