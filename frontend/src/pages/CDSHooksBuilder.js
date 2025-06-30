import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Webhook as WebhookIcon,
  Rule as RuleIcon,
  Notification as NotificationIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../services/api';

const CDSHooksBuilder = () => {
  const [hooks, setHooks] = useState([]);
  const [selectedHook, setSelectedHook] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // Hook configuration state
  const [hookConfig, setHookConfig] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    priority: 1,
    enabled: true,
    conditions: [],
    actions: [],
    fhirVersion: '4.0.1'
  });

  // Available hook types and triggers
  const hookTypes = [
    {
      value: 'patient-view',
      label: 'Patient View',
      description: 'Triggered when a patient chart is opened',
      context: ['patientId', 'userId', 'encounterId']
    },
    {
      value: 'medication-prescribe',
      label: 'Medication Prescribe',
      description: 'Triggered when prescribing medications',
      context: ['patientId', 'userId', 'encounterId', 'medications']
    },
    {
      value: 'order-select',
      label: 'Order Select',
      description: 'Triggered when selecting diagnostic orders',
      context: ['patientId', 'userId', 'encounterId', 'selections']
    },
    {
      value: 'order-sign',
      label: 'Order Sign',
      description: 'Triggered when signing orders',
      context: ['patientId', 'userId', 'encounterId', 'draftOrders']
    }
  ];

  // Available condition types
  const conditionTypes = [
    {
      value: 'patient-age',
      label: 'Patient Age',
      description: 'Check patient age against criteria',
      parameters: ['operator', 'value', 'unit']
    },
    {
      value: 'patient-gender',
      label: 'Patient Gender',
      description: 'Check patient gender',
      parameters: ['value']
    },
    {
      value: 'diagnosis-code',
      label: 'Diagnosis Code',
      description: 'Check for specific ICD-10 codes',
      parameters: ['codes', 'operator']
    },
    {
      value: 'medication-active',
      label: 'Active Medication',
      description: 'Check for active medications',
      parameters: ['medications', 'operator']
    },
    {
      value: 'lab-value',
      label: 'Laboratory Value',
      description: 'Check lab results against thresholds',
      parameters: ['code', 'operator', 'value', 'unit', 'timeframe']
    },
    {
      value: 'vital-sign',
      label: 'Vital Sign',
      description: 'Check vital signs against normal ranges',
      parameters: ['type', 'operator', 'value', 'timeframe']
    }
  ];

  // Available action types
  const actionTypes = [
    {
      value: 'info-card',
      label: 'Information Card',
      description: 'Display informational message',
      parameters: ['summary', 'detail', 'indicator', 'source']
    },
    {
      value: 'warning-card',
      label: 'Warning Card',
      description: 'Display warning message',
      parameters: ['summary', 'detail', 'indicator', 'source']
    },
    {
      value: 'critical-card',
      label: 'Critical Alert',
      description: 'Display critical alert',
      parameters: ['summary', 'detail', 'indicator', 'source']
    },
    {
      value: 'suggestion',
      label: 'Suggestion',
      description: 'Provide actionable suggestion',
      parameters: ['label', 'description', 'resource', 'type']
    },
    {
      value: 'link',
      label: 'External Link',
      description: 'Link to external resource',
      parameters: ['label', 'url', 'type', 'appContext']
    }
  ];

  useEffect(() => {
    fetchHooks();
  }, []);

  const fetchHooks = async () => {
    try {
      const response = await api.get('/cds-hooks/hooks');
      setHooks(response.data || []);
    } catch (error) {
      console.error('Error fetching CDS hooks:', error);
    }
  };

  const handleCreateHook = () => {
    setHookConfig({
      id: '',
      title: '',
      description: '',
      hook: 'patient-view',
      priority: 1,
      enabled: true,
      conditions: [],
      actions: [],
      fhirVersion: '4.0.1'
    });
    setActiveStep(0);
    setBuilderOpen(true);
  };

  const handleEditHook = (hook) => {
    setHookConfig(hook);
    setSelectedHook(hook);
    setActiveStep(0);
    setBuilderOpen(true);
  };

  const handleSaveHook = async () => {
    try {
      setLoading(true);
      let response;
      
      if (selectedHook) {
        response = await api.put(`/cds-hooks/hooks/${selectedHook.id}`, hookConfig);
      } else {
        response = await api.post('/cds-hooks/hooks', hookConfig);
      }
      
      await fetchHooks();
      setBuilderOpen(false);
      setSelectedHook(null);
    } catch (error) {
      console.error('Error saving CDS hook:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHook = async (hookId) => {
    try {
      await api.delete(`/cds-hooks/hooks/${hookId}`);
      await fetchHooks();
    } catch (error) {
      console.error('Error deleting CDS hook:', error);
    }
  };

  const handleTestHook = async (hook) => {
    try {
      setLoading(true);
      const response = await api.post(`/cds-hooks/hooks/${hook.id}/test`, {
        patientId: '1', // Test with patient ID 1
        userId: 'test-user',
        encounterId: '1'
      });
      setTestResults(response.data);
    } catch (error) {
      console.error('Error testing CDS hook:', error);
      setTestResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const addCondition = () => {
    setHookConfig(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        id: Date.now().toString(),
        type: 'patient-age',
        parameters: {}
      }]
    }));
  };

  const updateCondition = (conditionId, updates) => {
    setHookConfig(prev => ({
      ...prev,
      conditions: prev.conditions.map(cond =>
        cond.id === conditionId ? { ...cond, ...updates } : cond
      )
    }));
  };

  const removeCondition = (conditionId) => {
    setHookConfig(prev => ({
      ...prev,
      conditions: prev.conditions.filter(cond => cond.id !== conditionId)
    }));
  };

  const addAction = () => {
    setHookConfig(prev => ({
      ...prev,
      actions: [...prev.actions, {
        id: Date.now().toString(),
        type: 'info-card',
        parameters: {}
      }]
    }));
  };

  const updateAction = (actionId, updates) => {
    setHookConfig(prev => ({
      ...prev,
      actions: prev.actions.map(action =>
        action.id === actionId ? { ...action, ...updates } : action
      )
    }));
  };

  const removeAction = (actionId) => {
    setHookConfig(prev => ({
      ...prev,
      actions: prev.actions.filter(action => action.id !== actionId)
    }));
  };

  const renderConditionBuilder = (condition) => {
    const conditionType = conditionTypes.find(t => t.value === condition.type);
    
    return (
      <Card key={condition.id} variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Condition</Typography>
            <IconButton onClick={() => removeCondition(condition.id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Condition Type</InputLabel>
                <Select
                  value={condition.type}
                  onChange={(e) => updateCondition(condition.id, { type: e.target.value, parameters: {} })}
                  label="Condition Type"
                >
                  {conditionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {conditionType && (
              <>
                {conditionType.parameters.includes('operator') && (
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={condition.parameters.operator || ''}
                        onChange={(e) => updateCondition(condition.id, {
                          parameters: { ...condition.parameters, operator: e.target.value }
                        })}
                        label="Operator"
                      >
                        <MenuItem value="eq">Equals</MenuItem>
                        <MenuItem value="ne">Not Equals</MenuItem>
                        <MenuItem value="gt">Greater Than</MenuItem>
                        <MenuItem value="ge">Greater or Equal</MenuItem>
                        <MenuItem value="lt">Less Than</MenuItem>
                        <MenuItem value="le">Less or Equal</MenuItem>
                        <MenuItem value="contains">Contains</MenuItem>
                        <MenuItem value="in">In List</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                
                {conditionType.parameters.includes('value') && (
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Value"
                      value={condition.parameters.value || ''}
                      onChange={(e) => updateCondition(condition.id, {
                        parameters: { ...condition.parameters, value: e.target.value }
                      })}
                    />
                  </Grid>
                )}
                
                {conditionType.parameters.includes('unit') && (
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Unit"
                      value={condition.parameters.unit || ''}
                      onChange={(e) => updateCondition(condition.id, {
                        parameters: { ...condition.parameters, unit: e.target.value }
                      })}
                    />
                  </Grid>
                )}
                
                {conditionType.parameters.includes('codes') && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="ICD-10 Codes (comma separated)"
                      value={condition.parameters.codes || ''}
                      onChange={(e) => updateCondition(condition.id, {
                        parameters: { ...condition.parameters, codes: e.target.value }
                      })}
                      placeholder="I10, E11.9, Z51.11"
                    />
                  </Grid>
                )}
                
                {conditionType.parameters.includes('timeframe') && (
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Timeframe (days)"
                      type="number"
                      value={condition.parameters.timeframe || ''}
                      onChange={(e) => updateCondition(condition.id, {
                        parameters: { ...condition.parameters, timeframe: e.target.value }
                      })}
                    />
                  </Grid>
                )}
              </>
            )}
          </Grid>
          
          {conditionType && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {conditionType.description}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderActionBuilder = (action) => {
    const actionType = actionTypes.find(t => t.value === action.type);
    
    return (
      <Card key={action.id} variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Action</Typography>
            <IconButton onClick={() => removeAction(action.id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Action Type</InputLabel>
                <Select
                  value={action.type}
                  onChange={(e) => updateAction(action.id, { type: e.target.value, parameters: {} })}
                  label="Action Type"
                >
                  {actionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {actionType && (
              <>
                {actionType.parameters.includes('summary') && (
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      label="Summary"
                      value={action.parameters.summary || ''}
                      onChange={(e) => updateAction(action.id, {
                        parameters: { ...action.parameters, summary: e.target.value }
                      })}
                    />
                  </Grid>
                )}
                
                {actionType.parameters.includes('detail') && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Detail"
                      value={action.parameters.detail || ''}
                      onChange={(e) => updateAction(action.id, {
                        parameters: { ...action.parameters, detail: e.target.value }
                      })}
                    />
                  </Grid>
                )}
                
                {actionType.parameters.includes('indicator') && (
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Indicator</InputLabel>
                      <Select
                        value={action.parameters.indicator || ''}
                        onChange={(e) => updateAction(action.id, {
                          parameters: { ...action.parameters, indicator: e.target.value }
                        })}
                        label="Indicator"
                      >
                        <MenuItem value="info">Info</MenuItem>
                        <MenuItem value="warning">Warning</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                
                {actionType.parameters.includes('source') && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Source"
                      value={action.parameters.source || ''}
                      onChange={(e) => updateAction(action.id, {
                        parameters: { ...action.parameters, source: e.target.value }
                      })}
                      placeholder="Clinical Guidelines"
                    />
                  </Grid>
                )}
                
                {actionType.parameters.includes('label') && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Label"
                      value={action.parameters.label || ''}
                      onChange={(e) => updateAction(action.id, {
                        parameters: { ...action.parameters, label: e.target.value }
                      })}
                    />
                  </Grid>
                )}
                
                {actionType.parameters.includes('url') && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="URL"
                      value={action.parameters.url || ''}
                      onChange={(e) => updateAction(action.id, {
                        parameters: { ...action.parameters, url: e.target.value }
                      })}
                    />
                  </Grid>
                )}
              </>
            )}
          </Grid>
          
          {actionType && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {actionType.description}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  const steps = [
    {
      label: 'Basic Information',
      content: (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Hook ID"
              value={hookConfig.id}
              onChange={(e) => setHookConfig(prev => ({ ...prev, id: e.target.value }))}
              placeholder="unique-hook-id"
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Title"
              value={hookConfig.title}
              onChange={(e) => setHookConfig(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={hookConfig.description}
              onChange={(e) => setHookConfig(prev => ({ ...prev, description: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Hook Type</InputLabel>
              <Select
                value={hookConfig.hook}
                onChange={(e) => setHookConfig(prev => ({ ...prev, hook: e.target.value }))}
                label="Hook Type"
              >
                {hookTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Priority"
              value={hookConfig.priority}
              onChange={(e) => setHookConfig(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={hookConfig.enabled}
                  onChange={(e) => setHookConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                />
              }
              label="Enabled"
            />
          </Grid>
        </Grid>
      )
    },
    {
      label: 'Conditions',
      content: (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">When should this hook trigger?</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addCondition}
            >
              Add Condition
            </Button>
          </Box>
          
          {hookConfig.conditions.length === 0 ? (
            <Alert severity="info">
              Add conditions to specify when this hook should trigger. Leave empty to trigger on all events of the selected hook type.
            </Alert>
          ) : (
            hookConfig.conditions.map(renderConditionBuilder)
          )}
        </Box>
      )
    },
    {
      label: 'Actions',
      content: (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">What should this hook do?</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addAction}
            >
              Add Action
            </Button>
          </Box>
          
          {hookConfig.actions.length === 0 ? (
            <Alert severity="warning">
              You must add at least one action for this hook to be useful.
            </Alert>
          ) : (
            hookConfig.actions.map(renderActionBuilder)
          )}
        </Box>
      )
    },
    {
      label: 'Review & Test',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>Hook Configuration Summary</Typography>
          
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Hook ID</Typography>
                <Typography variant="body1">{hookConfig.id || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Title</Typography>
                <Typography variant="body1">{hookConfig.title || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Description</Typography>
                <Typography variant="body1">{hookConfig.description || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Hook Type</Typography>
                <Typography variant="body1">
                  {hookTypes.find(t => t.value === hookConfig.hook)?.label}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Priority</Typography>
                <Typography variant="body1">{hookConfig.priority}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">Status</Typography>
                <Chip 
                  label={hookConfig.enabled ? 'Enabled' : 'Disabled'} 
                  color={hookConfig.enabled ? 'success' : 'default'}
                  size="small"
                />
              </Grid>
            </Grid>
          </Paper>
          
          <Typography variant="h6" gutterBottom>Conditions ({hookConfig.conditions.length})</Typography>
          {hookConfig.conditions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No conditions - will trigger on all events
            </Typography>
          ) : (
            <List dense sx={{ mb: 2 }}>
              {hookConfig.conditions.map((condition, index) => (
                <ListItem key={condition.id}>
                  <ListItemText
                    primary={`${index + 1}. ${conditionTypes.find(t => t.value === condition.type)?.label}`}
                    secondary={JSON.stringify(condition.parameters)}
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          <Typography variant="h6" gutterBottom>Actions ({hookConfig.actions.length})</Typography>
          {hookConfig.actions.length === 0 ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              No actions defined - this hook will not do anything
            </Alert>
          ) : (
            <List dense sx={{ mb: 2 }}>
              {hookConfig.actions.map((action, index) => (
                <ListItem key={action.id}>
                  <ListItemText
                    primary={`${index + 1}. ${actionTypes.find(t => t.value === action.type)?.label}`}
                    secondary={action.parameters.summary || action.parameters.label || 'No summary'}
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          {testResults && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" gutterBottom>Test Results</Typography>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </Paper>
          )}
        </Box>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            CDS Hooks Builder
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage Clinical Decision Support hooks with an intuitive interface
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateHook}
          size="large"
        >
          Create New Hook
        </Button>
      </Box>

      {/* Existing Hooks */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Existing CDS Hooks ({hooks.length})</Typography>
        </Box>
        
        {hooks.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <WebhookIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No CDS Hooks Configured
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first CDS hook to start providing clinical decision support
            </Typography>
            <Button variant="outlined" onClick={handleCreateHook}>
              Get Started
            </Button>
          </Box>
        ) : (
          <List>
            {hooks.map((hook, index) => (
              <React.Fragment key={hook.id}>
                <ListItem>
                  <ListItemIcon>
                    <RuleIcon color={hook.enabled ? 'primary' : 'disabled'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {hook.title}
                        </Typography>
                        <Chip 
                          label={hook.hook} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={hook.enabled ? 'Enabled' : 'Disabled'} 
                          color={hook.enabled ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {hook.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Priority: {hook.priority} | Conditions: {hook.conditions?.length || 0} | Actions: {hook.actions?.length || 0}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Test Hook">
                      <IconButton onClick={() => handleTestHook(hook)} color="primary">
                        <PlayIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Hook">
                      <IconButton onClick={() => handleEditHook(hook)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Hook">
                      <IconButton onClick={() => handleDeleteHook(hook.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
                {index < hooks.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Hook Builder Dialog */}
      <Dialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle>
          {selectedHook ? 'Edit CDS Hook' : 'Create New CDS Hook'}
        </DialogTitle>
        
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  {step.content}
                  
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (index === steps.length - 1) {
                          handleSaveHook();
                        } else {
                          setActiveStep(index + 1);
                        }
                      }}
                      disabled={loading}
                      sx={{ mr: 1 }}
                    >
                      {index === steps.length - 1 ? 'Save Hook' : 'Continue'}
                    </Button>
                    
                    {index > 0 && (
                      <Button onClick={() => setActiveStep(index - 1)}>
                        Back
                      </Button>
                    )}
                    
                    {index === steps.length - 1 && hookConfig.id && (
                      <Button
                        variant="outlined"
                        onClick={() => handleTestHook(hookConfig)}
                        disabled={loading}
                        sx={{ ml: 1 }}
                      >
                        Test Hook
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setBuilderOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CDSHooksBuilder;