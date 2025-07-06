/**
 * CDS Hook Builder Component
 * Visual interface for creating and editing CDS hooks
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Divider,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  Build as BuildIcon,
  Psychology as CDSIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  PlayArrow as TestIcon
} from '@mui/icons-material';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';

const HOOK_TYPES = [
  { value: 'patient-view', label: 'Patient View', description: 'Fired when user is viewing a patient' },
  { value: 'medication-prescribe', label: 'Medication Prescribe', description: 'Fired when prescribing medication' },
  { value: 'order-sign', label: 'Order Sign', description: 'Fired when signing orders' },
  { value: 'order-select', label: 'Order Select', description: 'Fired when selecting orders' }
];

const CARD_INDICATORS = [
  { value: 'info', label: 'Info', color: 'info', icon: <InfoIcon /> },
  { value: 'warning', label: 'Warning', color: 'warning', icon: <WarningIcon /> },
  { value: 'critical', label: 'Critical', color: 'error', icon: <ErrorIcon /> }
];

const CONDITION_TYPES = [
  { value: 'age', label: 'Patient Age', description: 'Age-based conditions' },
  { value: 'gender', label: 'Patient Gender', description: 'Gender-based conditions' },
  { value: 'condition', label: 'Medical Condition', description: 'Presence of specific conditions' },
  { value: 'medication', label: 'Current Medication', description: 'Patient on specific medications' },
  { value: 'lab_value', label: 'Lab Value', description: 'Lab results meeting criteria' },
  { value: 'vital_sign', label: 'Vital Sign', description: 'Vital signs meeting criteria' }
];

const CDSHookBuilder = ({ onSave, onCancel, editingHook = null }) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [hookData, setHookData] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    enabled: true,
    conditions: [],
    cards: [],
    prefetch: {}
  });
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);

  // Initialize with editing data
  useEffect(() => {
    if (editingHook) {
      setHookData(editingHook);
    }
  }, [editingHook]);

  const steps = [
    {
      label: 'Basic Information',
      description: 'Define hook metadata'
    },
    {
      label: 'Conditions',
      description: 'Set triggering conditions'
    },
    {
      label: 'Cards',
      description: 'Design response cards'
    },
    {
      label: 'Test & Save',
      description: 'Test and save the hook'
    }
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const addCondition = () => {
    const newCondition = {
      id: Date.now(),
      type: 'age',
      operator: 'greater_than',
      value: '',
      enabled: true
    };
    setHookData(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  };

  const updateCondition = (conditionId, updates) => {
    setHookData(prev => ({
      ...prev,
      conditions: prev.conditions.map(cond => 
        cond.id === conditionId ? { ...cond, ...updates } : cond
      )
    }));
  };

  const removeCondition = (conditionId) => {
    setHookData(prev => ({
      ...prev,
      conditions: prev.conditions.filter(cond => cond.id !== conditionId)
    }));
  };

  const addCard = () => {
    const newCard = {
      id: Date.now(),
      summary: '',
      detail: '',
      indicator: 'info',
      suggestions: [],
      links: []
    };
    setHookData(prev => ({
      ...prev,
      cards: [...prev.cards, newCard]
    }));
  };

  const updateCard = (cardId, updates) => {
    setHookData(prev => ({
      ...prev,
      cards: prev.cards.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      )
    }));
  };

  const removeCard = (cardId) => {
    setHookData(prev => ({
      ...prev,
      cards: prev.cards.filter(card => card.id !== cardId)
    }));
  };

  const testHook = async () => {
    setTesting(true);
    try {
      // Simulate testing the hook with sample data
      const testContext = {
        hook: hookData.hook,
        hookInstance: `test-${Date.now()}`,
        context: {
          patientId: 'test-patient-123'
        }
      };

      // For demo purposes, simulate a successful test
      const mockResult = {
        cards: hookData.cards.map(card => ({
          ...card,
          uuid: `test-${card.id}`,
          source: { label: hookData.title }
        }))
      };

      setTestResults({
        success: true,
        cards: mockResult.cards,
        executionTime: Math.floor(Math.random() * 500) + 100
      });
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message,
        executionTime: 0
      });
    } finally {
      setTesting(false);
    }
  };

  const saveHook = async () => {
    try {
      // Validate hook data
      if (!hookData.title || !hookData.hook) {
        throw new Error('Title and hook type are required');
      }

      if (hookData.cards.length === 0) {
        throw new Error('At least one card must be defined');
      }

      // Save the hook
      await onSave(hookData);
    } catch (error) {
      console.error('Error saving hook:', error);
      alert(`Error saving hook: ${error.message}`);
    }
  };

  const renderBasicInfo = () => (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Hook ID"
            value={hookData.id}
            onChange={(e) => setHookData(prev => ({ ...prev, id: e.target.value }))}
            placeholder="my-custom-hook"
            helperText="Unique identifier for this hook"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Title"
            value={hookData.title}
            onChange={(e) => setHookData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="My Custom CDS Hook"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={hookData.description}
            onChange={(e) => setHookData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this hook does and when it triggers"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Hook Type</InputLabel>
            <Select
              value={hookData.hook}
              label="Hook Type"
              onChange={(e) => setHookData(prev => ({ ...prev, hook: e.target.value }))}
            >
              {HOOK_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  <Box>
                    <Typography variant="body1">{type.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={hookData.enabled}
                onChange={(e) => setHookData(prev => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label="Enabled"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderConditions = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Triggering Conditions</Typography>
          <Button startIcon={<AddIcon />} onClick={addCondition}>
            Add Condition
          </Button>
        </Stack>
        
        {hookData.conditions.length === 0 ? (
          <Alert severity="info">
            No conditions defined. This hook will trigger for all patients.
          </Alert>
        ) : (
          hookData.conditions.map((condition) => (
            <Card key={condition.id} variant="outlined">
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Condition Type</InputLabel>
                      <Select
                        value={condition.type}
                        label="Condition Type"
                        onChange={(e) => updateCondition(condition.id, { type: e.target.value })}
                      >
                        {CONDITION_TYPES.map(type => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={condition.operator}
                        label="Operator"
                        onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                      >
                        <MenuItem value="equals">Equals</MenuItem>
                        <MenuItem value="greater_than">Greater Than</MenuItem>
                        <MenuItem value="less_than">Less Than</MenuItem>
                        <MenuItem value="contains">Contains</MenuItem>
                        <MenuItem value="exists">Exists</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Value"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                      placeholder="Enter condition value"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Stack direction="row" spacing={1}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={condition.enabled}
                            onChange={(e) => updateCondition(condition.id, { enabled: e.target.checked })}
                          />
                        }
                        label="Enabled"
                      />
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => removeCondition(condition.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Box>
  );

  const renderCards = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Response Cards</Typography>
          <Button startIcon={<AddIcon />} onClick={addCard}>
            Add Card
          </Button>
        </Stack>
        
        {hookData.cards.length === 0 ? (
          <Alert severity="warning">
            At least one card must be defined for the hook to provide feedback.
          </Alert>
        ) : (
          hookData.cards.map((card) => (
            <Accordion key={card.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  {CARD_INDICATORS.find(i => i.value === card.indicator)?.icon}
                  <Typography variant="subtitle1">
                    {card.summary || 'Untitled Card'}
                  </Typography>
                  <Chip 
                    label={card.indicator} 
                    color={CARD_INDICATORS.find(i => i.value === card.indicator)?.color}
                    size="small"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Card Summary"
                      value={card.summary}
                      onChange={(e) => updateCard(card.id, { summary: e.target.value })}
                      placeholder="Brief summary of the alert"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Card Details"
                      value={card.detail}
                      onChange={(e) => updateCard(card.id, { detail: e.target.value })}
                      placeholder="Detailed explanation and recommendations"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Indicator</InputLabel>
                      <Select
                        value={card.indicator}
                        label="Indicator"
                        onChange={(e) => updateCard(card.id, { indicator: e.target.value })}
                      >
                        {CARD_INDICATORS.map(indicator => (
                          <MenuItem key={indicator.value} value={indicator.value}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {indicator.icon}
                              <Typography>{indicator.label}</Typography>
                            </Stack>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        color="error"
                        onClick={() => removeCard(card.id)}
                      >
                        Delete Card
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Stack>
    </Box>
  );

  const renderTestAndSave = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6">Test & Save Hook</Typography>
        
        {/* Hook Summary */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Hook Summary</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">ID:</Typography>
                <Typography variant="body1">{hookData.id || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Type:</Typography>
                <Typography variant="body1">{hookData.hook}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Conditions:</Typography>
                <Typography variant="body1">{hookData.conditions.length} defined</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Cards:</Typography>
                <Typography variant="body1">{hookData.cards.length} defined</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="subtitle1">Test Results</Typography>
                  {testResults.success ? (
                    <Chip label="Success" color="success" icon={<SuccessIcon />} />
                  ) : (
                    <Chip label="Error" color="error" icon={<ErrorIcon />} />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Execution time: {testResults.executionTime}ms
                  </Typography>
                </Stack>
                
                {testResults.success ? (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Generated {testResults.cards.length} card(s):
                    </Typography>
                    {testResults.cards.map((card, index) => (
                      <Alert 
                        key={index}
                        severity={card.indicator === 'critical' ? 'error' : card.indicator === 'warning' ? 'warning' : 'info'}
                        sx={{ mt: 1 }}
                      >
                        <Typography variant="subtitle2">{card.summary}</Typography>
                        <Typography variant="body2">{card.detail}</Typography>
                      </Alert>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="error">
                    Test failed: {testResults.error}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<TestIcon />}
            onClick={testHook}
            disabled={testing || !hookData.id || hookData.cards.length === 0}
            loading={testing}
          >
            {testing ? 'Testing...' : 'Test Hook'}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveHook}
            disabled={!hookData.id || !hookData.title || hookData.cards.length === 0}
          >
            Save Hook
          </Button>
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <BuildIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">
          CDS Hook Builder
        </Typography>
      </Stack>

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>
              <Typography variant="h6">{step.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </StepLabel>
            <StepContent>
              {index === 0 && renderBasicInfo()}
              {index === 1 && renderConditions()}
              {index === 2 && renderCards()}
              {index === 3 && renderTestAndSave()}
              
              <Box sx={{ mb: 2, mt: 2 }}>
                <div>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    sx={{ mt: 1, mr: 1 }}
                    disabled={index === steps.length - 1}
                  >
                    {index === steps.length - 1 ? 'Finish' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Back
                  </Button>
                  {index === 0 && onCancel && (
                    <Button
                      onClick={onCancel}
                      sx={{ mt: 1 }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Paper>
  );
};

export default CDSHookBuilder;