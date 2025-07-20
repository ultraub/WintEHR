/**
 * CDS Hook Builder V2 Component
 * Enhanced version with rules engine support and v2 service integration
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  Grid,
  Alert,
  FormControlLabel,
  Switch,
  Tooltip,
  Tab,
  Tabs,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  LinearProgress,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Science as RulesEngineIcon,
  CompareArrows as CompareIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  BugReport as TestIcon,
  Speed as PerformanceIcon,
  Security as SecurityIcon,
  LocalHospital as ClinicalIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon
} from '@mui/icons-material';
import { cdsHooksService } from '../../../../services/cdsHooksService';

// Import the original builder for legacy support
import CDSHookBuilder from './CDSHookBuilder';

const SERVICE_VERSIONS = [
  { value: 'legacy', label: 'Legacy Service', icon: <ClinicalIcon /> },
  { value: 'v2', label: 'V2 Rules Engine', icon: <RulesEngineIcon /> },
  { value: 'hybrid', label: 'Hybrid Mode', icon: <CompareIcon /> }
];

const RULE_CATEGORIES = [
  { value: 'MEDICATION_SAFETY', label: 'Medication Safety', color: 'error' },
  { value: 'DRUG_INTERACTIONS', label: 'Drug Interactions', color: 'warning' },
  { value: 'CHRONIC_DISEASE', label: 'Chronic Disease', color: 'info' },
  { value: 'PREVENTIVE_CARE', label: 'Preventive Care', color: 'success' },
  { value: 'LAB_MONITORING', label: 'Lab Monitoring', color: 'primary' },
  { value: 'CLINICAL_GUIDELINES', label: 'Clinical Guidelines', color: 'secondary' }
];

const CDSHookBuilderV2 = ({ onSave, onCancel, editingHook = null }) => {
  const theme = useTheme();
  const [mode, setMode] = useState('enhanced'); // 'legacy' or 'enhanced'
  const [serviceVersion, setServiceVersion] = useState('v2');
  const [useRulesEngine, setUseRulesEngine] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [testComparisonMode, setTestComparisonMode] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [engineMetrics, setEngineMetrics] = useState(null);
  const [testResults, setTestResults] = useState({
    legacy: null,
    rulesEngine: null
  });

  // Enhanced hook data with v2 features
  const [hookData, setHookData] = useState({
    ...editingHook || {
      id: '',
      title: '',
      description: '',
      hook: 'patient-view',
      enabled: true
    },
    // V2 specific fields
    serviceVersion: 'v2',
    rulesEngineConfig: {
      categories: [],
      priorities: ['CRITICAL', 'HIGH', 'MEDIUM'],
      useHybridMode: false,
      customRules: []
    }
  });

  // Load engine statistics on mount
  useEffect(() => {
    loadEngineStatistics();
  }, []);

  const loadEngineStatistics = async () => {
    try {
      const response = await fetch('/cds-hooks/rules-engine/statistics');
      if (response.ok) {
        const data = await response.json();
        setEngineMetrics(data.statistics);
      }
    } catch (error) {
      console.error('Failed to load engine statistics:', error);
    }
  };

  const handleServiceVersionChange = (version) => {
    setServiceVersion(version);
    
    // Update hook ID based on version
    if (version === 'v2' && hookData.id && !hookData.id.endsWith('-v2')) {
      setHookData({
        ...hookData,
        id: `${hookData.id}-v2`,
        serviceVersion: version
      });
    } else if (version === 'legacy' && hookData.id && hookData.id.endsWith('-v2')) {
      setHookData({
        ...hookData,
        id: hookData.id.replace('-v2', ''),
        serviceVersion: version
      });
    }
  };

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
    
    // Update hook data
    setHookData(prev => ({
      ...prev,
      rulesEngineConfig: {
        ...prev.rulesEngineConfig,
        categories: prev.rulesEngineConfig.categories.includes(category)
          ? prev.rulesEngineConfig.categories.filter(c => c !== category)
          : [...prev.rulesEngineConfig.categories, category]
      }
    }));
  };

  const handleTestComparison = async () => {
    setTestComparisonMode(true);
    
    try {
      // Test with legacy service
      const legacyResponse = await cdsHooksService.testHook(hookData.id.replace('-v2', ''), {
        patientId: 'test-patient-123',
        userId: 'test-user'
      });
      
      // Test with rules engine
      const v2Response = await cdsHooksService.testHook(`${hookData.id}-v2?use_rules_engine=true`, {
        patientId: 'test-patient-123',
        userId: 'test-user'
      });
      
      setTestResults({
        legacy: legacyResponse,
        rulesEngine: v2Response
      });
    } catch (error) {
      console.error('Test comparison failed:', error);
    }
  };

  const renderServiceVersionSelector = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Service Version Configuration
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Service Version</InputLabel>
              <Select
                value={serviceVersion}
                onChange={(e) => handleServiceVersionChange(e.target.value)}
                label="Service Version"
              >
                {SERVICE_VERSIONS.map(version => (
                  <MenuItem key={version.value} value={version.value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {version.icon}
                      <span>{version.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useRulesEngine}
                    onChange={(e) => setUseRulesEngine(e.target.checked)}
                    disabled={serviceVersion === 'legacy'}
                  />
                }
                label="Enable Rules Engine"
              />
              
              {serviceVersion === 'v2' && (
                <Tooltip title="V2 services use the rules engine by default">
                  <Chip
                    icon={<RulesEngineIcon />}
                    label="Rules Engine Active"
                    color="primary"
                    size="small"
                  />
                </Tooltip>
              )}
              
              {serviceVersion === 'hybrid' && (
                <Tooltip title="Combines results from both legacy and rules engine">
                  <Chip
                    icon={<CompareIcon />}
                    label="Hybrid Mode"
                    color="secondary"
                    size="small"
                  />
                </Tooltip>
              )}
            </Stack>
          </Grid>
        </Grid>
        
        {/* Engine Metrics */}
        {engineMetrics && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Rules Engine Status
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Chip
                  icon={<SuccessIcon />}
                  label={`${engineMetrics.total_rules} Rules`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Chip
                  icon={<InfoIcon />}
                  label={`${engineMetrics.enabled_rules} Enabled`}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Chip
                  icon={<PerformanceIcon />}
                  label={`${engineMetrics.rule_sets.length} Categories`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Chip
                  icon={<SecurityIcon />}
                  label="Healthy"
                  color="success"
                  variant="outlined"
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderRuleCategorySelector = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Rule Categories
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Select which rule categories to evaluate for this hook
        </Typography>
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {RULE_CATEGORIES.map(category => (
            <Grid item xs={12} sm={6} md={4} key={category.value}>
              <Card
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: selectedCategories.includes(category.value)
                    ? `${category.color}.50`
                    : 'transparent',
                  borderColor: selectedCategories.includes(category.value)
                    ? `${category.color}.main`
                    : 'divider',
                  '&:hover': {
                    borderColor: `${category.color}.main`,
                    transform: 'translateY(-2px)'
                  }
                }}
                onClick={() => handleCategoryToggle(category.value)}
              >
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">{category.label}</Typography>
                    {selectedCategories.includes(category.value) && (
                      <SuccessIcon color={category.color} fontSize="small" />
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderTestComparison = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">
            Test & Compare Engines
          </Typography>
          <Button
            variant="contained"
            startIcon={<TestIcon />}
            onClick={handleTestComparison}
            disabled={!hookData.id}
          >
            Run Comparison Test
          </Button>
        </Stack>
        
        {testComparisonMode && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Legacy Service Results
                </Typography>
                {testResults.legacy ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Cards: {testResults.legacy.cards?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Response Time: {testResults.legacy.responseTime || 'N/A'}ms
                    </Typography>
                  </Box>
                ) : (
                  <LinearProgress />
                )}
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Rules Engine Results
                </Typography>
                {testResults.rulesEngine ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Cards: {testResults.rulesEngine.cards?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Response Time: {testResults.rulesEngine.responseTime || 'N/A'}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Rules Evaluated: {testResults.rulesEngine._metadata?.rules_evaluated || 0}
                    </Typography>
                  </Box>
                ) : (
                  <LinearProgress />
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );

  const renderMigrationHelper = () => (
    <Alert severity="info" sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Migration Assistant
      </Typography>
      <Typography variant="body2">
        You're creating a V2 service that uses the new rules engine. This provides:
      </Typography>
      <List dense>
        <ListItem>
          <ListItemIcon>
            <SuccessIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Enhanced rule evaluation"
            secondary="More comprehensive clinical checks"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <SuccessIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Better performance"
            secondary="Parallel rule evaluation and caching"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <SuccessIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Backward compatibility"
            secondary="Falls back to legacy on errors"
          />
        </ListItem>
      </List>
    </Alert>
  );

  if (mode === 'legacy') {
    return <CDSHookBuilder onSave={onSave} onCancel={onCancel} editingHook={editingHook} />;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header with mode toggle */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">
            CDS Hook Builder {serviceVersion === 'v2' && <Chip label="V2" size="small" color="primary" />}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant={mode === 'legacy' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setMode('legacy')}
            >
              Legacy Mode
            </Button>
            <Button
              variant={mode === 'enhanced' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setMode('enhanced')}
              startIcon={<RulesEngineIcon />}
            >
              Enhanced Mode
            </Button>
          </Stack>
        </Stack>

        {/* Migration helper for v2 services */}
        {serviceVersion === 'v2' && renderMigrationHelper()}

        {/* Service version selector */}
        {renderServiceVersionSelector()}

        {/* Rule category selector for v2/hybrid */}
        {(serviceVersion === 'v2' || serviceVersion === 'hybrid') && renderRuleCategorySelector()}

        {/* Test comparison tool */}
        {renderTestComparison()}

        {/* Advanced options */}
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Advanced Options</Typography>
              <IconButton onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}>
                {showAdvancedOptions ? <HideIcon /> : <ViewIcon />}
              </IconButton>
            </Stack>
            
            {showAdvancedOptions && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={<Switch />}
                      label="Enable A/B Testing"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={<Switch />}
                      label="Log Comparison Metrics"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={<Switch />}
                      label="Include Debug Information"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={<Switch />}
                      label="Enable Feature Flags"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => onSave(hookData)}
            startIcon={serviceVersion === 'v2' ? <RulesEngineIcon /> : <ClinicalIcon />}
          >
            Save {serviceVersion === 'v2' ? 'V2' : ''} Hook
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default CDSHookBuilderV2;